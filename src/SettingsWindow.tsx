import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { SettingsPanel } from "./components/SettingsPanel";
import { loadSettings, saveSettings } from "./services/settings";
import type { AppSettings } from "./types/character";

const FALLBACK_SETTINGS: AppSettings = {
  characterPosition: null,
  characterScale: 1.0,
  dialogueFrequency: "medium",
  idleAnimationEnabled: true,
  passthroughMode: false,
  focusDefaultMinutes: 25,
  focusAutoBreak: false,
  focusShowTimer: true,
  startupLookMode: "keepLast",
};

/**
 * Root for the separate settings window (window label "settings"). Loads the
 * settings, renders the editor, and persists changes. Saving broadcasts a
 * "settings-changed" event so the character window updates live.
 */
export default function SettingsWindow() {
  const [settings, setSettings] = useState<AppSettings>(FALLBACK_SETTINGS);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let unShown: (() => void) | undefined;
    let unMode: (() => void) | undefined;
    let mounted = true;

    const refresh = () => {
      loadSettings()
        .then(setSettings)
        .catch(() => {
          /* keep current state */
        });
    };
    refresh();

    // Reload when the window is shown (it may have been stale while hidden).
    listen("settings-window-shown", () => {
      if (mounted) refresh();
    }).then((fn) => {
      if (mounted) unShown = fn;
    });

    // Keep the passthrough toggle in sync when toggled from the tray/shortcut.
    listen<{ passthrough: boolean }>("mode-changed", (event) => {
      if (!mounted) return;
      setSettings((prev) => ({ ...prev, passthroughMode: event.payload.passthrough }));
    }).then((fn) => {
      if (mounted) unMode = fn;
    });

    return () => {
      mounted = false;
      unShown?.();
      unMode?.();
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleChange = (next: AppSettings) => {
    setSettings(next);
    setSaveStatus("saving");
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveSettings(next)
        .then(() => {
          setSaveStatus("saved");
          window.setTimeout(() => setSaveStatus("idle"), 1400);
        })
        .catch(() => setSaveStatus("error"));
    }, 180);
  };

  return <SettingsPanel settings={settings} saveStatus={saveStatus} onChange={handleChange} />;
}
