use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};
use zeromq::{ReqSocket, Socket, SocketRecv, SocketSend};
#[cfg(windows)]
use windows_sys::core::BOOL;
#[cfg(windows)]
use windows_sys::Win32::Foundation::{CloseHandle, HWND, INVALID_HANDLE_VALUE, LPARAM};
#[cfg(windows)]
use windows_sys::Win32::System::Memory::{
    CreateFileMappingW, MapViewOfFile, UnmapViewOfFile, FILE_MAP_WRITE, PAGE_READWRITE,
};
#[cfg(windows)]
use windows_sys::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetWindowTextLengthW, GetWindowTextW, IsWindowVisible,
};

const CREDENTIAL_SERVICE: &str = "com.swcreate.playstreamers";
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const VIRTUAL_CAMERA_WIDTH: u32 = 1280;
const VIRTUAL_CAMERA_HEIGHT: u32 = 720;
const VIRTUAL_CAMERA_FRAME_BYTES: usize = (VIRTUAL_CAMERA_WIDTH * VIRTUAL_CAMERA_HEIGHT * 4) as usize;
const VIRTUAL_CAMERA_HEADER_BYTES: usize = 64;
const VIRTUAL_CAMERA_MAPPING_BYTES: usize = VIRTUAL_CAMERA_HEADER_BYTES + VIRTUAL_CAMERA_FRAME_BYTES;

#[derive(Default)]
pub struct StudioEngineState(Mutex<StudioEngine>);

#[derive(Default)]
struct StudioEngine {
    child: Option<Child>,
    mode: EngineMode,
    encoder: Option<String>,
    output_path: Option<PathBuf>,
    started_at: Option<Instant>,
    last_error: Arc<Mutex<Option<String>>>,
    audio_loopback: Option<AudioLoopbackHandle>,
    active_scene: String,
    virtual_camera: Option<VirtualCameraHandle>,
}

struct VirtualCameraHandle {
    child: Child,
    stop: Arc<AtomicBool>,
    worker: Option<thread::JoinHandle<()>>,
}

impl VirtualCameraHandle {
    fn stop(&mut self) {
        self.stop.store(true, Ordering::Release);
        if let Some(stdin) = self.child.stdin.as_mut() {
            let _ = stdin.write_all(b"q\n");
            let _ = stdin.flush();
        }
        let deadline = Instant::now() + Duration::from_secs(3);
        while Instant::now() < deadline {
            if self.child.try_wait().ok().flatten().is_some() {
                break;
            }
            thread::sleep(Duration::from_millis(50));
        }
        if self.child.try_wait().ok().flatten().is_none() {
            let _ = self.child.kill();
            let _ = self.child.wait();
        }
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}

impl Drop for VirtualCameraHandle {
    fn drop(&mut self) {
        self.stop();
    }
}

struct AudioLoopbackHandle {
    port: u16,
    stop: Arc<AtomicBool>,
    worker: Option<thread::JoinHandle<()>>,
}

impl AudioLoopbackHandle {
    fn stop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        let _ = TcpStream::connect(("127.0.0.1", self.port));
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}

impl Drop for AudioLoopbackHandle {
    fn drop(&mut self) {
        self.stop();
    }
}

impl Drop for StudioEngine {
    fn drop(&mut self) {
        if let Some(mut camera) = self.virtual_camera.take() {
            camera.stop();
        }
        if let Some(mut audio) = self.audio_loopback.take() {
            audio.stop();
        }
        if let Some(mut child) = self.child.take() {
            if let Some(stdin) = child.stdin.as_mut() {
                let _ = stdin.write_all(b"q\n");
                let _ = stdin.flush();
            }
            for _ in 0..10 {
                if child.try_wait().ok().flatten().is_some() {
                    return;
                }
                thread::sleep(Duration::from_millis(50));
            }
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

#[derive(Default, Clone, Copy, PartialEq, Eq)]
enum EngineMode {
    #[default]
    Idle,
    Recording,
    Streaming,
    RecordingAndStreaming,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineStatus {
    state: &'static str,
    backend: &'static str,
    encoder: Option<String>,
    dropped_frames: u64,
    elapsed_seconds: u64,
    output_path: Option<String>,
    last_error: Option<String>,
    active_scene: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingOptions {
    path: Option<String>,
    framerate: Option<u32>,
    width: Option<u32>,
    height: Option<u32>,
    bitrate_kbps: Option<u32>,
    audio_device: Option<String>,
    capture_system_audio: Option<bool>,
    system_audio_volume: Option<u32>,
    microphone_volume: Option<u32>,
    capture_mode: Option<String>,
    draw_cursor: Option<bool>,
    source_kind: Option<String>,
    source_id: Option<String>,
    overlay_text: Option<String>,
    overlay_image_path: Option<String>,
    multitrack_audio: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamingOptions {
    service: String,
    ingest_url: String,
    stream_key_ref: String,
    record_locally: Option<bool>,
    framerate: Option<u32>,
    width: Option<u32>,
    height: Option<u32>,
    bitrate_kbps: Option<u32>,
    audio_device: Option<String>,
    capture_system_audio: Option<bool>,
    system_audio_volume: Option<u32>,
    microphone_volume: Option<u32>,
    capture_mode: Option<String>,
    draw_cursor: Option<bool>,
    source_kind: Option<String>,
    source_id: Option<String>,
    overlay_text: Option<String>,
    overlay_image_path: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StopResult {
    path: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDevice {
    id: String,
    label: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureSource {
    id: String,
    label: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VirtualCameraStatus {
    supported: bool,
    installed: bool,
    running: bool,
    label: &'static str,
    message: String,
}

impl EngineMode {
    fn as_str(self) -> &'static str {
        match self {
            Self::Idle => "idle",
            Self::Recording => "recording",
            Self::Streaming => "streaming",
            Self::RecordingAndStreaming => "recording-and-streaming",
        }
    }
}

#[tauri::command]
pub fn get_engine_status(app: AppHandle, state: State<'_, StudioEngineState>) -> EngineStatus {
    let ffmpeg = resolve_ffmpeg(&app);
    let mut engine = state.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    refresh_process(&mut engine);
    EngineStatus {
        state: engine.mode.as_str(),
        backend: if ffmpeg.is_some() { "native" } else { "browser-preview" },
        encoder: engine.encoder.clone(),
        dropped_frames: 0,
        elapsed_seconds: engine.started_at.map(|value| value.elapsed().as_secs()).unwrap_or(0),
        output_path: engine.output_path.as_ref().map(|value| value.to_string_lossy().into_owned()),
        last_error: engine.last_error.lock().ok().and_then(|value| value.clone()),
        active_scene: if engine.active_scene.is_empty() { "desktop".into() } else { engine.active_scene.clone() },
    }
}

#[tauri::command]
pub fn list_audio_devices(app: AppHandle) -> Result<Vec<AudioDevice>, String> {
    let ffmpeg = resolve_ffmpeg(&app).ok_or_else(|| "Yerel Studio kodlayıcısı bulunamadı.".to_string())?;
    let output = hidden_command(&ffmpeg)
        .args(["-hide_banner", "-list_devices", "true", "-f", "dshow", "-i", "dummy"])
        .output()
        .map_err(|_| "Ses cihazları okunamadı.".to_string())?;
    let log = String::from_utf8_lossy(&output.stderr);
    let mut devices = Vec::new();
    for line in log.lines() {
        if !line.contains("(audio)") {
            continue;
        }
        if let Some(start) = line.find('"') {
            if let Some(end) = line[start + 1..].find('"') {
                let name = line[start + 1..start + 1 + end].trim();
                if !name.is_empty() && !devices.iter().any(|item: &AudioDevice| item.id == name) {
                    devices.push(AudioDevice { id: name.to_string(), label: name.to_string() });
                }
            }
        }
    }
    Ok(devices)
}

#[tauri::command]
pub fn list_video_devices(app: AppHandle) -> Result<Vec<CaptureSource>, String> {
    let ffmpeg = resolve_ffmpeg(&app).ok_or_else(|| "Yerel Studio kodlayıcısı bulunamadı.".to_string())?;
    let output = hidden_command(&ffmpeg)
        .args(["-hide_banner", "-list_devices", "true", "-f", "dshow", "-i", "dummy"])
        .output()
        .map_err(|_| "Kamera cihazları okunamadı.".to_string())?;
    let log = String::from_utf8_lossy(&output.stderr);
    let mut devices = Vec::new();
    for line in log.lines() {
        if line.contains("Alternative name") || (!line.contains("(video)") && !line.contains("(none)")) {
            continue;
        }
        if let Some(start) = line.find('"') {
            if let Some(end) = line[start + 1..].find('"') {
                let name = line[start + 1..start + 1 + end].trim();
                if !name.is_empty() && !devices.iter().any(|item: &CaptureSource| item.id == name) {
                    devices.push(CaptureSource { id: name.to_string(), label: name.to_string() });
                }
            }
        }
    }
    Ok(devices)
}

#[cfg(windows)]
unsafe extern "system" fn collect_window(hwnd: HWND, state: LPARAM) -> BOOL {
    if IsWindowVisible(hwnd) == 0 {
        return 1;
    }
    let length = GetWindowTextLengthW(hwnd);
    if length <= 0 {
        return 1;
    }
    let mut buffer = vec![0u16; length as usize + 1];
    let written = GetWindowTextW(hwnd, buffer.as_mut_ptr(), buffer.len() as i32);
    if written <= 0 {
        return 1;
    }
    let title = String::from_utf16_lossy(&buffer[..written as usize]).trim().to_string();
    if !title.is_empty() {
        let windows = &mut *(state as *mut Vec<CaptureSource>);
        windows.push(CaptureSource { id: (hwnd as usize).to_string(), label: title });
    }
    1
}

#[tauri::command]
pub fn list_capture_windows() -> Result<Vec<CaptureSource>, String> {
    #[cfg(windows)]
    {
        let mut windows = Vec::<CaptureSource>::new();
        unsafe {
            EnumWindows(Some(collect_window), &mut windows as *mut Vec<CaptureSource> as LPARAM);
        }
        windows.sort_by(|left, right| left.label.to_lowercase().cmp(&right.label.to_lowercase()));
        windows.dedup_by(|left, right| left.id == right.id);
        Ok(windows)
    }
    #[cfg(not(windows))]
    {
        Ok(Vec::new())
    }
}

#[tauri::command]
pub fn get_recordings_directory(app: AppHandle) -> Result<String, String> {
    recordings_directory(&app).map(|path| path.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn remux_recording(app: AppHandle, input_path: String) -> Result<String, String> {
    let ffmpeg = resolve_ffmpeg(&app).ok_or_else(|| "Yerel Studio kodlayıcısı bulunamadı.".to_string())?;
    let recordings = recordings_directory(&app)?.canonicalize().map_err(|_| "Kayıt klasörü doğrulanamadı.".to_string())?;
    let input = PathBuf::from(input_path).canonicalize().map_err(|_| "Dönüştürülecek kayıt bulunamadı.".to_string())?;
    if !input.starts_with(&recordings)
        || input.extension().and_then(|value| value.to_str()).map(|value| !value.eq_ignore_ascii_case("mkv")).unwrap_or(true)
    {
        return Err("Yalnız Play Streamers klasöründeki MKV kayıtları dönüştürülebilir.".into());
    }
    let mut output = input.with_extension("mp4");
    if output.exists() {
        let epoch = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
        output = input.with_file_name(format!(
            "{}-{epoch}.mp4",
            input.file_stem().and_then(|value| value.to_str()).unwrap_or("play-streamers")
        ));
    }
    let output_for_task = output.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let result = hidden_command(&ffmpeg)
            .args([
                "-hide_banner", "-loglevel", "error", "-i", &input.to_string_lossy(),
                "-map", "0", "-c", "copy", "-movflags", "+faststart", "-y", &output_for_task.to_string_lossy(),
            ])
            .output()
            .map_err(|_| "MP4 dönüştürme işlemi başlatılamadı.".to_string())?;
        if result.status.success() {
            Ok(())
        } else {
            let detail = String::from_utf8_lossy(&result.stderr);
            Err(format!("MP4 dönüştürme tamamlanamadı: {}", detail.chars().take(240).collect::<String>()))
        }
    })
    .await
    .map_err(|_| "MP4 dönüştürme görevi kapandı.".to_string())??;
    Ok(output.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn start_recording(
    app: AppHandle,
    state: State<'_, StudioEngineState>,
    options: RecordingOptions,
) -> Result<(), String> {
    let ffmpeg = resolve_ffmpeg(&app).ok_or_else(|| "Yerel Studio kodlayıcısı bulunamadı.".to_string())?;
    let mut engine = state.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    refresh_process(&mut engine);
    ensure_idle(&engine)?;

    let output_path = recording_path(&app, options.path.as_deref())?;
    let encoder = select_encoder(&ffmpeg);
    let audio_loopback = if options.capture_system_audio.unwrap_or(true) {
        Some(start_system_audio_loopback(Arc::clone(&engine.last_error))?)
    } else {
        None
    };
    let mut args = capture_args(
        &options.audio_device,
        audio_loopback.as_ref().map(|value| value.port),
        options.capture_mode.as_deref(),
        options.framerate,
        options.width,
        options.height,
        options.bitrate_kbps,
        options.draw_cursor,
        options.system_audio_volume,
        options.microphone_volume,
        &encoder,
        options.source_kind.as_deref(),
        options.source_id.as_deref(),
        options.overlay_text.as_deref(),
        options.overlay_image_path.as_deref(),
        options.multitrack_audio.unwrap_or(false),
        true,
    )?;
    let mut fallback_args = capture_args(
        &options.audio_device,
        audio_loopback.as_ref().map(|value| value.port),
        options.capture_mode.as_deref(),
        options.framerate,
        options.width,
        options.height,
        options.bitrate_kbps,
        options.draw_cursor,
        options.system_audio_volume,
        options.microphone_volume,
        &encoder,
        options.source_kind.as_deref(),
        options.source_id.as_deref(),
        options.overlay_text.as_deref(),
        options.overlay_image_path.as_deref(),
        options.multitrack_audio.unwrap_or(false),
        false,
    )?;
    args.extend(["-f".into(), "matroska".into(), output_path.to_string_lossy().into_owned()]);
    fallback_args.extend(["-f".into(), "matroska".into(), output_path.to_string_lossy().into_owned()]);
    start_process(
        &ffmpeg,
        args,
        &mut engine,
        EngineMode::Recording,
        encoder,
        Some(output_path),
        audio_loopback,
        options.capture_mode.as_deref().unwrap_or("desktop"),
        Some(fallback_args),
    )
}

#[tauri::command]
pub fn stop_recording(state: State<'_, StudioEngineState>) -> Result<StopResult, String> {
    let mut engine = state.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    if !matches!(engine.mode, EngineMode::Recording | EngineMode::RecordingAndStreaming) {
        return Err("Aktif yerel kayıt bulunamadı.".into());
    }
    let path = engine.output_path.as_ref().map(|value| value.to_string_lossy().into_owned());
    stop_process(&mut engine)?;
    Ok(StopResult { path })
}

#[tauri::command]
pub fn start_streaming(
    app: AppHandle,
    state: State<'_, StudioEngineState>,
    options: StreamingOptions,
) -> Result<(), String> {
    let ffmpeg = resolve_ffmpeg(&app).ok_or_else(|| "Yerel Studio kodlayıcısı bulunamadı.".to_string())?;
    validate_stream_target(&options.service, &options.ingest_url, &options.stream_key_ref)?;
    let stream_key = Entry::new(CREDENTIAL_SERVICE, &options.stream_key_ref)
        .map_err(|_| "Windows güvenli kasası açılamadı.".to_string())?
        .get_password()
        .map_err(|_| "Yayın anahtarı güvenli kasada bulunamadı.".to_string())?;
    if stream_key.len() < 6
        || stream_key.len() > 512
        || !stream_key.chars().all(|value| value.is_ascii_alphanumeric() || matches!(value, '-' | '_' | '.'))
    {
        return Err("Yayın anahtarı geçersiz.".into());
    }

    let mut engine = state.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    refresh_process(&mut engine);
    ensure_idle(&engine)?;
    let record_locally = options.record_locally.unwrap_or(true);
    let output_path = if record_locally { Some(recording_path(&app, None)?) } else { None };
    let encoder = select_encoder(&ffmpeg);
    let audio_loopback = if options.capture_system_audio.unwrap_or(true) {
        Some(start_system_audio_loopback(Arc::clone(&engine.last_error))?)
    } else {
        None
    };
    let mut args = capture_args(
        &options.audio_device,
        audio_loopback.as_ref().map(|value| value.port),
        options.capture_mode.as_deref(),
        options.framerate,
        options.width,
        options.height,
        options.bitrate_kbps,
        options.draw_cursor,
        options.system_audio_volume,
        options.microphone_volume,
        &encoder,
        options.source_kind.as_deref(),
        options.source_id.as_deref(),
        options.overlay_text.as_deref(),
        options.overlay_image_path.as_deref(),
        false,
        true,
    )?;
    let mut fallback_args = capture_args(
        &options.audio_device,
        audio_loopback.as_ref().map(|value| value.port),
        options.capture_mode.as_deref(),
        options.framerate,
        options.width,
        options.height,
        options.bitrate_kbps,
        options.draw_cursor,
        options.system_audio_volume,
        options.microphone_volume,
        &encoder,
        options.source_kind.as_deref(),
        options.source_id.as_deref(),
        options.overlay_text.as_deref(),
        options.overlay_image_path.as_deref(),
        false,
        false,
    )?;
    let target = format!("{}/{}", options.ingest_url.trim_end_matches('/'), stream_key);
    if let Some(path) = &output_path {
        let escaped_path = escape_tee_value(path);
        args.extend([
            "-f".into(),
            "tee".into(),
            format!("[f=matroska:onfail=ignore]{}|[f=flv:onfail=abort]{}", escaped_path, target),
        ]);
        fallback_args.extend([
            "-f".into(),
            "tee".into(),
            format!("[f=matroska:onfail=ignore]{}|[f=flv:onfail=abort]{}", escaped_path, target),
        ]);
    } else {
        args.extend(["-f".into(), "flv".into(), target]);
        fallback_args.extend(["-f".into(), "flv".into(), format!("{}/{}", options.ingest_url.trim_end_matches('/'), stream_key)]);
    }
    let mode = if record_locally { EngineMode::RecordingAndStreaming } else { EngineMode::Streaming };
    start_process(
        &ffmpeg,
        args,
        &mut engine,
        mode,
        encoder,
        output_path,
        audio_loopback,
        options.capture_mode.as_deref().unwrap_or("desktop"),
        Some(fallback_args),
    )
}

#[tauri::command]
pub fn stop_streaming(state: State<'_, StudioEngineState>) -> Result<(), String> {
    let mut engine = state.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    if !matches!(engine.mode, EngineMode::Streaming | EngineMode::RecordingAndStreaming) {
        return Err("Aktif yayın bulunamadı.".into());
    }
    stop_process(&mut engine)
}

#[tauri::command]
pub fn get_virtual_camera_status(
    app: AppHandle,
    state: State<'_, StudioEngineState>,
) -> VirtualCameraStatus {
    let mut engine = state.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    refresh_virtual_camera(&mut engine);
    let running = engine.virtual_camera.is_some();
    match query_virtual_camera_component(&app) {
        Ok((supported, installed)) => VirtualCameraStatus {
            supported,
            installed,
            running,
            label: "Play Streamers Camera",
            message: if !supported {
                "Sanal kamera yalnız Windows 11'de kullanılabilir.".into()
            } else if !installed {
                "Bir kez kurduktan sonra Zoom, Discord, Teams ve tarayıcı uygulamalarında görünür.".into()
            } else if running {
                "Studio sahnesi kamera olarak paylaşılıyor.".into()
            } else {
                "Kamera hazır; açıldığında Studio sahnesini paylaşır.".into()
            },
        },
        Err(message) => VirtualCameraStatus {
            supported: true,
            installed: false,
            running,
            label: "Play Streamers Camera",
            message,
        },
    }
}

#[tauri::command]
pub fn install_virtual_camera(app: AppHandle) -> Result<(), String> {
    let helper = resolve_virtual_camera_binary(&app, "PlayStreamersVirtualCameraManager.exe")
        .ok_or_else(|| "Sanal kamera yöneticisi uygulama paketinde bulunamadı.".to_string())?;
    let source = resolve_virtual_camera_binary(&app, "PlayStreamersVirtualCamera.dll")
        .ok_or_else(|| "Sanal kamera görüntü bileşeni uygulama paketinde bulunamadı.".to_string())?;

    // Store/MSIX paketinde COM sınıfı manifest tarafından kayıtlıdır ve yönetici izni gerekmez.
    if hidden_command(&helper).arg("activate").status().map(|status| status.success()).unwrap_or(false) {
        let (supported, installed) = query_virtual_camera_component(&app)?;
        if supported && installed {
            return Ok(());
        }
    }

    let helper_arg = powershell_literal(&helper.to_string_lossy());
    let source_arg = powershell_literal(&format!("\"{}\"", source.to_string_lossy()));
    let script = format!(
        "$p=Start-Process -FilePath {helper_arg} -ArgumentList @('install',{source_arg}) -Verb RunAs -WindowStyle Hidden -Wait -PassThru; exit $p.ExitCode"
    );
    let status = hidden_command(Path::new("powershell.exe"))
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", &script])
        .status()
        .map_err(|_| "Windows yönetici izni penceresi açılamadı.".to_string())?;
    if !status.success() {
        return Err("Sanal kamera kurulamadı. Windows yönetici iznini onaylayıp yeniden dene.".into());
    }
    let (supported, installed) = query_virtual_camera_component(&app)?;
    if !supported || !installed {
        return Err("Windows sanal kamerayı kurulumdan sonra doğrulayamadı.".into());
    }
    Ok(())
}

#[tauri::command]
pub fn start_virtual_camera(
    app: AppHandle,
    state: State<'_, StudioEngineState>,
    options: RecordingOptions,
) -> Result<(), String> {
    let (supported, installed) = query_virtual_camera_component(&app)?;
    if !supported {
        return Err("Sanal kamera Windows 11 gerektirir.".into());
    }
    if !installed {
        return Err("Önce Play Streamers sanal kamerayı bir kez kur.".into());
    }
    let ffmpeg = resolve_ffmpeg(&app).ok_or_else(|| "Yerel Studio kodlayıcısı bulunamadı.".to_string())?;
    let mut engine = state.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    refresh_virtual_camera(&mut engine);
    if engine.virtual_camera.is_some() {
        return Ok(());
    }

    let args = virtual_camera_args(&options)?;
    let mut child = hidden_command(&ffmpeg)
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|_| "Sanal kamera görüntü motoru başlatılamadı.".to_string())?;
    let stdout = child.stdout.take().ok_or_else(|| "Sanal kamera görüntü kanalı açılamadı.".to_string())?;
    if let Some(stderr) = child.stderr.take() {
        let last_error = Arc::clone(&engine.last_error);
        thread::spawn(move || {
            use std::io::{BufRead, BufReader};
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                if is_error_line(&line) {
                    if let Ok(mut slot) = last_error.lock() {
                        *slot = Some(line.chars().take(500).collect());
                    }
                }
            }
        });
    }
    let stop = Arc::new(AtomicBool::new(false));
    let worker_stop = Arc::clone(&stop);
    let worker = thread::spawn(move || write_virtual_camera_frames(stdout, worker_stop));
    thread::sleep(Duration::from_millis(400));
    if child.try_wait().ok().flatten().is_some() {
        stop.store(true, Ordering::Release);
        let _ = worker.join();
        return Err(engine.last_error.lock().ok().and_then(|value| value.clone()).unwrap_or_else(|| "Sanal kamera görüntü motoru beklenmedik biçimde kapandı.".into()));
    }
    engine.virtual_camera = Some(VirtualCameraHandle { child, stop, worker: Some(worker) });
    Ok(())
}

#[tauri::command]
pub fn stop_virtual_camera(state: State<'_, StudioEngineState>) -> Result<(), String> {
    let mut engine = state.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    if let Some(mut camera) = engine.virtual_camera.take() {
        camera.stop();
    }
    Ok(())
}

#[tauri::command]
pub fn switch_scene(state: State<'_, StudioEngineState>, scene: String) -> Result<(), String> {
    let scene_index = match scene.as_str() {
        "desktop" => 0,
        "slate" => 1,
        _ => return Err("Sahne seçimi geçersiz.".into()),
    };
    let mut engine = state.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    refresh_process(&mut engine);
    refresh_virtual_camera(&mut engine);
    let has_main_output = engine.mode != EngineMode::Idle && engine.child.is_some();
    let has_virtual_camera = engine.virtual_camera.is_some();
    if !has_main_output && !has_virtual_camera {
        return Err("Canlı sahne geçişi için etkin bir yayın, kayıt veya sanal kamera gerekli.".into());
    }
    if has_main_output {
        send_graph_command_to(5555, format!("streamselect@scene map {scene_index}"))?;
    }
    if has_virtual_camera {
        send_graph_command_to(5556, format!("streamselect@vcam_scene map {scene_index}"))?;
    }
    engine.active_scene = scene;
    Ok(())
}

#[tauri::command]
pub fn set_audio_volume(state: State<'_, StudioEngineState>, channel: String, level: u32) -> Result<(), String> {
    let target = match channel.as_str() {
        "system" => "system_volume",
        "microphone" => "microphone_volume",
        _ => return Err("Ses kanalı geçersiz.".into()),
    };
    if level > 200 {
        return Err("Ses düzeyi geçersiz.".into());
    }
    let mut engine = state.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    refresh_process(&mut engine);
    if engine.mode == EngineMode::Idle || engine.child.is_none() {
        return Err("Canlı ses ayarı için etkin bir kayıt veya yayın gerekli.".into());
    }
    send_graph_command_to(5555, format!("volume@{target} volume {:.2}", level as f32 / 100.0))
}

fn send_graph_command_to(port: u16, command: String) -> Result<(), String> {
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|_| "Studio canlı denetleyicisi başlatılamadı.".to_string())?;
    runtime.block_on(async {
        tokio::time::timeout(Duration::from_secs(2), async {
            let mut socket = ReqSocket::new();
            socket
                .connect(&format!("tcp://127.0.0.1:{port}"))
                .await
                .map_err(|_| "Studio sahne kanalına bağlanılamadı.".to_string())?;
            socket
                .send(command.into())
                .await
                .map_err(|_| "Studio canlı komutu gönderilemedi.".to_string())?;
            socket.recv().await.map_err(|_| "Studio canlı komutu doğrulanamadı.".to_string())?;
            Ok::<(), String>(())
        })
        .await
        .map_err(|_| "Studio canlı komutu zaman aşımına uğradı.".to_string())?
    })
}

fn capture_args(
    audio_device: &Option<String>,
    system_audio_port: Option<u16>,
    capture_mode: Option<&str>,
    framerate: Option<u32>,
    width: Option<u32>,
    height: Option<u32>,
    bitrate_kbps: Option<u32>,
    draw_cursor: Option<bool>,
    system_audio_volume: Option<u32>,
    microphone_volume: Option<u32>,
    encoder: &str,
    source_kind: Option<&str>,
    source_id: Option<&str>,
    overlay_text: Option<&str>,
    overlay_image_path: Option<&str>,
    multitrack_audio: bool,
    prefer_gpu_capture: bool,
) -> Result<Vec<String>, String> {
    let fps = framerate.unwrap_or(30).clamp(24, 60);
    let width = even_dimension(width.unwrap_or(1920).clamp(640, 3840));
    let height = even_dimension(height.unwrap_or(1080).clamp(360, 2160));
    let bitrate = bitrate_kbps.unwrap_or(6000).clamp(1000, 50_000);
    let cursor = if draw_cursor.unwrap_or(true) { "1" } else { "0" };
    let system_volume = system_audio_volume.unwrap_or(100).clamp(0, 200) as f32 / 100.0;
    let microphone_volume = microphone_volume.unwrap_or(100).clamp(0, 200) as f32 / 100.0;
    let slate_capture = capture_mode == Some("slate");
    let source_kind = source_kind.unwrap_or("desktop");
    if !matches!(source_kind, "desktop" | "window" | "camera") {
        return Err("Görüntü kaynağı geçersiz.".into());
    }
    let source_id = source_id.unwrap_or("").trim();
    let overlay_text = overlay_text.unwrap_or("").trim();
    if overlay_text.chars().count() > 180
        || overlay_text.chars().any(|value| value.is_control() && !matches!(value, '\n' | '\r' | '\t'))
    {
        return Err("Sahne yazısı en fazla 180 karakter olmalıdır.".into());
    }
    let overlay_image = validate_overlay_image(overlay_image_path)?;
    let gpu_capture = prefer_gpu_capture && source_kind == "desktop" && matches!(encoder, "h264_nvenc" | "h264_amf" | "h264_mf");
    let mut args = vec!["-hide_banner".into(), "-loglevel".into(), "warning".into(), "-stats".into(), "-y".into()];
    match source_kind {
        "desktop" if gpu_capture => args.extend([
            "-f".into(), "lavfi".into(), "-i".into(),
            format!("ddagrab=output_idx=0:framerate={fps}:draw_mouse={cursor}"),
        ]),
        "desktop" => args.extend([
            "-f".into(), "gdigrab".into(), "-draw_mouse".into(), cursor.into(),
            "-framerate".into(), fps.to_string(), "-i".into(), "desktop".into(),
        ]),
        "window" => {
            let hwnd = source_id.parse::<u64>().map_err(|_| "Yakalanacak pencere yeniden seçilmelidir.".to_string())?;
            if hwnd == 0 {
                return Err("Yakalanacak pencere yeniden seçilmelidir.".into());
            }
            args.extend([
                "-f".into(), "lavfi".into(), "-i".into(),
                format!("gfxcapture=hwnd={hwnd}:capture_cursor={}:max_framerate={fps}:resize_mode=scale_aspect", cursor == "1"),
            ]);
        }
        "camera" => {
            if source_id.is_empty() || source_id.chars().count() > 240 || source_id.chars().any(char::is_control) {
                return Err("Kamera yeniden seçilmelidir.".into());
            }
            args.extend([
                "-thread_queue_size".into(), "1024".into(), "-f".into(), "dshow".into(),
                "-i".into(), format!("video={source_id}"),
            ]);
        }
        _ => unreachable!(),
    }

    let mut next_input = 1usize;
    let overlay_input = overlay_image.as_ref().map(|path| {
        let index = next_input;
        next_input += 1;
        args.extend([
            "-loop".into(), "1".into(), "-framerate".into(), fps.to_string(),
            "-i".into(), path.to_string_lossy().into_owned(),
        ]);
        index
    });
    let system_audio_input = system_audio_port.map(|port| {
        let index = next_input;
        next_input += 1;
        args.extend([
            "-thread_queue_size".into(), "1024".into(), "-f".into(), "f32le".into(), "-ar".into(), "48000".into(), "-ac".into(), "2".into(),
            "-i".into(), format!("tcp://127.0.0.1:{port}"),
        ]);
        index
    });
    let microphone_input = audio_device.as_ref().filter(|value| !value.trim().is_empty());
    let microphone_audio_input = microphone_input.map(|device| {
        let index = next_input;
        next_input += 1;
        args.extend(["-thread_queue_size".into(), "1024".into(), "-f".into(), "dshow".into(), "-i".into(), format!("audio={}", device)]);
        index
    });
    let silent_audio_input = if system_audio_input.is_none() && microphone_audio_input.is_none() {
        let index = next_input;
        args.extend(["-f".into(), "lavfi".into(), "-i".into(), "anullsrc=channel_layout=stereo:sample_rate=48000".into()]);
        Some(index)
    } else {
        None
    };

    let initial_scene = if slate_capture { 1 } else { 0 };
    let base_video_filter = if gpu_capture {
        format!("[0:v:0]scale_d3d11=width={width}:height={height}:format=nv12,hwdownload,format=nv12,format=yuv420p[base]")
    } else {
        format!("[0:v:0]scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,format=yuv420p[base]")
    };
    let mut filters = vec![base_video_filter];
    let mut current_video = "base".to_string();
    if let Some(index) = overlay_input {
        filters.push(format!("[{index}:v:0]scale={}:-1,format=rgba[image_overlay]", (width / 5).max(160)));
        filters.push(format!("[{current_video}][image_overlay]overlay=W-w-36:H-h-36[with_image]"));
        current_video = "with_image".into();
    }
    if !overlay_text.is_empty() {
        filters.push(format!(
            "[{current_video}]drawtext=text='{}':fontcolor=white:fontsize=h/24:box=1:boxcolor=black@0.65:boxborderw=14:x=36:y=h-th-36[with_text]",
            escape_drawtext(overlay_text)
        ));
        current_video = "with_text".into();
    }
    filters.push(format!("[{current_video}]null[main]"));
    filters.push(format!("color=c=0x050806:size={width}x{height}:rate={fps},format=yuv420p[slate]"));
    filters.push(format!("[main][slate]streamselect@scene=inputs=2:map={initial_scene},zmq[video]"));

    let mut extra_audio_tracks: Vec<(&str, &str)> = Vec::new();
    if let (Some(system_index), Some(microphone_index)) = (system_audio_input, microphone_audio_input) {
        if multitrack_audio {
            filters.push(format!("[{system_index}:a:0]volume@system_volume={system_volume:.2},asplit=2[system_mix][system_track]"));
            filters.push(format!("[{microphone_index}:a:0]volume@microphone_volume={microphone_volume:.2},asplit=2[microphone_mix][microphone_track]"));
            filters.push("[system_mix][microphone_mix]amix=inputs=2:duration=longest:dropout_transition=2:normalize=0[audio]".into());
            extra_audio_tracks.extend([("[system_track]", "Masaüstü sesi"), ("[microphone_track]", "Mikrofon")]);
        } else {
            filters.push(format!("[{system_index}:a:0]volume@system_volume={system_volume:.2}[system]"));
            filters.push(format!("[{microphone_index}:a:0]volume@microphone_volume={microphone_volume:.2}[microphone]"));
            filters.push("[system][microphone]amix=inputs=2:duration=longest:dropout_transition=2:normalize=0[audio]".into());
        }
    } else {
        let audio_index = system_audio_input.or(microphone_audio_input).or(silent_audio_input).expect("audio input");
        let volume = if system_audio_input.is_some() { system_volume } else if microphone_audio_input.is_some() { microphone_volume } else { 1.0 };
        if multitrack_audio && silent_audio_input.is_none() {
            let name = if system_audio_input.is_some() { "system_volume" } else { "microphone_volume" };
            filters.push(format!("[{audio_index}:a:0]volume@{name}={volume:.2},asplit=2[audio][source_track]"));
            extra_audio_tracks.push(("[source_track]", if system_audio_input.is_some() { "Masaüstü sesi" } else { "Mikrofon" }));
        } else {
            let name = if system_audio_input.is_some() { "system_volume" } else if microphone_audio_input.is_some() { "microphone_volume" } else { "silent_volume" };
            filters.push(format!("[{audio_index}:a:0]volume@{name}={volume:.2}[audio]"));
        }
    }
    args.extend([
        "-filter_complex".into(), filters.join(";"),
        "-map".into(), "[video]".into(),
        "-map".into(), "[audio]".into(),
        "-c:v".into(), encoder.into(), "-b:v".into(), format!("{}k", bitrate), "-maxrate".into(), format!("{}k", bitrate),
        "-bufsize".into(), format!("{}k", bitrate * 2), "-g".into(), (fps * 2).to_string(), "-keyint_min".into(), (fps * 2).to_string(),
        "-c:a".into(), "aac".into(), "-b:a".into(), "160k".into(), "-ar".into(), "48000".into(), "-ac".into(), "2".into(),
        "-flags".into(), "+global_header".into(),
        "-map_metadata".into(), "-1".into(), "-map_chapters".into(), "-1".into(),
    ]);
    args.extend(["-metadata:s:a:0".into(), "title=Yayın miksi".into()]);
    for (index, (track, title)) in extra_audio_tracks.iter().enumerate() {
        args.extend(["-map".into(), (*track).into(), format!("-metadata:s:a:{}", index + 1), format!("title={title}")]);
    }
    match encoder {
        "h264_nvenc" => args.extend(["-preset".into(), "p4".into(), "-tune".into(), "ll".into(), "-rc".into(), "cbr".into()]),
        "h264_qsv" => args.extend(["-preset".into(), "veryfast".into(), "-look_ahead".into(), "0".into()]),
        "h264_amf" => args.extend(["-usage".into(), "lowlatency".into(), "-quality".into(), "speed".into(), "-rc".into(), "cbr".into()]),
        "h264_mf" => args.extend(["-rate_control".into(), "cbr".into(), "-scenario".into(), "live_streaming".into()]),
        _ => args.extend(["-preset".into(), "veryfast".into(), "-tune".into(), "zerolatency".into()]),
    }
    Ok(args)
}

fn virtual_camera_args(options: &RecordingOptions) -> Result<Vec<String>, String> {
    let fps = options.framerate.unwrap_or(30).clamp(24, 30);
    let cursor = if options.draw_cursor.unwrap_or(true) { "1" } else { "0" };
    let source_kind = options.source_kind.as_deref().unwrap_or("desktop");
    if !matches!(source_kind, "desktop" | "window" | "camera") {
        return Err("Görüntü kaynağı geçersiz.".into());
    }
    let source_id = options.source_id.as_deref().unwrap_or("").trim();
    let overlay_text = options.overlay_text.as_deref().unwrap_or("").trim();
    if overlay_text.chars().count() > 180
        || overlay_text.chars().any(|value| value.is_control() && !matches!(value, '\n' | '\r' | '\t'))
    {
        return Err("Sahne yazısı en fazla 180 karakter olmalıdır.".into());
    }
    let overlay_image = validate_overlay_image(options.overlay_image_path.as_deref())?;
    let mut args = vec!["-hide_banner".into(), "-loglevel".into(), "warning".into(), "-y".into()];
    match source_kind {
        "desktop" => args.extend([
            "-f".into(), "gdigrab".into(), "-draw_mouse".into(), cursor.into(),
            "-framerate".into(), fps.to_string(), "-i".into(), "desktop".into(),
        ]),
        "window" => {
            let hwnd = source_id.parse::<u64>().map_err(|_| "Yakalanacak pencere yeniden seçilmelidir.".to_string())?;
            if hwnd == 0 {
                return Err("Yakalanacak pencere yeniden seçilmelidir.".into());
            }
            args.extend([
                "-f".into(), "lavfi".into(), "-i".into(),
                format!("gfxcapture=hwnd={hwnd}:capture_cursor={}:max_framerate={fps}:resize_mode=scale_aspect", cursor == "1"),
            ]);
        }
        "camera" => {
            if source_id.is_empty() || source_id.chars().count() > 240 || source_id.chars().any(char::is_control) {
                return Err("Kamera yeniden seçilmelidir.".into());
            }
            args.extend([
                "-thread_queue_size".into(), "1024".into(), "-f".into(), "dshow".into(),
                "-i".into(), format!("video={source_id}"),
            ]);
        }
        _ => unreachable!(),
    }

    let overlay_input = overlay_image.as_ref().map(|path| {
        args.extend([
            "-loop".into(), "1".into(), "-framerate".into(), fps.to_string(),
            "-i".into(), path.to_string_lossy().into_owned(),
        ]);
        1usize
    });
    let mut filters = vec![format!(
        "[0:v:0]scale={VIRTUAL_CAMERA_WIDTH}:{VIRTUAL_CAMERA_HEIGHT}:force_original_aspect_ratio=decrease,pad={VIRTUAL_CAMERA_WIDTH}:{VIRTUAL_CAMERA_HEIGHT}:(ow-iw)/2:(oh-ih)/2,format=yuv420p[base]"
    )];
    let mut current_video = "base".to_string();
    if let Some(index) = overlay_input {
        filters.push(format!("[{index}:v:0]scale={}:-1,format=rgba[image_overlay]", VIRTUAL_CAMERA_WIDTH / 5));
        filters.push(format!("[{current_video}][image_overlay]overlay=W-w-24:H-h-24[with_image]"));
        current_video = "with_image".into();
    }
    if !overlay_text.is_empty() {
        filters.push(format!(
            "[{current_video}]drawtext=text='{}':fontcolor=white:fontsize=h/24:box=1:boxcolor=black@0.65:boxborderw=12:x=24:y=h-th-24[with_text]",
            escape_drawtext(overlay_text)
        ));
        current_video = "with_text".into();
    }
    filters.push(format!("[{current_video}]null[main]"));
    filters.push(format!(
        "color=c=0x050806:size={VIRTUAL_CAMERA_WIDTH}x{VIRTUAL_CAMERA_HEIGHT}:rate={fps},format=yuv420p[slate]"
    ));
    let initial_scene = if options.capture_mode.as_deref() == Some("slate") { 1 } else { 0 };
    filters.push(format!(
        r"[main][slate]streamselect@vcam_scene=inputs=2:map={initial_scene},zmq=bind_address=tcp\\\://127.0.0.1\\\:5556,format=bgra[video]"
    ));
    args.extend([
        "-filter_complex".into(), filters.join(";"),
        "-map".into(), "[video]".into(),
        "-an".into(), "-pix_fmt".into(), "bgra".into(),
        "-f".into(), "rawvideo".into(), "pipe:1".into(),
    ]);
    Ok(args)
}

fn refresh_virtual_camera(engine: &mut StudioEngine) {
    let ended = engine
        .virtual_camera
        .as_mut()
        .and_then(|camera| camera.child.try_wait().ok())
        .flatten()
        .is_some();
    if ended {
        if let Some(mut camera) = engine.virtual_camera.take() {
            camera.stop();
        }
    }
}

fn query_virtual_camera_component(app: &AppHandle) -> Result<(bool, bool), String> {
    let Some(helper) = resolve_virtual_camera_binary(app, "PlayStreamersVirtualCameraManager.exe") else {
        return Ok((cfg!(windows), false));
    };
    let output = hidden_command(&helper)
        .arg("status")
        .output()
        .map_err(|_| "Sanal kamera durumu okunamadı.".to_string())?;
    if !output.status.success() {
        return Err("Windows sanal kamera durumunu doğrulayamadı.".into());
    }
    let value: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|_| "Sanal kamera durum yanıtı geçersiz.".to_string())?;
    Ok((
        value.get("supported").and_then(serde_json::Value::as_bool).unwrap_or(false),
        value.get("installed").and_then(serde_json::Value::as_bool).unwrap_or(false),
    ))
}

fn resolve_virtual_camera_binary(app: &AppHandle, file_name: &str) -> Option<PathBuf> {
    let exe_dir = std::env::current_exe().ok().and_then(|path| path.parent().map(Path::to_path_buf));
    let resource_dir = app.path().resource_dir().ok();
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    [
        exe_dir.as_ref().map(|path| path.join("vcam").join(file_name)),
        exe_dir.as_ref().map(|path| path.join(file_name)),
        resource_dir.as_ref().map(|path| path.join("binaries").join("vcam").join(file_name)),
        resource_dir.as_ref().map(|path| path.join("vcam").join(file_name)),
        Some(manifest.join("binaries").join("vcam").join(file_name)),
    ]
    .into_iter()
    .flatten()
    .find(|path| path.is_file())
}

fn powershell_literal(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

#[cfg(windows)]
fn write_virtual_camera_frames<R: Read>(mut stdout: R, stop: Arc<AtomicBool>) {
    let mapping_name: Vec<u16> = "Local\\PlayStreamersVirtualCameraFrameV1\0".encode_utf16().collect();
    let mapping = unsafe {
        CreateFileMappingW(
            INVALID_HANDLE_VALUE,
            std::ptr::null(),
            PAGE_READWRITE,
            0,
            VIRTUAL_CAMERA_MAPPING_BYTES as u32,
            mapping_name.as_ptr(),
        )
    };
    if mapping.is_null() {
        return;
    }
    let view = unsafe { MapViewOfFile(mapping, FILE_MAP_WRITE, 0, 0, VIRTUAL_CAMERA_MAPPING_BYTES) };
    if view.Value.is_null() {
        unsafe { CloseHandle(mapping); }
        return;
    }
    let base = view.Value.cast::<u8>();
    let mut frame = vec![0u8; VIRTUAL_CAMERA_FRAME_BYTES];
    let mut sequence = 0u64;
    while !stop.load(Ordering::Acquire) {
        if stdout.read_exact(&mut frame).is_err() {
            break;
        }
        sequence = sequence.wrapping_add(2).max(2);
        unsafe {
            std::ptr::write_volatile(base.add(40).cast::<u64>(), sequence | 1);
            std::sync::atomic::fence(Ordering::SeqCst);
            std::ptr::copy_nonoverlapping(b"PSVCAM1\0".as_ptr(), base, 8);
            std::ptr::write_unaligned(base.add(8).cast::<u32>(), 1);
            std::ptr::write_unaligned(base.add(12).cast::<u32>(), VIRTUAL_CAMERA_HEADER_BYTES as u32);
            std::ptr::write_unaligned(base.add(16).cast::<u32>(), VIRTUAL_CAMERA_WIDTH);
            std::ptr::write_unaligned(base.add(20).cast::<u32>(), VIRTUAL_CAMERA_HEIGHT);
            std::ptr::write_unaligned(base.add(24).cast::<u32>(), VIRTUAL_CAMERA_WIDTH * 4);
            std::ptr::write_unaligned(base.add(28).cast::<u32>(), 1);
            std::ptr::write_unaligned(base.add(32).cast::<u32>(), VIRTUAL_CAMERA_FRAME_BYTES as u32);
            std::ptr::write_unaligned(base.add(48).cast::<u64>(), unix_time_milliseconds());
            std::ptr::copy_nonoverlapping(frame.as_ptr(), base.add(VIRTUAL_CAMERA_HEADER_BYTES), frame.len());
            std::sync::atomic::fence(Ordering::SeqCst);
            std::ptr::write_volatile(base.add(40).cast::<u64>(), sequence);
        }
    }
    unsafe {
        std::ptr::write_volatile(base.add(40).cast::<u64>(), sequence | 1);
        std::ptr::write_bytes(base, 0, 8);
        std::sync::atomic::fence(Ordering::SeqCst);
        std::ptr::write_volatile(base.add(40).cast::<u64>(), sequence.wrapping_add(2));
        UnmapViewOfFile(view);
        CloseHandle(mapping);
    }
}

#[cfg(not(windows))]
fn write_virtual_camera_frames<R: Read>(_stdout: R, _stop: Arc<AtomicBool>) {}

fn unix_time_milliseconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .min(u128::from(u64::MAX)) as u64
}

fn validate_overlay_image(value: Option<&str>) -> Result<Option<PathBuf>, String> {
    let Some(value) = value.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };
    let path = PathBuf::from(value);
    let supported = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| matches!(value.to_ascii_lowercase().as_str(), "png" | "jpg" | "jpeg" | "webp"))
        .unwrap_or(false);
    if !path.is_absolute() || !path.is_file() || !supported {
        return Err("Sahne görseli mevcut bir PNG, JPG veya WebP dosyası olmalıdır.".into());
    }
    Ok(Some(path))
}

fn escape_drawtext(value: &str) -> String {
    value
        .replace(['\r', '\n', '\t'], " ")
        .replace('\\', "\\\\")
        .replace(':', "\\:")
        .replace('\'', "\\'")
        .replace('%', "\\%")
}

fn start_process(
    ffmpeg: &Path,
    args: Vec<String>,
    engine: &mut StudioEngine,
    mode: EngineMode,
    encoder: String,
    output_path: Option<PathBuf>,
    audio_loopback: Option<AudioLoopbackHandle>,
    active_scene: &str,
    fallback_args: Option<Vec<String>>,
) -> Result<(), String> {
    if let Ok(mut error) = engine.last_error.lock() {
        *error = None;
    }
    let mut child = spawn_encoder_process(ffmpeg, args, Arc::clone(&engine.last_error))?;
    thread::sleep(Duration::from_millis(350));
    if let Ok(Some(_)) = child.try_wait() {
        let Some(fallback_args) = fallback_args else {
            return Err(engine.last_error.lock().ok().and_then(|value| value.clone()).unwrap_or_else(|| "Studio kodlayıcısı beklenmedik biçimde kapandı.".into()));
        };
        if let Ok(mut error) = engine.last_error.lock() {
            *error = None;
        }
        child = spawn_encoder_process(ffmpeg, fallback_args, Arc::clone(&engine.last_error))?;
        thread::sleep(Duration::from_millis(350));
        if let Ok(Some(_)) = child.try_wait() {
            return Err(engine.last_error.lock().ok().and_then(|value| value.clone()).unwrap_or_else(|| "Studio ekran yakalama yedeği de başlatılamadı.".into()));
        }
    }
    engine.child = Some(child);
    engine.mode = mode;
    engine.encoder = Some(encoder);
    engine.output_path = output_path;
    engine.audio_loopback = audio_loopback;
    engine.started_at = Some(Instant::now());
    engine.active_scene = if active_scene == "slate" { "slate".into() } else { "desktop".into() };
    Ok(())
}

fn spawn_encoder_process(ffmpeg: &Path, args: Vec<String>, last_error: Arc<Mutex<Option<String>>>) -> Result<Child, String> {
    let mut child = hidden_command(ffmpeg)
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|_| "Studio kodlayıcısı başlatılamadı.".to_string())?;
    if let Some(stderr) = child.stderr.take() {
        thread::spawn(move || {
            use std::io::{BufRead, BufReader};
            let reader = BufReader::new(stderr);
            for line in reader.lines().map_while(Result::ok) {
                let clean = redact_stream_key(&line);
                if is_error_line(&clean) {
                    if let Ok(mut slot) = last_error.lock() {
                        *slot = Some(clean.chars().take(500).collect());
                    }
                }
            }
        });
    }
    Ok(child)
}

fn stop_process(engine: &mut StudioEngine) -> Result<(), String> {
    let Some(mut child) = engine.child.take() else {
        if let Some(mut audio) = engine.audio_loopback.take() {
            audio.stop();
        }
        reset_engine(engine);
        return Ok(());
    };
    if let Some(stdin) = child.stdin.as_mut() {
        let _ = stdin.write_all(b"q\n");
        let _ = stdin.flush();
    }
    let deadline = Instant::now() + Duration::from_secs(8);
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) if Instant::now() < deadline => thread::sleep(Duration::from_millis(80)),
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                break;
            }
            Err(_) => {
                let _ = child.kill();
                reset_engine(engine);
                return Err("Studio kodlayıcısı güvenli biçimde kapatılamadı.".into());
            }
        }
    }
    if let Some(mut audio) = engine.audio_loopback.take() {
        audio.stop();
    }
    reset_engine(engine);
    Ok(())
}

fn refresh_process(engine: &mut StudioEngine) {
    let ended = engine.child.as_mut().and_then(|child| child.try_wait().ok()).flatten().is_some();
    if ended {
        engine.child = None;
        if let Some(mut audio) = engine.audio_loopback.take() {
            audio.stop();
        }
        engine.mode = EngineMode::Idle;
        engine.started_at = None;
    }
}

fn reset_engine(engine: &mut StudioEngine) {
    engine.child = None;
    engine.mode = EngineMode::Idle;
    engine.started_at = None;
    engine.active_scene = "desktop".into();
}

fn ensure_idle(engine: &StudioEngine) -> Result<(), String> {
    if engine.mode == EngineMode::Idle && engine.child.is_none() {
        Ok(())
    } else {
        Err("Studio’da zaten etkin bir kayıt veya yayın var.".into())
    }
}

fn recording_path(app: &AppHandle, requested: Option<&str>) -> Result<PathBuf, String> {
    if let Some(value) = requested.filter(|value| !value.trim().is_empty()) {
        let path = PathBuf::from(value);
        if !path.is_absolute() || path.extension().and_then(|ext| ext.to_str()).map(|ext| !ext.eq_ignore_ascii_case("mkv")).unwrap_or(true) {
            return Err("Kayıt yolu mutlak olmalı ve .mkv ile bitmelidir.".into());
        }
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|_| "Kayıt klasörü oluşturulamadı.".to_string())?;
        }
        return Ok(path);
    }
    let directory = recordings_directory(app)?;
    let epoch = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
    Ok(directory.join(format!("play-streamers-{epoch}.mkv")))
}

fn recordings_directory(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app.path().video_dir().or_else(|_| app.path().app_data_dir()).map_err(|_| "Kayıt klasörü bulunamadı.".to_string())?;
    let directory = root.join("Play Streamers");
    fs::create_dir_all(&directory).map_err(|_| "Kayıt klasörü oluşturulamadı.".to_string())?;
    Ok(directory)
}

fn validate_stream_target(service: &str, ingest_url: &str, key_ref: &str) -> Result<(), String> {
    if service.trim().is_empty() || service.len() > 40 {
        return Err("Yayın servisi geçersiz.".into());
    }
    if !ingest_url.starts_with("rtmps://")
        || ingest_url.len() > 400
        || ingest_url.contains('@')
        || ingest_url.chars().any(char::is_whitespace)
        || ingest_url.chars().any(|value| matches!(value, '|' | '[' | ']' | '\'' | '"' | '\\'))
    {
        return Err("Güvenli bir RTMPS sunucu adresi girilmelidir.".into());
    }
    if !key_ref.starts_with("ps.streamKey.") || key_ref.len() > 80 {
        return Err("Yayın anahtarı kasası geçersiz.".into());
    }
    Ok(())
}

fn resolve_ffmpeg(app: &AppHandle) -> Option<PathBuf> {
    let exe_dir = std::env::current_exe().ok().and_then(|path| path.parent().map(Path::to_path_buf));
    let resource_dir = app.path().resource_dir().ok();
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let candidates = [
        exe_dir.as_ref().map(|path| path.join("ffmpeg.exe")),
        exe_dir.as_ref().map(|path| path.join("ffmpeg-x86_64-pc-windows-msvc.exe")),
        resource_dir.as_ref().map(|path| path.join("ffmpeg.exe")),
        Some(manifest.join("binaries/ffmpeg-x86_64-pc-windows-msvc.exe")),
    ];
    candidates.into_iter().flatten().find(|path| path.is_file())
}

fn select_encoder(ffmpeg: &Path) -> String {
    let output = hidden_command(ffmpeg).args(["-hide_banner", "-encoders"]).output().ok();
    let list = output.map(|value| String::from_utf8_lossy(&value.stdout).into_owned()).unwrap_or_default();
    for encoder in ["h264_nvenc", "h264_qsv", "h264_amf", "h264_mf"] {
        if list.contains(encoder) && probe_encoder(ffmpeg, encoder) {
            return encoder.to_string();
        }
    }
    "libx264".into()
}

fn probe_encoder(ffmpeg: &Path, encoder: &str) -> bool {
    hidden_command(ffmpeg)
        .args(["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=size=64x64:rate=1", "-frames:v", "1", "-c:v", encoder, "-f", "null", "-"])
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

#[cfg(windows)]
fn start_system_audio_loopback(last_error: Arc<Mutex<Option<String>>>) -> Result<AudioLoopbackHandle, String> {
    let listener = TcpListener::bind(("127.0.0.1", 0)).map_err(|_| "Masaüstü sesi için yerel kanal açılamadı.".to_string())?;
    let port = listener.local_addr().map_err(|_| "Masaüstü sesi kanalı okunamadı.".to_string())?.port();
    listener.set_nonblocking(true).map_err(|_| "Masaüstü sesi kanalı hazırlanamadı.".to_string())?;
    let stop = Arc::new(AtomicBool::new(false));
    let worker_stop = Arc::clone(&stop);
    let (ready_tx, ready_rx) = std::sync::mpsc::sync_channel(1);
    let worker = thread::Builder::new()
        .name("ps-wasapi-loopback".into())
        .spawn(move || {
            if let Err(error) = run_system_audio_loopback(listener, Arc::clone(&worker_stop), ready_tx) {
                if !worker_stop.load(Ordering::Relaxed) {
                    if let Ok(mut slot) = last_error.lock() {
                        *slot = Some(error);
                    }
                }
            }
        })
        .map_err(|_| "Masaüstü sesi işlemi başlatılamadı.".to_string())?;
    match ready_rx.recv_timeout(Duration::from_secs(3)) {
        Ok(Ok(())) => Ok(AudioLoopbackHandle { port, stop, worker: Some(worker) }),
        Ok(Err(error)) => {
            stop.store(true, Ordering::Relaxed);
            let _ = worker.join();
            Err(error)
        }
        Err(_) => {
            stop.store(true, Ordering::Relaxed);
            let _ = worker.join();
            Err("Masaüstü sesi zamanında hazırlanamadı.".into())
        }
    }
}

#[cfg(not(windows))]
fn start_system_audio_loopback(_last_error: Arc<Mutex<Option<String>>>) -> Result<AudioLoopbackHandle, String> {
    Err("Masaüstü sesi şu anda yalnız Windows'ta destekleniyor.".into())
}

#[cfg(windows)]
fn run_system_audio_loopback(
    listener: TcpListener,
    stop: Arc<AtomicBool>,
    ready: std::sync::mpsc::SyncSender<Result<(), String>>,
) -> Result<(), String> {
    use wasapi::{initialize_mta, DeviceEnumerator, Direction, SampleType, StreamMode, WaveFormat};

    let prepared = (|| {
        initialize_mta().ok().map_err(|_| "Windows ses altyapısı başlatılamadı.".to_string())?;
        let enumerator = DeviceEnumerator::new().map_err(|_| "Windows ses cihazları okunamadı.".to_string())?;
        let device = enumerator
            .get_default_device(&Direction::Render)
            .map_err(|_| "Varsayılan masaüstü ses çıkışı bulunamadı.".to_string())?;
        let mut audio_client = device.get_iaudioclient().map_err(|_| "Masaüstü ses istemcisi açılamadı.".to_string())?;
        let desired_format = WaveFormat::new(32, 32, &SampleType::Float, 48_000, 2, None);
        let block_align = desired_format.get_blockalign() as usize;
        let (_, minimum_period) = audio_client.get_device_period().map_err(|_| "Masaüstü ses gecikmesi okunamadı.".to_string())?;
        let mode = StreamMode::EventsShared { autoconvert: true, buffer_duration_hns: minimum_period };
        audio_client
            .initialize_client(&desired_format, &Direction::Capture, &mode)
            .map_err(|_| "WASAPI masaüstü ses yakalama başlatılamadı.".to_string())?;
        let event = audio_client.set_get_eventhandle().map_err(|_| "WASAPI ses olayı hazırlanamadı.".to_string())?;
        let capture_client = audio_client.get_audiocaptureclient().map_err(|_| "WASAPI yakalama istemcisi alınamadı.".to_string())?;
        let buffer_frames = audio_client.get_buffer_size().unwrap_or(4_800) as usize;
        Ok::<_, String>((audio_client, event, capture_client, block_align, buffer_frames))
    })();
    let (audio_client, event, capture_client, block_align, buffer_frames) = match prepared {
        Ok(value) => value,
        Err(error) => {
            let _ = ready.send(Err(error.clone()));
            return Err(error);
        }
    };
    let _ = ready.send(Ok(()));
    let mut samples = VecDeque::with_capacity(block_align * buffer_frames.saturating_mul(4));

    let mut socket = loop {
        if stop.load(Ordering::Relaxed) {
            return Ok(());
        }
        match listener.accept() {
            Ok((stream, _)) => break stream,
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => thread::sleep(Duration::from_millis(20)),
            Err(_) => return Err("FFmpeg masaüstü sesi kanalına bağlanamadı.".into()),
        }
    };
    let _ = socket.set_nodelay(true);
    let _ = socket.set_write_timeout(Some(Duration::from_millis(500)));
    audio_client.start_stream().map_err(|_| "Masaüstü ses akışı başlatılamadı.".to_string())?;

    let chunk_bytes = block_align * 480;
    while !stop.load(Ordering::Relaxed) {
        capture_client
            .read_from_device_to_deque(&mut samples)
            .map_err(|_| "Masaüstü ses örnekleri okunamadı.".to_string())?;
        while samples.len() >= chunk_bytes {
            let chunk: Vec<u8> = samples.drain(..chunk_bytes).collect();
            if socket.write_all(&chunk).is_err() {
                let _ = audio_client.stop_stream();
                return Ok(());
            }
        }
        let _ = event.wait_for_event(100);
    }
    let _ = audio_client.stop_stream();
    Ok(())
}

fn hidden_command(program: &Path) -> Command {
    let mut command = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command
}

fn even_dimension(value: u32) -> u32 {
    value - value % 2
}

fn escape_tee_value(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/").replace(':', "\\:").replace('|', "\\|")
}

fn redact_stream_key(line: &str) -> String {
    if let Some(index) = line.find("rtmps://") {
        format!("{}rtmps://[gizlendi]", &line[..index])
    } else {
        line.to_string()
    }
}

fn is_error_line(line: &str) -> bool {
    let lower = line.to_ascii_lowercase();
    ["error", "failed", "invalid", "could not", "cannot", "no such", "not found"]
        .iter()
        .any(|needle| lower.contains(needle))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_safe_rtmps_targets() {
        assert!(validate_stream_target("Kick", "rtmps://example.com/app", "ps.streamKey.primary").is_ok());
        assert!(validate_stream_target("Kick", "rtmp://example.com/app", "ps.streamKey.primary").is_err());
        assert!(validate_stream_target("Kick", "rtmps://example.com/app|file", "ps.streamKey.primary").is_err());
        assert!(validate_stream_target("Kick", "rtmps://user@example.com/app", "ps.streamKey.primary").is_err());
    }

    #[test]
    fn redacts_rtmps_log_lines() {
        let line = redact_stream_key("write failed for rtmps://example.com/app/private-key");
        assert_eq!(line, "write failed for rtmps://[gizlendi]");
    }

    #[test]
    fn dimensions_are_even() {
        assert_eq!(even_dimension(1921), 1920);
        assert_eq!(even_dimension(1080), 1080);
    }

    #[test]
    fn system_and_microphone_audio_are_mixed() {
        let args = capture_args(
            &Some("Test microphone".into()),
            Some(32123),
            Some("desktop"),
            Some(30),
            Some(1280),
            Some(720),
            Some(4500),
            Some(true),
            Some(80),
            Some(125),
            "libx264",
            Some("desktop"),
            None,
            None,
            None,
            true,
            true,
        ).unwrap();
        assert!(args.iter().any(|value| value == "tcp://127.0.0.1:32123"));
        assert!(args.iter().any(|value| value.contains("amix=inputs=2")));
        assert!(args.iter().any(|value| value.contains("volume=0.80")));
        assert!(args.iter().any(|value| value.contains("volume=1.25")));
        assert!(args.iter().any(|value| value == "audio=Test microphone"));
        assert!(args.iter().any(|value| value.contains("streamselect@scene=inputs=2:map=0,zmq")));
        assert!(args.iter().any(|value| value == "[video]"));
    }

    #[test]
    fn slate_is_available_as_a_live_scene() {
        let args = capture_args(
            &None,
            None,
            Some("slate"),
            Some(30),
            Some(1280),
            Some(720),
            Some(4500),
            Some(true),
            Some(100),
            Some(100),
            "libx264",
            Some("desktop"),
            None,
            None,
            None,
            false,
            true,
        ).unwrap();
        assert!(args.iter().any(|value| value.contains("streamselect@scene=inputs=2:map=1,zmq")));
    }

    #[test]
    fn window_capture_uses_an_exact_native_handle() {
        let args = capture_args(
            &None, None, Some("desktop"), Some(30), Some(1280), Some(720), Some(4500), Some(true),
            Some(100), Some(100), "libx264", Some("window"), Some("4242"), Some("Canlı"), None, false, true,
        ).unwrap();
        assert!(args.iter().any(|value| value.contains("gfxcapture=hwnd=4242")));
        assert!(args.iter().any(|value| value.contains("drawtext=text='Canlı'")));
    }

    #[test]
    fn multitrack_recording_keeps_the_mix_and_source_tracks() {
        let args = capture_args(
            &Some("Test microphone".into()), Some(32123), Some("desktop"), Some(30), Some(1280), Some(720),
            Some(4500), Some(true), Some(100), Some(100), "libx264", Some("desktop"), None, None, None, true, true,
        ).unwrap();
        assert!(args.iter().any(|value| value.contains("[system_track]")));
        assert!(args.iter().any(|value| value.contains("[microphone_track]")));
        assert!(args.iter().any(|value| value == "title=Yayın miksi"));
    }

    #[test]
    fn virtual_camera_graph_is_video_only_and_uses_its_own_control_port() {
        let options = RecordingOptions {
            path: None,
            framerate: Some(30),
            width: Some(1920),
            height: Some(1080),
            bitrate_kbps: Some(6000),
            audio_device: None,
            capture_system_audio: Some(true),
            system_audio_volume: Some(100),
            microphone_volume: Some(100),
            capture_mode: Some("desktop".into()),
            draw_cursor: Some(true),
            source_kind: Some("desktop".into()),
            source_id: None,
            overlay_text: Some("Play Streamers".into()),
            overlay_image_path: None,
            multitrack_audio: Some(false),
        };
        let args = virtual_camera_args(&options).unwrap();
        assert!(args.iter().any(|value| value.contains("1280:720")));
        assert!(args.iter().any(|value| value.contains("streamselect@vcam_scene")));
        assert!(args.iter().any(|value| value.contains("5556")));
        assert!(args.iter().any(|value| value == "bgra"));
        assert!(args.iter().any(|value| value == "pipe:1"));
        assert!(args.iter().any(|value| value == "-an"));
    }

    #[cfg(windows)]
    #[test]
    #[ignore = "Windows 11'e kurulmuş Play Streamers Camera gerektirir"]
    fn virtual_camera_shared_frame_reaches_media_foundation() {
        use std::sync::mpsc::{channel, Receiver, Sender};
        use windows_sys::Win32::System::Memory::{OpenFileMappingW, FILE_MAP_READ};

        struct BlockingFrameReader {
            frame: Option<Vec<u8>>,
            delivered: Sender<()>,
            release: Receiver<()>,
        }

        impl Read for BlockingFrameReader {
            fn read(&mut self, buffer: &mut [u8]) -> std::io::Result<usize> {
                if let Some(frame) = self.frame.take() {
                    buffer.copy_from_slice(&frame);
                    let _ = self.delivered.send(());
                    return Ok(buffer.len());
                }
                let _ = self.release.recv();
                Ok(0)
            }
        }

        let (delivered_tx, delivered_rx) = channel();
        let (release_tx, release_rx) = channel();
        let reader = BlockingFrameReader {
            frame: Some(vec![0x5Au8; VIRTUAL_CAMERA_FRAME_BYTES]),
            delivered: delivered_tx,
            release: release_rx,
        };
        let stop = Arc::new(AtomicBool::new(false));
        let writer_stop = Arc::clone(&stop);
        let writer = thread::spawn(move || write_virtual_camera_frames(reader, writer_stop));
        delivered_rx.recv_timeout(Duration::from_secs(2)).unwrap();
        thread::sleep(Duration::from_millis(100));

        let mapping_name: Vec<u16> = "Local\\PlayStreamersVirtualCameraFrameV1\0".encode_utf16().collect();
        let mapping = unsafe { OpenFileMappingW(FILE_MAP_READ, 0, mapping_name.as_ptr()) };
        assert!(!mapping.is_null());
        let view = unsafe { MapViewOfFile(mapping, FILE_MAP_READ, 0, 0, VIRTUAL_CAMERA_MAPPING_BYTES) };
        assert!(!view.Value.is_null());
        let bytes = unsafe { std::slice::from_raw_parts(view.Value.cast::<u8>(), VIRTUAL_CAMERA_MAPPING_BYTES) };
        assert_eq!(&bytes[..8], b"PSVCAM1\0");
        assert_eq!(u32::from_ne_bytes(bytes[16..20].try_into().unwrap()), VIRTUAL_CAMERA_WIDTH);
        assert_eq!(bytes[VIRTUAL_CAMERA_HEADER_BYTES], 0x5A);

        let helper = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("binaries")
            .join("vcam")
            .join("PlayStreamersVirtualCameraManager.exe");
        let status = hidden_command(&helper).arg("test").status().unwrap();

        unsafe {
            UnmapViewOfFile(view);
            CloseHandle(mapping);
        }
        stop.store(true, Ordering::Release);
        let _ = release_tx.send(());
        let _ = writer.join();
        assert!(status.success());
    }

    #[cfg(windows)]
    #[test]
    fn live_scene_command_reaches_a_real_ffmpeg_graph() {
        let ffmpeg = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("binaries")
            .join("ffmpeg-x86_64-pc-windows-msvc.exe");
        assert!(ffmpeg.is_file());
        let output = std::env::temp_dir().join(format!("play-streamers-zmq-{}.mkv", std::process::id()));
        let mut child = hidden_command(&ffmpeg)
            .args([
                "-hide_banner", "-loglevel", "error", "-re", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=30",
                "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
                "-filter_complex", "[0:v]format=yuv420p[main];color=c=black:size=320x180:rate=30,format=yuv420p[slate];[main][slate]streamselect@scene=inputs=2:map=0,zmq[video];[1:a]volume@system_volume=1.0[audio]",
                "-map", "[video]", "-map", "[audio]", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-t", "3", "-y",
                &output.to_string_lossy(),
            ])
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("ffmpeg smoke process");
        thread::sleep(Duration::from_millis(700));
        let scene_result = send_graph_command_to(5555, "streamselect@scene map 1".into());
        let volume_result = send_graph_command_to(5555, "volume@system_volume volume 0.5".into());
        if let Some(stdin) = child.stdin.as_mut() {
            let _ = stdin.write_all(b"q\n");
        }
        let _ = child.wait();
        assert!(scene_result.is_ok(), "{scene_result:?}");
        assert!(volume_result.is_ok(), "{volume_result:?}");
        assert!(output.metadata().map(|value| value.len() > 1024).unwrap_or(false));
        let _ = fs::remove_file(output);
    }

    #[cfg(windows)]
    #[test]
    fn failed_primary_capture_uses_the_compatible_fallback() {
        let ffmpeg = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("binaries")
            .join("ffmpeg-x86_64-pc-windows-msvc.exe");
        let output = std::env::temp_dir().join(format!("play-streamers-fallback-{}.mkv", std::process::id()));
        let primary = vec!["-f".into(), "lavfi".into(), "-i".into(), "this_filter_does_not_exist".into(), output.to_string_lossy().into_owned()];
        let fallback = vec![
            "-re".into(), "-f".into(), "lavfi".into(), "-i".into(), "testsrc2=size=160x90:rate=10".into(),
            "-f".into(), "lavfi".into(), "-i".into(), "anullsrc=channel_layout=stereo:sample_rate=48000".into(),
            "-t".into(), "2".into(), "-c:v".into(), "libx264".into(), "-preset".into(), "ultrafast".into(),
            "-c:a".into(), "aac".into(), "-y".into(), output.to_string_lossy().into_owned(),
        ];
        let mut engine = StudioEngine::default();
        start_process(&ffmpeg, primary, &mut engine, EngineMode::Recording, "libx264".into(), Some(output.clone()), None, "desktop", Some(fallback)).unwrap();
        thread::sleep(Duration::from_millis(500));
        stop_process(&mut engine).unwrap();
        assert!(output.metadata().map(|value| value.len() > 1024).unwrap_or(false));
        let _ = fs::remove_file(output);
    }
}
