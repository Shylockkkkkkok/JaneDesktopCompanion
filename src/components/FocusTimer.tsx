import type { FocusStatus } from "../types/focus";

interface FocusTimerProps {
  status: FocusStatus;
  remainingMs: number;
  hidden: boolean;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onToggleHide: () => void;
}

function format(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Lightweight desktop countdown shown near Jane — not a big pomodoro window.
 * Can be collapsed to a tiny pill (focus continues in the background).
 */
export function FocusTimer({
  status,
  remainingMs,
  hidden,
  onPause,
  onResume,
  onCancel,
  onToggleHide,
}: FocusTimerProps) {
  if (hidden) {
    return (
      <button
        className="focus-timer focus-timer--hidden"
        type="button"
        title="显示计时器"
        onClick={onToggleHide}
      >
        {format(remainingMs)}
      </button>
    );
  }

  return (
    <div className="focus-timer">
      <span className="focus-timer__time">{format(remainingMs)}</span>
      <div className="focus-timer__controls">
        {status === "running" ? (
          <button type="button" onClick={onPause}>
            暂停
          </button>
        ) : (
          <button type="button" onClick={onResume}>
            继续
          </button>
        )}
        <button type="button" onClick={onCancel}>
          取消
        </button>
        <button type="button" onClick={onToggleHide}>
          隐藏
        </button>
      </div>
    </div>
  );
}
