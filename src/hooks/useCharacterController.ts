import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CharacterExpression,
  CharacterReaction,
  CharacterState,
  RapidClickLevel,
} from "../types/character";
import type { CharacterPose } from "../types/photoAsset";
import { CHARACTER_CONFIG } from "../config/character";

/**
 * Single source of truth for the character's visual state.
 *
 *   State      — long-lived posture (idle / hover / reaction / …)
 *   Expression — facial mood (neutral for now; V0.1.5 has a single PNG)
 *   Reaction   — transient event (click / rapidClick) that auto-reverts
 *
 * Drag is a DOM-level concern handled by CharacterRoot, not here.
 */
export function useCharacterController() {
  const [state, setState] = useState<CharacterState>("idle");
  const [expression, setExpression] = useState<CharacterExpression>("neutral");
  const [reaction, setReaction] = useState<CharacterReaction>("none");
  const [reactionNonce, setReactionNonce] = useState(0);
  // Body pose (standing/sitting/relaxed/focus/concert) and current look/outfit.
  const [pose, setPoseState] = useState<CharacterPose>("standing");
  const [lookId, setLookIdState] = useState<string>("default");

  const hoveringRef = useRef(false);
  const clickCountRef = useRef(0);
  const reactionTimerRef = useRef<number | null>(null);
  const rapidTimerRef = useRef<number | null>(null);

  const setHover = useCallback((hovering: boolean) => {
    hoveringRef.current = hovering;
    setState((prev) => {
      if (hovering) return prev === "idle" ? "hover" : prev;
      return prev === "hover" ? "idle" : prev;
    });
  }, []);

  /** Returns the rapid-click level synchronously so the caller can react now. */
  const registerClick = useCallback((): RapidClickLevel => {
    clickCountRef.current += 1;
    const count = clickCountRef.current;

    if (rapidTimerRef.current !== null) window.clearTimeout(rapidTimerRef.current);
    rapidTimerRef.current = window.setTimeout(() => {
      clickCountRef.current = 0;
    }, CHARACTER_CONFIG.rapidClickResetTime);

    if (count >= 11) return 4;
    if (count >= 7) return 3;
    if (count >= 4) return 2;
    return 1;
  }, []);

  /** Play a transient reaction; auto-reverts to idle/hover when it ends. */
  const triggerReaction = useCallback((kind: CharacterReaction) => {
    setState("reaction");
    setReaction(kind);
    setReactionNonce((n) => n + 1);

    if (reactionTimerRef.current !== null) window.clearTimeout(reactionTimerRef.current);
    reactionTimerRef.current = window.setTimeout(() => {
      setReaction("none");
      setState(hoveringRef.current ? "hover" : "idle");
    }, CHARACTER_CONFIG.reactionDuration);
  }, []);

  // Debug/testing controls (used by the dev-only CharacterDebugPanel).
  const debugSetState = useCallback((s: CharacterState) => setState(s), []);
  const debugSetExpression = useCallback((e: CharacterExpression) => setExpression(e), []);
  const debugSetReaction = useCallback((r: CharacterReaction) => {
    setReaction(r);
    if (r !== "none") setReactionNonce((n) => n + 1);
  }, []);
  // Public pose/look setters (used by Focus, Concert and the debug panel).
  const setPose = useCallback((p: CharacterPose) => setPoseState(p), []);
  const setLookId = useCallback((l: string) => setLookIdState(l), []);

  useEffect(() => {
    return () => {
      if (reactionTimerRef.current !== null) window.clearTimeout(reactionTimerRef.current);
      if (rapidTimerRef.current !== null) window.clearTimeout(rapidTimerRef.current);
    };
  }, []);

  return {
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
  };
}
