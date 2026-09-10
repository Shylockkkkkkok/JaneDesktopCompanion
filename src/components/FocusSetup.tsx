import { useState } from "react";

interface FocusSetupProps {
  defaultMinutes: number;
  onStart: (minutes: number) => void;
  onCancel: () => void;
}

/** Lightweight custom-duration picker shown when the user chooses "自定义…". */
export function FocusSetup({ defaultMinutes, onStart, onCancel }: FocusSetupProps) {
  const [minutes, setMinutes] = useState(defaultMinutes);

  return (
    <div className="focus-setup">
      <span className="focus-setup__label">自定义专注时长</span>
      <div className="focus-setup__row">
        <input
          type="number"
          min={1}
          max={600}
          value={minutes}
          onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 1))}
        />
        <span>分钟</span>
      </div>
      <div className="focus-setup__actions">
        <button type="button" onClick={() => onStart(minutes)}>
          开始
        </button>
        <button type="button" onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  );
}
