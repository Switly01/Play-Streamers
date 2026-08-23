use keyring::Entry;
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use std::collections::{HashSet, VecDeque};
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};
use zeromq::{ReqSocket, Socket, SocketRecv, SocketSend};
#[cfg(windows)]
use windows_sys::core::BOOL;
#[cfg(windows)]
use windows_sys::Win32::Foundation::{CloseHandle, FILETIME, HWND, INVALID_HANDLE_VALUE, LPARAM};
#[cfg(windows)]
use windows_sys::Win32::System::Memory::{
    CreateFileMappingW, MapViewOfFile, UnmapViewOfFile, FILE_MAP_WRITE, PAGE_READWRITE,
};
#[cfg(windows)]
use windows_sys::Win32::System::Threading::{GetActiveProcessorCount, GetProcessTimes, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION};
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
const MAX_STUDIO_SCENES: usize = 32;
const MAX_SCENE_LAYERS: usize = 64;

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
    telemetry: Arc<Mutex<EngineTelemetry>>,
    audio_loopback: Option<AudioLoopbackHandle>,
    active_scene: String,
    preview_scene: String,
    scene_ids: Vec<String>,
    source_filter_ids: HashSet<String>,
    virtual_camera: Option<VirtualCameraHandle>,
    preview: Option<PreviewHandle>,
    reconnect: Option<ReconnectPlan>,
    replay_buffer: Option<ReplayBufferState>,
    cpu_sample: Option<CpuSample>,
}

struct CpuSample {
    measured_at: Instant,
    process_time_100ns: u64,
    percent: f32,
}

struct ReplayBufferState {
    directory: PathBuf,
    seconds: u32,
    segment_pattern: PathBuf,
}

impl Drop for ReplayBufferState {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.directory);
    }
}

struct ReconnectPlan {
    ffmpeg: PathBuf,
    primary_args: Vec<String>,
    fallback_args: Option<Vec<String>>,
    attempts: u32,
    max_attempts: u32,
}

struct VirtualCameraHandle {
    child: Child,
    stop: Arc<AtomicBool>,
    worker: Option<thread::JoinHandle<()>>,
    scene_ids: Vec<String>,
    source_filter_ids: HashSet<String>,
}

struct PreviewHandle {
    child: Child,
    stop: Arc<AtomicBool>,
    worker: Option<thread::JoinHandle<()>>,
    frame: Arc<Mutex<Option<Vec<u8>>>>,
    scene_ids: Vec<String>,
    source_filter_ids: HashSet<String>,
}

impl PreviewHandle {
    fn stop(&mut self) {
        self.stop.store(true, Ordering::Release);
        if let Some(stdin) = self.child.stdin.as_mut() {
            let _ = stdin.write_all(b"q\n");
            let _ = stdin.flush();
        }
        let deadline = Instant::now() + Duration::from_secs(2);
        while Instant::now() < deadline {
            if self.child.try_wait().ok().flatten().is_some() { break; }
            thread::sleep(Duration::from_millis(40));
        }
        if self.child.try_wait().ok().flatten().is_none() {
            let _ = self.child.kill();
            let _ = self.child.wait();
        }
        if let Some(worker) = self.worker.take() { let _ = worker.join(); }
    }
}

impl Drop for PreviewHandle {
    fn drop(&mut self) { self.stop(); }
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
    level: Arc<AtomicU32>,
}

#[derive(Default)]
struct EngineTelemetry {
    encoded_frames: u64,
    dropped_frames: u64,
    total_bytes: u64,
    fps: f32,
    bitrate_kbps: f32,
    speed: f32,
    microphone_audio_level: u32,
    pending_audio_peak: Option<f32>,
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
        if let Some(mut preview) = self.preview.take() {
            preview.stop();
        }
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
    encoded_frames: u64,
    total_bytes: u64,
    fps: f32,
    bitrate_kbps: f32,
    speed: f32,
    cpu_percent: f32,
    gpu_percent: Option<f32>,
    system_audio_level: u32,
    microphone_audio_level: u32,
    reconnect_attempts: u32,
    elapsed_seconds: u64,
    output_path: Option<String>,
    last_error: Option<String>,
    active_scene: String,
    preview_scene: String,
    replay_buffer_enabled: bool,
    replay_buffer_seconds: u32,
    replay_buffer_ready: bool,
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
    active_scene_id: Option<String>,
    scenes: Option<Vec<StudioSceneOption>>,
    draw_cursor: Option<bool>,
    source_kind: Option<String>,
    source_id: Option<String>,
    overlay_text: Option<String>,
    overlay_image_path: Option<String>,
    multitrack_audio: Option<bool>,
    noise_suppression: Option<bool>,
    microphone_compressor: Option<bool>,
    microphone_limiter: Option<bool>,
    microphone_noise_gate: Option<bool>,
    replay_buffer_enabled: Option<bool>,
    replay_buffer_seconds: Option<u32>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamingOptions {
    service: String,
    ingest_url: String,
    stream_key_ref: String,
    additional_targets: Option<Vec<StreamTargetOption>>,
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
    active_scene_id: Option<String>,
    scenes: Option<Vec<StudioSceneOption>>,
    draw_cursor: Option<bool>,
    source_kind: Option<String>,
    source_id: Option<String>,
    overlay_text: Option<String>,
    overlay_image_path: Option<String>,
    noise_suppression: Option<bool>,
    microphone_compressor: Option<bool>,
    microphone_limiter: Option<bool>,
    microphone_noise_gate: Option<bool>,
    replay_buffer_enabled: Option<bool>,
    replay_buffer_seconds: Option<u32>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamTargetOption {
    service: String,
    ingest_url: String,
    stream_key_ref: String,
}

#[derive(Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StudioSceneOption {
    id: String,
    name: String,
    kind: String,
    source_kind: String,
    source_id: Option<String>,
    overlay_text: Option<String>,
    overlay_image_path: Option<String>,
    source_scale: Option<u32>,
    source_x: Option<u32>,
    source_y: Option<u32>,
    source_crop_left: Option<u32>,
    source_crop_right: Option<u32>,
    source_crop_top: Option<u32>,
    source_crop_bottom: Option<u32>,
    overlay_text_visible: Option<bool>,
    overlay_text_x: Option<u32>,
    overlay_text_y: Option<u32>,
    overlay_image_visible: Option<bool>,
    overlay_image_scale: Option<u32>,
    overlay_image_x: Option<u32>,
    overlay_image_y: Option<u32>,
    layers: Option<Vec<StudioLayerOption>>,
}

#[derive(Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StudioLayerOption {
    id: String,
    name: String,
    kind: String,
    visible: Option<bool>,
    text: Option<String>,
    path: Option<String>,
    color: Option<String>,
    scale: Option<u32>,
    x: Option<u32>,
    y: Option<u32>,
    width: Option<u32>,
    height: Option<u32>,
    opacity: Option<u32>,
}

struct CapturePlan {
    args: Vec<String>,
    scene_ids: Vec<String>,
    active_scene: String,
    source_filter_ids: HashSet<String>,
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

#[cfg(windows)]
fn filetime_ticks(value: FILETIME) -> u64 {
    ((value.dwHighDateTime as u64) << 32) | value.dwLowDateTime as u64
}

#[cfg(windows)]
fn process_cpu_percent(engine: &mut StudioEngine) -> f32 {
    let Some(child) = engine.child.as_ref() else {
        engine.cpu_sample = None;
        return 0.0;
    };
    let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, child.id()) };
    if handle.is_null() {
        return engine.cpu_sample.as_ref().map(|sample| sample.percent).unwrap_or(0.0);
    }
    let mut creation = FILETIME::default();
    let mut exit = FILETIME::default();
    let mut kernel = FILETIME::default();
    let mut user = FILETIME::default();
    let ok = unsafe { GetProcessTimes(handle, &mut creation, &mut exit, &mut kernel, &mut user) };
    unsafe { CloseHandle(handle); }
    if ok == 0 {
        return engine.cpu_sample.as_ref().map(|sample| sample.percent).unwrap_or(0.0);
    }
    let now = Instant::now();
    let process_time_100ns = filetime_ticks(kernel).saturating_add(filetime_ticks(user));
    let processors = unsafe { GetActiveProcessorCount(u16::MAX) }.max(1) as f64;
    let percent = engine.cpu_sample.as_ref().map(|previous| {
        let elapsed_100ns = now.duration_since(previous.measured_at).as_secs_f64() * 10_000_000.0;
        if elapsed_100ns <= 0.0 { previous.percent } else {
            ((process_time_100ns.saturating_sub(previous.process_time_100ns) as f64 / elapsed_100ns / processors) * 100.0).clamp(0.0, 100.0) as f32
        }
    }).unwrap_or(0.0);
    engine.cpu_sample = Some(CpuSample { measured_at: now, process_time_100ns, percent });
    percent
}

#[cfg(not(windows))]
fn process_cpu_percent(engine: &mut StudioEngine) -> f32 {
    engine.cpu_sample = None;
    0.0
}

#[tauri::command]
pub fn get_engine_status(app: AppHandle, state: State<'_, StudioEngineState>) -> EngineStatus {
    let ffmpeg = resolve_ffmpeg(&app);
    let mut engine = state.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    refresh_process(&mut engine);
    let cpu_percent = process_cpu_percent(&mut engine);
    let telemetry = engine.telemetry.lock().ok();
    let replay_buffer_ready = engine.replay_buffer.as_ref().map(replay_buffer_is_ready).unwrap_or(false);
    EngineStatus {
        state: engine.mode.as_str(),
        backend: if ffmpeg.is_some() { "native" } else { "browser-preview" },
        encoder: engine.encoder.clone(),
        dropped_frames: telemetry.as_ref().map(|value| value.dropped_frames).unwrap_or(0),
        encoded_frames: telemetry.as_ref().map(|value| value.encoded_frames).unwrap_or(0),
        total_bytes: telemetry.as_ref().map(|value| value.total_bytes).unwrap_or(0),
        fps: telemetry.as_ref().map(|value| value.fps).unwrap_or(0.0),
        bitrate_kbps: telemetry.as_ref().map(|value| value.bitrate_kbps).unwrap_or(0.0),
        speed: telemetry.as_ref().map(|value| value.speed).unwrap_or(0.0),
        cpu_percent,
        gpu_percent: None,
        system_audio_level: engine.audio_loopback.as_ref().map(|value| value.level.load(Ordering::Relaxed)).unwrap_or(0),
        microphone_audio_level: telemetry.as_ref().map(|value| value.microphone_audio_level).unwrap_or(0),
        reconnect_attempts: engine.reconnect.as_ref().map(|value| value.attempts).unwrap_or(0),
        elapsed_seconds: engine.started_at.map(|value| value.elapsed().as_secs()).unwrap_or(0),
        output_path: engine.output_path.as_ref().map(|value| value.to_string_lossy().into_owned()),
        last_error: engine.last_error.lock().ok().and_then(|value| value.clone()),
        active_scene: if engine.active_scene.is_empty() { "desktop".into() } else { engine.active_scene.clone() },
        preview_scene: if engine.preview_scene.is_empty() { "desktop".into() } else { engine.preview_scene.clone() },
        replay_buffer_enabled: engine.replay_buffer.is_some(),
        replay_buffer_seconds: engine.replay_buffer.as_ref().map(|value| value.seconds).unwrap_or(0),
        replay_buffer_ready,
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
    engine.replay_buffer.take();

    let output_path = recording_path(&app, options.path.as_deref())?;
    let replay_buffer = prepare_replay_buffer(
        &app,
        options.replay_buffer_enabled.unwrap_or(false),
        options.replay_buffer_seconds.unwrap_or(30),
    )?;
    let encoder = select_encoder(&ffmpeg);
    let audio_loopback = if options.capture_system_audio.unwrap_or(true) {
        Some(start_system_audio_loopback(Arc::clone(&engine.last_error))?)
    } else {
        None
    };
    let plan = capture_plan(
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
        options.noise_suppression.unwrap_or(true),
        options.microphone_compressor.unwrap_or(true),
        options.microphone_limiter.unwrap_or(true),
        options.microphone_noise_gate.unwrap_or(false),
        options.scenes.as_deref(),
        options.active_scene_id.as_deref(),
    )?;
    let fallback_plan = capture_plan(
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
        options.noise_suppression.unwrap_or(true),
        options.microphone_compressor.unwrap_or(true),
        options.microphone_limiter.unwrap_or(true),
        options.microphone_noise_gate.unwrap_or(false),
        options.scenes.as_deref(),
        options.active_scene_id.as_deref(),
    )?;
    let mut args = plan.args;
    let mut fallback_args = fallback_plan.args;
    if let Some(replay) = replay_buffer.as_ref() {
        let output = format!("[f=matroska:onfail=abort]{}|{}", escape_tee_value(&output_path), replay_tee_leg(replay));
        args.extend(["-f".into(), "tee".into(), output.clone()]);
        fallback_args.extend(["-f".into(), "tee".into(), output]);
    } else {
        args.extend(["-f".into(), "matroska".into(), output_path.to_string_lossy().into_owned()]);
        fallback_args.extend(["-f".into(), "matroska".into(), output_path.to_string_lossy().into_owned()]);
    }
    start_process(
        &ffmpeg,
        args,
        &mut engine,
        EngineMode::Recording,
        encoder,
        Some(output_path),
        audio_loopback,
        &plan.active_scene,
        plan.scene_ids,
        plan.source_filter_ids,
        Some(fallback_args),
        replay_buffer,
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
    let additional_targets = options.additional_targets.as_deref().unwrap_or(&[]);
    if additional_targets.len() > 2 {
        return Err("Aynı oturumda en fazla üç yayın çıkışı kullanılabilir.".into());
    }
    let mut resolved_targets = Vec::with_capacity(additional_targets.len() + 1);
    resolved_targets.push(format!("{}/{}", options.ingest_url.trim_end_matches('/'), stream_key));
    for target in additional_targets {
        validate_stream_target(&target.service, &target.ingest_url, &target.stream_key_ref)?;
        let key = Entry::new(CREDENTIAL_SERVICE, &target.stream_key_ref)
            .map_err(|_| "Windows güvenli kasası açılamadı.".to_string())?
            .get_password()
            .map_err(|_| format!("{} yayın anahtarı güvenli kasada bulunamadı.", target.service))?;
        if key.len() < 6 || key.len() > 512 || !key.chars().all(|value| value.is_ascii_alphanumeric() || matches!(value, '-' | '_' | '.')) {
            return Err(format!("{} yayın anahtarı geçersiz.", target.service));
        }
        resolved_targets.push(format!("{}/{}", target.ingest_url.trim_end_matches('/'), key));
    }

    let mut engine = state.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    refresh_process(&mut engine);
    ensure_idle(&engine)?;
    engine.replay_buffer.take();
    let record_locally = options.record_locally.unwrap_or(true);
    let output_path = if record_locally { Some(recording_path(&app, None)?) } else { None };
    let replay_buffer = prepare_replay_buffer(
        &app,
        options.replay_buffer_enabled.unwrap_or(false),
        options.replay_buffer_seconds.unwrap_or(30),
    )?;
    let encoder = select_encoder(&ffmpeg);
    let audio_loopback = if options.capture_system_audio.unwrap_or(true) {
        Some(start_system_audio_loopback(Arc::clone(&engine.last_error))?)
    } else {
        None
    };
    let plan = capture_plan(
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
        options.noise_suppression.unwrap_or(true),
        options.microphone_compressor.unwrap_or(true),
        options.microphone_limiter.unwrap_or(true),
        options.microphone_noise_gate.unwrap_or(false),
        options.scenes.as_deref(),
        options.active_scene_id.as_deref(),
    )?;
    let fallback_plan = capture_plan(
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
        options.noise_suppression.unwrap_or(true),
        options.microphone_compressor.unwrap_or(true),
        options.microphone_limiter.unwrap_or(true),
        options.microphone_noise_gate.unwrap_or(false),
        options.scenes.as_deref(),
        options.active_scene_id.as_deref(),
    )?;
    let mut args = plan.args;
    let mut fallback_args = fallback_plan.args;
    let (format, output) = streaming_output_spec(output_path.as_deref(), replay_buffer.as_ref(), &resolved_targets)?;
    args.extend(["-f".into(), format.clone(), output.clone()]);
    fallback_args.extend(["-f".into(), format, output]);
    let mode = if record_locally { EngineMode::RecordingAndStreaming } else { EngineMode::Streaming };
    start_process(
        &ffmpeg,
        args,
        &mut engine,
        mode,
        encoder,
        output_path,
        audio_loopback,
        &plan.active_scene,
        plan.scene_ids,
        plan.source_filter_ids,
        Some(fallback_args),
        replay_buffer,
    )
}

fn streaming_output_spec(
    output_path: Option<&Path>,
    replay_buffer: Option<&ReplayBufferState>,
    targets: &[String],
) -> Result<(String, String), String> {
    if targets.is_empty() {
        return Err("En az bir yayın çıkışı gereklidir.".into());
    }
    if output_path.is_none() && replay_buffer.is_none() && targets.len() == 1 {
        return Ok(("flv".into(), targets[0].clone()));
    }
    let mut outputs = Vec::new();
    if let Some(path) = output_path {
        outputs.push(format!("[f=matroska:onfail=ignore]{}", escape_tee_value(path)));
    }
    if let Some(replay) = replay_buffer {
        outputs.push(replay_tee_leg(replay));
    }
    outputs.extend(targets.iter().map(|target| format!("[f=flv:onfail=abort]{}", target)));
    Ok(("tee".into(), outputs.join("|")))
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
pub async fn save_replay_buffer(
    app: AppHandle,
    state: State<'_, StudioEngineState>,
) -> Result<String, String> {
    let ffmpeg = resolve_ffmpeg(&app).ok_or_else(|| "Yerel Studio kodlayıcısı bulunamadı.".to_string())?;
    let (directory, seconds) = {
        let mut engine = state.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        refresh_process(&mut engine);
        let replay = engine.replay_buffer.as_ref().ok_or_else(|| "Bu oturumda replay buffer etkin değil.".to_string())?;
        (replay.directory.clone(), replay.seconds)
    };
    let output = replay_output_path(&app)?;
    let task_output = output.clone();
    tauri::async_runtime::spawn_blocking(move || save_replay_segments(&ffmpeg, &directory, seconds, &task_output))
        .await
        .map_err(|_| "Replay buffer kaydetme görevi kapandı.".to_string())??;
    Ok(output.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn start_studio_preview(
    app: AppHandle,
    state: State<'_, StudioEngineState>,
    options: RecordingOptions,
) -> Result<(), String> {
    let ffmpeg = resolve_ffmpeg(&app).ok_or_else(|| "Yerel Studio kodlayıcısı bulunamadı.".to_string())?;
    let plan = preview_plan(&options)?;
    let mut engine = state.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    refresh_preview(&mut engine);
    if let Some(mut preview) = engine.preview.take() { preview.stop(); }
    let mut child = hidden_command(&ffmpeg)
        .args(plan.args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|_| "Studio program önizlemesi başlatılamadı.".to_string())?;
    let stdout = child.stdout.take().ok_or_else(|| "Studio önizleme görüntü kanalı açılamadı.".to_string())?;
    if let Some(stderr) = child.stderr.take() {
        let last_error = Arc::clone(&engine.last_error);
        thread::spawn(move || {
            use std::io::{BufRead, BufReader};
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                if is_error_line(&line) {
                    if let Ok(mut slot) = last_error.lock() { *slot = Some(line.chars().take(500).collect()); }
                }
            }
        });
    }
    let frame = Arc::new(Mutex::new(None));
    let worker_frame = Arc::clone(&frame);
    let stop = Arc::new(AtomicBool::new(false));
    let worker_stop = Arc::clone(&stop);
    let worker = thread::spawn(move || read_preview_frames(stdout, worker_frame, worker_stop));
    thread::sleep(Duration::from_millis(250));
    if child.try_wait().ok().flatten().is_some() {
        stop.store(true, Ordering::Release);
        let _ = worker.join();
        return Err(engine.last_error.lock().ok().and_then(|value| value.clone()).unwrap_or_else(|| "Studio program önizlemesi beklenmedik biçimde kapandı.".into()));
    }
    engine.preview_scene = plan.active_scene;
    engine.preview = Some(PreviewHandle {
        child,
        stop,
        worker: Some(worker),
        frame,
        scene_ids: plan.scene_ids,
        source_filter_ids: plan.source_filter_ids,
    });
    Ok(())
}

#[tauri::command]
pub fn read_studio_preview_frame(state: State<'_, StudioEngineState>) -> Option<String> {
    let mut engine = state.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    refresh_preview(&mut engine);
    let frame = engine.preview.as_ref()?.frame.lock().ok()?.clone()?;
    Some(format!("data:image/jpeg;base64,{}", BASE64_STANDARD.encode(frame)))
}

#[tauri::command]
pub fn stop_studio_preview(state: State<'_, StudioEngineState>) -> Result<(), String> {
    let mut engine = state.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    if let Some(mut preview) = engine.preview.take() { preview.stop(); }
    Ok(())
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

    let plan = virtual_camera_plan(&options)?;
    let mut child = hidden_command(&ffmpeg)
        .args(plan.args)
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
    engine.active_scene = plan.active_scene;
    engine.virtual_camera = Some(VirtualCameraHandle {
        child,
        stop,
        worker: Some(worker),
        scene_ids: plan.scene_ids,
        source_filter_ids: plan.source_filter_ids,
    });
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
pub fn switch_scene(
    state: State<'_, StudioEngineState>,
    scene: String,
    transition: Option<String>,
    duration_ms: Option<u64>,
) -> Result<(), String> {
    validate_scene_id(&scene)?;
    let mut engine = state.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    refresh_process(&mut engine);
    refresh_virtual_camera(&mut engine);
    let has_main_output = engine.mode != EngineMode::Idle && engine.child.is_some();
    let has_virtual_camera = engine.virtual_camera.is_some();
    if !has_main_output && !has_virtual_camera {
        return Err("Program geçişi için etkin bir kayıt, yayın veya sanal kamera gerekli.".into());
    }
    let transition = transition.unwrap_or_else(|| "cut".into());
    if !matches!(transition.as_str(), "cut" | "fade" | "crossfade") {
        return Err("Sahne geçişi geçersiz.".into());
    }
    let switches = program_scene_switches(
        &scene,
        has_main_output.then_some(engine.scene_ids.as_slice()),
        engine.virtual_camera.as_ref().map(|camera| camera.scene_ids.as_slice()),
    )?;
    if transition == "fade" && !switches.is_empty() {
        let ports = switches.iter().map(|(port, _)| *port).collect::<Vec<_>>();
        fade_scene_outputs(&ports, true, duration_ms.unwrap_or(300))?;
        if let Err(error) = send_graph_commands_to(&switches) {
            let _ = fade_scene_outputs(&ports, false, 100);
            return Err(error);
        }
        fade_scene_outputs(&ports, false, duration_ms.unwrap_or(300))?;
    } else if transition == "crossfade" && !switches.is_empty() {
        let ports = switches.iter().map(|(port, _)| *port).collect::<Vec<_>>();
        let next_switches = program_scene_next_switches(
            &scene,
            has_main_output.then_some(engine.scene_ids.as_slice()),
            engine.virtual_camera.as_ref().map(|camera| camera.scene_ids.as_slice()),
        )?;
        send_graph_commands_to(&next_switches)?;
        if let Err(error) = crossfade_scene_outputs(&ports, duration_ms.unwrap_or(300)) {
            let _ = set_scene_overlay_alpha(&ports, "scene_crossfade", 0.0);
            return Err(error);
        }
        if let Err(error) = send_graph_commands_to(&switches) {
            let _ = set_scene_overlay_alpha(&ports, "scene_crossfade", 0.0);
            return Err(error);
        }
        set_scene_overlay_alpha(&ports, "scene_crossfade", 0.0)?;
    } else if !switches.is_empty() {
        send_graph_commands_to(&switches)?;
    }
    engine.active_scene = scene;
    Ok(())
}

#[tauri::command]
pub fn set_preview_scene(
    state: State<'_, StudioEngineState>,
    scene: String,
) -> Result<(), String> {
    validate_scene_id(&scene)?;
    let mut engine = state.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    refresh_preview(&mut engine);
    let preview = engine.preview.as_ref().ok_or_else(|| "Etkin bir Studio önizlemesi bulunamadı.".to_string())?;
    if let Some((port, command)) = scene_switch_command(&scene, &preview.scene_ids, 5557, "preview_scene", "önizleme")? {
        send_graph_command_to(port, command)?;
    }
    engine.preview_scene = scene;
    Ok(())
}

fn validate_scene_id(scene: &str) -> Result<(), String> {
    if scene.is_empty() || scene.len() > 64 || !scene.chars().all(|value| value.is_ascii_alphanumeric() || matches!(value, '-' | '_')) {
        Err("Sahne seçimi geçersiz.".into())
    } else {
        Ok(())
    }
}

fn scene_switch_command(
    scene: &str,
    scene_ids: &[String],
    port: u16,
    filter: &str,
    output_label: &str,
) -> Result<Option<(u16, String)>, String> {
    let scene_index = scene_ids.iter().position(|id| id == scene).ok_or_else(|| format!("Bu sahne etkin {output_label} oturumunda bulunamadı."))?;
    Ok((scene_ids.len() > 1).then(|| (port, format!("streamselect@{filter} map {scene_index}"))))
}

fn program_scene_switches(
    scene: &str,
    main_scene_ids: Option<&[String]>,
    virtual_camera_scene_ids: Option<&[String]>,
) -> Result<Vec<(u16, String)>, String> {
    let mut switches = Vec::new();
    if let Some(scene_ids) = main_scene_ids {
        if let Some(command) = scene_switch_command(scene, scene_ids, 5555, "scene", "Studio")? {
            switches.push(command);
        }
    }
    if let Some(scene_ids) = virtual_camera_scene_ids {
        if let Some(command) = scene_switch_command(scene, scene_ids, 5556, "vcam_scene", "sanal kamera")? {
            switches.push(command);
        }
    }
    Ok(switches)
}

fn program_scene_next_switches(
    scene: &str,
    main_scene_ids: Option<&[String]>,
    virtual_camera_scene_ids: Option<&[String]>,
) -> Result<Vec<(u16, String)>, String> {
    let mut switches = Vec::new();
    if let Some(scene_ids) = main_scene_ids {
        if let Some(command) = scene_switch_command(scene, scene_ids, 5555, "scene_next", "Studio")? {
            switches.push(command);
        }
    }
    if let Some(scene_ids) = virtual_camera_scene_ids {
        if let Some(command) = scene_switch_command(scene, scene_ids, 5556, "vcam_scene_next", "sanal kamera")? {
            switches.push(command);
        }
    }
    Ok(switches)
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

#[tauri::command]
pub fn set_source_opacity(
    state: State<'_, StudioEngineState>,
    scene: String,
    source: String,
    level: u32,
) -> Result<(), String> {
    validate_scene_id(&scene)?;
    validate_scene_id(&source).map_err(|_| "Kaynak seçimi geçersiz.".to_string())?;
    if level > 100 {
        return Err("Kaynak opaklığı geçersiz.".into());
    }
    let filter = live_source_filter_name(&scene, &source);
    let mut engine = state.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    refresh_process(&mut engine);
    refresh_virtual_camera(&mut engine);
    refresh_preview(&mut engine);

    let mut commands = Vec::new();
    if engine.mode != EngineMode::Idle && engine.child.is_some() && engine.source_filter_ids.contains(&filter) {
        commands.push((5555, format!("colorchannelmixer@{filter} aa {:.2}", level as f32 / 100.0)));
    }
    if engine.virtual_camera.as_ref().is_some_and(|handle| handle.source_filter_ids.contains(&filter)) {
        commands.push((5556, format!("colorchannelmixer@{filter} aa {:.2}", level as f32 / 100.0)));
    }
    if engine.preview.as_ref().is_some_and(|handle| handle.source_filter_ids.contains(&filter)) {
        commands.push((5557, format!("colorchannelmixer@{filter} aa {:.2}", level as f32 / 100.0)));
    }
    if commands.is_empty() {
        return Err("Bu kaynak çalışan Studio grafiğinde bulunmuyor. Kaynağı kaydedip önizleme, kayıt veya yayını yeniden başlat.".into());
    }
    send_graph_commands_to(&commands)
}

fn live_source_filter_name(scene: &str, source: &str) -> String {
    format!("source_{}_{}", scene.replace('-', "_"), source.replace('-', "_"))
}

fn fade_scene_outputs(ports: &[u16], fade_out: bool, duration_ms: u64) -> Result<(), String> {
    const STEPS: u64 = 5;
    let step_delay = (duration_ms.clamp(100, 1000) / 2 / STEPS).max(10);
    for step in 1..=STEPS {
        let alpha = if fade_out { step as f32 / STEPS as f32 } else { 1.0 - step as f32 / STEPS as f32 };
        let commands = ports.iter().map(|port| (*port, format!("colorchannelmixer@scene_fade aa {alpha:.2}"))).collect::<Vec<_>>();
        send_graph_commands_to(&commands)?;
        thread::sleep(Duration::from_millis(step_delay));
    }
    Ok(())
}

fn crossfade_scene_outputs(ports: &[u16], duration_ms: u64) -> Result<(), String> {
    const STEPS: u64 = 10;
    let step_delay = (duration_ms.clamp(100, 1000) / STEPS).max(10);
    for step in 1..=STEPS {
        set_scene_overlay_alpha(ports, "scene_crossfade", step as f32 / STEPS as f32)?;
        thread::sleep(Duration::from_millis(step_delay));
    }
    Ok(())
}

fn set_scene_overlay_alpha(ports: &[u16], filter: &str, alpha: f32) -> Result<(), String> {
    let alpha = alpha.clamp(0.0, 1.0);
    let commands = ports.iter().map(|port| (*port, format!("colorchannelmixer@{filter} aa {alpha:.2}"))).collect::<Vec<_>>();
    send_graph_commands_to(&commands)
}

fn send_graph_command_to(port: u16, command: String) -> Result<(), String> {
    send_graph_commands_to(&[(port, command)])
}

fn send_graph_commands_to(commands: &[(u16, String)]) -> Result<(), String> {
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|_| "Studio canlı denetleyicisi başlatılamadı.".to_string())?;
    runtime.block_on(async {
        tokio::time::timeout(Duration::from_secs(4), async {
            for (port, command) in commands {
                let mut socket = ReqSocket::new();
                socket
                    .connect(&format!("tcp://127.0.0.1:{port}"))
                    .await
                    .map_err(|_| "Studio sahne kanalına bağlanılamadı.".to_string())?;
                socket
                    .send(command.clone().into())
                    .await
                    .map_err(|_| "Studio canlı komutu gönderilemedi.".to_string())?;
                socket.recv().await.map_err(|_| "Studio canlı komutu doğrulanamadı.".to_string())?;
            }
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
    let mut args = vec!["-hide_banner".into(), "-loglevel".into(), "warning".into(), "-nostats".into(), "-progress".into(), "pipe:2".into(), "-stats_period".into(), "1".into(), "-y".into()];
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
            "[{current_video}]drawtext=fontfile='C\\:/Windows/Fonts/segoeui.ttf':text='{}':fontcolor=white:fontsize=h/24:box=1:boxcolor=black@0.65:boxborderw=14:x=36:y=h-th-36[with_text]",
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
            filters.push(format!("[{microphone_index}:a:0]volume@microphone_volume={microphone_volume:.2},astats=metadata=1:reset=1:measure_perchannel=none:measure_overall=Peak_level,ametadata=mode=add:key=ps.channel:value=microphone,ametadata=mode=print:file='pipe\\:2':direct=1,asplit=2[microphone_mix][microphone_track]"));
            filters.push("[system_mix][microphone_mix]amix=inputs=2:duration=longest:dropout_transition=2:normalize=0[audio]".into());
            extra_audio_tracks.extend([("[system_track]", "Masaüstü sesi"), ("[microphone_track]", "Mikrofon")]);
        } else {
            filters.push(format!("[{system_index}:a:0]volume@system_volume={system_volume:.2}[system]"));
            filters.push(format!("[{microphone_index}:a:0]volume@microphone_volume={microphone_volume:.2},astats=metadata=1:reset=1:measure_perchannel=none:measure_overall=Peak_level,ametadata=mode=add:key=ps.channel:value=microphone,ametadata=mode=print:file='pipe\\:2':direct=1[microphone]"));
            filters.push("[system][microphone]amix=inputs=2:duration=longest:dropout_transition=2:normalize=0[audio]".into());
        }
    } else {
        let audio_index = system_audio_input.or(microphone_audio_input).or(silent_audio_input).expect("audio input");
        let volume = if system_audio_input.is_some() { system_volume } else if microphone_audio_input.is_some() { microphone_volume } else { 1.0 };
        if multitrack_audio && silent_audio_input.is_none() {
            let name = if system_audio_input.is_some() { "system_volume" } else { "microphone_volume" };
            let meter = if microphone_audio_input.is_some() { ",astats=metadata=1:reset=1:measure_perchannel=none:measure_overall=Peak_level,ametadata=mode=add:key=ps.channel:value=microphone,ametadata=mode=print:file='pipe\\:2':direct=1" } else { "" };
            filters.push(format!("[{audio_index}:a:0]volume@{name}={volume:.2}{meter},asplit=2[audio][source_track]"));
            extra_audio_tracks.push(("[source_track]", if system_audio_input.is_some() { "Masaüstü sesi" } else { "Mikrofon" }));
        } else {
            let name = if system_audio_input.is_some() { "system_volume" } else if microphone_audio_input.is_some() { "microphone_volume" } else { "silent_volume" };
            let meter = if microphone_audio_input.is_some() { ",astats=metadata=1:reset=1:measure_perchannel=none:measure_overall=Peak_level,ametadata=mode=add:key=ps.channel:value=microphone,ametadata=mode=print:file='pipe\\:2':direct=1" } else { "" };
            filters.push(format!("[{audio_index}:a:0]volume@{name}={volume:.2}{meter}[audio]"));
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

fn microphone_filter_chain(volume: f32, noise_suppression: bool, compressor: bool, limiter: bool, noise_gate: bool) -> String {
    let mut filters = vec![format!("volume@microphone_volume={volume:.2}")];
    if noise_suppression {
        filters.extend(["highpass=f=80".into(), "afftdn=nf=-35:tn=1".into()]);
    }
    if noise_gate {
        filters.push("agate=threshold=0.025:ratio=3:range=0.08:attack=15:release=220:detection=rms".into());
    }
    if compressor {
        filters.push("acompressor=threshold=0.10:ratio=3:attack=12:release=180:makeup=1.4".into());
    }
    if limiter {
        filters.push("alimiter=limit=0.95:attack=5:release=50".into());
    }
    filters.push("astats=metadata=1:reset=1:measure_perchannel=none:measure_overall=Peak_level".into());
    filters.push("ametadata=mode=add:key=ps.channel:value=microphone".into());
    filters.push("ametadata=mode=print:file='pipe\\:2':direct=1".into());
    filters.join(",")
}

fn scene_crop_filter(scene: &StudioSceneOption) -> Option<String> {
    let left = scene.source_crop_left.unwrap_or(0).min(45);
    let right = scene.source_crop_right.unwrap_or(0).min(45);
    let top = scene.source_crop_top.unwrap_or(0).min(45);
    let bottom = scene.source_crop_bottom.unwrap_or(0).min(45);
    if left == 0 && right == 0 && top == 0 && bottom == 0 {
        return None;
    }
    Some(format!(
        "crop=w=trunc(iw*{}/100/2)*2:h=trunc(ih*{}/100/2)*2:x=trunc(iw*{left}/100/2)*2:y=trunc(ih*{top}/100/2)*2",
        100 - left - right,
        100 - top - bottom,
    ))
}

fn effective_scene_layers(scene: &StudioSceneOption) -> Result<Vec<StudioLayerOption>, String> {
    let layers = if let Some(layers) = scene.layers.as_ref() {
        layers.clone()
    } else {
        let mut legacy = Vec::new();
        if scene.overlay_image_path.as_deref().map(str::trim).is_some_and(|value| !value.is_empty()) {
            legacy.push(StudioLayerOption {
                id: "legacy-image".into(),
                name: "Görsel".into(),
                kind: "image".into(),
                visible: scene.overlay_image_visible,
                path: scene.overlay_image_path.clone(),
                scale: scene.overlay_image_scale,
                x: scene.overlay_image_x,
                y: scene.overlay_image_y,
                opacity: Some(100),
                ..Default::default()
            });
        }
        if scene.overlay_text.as_deref().map(str::trim).is_some_and(|value| !value.is_empty()) {
            legacy.push(StudioLayerOption {
                id: "legacy-text".into(),
                name: "Yayın yazısı".into(),
                kind: "text".into(),
                visible: scene.overlay_text_visible,
                text: scene.overlay_text.clone(),
                scale: Some(42),
                x: scene.overlay_text_x,
                y: scene.overlay_text_y,
                opacity: Some(100),
                ..Default::default()
            });
        }
        legacy
    };
    if layers.len() > MAX_SCENE_LAYERS {
        return Err(format!("“{}” sahnesinde en fazla {MAX_SCENE_LAYERS} ek kaynak kullanılabilir.", scene.name));
    }
    let mut ids = HashSet::new();
    for layer in &layers {
        if layer.id.is_empty()
            || layer.id.len() > 64
            || !layer.id.chars().all(|value| value.is_ascii_alphanumeric() || matches!(value, '-' | '_'))
            || !ids.insert(layer.id.clone())
        {
            return Err(format!("“{}” sahnesinde geçersiz veya yinelenen kaynak kimliği var.", scene.name));
        }
        if layer.name.trim().is_empty()
            || layer.name.chars().count() > 40
            || layer.name.chars().any(char::is_control)
            || !matches!(layer.kind.as_str(), "text" | "image" | "media" | "color")
        {
            return Err(format!("“{}” sahnesindeki kaynak tanımı geçersiz.", scene.name));
        }
        if let Some(text) = layer.text.as_deref() {
            if text.chars().count() > 300
                || text.chars().any(|value| value.is_control() && !matches!(value, '\n' | '\r' | '\t'))
            {
                return Err(format!("“{}” kaynağındaki yazı en fazla 300 karakter olmalıdır.", layer.name));
            }
        }
        if layer.kind == "color" {
            normalized_layer_color(layer.color.as_deref()).map_err(|_| format!("“{}” kaynağının rengi geçersiz.", layer.name))?;
        }
    }
    Ok(layers)
}

fn normalized_layer_color(value: Option<&str>) -> Result<String, String> {
    let value = value.unwrap_or("#53fc18").trim();
    let hex = value.strip_prefix('#').unwrap_or(value);
    if hex.len() != 6 || !hex.chars().all(|value| value.is_ascii_hexdigit()) {
        return Err("Renk #RRGGBB biçiminde olmalıdır.".into());
    }
    Ok(hex.to_ascii_uppercase())
}

fn validate_media_file(value: Option<&str>) -> Result<Option<PathBuf>, String> {
    let Some(value) = value.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };
    let path = PathBuf::from(value);
    let supported = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| matches!(value.to_ascii_lowercase().as_str(), "mp4" | "mkv" | "mov" | "webm" | "m4v" | "avi"))
        .unwrap_or(false);
    if !path.is_absolute() || !path.is_file() || !supported {
        return Err("Yerel medya kaynağı mevcut bir MP4, MKV, MOV, WebM, M4V veya AVI dosyası olmalıdır.".into());
    }
    Ok(Some(path))
}

fn prepare_scene_layer_inputs(
    scene: &StudioSceneOption,
    args: &mut Vec<String>,
    next_input: &mut usize,
    fps: u32,
) -> Result<Vec<(StudioLayerOption, Option<usize>)>, String> {
    let layers = effective_scene_layers(scene)?;
    let mut prepared = Vec::with_capacity(layers.len());
    for layer in layers {
        let visible = layer.visible.unwrap_or(true);
        let input = match layer.kind.as_str() {
                "image" => match validate_overlay_image(layer.path.as_deref()) {
                    Ok(path) => path,
                    Err(_) if !visible => None,
                    Err(error) => return Err(error),
                }.map(|path| {
                    let index = *next_input;
                    *next_input += 1;
                    args.extend([
                        "-loop".into(), "1".into(), "-framerate".into(), fps.to_string(),
                        "-i".into(), path.to_string_lossy().into_owned(),
                    ]);
                    index
                }),
                "media" => match validate_media_file(layer.path.as_deref()) {
                    Ok(path) => path,
                    Err(_) if !visible => None,
                    Err(error) => return Err(error),
                }.map(|path| {
                    let index = *next_input;
                    *next_input += 1;
                    args.extend([
                        "-thread_queue_size".into(), "1024".into(), "-stream_loop".into(), "-1".into(),
                        "-i".into(), path.to_string_lossy().into_owned(),
                    ]);
                    index
                }),
                _ => None,
        };
        prepared.push((layer, input));
    }
    Ok(prepared)
}

fn apply_scene_layers(
    filters: &mut Vec<String>,
    mut current: String,
    layers: &[(StudioLayerOption, Option<usize>)],
    width: u32,
    height: u32,
    fps: u32,
    prefix: &str,
    scene_id: &str,
    source_filter_ids: &mut HashSet<String>,
) -> Result<String, String> {
    for (index, (layer, input)) in layers.iter().enumerate() {
        let output = format!("{prefix}_layer_{index}");
        let opacity = layer.opacity.unwrap_or(100).min(100) as f32 / 100.0;
        let live_alpha = if layer.visible.unwrap_or(true) { opacity } else { 0.0 };
        let x = layer.x.unwrap_or(50).min(100);
        let y = layer.y.unwrap_or(50).min(100);
        let filter_name = live_source_filter_name(scene_id, &layer.id);
        let raw = format!("{prefix}_layer_raw_{index}");
        let prepared = format!("{prefix}_layer_input_{index}");
        match layer.kind.as_str() {
            "text" => {
                let text = layer.text.as_deref().unwrap_or("").trim();
                if text.is_empty() {
                    continue;
                }
                let size = layer.scale.unwrap_or(42).clamp(12, 96);
                filters.push(format!(
                    "color=c=black@0.0:size={width}x{height}:rate={fps},format=rgba,drawtext=fontfile='C\\:/Windows/Fonts/segoeui.ttf':text='{}':fontcolor=white:fontsize=h*{size}/1000:box=1:boxcolor=black@0.65:boxborderw=14:x=(w-tw)*{x}/100:y=(h-th)*{y}/100[{raw}]",
                    escape_drawtext(text)
                ));
                filters.push(format!("[{raw}]colorchannelmixer@{filter_name}=aa={live_alpha:.2}[{prepared}]"));
            }
            "image" | "media" => {
                let Some(input) = input else { continue; };
                let scale = layer.scale.unwrap_or(if layer.kind == "media" { 50 } else { 30 }).clamp(5, 100);
                let layer_width = ((width as u64 * scale as u64) / 100).max(2);
                filters.push(format!(
                    "[{input}:v:0]scale={layer_width}:-1,format=rgba,colorchannelmixer@{filter_name}=aa={live_alpha:.2}[{prepared}]"
                ));
            }
            "color" => {
                let color = normalized_layer_color(layer.color.as_deref())?;
                let layer_width = layer.width.unwrap_or(30).clamp(2, 100);
                let layer_height = layer.height.unwrap_or(20).clamp(2, 100);
                filters.push(format!(
                    "color=c=black@0.0:size={width}x{height}:rate={fps},format=rgba,drawbox=x=(iw-iw*{layer_width}/100)*{x}/100:y=(ih-ih*{layer_height}/100)*{y}/100:w=iw*{layer_width}/100:h=ih*{layer_height}/100:color=0x{color}@1.0:t=fill[{raw}]"
                ));
                filters.push(format!("[{raw}]colorchannelmixer@{filter_name}=aa={live_alpha:.2}[{prepared}]"));
            }
            _ => return Err(format!("“{}” kaynağının türü desteklenmiyor.", layer.name)),
        }
        source_filter_ids.insert(filter_name);
        filters.push(format!(
            "[{current}][{prepared}]overlay=x=(W-w)*{x}/100:y=(H-h)*{y}/100:eof_action=repeat:shortest=0[{output}]"
        ));
        current = output;
    }
    Ok(current)
}

fn capture_plan(
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
    noise_suppression: bool,
    microphone_compressor: bool,
    microphone_limiter: bool,
    microphone_noise_gate: bool,
    provided_scenes: Option<&[StudioSceneOption]>,
    active_scene_id: Option<&str>,
) -> Result<CapturePlan, String> {
    if provided_scenes.map(|value| value.is_empty()).unwrap_or(true) {
        let args = capture_args(
            audio_device, system_audio_port, capture_mode, framerate, width, height, bitrate_kbps,
            draw_cursor, system_audio_volume, microphone_volume, encoder, source_kind, source_id,
            overlay_text, overlay_image_path, multitrack_audio, prefer_gpu_capture,
        )?;
        let active_scene = if capture_mode == Some("slate") { "slate" } else { "desktop" }.to_string();
        return Ok(CapturePlan {
            args,
            scene_ids: vec!["desktop".into(), "slate".into()],
            active_scene,
            source_filter_ids: HashSet::new(),
        });
    }

    let scenes = provided_scenes.unwrap();
    if scenes.len() > MAX_STUDIO_SCENES {
        return Err(format!("Bir Studio projesinde en fazla {MAX_STUDIO_SCENES} sahne kullanılabilir."));
    }
    let mut ids = HashSet::new();
    for scene in scenes {
        if scene.id.is_empty() || scene.id.len() > 64 || !scene.id.chars().all(|value| value.is_ascii_alphanumeric() || matches!(value, '-' | '_')) || !ids.insert(scene.id.clone()) {
            return Err("Sahne kimliği geçersiz veya yineleniyor.".into());
        }
        if scene.name.trim().is_empty() || scene.name.chars().count() > 48 || scene.name.chars().any(char::is_control) {
            return Err("Sahne adı 1–48 okunabilir karakter olmalıdır.".into());
        }
        if !matches!(scene.kind.as_str(), "capture" | "slate") {
            return Err("Sahne türü geçersiz.".into());
        }
    }

    let fps = framerate.unwrap_or(30).clamp(24, 60);
    let width = even_dimension(width.unwrap_or(1920).clamp(640, 3840));
    let height = even_dimension(height.unwrap_or(1080).clamp(360, 2160));
    let bitrate = bitrate_kbps.unwrap_or(6000).clamp(1000, 50_000);
    let cursor = if draw_cursor.unwrap_or(true) { "1" } else { "0" };
    let system_volume = system_audio_volume.unwrap_or(100).clamp(0, 200) as f32 / 100.0;
    let microphone_volume = microphone_volume.unwrap_or(100).clamp(0, 200) as f32 / 100.0;
    let microphone_chain = microphone_filter_chain(microphone_volume, noise_suppression, microphone_compressor, microphone_limiter, microphone_noise_gate);
    let requested_active = active_scene_id.filter(|id| scenes.iter().any(|scene| scene.id == *id)).unwrap_or(&scenes[0].id);
    let initial_scene = scenes.iter().position(|scene| scene.id == requested_active).unwrap_or(0);
    let mut args = vec!["-hide_banner".into(), "-loglevel".into(), "warning".into(), "-nostats".into(), "-progress".into(), "pipe:2".into(), "-stats_period".into(), "1".into(), "-y".into()];
    let mut next_input = 0usize;
    let mut scene_inputs: Vec<(StudioSceneOption, Option<usize>, Vec<(StudioLayerOption, Option<usize>)>, bool)> = Vec::with_capacity(scenes.len());

    for scene in scenes {
        if scene.kind == "slate" {
            scene_inputs.push((scene.clone(), None, Vec::new(), false));
            continue;
        }
        let source_kind = scene.source_kind.as_str();
        if !matches!(source_kind, "desktop" | "window" | "camera") {
            return Err(format!("“{}” sahnesinin görüntü kaynağı geçersiz.", scene.name));
        }
        let source_id = scene.source_id.as_deref().unwrap_or("").trim();
        let gpu_capture = prefer_gpu_capture && source_kind == "desktop" && matches!(encoder, "h264_nvenc" | "h264_amf" | "h264_mf");
        let video_index = next_input;
        next_input += 1;
        match source_kind {
            "desktop" if gpu_capture => args.extend(["-f".into(), "lavfi".into(), "-i".into(), format!("ddagrab=output_idx=0:framerate={fps}:draw_mouse={cursor}")]),
            "desktop" => args.extend(["-f".into(), "gdigrab".into(), "-draw_mouse".into(), cursor.into(), "-framerate".into(), fps.to_string(), "-i".into(), "desktop".into()]),
            "window" => {
                let hwnd = source_id.parse::<u64>().map_err(|_| format!("“{}” sahnesi için yakalanacak pencereyi yeniden seç.", scene.name))?;
                if hwnd == 0 { return Err(format!("“{}” sahnesi için yakalanacak pencereyi yeniden seç.", scene.name)); }
                args.extend(["-f".into(), "lavfi".into(), "-i".into(), format!("gfxcapture=hwnd={hwnd}:capture_cursor={}:max_framerate={fps}:resize_mode=scale_aspect", cursor == "1")]);
            }
            "camera" => {
                if source_id.is_empty() || source_id.chars().count() > 240 || source_id.chars().any(char::is_control) {
                    return Err(format!("“{}” sahnesi için kamerayı yeniden seç.", scene.name));
                }
                args.extend(["-thread_queue_size".into(), "1024".into(), "-f".into(), "dshow".into(), "-i".into(), format!("video={source_id}")]);
            }
            _ => unreachable!(),
        }
        let layer_inputs = prepare_scene_layer_inputs(scene, &mut args, &mut next_input, fps)?;
        scene_inputs.push((scene.clone(), Some(video_index), layer_inputs, gpu_capture));
    }

    let system_audio_input = system_audio_port.map(|port| {
        let index = next_input;
        next_input += 1;
        args.extend(["-thread_queue_size".into(), "1024".into(), "-f".into(), "f32le".into(), "-ar".into(), "48000".into(), "-ac".into(), "2".into(), "-i".into(), format!("tcp://127.0.0.1:{port}")]);
        index
    });
    let microphone_audio_input = audio_device.as_ref().filter(|value| !value.trim().is_empty()).map(|device| {
        let index = next_input;
        next_input += 1;
        args.extend(["-thread_queue_size".into(), "1024".into(), "-f".into(), "dshow".into(), "-i".into(), format!("audio={device}")]);
        index
    });
    let silent_audio_input = if system_audio_input.is_none() && microphone_audio_input.is_none() {
        let index = next_input;
        args.extend(["-f".into(), "lavfi".into(), "-i".into(), "anullsrc=channel_layout=stereo:sample_rate=48000".into()]);
        Some(index)
    } else { None };

    let mut filters = Vec::new();
    let mut source_filter_ids = HashSet::new();
    for (index, (scene, video_input, layer_inputs, gpu_capture)) in scene_inputs.iter().enumerate() {
        let scene_label = format!("scene_{index}");
        if scene.kind == "slate" {
            filters.push(format!("color=c=0x050806:size={width}x{height}:rate={fps},format=yuv420p[{scene_label}]"));
            continue;
        }
        let source_scale = scene.source_scale.unwrap_or(100).clamp(10, 100);
        let source_x = scene.source_x.unwrap_or(50).min(100);
        let source_y = scene.source_y.unwrap_or(50).min(100);
        let source_width = even_dimension(((width as u64 * source_scale as u64) / 100).max(2) as u32);
        let source_height = even_dimension(((height as u64 * source_scale as u64) / 100).max(2) as u32);
        let source_label = format!("source_{index}");
        let canvas_label = format!("canvas_{index}");
        let base_label = format!("base_{index}");
        let crop = scene_crop_filter(scene);
        if *gpu_capture && crop.is_none() {
            filters.push(format!("[{}:v:0]scale_d3d11=width={source_width}:height={source_height}:format=nv12,hwdownload,format=nv12,format=yuv420p[{source_label}]", video_input.unwrap()));
        } else if *gpu_capture {
            filters.push(format!("[{}:v:0]hwdownload,format=nv12,{},scale={source_width}:{source_height}:force_original_aspect_ratio=decrease,format=yuv420p[{source_label}]", video_input.unwrap(), crop.unwrap()));
        } else {
            let crop = crop.map(|value| format!("{value},")).unwrap_or_default();
            filters.push(format!("[{}:v:0]{crop}scale={source_width}:{source_height}:force_original_aspect_ratio=decrease,format=yuv420p[{source_label}]", video_input.unwrap()));
        }
        filters.push(format!("color=c=black:size={width}x{height}:rate={fps},format=yuv420p[{canvas_label}]"));
        filters.push(format!("[{canvas_label}][{source_label}]overlay=x=(W-w)*{source_x}/100:y=(H-h)*{source_y}/100:eof_action=repeat[{base_label}]"));
        let current = apply_scene_layers(
            &mut filters,
            base_label,
            layer_inputs,
            width,
            height,
            fps,
            &format!("scene_{index}"),
            &scene.id,
            &mut source_filter_ids,
        )?;
        filters.push(format!("[{current}]null[{scene_label}]"));
    }
    let selector_inputs = (0..scenes.len()).map(|index| format!("[scene_{index}_program]")).collect::<String>();
    let transition_inputs = (0..scenes.len()).map(|index| format!("[scene_{index}_transition]")).collect::<String>();
    if scenes.len() == 1 {
        filters.push("[scene_0]split=2[scene_0_program][scene_0_transition]".into());
        filters.push(format!("{selector_inputs}null[selected_scene]"));
        filters.push(format!("{transition_inputs}null[transition_scene]"));
    } else {
        for index in 0..scenes.len() {
            filters.push(format!("[scene_{index}]split=2[scene_{index}_program][scene_{index}_transition]"));
        }
        filters.push(format!("{selector_inputs}streamselect@scene=inputs={}:map={initial_scene}[selected_scene]", scenes.len()));
        filters.push(format!("{transition_inputs}streamselect@scene_next=inputs={}:map={initial_scene}[transition_scene]", scenes.len()));
    }
    filters.push("[transition_scene]format=rgba,colorchannelmixer@scene_crossfade=aa=0[scene_crossfade_overlay]".into());
    filters.push("[selected_scene][scene_crossfade_overlay]overlay=0:0:eof_action=repeat:format=auto[crossfaded_scene]".into());
    filters.push(format!("color=c=black@1:size={width}x{height}:rate={fps},format=rgba,colorchannelmixer@scene_fade=aa=0[scene_fade_overlay]"));
    filters.push("[crossfaded_scene][scene_fade_overlay]overlay=0:0:eof_action=repeat:format=auto,format=yuv420p,zmq[video]".into());

    let mut extra_audio_tracks: Vec<(&str, &str)> = Vec::new();
    if let (Some(system_index), Some(microphone_index)) = (system_audio_input, microphone_audio_input) {
        if multitrack_audio {
            filters.push(format!("[{system_index}:a:0]volume@system_volume={system_volume:.2},asplit=2[system_mix][system_track]"));
            filters.push(format!("[{microphone_index}:a:0]{microphone_chain},asplit=2[microphone_mix][microphone_track]"));
            filters.push("[system_mix][microphone_mix]amix=inputs=2:duration=longest:dropout_transition=2:normalize=0[audio]".into());
            extra_audio_tracks.extend([("[system_track]", "Masaüstü sesi"), ("[microphone_track]", "Mikrofon")]);
        } else {
            filters.push(format!("[{system_index}:a:0]volume@system_volume={system_volume:.2}[system]"));
            filters.push(format!("[{microphone_index}:a:0]{microphone_chain}[microphone]"));
            filters.push("[system][microphone]amix=inputs=2:duration=longest:dropout_transition=2:normalize=0[audio]".into());
        }
    } else {
        let audio_index = system_audio_input.or(microphone_audio_input).or(silent_audio_input).expect("audio input");
        let volume = if system_audio_input.is_some() { system_volume } else if microphone_audio_input.is_some() { microphone_volume } else { 1.0 };
        if multitrack_audio && silent_audio_input.is_none() {
            let name = if system_audio_input.is_some() { "system_volume" } else { "microphone_volume" };
            let chain = if microphone_audio_input.is_some() { microphone_chain.clone() } else { format!("volume@{name}={volume:.2}") };
            filters.push(format!("[{audio_index}:a:0]{chain},asplit=2[audio][source_track]"));
            extra_audio_tracks.push(("[source_track]", if system_audio_input.is_some() { "Masaüstü sesi" } else { "Mikrofon" }));
        } else {
            let name = if system_audio_input.is_some() { "system_volume" } else if microphone_audio_input.is_some() { "microphone_volume" } else { "silent_volume" };
            let chain = if microphone_audio_input.is_some() { microphone_chain.clone() } else { format!("volume@{name}={volume:.2}") };
            filters.push(format!("[{audio_index}:a:0]{chain}[audio]"));
        }
    }
    args.extend(["-filter_complex".into(), filters.join(";"), "-map".into(), "[video]".into(), "-map".into(), "[audio]".into(), "-c:v".into(), encoder.into(), "-b:v".into(), format!("{}k", bitrate), "-maxrate".into(), format!("{}k", bitrate), "-bufsize".into(), format!("{}k", bitrate * 2), "-g".into(), (fps * 2).to_string(), "-keyint_min".into(), (fps * 2).to_string(), "-c:a".into(), "aac".into(), "-b:a".into(), "160k".into(), "-ar".into(), "48000".into(), "-ac".into(), "2".into(), "-flags".into(), "+global_header".into(), "-map_metadata".into(), "-1".into(), "-map_chapters".into(), "-1".into()]);
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
    Ok(CapturePlan {
        args,
        scene_ids: scenes.iter().map(|scene| scene.id.clone()).collect(),
        active_scene: requested_active.to_string(),
        source_filter_ids,
    })
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
            "[{current_video}]drawtext=fontfile='C\\:/Windows/Fonts/segoeui.ttf':text='{}':fontcolor=white:fontsize=h/24:box=1:boxcolor=black@0.65:boxborderw=12:x=24:y=h-th-24[with_text]",
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

fn virtual_camera_plan(options: &RecordingOptions) -> Result<CapturePlan, String> {
    let Some(scenes) = options.scenes.as_deref().filter(|value| !value.is_empty()) else {
        let args = virtual_camera_args(options)?;
        let active_scene = if options.capture_mode.as_deref() == Some("slate") { "slate" } else { "desktop" }.to_string();
        return Ok(CapturePlan {
            args,
            scene_ids: vec!["desktop".into(), "slate".into()],
            active_scene,
            source_filter_ids: HashSet::new(),
        });
    };
    if scenes.len() > MAX_STUDIO_SCENES {
        return Err(format!("Bir Studio projesinde en fazla {MAX_STUDIO_SCENES} sahne kullanılabilir."));
    }
    let mut ids = HashSet::new();
    for scene in scenes {
        if scene.id.is_empty() || scene.id.len() > 64 || !scene.id.chars().all(|value| value.is_ascii_alphanumeric() || matches!(value, '-' | '_')) || !ids.insert(scene.id.clone()) {
            return Err("Sahne kimliği geçersiz veya yineleniyor.".into());
        }
        if scene.name.trim().is_empty() || scene.name.chars().count() > 48 || !matches!(scene.kind.as_str(), "capture" | "slate") {
            return Err("Sanal kamera sahne tanımı geçersiz.".into());
        }
    }

    let fps = options.framerate.unwrap_or(30).clamp(24, 30);
    let cursor = if options.draw_cursor.unwrap_or(true) { "1" } else { "0" };
    let requested_active = options.active_scene_id.as_deref().filter(|id| scenes.iter().any(|scene| scene.id == *id)).unwrap_or(&scenes[0].id);
    let initial_scene = scenes.iter().position(|scene| scene.id == requested_active).unwrap_or(0);
    let mut args = vec!["-hide_banner".into(), "-loglevel".into(), "warning".into(), "-y".into()];
    let mut next_input = 0usize;
    let mut scene_inputs: Vec<(StudioSceneOption, Option<usize>, Vec<(StudioLayerOption, Option<usize>)>)> = Vec::with_capacity(scenes.len());
    for scene in scenes {
        if scene.kind == "slate" {
            scene_inputs.push((scene.clone(), None, Vec::new()));
            continue;
        }
        let source_id = scene.source_id.as_deref().unwrap_or("").trim();
        let video_index = next_input;
        next_input += 1;
        match scene.source_kind.as_str() {
            "desktop" => args.extend(["-f".into(), "gdigrab".into(), "-draw_mouse".into(), cursor.into(), "-framerate".into(), fps.to_string(), "-i".into(), "desktop".into()]),
            "window" => {
                let hwnd = source_id.parse::<u64>().map_err(|_| format!("“{}” sahnesi için pencereyi yeniden seç.", scene.name))?;
                if hwnd == 0 { return Err(format!("“{}” sahnesi için pencereyi yeniden seç.", scene.name)); }
                args.extend(["-f".into(), "lavfi".into(), "-i".into(), format!("gfxcapture=hwnd={hwnd}:capture_cursor={}:max_framerate={fps}:resize_mode=scale_aspect", cursor == "1")]);
            }
            "camera" => {
                if source_id.is_empty() || source_id.chars().count() > 240 || source_id.chars().any(char::is_control) {
                    return Err(format!("“{}” sahnesi için kamerayı yeniden seç.", scene.name));
                }
                args.extend(["-thread_queue_size".into(), "1024".into(), "-f".into(), "dshow".into(), "-i".into(), format!("video={source_id}")]);
            }
            _ => return Err(format!("“{}” sahnesinin görüntü kaynağı geçersiz.", scene.name)),
        }
        let layer_inputs = prepare_scene_layer_inputs(scene, &mut args, &mut next_input, fps)?;
        scene_inputs.push((scene.clone(), Some(video_index), layer_inputs));
    }

    let mut filters = Vec::new();
    let mut source_filter_ids = HashSet::new();
    for (index, (scene, video_input, layer_inputs)) in scene_inputs.iter().enumerate() {
        let scene_label = format!("vcam_{index}");
        if scene.kind == "slate" {
            filters.push(format!("color=c=0x050806:size={VIRTUAL_CAMERA_WIDTH}x{VIRTUAL_CAMERA_HEIGHT}:rate={fps},format=bgra[{scene_label}]"));
            continue;
        }
        let source_scale = scene.source_scale.unwrap_or(100).clamp(10, 100);
        let source_x = scene.source_x.unwrap_or(50).min(100);
        let source_y = scene.source_y.unwrap_or(50).min(100);
        let source_width = even_dimension(((VIRTUAL_CAMERA_WIDTH as u64 * source_scale as u64) / 100).max(2) as u32);
        let source_height = even_dimension(((VIRTUAL_CAMERA_HEIGHT as u64 * source_scale as u64) / 100).max(2) as u32);
        let source_label = format!("vcam_source_{index}");
        let canvas_label = format!("vcam_canvas_{index}");
        let base_label = format!("vcam_base_{index}");
        let crop = scene_crop_filter(scene).map(|value| format!("{value},")).unwrap_or_default();
        filters.push(format!("[{}:v:0]{crop}scale={source_width}:{source_height}:force_original_aspect_ratio=decrease,format=bgra[{source_label}]", video_input.unwrap()));
        filters.push(format!("color=c=black:size={VIRTUAL_CAMERA_WIDTH}x{VIRTUAL_CAMERA_HEIGHT}:rate={fps},format=bgra[{canvas_label}]"));
        filters.push(format!("[{canvas_label}][{source_label}]overlay=x=(W-w)*{source_x}/100:y=(H-h)*{source_y}/100:eof_action=repeat:format=rgb[{base_label}]"));
        let current = apply_scene_layers(
            &mut filters,
            base_label,
            layer_inputs,
            VIRTUAL_CAMERA_WIDTH,
            VIRTUAL_CAMERA_HEIGHT,
            fps,
            &format!("vcam_{index}"),
            &scene.id,
            &mut source_filter_ids,
        )?;
        filters.push(format!("[{current}]format=bgra[{scene_label}]"));
    }
    let selector_inputs = (0..scenes.len()).map(|index| format!("[vcam_{index}_program]")).collect::<String>();
    let transition_inputs = (0..scenes.len()).map(|index| format!("[vcam_{index}_transition]")).collect::<String>();
    if scenes.len() == 1 {
        filters.push(r"[vcam_0]split=2[vcam_0_program][vcam_0_transition]".into());
        filters.push(format!(r"{selector_inputs}null[vcam_selected_scene]"));
        filters.push(format!(r"{transition_inputs}null[vcam_transition_scene]"));
    } else {
        for index in 0..scenes.len() {
            filters.push(format!(r"[vcam_{index}]split=2[vcam_{index}_program][vcam_{index}_transition]"));
        }
        filters.push(format!(r"{selector_inputs}streamselect@vcam_scene=inputs={}:map={initial_scene}[vcam_selected_scene]", scenes.len()));
        filters.push(format!(r"{transition_inputs}streamselect@vcam_scene_next=inputs={}:map={initial_scene}[vcam_transition_scene]", scenes.len()));
    }
    filters.push(r"[vcam_transition_scene]format=rgba,colorchannelmixer@scene_crossfade=aa=0[vcam_scene_crossfade_overlay]".into());
    filters.push(r"[vcam_selected_scene][vcam_scene_crossfade_overlay]overlay=0:0:eof_action=repeat:format=auto[vcam_crossfaded_scene]".into());
    filters.push(format!("color=c=black@1:size={VIRTUAL_CAMERA_WIDTH}x{VIRTUAL_CAMERA_HEIGHT}:rate={fps},format=rgba,colorchannelmixer@scene_fade=aa=0[vcam_scene_fade_overlay]"));
    filters.push(r"[vcam_crossfaded_scene][vcam_scene_fade_overlay]overlay=0:0:eof_action=repeat:format=auto,zmq=bind_address=tcp\\\://127.0.0.1\\\:5556,format=bgra[video]".into());
    args.extend(["-filter_complex".into(), filters.join(";"), "-map".into(), "[video]".into(), "-an".into(), "-pix_fmt".into(), "bgra".into(), "-f".into(), "rawvideo".into(), "pipe:1".into()]);
    Ok(CapturePlan {
        args,
        scene_ids: scenes.iter().map(|scene| scene.id.clone()).collect(),
        active_scene: requested_active.to_string(),
        source_filter_ids,
    })
}

fn preview_plan(options: &RecordingOptions) -> Result<CapturePlan, String> {
    let mut plan = virtual_camera_plan(options)?;
    for argument in &mut plan.args {
        if argument.contains("5556") { *argument = argument.replace("5556", "5557"); }
        if argument.contains("vcam_scene") { *argument = argument.replace("vcam_scene", "preview_scene"); }
    }
    let pixel_format_index = plan.args.iter().position(|value| value == "-pix_fmt")
        .ok_or_else(|| "Studio önizleme çıkışı hazırlanamadı.".to_string())?;
    plan.args.truncate(pixel_format_index);
    plan.args.extend(["-c:v".into(), "mjpeg".into(), "-q:v".into(), "6".into(), "-f".into(), "image2pipe".into(), "pipe:1".into()]);
    Ok(plan)
}

fn read_preview_frames<R: Read>(mut stdout: R, frame: Arc<Mutex<Option<Vec<u8>>>>, stop: Arc<AtomicBool>) {
    let mut chunk = [0u8; 16 * 1024];
    let mut buffer = Vec::with_capacity(256 * 1024);
    while !stop.load(Ordering::Acquire) {
        let Ok(read) = stdout.read(&mut chunk) else { break; };
        if read == 0 { break; }
        buffer.extend_from_slice(&chunk[..read]);
        loop {
            let Some(start) = buffer.windows(2).position(|value| value == [0xFF, 0xD8]) else {
                if buffer.len() > 2 { buffer.drain(..buffer.len() - 2); }
                break;
            };
            let Some(relative_end) = buffer[start + 2..].windows(2).position(|value| value == [0xFF, 0xD9]) else {
                if start > 0 { buffer.drain(..start); }
                break;
            };
            let end = start + 2 + relative_end + 2;
            let jpeg = buffer[start..end].to_vec();
            buffer.drain(..end);
            if jpeg.len() <= 2_000_000 {
                if let Ok(mut slot) = frame.lock() { *slot = Some(jpeg); }
            }
        }
        if buffer.len() > 4_000_000 { buffer.clear(); }
    }
}

fn refresh_preview(engine: &mut StudioEngine) {
    let ended = engine.preview.as_mut().and_then(|preview| preview.child.try_wait().ok()).flatten().is_some();
    if ended {
        if let Some(mut preview) = engine.preview.take() { preview.stop(); }
    }
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
    if !virtual_camera_supported_on_this_os() {
        return Ok((false, false));
    }
    let Some(helper) = resolve_virtual_camera_binary(app, "PlayStreamersVirtualCameraManager.exe") else {
        return Ok((true, false));
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

fn virtual_camera_supported_build(build: u32) -> bool {
    build >= 22_000
}

#[cfg(windows)]
fn virtual_camera_supported_on_this_os() -> bool {
    virtual_camera_supported_build(windows_version::OsVersion::current().build)
}

#[cfg(not(windows))]
fn virtual_camera_supported_on_this_os() -> bool {
    false
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
    scene_ids: Vec<String>,
    source_filter_ids: HashSet<String>,
    fallback_args: Option<Vec<String>>,
    replay_buffer: Option<ReplayBufferState>,
) -> Result<(), String> {
    if let Ok(mut error) = engine.last_error.lock() {
        *error = None;
    }
    if let Ok(mut telemetry) = engine.telemetry.lock() { *telemetry = EngineTelemetry::default(); }
    let reconnect = if matches!(mode, EngineMode::Streaming | EngineMode::RecordingAndStreaming) {
        Some(ReconnectPlan {
            ffmpeg: ffmpeg.to_path_buf(),
            primary_args: args.clone(),
            fallback_args: fallback_args.clone(),
            attempts: 0,
            max_attempts: 5,
        })
    } else { None };
    let mut child = spawn_encoder_process(ffmpeg, args, Arc::clone(&engine.last_error), Arc::clone(&engine.telemetry))?;
    thread::sleep(Duration::from_millis(350));
    if let Ok(Some(_)) = child.try_wait() {
        let Some(fallback_args) = fallback_args else {
            return Err(engine.last_error.lock().ok().and_then(|value| value.clone()).unwrap_or_else(|| "Studio kodlayıcısı beklenmedik biçimde kapandı.".into()));
        };
        if let Ok(mut error) = engine.last_error.lock() {
            *error = None;
        }
        child = spawn_encoder_process(ffmpeg, fallback_args, Arc::clone(&engine.last_error), Arc::clone(&engine.telemetry))?;
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
    engine.active_scene = active_scene.to_string();
    engine.scene_ids = scene_ids;
    engine.source_filter_ids = source_filter_ids;
    engine.reconnect = reconnect;
    engine.replay_buffer = replay_buffer;
    Ok(())
}

fn spawn_encoder_process(
    ffmpeg: &Path,
    args: Vec<String>,
    last_error: Arc<Mutex<Option<String>>>,
    telemetry: Arc<Mutex<EngineTelemetry>>,
) -> Result<Child, String> {
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
                update_telemetry(&telemetry, &clean);
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

fn update_telemetry(telemetry: &Arc<Mutex<EngineTelemetry>>, line: &str) {
    let Some((key, raw_value)) = line.trim().split_once('=') else { return; };
    let Ok(mut value) = telemetry.lock() else { return; };
    match key {
        "frame" => value.encoded_frames = raw_value.trim().parse().unwrap_or(value.encoded_frames),
        "fps" => value.fps = raw_value.trim().parse().unwrap_or(value.fps),
        "drop_frames" => value.dropped_frames = raw_value.trim().parse().unwrap_or(value.dropped_frames),
        "total_size" => value.total_bytes = raw_value.trim().parse().unwrap_or(value.total_bytes),
        "bitrate" => {
            let clean = raw_value.trim().trim_end_matches("kbits/s").trim();
            value.bitrate_kbps = clean.parse().unwrap_or(value.bitrate_kbps);
        }
        "speed" => value.speed = raw_value.trim().trim_end_matches('x').parse().unwrap_or(value.speed),
        "lavfi.astats.Overall.Peak_level" => value.pending_audio_peak = raw_value.trim().parse().ok(),
        "ps.channel" if raw_value.trim() == "microphone" => {
            value.microphone_audio_level = value.pending_audio_peak.take()
                .map(|db| (((db + 60.0) / 60.0) * 100.0).clamp(0.0, 100.0) as u32)
                .unwrap_or(0);
        }
        _ => {}
    }
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
    let ended = engine.child.as_mut().and_then(|child| child.try_wait().ok()).flatten().is_some()
        || (engine.child.is_none() && matches!(engine.mode, EngineMode::Streaming | EngineMode::RecordingAndStreaming) && engine.reconnect.is_some());
    if !ended { return; }
    engine.child = None;
    let reconnect_data = engine.reconnect.as_mut().and_then(|plan| {
        if plan.attempts >= plan.max_attempts { return None; }
        plan.attempts += 1;
        Some((
            plan.ffmpeg.clone(),
            reconnect_output_args(&plan.primary_args, plan.attempts),
            plan.fallback_args.as_ref().map(|args| reconnect_output_args(args, plan.attempts)),
            plan.attempts,
        ))
    });
    if let Some((ffmpeg, args, fallback_args, attempt)) = reconnect_data {
        if let Ok(mut error) = engine.last_error.lock() {
            *error = Some(format!("Yayın bağlantısı kesildi; yeniden bağlanma denemesi {attempt}/5 yapılıyor."));
        }
        let spawn = spawn_encoder_process(&ffmpeg, args, Arc::clone(&engine.last_error), Arc::clone(&engine.telemetry));
        if let Ok(mut child) = spawn {
            thread::sleep(Duration::from_millis(400));
            if child.try_wait().ok().flatten().is_none() {
                engine.child = Some(child);
                engine.cpu_sample = None;
                if let Ok(mut error) = engine.last_error.lock() {
                    *error = Some(format!("Yayın bağlantısı {attempt}. denemede yeniden kuruldu."));
                }
                return;
            }
        }
        if let Some(fallback_args) = fallback_args {
            if let Ok(mut child) = spawn_encoder_process(&ffmpeg, fallback_args, Arc::clone(&engine.last_error), Arc::clone(&engine.telemetry)) {
                thread::sleep(Duration::from_millis(400));
                if child.try_wait().ok().flatten().is_none() {
                    engine.child = Some(child);
                    engine.cpu_sample = None;
                    return;
                }
            }
        }
        return;
    }
    if let Some(mut audio) = engine.audio_loopback.take() {
        audio.stop();
    }
    if engine.reconnect.is_some() {
        if let Ok(mut error) = engine.last_error.lock() { *error = Some("Yayın bağlantısı 5 denemeden sonra yeniden kurulamadı.".into()); }
    }
    engine.reconnect = None;
    engine.mode = EngineMode::Idle;
    engine.started_at = None;
    engine.source_filter_ids.clear();
    engine.cpu_sample = None;
}

fn reconnect_output_args(args: &[String], attempt: u32) -> Vec<String> {
    args.iter().map(|argument| {
        if argument.contains("[f=matroska") && argument.contains(".mkv|") {
            argument.replacen(".mkv|", &format!(".part-{}.mkv|", attempt + 1), 1)
        } else {
            argument.clone()
        }
    }).collect()
}

fn reset_engine(engine: &mut StudioEngine) {
    engine.child = None;
    engine.mode = EngineMode::Idle;
    engine.started_at = None;
    engine.active_scene = "desktop".into();
    engine.scene_ids.clear();
    engine.source_filter_ids.clear();
    engine.reconnect = None;
    engine.cpu_sample = None;
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

fn prepare_replay_buffer(app: &AppHandle, enabled: bool, requested_seconds: u32) -> Result<Option<ReplayBufferState>, String> {
    if !enabled {
        return Ok(None);
    }
    let seconds = match requested_seconds {
        15 | 30 | 60 | 120 => requested_seconds,
        _ => return Err("Replay buffer süresi 15, 30, 60 veya 120 saniye olmalıdır.".into()),
    };
    let directory = recordings_directory(app)?.join(format!(".replay-buffer-{}", unix_time_milliseconds()));
    fs::create_dir_all(&directory).map_err(|_| "Replay buffer klasörü oluşturulamadı.".to_string())?;
    Ok(Some(ReplayBufferState {
        segment_pattern: directory.join("segment-%03d.mkv"),
        directory,
        seconds,
    }))
}

fn replay_tee_leg(replay: &ReplayBufferState) -> String {
    let wrap = replay.seconds.div_ceil(2) + 2;
    format!(
        "[f=segment:segment_format=matroska:segment_time=2:segment_wrap={wrap}:reset_timestamps=1:onfail=ignore]{}",
        escape_tee_value(&replay.segment_pattern)
    )
}

fn replay_segment_files(replay: &ReplayBufferState) -> Vec<PathBuf> {
    replay_segment_files_in(&replay.directory)
}

fn replay_segment_files_in(directory: &Path) -> Vec<PathBuf> {
    let mut files = fs::read_dir(directory)
        .ok()
        .into_iter()
        .flatten()
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_file() && path.extension().and_then(|value| value.to_str()).map(|value| value.eq_ignore_ascii_case("mkv")).unwrap_or(false))
        .collect::<Vec<_>>();
    files.sort_by_key(|path| fs::metadata(path).and_then(|value| value.modified()).unwrap_or(UNIX_EPOCH));
    files
}

fn replay_buffer_is_ready(replay: &ReplayBufferState) -> bool {
    replay_segment_files(replay).len() > 1
}

fn replay_output_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(recordings_directory(app)?.join(format!("play-streamers-replay-{}.mkv", unix_time_milliseconds())))
}

fn concat_list_path(value: &Path) -> String {
    value.to_string_lossy().replace('\\', "/").replace('\'', "'\\''")
}

fn save_replay_segments(ffmpeg: &Path, directory: &Path, seconds: u32, output: &Path) -> Result<(), String> {
    let mut files = replay_segment_files_in(directory);
    if files.len() < 2 {
        return Err("Replay buffer henüz kaydedilecek kadar dolmadı; birkaç saniye bekle.".into());
    }
    files.pop();
    let segment_count = seconds.div_ceil(2) as usize;
    if files.len() > segment_count {
        files.drain(..files.len() - segment_count);
    }
    let staging = directory.join(format!("save-{}", unix_time_milliseconds()));
    fs::create_dir_all(&staging).map_err(|_| "Replay buffer geçici kayıt alanı oluşturulamadı.".to_string())?;
    let result = (|| {
        let mut copies = Vec::with_capacity(files.len());
        for (index, source) in files.iter().enumerate() {
            let target = staging.join(format!("segment-{index:03}.mkv"));
            fs::copy(source, &target).map_err(|_| "Replay buffer parçası sabitlenemedi.".to_string())?;
            copies.push(target);
        }
        let list = staging.join("concat.txt");
        let content = copies.iter().map(|path| format!("file '{}'", concat_list_path(path))).collect::<Vec<_>>().join("\n");
        fs::write(&list, content).map_err(|_| "Replay buffer birleştirme listesi yazılamadı.".to_string())?;
        let process = hidden_command(ffmpeg)
            .args([
                "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", &list.to_string_lossy(),
                "-map", "0", "-c", "copy", "-y", &output.to_string_lossy(),
            ])
            .output()
            .map_err(|_| "Replay buffer birleştirme işlemi başlatılamadı.".to_string())?;
        if process.status.success() && output.is_file() {
            Ok(())
        } else {
            let detail = String::from_utf8_lossy(&process.stderr);
            Err(format!("Replay buffer kaydedilemedi: {}", detail.chars().take(240).collect::<String>()))
        }
    })();
    let _ = fs::remove_dir_all(&staging);
    if result.is_err() {
        let _ = fs::remove_file(output);
    }
    result
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
    let level = Arc::new(AtomicU32::new(0));
    let worker_stop = Arc::clone(&stop);
    let worker_level = Arc::clone(&level);
    let (ready_tx, ready_rx) = std::sync::mpsc::sync_channel(1);
    let worker = thread::Builder::new()
        .name("ps-wasapi-loopback".into())
        .spawn(move || {
            if let Err(error) = run_system_audio_loopback(listener, Arc::clone(&worker_stop), worker_level, ready_tx) {
                if !worker_stop.load(Ordering::Relaxed) {
                    if let Ok(mut slot) = last_error.lock() {
                        *slot = Some(error);
                    }
                }
            }
        })
        .map_err(|_| "Masaüstü sesi işlemi başlatılamadı.".to_string())?;
    match ready_rx.recv_timeout(Duration::from_secs(3)) {
        Ok(Ok(())) => Ok(AudioLoopbackHandle { port, stop, worker: Some(worker), level }),
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
    level: Arc<AtomicU32>,
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

    let chunk_bytes = block_align * 480;
    while !stop.load(Ordering::Relaxed) {
        let mut socket = loop {
            if stop.load(Ordering::Relaxed) { return Ok(()); }
            match listener.accept() {
                Ok((stream, _)) => break stream,
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => thread::sleep(Duration::from_millis(20)),
                Err(_) => return Err("FFmpeg masaüstü sesi kanalına bağlanamadı.".into()),
            }
        };
        let _ = socket.set_nodelay(true);
        let _ = socket.set_write_timeout(Some(Duration::from_millis(500)));
        samples.clear();
        audio_client.start_stream().map_err(|_| "Masaüstü ses akışı başlatılamadı.".to_string())?;
        let mut connected = true;
        while connected && !stop.load(Ordering::Relaxed) {
            capture_client
                .read_from_device_to_deque(&mut samples)
                .map_err(|_| "Masaüstü ses örnekleri okunamadı.".to_string())?;
            while samples.len() >= chunk_bytes {
                let chunk: Vec<u8> = samples.drain(..chunk_bytes).collect();
                let peak = chunk
                    .chunks_exact(4)
                    .map(|bytes| f32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]).abs())
                    .fold(0.0_f32, f32::max);
                level.store((peak.sqrt() * 100.0).clamp(0.0, 100.0) as u32, Ordering::Relaxed);
                if socket.write_all(&chunk).is_err() {
                    connected = false;
                    break;
                }
            }
            let _ = event.wait_for_event(100);
        }
        let _ = audio_client.stop_stream();
        level.store(0, Ordering::Relaxed);
    }
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
    fn program_and_preview_scene_commands_are_isolated() {
        let scenes = vec!["main".to_string(), "break".to_string()];
        let program = program_scene_switches("break", Some(&scenes), Some(&scenes)).unwrap();
        assert_eq!(program, vec![
            (5555, "streamselect@scene map 1".to_string()),
            (5556, "streamselect@vcam_scene map 1".to_string()),
        ]);
        assert!(!program.iter().any(|(port, _)| *port == 5557));

        let next = program_scene_next_switches("break", Some(&scenes), Some(&scenes)).unwrap();
        assert_eq!(next, vec![
            (5555, "streamselect@scene_next map 1".to_string()),
            (5556, "streamselect@vcam_scene_next map 1".to_string()),
        ]);

        let preview = scene_switch_command("break", &scenes, 5557, "preview_scene", "önizleme").unwrap();
        assert_eq!(preview, Some((5557, "streamselect@preview_scene map 1".to_string())));
    }

    #[test]
    fn accepts_only_safe_rtmps_targets() {
        assert!(validate_stream_target("Kick", "rtmps://example.com/app", "ps.streamKey.primary").is_ok());
        assert!(validate_stream_target("Kick", "rtmp://example.com/app", "ps.streamKey.primary").is_err());
        assert!(validate_stream_target("Kick", "rtmps://example.com/app|file", "ps.streamKey.primary").is_err());
        assert!(validate_stream_target("Kick", "rtmps://user@example.com/app", "ps.streamKey.primary").is_err());
    }

    #[test]
    fn multiple_rtmps_targets_share_one_tee_encoded_output() {
        let targets = vec![
            "rtmps://primary.example/app/key-one".to_string(),
            "rtmps://secondary.example/app/key-two".to_string(),
        ];
        let (format, output) = streaming_output_spec(None, None, &targets).unwrap();
        assert_eq!(format, "tee");
        assert!(output.contains("[f=flv:onfail=abort]rtmps://primary.example/app/key-one"));
        assert!(output.contains("[f=flv:onfail=abort]rtmps://secondary.example/app/key-two"));
        assert_eq!(output.matches("[f=flv:onfail=abort]").count(), 2);
    }

    #[test]
    fn redacts_rtmps_log_lines() {
        let line = redact_stream_key("write failed for rtmps://example.com/app/private-key");
        assert_eq!(line, "write failed for rtmps://[gizlendi]");
    }

    #[test]
    fn parses_real_encoder_progress_and_audio_levels() {
        let telemetry = Arc::new(Mutex::new(EngineTelemetry::default()));
        for line in ["frame=90", "fps=29.97", "drop_frames=2", "total_size=123456", "bitrate=4512.4kbits/s", "speed=0.99x", "lavfi.astats.Overall.Peak_level=-18.0", "ps.channel=microphone"] {
            update_telemetry(&telemetry, line);
        }
        let value = telemetry.lock().unwrap();
        assert_eq!(value.encoded_frames, 90);
        assert_eq!(value.dropped_frames, 2);
        assert_eq!(value.total_bytes, 123456);
        assert!((value.fps - 29.97).abs() < 0.01);
        assert!((value.bitrate_kbps - 4512.4).abs() < 0.1);
        assert_eq!(value.microphone_audio_level, 70);
    }

    #[test]
    fn reconnect_uses_a_new_local_recording_part() {
        let args = vec![r"[f=matroska:onfail=ignore]C\:/Recordings/live.mkv|[f=flv:onfail=abort]rtmps://example/live/key".into()];
        let next = reconnect_output_args(&args, 2);
        assert!(next[0].contains("live.part-3.mkv|"));
        assert!(!next[0].contains("live.mkv|"));
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
        assert!(args.iter().any(|value| value.contains(":text='Canlı'")));
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
    fn project_scene_ids_map_to_the_native_recording_and_camera_graphs() {
        let scenes = vec![
            StudioSceneOption { id: "intro".into(), name: "Giriş".into(), kind: "slate".into(), source_kind: "desktop".into(), ..Default::default() },
            StudioSceneOption { id: "break".into(), name: "Mola".into(), kind: "slate".into(), source_kind: "desktop".into(), ..Default::default() },
            StudioSceneOption { id: "outro".into(), name: "Kapanış".into(), kind: "slate".into(), source_kind: "desktop".into(), ..Default::default() },
        ];
        let plan = capture_plan(
            &None, None, None, Some(30), Some(1280), Some(720), Some(4500), Some(true),
            Some(100), Some(100), "libx264", None, None, None, None, false, false,
            true, true, true, false,
            Some(&scenes), Some("break"),
        ).unwrap();
        assert_eq!(plan.scene_ids, vec!["intro", "break", "outro"]);
        assert_eq!(plan.active_scene, "break");
        assert!(plan.args.iter().any(|value| value.contains("streamselect@scene=inputs=3:map=1")));

        let options = RecordingOptions {
            path: None, framerate: Some(30), width: Some(1280), height: Some(720), bitrate_kbps: Some(4500),
            audio_device: None, capture_system_audio: Some(false), system_audio_volume: Some(100), microphone_volume: Some(100),
            capture_mode: None, active_scene_id: Some("outro".into()), scenes: Some(scenes), draw_cursor: Some(true),
            source_kind: None, source_id: None, overlay_text: None, overlay_image_path: None, multitrack_audio: Some(false),
            noise_suppression: Some(true), microphone_compressor: Some(true), microphone_limiter: Some(true), microphone_noise_gate: Some(false),
            replay_buffer_enabled: Some(false), replay_buffer_seconds: Some(30),
        };
        let camera = virtual_camera_plan(&options).unwrap();
        assert_eq!(camera.active_scene, "outro");
        assert!(camera.args.iter().any(|value| value.contains("streamselect@vcam_scene=inputs=3:map=2")));
    }

    #[test]
    fn source_transforms_fade_and_noise_gate_reach_the_native_graph() {
        let scenes = vec![StudioSceneOption {
            id: "main".into(),
            name: "Ana sahne".into(),
            kind: "capture".into(),
            source_kind: "desktop".into(),
            overlay_text: Some("Konumlu yazı".into()),
            source_scale: Some(50),
            source_x: Some(25),
            source_y: Some(75),
            source_crop_left: Some(10),
            source_crop_right: Some(5),
            source_crop_top: Some(8),
            source_crop_bottom: Some(2),
            overlay_text_visible: Some(true),
            overlay_text_x: Some(75),
            overlay_text_y: Some(25),
            overlay_image_visible: Some(false),
            ..Default::default()
        }];
        let plan = capture_plan(
            &Some("Test microphone".into()), None, None, Some(30), Some(1280), Some(720), Some(4500), Some(true),
            Some(100), Some(100), "libx264", None, None, None, None, false, false,
            true, true, true, true,
            Some(&scenes), Some("main"),
        ).unwrap();
        let graph = plan.args.windows(2).find(|pair| pair[0] == "-filter_complex").map(|pair| pair[1].as_str()).unwrap();
        assert!(graph.contains("scale=640:360"));
        assert!(graph.contains("crop=w=trunc(iw*85/100/2)*2:h=trunc(ih*90/100/2)*2:x=trunc(iw*10/100/2)*2:y=trunc(ih*8/100/2)*2"));
        assert!(graph.contains("overlay=x=(W-w)*25/100:y=(H-h)*75/100"));
        assert!(graph.contains("x=(w-tw)*75/100:y=(h-th)*25/100"));
        assert!(graph.contains("colorchannelmixer@scene_fade=aa=0"));
        assert!(graph.contains("agate=threshold=0.025"));
    }

    #[test]
    fn ordered_source_stack_reaches_recording_and_virtual_camera_graphs() {
        let layers = vec![
            StudioLayerOption {
                id: "background-accent".into(), name: "Vurgu".into(), kind: "color".into(), visible: Some(true),
                color: Some("#53fc18".into()), width: Some(40), height: Some(18), x: Some(25), y: Some(80), opacity: Some(70),
                ..Default::default()
            },
            StudioLayerOption {
                id: "headline".into(), name: "Başlık".into(), kind: "text".into(), visible: Some(true),
                text: Some("Serbest kaynak".into()), scale: Some(54), x: Some(75), y: Some(20), opacity: Some(90),
                ..Default::default()
            },
            StudioLayerOption {
                id: "waiting-label".into(), name: "Bekleme yazısı".into(), kind: "text".into(), visible: Some(false),
                text: Some("Birazdan".into()), scale: Some(42), x: Some(50), y: Some(50), opacity: Some(80),
                ..Default::default()
            },
            StudioLayerOption {
                id: "empty-media".into(), name: "Hazırlanıyor".into(), kind: "media".into(), visible: Some(true),
                path: Some(String::new()), scale: Some(50), ..Default::default()
            },
        ];
        let scenes = vec![StudioSceneOption {
            id: "main".into(), name: "Ana sahne".into(), kind: "capture".into(), source_kind: "desktop".into(),
            layers: Some(layers), ..Default::default()
        }];
        let plan = capture_plan(
            &None, None, None, Some(30), Some(1280), Some(720), Some(4500), Some(true),
            Some(100), Some(100), "libx264", None, None, None, None, false, false,
            true, true, true, false, Some(&scenes), Some("main"),
        ).unwrap();
        let graph = plan.args.windows(2).find(|pair| pair[0] == "-filter_complex").map(|pair| pair[1].as_str()).unwrap();
        let color_position = graph.find("drawbox=x=(iw-iw*40/100)*25/100").unwrap();
        let text_position = graph.find(":text='Serbest kaynak'").unwrap();
        assert!(color_position < text_position);
        assert!(graph.contains("fontcolor=white:fontsize=h*54/1000"));
        assert!(graph.contains("colorchannelmixer@source_main_background_accent=aa=0.70"));
        assert!(graph.contains("colorchannelmixer@source_main_headline=aa=0.90"));
        assert!(graph.contains("colorchannelmixer@source_main_waiting_label=aa=0.00"));
        assert!(plan.source_filter_ids.contains("source_main_background_accent"));
        assert!(plan.source_filter_ids.contains("source_main_headline"));
        assert!(plan.source_filter_ids.contains("source_main_waiting_label"));

        let options = RecordingOptions {
            path: None, framerate: Some(30), width: Some(1280), height: Some(720), bitrate_kbps: Some(4500),
            audio_device: None, capture_system_audio: Some(false), system_audio_volume: Some(100), microphone_volume: Some(100),
            capture_mode: None, active_scene_id: Some("main".into()), scenes: Some(scenes), draw_cursor: Some(true),
            source_kind: None, source_id: None, overlay_text: None, overlay_image_path: None, multitrack_audio: Some(false),
            noise_suppression: Some(true), microphone_compressor: Some(true), microphone_limiter: Some(true), microphone_noise_gate: Some(false),
            replay_buffer_enabled: Some(false), replay_buffer_seconds: Some(30),
        };
        let camera = virtual_camera_plan(&options).unwrap();
        let camera_graph = camera.args.windows(2).find(|pair| pair[0] == "-filter_complex").map(|pair| pair[1].as_str()).unwrap();
        assert!(camera_graph.contains("drawbox=x=(iw-iw*40/100)*25/100"));
        assert!(camera_graph.contains(":text='Serbest kaynak'"));
        assert!(camera.source_filter_ids.contains("source_main_background_accent"));
        assert!(camera.source_filter_ids.contains("source_main_headline"));
        assert!(camera.source_filter_ids.contains("source_main_waiting_label"));
    }

    #[cfg(windows)]
    #[test]
    fn local_media_layer_runs_in_a_real_ffmpeg_graph() {
        let ffmpeg = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("binaries")
            .join("ffmpeg-x86_64-pc-windows-msvc.exe");
        let directory = std::env::temp_dir().join(format!("play-streamers-layer-{}", unix_time_milliseconds()));
        fs::create_dir_all(&directory).unwrap();
        let media = directory.join("loop.mp4");
        let generated = hidden_command(&ffmpeg)
            .args(["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=160x90:rate=10", "-t", "1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y"])
            .arg(&media)
            .status()
            .unwrap();
        assert!(generated.success());
        let scene = StudioSceneOption {
            id: "main".into(), name: "Ana sahne".into(), kind: "capture".into(), source_kind: "desktop".into(),
            layers: Some(vec![
                StudioLayerOption { id: "clip".into(), name: "Döngü".into(), kind: "media".into(), visible: Some(true), path: Some(media.to_string_lossy().into_owned()), scale: Some(50), x: Some(50), y: Some(50), opacity: Some(85), ..Default::default() },
                StudioLayerOption { id: "label".into(), name: "Etiket".into(), kind: "text".into(), visible: Some(true), text: Some("MEDYA".into()), scale: Some(48), x: Some(50), y: Some(20), opacity: Some(100), ..Default::default() },
            ]),
            ..Default::default()
        };
        let mut args = vec!["-hide_banner".into(), "-loglevel".into(), "error".into(), "-f".into(), "lavfi".into(), "-i".into(), "color=c=black:size=320x180:rate=10".into()];
        let mut next_input = 1;
        let layers = prepare_scene_layer_inputs(&scene, &mut args, &mut next_input, 10).unwrap();
        let mut filters = vec!["[0:v:0]format=yuv420p[base]".into()];
        let mut source_filter_ids = HashSet::new();
        let current = apply_scene_layers(
            &mut filters,
            "base".into(),
            &layers,
            320,
            180,
            10,
            "test",
            "test-scene",
            &mut source_filter_ids,
        ).unwrap();
        filters.push(format!("[{current}]format=yuv420p[out]"));
        args.extend(["-filter_complex".into(), filters.join(";"), "-map".into(), "[out]".into(), "-t".into(), "1".into(), "-an".into(), "-f".into(), "null".into(), "NUL".into()]);
        let status = hidden_command(&ffmpeg).args(&args).status().unwrap();
        assert!(status.success());
        let _ = fs::remove_file(&media);
        let _ = fs::remove_dir(&directory);
    }

    #[test]
    fn replay_buffer_uses_a_bounded_two_second_segment_ring() {
        let directory = std::env::temp_dir().join(format!("play-streamers-replay-plan-{}", unix_time_milliseconds()));
        fs::create_dir_all(&directory).unwrap();
        let replay = ReplayBufferState { directory: directory.clone(), seconds: 30, segment_pattern: directory.join("segment-%03d.mkv") };
        let leg = replay_tee_leg(&replay);
        assert!(leg.contains("f=segment"));
        assert!(leg.contains("segment_time=2"));
        assert!(leg.contains("segment_wrap=17"));
        assert!(leg.contains("segment-%03d.mkv"));
    }

    #[cfg(windows)]
    #[test]
    fn replay_segments_are_copied_and_joined_into_a_real_mkv() {
        let ffmpeg = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("binaries")
            .join("ffmpeg-x86_64-pc-windows-msvc.exe");
        assert!(ffmpeg.is_file());
        let directory = std::env::temp_dir().join(format!("play-streamers-replay-save-{}", unix_time_milliseconds()));
        fs::create_dir_all(&directory).unwrap();
        let replay = ReplayBufferState { directory: directory.clone(), seconds: 30, segment_pattern: directory.join("segment-%03d.mkv") };
        let main_output = directory.with_extension("main.mkv");
        let tee_output = format!("[f=matroska:onfail=abort]{}|{}", escape_tee_value(&main_output), replay_tee_leg(&replay));
        let generated = hidden_command(&ffmpeg)
            .args([
                "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=10",
                "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000", "-t", "6",
                "-c:v", "libx264", "-preset", "ultrafast", "-g", "20", "-keyint_min", "20", "-sc_threshold", "0",
                "-c:a", "aac", "-flags", "+global_header", "-map", "0:v", "-map", "1:a", "-f", "tee", "-y", &tee_output,
            ])
            .status()
            .unwrap();
        assert!(generated.success());
        assert!(main_output.metadata().map(|value| value.len() > 1024).unwrap_or(false));
        assert!(replay_segment_files_in(&directory).len() >= 3);
        let output = directory.with_extension("mkv");
        save_replay_segments(&ffmpeg, &directory, 30, &output).unwrap();
        assert!(output.metadata().map(|value| value.len() > 1024).unwrap_or(false));
        drop(replay);
        let _ = fs::remove_file(main_output);
        let _ = fs::remove_file(output);
    }

    #[test]
    fn virtual_camera_is_only_supported_on_windows_11_builds() {
        assert!(!virtual_camera_supported_build(19_045));
        assert!(!virtual_camera_supported_build(21_999));
        assert!(virtual_camera_supported_build(22_000));
        assert!(virtual_camera_supported_build(26_100));
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
            active_scene_id: None,
            scenes: None,
            draw_cursor: Some(true),
            source_kind: Some("desktop".into()),
            source_id: None,
            overlay_text: Some("Play Streamers".into()),
            overlay_image_path: None,
            multitrack_audio: Some(false),
            noise_suppression: Some(true),
            microphone_compressor: Some(true),
            microphone_limiter: Some(true),
            microphone_noise_gate: Some(false),
            replay_buffer_enabled: Some(false),
            replay_buffer_seconds: Some(30),
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
                "-filter_complex", "[0:v]format=yuv420p[base];color=c=black@0.0:size=320x180:rate=30,format=rgba,drawbox=x=10:y=10:w=80:h=40:color=0x53fc18@1:t=fill,colorchannelmixer@source_main_logo=aa=1[source];[base][source]overlay=0:0:format=auto,split=2[main_program][main_transition];color=c=black:size=320x180:rate=30,format=yuv420p,split=2[slate_program][slate_transition];[main_program][slate_program]streamselect@scene=inputs=2:map=0[current];[main_transition][slate_transition]streamselect@scene_next=inputs=2:map=0[next];[next]format=rgba,colorchannelmixer@scene_crossfade=aa=0[next_alpha];[current][next_alpha]overlay=0:0:format=auto[crossfaded];color=c=black@1:size=320x180:rate=30,format=rgba,colorchannelmixer@scene_fade=aa=0[fade];[crossfaded][fade]overlay=0:0:format=auto,format=yuv420p,zmq[video];[1:a]volume@system_volume=1.0[audio]",
                "-map", "[video]", "-map", "[audio]", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-t", "3", "-y",
                &output.to_string_lossy(),
            ])
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("ffmpeg smoke process");
        thread::sleep(Duration::from_millis(700));
        let next_result = send_graph_command_to(5555, "streamselect@scene_next map 1".into());
        let crossfade_result = crossfade_scene_outputs(&[5555], 100);
        let crossfade_commit_result = send_graph_command_to(5555, "streamselect@scene map 1".into());
        let crossfade_reset_result = set_scene_overlay_alpha(&[5555], "scene_crossfade", 0.0);
        let fade_out_result = fade_scene_outputs(&[5555], true, 100);
        let scene_result = send_graph_command_to(5555, "streamselect@scene map 0".into());
        let fade_in_result = fade_scene_outputs(&[5555], false, 100);
        let volume_result = send_graph_command_to(5555, "volume@system_volume volume 0.5".into());
        let source_result = send_graph_command_to(5555, "colorchannelmixer@source_main_logo aa 0.0".into());
        if let Some(stdin) = child.stdin.as_mut() {
            let _ = stdin.write_all(b"q\n");
        }
        let _ = child.wait();
        assert!(scene_result.is_ok(), "{scene_result:?}");
        assert!(next_result.is_ok(), "{next_result:?}");
        assert!(crossfade_result.is_ok(), "{crossfade_result:?}");
        assert!(crossfade_commit_result.is_ok(), "{crossfade_commit_result:?}");
        assert!(crossfade_reset_result.is_ok(), "{crossfade_reset_result:?}");
        assert!(fade_out_result.is_ok(), "{fade_out_result:?}");
        assert!(fade_in_result.is_ok(), "{fade_in_result:?}");
        assert!(volume_result.is_ok(), "{volume_result:?}");
        assert!(source_result.is_ok(), "{source_result:?}");
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
        start_process(&ffmpeg, primary, &mut engine, EngineMode::Recording, "libx264".into(), Some(output.clone()), None, "desktop", vec!["desktop".into(), "slate".into()], HashSet::new(), Some(fallback), None).unwrap();
        for _ in 0..30 {
            if output.metadata().map(|value| value.len() > 1024).unwrap_or(false) {
                break;
            }
            thread::sleep(Duration::from_millis(100));
        }
        stop_process(&mut engine).unwrap();
        assert!(output.metadata().map(|value| value.len() > 1024).unwrap_or(false));
        let _ = fs::remove_file(output);
    }
}
