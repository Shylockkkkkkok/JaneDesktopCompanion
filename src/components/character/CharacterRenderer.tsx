import { useMemo } from "react";
import type {
  CharacterExpression,
  CharacterReaction,
  CharacterState,
  IdleState,
} from "../../types/character";
import type { PhotoAssetMeta } from "../../types/photoAsset";
import type { CharacterActionView } from "../../types/action";
import { CHARACTER_CONFIG } from "../../config/character";
import { useCharacterAsset } from "../../hooks/useCharacterAsset";
import { CharacterAssetView } from "./CharacterAssetView";
import { CharacterPhotoView } from "./CharacterPhotoView";
import { CharacterVideoActionView } from "./CharacterVideoActionView";
import { randomItem } from "../../utils/random";

const REACTION_ANIMATIONS = ["scale", "tilt", "nudge", "shake", "bounce"] as const;

interface CharacterRendererProps {
  state: CharacterState;
  expression: CharacterExpression;
  reaction: CharacterReaction;
  reactionNonce: number;
  idle: IdleState;
  scale: number;
  /** Selected photo (from the AssetSelector, held by the parent). */
  photo: PhotoAssetMeta | null;
  /**
   * Playing CharacterAction (sequence frames or a transparent video clip).
   * When present it fully replaces the photo/fallback render until playback
   * completes — never both Jane and the action video on screen at once.
   */
  action?: CharacterActionView | null;
}

/**
 * Pure rendering. Priority inside: action video > action frame > photo >
 * manifest fallback. The action layer reuses the same photo sizing
 * (baseHeight × user scale).
 */
export function CharacterRenderer({
  state,
  expression,
  reaction,
  reactionNonce,
  idle,
  scale,
  photo,
  action,
}: CharacterRendererProps) {
  const fallbackAsset = useCharacterAsset(state, expression);
  const baseHeight = CHARACTER_CONFIG.defaultHeight * scale;

  // Stable per reaction so the CSS animation doesn't re-randomise mid-play.
  const reactionAnim = useMemo(() => randomItem(REACTION_ANIMATIONS), [reactionNonce]);

  const idleClass = idle.motion ? `character__idle--${idle.motion}` : "";
  const reactionClass = reaction !== "none" ? `character__reaction--${reactionAnim}` : "";

  const frameSrc =
    action?.kind === "sequence" && action.frames.length > 0
      ? action.frames[Math.min(action.frame, action.frames.length - 1)]
      : null;

  return (
    <>
      <div className={`character__idle ${idleClass}`} key={`idle-${idle.nonce}`}>
        <div
          className={`character__reaction ${reactionClass}`}
          key={`reaction-${reactionNonce}`}
        >
          {action?.kind === "video" ? (
            <CharacterVideoActionView
              key={`video-${action.nonce}`}
              src={action.src}
              loop={action.loop}
              muted={action.muted}
              playbackRate={action.playbackRate}
              paused={action.paused}
              nonce={action.nonce}
              height={action.height}
              offsetX={action.offsetX}
              offsetY={action.offsetY}
              onEnded={action.onEnded}
              onProgress={action.onProgress}
              onVideoSize={action.onVideoSize}
            />
          ) : frameSrc ? (
            <img
              className="character__image"
              src={frameSrc}
              alt="Dear Jane"
              style={{ height: baseHeight }}
              draggable={false}
            />
          ) : photo ? (
            <CharacterPhotoView photo={photo} baseHeight={baseHeight} />
          ) : (
            <CharacterAssetView asset={fallbackAsset} height={baseHeight} />
          )}
        </div>
      </div>
    </>
  );
}
