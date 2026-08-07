//! Translations for the native menu-bar menu.
//!
//! The window has its own dictionary in `src/i18n.tsx`; this covers only the
//! dozen strings the tray draws, because the tray is built in Rust and cannot
//! reach the webview's table. The window pushes its locale here with
//! `set_locale` whenever it changes, and the tray is rebuilt with it.
//!
//! ponytail: a `match`, not a resource bundle. Twelve keys times five locales
//! is a table, and a table wants no loader.

use std::sync::Mutex;

/// Locale tags this app ships, matching `LOCALES` in `src/i18n.tsx`.
const KNOWN: [&str; 5] = ["en", "tr", "es", "de", "zh"];

static LOCALE: Mutex<&'static str> = Mutex::new("en");

/// Accepts anything the webview sends (`tr-TR`, `zh-Hans-CN`) and keeps the
/// base tag when it is one we ship. Unknown tags leave the locale alone.
pub fn set(tag: &str) {
    let base = tag
        .split(['-', '_'])
        .next()
        .unwrap_or("")
        .to_ascii_lowercase();
    if let Some(found) = KNOWN.iter().find(|k| **k == base) {
        *LOCALE.lock().unwrap() = found;
    }
}

fn current() -> &'static str {
    *LOCALE.lock().unwrap()
}

/// The string for `key` in the current locale, falling back to English.
pub fn t(key: &str) -> &'static str {
    let (en, tr, es, de, zh) = match key {
        "tray.ports" => ("Ports", "Portlar", "Puertos", "Ports", "端口"),
        "tray.none" => (
            "No listening ports",
            "Dinlenen port yok",
            "Sin puertos a la escucha",
            "Keine lauschenden Ports",
            "没有监听端口",
        ),
        "tray.devices" => ("Devices", "Cihazlar", "Dispositivos", "Geräte", "设备"),
        "tray.killAll" => (
            "Kill all",
            "Tümünü sonlandır",
            "Matar todos",
            "Alle beenden",
            "全部结束",
        ),
        "tray.show" => (
            "Open portiye…",
            "portiye'yi aç…",
            "Abrir portiye…",
            "portiye öffnen…",
            "打开 portiye…",
        ),
        "tray.quit" => ("Quit", "Çık", "Salir", "Beenden", "退出"),
        "tray.launch" => ("Launch", "Başlat", "Lanzar", "Starten", "启动"),
        "tray.stop" => ("Stop", "Durdur", "Detener", "Stoppen", "停止"),
        "tray.boot" => ("Boot", "Aç", "Arrancar", "Booten", "开机"),
        "tray.shutdown" => ("Shutdown", "Kapat", "Apagar", "Herunterfahren", "关机"),
        // Platform-specific elevation hints, appended to a warning in the
        // window — they belong in the same table as the rest of the prose.
        "elevate.macos" => (
            "macOS will ask for your password.",
            "macOS parolanızı soracak.",
            "macOS te pedirá tu contraseña.",
            "macOS fragt nach deinem Passwort.",
            "macOS 会要求输入你的密码。",
        ),
        "elevate.windows" => (
            "Windows will show a User Account Control prompt.",
            "Windows bir Kullanıcı Hesabı Denetimi istemi gösterecek.",
            "Windows mostrará un aviso de Control de cuentas de usuario.",
            "Windows zeigt eine Benutzerkontensteuerung-Abfrage.",
            "Windows 会弹出用户账户控制提示。",
        ),
        "elevate.other" => (
            "Your desktop will ask for authentication.",
            "Masaüstünüz kimlik doğrulaması isteyecek.",
            "Tu escritorio pedirá autenticación.",
            "Deine Desktop-Umgebung fragt nach einer Authentifizierung.",
            "你的桌面环境会要求进行身份验证。",
        ),
        _ => return "",
    };

    match current() {
        "tr" => tr,
        "es" => es,
        "de" => de,
        "zh" => zh,
        _ => en,
    }
}

/// Called by the window on start-up and whenever the user changes language.
#[tauri::command]
pub fn set_locale<R: tauri::Runtime>(app: tauri::AppHandle<R>, locale: String) {
    set(&locale);
    crate::tray::refresh(&app);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn region_tags_collapse_and_unknown_tags_are_ignored() {
        set("tr-TR");
        assert_eq!(t("tray.quit"), "Çık");
        set("zh_Hans_CN");
        assert_eq!(t("tray.quit"), "退出");
        set("kl-GL"); // not shipped — the previous choice must survive
        assert_eq!(t("tray.quit"), "退出");
        set("en");
        assert_eq!(t("tray.quit"), "Quit");
    }

    #[test]
    fn an_unknown_key_is_empty_rather_than_a_panic() {
        assert_eq!(t("tray.nope"), "");
    }
}
