import { useRef } from "react";
import type { MouseEvent } from "react";
import { CharacterRenderer } from "./CharacterRenderer";
import { startDragging } from "../../services/window";
import { CHARACTER_CONFIG } from "../../config/character";
import type {
  CharacterExpression,
  CharacterReaction,
  CharacterState,
  IdleState,
} from "../../types/character";
import type { PhotoAssetMeta } from "../../types/photoAsset";
import type { CharacterActionView } from "../../types/action";

interface CharacterRootProps {
  state: CharacterState;
  expression: CharacterExpression;
  reaction: CharacterReaction;
  reactionNonce: number;
  idle: IdleState;
  scale: number;
  photo: PhotoAssetMeta | null;
  /** Playing CharacterAction (sequence or video), or null. */
  action?: CharacterActionView | null;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onClick: () => void;
}

/**
 * Interactive container: owns the DOM mouse handlers and distinguishes a
 * click from a window drag by a movement threshold. Rendering is delegated to
 * {@link CharacterRenderer}.
 *
 *   pointer down → move < threshold → click
 *   pointer down → move ≥ threshold → drag
 */
export function CharacterRoot({
  state,
  expression,
  reaction,
  reactionNonce,
  idle,
  scale,
  photo,
  action,
  onHoverStart,
  onHoverEnd,
  onClick,
}: CharacterRootProps) {
  const dragStateRef = useRef({ startX: 0, startY: 0, dragging: false });

  const handleMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    dragStateRef.current = { startX: e.clientX, startY: e.clientY, dragging: false };
  };

  const handleMouseMove = (e: MouseEvent) => {
    const s = dragStateRef.current;
    if (s.dragging) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    const threshold = CHARACTER_CONFIG.dragThreshold;
    if (dx * dx + dy * dy > threshold * threshold) {
      s.dragging = true;
      startDragging();
    }
  };

  const handleClick = () => {
    if (dragStateRef.current.dragging) return;
    onClick();
  };

  return (
    <div
      className={`character character--${state}`}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
    >
      <CharacterRenderer
        state={state}
        expression={expression}
        reaction={reaction}
        reactionNonce={reactionNonce}
        idle={idle}
        scale={scale}
        photo={photo}
        action={action}
      />
    </div>
  );
}
