use serde::Serialize;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{TrayIcon, TrayIconBuilder},
    Emitter, Listener, Manager, PhysicalPosition, PhysicalSize, RunEvent, WebviewWindow, WindowEvent,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

mod config;
mod timeline_assets;
use config::{AppSettings, AppState, Position};

// ─────────────────────────────────────────────────────────────
// Event payloads
// ─────────────────────────────────────────────────────────────

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ModeChangedPayload {
    passthrough: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FocusStartPayload {
    /// Focus duration in ms; 0 means "use the user's default".
    duration_ms: i64,
}

#[derive(Clone, Serialize)]
struct PosePayload {
    pose: String,
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

fn io_err(e: String) -> std::io::Error {
    std::io::Error::new(std::io::ErrorKind::Other, e)
}

/// Bottom-right of the primary monitor, offset so the character clears the
/// Windows taskbar. Margins are logical px scaled to physical px.
fn default_position(app: &tauri::AppHandle, window: &WebviewWindow) -> Result<Position, String> {
    let monitor = app
        .primary_monitor()
        .map_err(|e| format!("failed to get primary monitor: {e}"))?
        .ok_or_else(|| "no primary monitor available".to_string())?;

    let scale = monitor.scale_factor();
    let mp = monitor.position();
    let ms = monitor.size();
    let ws = window
        .outer_size()
        .map_err(|e| format!("failed to get window size: {e}"))?;

    let margin_right = (24.0 * scale).round() as i32;
    let margin_bottom = (96.0 * scale).round() as i32;

    Ok(Position {
        x: (mp.x + ms.width as i32 - ws.width as i32 - margin_right) as f64,
        y: (mp.y + ms.height as i32 - ws.height as i32 - margin_bottom) as f64,
        // Zero size = "keep the window's current size" for callers that only
        // want a position reset.
        width: 0.0,
        height: 0.0,
    })
}

/// True if the given physical position still lies within some connected
/// monitor. Prevents restoring the window onto a disconnected display.
fn is_position_visible(app: &tauri::AppHandle, pos: &Position) -> bool {
    app.available_monitors().map_or(false, |monitors| {
        monitors.iter().any(|m| {
            let mp = m.position();
            let ms = m.size();
            pos.x >= mp.x as f64
                && pos.y >= mp.y as f64
                && pos.x < (mp.x + ms.width as i32) as f64
                && pos.y < (mp.y + ms.height as i32) as f64
        })
    })
}

fn apply_mode(app: &tauri::AppHandle, enabled: bool) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_ignore_cursor_events(enabled);
    }
    {
        let state = app.state::<AppState>();
        let _ = state.update(|s| s.passthrough_mode = enabled);
    }
    let _ = app.emit(
        "mode-changed",
        ModeChangedPayload {
            passthrough: enabled,
        },
    );
}

fn toggle_passthrough(app: &tauri::AppHandle) {
    let enabled = app
        .state::<AppState>()
        .settings
        .lock()
        .map(|s| !s.passthrough_mode)
        .unwrap_or(false);
    apply_mode(app, enabled);
}

fn toggle_visibility(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        match window.is_visible() {
            Ok(true) => {
                let _ = window.hide();
            }
            _ => {
                let _ = window.show();
                // Re-showing raises the main window above the bubble
                // overlay — restore the bubble's z-order so it can never
                // end up behind Jane while a line is on screen.
                if let Some(bubble) = app.get_webview_window("bubble") {
                    let _ = bubble.set_always_on_top(true);
                }
            }
        }
    }
}

/// Show + focus one of the secondary windows by label. Labels are whitelisted;
/// anything else is ignored. Shared by the tray menu and the Jane right-click
/// menu (which reaches here through the `jane-open` event).
fn open_secondary_window(app: &tauri::AppHandle, label: &str) {
    const ALLOWED: [&str; 4] = ["settings", "goals", "concert", "timeline"];
    if !ALLOWED.contains(&label) {
        return;
    }
    if let Some(window) = app.get_webview_window(label) {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn do_reset_position(app: &tauri::AppHandle) -> Result<Position, String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    let pos = default_position(app, &window)?;
    window
        .set_position(PhysicalPosition::new(pos.x as i32, pos.y as i32))
        .map_err(|e| format!("failed to set position: {e}"))?;
    // Keep the current (compact) window size — only the position resets.
    let size = window.outer_size().unwrap_or_default();
    let pos = Position {
        x: pos.x,
        y: pos.y,
        width: size.width as f64,
        height: size.height as f64,
    };
    app.state::<AppState>()
        .update(|s| s.character_position = Some(pos.clone()))?;
    Ok(pos)
}

/// Tray glyph: the JANE logo. Embedded at build time as a raw 32×32 RGBA
/// buffer (pre-decoded from the icon set — no image decoding crate needed).
/// Regenerate together with the icons when the logo changes.
fn tray_icon() -> tauri::image::Image<'static> {
    const SIZE: u32 = 32;
    const EXPECTED: usize = (SIZE * SIZE * 4) as usize;
    let rgba = include_bytes!("../icons/tray-icon.rgba").to_vec();
    if rgba.len() != EXPECTED {
        // Corrupted asset — fall back to a visible filled disc rather than
        // panicking at startup.
        let mut fallback = vec![0u8; EXPECTED];
        for px in fallback.chunks_mut(4) {
            px.copy_from_slice(&[0xC0, 0x50, 0x50, 0xFF]);
        }
        return tauri::image::Image::new_owned(fallback, SIZE, SIZE);
    }
    tauri::image::Image::new_owned(rgba, SIZE, SIZE)
}

// ─────────────────────────────────────────────────────────────
// System idle time (coarse user-activity detection)
// ─────────────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
mod idle {
    use std::mem;

    #[repr(C)]
    struct LastInputInfo {
        cb_size: u32,
        dw_time: u32,
    }

    #[link(name = "user32")]
    extern "system" {
        fn GetLastInputInfo(plii: *mut LastInputInfo) -> i32;
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn GetTickCount() -> u32;
    }

    pub fn idle_seconds() -> f64 {
        let mut lii = LastInputInfo {
            cb_size: mem::size_of::<LastInputInfo>() as u32,
            dw_time: 0,
        };
        let ok = unsafe { GetLastInputInfo(&mut lii) };
        if ok == 0 {
            return 0.0;
        }
        let tick = unsafe { GetTickCount() };
        // GetTickCount wraps every ~49.7 days; wrapping_sub handles the wrap.
        let elapsed = tick.wrapping_sub(lii.dw_time);
        elapsed as f64 / 1000.0
    }
}

#[cfg(not(target_os = "windows"))]
mod idle {
    pub fn idle_seconds() -> f64 {
        // TODO: macOS / Linux idle detection.
        0.0
    }
}

// ─────────────────────────────────────────────────────────────
// Commands (called from the frontend via `invoke`)
// ─────────────────────────────────────────────────────────────

#[tauri::command]
fn get_system_idle_time() -> f64 {
    idle::idle_seconds()
}

#[tauri::command]
fn get_settings(state: tauri::State<AppState>) -> Result<AppSettings, String> {
    state
        .settings
        .lock()
        .map(|s| s.clone())
        .map_err(|_| "settings lock poisoned".to_string())
}

#[tauri::command]
fn update_settings(
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
    settings: AppSettings,
) -> Result<AppSettings, String> {
    {
        let mut cur = state
            .settings
            .lock()
            .map_err(|_| "settings lock poisoned".to_string())?;
        *cur = settings.clone();
    }
    state.save()?;

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_ignore_cursor_events(settings.passthrough_mode);
    }

    // Broadcast so the character window can pick up changes live.
    let _ = app.emit("settings-changed", settings.clone());

    Ok(settings)
}

/// Compact-window command: the frontend measures the visible figure and asks
/// for exact physical bounds. Position AND size are applied in one step and
/// persisted (size is restored at startup so Jane does not flash at the old
/// large window size).
#[tauri::command]
fn set_character_bounds(
    app: tauri::AppHandle,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    window
        .set_size(PhysicalSize::new(width.round() as u32, height.round() as u32))
        .map_err(|e| format!("failed to set size: {e}"))?;
    window
        .set_position(PhysicalPosition::new(x.round() as i32, y.round() as i32))
        .map_err(|e| format!("failed to set position: {e}"))?;
    app.state::<AppState>().update(|s| {
        s.character_position = Some(Position {
            x,
            y,
            width,
            height,
        })
    })
}

#[tauri::command]
fn save_position(state: tauri::State<AppState>, x: f64, y: f64) -> Result<(), String> {
    // Drags never change the window size — keep the persisted size as-is.
    state.update(|s| {
        let (width, height) = s
            .character_position
            .as_ref()
            .map(|p| (p.width, p.height))
            .unwrap_or((0.0, 0.0));
        s.character_position = Some(Position {
            x,
            y,
            width,
            height,
        })
    })
}

#[tauri::command]
fn reset_position(app: tauri::AppHandle) -> Result<Position, String> {
    do_reset_position(&app)
}

#[tauri::command]
fn close_settings(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("settings") {
        window
            .hide()
            .map_err(|e| format!("failed to hide settings window: {e}"))?;
    }
    Ok(())
}

// ── Timeline cover image assets ──────────────────────────────

fn timeline_assets_root(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|d| d.join("timeline-assets"))
        .map_err(|e| format!("failed to resolve app data dir: {e}"))
}

/// Save (copy) a cover image picked by the user into app-managed storage.
/// `data_base64` is the raw image bytes; the original file is never touched.
/// Returns the relative ref stored on the record.
#[tauri::command]
fn timeline_save_cover(
    app: tauri::AppHandle,
    record_id: String,
    ext: String,
    data_base64: String,
) -> Result<String, String> {
    let data = timeline_assets::decode_base64(&data_base64)?;
    let root = timeline_assets_root(&app)?;
    timeline_assets::save_cover(&root, &record_id, &ext, &data)
}

/// Read a cover file and return it as a `data:` URL for <img> display.
/// Returns an error the frontend treats as "show placeholder" — never a crash.
#[tauri::command]
fn timeline_read_cover(app: tauri::AppHandle, cover_ref: String) -> Result<String, String> {
    let Some((record_id, file_name)) = cover_ref.split_once('/') else {
        return Err(format!("malformed cover ref: {cover_ref}"));
    };
    timeline_assets::validate_record_id(record_id)?;
    let ext = file_name
        .rsplit('.')
        .next()
        .unwrap_or_default()
        .to_ascii_lowercase();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        _ => return Err(format!("unsupported cover extension: {ext}")),
    };
    let path = timeline_assets_root(&app)?.join(record_id).join(file_name);
    let data = std::fs::read(&path).map_err(|e| format!("failed to read cover: {e}"))?;
    Ok(format!("data:{mime};base64,{}", timeline_assets::encode_base64(&data)))
}

/// Delete one cover file by ref. Idempotent.
#[tauri::command]
fn timeline_delete_cover(app: tauri::AppHandle, cover_ref: String) -> Result<(), String> {
    let root = timeline_assets_root(&app)?;
    timeline_assets::delete_cover(&root, &cover_ref)
}

/// Delete every asset file belonging to a record (record removal). Idempotent.
#[tauri::command]
fn timeline_delete_record_assets(app: tauri::AppHandle, record_id: String) -> Result<(), String> {
    let root = timeline_assets_root(&app)?;
    timeline_assets::delete_record_assets(&root, &record_id)
}

// ─────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────

fn position_window_at_startup(
    app: &tauri::AppHandle,
    window: &WebviewWindow,
) -> Result<(), String> {
    let saved = app
        .state::<AppState>()
        .settings
        .lock()
        .map(|s| s.character_position.clone())
        .map_err(|_| "settings lock poisoned".to_string())?;

    let pos = match saved {
        Some(p) if is_position_visible(app, &p) => p,
        _ => default_position(app, window)?,
    };

    // Restore the persisted compact size (older configs have no size — keep
    // the default from tauri.conf.json in that case).
    if pos.width > 0.0 && pos.height > 0.0 {
        window
            .set_size(PhysicalSize::new(pos.width.round() as u32, pos.height.round() as u32))
            .map_err(|e| format!("failed to restore size: {e}"))?;
    }
    window
        .set_position(PhysicalPosition::new(pos.x as i32, pos.y as i32))
        .map_err(|e| format!("failed to restore position: {e}"))?;

    app.state::<AppState>()
        .update(|s| s.character_position = Some(pos))?;

    Ok(())
}

fn setup_tray(app: &tauri::AppHandle) -> tauri::Result<TrayIcon<tauri::Wry>> {
    let interactive = MenuItem::with_id(app, "interactive", "互动模式", true, None::<&str>)?;
    let passthrough = MenuItem::with_id(app, "passthrough", "鼠标穿透", true, None::<&str>)?;
    let show_hide = MenuItem::with_id(app, "show_hide", "显示 / 隐藏", true, None::<&str>)?;
    let reset = MenuItem::with_id(app, "reset_position", "重置位置", true, None::<&str>)?;
    let goals = MenuItem::with_id(app, "goals", "今日目标", true, None::<&str>)?;
    let concert = MenuItem::with_id(app, "concert", "下一次Jane面", true, None::<&str>)?;
    let timeline = MenuItem::with_id(app, "timeline", "我与Jane的约会记录", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "设置", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

    let focus = Submenu::with_items(
        app,
        "陪我专注",
        true,
        &[
            &MenuItem::with_id(app, "focus_25", "25 分钟", true, None::<&str>)?,
            &MenuItem::with_id(app, "focus_50", "50 分钟", true, None::<&str>)?,
            &MenuItem::with_id(app, "focus_90", "90 分钟", true, None::<&str>)?,
            &MenuItem::with_id(app, "focus_custom", "自定义…", true, None::<&str>)?,
        ],
    )?;

    let look_select = Submenu::with_items(
        app,
        "选择造型",
        true,
        &[
            &MenuItem::with_id(app, "look_pose_standing", "站姿", true, None::<&str>)?,
            &MenuItem::with_id(app, "look_pose_sitting", "坐姿", true, None::<&str>)?,
            &MenuItem::with_id(app, "look_pose_relaxed", "放松", true, None::<&str>)?,
            &MenuItem::with_id(app, "look_pose_focus", "专注", true, None::<&str>)?,
            &MenuItem::with_id(app, "look_pose_concert", "演出", true, None::<&str>)?,
        ],
    )?;

    let look = Submenu::with_items(
        app,
        "换个样子",
        true,
        &[
            &MenuItem::with_id(app, "look_next", "换一个", true, None::<&str>)?,
            &look_select,
            &MenuItem::with_id(app, "look_lock", "锁定当前造型", true, None::<&str>)?,
        ],
    )?;

    let menu = Menu::with_items(
        app,
        &[
            &interactive,
            &passthrough,
            &PredefinedMenuItem::separator(app)?,
            &show_hide,
            &reset,
            &focus,
            &look,
            &goals,
            &concert,
            &timeline,
            &settings,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;

    let tray = TrayIconBuilder::with_id("jane-tray")
        .icon(tray_icon())
        .tooltip("Dear Jane")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "quit" => app.exit(0),
            "interactive" => apply_mode(app, false),
            "passthrough" => apply_mode(app, true),
            "show_hide" => toggle_visibility(app),
            "reset_position" => {
                let _ = do_reset_position(app);
            }
            "focus_25" => {
                let _ = app.emit(
                    "focus-start",
                    FocusStartPayload {
                        duration_ms: 25 * 60_000,
                    },
                );
            }
            "focus_50" => {
                let _ = app.emit(
                    "focus-start",
                    FocusStartPayload {
                        duration_ms: 50 * 60_000,
                    },
                );
            }
            "focus_90" => {
                let _ = app.emit(
                    "focus-start",
                    FocusStartPayload {
                        duration_ms: 90 * 60_000,
                    },
                );
            }
            "focus_custom" => {
                let _ = app.emit("focus-start", FocusStartPayload { duration_ms: 0 });
            }
            "look_next" => {
                let _ = app.emit("look-next", ());
            }
            "look_pose_standing" => {
                let _ = app.emit("look-pose", PosePayload { pose: "standing".into() });
            }
            "look_pose_sitting" => {
                let _ = app.emit("look-pose", PosePayload { pose: "sitting".into() });
            }
            "look_pose_relaxed" => {
                let _ = app.emit("look-pose", PosePayload { pose: "relaxed".into() });
            }
            "look_pose_focus" => {
                let _ = app.emit("look-pose", PosePayload { pose: "focus".into() });
            }
            "look_pose_concert" => {
                let _ = app.emit("look-pose", PosePayload { pose: "concert".into() });
            }
            "look_lock" => {
                let _ = app.emit("look-lock-toggle", ());
            }
            "goals" => {
                if let Some(window) = app.get_webview_window("goals") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "concert" => {
                if let Some(window) = app.get_webview_window("concert") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "timeline" => {
                if let Some(window) = app.get_webview_window("timeline") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "settings" => {
                if let Some(window) = app.get_webview_window("settings") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    // Tell the settings window to refresh — its state may have
                    // gone stale while hidden (e.g. passthrough toggled by the
                    // global shortcut).
                    let _ = app.emit("settings-window-shown", ());
                }
            }
            _ => {}
        })
        .build(app)?;

    Ok(tray)
}

// ─────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────

pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let state = AppState::load(app.handle()).map_err(io_err)?;
            app.manage(state);

            if let Err(e) =
                app.global_shortcut()
                    .on_shortcut("ctrl+shift+j", |app, _shortcut, event| {
                        if event.state == ShortcutState::Pressed {
                            toggle_passthrough(app);
                        }
                    })
            {
                // Non-fatal: JANE still works via the tray even without the
                // global shortcut, so log and continue instead of crashing.
                eprintln!("[JANE] failed to register global shortcut Ctrl+Shift+J: {e}");
            }

            let window = app
                .get_webview_window("main")
                .ok_or_else(|| std::io::Error::other("main window not found"))?;
            position_window_at_startup(app.handle(), &window).map_err(io_err)?;
            let passthrough = app
                .state::<AppState>()
                .settings
                .lock()
                .map(|settings| settings.passthrough_mode)
                .unwrap_or(false);
            window.set_ignore_cursor_events(passthrough)?;
            window.show()?;

            // Speech bubble lives in its own transparent overlay window. It
            // is shown exactly once here (the only moment focus-stealing is
            // acceptable), then kept forever "visible but empty" with mouse
            // events disabled — showing/hiding later would steal focus from
            // whatever the user is working in. Its content is toggled from
            // the main window via events, and it never accepts input.
            if let Some(bubble) = app.get_webview_window("bubble") {
                let _ = bubble.set_ignore_cursor_events(true);
                let _ = bubble.show();
            }

            // Keep the tray handle alive for the app's lifetime — dropping it
            // removes the icon from the system tray.
            app.manage(setup_tray(app.handle())?);

            // Intercept the settings window close: hide it instead of
            // destroying it so it can be re-shown from the tray.
            if let Some(settings_window) = app.get_webview_window("settings") {
                let sw = settings_window.clone();
                settings_window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = sw.hide();
                    }
                });
            }

            // Same for the goals window — otherwise closing it destroys it and
            // the tray can't re-open it.
            if let Some(goals_window) = app.get_webview_window("goals") {
                let gw = goals_window.clone();
                goals_window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = gw.hide();
                    }
                });
            }

            // Same for the concert window.
            if let Some(concert_window) = app.get_webview_window("concert") {
                let cw = concert_window.clone();
                concert_window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = cw.hide();
                    }
                });
            }

            // Same for the timeline window.
            if let Some(timeline_window) = app.get_webview_window("timeline") {
                let tw = timeline_window.clone();
                timeline_window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = tw.hide();
                    }
                });
            }

            // Jane right-click menu → open secondary windows. The frontend
            // emits `jane-open` with `{ target: <label> }`; routing goes
            // through the same whitelist as the tray menu.
            let open_handle = app.handle().clone();
            app.listen("jane-open", move |event| {
                #[derive(serde::Deserialize)]
                struct OpenPayload {
                    target: String,
                }
                if let Ok(payload) = serde_json::from_str::<OpenPayload>(event.payload()) {
                    open_secondary_window(&open_handle, &payload.target);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            update_settings,
            save_position,
            set_character_bounds,
            reset_position,
            close_settings,
            get_system_idle_time,
            timeline_save_cover,
            timeline_read_cover,
            timeline_delete_cover,
            timeline_delete_record_assets,
        ])
        .build(tauri::generate_context!())
        .expect("error while building JANE");

    app.run(|app_handle, event| {
        if let RunEvent::ExitRequested { .. } = event {
            // Safety net: persist the current position + size on exit.
            if let Some(window) = app_handle.get_webview_window("main") {
                if let (Ok(pos), Ok(size)) = (window.outer_position(), window.outer_size()) {
                    let state = app_handle.state::<AppState>();
                    let _ = state.update(|s| {
                        s.character_position = Some(Position {
                            x: pos.x as f64,
                            y: pos.y as f64,
                            width: size.width as f64,
                            height: size.height as f64,
                        });
                    });
                }
            }
        }
    });
}
