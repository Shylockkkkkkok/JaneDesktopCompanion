import { invoke } from "@tauri-apps/api/core";

/**
 * System idle time in seconds (time since the last user input). Used only to
 * derive coarse activity states; it never reveals what the user is doing.
 */
export async function getSystemIdleTime(): Promise<number> {
  return await invoke<number>("get_system_idle_time");
}
