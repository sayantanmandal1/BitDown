use std::path::PathBuf;

fn main() {
    // Read .env from project root and emit cargo:rustc-env directives.
    // In CI the variables are already in the environment (set via GitHub Secrets),
    // so we only emit them when they are NOT already present.
    let manifest = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let env_file = manifest.parent().unwrap_or(&manifest).join(".env");
    println!("cargo:rerun-if-changed={}", env_file.display());
    if let Ok(content) = std::fs::read_to_string(&env_file) {
        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') { continue; }
            if let Some((key, val)) = line.split_once('=') {
                let key = key.trim();
                let val = val.trim().trim_matches('"').trim_matches('\'');
                // Don't override a variable already set in the environment (CI)
                if std::env::var(key).is_err() {
                    println!("cargo:rustc-env={}={}", key, val);
                }
            }
        }
    }
    tauri_build::build()
}
