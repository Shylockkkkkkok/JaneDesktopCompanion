import type { CharacterAsset, SequenceAsset } from "../../types/asset";
import { useSequenceFrame } from "../../hooks/useSequenceFrame";
import { photoGeometry } from "../../config/photoContentBoxes";
import { clipPathFor } from "../../infrastructure/windowBounds";

interface CharacterAssetViewProps {
  asset: CharacterAsset;
  height: number;
  /** Stable asset id for content-box lookup ("character-placeholder" etc). */
  assetId?: string;
}

/** Renders an asset according to its type (static / animatedImage / sequence). */
export function CharacterAssetView({ asset, height, assetId }: CharacterAssetViewProps) {
  if (asset.type === "sequence") {
    return <SequenceImage asset={asset} height={height} />;
  }
  const clip = assetId ? clipPathFor(photoGeometry(assetId).contentBox) : undefined;
  return (
    <img
      className="character__image"
      src={asset.src}
      alt="Dear Jane"
      style={{ height, clipPath: clip }}
      draggable={false}
    />
  );
}

function SequenceImage({ asset, height }: { asset: SequenceAsset; height: number }) {
  const frame = useSequenceFrame(asset, true);
  return (
    <img
      className="character__image"
      src={asset.frames[frame]}
      alt="Dear Jane"
      style={{ height }}
      draggable={false}
    />
  );
}
