//! App-managed storage for Timeline cover images.
//!
//! Covers live under `<app data dir>/timeline-assets/<recordId>/cover.<ext>`.
//! The record only stores the relative ref, so moving the app data dir or
//! editing the original file elsewhere never breaks the reference. All
//! filename-bearing logic is pure (takes a root path) so it can be unit
//! tested without an AppHandle.

use std::fs;
use std::path::{Path, PathBuf};

const ALLOWED_EXTS: [&str; 4] = ["png", "jpg", "jpeg", "webp"];
const FILE_STEM: &str = "cover";

/// Validate an extension against the whitelist (png / jpg / jpeg / webp).
pub fn validate_ext(ext: &str) -> Result<String, String> {
    let lower = ext.trim().trim_start_matches('.').to_ascii_lowercase();
    if ALLOWED_EXTS.contains(&lower.as_str()) {
        Ok(lower)
    } else {
        Err(format!("unsupported image extension: {ext} (png/jpg/jpeg/webp only)"))
    }
}

/// A record id must be a plain token — no separators, no traversal.
pub fn validate_record_id(record_id: &str) -> Result<&str, String> {
    let ok = !record_id.is_empty()
        && record_id.len() <= 64
        && record_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    if ok {
        Ok(record_id)
    } else {
        Err("invalid record id".to_string())
    }
}

fn record_dir(root: &Path, record_id: &str) -> Result<PathBuf, String> {
    validate_record_id(record_id)?;
    Ok(root.join(record_id))
}

/// Remove every existing `cover.*` file in the record dir (old ext included),
/// so replacing a cover never leaves residue. Missing dir is fine.
fn remove_existing_covers(dir: &Path) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name = name.to_string_lossy();
            let has_stem = name
                .strip_prefix(FILE_STEM)
                .is_some_and(|rest| rest.starts_with('.'));
            if has_stem && entry.path().is_file() {
                let _ = fs::remove_file(entry.path());
            }
        }
    }
}

/// Write the cover bytes for a record, cleaning up any previous cover first.
/// Returns the relative ref "<recordId>/cover.<ext>".
pub fn save_cover(root: &Path, record_id: &str, ext: &str, data: &[u8]) -> Result<String, String> {
    let ext = validate_ext(ext)?;
    if data.is_empty() {
        return Err("empty image data".to_string());
    }
    let dir = record_dir(root, record_id)?;
    fs::create_dir_all(&dir).map_err(|e| format!("failed to create assets dir: {e}"))?;
    remove_existing_covers(&dir);
    let path = dir.join(format!("{FILE_STEM}.{ext}"));
    fs::write(&path, data).map_err(|e| format!("failed to write cover: {e}"))?;
    Ok(format!("{record_id}/{FILE_STEM}.{ext}"))
}

/// Delete a single cover file by its ref ("<recordId>/cover.<ext>"). Missing
/// files are treated as success (idempotent).
pub fn delete_cover(root: &Path, cover_ref: &str) -> Result<(), String> {
    let Some((record_id, file_name)) = cover_ref.split_once('/') else {
        return Err(format!("malformed cover ref: {cover_ref}"));
    };
    validate_record_id(record_id)?;
    let ext = file_name
        .strip_prefix(&format!("{FILE_STEM}."))
        .ok_or_else(|| format!("malformed cover file name: {file_name}"))?;
    validate_ext(ext)?;
    let path = root.join(record_id).join(file_name);
    if path.is_file() {
        fs::remove_file(&path).map_err(|e| format!("failed to delete cover: {e}"))?;
    }
    Ok(())
}

/// Delete the whole asset directory of a record (called when the record is
/// removed). Missing dirs are treated as success.
pub fn delete_record_assets(root: &Path, record_id: &str) -> Result<(), String> {
    let dir = record_dir(root, record_id)?;
    if dir.is_dir() {
        fs::remove_dir_all(&dir).map_err(|e| format!("failed to delete record assets: {e}"))?;
    }
    Ok(())
}

// ── base64 (hand-rolled to avoid a new dependency) ───────────

const B64_ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

pub fn encode_base64(data: &[u8]) -> String {
    let mut out = String::with_capacity(data.len().div_ceil(3) * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = *chunk.get(1).unwrap_or(&0) as u32;
        let b2 = *chunk.get(2).unwrap_or(&0) as u32;
        let n = (b0 << 16) | (b1 << 8) | b2;
        out.push(B64_ALPHABET[(n >> 18) as usize & 63] as char);
        out.push(B64_ALPHABET[(n >> 12) as usize & 63] as char);
        if chunk.len() > 1 {
            out.push(B64_ALPHABET[(n >> 6) as usize & 63] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(B64_ALPHABET[n as usize & 63] as char);
        } else {
            out.push('=');
        }
    }
    out
}

fn b64_value(c: u8) -> Option<u32> {
    match c {
        b'A'..=b'Z' => Some((c - b'A') as u32),
        b'a'..=b'z' => Some((c - b'a') as u32 + 26),
        b'0'..=b'9' => Some((c - b'0') as u32 + 52),
        b'+' => Some(62),
        b'/' => Some(63),
        _ => None,
    }
}

/// Decode standard base64 (with optional padding). Whitespace is ignored.
pub fn decode_base64(input: &str) -> Result<Vec<u8>, String> {
    let mut acc: u32 = 0;
    let mut bits = 0u32;
    let mut out = Vec::with_capacity(input.len() / 4 * 3);
    for c in input.bytes() {
        if c.is_ascii_whitespace() || c == b'=' {
            continue;
        }
        let v = b64_value(c).ok_or_else(|| format!("invalid base64 character: {c:#04x}"))?;
        acc = (acc << 6) | v;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((acc >> bits) as u8);
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TempRoot(PathBuf);
    impl TempRoot {
        fn new(tag: &str) -> Self {
            let dir = std::env::temp_dir().join(format!(
                "jane-timeline-test-{}-{tag}",
                std::process::id()
            ));
            let _ = fs::remove_dir_all(&dir);
            fs::create_dir_all(&dir).unwrap();
            TempRoot(dir)
        }
    }
    impl Drop for TempRoot {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn ext_whitelist() {
        assert_eq!(validate_ext("png").unwrap(), "png");
        assert_eq!(validate_ext(".JPG").unwrap(), "jpg");
        assert_eq!(validate_ext("JPEG").unwrap(), "jpeg");
        assert_eq!(validate_ext("webp").unwrap(), "webp");
        assert!(validate_ext("gif").is_err());
        assert!(validate_ext("mp4").is_err());
        assert!(validate_ext("exe").is_err());
        assert!(validate_ext("").is_err());
    }

    #[test]
    fn record_id_rejects_traversal() {
        assert!(validate_record_id("abc-123").is_ok());
        assert!(validate_record_id("../evil").is_err());
        assert!(validate_record_id("a/b").is_err());
        assert!(validate_record_id("").is_err());
        assert!(validate_record_id("a\\b").is_err());
    }

    #[test]
    fn save_png_and_jpg() {
        let root = TempRoot::new("save");
        let r1 = save_cover(&root.0, "rec1", "png", b"\x89PNG fake").unwrap();
        assert_eq!(r1, "rec1/cover.png");
        assert!(root.0.join("rec1/cover.png").is_file());
        let r2 = save_cover(&root.0, "rec2", "JPEG", b"\xff\xd8 fake").unwrap();
        assert_eq!(r2, "rec2/cover.jpeg");
        assert!(root.0.join("rec2/cover.jpeg").is_file());
    }

    #[test]
    fn replace_leaves_no_residue() {
        let root = TempRoot::new("replace");
        save_cover(&root.0, "rec1", "png", b"old").unwrap();
        let ref2 = save_cover(&root.0, "rec1", "jpg", b"new").unwrap();
        assert_eq!(ref2, "rec1/cover.jpg");
        assert!(!root.0.join("rec1/cover.png").exists(), "old ext removed");
        assert!(root.0.join("rec1/cover.jpg").is_file());
        assert_eq!(fs::read(root.0.join("rec1/cover.jpg")).unwrap(), b"new");
    }

    #[test]
    fn delete_cover_and_idempotence() {
        let root = TempRoot::new("delcover");
        let r = save_cover(&root.0, "rec1", "png", b"data").unwrap();
        delete_cover(&root.0, &r).unwrap();
        assert!(!root.0.join("rec1/cover.png").exists());
        // Idempotent: deleting again is fine.
        delete_cover(&root.0, &r).unwrap();
        // Malformed refs rejected.
        assert!(delete_cover(&root.0, "../evil/cover.png").is_err());
        assert!(delete_cover(&root.0, "rec1/nope.png").is_err());
        assert!(delete_cover(&root.0, "no-slash").is_err());
    }

    #[test]
    fn delete_record_assets_cleans_dir() {
        let root = TempRoot::new("delrec");
        save_cover(&root.0, "rec1", "png", b"a").unwrap();
        delete_record_assets(&root.0, "rec1").unwrap();
        assert!(!root.0.join("rec1").exists());
        // Missing dir → success.
        delete_record_assets(&root.0, "rec1").unwrap();
        // Bad id rejected.
        assert!(delete_record_assets(&root.0, "..").is_err());
    }

    #[test]
    fn base64_roundtrip() {
        // Known vectors.
        assert_eq!(encode_base64(b""), "");
        assert_eq!(encode_base64(b"f"), "Zg==");
        assert_eq!(encode_base64(b"fo"), "Zm8=");
        assert_eq!(encode_base64(b"foo"), "Zm9v");
        assert_eq!(encode_base64(b"foobar"), "Zm9vYmFy");
        assert_eq!(decode_base64("Zm9vYmFy").unwrap(), b"foobar");
        assert_eq!(decode_base64("Zg==").unwrap(), b"f");
        // Roundtrip of binary data (all byte values, several lengths).
        for len in [0usize, 1, 2, 3, 64, 1000, 4097] {
            let data: Vec<u8> = (0..len).map(|i| (i * 37 % 256) as u8).collect();
            assert_eq!(
                decode_base64(&encode_base64(&data)).unwrap(),
                data,
                "roundtrip failed for len {len}"
            );
        }
        // Invalid input rejected.
        assert!(decode_base64("Zm9v!*").is_err());
    }

    #[test]
    fn rejects_bad_input() {
        let root = TempRoot::new("badinput");
        assert!(save_cover(&root.0, "rec1", "gif", b"x").is_err());
        assert!(save_cover(&root.0, "rec1", "png", b"").is_err());
        assert!(save_cover(&root.0, "../evil", "png", b"x").is_err());
    }
}
