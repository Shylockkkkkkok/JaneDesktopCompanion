import { useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import type { CharacterPose } from "../types/photoAsset";
import { assetLibrary } from "../infrastructure/AssetLibrary";

const POSES: CharacterPose[] = ["standing", "sitting", "relaxed", "focus", "concert"];

interface AssetLabProps {
  onClose: () => void;
}

/**
 * Dev-only photo browser + editor. Lists every transparent PNG in Jane_pics/,
 * previews the selected one, and edits its metadata (persisted to localStorage
 * via the AssetLibrary).
 */
export function AssetLab({ onClose }: AssetLabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, setVersion] = useState(0);

  useEffect(() => assetLibrary.subscribe(() => setVersion((v) => v + 1)), []);

  const assets = assetLibrary.getAll();
  const selected = selectedId ? assetLibrary.getById(selectedId) : null;

  const update = (patch: Parameters<typeof assetLibrary.update>[1]) => {
    if (selected) assetLibrary.update(selected.id, patch);
  };

  return (
    <div className="asset-lab">
      <div className="asset-lab__header">
        <span>Asset Lab · {assets.length} photos</span>
        <button type="button" onClick={onClose}>
          ✕
        </button>
      </div>

      {selected && (
        <div className="asset-lab__editor">
          <div className="asset-lab__preview-wrap">
            <img className="asset-lab__preview" src={selected.src} alt={selected.id} />
          </div>
          <div className="asset-lab__meta">
            <span className="asset-lab__id">{selected.id}</span>
            <span className="asset-lab__type">{selected.category}</span>
          </div>

          <label className="asset-lab__row">
            <span>category</span>
            <select
              value={selected.category}
              onChange={(e) => update({ category: e.target.value as CharacterPose })}
            >
              {POSES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="asset-lab__row">
            <span>lookId</span>
            <input
              value={selected.lookId}
              onChange={(e) => update({ lookId: e.target.value })}
            />
          </label>

          <label className="asset-lab__row">
            <span>scale {selected.scale.toFixed(2)}</span>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.01}
              value={selected.scale}
              onChange={(e) => update({ scale: Number(e.target.value) })}
            />
          </label>

          <label className="asset-lab__row">
            <span>offsetX {selected.offsetX}</span>
            <input
              type="range"
              min={-80}
              max={80}
              step={1}
              value={selected.offsetX}
              onChange={(e) => update({ offsetX: Number(e.target.value) })}
            />
          </label>

          <label className="asset-lab__row">
            <span>offsetY {selected.offsetY}</span>
            <input
              type="range"
              min={-80}
              max={80}
              step={1}
              value={selected.offsetY}
              onChange={(e) => update({ offsetY: Number(e.target.value) })}
            />
          </label>

          <label className="asset-lab__row">
            <span>weight {selected.weight.toFixed(1)}</span>
            <input
              type="range"
              min={0}
              max={5}
              step={0.1}
              value={selected.weight}
              onChange={(e) => update({ weight: Number(e.target.value) })}
            />
          </label>

          <label className="asset-lab__row asset-lab__row--toggle">
            <span>enabled</span>
            <input
              type="checkbox"
              checked={selected.enabled}
              onChange={(e) => update({ enabled: e.target.checked })}
            />
          </label>

          <div className="asset-lab__row asset-lab__row--actions">
            <button
              type="button"
              onClick={() => void emit("look-changed", { assetId: selected.id })}
            >
              Set as Current
            </button>
          </div>
        </div>
      )}

      <div className="asset-lab__grid">
        {assets.map((a) => (
          <button
            key={a.id}
            type="button"
            className={
              selectedId === a.id ? "asset-thumb asset-thumb--active" : "asset-thumb"
            }
            onClick={() => setSelectedId(a.id)}
          >
            <img src={a.src} alt={a.id} />
            <span>{a.id}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
