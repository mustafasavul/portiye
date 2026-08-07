//! Snapshot export.
//!
//! Writes to `~/Downloads` and hands the path back so the UI can reveal it.
//! No file-dialog plugin: picking a folder for a throwaway snapshot is friction,
//! and Downloads is where every browser already puts this kind of file.

use serde_json::Value;
use std::path::PathBuf;

/// RFC 4180: quote when the field holds a comma, quote or newline; a literal
/// quote is doubled. Getting this wrong silently corrupts every export that
/// contains a Windows path or a comma in a process name.
fn csv_field(raw: &str) -> String {
    if raw.contains([',', '"', '\n', '\r']) {
        format!("\"{}\"", raw.replace('"', "\"\""))
    } else {
        raw.to_string()
    }
}

/// Flattens the rows the UI already renders — whatever columns it sends.
fn to_csv(rows: &[Value]) -> String {
    let Some(first) = rows.first().and_then(Value::as_object) else {
        return String::new();
    };
    let headers: Vec<&String> = first.keys().collect();

    let mut out = headers
        .iter()
        .map(|h| csv_field(h))
        .collect::<Vec<_>>()
        .join(",");
    out.push('\n');

    for row in rows {
        let line = headers
            .iter()
            .map(|h| {
                let cell = row.get(h.as_str()).unwrap_or(&Value::Null);
                csv_field(&match cell {
                    Value::String(s) => s.clone(),
                    Value::Null => String::new(),
                    other => other.to_string(),
                })
            })
            .collect::<Vec<_>>()
            .join(",");
        out.push_str(&line);
        out.push('\n');
    }
    out
}

/// Anything that reaches a filename: a stamp, or a device id like `sim:UDID`.
/// A stray separator here would write outside Downloads.
fn safe_name(raw: &str) -> String {
    raw.replace(['/', '\\', ':', '.'], "-")
}

fn downloads_dir() -> PathBuf {
    crate::ports::home_dir()
        .map(|h| PathBuf::from(h).join("Downloads"))
        .filter(|p| p.exists())
        .unwrap_or_else(std::env::temp_dir)
}

/// Writes the snapshot and returns the absolute path it landed on.
///
/// `stamp` comes from the UI: the webview owns the user's locale and clock,
/// and a filename built there needs no timezone handling here.
#[tauri::command]
pub fn export_snapshot(rows: Vec<Value>, format: String, stamp: String) -> Result<String, String> {
    let body = match format.as_str() {
        "csv" => to_csv(&rows),
        "json" => serde_json::to_string_pretty(&rows)
            .map_err(|e| format!("could not encode JSON: {e}"))?,
        other => return Err(format!("unknown export format: {other}")),
    };

    // The stamp is used in a filename, so it must not carry a path separator.
    let path = downloads_dir().join(format!("portiye-{}.{format}", safe_name(&stamp)));

    std::fs::write(&path, body).map_err(|e| format!("could not write {}: {e}", path.display()))?;
    Ok(path.to_string_lossy().into_owned())
}

/// Whatever the log panel is showing, as a plain `.log` file next to the
/// snapshots. Same deal as `export_snapshot`: Downloads, path handed back.
#[tauri::command]
pub fn export_logs(lines: Vec<String>, source: String, stamp: String) -> Result<String, String> {
    let path = downloads_dir().join(format!(
        "portiye-{}-{}.log",
        safe_name(&source),
        safe_name(&stamp)
    ));
    let mut body = lines.join("\n");
    body.push('\n');

    std::fs::write(&path, body).map_err(|e| format!("could not write {}: {e}", path.display()))?;
    Ok(path.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn csv_quotes_only_what_needs_it() {
        assert_eq!(csv_field("node"), "node");
        assert_eq!(csv_field("a,b"), "\"a,b\"");
        assert_eq!(csv_field("say \"hi\""), "\"say \"\"hi\"\"\"");
        assert_eq!(csv_field("two\nlines"), "\"two\nlines\"");
    }

    #[test]
    fn csv_keeps_columns_aligned_when_a_field_is_missing() {
        let rows = vec![
            json!({ "port": 3000, "name": "node", "detail": "~/a,b" }),
            json!({ "port": 5432, "name": "postgres" }), // no detail
        ];
        assert_eq!(
            to_csv(&rows),
            "detail,name,port\n\"~/a,b\",node,3000\n,postgres,5432\n",
            "a missing field must become an empty cell, not a shifted row"
        );
    }

    #[test]
    fn a_device_id_cannot_escape_the_downloads_folder() {
        assert_eq!(safe_name("sim:UDID-1"), "sim-UDID-1");
        assert_eq!(safe_name("../../etc/passwd"), "------etc-passwd");
    }

    #[test]
    fn csv_of_nothing_is_empty_not_a_stray_header() {
        assert_eq!(to_csv(&[]), "");
    }
}
