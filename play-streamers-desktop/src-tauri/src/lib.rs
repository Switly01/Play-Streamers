mod studio_engine;

use tauri::Manager;
use tauri::Emitter;
#[cfg(desktop)]
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
#[cfg(all(debug_assertions, windows))]
use tauri_plugin_deep_link::DeepLinkExt;

const CREDENTIAL_SERVICE: &str = "com.swcreate.playstreamers";

#[tauri::command]
fn secure_store(key: String, value: String) -> Result<(), String> {
    if key.len() > 80 || value.len() > 512 || !key.starts_with("ps.") {
        return Err("Güvenli kasa girdisi geçersiz.".into());
    }
    let entry = keyring::Entry::new(CREDENTIAL_SERVICE, &key).map_err(|_| "Windows güvenli kasası açılamadı.".to_string())?;
    entry.set_password(&value).map_err(|_| "Oturum güvenli kasaya kaydedilemedi.".to_string())
}

#[tauri::command]
fn secure_read(key: String) -> Result<Option<String>, String> {
    if key.len() > 80 || !key.starts_with("ps.") {
        return Err("Güvenli kasa anahtarı geçersiz.".into());
    }
    let entry = keyring::Entry::new(CREDENTIAL_SERVICE, &key).map_err(|_| "Windows güvenli kasası açılamadı.".to_string())?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err("Oturum güvenli kasadan okunamadı.".into()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(desktop)]
    let builder = builder.plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(|app, shortcut, event| {
                if event.state() != ShortcutState::Pressed {
                    return;
                }
                let record = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyR);
                let stream = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyL);
                let action = if shortcut == &record { Some("record") } else if shortcut == &stream { Some("stream") } else { None };
                if let Some(action) = action {
                    let _ = app.emit("studio-global-shortcut", action);
                }
            })
            .build(),
    );

    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.set_focus();
        }
    }));

    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .manage(studio_engine::StudioEngineState::default())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| {
            #[cfg(all(debug_assertions, windows))]
            _app.deep_link().register_all()?;
            #[cfg(desktop)]
            {
                let _ = _app.global_shortcut().register(Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyR));
                let _ = _app.global_shortcut().register(Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyL));
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            studio_engine::get_engine_status,
            studio_engine::list_audio_devices,
            studio_engine::list_video_devices,
            studio_engine::list_capture_windows,
            studio_engine::get_recordings_directory,
            studio_engine::remux_recording,
            secure_store,
            secure_read,
            studio_engine::start_recording,
            studio_engine::stop_recording,
            studio_engine::start_streaming,
            studio_engine::stop_streaming,
            studio_engine::get_virtual_camera_status,
            studio_engine::install_virtual_camera,
            studio_engine::start_virtual_camera,
            studio_engine::stop_virtual_camera,
            studio_engine::switch_scene,
            studio_engine::set_audio_volume
        ])
        .run(tauri::generate_context!())
        .expect("Play Streamers masaüstü uygulaması başlatılamadı");
}
