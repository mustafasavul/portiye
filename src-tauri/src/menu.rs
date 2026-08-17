//! The window's own menu bar — the strip macOS draws at the top of the screen,
//! and the one Windows and Linux draw inside the window.
//!
//! Tauri's default menu already carries the app, Edit, View and Window
//! submenus; only Help is empty, and an empty Help menu is the one a user
//! opens when they are already stuck. So the default is built, its Help
//! submenu found by the text it was given, and three destinations appended to
//! it.
//!
//! ponytail: the whole menu is not rebuilt from scratch to add three items.
//! Finding the existing submenu is a dozen lines; re-declaring every standard
//! item, per platform, is hundreds — and they would drift from the defaults on
//! the next Tauri release.

use tauri::menu::{Menu, MenuItem};
use tauri::{AppHandle, Runtime};

const HOMEPAGE: &str = "https://github.com/mustafasavul/portiye";
const ISSUES: &str = "https://github.com/mustafasavul/portiye/issues";
const RELEASES: &str = "https://github.com/mustafasavul/portiye/releases";

pub fn init<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let menu = Menu::default(app)?;

    // The default Help submenu is the last one and carries no stable id, so it
    // is found by kind rather than by name — a localised default would not
    // match a hard-coded "Help".
    if let Some(help) = menu
        .items()?
        .into_iter()
        .filter_map(|item| item.as_submenu().cloned())
        .next_back()
    {
        for (id, label) in [
            ("help:home", crate::i18n::t("menu.home")),
            ("help:issue", crate::i18n::t("menu.issue")),
            ("help:releases", crate::i18n::t("menu.releases")),
        ] {
            help.append(&MenuItem::with_id(app, id, label, true, None::<&str>)?)?;
        }
    }

    app.set_menu(menu)?;
    app.on_menu_event(|_app, event| {
        let url = match event.id.as_ref() {
            "help:home" => HOMEPAGE,
            "help:issue" => ISSUES,
            "help:releases" => RELEASES,
            // Every other id belongs to the tray, which has its own handler.
            _ => return,
        };
        let _ = tauri_plugin_opener::open_url(url, None::<&str>);
    });
    Ok(())
}
