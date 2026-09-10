import { useCallback, useEffect, useRef, useState } from "react";
import type { DialogueFrequency, RapidClickLevel } from "../types/character";
import { CHARACTER_CONFIG } from "../config/character";
import { dialogueEngine } from "../infrastructure/DialogueEngine";
import { randomBetween } from "../utils/random";

export interface BubbleState {
  text: string;
  nonce: number;
  /** Set true just before removal so CSS can play a fade-out. */
  hiding: boolean;
}

/**
 * Chance a hover/click/idle interaction produces a spoken line, by frequency.
 * Rapid clicks always respond (deliberate easter egg); they are not gated.
 */
const SPEAK_CHANCE: Record<
  DialogueFrequency,
  { hover: number; click: number; idle: number }
> = {
  low: { hover: 0.3, click: 0.4, idle: 0.1 },
  medium: { hover: 0.6, click: 0.65, idle: 0.25 },
  high: { hover: 0.9, click: 0.9, idle: 0.45 },
};

/** Length of the CSS fade-out, before the bubble is unmounted. */
const FADE_OUT_MS = 350;

/**
 * Owns the single on-screen speech bubble: show/hide timing and gating.
 * Line selection is delegated to the stateful {@link dialogueEngine}.
 */
export function useDialogue(frequency: DialogueFrequency) {
  const [bubble, setBubble] = useState<BubbleState | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<number | null>(null);

  const showBubble = useCallback((text: string) => {
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    if (fadeTimerRef.current !== null) window.clearTimeout(fadeTimerRef.current);

    setBubble({ text, nonce: Date.now(), hiding: false });

    const duration = randomBetween(
      CHARACTER_CONFIG.speechDurationMin,
      CHARACTER_CONFIG.speechDurationMax,
    );
    hideTimerRef.current = window.setTimeout(() => {
      setBubble((prev) => (prev ? { ...prev, hiding: true } : null));
      fadeTimerRef.current = window.setTimeout(() => {
        setBubble(null);
      }, FADE_OUT_MS);
    }, duration);
  }, []);

  /** Frequency-gated: may or may not say a hover line. */
  const maybeHoverSay = useCallback(() => {
    if (Math.random() < SPEAK_CHANCE[frequency].hover) {
      const text = dialogueEngine.pickHover();
      if (text) showBubble(text);
    }
  }, [frequency, showBubble]);

  /** Frequency-gated: may or may not say an idle line. */
  const maybeIdleSay = useCallback(() => {
    if (Math.random() < SPEAK_CHANCE[frequency].idle) {
      const text = dialogueEngine.pickIdle();
      if (text) showBubble(text);
    }
  }, [frequency, showBubble]);

  /** Frequency-gated: may or may not say a click line. */
  const maybeClickSay = useCallback(() => {
    if (Math.random() < SPEAK_CHANCE[frequency].click) {
      const text = dialogueEngine.pickClick();
      if (text) showBubble(text);
    }
  }, [frequency, showBubble]);

  /** Always says a rapid-click line for the given intensity level. */
  const sayRapid = useCallback(
    (level: RapidClickLevel) => {
      if (level < 2) return;
      const text = dialogueEngine.pickRapid(level as 2 | 3 | 4);
      if (text) showBubble(text);
    },
    [showBubble],
  );

  // Clean up any pending hide/fade timers on unmount.
  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
      if (fadeTimerRef.current !== null) window.clearTimeout(fadeTimerRef.current);
    };
  }, []);

  return {
    bubble,
    showBubble,
    maybeHoverSay,
    maybeIdleSay,
    maybeClickSay,
    sayRapid,
  };
}
