import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { CharacterRoot } from "./components/character/CharacterRoot";
import { CharacterDebugPanel } from "./components/CharacterDebugPanel";
import { AssetLab } from "./components/AssetLab";
import { FocusTimer } from "./components/FocusTimer";
import { FocusSetup } from "./components/FocusSetup";
import { FocusCompletePopup } from "./components/FocusCompletePopup";
import focusCompleteImage from "../focus/focus_com.png";
import { JaneContextMenu } from "./components/JaneContextMenu";
import { dialogueEngine } from "./infrastructure/DialogueEngine";
import { timeContext } from "./infrastructure/TimeContext";
import { userActivity } from "./infrastructure/UserActivityContext";
import {
  collectProactiveDialogueCandidates,
} from "./infrastructure/ProactiveDialogueResolver";
import { PROACTIVE_CONFIG } from "./config/dialogue";
import { useCharacterController } from "./hooks/useCharacterController";
import { useAssetSelection } from "./hooks/useAssetSelection";
import { useDialogue } from "./hooks/useDialogue";
import { behaviorScheduler } from "./infrastructure/BehaviorScheduler";
import { actionPlayer } from "./infrastructure/ActionPlayer";
import { actionVideoCalibration, calibrationDefaults } from "./infrastructure/ActionVideoCalibration";
import {
  boundsAlmostEqual,
  clampVerticalOffset,
  contentRectInWindow,
  layoutCompactWindow,
  placeBubbleWindow,
  CHARACTER_WINDOW_MARGINS,
} from "./infrastructure/windowBounds";
import type { BubbleSide, PhysicalBounds } from "./infrastructure/windowBounds";
import { photoGeometry, FULL_CONTENT } from "./config/photoContentBoxes";
import type { ContentBox } from "./config/photoContentBoxes";
import { focusSession } from "./infrastructure/FocusSession";
import { focusHistory } from "./infrastructure/FocusHistory";
import { concertStore } from "./infrastructure/ConcertStore";
import { assetLibrary } from "./infrastructure/AssetLibrary";
import { lookSwitcher } from "./infrastructure/LookSwitcherStore";
import { pickAnotherAsset, validBaseAsset, pickRandomOfPose, POSE_LABELS, NORMAL_POSES } from "./config/looks";
import { isActionAllowed, getActionDef, getActionVideoSpec } from "./config/characterActions";
import { loadSettings } from "./services/settings";
import {
  getCurrentMonitorBounds,
  getCurrentPosition,
  getCurrentSize,
  onWindowMoved,
  savePosition,
  setCharacterBounds,
} from "./services/window";
import { CHARACTER_CONFIG } from "./config/character";
import { FOCUS_CONFIG } from "./config/focus";
import type { AppSettings, IdleState, Position } from "./types/character";
import type { FocusSessionEnd } from "./types/focus";
import type { CharacterActionView } from "./types/action";
import type { MonitorBounds } from "./services/window";
import type { CharacterPose } from "./types/photoAsset";

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

const POSITION_SAVE_DEBOUNCE_MS = 400;

/** Speech bubble overlay window size, logical px (mirrors tauri.conf.json). */
const BUBBLE_WINDOW_WIDTH = 380;
const BUBBLE_WINDOW_HEIGHT = 300;

/**
 * Minimum window size while the right-click context menu is open: the menu
 * root + its widest submenu must fit inside the window (they render in it).
 * Bottom edge stays fixed, so Jane herself never moves during expansion.
 */
const CONTEXT_MENU_WINDOW_MIN = { width: 300, height: 296 };

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(FALLBACK_SETTINGS);
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [windowPosition, setWindowPosition] = useState<Position | null>(null);
  const [monitorBounds, setMonitorBounds] = useState<MonitorBounds | null>(null);
  const [idle, setIdle] = useState<IdleState>({ motion: null, nonce: 0 });
  const [showDebug, setShowDebug] = useState(true);
  const [showAssetLab, setShowAssetLab] = useState(false);
  const [focusStatus, setFocusStatus] = useState(focusSession.getStatus());
  const [focusRemaining, setFocusRemaining] = useState(focusSession.getRemainingMs());
  const [focusTimerHidden, setFocusTimerHidden] = useState(false);
  const [focusSetupOpen, setFocusSetupOpen] = useState(false);
  const [focusCompleteOpen, setFocusCompleteOpen] = useState(false);
  // Look Switcher: snapshot version to re-render on base/lock/favorite changes.
  const [lookVersion, setLookVersion] = useState(0);
  // CharacterAction playback snapshot (renderer + debug panel).
  const [actionState, setActionState] = useState(actionPlayer.getState());
  // Video action calibration version (live scale/offset tuning).
  const [actionCalVersion, setActionCalVersion] = useState(
    actionVideoCalibration.getVersion(),
  );
  /** Context menu open → temporarily widen the window so submenus fit. */
  const [menuOpen, setMenuOpen] = useState(false);
  /** Focus-complete reward: the character temporarily shows focus_com.png. */
  const [completionPhotoActive, setCompletionPhotoActive] = useState(false);

  const {
    state,
    expression,
    reaction,
    reactionNonce,
    pose,
    lookId,
    setHover,
    registerClick,
    triggerReaction,
    debugSetState,
    debugSetExpression,
    debugSetReaction,
    setPose,
    setLookId,
  } = useCharacterController();
  const { bubble, showBubble, maybeHoverSay, maybeClickSay, sayRapid } =
    useDialogue(settings.dialogueFrequency);

  // ── Look Switcher: base asset ─────────
  // The base selection (LookSwitcherStore) pins the displayed asset. During a
  // focus session the user may switch within the 专注 pool — the base asset is
  // honored there too (pick() still requires category === pose).
  const preferredAssetId = lookSwitcher.getBaseAssetId();
  const selectedPhoto = useAssetSelection(pose, lookId, preferredAssetId);
  // Rendering + window layout must agree on the vertical offset: a positive
  // calibration beyond the canvas's bottom padding would push the feet out
  // of the window, so the effective offset is clamped (see clampVerticalOffset).
  const photo = useMemo(() => {
    if (!selectedPhoto) return null;
    const geom = photoGeometry(selectedPhoto.id);
    const imgH = CHARACTER_CONFIG.defaultHeight * settings.characterScale * selectedPhoto.scale;
    return {
      ...selectedPhoto,
      offsetY: clampVerticalOffset(
        selectedPhoto.offsetY,
        imgH,
        geom.contentBox,
        CHARACTER_WINDOW_MARGINS.bottom,
      ),
    };
  }, [selectedPhoto, settings.characterScale]);

  const saveDebounceRef = useRef<number | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const idleClearTimerRef = useRef<number | null>(null);
  const focusCompleteTimerRef = useRef<number | null>(null);
  /** Current character window bounds (physical) — kept in sync for geometry. */
  const windowBoundsRef = useRef<PhysicalBounds | null>(null);
  /** Screen anchor = visible content's bottom-center. Stored, never re-derived. */
  const anchorRef = useRef<{ x: number; y: number } | null>(null);
  /** Until this timestamp, window moves are our own resizes, not drags. */
  const programmaticMoveUntilRef = useRef(0);
  /** A bubble is on screen — proactive dialogue must not stack on it. */
  const bubbleActiveRef = useRef(false);

  useEffect(() => {
    bubbleActiveRef.current = bubble !== null;
  }, [bubble]);

  // ── callbacks ────────────────────────────────────────────

  const showToast = useCallback((text: string) => {
    setStatusToast(text);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(
      () => setStatusToast(null),
      CHARACTER_CONFIG.statusToastDuration,
    );
  }, []);

  const handleHoverStart = useCallback(() => {
    setHover(true);
    behaviorScheduler.interrupt();
    if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(() => {
      maybeHoverSay();
    }, CHARACTER_CONFIG.hoverDialogueDelay);
  }, [setHover, maybeHoverSay]);

  const handleHoverEnd = useCallback(() => {
    setHover(false);
    if (hoverTimerRef.current !== null) window.clearTimeout(hoverTimerRef.current);
  }, [setHover]);

  const handleClick = useCallback(() => {
    behaviorScheduler.interrupt();
    // Reaction (priority 4) preempts any running idle animation (priority 1).
    setIdle({ motion: null, nonce: 0 });
    if (idleClearTimerRef.current !== null)
      window.clearTimeout(idleClearTimerRef.current);

    const rapidLevel = registerClick();
    triggerReaction(rapidLevel >= 2 ? "rapidClick" : "click");

    if (focusSession.isActive()) {
      // During focus, clicks only get a restrained activeClick line.
      const text = dialogueEngine.request("focus.activeClick");
      if (text) showBubble(text);
    } else if (rapidLevel === 1) {
      maybeClickSay();
    } else {
      sayRapid(rapidLevel);
    }
  }, [registerClick, triggerReaction, maybeClickSay, sayRapid, showBubble]);

  const startFocus = useCallback(
    (durationMs: number) => {
      // System state switch outranks a playing action.
      actionPlayer.stop(true);
      // §13 cleanup: kill any pending focus-complete sequence from a previous
      // session so a stale timer can never fire mid-focus.
      if (focusCompleteTimerRef.current !== null) {
        window.clearTimeout(focusCompleteTimerRef.current);
        focusCompleteTimerRef.current = null;
      }
      setCompletionPhotoActive(false);
      setFocusCompleteOpen(false);
      focusSession.start(durationMs);
      setPose("focus");
      behaviorScheduler.stop();
      setFocusTimerHidden(false);
      const text = dialogueEngine.request("focus.start");
      if (text) showBubble(text);
    },
    [setPose, showBubble],
  );

  const applyBasePose = useCallback(() => {
    if (focusSession.isActive()) return;
    // Restore the user's base asset (Look Switcher), or auto-pick.
    const baseId = validBaseAsset(lookSwitcher.getBaseAssetId(), assetLibrary.getAll());
    const base = baseId ? assetLibrary.getById(baseId) : null;
    if (base) {
      setPose(base.category);
      setLookId(base.lookId);
    } else {
      setPose("standing");
      setLookId("default");
    }
  }, [setPose, setLookId]);

  /**
   * End of the Focus Complete visual (§6–8, §12): pick a RANDOM normal pose
   * — not the pre-focus look — respecting look lock (locked → random within
   * the current look), then resume the behavior scheduler.
   */
  const finishFocusComplete = useCallback(() => {
    setCompletionPhotoActive(false);
    const all = assetLibrary.getAll();
    const baseId = validBaseAsset(lookSwitcher.getBaseAssetId(), all);
    const base = baseId ? assetLibrary.getById(baseId) : null;
    let category: CharacterPose;
    if (lookSwitcher.isLocked() && base) {
      // Locked → random pose WITHIN the current look (same category).
      category = base.category;
    } else {
      const normalCats = NORMAL_POSES.filter((p) => assetLibrary.hasEnabled(p));
      category =
        normalCats.length > 0
          ? normalCats[Math.floor(Math.random() * normalCats.length)]
          : "standing";
    }
    const id = pickRandomOfPose(category, all);
    if (id) {
      const asset = assetLibrary.getById(id);
      if (asset) {
        lookSwitcher.setBaseAsset(id);
        setPose(asset.category);
        setLookId(asset.lookId);
        behaviorScheduler.start();
        return;
      }
    }
    applyBasePose();
    behaviorScheduler.start();
  }, [setPose, setLookId]);

  const handleFocusEnd = useCallback(
    (result: FocusSessionEnd) => {
      focusHistory.add({
        startTime: result.startTime,
        endTime: Date.now(),
        plannedDurationMs: result.plannedDurationMs,
        actualDurationMs: result.actualDurationMs,
        completed: result.completed,
      });
      if (result.completed) {
        // §2–§5 Focus Complete visual: the focus look stays while the popup
        // shows, then focus_com.png becomes the EXCLUSIVE character visual
        // for 3s (scheduler stays stopped, no pose dwell) — then a random
        // normal pose. One-shot per session; timers cleaned up in startFocus.
        triggerReaction("click");
        const text = dialogueEngine.request("focus.complete");
        if (text) showBubble(text);
        setFocusCompleteOpen(true);
        if (focusCompleteTimerRef.current !== null)
          window.clearTimeout(focusCompleteTimerRef.current);
        focusCompleteTimerRef.current = window.setTimeout(() => {
          setFocusCompleteOpen(false);
          setCompletionPhotoActive(true);
          focusCompleteTimerRef.current = window.setTimeout(() => {
            focusCompleteTimerRef.current = null;
            finishFocusComplete();
          }, FOCUS_CONFIG.completionPhotoMs);
        }, FOCUS_CONFIG.completionPopupMs);
      } else {
        // §14 Cancelled — no focus_com, restore immediately.
        applyBasePose();
        behaviorScheduler.start();
      }
    },
    [applyBasePose, finishFocusComplete, triggerReaction, showBubble],
  );

  const startFocusFromSetup = useCallback(
    (minutes: number) => {
      setFocusSetupOpen(false);
      startFocus(minutes * 60_000);
    },
    [startFocus],
  );

  const handlePauseFocus = useCallback(() => {
    focusSession.pause();
  }, []);

  // ── effects ──────────────────────────────────────────────

  useEffect(() => {
    loadSettings()
      .then(setSettings)
      .catch(() => {
        /* keep fallback defaults */
      });
  }, []);

  // ── Look Switcher effects ─────────────────────────────────

  // React to store changes (base/lock/favorites).
  useEffect(() => {
    const unsubLook = lookSwitcher.subscribe(() => setLookVersion((v) => v + 1));
    return () => {
      unsubLook();
    };
  }, []);

  // Startup look: keepLast / randomFavorite / randomDaily. Invalid ids fall
  // back gracefully — startup must never fail because of a stale asset.
  useEffect(() => {
    lookSwitcher.applyStartup(settings.startupLookMode, assetLibrary.getAll());
    setLookVersion((v) => v + 1);
  }, [settings.startupLookMode]);

  // Keep pose/lookId aligned with the base asset whenever it is valid; if the
  // persisted base was removed or disabled, fall back to an available Daily
  // asset (this is the fallback path for keepLast startup too).
  useEffect(() => {
    if (focusSession.isActive()) return;
    const all = assetLibrary.getAll();
    const raw = lookSwitcher.getBaseAssetId();
    const valid = validBaseAsset(raw, all);
    if (valid && raw === valid) {
      const base = assetLibrary.getById(valid);
      if (base) {
        setPose(base.category);
        setLookId(base.lookId);
      }
      return;
    }
    if (raw && !valid) {
      const normal = all.filter(
        (a) => a.enabled && NORMAL_POSES.includes(a.category),
      );
      const daily = normal.filter((a) => a.category === "standing");
      const pool = daily.length > 0 ? daily : normal;
      if (pool.length > 0) {
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        lookSwitcher.setBaseAsset(chosen.id);
        setPose(chosen.category);
        setLookId(chosen.lookId);
      } else {
        lookSwitcher.setBaseAsset(null);
        setPose("standing");
        setLookId("default");
      }
    }
  }, [lookVersion, settings.startupLookMode, setPose, setLookId]);

  // "换一个" — pick a different normal-pool asset (never the current one).
  // During a focus session it rotates within the 专注 pool instead and applies
  // immediately.
  const handleLookNext = useCallback(() => {
    const all = assetLibrary.getAll();
    const current = focusSession.isActive()
      ? photo?.id ?? null
      : lookSwitcher.getBaseAssetId() ?? photo?.id ?? null;
    if (focusSession.isActive()) {
      const pool = all.filter(
        (a) => a.enabled && a.category === "focus" && a.id !== current,
      );
      if (pool.length === 0) {
        showToast("专注分类下没有其他可用的造型");
        return;
      }
      const chosen = pool[Math.floor(Math.random() * pool.length)];
      lookSwitcher.setBaseAsset(chosen.id);
      setPose("focus");
      setLookId(chosen.lookId);
      return;
    }
    const nextId = pickAnotherAsset(current, all);
    if (!nextId) {
      showToast("没有其他可用的造型");
      return;
    }
    const asset = assetLibrary.getById(nextId);
    if (!asset) return;
    lookSwitcher.setBaseAsset(nextId);
    setPose(asset.category);
    setLookId(asset.lookId);
  }, [photo, setPose, setLookId, showToast]);

  // Tray / right-click menu events for the Look Switcher.
  useEffect(() => {
    let unNext: (() => void) | undefined;
    let unLock: (() => void) | undefined;
    let unChanged: (() => void) | undefined;
    let unPose: (() => void) | undefined;
    let mounted = true;

    listen("look-next", () => {
      if (mounted) handleLookNext();
    }).then((fn) => {
      if (mounted) unNext = fn;
    });

    listen("look-lock-toggle", () => {
      if (!mounted) return;
      const next = !lookSwitcher.isLocked();
      if (next && !lookSwitcher.getBaseAssetId()) {
        // Locking without an explicit choice pins whatever is on screen now.
        lookSwitcher.setBaseAsset(photo?.id ?? null);
      }
      lookSwitcher.setLocked(next);
      showToast(next ? "已锁定当前造型" : "已解锁造型");
    }).then((fn) => {
      if (mounted) unLock = fn;
    });

    // From the look pose tabs (tray submenu / right-click submenu): pick a
    // random asset of that pose and switch immediately. Toast instead of a
    // picker window — no extra popup.
    listen<{ pose: string }>("look-pose", (event) => {
      if (!mounted) return;
      const pose = event.payload.pose as Parameters<typeof pickRandomOfPose>[0];
      const id = pickRandomOfPose(pose, assetLibrary.getAll());
      if (!id) {
        showToast("该分类下暂时没有可用的素材");
        return;
      }
      const asset = assetLibrary.getById(id);
      if (!asset) return;
      lookSwitcher.setBaseAsset(id);
      if (focusSession.isActive()) {
        // During focus only the 专注 pool changes what is on screen; other
        // tabs just prepare the post-focus base.
        if (pose === "focus") {
          setPose("focus");
          setLookId(asset.lookId);
          showToast(`已换${POSE_LABELS.focus}造型`);
        } else {
          showToast(`${POSE_LABELS[asset.category]}造型将在专注结束后生效`);
        }
        return;
      }
      setPose(asset.category);
      setLookId(asset.lookId);
      showToast(`已换${POSE_LABELS[asset.category]}造型`);
    }).then((fn) => {
      if (mounted) unPose = fn;
    });

    // From Asset Lab "Set as Current": set the base asset directly.
    listen<{ assetId: string }>("look-changed", (event) => {
      if (!mounted) return;
      const asset = assetLibrary.getById(event.payload.assetId);
      if (!asset || !asset.enabled) return;
      lookSwitcher.setBaseAsset(asset.id);
      if (!focusSession.isActive()) {
        setPose(asset.category);
        setLookId(asset.lookId);
      }
    }).then((fn) => {
      if (mounted) unChanged = fn;
    });

    return () => {
      mounted = false;
      unNext?.();
      unLock?.();
      unPose?.();
      unChanged?.();
    };
  }, [handleLookNext, photo, setPose, setLookId, showToast]);

  useEffect(() => {
    Promise.all([getCurrentPosition(), getCurrentSize()])
      .then(([pos, size]) => {
        setWindowPosition(pos);
        windowBoundsRef.current = {
          x: pos.x,
          y: pos.y,
          width: size.width,
          height: size.height,
        };
      })
      .catch(() => {});
    getCurrentMonitorBounds().then(setMonitorBounds).catch(() => {});
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let mounted = true;

    onWindowMoved((pos) => {
      if (!mounted) return;
      const prevBounds = windowBoundsRef.current;
      setWindowPosition(pos);
      if (prevBounds) {
        windowBoundsRef.current = { ...prevBounds, x: pos.x, y: pos.y };
      }
      // Programmatic resizes also emit Moved — they are not drags and must
      // not stop a playing action (the bounds command persists already).
      const programmatic = Date.now() < programmaticMoveUntilRef.current;
      if (!programmatic) {
        // A drag moves the whole window — the content anchor moves with it.
        if (anchorRef.current && prevBounds) {
          anchorRef.current.x += pos.x - prevBounds.x;
          anchorRef.current.y += pos.y - prevBounds.y;
        }
        // Drag outranks a playing action — stop it without restoring old pose.
        actionPlayer.stop(true);
        if (saveDebounceRef.current !== null)
          window.clearTimeout(saveDebounceRef.current);
        saveDebounceRef.current = window.setTimeout(() => {
          savePosition(pos.x, pos.y).catch(() => {});
        }, POSITION_SAVE_DEBOUNCE_MS);
      }
      // The active monitor can change while dragging across displays. Keep
      // bubble placement based on the monitor JANE is actually on.
      getCurrentMonitorBounds().then(setMonitorBounds).catch(() => {});
    }).then((fn) => {
      if (mounted) unlisten = fn;
    });

    return () => {
      mounted = false;
      unlisten?.();
      if (saveDebounceRef.current !== null)
        window.clearTimeout(saveDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    let unMode: (() => void) | undefined;
    let unSettingsChanged: (() => void) | undefined;
    let mounted = true;

    listen<{ passthrough: boolean }>("mode-changed", (event) => {
      if (!mounted) return;
      setSettings((prev) => ({ ...prev, passthroughMode: event.payload.passthrough }));
      showToast(event.payload.passthrough ? "鼠标穿透" : "互动模式");
    }).then((fn) => {
      if (mounted) unMode = fn;
    });

    listen<AppSettings>("settings-changed", (event) => {
      if (!mounted) return;
      setSettings(event.payload);
    }).then((fn) => {
      if (mounted) unSettingsChanged = fn;
    });

    return () => {
      mounted = false;
      unMode?.();
      unSettingsChanged?.();
    };
  }, [showToast]);

  // ── Proactive dialogue (single entry point) ──────────────
  // Collects ordered candidates (return > long-work > time > idle > rare
  // tier) and requests them through DialogueEngine — focus suppression,
  // cooldowns, recent-line dedup and tone avoidance all live there. At most
  // ONE line per cycle; quiet gates: focus / action playing / bubble visible.
  const runProactiveDialogue = useCallback(
    (returnAwayMs: number | null) => {
      if (focusSession.isActive()) return; // § focus silences all proactive pools
      if (completionPhotoActive) return; // § focus-complete visual: only focus.complete speaks
      if (actionPlayer.getState()) return; // § a user-triggered action outranks chatter
      if (bubbleActiveRef.current) return; // § never stack on a visible bubble
      const candidates = collectProactiveDialogueCandidates({
        hour: timeContext.get().hour,
        timeOfDay: timeContext.get().timeOfDay,
        returnAwayMs,
        continuousActiveMs: userActivity.getContinuousActiveMs(),
        longWorkNudged: userActivity.isLongWorkNudged(),
        hasFutureMeeting: concertStore.hasUpcomingMeeting(),
      });
      for (const candidate of candidates) {
        // Return lines fire on ~25% of transitions only; long-work ~35%.
        if (
          candidate.reason === "activity-return" &&
          Math.random() > PROACTIVE_CONFIG.returnChance
        ) {
          return; // transition consumed, Jane stays quiet
        }
        if (
          candidate.reason === "activity-long-work" &&
          Math.random() > PROACTIVE_CONFIG.longWorkChance
        ) {
          continue;
        }
        const text = dialogueEngine.request(
          candidate.key,
          dialogueEngine.getContext(),
        );
        if (!text) continue; // cooling down / suppressed → next tier
        if (candidate.reason === "activity-long-work") {
          userActivity.markLongWorkNudged();
        }
        showBubble(text);
        return; // one line per cycle — never cascade
      }
    },
    [showBubble, completionPhotoActive],
  );

  // Drive idle motion + idle speech from the behavior scheduler.
  useEffect(() => {
    const unsub = behaviorScheduler.subscribe((event) => {
      if (event.kind === "idleMotion" && event.motion) {
        if (!settings.idleAnimationEnabled) return;
        setIdle({ motion: event.motion, nonce: Date.now() });
        if (idleClearTimerRef.current !== null)
          window.clearTimeout(idleClearTimerRef.current);
        idleClearTimerRef.current = window.setTimeout(() => {
          setIdle({ motion: null, nonce: 0 });
        }, event.durationMs ?? 1500);
      } else if (event.kind === "idleSpeak") {
        runProactiveDialogue(null);
      } else if (event.kind === "concert") {
        const key = concertStore.getDialogueKey();
        if (key) {
          const text = dialogueEngine.request(key);
          if (text) showBubble(text);
        }
      }
    });

    behaviorScheduler.start();

    return () => {
      unsub();
      behaviorScheduler.stop();
      if (idleClearTimerRef.current !== null)
        window.clearTimeout(idleClearTimerRef.current);
    };
  }, [runProactiveDialogue, settings.idleAnimationEnabled]);

  // Away→active return transitions (one-shot, consumed on read).
  useEffect(() => {
    const unsub = userActivity.subscribe(() => {
      const returnEvent = userActivity.consumeReturn();
      if (returnEvent) runProactiveDialogue(returnEvent.awayMs);
    });
    return unsub;
  }, [runProactiveDialogue]);

  // Focus session state + end handling.
  useEffect(() => {
    const unsub = focusSession.subscribe(() => {
      setFocusStatus(focusSession.getStatus());
      setFocusRemaining(focusSession.getRemainingMs());
    });
    const unsubEnd = focusSession.onSessionEnd(handleFocusEnd);
    return () => {
      unsub();
      unsubEnd();
    };
  }, [handleFocusEnd]);

  // Tray "陪我专注" → start a focus session.
  useEffect(() => {
    let un: (() => void) | undefined;
    let mounted = true;
    listen<{ durationMs: number }>("focus-start", (event) => {
      if (!mounted) return;
      const ms = event.payload.durationMs;
      if (ms > 0) {
        startFocus(ms);
      } else {
        // "自定义…" → open the custom-duration input.
        setFocusSetupOpen(true);
      }
    }).then((fn) => {
      if (mounted) un = fn;
    });
    return () => {
      mounted = false;
      un?.();
    };
  }, [startFocus, settings.focusDefaultMinutes]);

  // Goal completion → reaction + line (emitted from the goals window).
  useEffect(() => {
    let un: (() => void) | undefined;
    let mounted = true;
    listen<{ allComplete: boolean }>("goal-complete", (event) => {
      if (!mounted) return;
      if (event.payload.allComplete) {
        triggerReaction("allGoalsComplete");
        const text = dialogueEngine.request("goals.completeAll");
        if (text) showBubble(text);
      } else {
        triggerReaction("goalComplete");
        const text = dialogueEngine.request("goals.completeOne");
        if (text) showBubble(text);
      }
    }).then((fn) => {
      if (mounted) un = fn;
    });
    return () => {
      mounted = false;
      un?.();
    };
  }, [triggerReaction, showBubble]);

  // Timeline: a new "I saw Jane" record was saved (emitted from the timeline
  // window) → one light reaction + a line from the dialogue engine.
  useEffect(() => {
    let un: (() => void) | undefined;
    let mounted = true;
    listen("timeline-record-added", () => {
      if (!mounted) return;
      triggerReaction("click");
      const text = dialogueEngine.request(
        "timeline.recordAdded",
        dialogueEngine.getContext(),
      );
      if (text) showBubble(text);
    }).then((fn) => {
      if (mounted) un = fn;
    });
    return () => {
      mounted = false;
      un?.();
    };
  }, [triggerReaction, showBubble]);

  // Restore the base look on mount.
  useEffect(() => {
    applyBasePose();
  }, [applyBasePose]);

  // ── CharacterAction playback ──────────────────────────────

  // User-triggered action: pauses scheduled behaviors, plays the sequence,
  // then restores the pre-action state (onComplete) and the scheduler.
  const playCharacterAction = useCallback(
    (actionId: string) => {
      const def = getActionDef(actionId);
      if (!def) return;
      if (completionPhotoActive) {
        // §11 the focus-complete reward visual is exclusive for 3s.
        showToast("等一下下，马上好~");
        return;
      }
      const gate = { focus: focusSession.isActive() };
      if (!isActionAllowed(def, gate)) {
        showToast("专注期间先专心吧");
        return;
      }
      const result = actionPlayer.play(actionId);
      if (result === "started") {
        // Action outranks scheduled behavior.
        behaviorScheduler.stop();
        setIdle({ motion: null, nonce: 0 });
      } else if (result === "stopped") {
        // Toggle-off still restores via onComplete (already fired).
      } else if (result === "busy") {
        showToast("当前动作不能被打断");
      } else if (result === "unavailable") {
        showToast("这个动作的素材还没有准备好");
      }
    },
    [showToast, setIdle, completionPhotoActive],
  );

  // Restore base state + scheduler whenever an action finishes or is stopped.
  useEffect(() => {
    const unsubComplete = actionPlayer.onComplete(() => {
      applyBasePose();
      behaviorScheduler.start();
    });
    const unsubChange = actionPlayer.subscribe(() =>
      setActionState(actionPlayer.getState()),
    );
    return () => {
      unsubComplete();
      unsubChange();
    };
  }, [applyBasePose]);

  // Live video-action calibration → re-render (the playing video follows).
  useEffect(() => actionVideoCalibration.subscribe(() => setActionCalVersion(actionVideoCalibration.getVersion())), []);

  // Video action lifecycle callbacks (the <video> element lives in the renderer).
  const handleActionVideoEnded = useCallback(() => {
    actionPlayer.videoEnded();
  }, []);

  const handleActionVideoProgress = useCallback(
    (currentTime: number, duration: number, paused: boolean) => {
      actionPlayer.reportVideoProgress(currentTime, duration, paused);
    },
    [],
  );

  const handleActionVideoSize = useCallback((width: number, height: number) => {
    actionPlayer.reportVideoSize(width, height);
  }, []);

  const pauseCharacterAction = useCallback(() => {
    actionPlayer.pauseVideo();
  }, []);

  const resumeCharacterAction = useCallback(() => {
    actionPlayer.resumeVideo();
  }, []);

  const restartCharacterAction = useCallback(() => {
    actionPlayer.restart();
  }, []);

  const stopCharacterAction = useCallback(() => {
    actionPlayer.stop(true);
  }, []);

  // Right-click menu / tray "动作" entries (generated from the manifest).
  useEffect(() => {
    let un: (() => void) | undefined;
    let mounted = true;
    listen<{ actionId: string }>("action-play", (event) => {
      if (!mounted) return;
      playCharacterAction(event.payload.actionId);
    }).then((fn) => {
      if (mounted) un = fn;
    });
    return () => {
      mounted = false;
      un?.();
    };
  }, [playCharacterAction]);

  // ── derived ──────────────────────────────────────────────

  const characterHeight = CHARACTER_CONFIG.defaultHeight * settings.characterScale;

  // Render-ready action payload: video clip (replaces Jane entirely) or
  // sequence frame. actionCalVersion is read to re-render on live tuning.
  const buildActionView = (snapshot: typeof actionState): CharacterActionView | null => {
    // Focus-complete reward: the character temporarily shows focus_com.png
    // (a single-frame "sequence") before the normal look returns.
    if (completionPhotoActive) {
      return { kind: "sequence", frames: [focusCompleteImage], frame: 0 };
    }
    if (!snapshot) return null;
    void actionCalVersion;
    const current = actionPlayer.getCurrent();
    if (!current) return null;
    if (snapshot.kind === "video" && current.kind === "video" && current.asset.type === "video") {
      const spec = getActionVideoSpec(snapshot.actionId);
      const cal = actionVideoCalibration.get(
        snapshot.actionId,
        calibrationDefaults(spec ?? { scale: 1, offsetX: 0, offsetY: 0 }),
      );
      return {
        kind: "video",
        src: current.asset.src,
        loop: current.asset.loop,
        muted: current.asset.muted,
        playbackRate: current.asset.playbackRate,
        paused: snapshot.paused ?? false,
        nonce: actionPlayer.getVideoNonce(),
        height: characterHeight * cal.scale,
        offsetX: cal.offsetX,
        offsetY: clampVerticalOffset(
          cal.offsetY,
          characterHeight * cal.scale,
          FULL_CONTENT,
          CHARACTER_WINDOW_MARGINS.bottom,
        ),
        onEnded: handleActionVideoEnded,
        onProgress: handleActionVideoProgress,
        onVideoSize: handleActionVideoSize,
      };
    }
    if (current.asset.type !== "sequence") return null;
    return { kind: "sequence", frames: current.asset.frames, frame: snapshot.frame };
  };

  const bubbleSide: BubbleSide = useMemo(() => {
    if (!windowPosition || !monitorBounds || monitorBounds.width <= 0) {
      return "top";
    }
    const relX = windowPosition.x - monitorBounds.x;
    const ratio = relX / monitorBounds.width;
    if (ratio > 0.6) return "left";
    if (ratio < 0.4) return "right";
    return "top";
  }, [windowPosition, monitorBounds]);

  // ── compact character window ─────────────────────────────

  // The visible figure (photo content box, or the action video) determines
  // the compact window. The screen anchor = the content's bottom-center
  // point. It is STORED — never re-derived from the current window bounds,
  // because the layout's canvas-centering offset would leak into every
  // re-derivation and drift the window forever ("Jane moves by herself").
  // The anchor only shifts when the user drags, or when a monitor clamp
  // overrides the placement (layoutCompactWindow reports the achieved one).
  const resolveContentLayout = useCallback(
    (): {
      imgWidth: number;
      imgHeight: number;
      contentBox: ContentBox;
      offsetX: number;
      offsetY: number;
    } | null => {
      if (completionPhotoActive) {
        // Focus-complete reward image (focus_com.png, 1095×1650 cutout).
        const imgH = characterHeight;
        const imgW = imgH * (1095 / 1650);
        return {
          imgWidth: imgW,
          imgHeight: imgH,
          contentBox: { x: 0, y: 0.0321, w: 1, h: 0.9679 },
          offsetX: 0,
          offsetY: 0,
        };
      }
      if (actionState?.kind === "video" && actionState.videoWidth && actionState.videoHeight) {
        const spec = getActionVideoSpec(actionState.actionId);
        const cal = actionVideoCalibration.get(
          actionState.actionId,
          calibrationDefaults(spec ?? { scale: 1, offsetX: 0, offsetY: 0 }),
        );
        const videoH = characterHeight * cal.scale;
        const videoW = videoH * (actionState.videoWidth / actionState.videoHeight);
        return {
          imgWidth: videoW,
          imgHeight: videoH,
          contentBox: FULL_CONTENT,
          offsetX: cal.offsetX,
          offsetY: clampVerticalOffset(
            cal.offsetY,
            videoH,
            FULL_CONTENT,
            CHARACTER_WINDOW_MARGINS.bottom,
          ),
        };
      }
      if (photo) {
        const geom = photoGeometry(photo.id);
        const imgH = characterHeight * photo.scale;
        const imgW = imgH * (geom.width / geom.height);
        return {
          imgWidth: imgW,
          imgHeight: imgH,
          contentBox: geom.contentBox,
          offsetX: photo.offsetX,
          offsetY: photo.offsetY,
        };
      }
      const geom = photoGeometry("character-placeholder");
      return {
        imgWidth: characterHeight * (geom.width / geom.height),
        imgHeight: characterHeight,
        contentBox: geom.contentBox,
        offsetX: 0,
        offsetY: 0,
      };
    },
    [photo, characterHeight, actionState, completionPhotoActive],
  );

  useEffect(() => {
    const cur = windowBoundsRef.current;
    const layout = resolveContentLayout();
    if (!cur || !layout) return;
    const s = monitorBounds?.scaleFactor ?? 1;
    if (!anchorRef.current) {
      // One-time: derive the anchor from the window as it currently sits, so
      // the very first compaction keeps Jane exactly where she already is.
      const r = contentRectInWindow({
        imgWidth: layout.imgWidth,
        imgHeight: layout.imgHeight,
        contentBox: layout.contentBox,
        offsetX: layout.offsetX,
        offsetY: layout.offsetY,
        windowWidth: cur.width / s,
        windowHeight: cur.height / s,
      });
      anchorRef.current = {
        x: cur.x + (r.left + r.width / 2) * s,
        y: cur.y + (r.top + r.height) * s,
      };
    }
    const target = layoutCompactWindow({
      imgWidth: layout.imgWidth,
      imgHeight: layout.imgHeight,
      contentBox: layout.contentBox,
      offsetX: layout.offsetX,
      offsetY: layout.offsetY,
      anchorX: anchorRef.current.x,
      anchorY: anchorRef.current.y,
      scaleFactor: s,
      margins: CHARACTER_WINDOW_MARGINS,
      monitor: monitorBounds,
      minWidthL: menuOpen ? CONTEXT_MENU_WINDOW_MIN.width : undefined,
      minHeightL: menuOpen ? CONTEXT_MENU_WINDOW_MIN.height : undefined,
    });
    // Always adopt the achieved anchor (identical to the input unless a
    // monitor clamp moved the window) — keeps the math self-consistent.
    anchorRef.current = { x: target.contentAnchorX, y: target.contentAnchorY };
    const achieved: PhysicalBounds = {
      x: target.x,
      y: target.y,
      width: target.width,
      height: target.height,
    };
    if (boundsAlmostEqual(achieved, cur)) return;
    windowBoundsRef.current = achieved;
    programmaticMoveUntilRef.current = Date.now() + 400;
    setCharacterBounds(achieved.x, achieved.y, achieved.width, achieved.height).catch(() => {});
  }, [resolveContentLayout, monitorBounds, menuOpen]);

  // ── speech bubble (dedicated overlay window) ─────────────

  // The dialogue engine runs here; the bubble renders in the "bubble"
  // overlay window. Placement is validated against the figure's on-screen
  // rect: it never overlaps Jane and never sits behind her (candidates are
  // tried top/left/right; the window also re-asserts always-on-top).
  useEffect(() => {
    if (!bubble) {
      void emit("bubble-hide");
      return;
    }
    const win = windowBoundsRef.current;
    const layout = resolveContentLayout();
    if (!win || !layout) return;
    const s = monitorBounds?.scaleFactor ?? 1;
    const contentRect = contentRectInWindow({
      imgWidth: layout.imgWidth,
      imgHeight: layout.imgHeight,
      contentBox: layout.contentBox,
      offsetX: layout.offsetX,
      offsetY: layout.offsetY,
      windowWidth: win.width / s,
      windowHeight: win.height / s,
    });
    const bw = Math.round(BUBBLE_WINDOW_WIDTH * s);
    const bh = Math.round(BUBBLE_WINDOW_HEIGHT * s);
    const placed = placeBubbleWindow({
      windowBounds: win,
      contentRect,
      scaleFactor: s,
      monitor: monitorBounds,
      bubbleWidth: bw,
      bubbleHeight: bh,
      preferredSide: bubbleSide,
    });
    void emit("bubble-show", {
      text: bubble.text,
      nonce: bubble.nonce,
      hiding: bubble.hiding,
      side: placed.side,
      x: placed.x,
      y: placed.y,
      width: bw,
      height: bh,
    });
  }, [bubble, bubbleSide, monitorBounds, windowPosition, resolveContentLayout]);

  // ── render ───────────────────────────────────────────────

  return (
    <div className="app">
      <div className="character-area">
        <CharacterRoot
          state={state}
          expression={expression}
          reaction={reaction}
          reactionNonce={reactionNonce}
          idle={idle}
          scale={settings.characterScale}
          photo={photo}
          action={buildActionView(actionState)}
          onHoverStart={handleHoverStart}
          onHoverEnd={handleHoverEnd}
          onClick={handleClick}
        />
      </div>

      {statusToast && <div className="status-toast">{statusToast}</div>}

      <JaneContextMenu onOpenChange={setMenuOpen} />

      {focusStatus !== "idle" && settings.focusShowTimer && (
        <FocusTimer
          status={focusStatus}
          remainingMs={focusRemaining}
          hidden={focusTimerHidden}
          onPause={handlePauseFocus}
          onResume={() => focusSession.resume()}
          onCancel={() => focusSession.cancel()}
          onToggleHide={() => setFocusTimerHidden((h) => !h)}
        />
      )}

      {focusSetupOpen && (
        <FocusSetup
          defaultMinutes={settings.focusDefaultMinutes}
          onStart={startFocusFromSetup}
          onCancel={() => setFocusSetupOpen(false)}
        />
      )}

      {focusCompleteOpen && (
        <FocusCompletePopup onDismiss={() => setFocusCompleteOpen(false)} />
      )}

      {import.meta.env.DEV && showDebug && (
        <CharacterDebugPanel
          state={state}
          expression={expression}
          reaction={reaction}
          pose={pose}
          lookId={lookId}
          photo={photo}
          debugSetState={debugSetState}
          debugSetExpression={debugSetExpression}
          debugSetReaction={debugSetReaction}
          setPose={setPose}
          debugSetLookId={setLookId}
          onClose={() => setShowDebug(false)}
          playAction={playCharacterAction}
          stopAction={stopCharacterAction}
          pauseAction={pauseCharacterAction}
          resumeAction={resumeCharacterAction}
          restartAction={restartCharacterAction}
          videoActionCalibration={
            actionState?.kind === "video"
              ? actionVideoCalibration.get(
                  actionState.actionId,
                  calibrationDefaults(
                    getActionVideoSpec(actionState.actionId) ?? {
                      scale: 1,
                      offsetX: 0,
                      offsetY: 0,
                    },
                  ),
                )
              : null
          }
          onVideoCalibration={(patch) => {
            if (actionState) actionVideoCalibration.set(actionState.actionId, patch);
          }}
          actionState={actionState}
        />
      )}
      {import.meta.env.DEV && showAssetLab && <AssetLab onClose={() => setShowAssetLab(false)} />}
      {import.meta.env.DEV && !showDebug && (
        <div className="debug-toggles">
          <button
            className="debug-toggle"
            type="button"
            onClick={() => setShowDebug(true)}
          >
            Debug
          </button>
          <button
            className="debug-toggle"
            type="button"
            onClick={() => setShowAssetLab(true)}
          >
            Asset Lab
          </button>
        </div>
      )}
    </div>
  );
}
