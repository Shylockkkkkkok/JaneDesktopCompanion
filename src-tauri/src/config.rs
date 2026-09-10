use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

/// Physical (device) pixel coordinates. We store and restore positions in
/// physical space so that multi-monitor + DPI handling stays consistent.
/// `width`/`height` were added when the character window became
/// size-dynamic; `serde(default)` keeps old settings.json files valid
/// (missing size = keep the window's current/default size).
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Position {
    pub x: f64,
    pub y: f64,
    #[serde(default)]
    pub width: f64,
    #[serde(default)]
    pub height: f64,
}

/// The full user-facing settings object, persisted locally as JSON.
/// Every field uses `serde(default)` so an old/partial config file never
/// breaks deserialization — missing keys fall back to `Default`.
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct AppSettings {
    pub character_position: Option<Position>,
    pub character_scale: f64,
    pub dialogue_frequency: String,
    pub idle_animation_enabled: bool,
    pub passthrough_mode: bool,
    pub focus_default_minutes: u32,
    pub focus_auto_break: bool,
    pub focus_show_timer: bool,
    /// Which look to show at startup: keepLast | randomFavorite | randomDaily.
    pub startup_look_mode: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            character_position: None,
            character_scale: 1.0,
            dialogue_frequency: "medium".to_string(),
            idle_animation_enabled: true,
            passthrough_mode: false,
            focus_default_minutes: 25,
            focus_auto_break: false,
            focus_show_timer: true,
            startup_look_mode: "keepLast".to_string(),
        }
    }
}

/// Managed application state: the in-memory settings (guarded by a mutex)
/// plus the path of the config file on disk.
pub struct AppState {
    pub settings: Mutex<AppSettings>,
    pub config_path: PathBuf,
}

impl AppState {
    pub fn load(app: &tauri::AppHandle) -> Result<Self, String> {
        let config_path = app
            .path()
            .app_config_dir()
            .map_err(|e| format!("failed to resolve config dir: {e}"))?
            .join("settings.json");

        // A damaged or partially written settings file must not keep JANE
        // from starting. The next successful save will replace it.
        let settings = fs::read_to_string(&config_path)
            .ok()
            .and_then(|raw| serde_json::from_str::<AppSettings>(&raw).ok())
            .unwrap_or_default();

        Ok(Self {
            settings: Mutex::new(settings),
            config_path,
        })
    }

    pub fn save(&self) -> Result<(), String> {
        let settings = self
            .settings
            .lock()
            .map_err(|_| "settings lock poisoned".to_string())?;
        let raw = serde_json::to_string_pretty(&*settings)
            .map_err(|e| format!("failed to serialize settings: {e}"))?;

        if let Some(parent) = self.config_path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("failed to create config dir: {e}"))?;
        }
        fs::write(&self.config_path, raw).map_err(|e| format!("failed to write settings: {e}"))
    }

    /// Applies a mutation to the settings and persists it in one step.
    pub fn update(&self, f: impl FnOnce(&mut AppSettings)) -> Result<(), String> {
        {
            let mut settings = self
                .settings
                .lock()
                .map_err(|_| "settings lock poisoned".to_string())?;
            f(&mut settings);
        }
        self.save()
    }
}
