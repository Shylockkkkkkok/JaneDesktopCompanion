import type {
  ActionPlayState,
  ResolvedCharacterAction,
} from "../types/action";
import { getActionDef, resolveAction } from "../config/characterActions";

/**
 * One-shot action playback state machine (sequence frame ticking, video
 * lifecycle, loop, completion, interrupt rules). Pure playback — priority
 * gating (focus/concert) lives in config/characterActions + the callers;
 * base-state restore is done by the App via onComplete listeners.
 *
 *   sequence: play(id) → tick frames at fps → (loop ? forever : last frame) → complete
 *   video:    play(id) → <video> autoplays in the renderer → "ended" event
 *             → videoEnded() → complete
 *
 * The renderer reports video progress through reportVideoProgress(); the
 * video element itself is never touched by the business layer.
 *
 * Menu clicks on the currently playing action toggle it off (handy for loop
 * actions). A non-interruptible action refuses to be replaced or stopped
 * unless forced (system states / debug).
 */
class ActionPlayer {
  private current: ResolvedCharacterAction | null = null;
  private frame = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private changeListeners = new Set<() => void>();
  private completeListeners = new Set<() => void>();
  private videoPaused = false;
  private nonce = 0;
  private videoTime = { currentTime: 0, duration: 0 };
  private videoSize = { width: 0, height: 0 };

  getState(): ActionPlayState | null {
    const cur = this.current;
    if (!cur) return null;
    const base: ActionPlayState = {
      actionId: cur.def.id,
      kind: cur.kind,
      loop: cur.def.loop,
      interruptible: cur.def.interruptible,
      playing: true,
      frame: this.frame,
      totalFrames: cur.asset.type === "sequence" ? cur.asset.frames.length : 0,
      fps: cur.asset.type === "sequence" ? cur.asset.fps : 0,
      nonce: this.nonce,
    };
    if (cur.kind === "video") {
      base.src = cur.asset.type === "video" ? cur.asset.src : undefined;
      base.currentTime = this.videoTime.currentTime;
      base.duration = this.videoTime.duration;
      base.paused = this.videoPaused;
      base.videoWidth = this.videoSize.width || undefined;
      base.videoHeight = this.videoSize.height || undefined;
    }
    return base;
  }

  getCurrent(): ResolvedCharacterAction | null {
    return this.current;
  }

  /** Is this exact action already on screen? */
  isPlaying(id: string): boolean {
    return this.current?.def.id === id;
  }

  /** Monotonic counter used as the video element's remount key. */
  getVideoNonce(): number {
    return this.nonce;
  }

  /**
   * Play an action by definition id. Returns:
   *   "started"  — playback began
   *   "stopped"  — clicking the playing action toggled it off
   *   "unavailable" — unknown id / no valid asset
   *   "busy"     — current action is not interruptible
   * Gating (focus/concert) is the caller's responsibility.
   */
  play(id: string, opts?: { force?: boolean }): string {
    if (this.isPlaying(id)) {
      if (this.current!.def.interruptible || opts?.force) {
        this.stop(opts?.force ?? false);
        return "stopped";
      }
      return "busy";
    }
    if (this.current && !this.current.def.interruptible && !opts?.force) {
      return "busy";
    }
    const def = getActionDef(id);
    const resolved = def ? resolveAction(def) : null;
    if (!resolved) return "unavailable";

    this.teardownTimer();
    this.current = resolved;
    this.frame = 0;
    this.nonce += 1;
    this.videoPaused = false;
    this.videoTime = { currentTime: 0, duration: 0 };
    this.videoSize = { width: 0, height: 0 };
    if (resolved.kind === "sequence") this.startTimer();
    this.notify();
    return "started";
  }

  /** Stop playback. Non-interruptible actions require force. Fires onComplete. */
  stop(force = false): void {
    if (!this.current) return;
    if (!this.current.def.interruptible && !force) return;
    this.finish();
  }

  /** Replay the current action from the start (video remounts via nonce). */
  restart(): void {
    if (!this.current) return;
    this.frame = 0;
    this.nonce += 1;
    this.videoPaused = false;
    this.videoTime = { currentTime: 0, duration: 0 };
    this.videoSize = { width: 0, height: 0 };
    if (this.current.kind === "sequence") {
      this.teardownTimer();
      this.startTimer();
    }
    this.notify();
  }

  /**
   * Renderer reports the <video> intrinsic size (loadedmetadata). Feeds the
   * compact-window geometry so an action can temporarily widen the window.
   */
  reportVideoSize(width: number, height: number): void {
    if (!this.current || this.current.kind !== "video") return;
    if (this.videoSize.width === width && this.videoSize.height === height) return;
    this.videoSize = { width, height };
    this.notify();
  }

  /** Pause the current video action (no-op for sequences). */
  pauseVideo(): void {
    if (!this.current || this.current.kind !== "video" || this.videoPaused) return;
    this.videoPaused = true;
    this.notify();
  }

  /** Resume the current video action (no-op for sequences). */
  resumeVideo(): void {
    if (!this.current || this.current.kind !== "video" || !this.videoPaused) return;
    this.videoPaused = false;
    this.notify();
  }

  /**
   * Renderer reports <video> playback state. Keeps the debug panel live
   * without exposing the element anywhere else.
   */
  reportVideoProgress(currentTime: number, duration: number, paused: boolean): void {
    if (!this.current || this.current.kind !== "video") return;
    this.videoTime = { currentTime, duration };
    if (paused !== this.videoPaused) {
      this.videoPaused = paused;
    }
    this.notify();
  }

  /**
   * Renderer calls this when the <video> fires "ended" (or errors out —
   * fail-safe so the action can never get stuck). Looping videos just wrap.
   */
  videoEnded(): void {
    if (!this.current || this.current.kind !== "video") return;
    if (this.current.asset.type === "video" && this.current.asset.loop) {
      this.videoTime = { currentTime: 0, duration: this.videoTime.duration };
      return;
    }
    this.finish();
  }

  /** Register a completion/stop callback (App restores base state there). */
  onComplete(fn: () => void): () => void {
    this.completeListeners.add(fn);
    return () => {
      this.completeListeners.delete(fn);
    };
  }

  subscribe(fn: () => void): () => void {
    this.changeListeners.add(fn);
    return () => {
      this.changeListeners.delete(fn);
    };
  }

  /** Advance one sequence frame; exposed for deterministic tests. */
  handleTick(): void {
    if (!this.current || this.current.kind !== "sequence") return;
    const total = this.current.asset.type === "sequence" ? this.current.asset.frames.length : 0;
    if (this.frame >= total - 1) {
      if (this.current.def.loop) {
        this.frame = 0;
      } else {
        this.finish();
        return;
      }
    } else {
      this.frame += 1;
    }
    this.notify();
  }

  // ── internals ────────────────────────────────────────────

  private startTimer(): void {
    const asset = this.current!.asset;
    const fps = asset.type === "sequence" ? asset.fps : 0;
    const count = asset.type === "sequence" ? asset.frames.length : 0;
    if (fps <= 0 || count <= 1) return;
    this.timer = setInterval(() => this.handleTick(), 1000 / fps);
  }

  private teardownTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Tear down playback and notify completion. */
  private finish(): void {
    this.teardownTimer();
    this.current = null;
    this.frame = 0;
    this.videoPaused = false;
    this.videoTime = { currentTime: 0, duration: 0 };
    this.videoSize = { width: 0, height: 0 };
    this.notify();
    for (const fn of this.completeListeners) fn();
  }

  private notify(): void {
    for (const fn of this.changeListeners) fn();
  }
}

export const actionPlayer = new ActionPlayer();
