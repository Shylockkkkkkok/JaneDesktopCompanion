import { useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import type {
  CharacterExpression,
  CharacterReaction,
  CharacterState,
} from "../types/character";
import type { CharacterPose, PhotoAssetMeta } from "../types/photoAsset";
import type { UserActivityState, BehaviorKind } from "../types/behavior";
import { timeContext } from "../infrastructure/TimeContext";
import { userActivity } from "../infrastructure/UserActivityContext";
import { behaviorScheduler } from "../infrastructure/BehaviorScheduler";
import { focusSession } from "../infrastructure/FocusSession";
import { goalsStore } from "../infrastructure/GoalsStore";
import { concertStore } from "../infrastructure/ConcertStore";
import { timelineStore } from "../infrastructure/TimelineStore";
import { CHARACTER_ACTIONS } from "../config/characterActions";
import { dialogueEngine } from "../infrastructure/DialogueEngine";
import { DIALOGUE_REGISTRY } from "../data/dialogues";

interface CharacterDebugPanelProps {
  state: CharacterState;
  expression: CharacterExpression;
  reaction: CharacterReaction;
  pose: CharacterPose;
  lookId: string;
  photo: PhotoAssetMeta | null;
  debugSetState: (s: CharacterState) => void;
  debugSetExpression: (e: CharacterExpression) => void;
  debugSetReaction: (r: CharacterReaction) => void;
  setPose: (p: CharacterPose) => void;
  debugSetLookId: (l: string) => void;
  onClose: () => void;
  /** CharacterAction controls (wired by App). */
  playAction: (id: string) => void;
  stopAction: () => void;
  pauseAction: () => void;
  resumeAction: () => void;
  restartAction: () => void;
  /** Effective scale/offset of the playing video action (null if none). */
  videoActionCalibration: {
    scale: number;
    offsetX: number;
    offsetY: number;
  } | null;
  onVideoCalibration: (patch: { scale?: number; offsetX?: number; offsetY?: number }) => void;
  actionState: import("../types/action").ActionPlayState | null;
}

const STATES: CharacterState[] = [
  "idle",
  "hover",
  "reaction",
  "sitting",
  "focus",
  "tired",
  "sleep",
  "concert",
];

const EXPRESSIONS: CharacterExpression[] = [
  "neutral",
  "softSmile",
  "question",
  "slightlyAnnoyed",
  "tired",
];

const REACTIONS: CharacterReaction[] = ["none", "click", "rapidClick"];

const POSES: CharacterPose[] = ["standing", "sitting", "relaxed", "focus", "concert"];

const TIMES: { label: string; hour: number }[] = [
  { label: "morning", hour: 8 },
  { label: "afternoon", hour: 14 },
  { label: "evening", hour: 19 },
  { label: "night", hour: 0 },
];

const ACTIVITIES: UserActivityState[] = ["active", "temporarilyAway", "longAway"];

const BEHAVIOR_KINDS: BehaviorKind[] = ["idleMotion", "idleSpeak"];

const DIALOGUE_CATEGORIES = Object.keys(DIALOGUE_REGISTRY).sort();

function fmt(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function dateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Dev-only panel for driving State / Expression / Reaction / Pose / lookId,
 * overriding TimeContext + UserActivity, triggering any Behavior, driving
 * Focus state, and inspecting the selected asset + scheduler cooldowns.
 */
export function CharacterDebugPanel({
  state,
  expression,
  reaction,
  pose,
  lookId,
  photo,
  debugSetState,
  debugSetExpression,
  debugSetReaction,
  setPose,
  debugSetLookId,
  onClose,
  playAction,
  stopAction,
  pauseAction,
  resumeAction,
  restartAction,
  videoActionCalibration,
  onVideoCalibration,
  actionState,
}: CharacterDebugPanelProps) {
  const [time, setTime] = useState(timeContext.get());
  const [activity, setActivity] = useState(userActivity.getState());
  const [focusStatus, setFocusStatus] = useState(focusSession.getStatus());
  const [focusRemaining, setFocusRemaining] = useState(focusSession.getRemainingMs());
  const [dlgCategory, setDlgCategory] = useState("idle.general");
  const [dlgResult, setDlgResult] = useState("");
  const [, setTick] = useState(0);

  useEffect(() => {
    setTime(timeContext.get());
    setActivity(userActivity.getState());
    const unsubTime = timeContext.subscribe(() => setTime(timeContext.get()));
    const unsubActivity = userActivity.subscribe(() =>
      setActivity(userActivity.getState()),
    );
    const unsubFocus = focusSession.subscribe(() => {
      setFocusStatus(focusSession.getStatus());
      setFocusRemaining(focusSession.getRemainingMs());
    });
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      unsubTime();
      unsubActivity();
      unsubFocus();
      window.clearInterval(id);
    };
  }, []);

  return (
    <div className="debug-panel">
      <div className="debug-panel__header">
        <span>Debug Panel</span>
        <button type="button" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="debug-panel__section">
        <span className="debug-panel__label">State</span>
        <div className="debug-panel__row">
          {STATES.map((s) => (
            <button
              key={s}
              type="button"
              className={state === s ? "debug-chip debug-chip--active" : "debug-chip"}
              onClick={() => debugSetState(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="debug-panel__section">
        <span className="debug-panel__label">Pose</span>
        <div className="debug-panel__row">
          {POSES.map((p) => (
            <button
              key={p}
              type="button"
              className={pose === p ? "debug-chip debug-chip--active" : "debug-chip"}
              onClick={() => setPose(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="debug-panel__section">
        <span className="debug-panel__label">lookId</span>
        <div className="debug-panel__row">
          <input value={lookId} onChange={(e) => debugSetLookId(e.target.value)} />
        </div>
      </div>

      <div className="debug-panel__section">
        <span className="debug-panel__label">Expression</span>
        <div className="debug-panel__row">
          {EXPRESSIONS.map((e) => (
            <button
              key={e}
              type="button"
              className={expression === e ? "debug-chip debug-chip--active" : "debug-chip"}
              onClick={() => debugSetExpression(e)}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className="debug-panel__section">
        <span className="debug-panel__label">Reaction</span>
        <div className="debug-panel__row">
          {REACTIONS.map((r) => (
            <button
              key={r}
              type="button"
              className={reaction === r ? "debug-chip debug-chip--active" : "debug-chip"}
              onClick={() => debugSetReaction(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="debug-panel__section">
        <span className="debug-panel__label">Asset</span>
        <div className="debug-panel__row">
          {photo ? (
            <>
              <img className="debug-panel__thumb" src={photo.src} alt={photo.id} />
              <span className="debug-chip">{photo.id}</span>
              <span className="debug-chip">scale {photo.scale.toFixed(2)}</span>
              <span className="debug-chip">
                off ({photo.offsetX}, {photo.offsetY})
              </span>
            </>
          ) : (
            <span className="debug-chip">(fallback)</span>
          )}
        </div>
      </div>

      <div className="debug-panel__section">
        <span className="debug-panel__label">
          Focus · {focusStatus}
          {focusStatus !== "idle" ? ` ${fmt(focusRemaining)}` : ""}
        </span>
        <div className="debug-panel__row">
          <button
            type="button"
            className="debug-chip"
            onClick={() => focusSession.setRemaining(10_000)}
          >
            剩10s
          </button>
          <button type="button" className="debug-chip" onClick={() => focusSession.pause()}>
            暂停
          </button>
          <button type="button" className="debug-chip" onClick={() => focusSession.resume()}>
            继续
          </button>
          <button type="button" className="debug-chip" onClick={() => focusSession.finish()}>
            完成
          </button>
          <button type="button" className="debug-chip" onClick={() => focusSession.cancel()}>
            取消
          </button>
        </div>
      </div>

      <div className="debug-panel__section">
        <span className="debug-panel__label">Goals</span>
        <div className="debug-panel__row">
          <button
            type="button"
            className="debug-chip"
            onClick={() =>
              goalsStore.add(`测试目标 ${goalsStore.getTodayGoals().length + 1}`)
            }
          >
            Add Test Goal
          </button>
          <button
            type="button"
            className="debug-chip"
            onClick={() => {
              const incomplete = goalsStore.getTodayGoals().find((g) => !g.completed);
              if (incomplete) {
                goalsStore.setCompleted(incomplete.id, true);
                const after = goalsStore.getTodayGoals();
                void emit("goal-complete", {
                  allComplete: after.length > 0 && after.every((g) => g.completed),
                });
              }
            }}
          >
            Complete Goal
          </button>
          <button
            type="button"
            className="debug-chip"
            onClick={() => {
              const today = goalsStore.getTodayGoals();
              today.forEach((g) => {
                if (!g.completed) goalsStore.setCompleted(g.id, true);
              });
              if (today.length > 0) void emit("goal-complete", { allComplete: true });
            }}
          >
            Complete All
          </button>
          <button
            type="button"
            className="debug-chip"
            onClick={() => goalsStore.removeToday()}
          >
            Reset Today
          </button>
        </div>
      </div>

      <div className="debug-panel__section">
        <span className="debug-panel__label">
          Concert · {concertStore.getContext()}
        </span>
        <div className="debug-panel__row">
          {[
            { label: "T-30", days: 30 },
            { label: "T-7", days: 7 },
            { label: "T-3", days: 3 },
            { label: "T-1", days: 1 },
            { label: "Today", days: 0 },
          ].map((s) => (
            <button
              key={s.label}
              type="button"
              className="debug-chip"
              onClick={() =>
                concertStore.setEvent({ date: dateInDays(s.days), city: "测试城市", note: "" })
              }
            >
              {s.label}
            </button>
          ))}
          <button
            type="button"
            className="debug-chip"
            onClick={() => concertStore.clearEvent()}
          >
            清除
          </button>
        </div>
      </div>

      <div className="debug-panel__section">
        <span className="debug-panel__label">
          Timeline · {timelineStore.getCount()} 条
        </span>
        <div className="debug-panel__row">
          <button
            type="button"
            className="debug-chip"
            onClick={() => {
              const date = dateInDays(-Math.floor(Math.random() * 900) - 1);
              timelineStore.add(date, "测试城市", "concert", "调试记录");
              void emit("timeline-record-added", {});
            }}
          >
            Add Test Timeline Record
          </button>
          <button
            type="button"
            className="debug-chip"
            onClick={() =>
              concertStore.setEvent({
                date: dateInDays(-3),
                city: "过去城市",
                note: "",
              })
            }
          >
            Simulate Past Concert
          </button>
          <button
            type="button"
            className="debug-chip"
            onClick={() => void emit("timeline-record-added", {})}
          >
            Trigger recordAdded
          </button>
        </div>
      </div>

      <div className="debug-panel__section">
        <span className="debug-panel__label">
          Action
          {actionState
            ? actionState.kind === "video"
              ? ` · ${actionState.actionId} ${actionState.currentTime?.toFixed(2) ?? "0"}/${actionState.duration?.toFixed(2) ?? "?"}s${actionState.paused ? " · paused" : " · playing"}${actionState.interruptible ? "" : " · no-interrupt"}`
              : ` · ${actionState.actionId} ${actionState.frame}/${actionState.totalFrames} @${actionState.fps}fps${actionState.interruptible ? "" : " · no-interrupt"}`
            : " · idle"}
        </span>
        <div className="debug-panel__row">
          {CHARACTER_ACTIONS.filter((a) => a.enabled).map((a) => (
            <button
              key={a.id}
              type="button"
              className="debug-chip"
              onClick={() => playAction(a.id)}
            >
              ▶ {a.label}
            </button>
          ))}
          <button type="button" className="debug-chip" onClick={stopAction}>
            ■ Stop
          </button>
        </div>
        {actionState?.kind === "video" && (
          <div className="debug-panel__row">
            <button type="button" className="debug-chip" onClick={pauseAction}>
              ⏸ Pause
            </button>
            <button type="button" className="debug-chip" onClick={resumeAction}>
              ▶ Resume
            </button>
            <button type="button" className="debug-chip" onClick={restartAction}>
              ↻ Restart
            </button>
            <span className="debug-chip">rate ×1</span>
          </div>
        )}
        {actionState?.kind === "video" && videoActionCalibration && (
          <div className="debug-panel__row debug-panel__row--col">
            <label className="debug-slider">
              scale {videoActionCalibration.scale.toFixed(2)}
              <input
                type="range"
                min={0.3}
                max={2}
                step={0.01}
                value={videoActionCalibration.scale}
                onChange={(e) => onVideoCalibration({ scale: Number(e.target.value) })}
              />
            </label>
            <label className="debug-slider">
              offsetX {videoActionCalibration.offsetX.toFixed(0)}
              <input
                type="range"
                min={-200}
                max={200}
                step={1}
                value={videoActionCalibration.offsetX}
                onChange={(e) => onVideoCalibration({ offsetX: Number(e.target.value) })}
              />
            </label>
            <label className="debug-slider">
              offsetY {videoActionCalibration.offsetY.toFixed(0)}
              <input
                type="range"
                min={-200}
                max={200}
                step={1}
                value={videoActionCalibration.offsetY}
                onChange={(e) => onVideoCalibration({ offsetY: Number(e.target.value) })}
              />
            </label>
          </div>
        )}
      </div>

      <div className="debug-panel__section">
        <span className="debug-panel__label">TimeContext · {time.timeOfDay}</span>
        <div className="debug-panel__row">
          {TIMES.map((t) => (
            <button
              key={t.label}
              type="button"
              className="debug-chip"
              onClick={() => timeContext.setOverrideHour(t.hour)}
            >
              {t.label}
            </button>
          ))}
          <button type="button" className="debug-chip" onClick={() => timeContext.setOverride(null)}>
            real
          </button>
        </div>
      </div>

      <div className="debug-panel__section">
        <span className="debug-panel__label">Activity · {activity}</span>
        <div className="debug-panel__row">
          {ACTIVITIES.map((a) => (
            <button
              key={a}
              type="button"
              className={activity === a ? "debug-chip debug-chip--active" : "debug-chip"}
              onClick={() => userActivity.setOverride(a)}
            >
              {a}
            </button>
          ))}
          <button
            type="button"
            className="debug-chip"
            onClick={() => userActivity.setOverride(null)}
          >
            auto
          </button>
        </div>
      </div>

      <div className="debug-panel__section">
        <span className="debug-panel__label">Behaviors · trigger / cooldown</span>
        <div className="debug-panel__row">
          {BEHAVIOR_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              className="debug-chip"
              onClick={() => behaviorScheduler.trigger(k)}
            >
              {k} · {Math.round(behaviorScheduler.getCooldownRemaining(k) / 1000)}s
            </button>
          ))}
        </div>
      </div>

      <div className="debug-panel__section">
        <span className="debug-panel__label">Dialogue</span>
        <div className="debug-panel__row">
          <select value={dlgCategory} onChange={(e) => setDlgCategory(e.target.value)}>
            {DIALOGUE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="debug-chip"
            onClick={() => {
              const text = dialogueEngine.request(dlgCategory);
              setDlgResult(text ?? "(suppressed / cooldown)");
              setTick((t) => t + 1);
            }}
          >
            Trigger
          </button>
        </div>
        <div className="debug-panel__row">
          <button
            type="button"
            className="debug-chip"
            onClick={() => dialogueEngine.resetCooldowns()}
          >
            Reset Cooldown
          </button>
          <button
            type="button"
            className="debug-chip"
            onClick={() => dialogueEngine.clearRecent()}
          >
            Clear Recent
          </button>
        </div>
        {dlgResult && (
          <div className="debug-panel__row">
            <span className="debug-chip">{dlgResult}</span>
          </div>
        )}
        <div className="debug-panel__row">
          {(() => {
            const last = dialogueEngine.getLastPicked();
            return (
              <span className="debug-chip">
                {last
                  ? `${last.id} · ${last.tone} · w${last.weight} · cd ${Math.round(
                      dialogueEngine.getCooldownRemaining(last.category) / 1000,
                    )}s`
                  : "last: —"}
              </span>
            );
          })()}
        </div>
        <div className="debug-panel__row">
          <span className="debug-chip">
            recent: {dialogueEngine.getRecentIds().slice(-5).join(", ") || "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
