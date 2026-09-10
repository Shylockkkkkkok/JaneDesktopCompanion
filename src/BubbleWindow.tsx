import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  PhysicalPosition,
  PhysicalSize,
  getCurrentWindow,
} from "@tauri-apps/api/window";

interface BubblePlacement {
  text: string;
  nonce: number;
  hiding: boolean;
  side: "left" | "right" | "top";
  /** Physical px for the overlay window's position/size. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Root of the dedicated speech-bubble overlay window. The window itself is
 * permanently shown, transparent and mouse-transparent (created once at
 * startup); only the content below toggles. The main character window owns
 * all dialogue decisions and emits `bubble-show` with the exact physical
 * placement — here we only move the window and render.
 */
export default function BubbleWindow() {
  const [bubble, setBubble] = useState<BubblePlacement | null>(null);

  useEffect(() => {
    let unShow: (() => void) | undefined;
    let unHide: (() => void) | undefined;
    let mounted = true;

    // Apply window placement BEFORE painting content, so the bubble never
    // flashes at a stale position. Re-assert always-on-top: the character
    // window may have been re-shown (tray) since, which would otherwise
    // leave the bubble behind Jane.
    listen<BubblePlacement>("bubble-show", (event) => {
      if (!mounted) return;
      const p = event.payload;
      const win = getCurrentWindow();
      void win
        .setSize(new PhysicalSize(p.width, p.height))
        .then(() => win.setPosition(new PhysicalPosition(p.x, p.y)))
        .then(() => win.setAlwaysOnTop(true))
        .then(() => setBubble(p))
        .catch(() => {});
    }).then((fn) => {
      if (mounted) unShow = fn;
    });

    listen("bubble-hide", () => {
      if (mounted) setBubble(null);
    }).then((fn) => {
      if (mounted) unHide = fn;
    });

    return () => {
      mounted = false;
      unShow?.();
      unHide?.();
    };
  }, []);

  if (!bubble) return null;
  const { side } = bubble;
  return (
    <div className={`bubble-stage bubble-stage--${side}`}>
      <div
        key={bubble.nonce}
        className={`speech-bubble${bubble.hiding ? " speech-bubble--hiding" : ""}`}
      >
        <span className="speech-bubble__text">{bubble.text}</span>
      </div>
    </div>
  );
}
