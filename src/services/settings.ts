import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "../types/character";

/** Load settings from the Rust backend (local JSON file). */
export async function loadSettings(): Promise<AppSettings> {
  return await invoke<AppSettings>("get_settings");
}

/** Persist settings and return the saved copy. */
export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  return await invoke<AppSettings>("update_settings", { settings });
}
