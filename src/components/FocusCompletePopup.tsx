import focusCompleteImage from "../../focus/focus_com.png";

interface FocusCompletePopupProps {
  onDismiss: () => void;
}

/** Celebration image shown briefly when a focus session completes. */
export function FocusCompletePopup({ onDismiss }: FocusCompletePopupProps) {
  return (
    <div className="focus-complete-popup" onClick={onDismiss}>
      <img src={focusCompleteImage} alt="专注完成" />
    </div>
  );
}
