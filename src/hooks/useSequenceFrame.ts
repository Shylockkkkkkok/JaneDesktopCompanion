import { useEffect, useState } from "react";
import type { SequenceAsset } from "../types/asset";

/** Cycles a PNG sequence's frames at its configured fps. */
export function useSequenceFrame(asset: SequenceAsset, playing: boolean): number {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    setFrame(0);
    if (!playing || asset.frames.length <= 1) return;
    const intervalMs = 1000 / asset.fps;
    const id = window.setInterval(() => {
      setFrame((f) => (f + 1) % asset.frames.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [asset, playing]);

  return frame;
}
