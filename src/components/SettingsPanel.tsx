import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import type { AppSettings, DialogueFrequency, StartupLookMode } from "../types/character";
import { CHARACTER_CONFIG } from "../config/character";
import { STARTUP_LOOK_MODES } from "../config/looks";

interface SettingsPanelProps {
  settings: AppSettings;
  saveStatus: "idle" | "saving" | "saved" | "error";
  onChange: (settings: AppSettings) => void;
}

const FREQUENCY_LABEL: Record<DialogueFrequency, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

const FREQUENCIES: DialogueFrequency[] = ["low", "medium", "high"];

/**
 * Settings editor body. Rendered inside its own dedicated window, whose native
 * title bar provides dragging and closing — so this component has no chrome.
 */
export function SettingsPanel({ settings, saveStatus, onChange }: SettingsPanelProps) {
  const update = (patch: Partial<AppSettings>) =>
    onChange({ ...settings, ...patch });

  // ── Launch at startup ─────────────────────────────────────
  // The OS registration is the source of truth: the toggle always reflects
  // isEnabled() (queried on mount and every time the window is shown), and
  // only updates after enable()/disable() actually succeeded. The settings
  // file intentionally stores nothing for this.
  const [autostart, setAutostart] = useState<boolean | null>(null); // null = unknown
  const [autostartBusy, setAutostartBusy] = useState(false);
  const [autostartError, setAutostartError] = useState<string | null>(null);
  const autostartErrorTimerRef = useRef<number | null>(null);

  const showAutostartError = useCallback((text: string) => {
    setAutostartError(text);
    if (autostartErrorTimerRef.current !== null)
      window.clearTimeout(autostartErrorTimerRef.current);
    autostartErrorTimerRef.current = window.setTimeout(() => {
      setAutostartError(null);
    }, 4000);
  }, []);

  const syncAutostart = useCallback(() => {
    isEnabled()
      .then((v) => setAutostart(v))
      .catch(() => {
        // Leave the toggle disabled (unknown) instead of guessing; the panel
        // keeps working for every other setting.
      });
  }, []);

  useEffect(() => {
    syncAutostart();
    let unShown: (() => void) | undefined;
    let mounted = true;
    listen("settings-window-shown", () => {
      if (mounted) syncAutostart();
    }).then((fn) => {
      if (mounted) unShown = fn;
    });
    return () => {
      mounted = false;
      unShown?.();
      if (autostartErrorTimerRef.current !== null)
        window.clearTimeout(autostartErrorTimerRef.current);
    };
  }, [syncAutostart]);

  const handleAutostartToggle = useCallback(() => {
    if (autostart === null || autostartBusy) return;
    const wantEnabled = !autostart;
    setAutostartBusy(true);
    setAutostartError(null);
    (wantEnabled ? enable() : disable())
      // Re-read the real registration instead of trusting the call — the UI
      // must never claim "on" while the OS says otherwise.
      .then(() => isEnabled())
      .then((actual) => setAutostart(actual))
      .catch((e) => {
        console.error("[JANE] autostart toggle failed:", e);
        showAutostartError(wantEnabled ? "开启失败，请重试" : "关闭失败，请重试");
        // Roll the toggle back to the last known real state.
        syncAutostart();
      })
      .finally(() => setAutostartBusy(false));
  }, [autostart, autostartBusy, showAutostartError, syncAutostart]);

  return (
    <div className="settings-panel">
      <header className="settings-panel__header">
        <div>
          <span className="settings-panel__eyebrow">Dear Jane / PREFERENCES</span>
          <h1>陪伴设置</h1>
        </div>
        <span className={`save-status save-status--${saveStatus}`} role="status">
          {saveStatus === "saving" && "保存中"}
          {saveStatus === "saved" && "已保存"}
          {saveStatus === "error" && "保存失败"}
          {saveStatus === "idle" && "本地保存"}
        </span>
      </header>
      <div className="settings-panel__body">
        <section className="settings-section">
          <div className="settings-section__heading">
            <span>人物</span><small>外观与互动方式</small>
          </div>
        <label className="settings-row settings-row--stacked">
          <span className="settings-row__label">人物大小</span>
          <div className="settings-row__control">
            <input type="range" aria-label="人物大小" min={CHARACTER_CONFIG.minScale}
              max={CHARACTER_CONFIG.maxScale} step={0.05} value={settings.characterScale}
              onChange={(e) => update({ characterScale: Number(e.target.value) })} />
            <span className="settings-row__value">{Math.round(settings.characterScale * 100)}%</span>
          </div>
        </label>

        <div className="settings-row">
          <span className="settings-row__label">说话频率</span>
          <div className="settings-row__segmented" role="group" aria-label="说话频率">
            {FREQUENCIES.map((f) => (
              <button
                key={f}
                type="button"
                className={
                  settings.dialogueFrequency === f
                    ? "segmented segmented--active"
                    : "segmented"
                }
                onClick={() => update({ dialogueFrequency: f })}
                aria-pressed={settings.dialogueFrequency === f}
              >
                {FREQUENCY_LABEL[f]}
              </button>
            ))}
          </div>
        </div>

        <label className="settings-row settings-row--toggle">
          <span className="settings-row__label">Idle 动画</span>
          <input className="toggle"
            type="checkbox"
            checked={settings.idleAnimationEnabled}
            onChange={(e) => update({ idleAnimationEnabled: e.target.checked })}
          />
        </label>

        <div className="settings-row settings-row--toggle">
          <span className="settings-row__label">开机启动</span>
          {autostartError && (
            <span className="settings-row__error">{autostartError}</span>
          )}
          <input
            className="toggle"
            type="checkbox"
            checked={autostart === true}
            disabled={autostart === null || autostartBusy}
            onChange={handleAutostartToggle}
          />
        </div>

        <div className="settings-row">
          <span className="settings-row__label">启动时造型</span>
          <div className="settings-row__segmented" role="group" aria-label="启动时造型">
            {STARTUP_LOOK_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={
                  settings.startupLookMode === m.id
                    ? "segmented segmented--active"
                    : "segmented"
                }
                onClick={() => update({ startupLookMode: m.id as StartupLookMode })}
                aria-pressed={settings.startupLookMode === m.id}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-row settings-row--toggle">
          <span className="settings-row__label">鼠标穿透</span>
          <input className="toggle"
            type="checkbox"
            checked={settings.passthroughMode}
            onChange={(e) => update({ passthroughMode: e.target.checked })}
          />
        </div>
        </section>

        <section className="settings-section">
          <div className="settings-section__heading">
            <span>专注</span><small>保持节奏，减少打扰</small>
          </div>
        <label className="settings-row">
          <span className="settings-row__label">默认专注时长</span>
          <input
            className="settings-number"
            type="number"
            min={1}
            max={600}
            value={settings.focusDefaultMinutes}
            onChange={(e) =>
              update({ focusDefaultMinutes: Math.max(1, Number(e.target.value) || 1) })
            }
          />
          <span className="settings-row__value">分钟</span>
        </label>

        <div className="settings-row settings-row--toggle">
          <span className="settings-row__label">完成后自动休息</span>
          <input className="toggle"
            type="checkbox"
            checked={settings.focusAutoBreak}
            onChange={(e) => update({ focusAutoBreak: e.target.checked })}
          />
        </div>

        <div className="settings-row settings-row--toggle">
          <span className="settings-row__label">显示桌面倒计时</span>
          <input className="toggle"
            type="checkbox"
            checked={settings.focusShowTimer}
            onChange={(e) => update({ focusShowTimer: e.target.checked })}
          />
        </div>
        </section>
      </div>
      <footer className="settings-panel__footer">所有偏好只保存在这台设备上</footer>
    </div>
  );
}
