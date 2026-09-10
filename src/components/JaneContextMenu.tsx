import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { POSE_TABS } from "../config/looks";
import { actionMenuItems } from "../config/characterActions";
import { focusSession } from "../infrastructure/FocusSession";
import { concertStore } from "../infrastructure/ConcertStore";

/** Secondary windows reachable from the Jane right-click menu. */
const MENU_ITEMS: { target: string; label: string }[] = [
  { target: "goals", label: "今日目标" },
  { target: "concert", label: "下一次Jane面" },
  { target: "settings", label: "设置" },
];

const FOCUS_OPTIONS: { ms: number; label: string }[] = [
  { ms: 25 * 60_000, label: "25 分钟" },
  { ms: 50 * 60_000, label: "50 分钟" },
  { ms: 90 * 60_000, label: "90 分钟" },
  { ms: 0, label: "自定义…" },
];

/** Grace period before the whole menu tree closes after the pointer leaves it. */
const CLOSE_DELAY_MS = 300;

/** The submenu families managed by this menu. */
type SubmenuId = "looks" | "actions" | "focus";

/**
 * Minimal right-click context menu on the character window. Mirrors the tray
 * entries; window opening goes through the Rust-side `jane-open` listener so
 * the allowlist lives in one place.
 *
 * Submenu interaction is driven by ONE menu state (openSubmenu) — never by
 * CSS :hover — so moving between a parent item and its submenu cannot close
 * anything. The whole menu tree closes only when the pointer leaves the root
 * (after CLOSE_DELAY_MS), on outside click, on Esc, or on window blur; the
 * timer is cancelled the moment the pointer re-enters the root or any
 * submenu. Submenus anchor to the menu root, are vertically aligned with
 * their parent item and clamped so they never overflow the window.
 *
 * `onOpenChange` lets the host temporarily widen the (compact) character
 * window while the menu is visible — the menu + submenus render inside it.
 */
export function JaneContextMenu({
  onOpenChange,
}: {
  onOpenChange?: (open: boolean) => void;
} = {}) {
  const [open, setOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<SubmenuId | null>(null);
  /** Measured vertical offset of the open submenu (null = not measured yet). */
  const [submenuTop, setSubmenuTop] = useState<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const menuRootRef = useRef<HTMLDivElement | null>(null);
  const submenuRef = useRef<HTMLDivElement | null>(null);
  const parentItemTopRef = useRef(0);

  const cancelScheduledClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const closeAll = useCallback(() => {
    cancelScheduledClose();
    setOpen(false);
    setOpenSubmenu(null);
  }, [cancelScheduledClose]);

  const scheduleClose = useCallback(() => {
    cancelScheduledClose();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setOpen(false);
      setOpenSubmenu(null);
    }, CLOSE_DELAY_MS);
  }, [cancelScheduledClose]);

  // Outside interactions: another right-click reopens, outside click / real
  // window blur close. (Moving into a submenu never hits these.)
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      cancelScheduledClose();
      setOpenSubmenu(null);
      setOpen(true);
    };
    const onWindowClick = () => closeAll();
    const onWindowBlur = () => closeAll();
    window.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("click", onWindowClick);
    window.addEventListener("blur", onWindowBlur);
    return () => {
      window.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("click", onWindowClick);
      window.removeEventListener("blur", onWindowBlur);
      cancelScheduledClose();
    };
  }, [closeAll, cancelScheduledClose]);

  // Esc closes the whole menu while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeAll]);

  // Host notification (window expansion while the menu is visible).
  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  // Hover on a parent item: record its position and open its submenu.
  const handleParentEnter = useCallback(
    (id: SubmenuId | null, button: HTMLElement | null) => {
      cancelScheduledClose();
      if (id && button && menuRootRef.current) {
        const itemRect = button.getBoundingClientRect();
        const rootRect = menuRootRef.current.getBoundingClientRect();
        parentItemTopRef.current = itemRect.top - rootRect.top;
      }
      setSubmenuTop(null);
      setOpenSubmenu(id);
    },
    [cancelScheduledClose],
  );

  // Clamp the open submenu: top-aligned with its parent item, shifted up
  // when it would overflow the menu bottom (which sits 10px above the
  // window bottom edge).
  useLayoutEffect(() => {
    if (!openSubmenu) {
      setSubmenuTop(null);
      return;
    }
    const root = menuRootRef.current;
    const sub = submenuRef.current;
    if (!root || !sub) return;
    const maxTop = root.clientHeight - sub.offsetHeight - 4;
    setSubmenuTop(Math.max(0, Math.min(parentItemTopRef.current, maxTop)));
  }, [openSubmenu, open]);

  if (!open) return null;

  // Re-computed each time the menu opens, so focus/concert gating is fresh.
  const focusActive = focusSession.isActive();
  const actions = actionMenuItems({
    focus: focusActive,
    concert: concertStore.isToday(),
  });
  // During focus only the 专注 pool can be switched on screen — the other
  // tabs would just be ignored, so hide them entirely.
  const lookTabs = focusActive
    ? POSE_TABS.filter((t) => t.id === "focus")
    : POSE_TABS;

  const itemEnter = () => handleParentEnter(null, null);
  const submenuClass = (id: SubmenuId) =>
    openSubmenu === id
      ? "jane-context-menu__submenu jane-context-menu__submenu--open"
      : "jane-context-menu__submenu";
  const groupClass = (id: SubmenuId) =>
    openSubmenu === id
      ? "jane-context-menu__group jane-context-menu__group--open"
      : "jane-context-menu__group";
  const submenuStyle =
    submenuTop !== null ? { top: submenuTop, bottom: "auto" } : undefined;

  const renderSubmenu = (
    id: SubmenuId,
    children: React.ReactNode,
  ): React.ReactNode => (
    <div
      ref={openSubmenu === id ? submenuRef : undefined}
      className={submenuClass(id)}
      style={openSubmenu === id ? submenuStyle : undefined}
      onMouseEnter={cancelScheduledClose}
    >
      {children}
    </div>
  );

  return (
    <div
      ref={menuRootRef}
      className="jane-context-menu"
      onMouseEnter={cancelScheduledClose}
      onMouseLeave={scheduleClose}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button type="button" onMouseEnter={itemEnter} onClick={() => void emit("look-next", {})}>
        换一个
      </button>
      <div className={groupClass("looks")}>
        <button
          type="button"
          onMouseEnter={(e) => handleParentEnter("looks", e.currentTarget)}
        >
          选择造型
        </button>
        {renderSubmenu(
          "looks",
          lookTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                closeAll();
                void emit("look-pose", { pose: t.id });
              }}
            >
              {t.label}
            </button>
          )),
        )}
      </div>
      <div className={groupClass("actions")}>
        <button
          type="button"
          onMouseEnter={(e) => handleParentEnter("actions", e.currentTarget)}
        >
          动作
        </button>
        {renderSubmenu(
          "actions",
          actions.map(({ def, available }) => (
            <button
              key={def.id}
              type="button"
              disabled={!available}
              onClick={() => {
                closeAll();
                void emit("action-play", { actionId: def.id });
              }}
            >
              {def.label}
            </button>
          )),
        )}
      </div>
      <div className="jane-context-menu__separator" />
      <div className={groupClass("focus")}>
        <button
          type="button"
          onMouseEnter={(e) => handleParentEnter("focus", e.currentTarget)}
        >
          陪我专注
        </button>
        {renderSubmenu(
          "focus",
          FOCUS_OPTIONS.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => {
                closeAll();
                void emit("focus-start", { durationMs: o.ms });
              }}
            >
              {o.label}
            </button>
          )),
        )}
      </div>
      {MENU_ITEMS.map((item) => (
        <button
          key={item.target}
          type="button"
          onMouseEnter={itemEnter}
          onClick={() => void emit("jane-open", { target: item.target })}
        >
          {item.label}
        </button>
      ))}
      <div className="jane-context-menu__separator" />
      <button
        type="button"
        onMouseEnter={itemEnter}
        onClick={() => void emit("look-lock-toggle", {})}
      >
        锁定当前造型
      </button>
    </div>
  );
}
