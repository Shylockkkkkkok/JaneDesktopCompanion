import { invoke } from "@tauri-apps/api/core";
import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";
import type { Position } from "../types/character";

/**
 * Central wrapper for Tauri window operations so the rest of the app never
 * touches the window API directly. Coordinates are physical (device) pixels.
 */

export async function savePosition(x: number, y: number): Promise<void> {
  await invoke("save_position", { x, y });
}

/**
 * Resize + reposition the character window to the exact physical bounds the
 * frontend measured for the visible figure. Also persists the bounds (size
 * included) so startup restores the compact window directly.
 */
export async function setCharacterBounds(
  x: number,
  y: number,
  width: number,
  height: number,
): Promise<void> {
  await invoke("set_character_bounds", { x, y, width, height });
}

export async function resetPosition(): Promise<Position> {
  return await invoke<Position>("reset_position");
}

export async function closeSettings(): Promise<void> {
  await invoke("close_settings");
}

/** Begin a native window drag. Call from a `mousedown` handler. */
export function startDragging(): void {
  void getCurrentWindow().startDragging();
}

export async function getCurrentPosition(): Promise<Position> {
  const pos = await getCurrentWindow().outerPosition();
  return { x: pos.x, y: pos.y };
}

export interface MonitorBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Device pixel ratio of this monitor (physical / logical). */
  scaleFactor: number;
}

/** Bounds of the monitor currently containing the window. */
export async function getCurrentMonitorBounds(): Promise<MonitorBounds | null> {
  const monitor = await currentMonitor();
  if (!monitor) return null;
  return {
    x: monitor.position.x,
    y: monitor.position.y,
    width: monitor.size.width,
    height: monitor.size.height,
    scaleFactor: monitor.scaleFactor,
  };
}

/** Current window size in physical pixels. */
export async function getCurrentSize(): Promise<{ width: number; height: number }> {
  const size = await getCurrentWindow().outerSize();
  return { width: size.width, height: size.height };
}

/**
 * Subscribe to window move events (fires while dragging). Resolves to an
 * unlisten function. The payload is in physical pixels.
 */
export function onWindowMoved(
  callback: (position: Position) => void,
): Promise<() => void> {
  return getCurrentWindow().onMoved(({ payload }) => {
    callback({ x: payload.x, y: payload.y });
  });
}
