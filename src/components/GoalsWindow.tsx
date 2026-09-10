import { useEffect, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import type { Goal } from "../types/goals";
import { goalsStore } from "../infrastructure/GoalsStore";

/**
 * Lightweight today-goals window (label "goals"). Renders the day's list with
 * add/edit/delete/complete. Completing a goal emits "goal-complete" (with
 * `allComplete`) so the character window can react.
 */
export default function GoalsWindow() {
  const [, setTick] = useState(0);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  useEffect(() => {
    const unsub = goalsStore.subscribe(() => setTick((t) => t + 1));
    // Re-render once a minute so "today" rolls over across midnight.
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => {
      unsub();
      window.clearInterval(id);
    };
  }, []);

  const goals = goalsStore.getTodayGoals();
  const completedCount = goals.filter((g) => g.completed).length;

  const handleAdd = () => {
    const text = draft.trim();
    if (!text) return;
    goalsStore.add(text);
    setDraft("");
  };

  const handleToggle = (goal: Goal) => {
    const willComplete = !goal.completed;
    goalsStore.setCompleted(goal.id, willComplete);
    if (willComplete) {
      // "全部完成"的庆祝台词每天只触发一次；其余完成说普通鼓励台词。
      const allComplete = goalsStore.shouldCelebrateAllComplete();
      if (allComplete) goalsStore.markAllCompleteCelebrated();
      void emit("goal-complete", { allComplete });
    }
  };

  const saveEdit = (id: string) => {
    const text = editingText.trim();
    if (text) goalsStore.updateText(id, text);
    setEditingId(null);
  };

  return (
    <div className="goals-window">
      <div className="goals-window__header">
        <span className="goals-window__title">TODAY</span>
        <span className="goals-window__count">
          {completedCount} / {goals.length}
        </span>
      </div>

      <div className="goals-window__list">
        {goals.map((goal) => (
          <div
            key={goal.id}
            className={`goal-item${goal.completed ? " goal-item--done" : ""}`}
          >
            <button
              type="button"
              className="goal-item__check"
              onClick={() => handleToggle(goal)}
            >
              {goal.completed ? "■" : "□"}
            </button>
            {editingId === goal.id ? (
              <input
                className="goal-item__edit"
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                onBlur={() => saveEdit(goal.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit(goal.id);
                }}
                autoFocus
              />
            ) : (
              <span
                className="goal-item__text"
                onClick={() => {
                  setEditingId(goal.id);
                  setEditingText(goal.text);
                }}
              >
                {goal.text}
              </span>
            )}
            <button
              type="button"
              className="goal-item__delete"
              onClick={() => goalsStore.remove(goal.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="goals-window__add">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder="添加目标…"
        />
        <button type="button" onClick={handleAdd}>
          添加
        </button>
      </div>
    </div>
  );
}
