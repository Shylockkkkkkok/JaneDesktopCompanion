import { useEffect, useState } from "react";
import type { PhotoAssetMeta } from "../../types/photoAsset";
import { CHARACTER_CONFIG } from "../../config/character";
import { photoGeometry } from "../../config/photoContentBoxes";
import { clipPathFor } from "../../infrastructure/windowBounds";

interface CharacterPhotoViewProps {
  photo: PhotoAssetMeta;
  /** Base height in px (defaultHeight × user scale), before photo.scale. */
  baseHeight: number;
}

/**
 * Renders a single static photo at its configured scale + offset, with a
 * restrained cross-fade when the photo changes (avoids a flash on pose/look
 * switches). The img is clip-path'd to the photo's measured opaque content,
 * so the interactive hit area follows the visible figure — the transparent
 * PNG canvas padding never blocks the desktop.
 */
export function CharacterPhotoView({ photo, baseHeight }: CharacterPhotoViewProps) {
  const height = baseHeight * photo.scale;
  const clip = clipPathFor(photoGeometry(photo.id).contentBox);
  return (
    <div
      className="character__photo"
      style={{ transform: `translate(${photo.offsetX}px, ${photo.offsetY}px)` }}
    >
      <CrossFadeImage src={photo.src} height={height} clip={clip} />
    </div>
  );
}

function CrossFadeImage({
  src,
  height,
  clip,
}: {
  src: string;
  height: number;
  clip: string;
}) {
  const [current, setCurrent] = useState(src);
  const [prev, setPrev] = useState<string | null>(null);

  useEffect(() => {
    if (src === current) return;
    setPrev(current);
    setCurrent(src);
    const id = window.setTimeout(() => setPrev(null), CHARACTER_CONFIG.crossFadeMs);
    return () => window.clearTimeout(id);
  }, [src, current]);

  return (
    <span className="crossfade" style={{ height }}>
      {prev && (
        <img
          key={prev}
          className="crossfade__prev"
          src={prev}
          alt=""
          style={{ height, clipPath: clip }}
          draggable={false}
        />
      )}
      <img
        key={current}
        className="crossfade__current"
        src={current}
        alt="Dear Jane"
        style={{ height, clipPath: clip }}
        draggable={false}
      />
    </span>
  );
}
