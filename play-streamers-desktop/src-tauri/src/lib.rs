use tauri::Manager;
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
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| {
            #[cfg(all(debug_assertions, windows))]
            _app.deep_link().register_all()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            secure_store,
            secure_read
        ])
        .run(tauri::generate_context!())
        .expect("Play Streamers masaüstü uygulaması başlatılamadı");
}
