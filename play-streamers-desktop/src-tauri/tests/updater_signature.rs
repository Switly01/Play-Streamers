use base64::{engine::general_purpose::STANDARD, Engine as _};
use minisign_verify::{PublicKey, Signature};
use serde_json::Value;
use std::{fs, path::PathBuf};

#[test]
fn published_windows_installer_matches_updater_signature() {
    let release_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../downloads");
    let manifest: Value = serde_json::from_slice(
        &fs::read(release_dir.join("latest.json")).expect("latest.json bulunamadı"),
    )
    .expect("latest.json geçerli JSON değil");
    let signature_base64 = manifest["platforms"]["windows-x86_64"]["signature"]
        .as_str()
        .expect("Windows updater imzası manifestte yok");
    let public_key_base64 = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDNDM0NBQzBCRjExOTg4MkEKUldRcWlCbnhDNnc4UEdYcVFpaWw5Zk1LTDE5S1laaWpWUjBZY3Z6b1JKbjc1Rk5UN1RadkNLVnoK";

    let public_key_text = String::from_utf8(STANDARD.decode(public_key_base64).expect("Açık anahtar Base64 değil"))
        .expect("Açık anahtar UTF-8 değil");
    let signature_text = String::from_utf8(STANDARD.decode(signature_base64).expect("İmza Base64 değil"))
        .expect("İmza UTF-8 değil");
    let public_key = PublicKey::decode(&public_key_text).expect("Açık anahtar çözülemedi");
    let signature = Signature::decode(&signature_text).expect("Updater imzası çözülemedi");
    let installer = fs::read(release_dir.join("Play-Streamers-Setup.exe")).expect("Windows kurucusu bulunamadı");

    public_key
        .verify(&installer, &signature, true)
        .expect("Windows kurucusunun updater imzası geçersiz");
}
