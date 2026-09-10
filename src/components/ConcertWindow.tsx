import { useEffect, useState } from "react";
import { concertStore } from "../infrastructure/ConcertStore";

function formatDays(days: number): string {
  if (days < 0) return "已过去";
  if (days === 0) return "今天";
  if (days === 1) return "明天";
  return `${days} 天`;
}

/**
 * Lightweight "next Jane" editor (window label "concert"). Set the event date,
 * city and optional note; shows the remaining days when viewing.
 */
export default function ConcertWindow() {
  const [, setTick] = useState(0);
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState("");
  const [city, setCity] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const sync = () => {
      const ev = concertStore.getEvent();
      if (ev) {
        setDate(ev.date);
        setCity(ev.city);
        setNote(ev.note);
        setEditing(false);
      } else {
        setEditing(true);
      }
    };
    sync();
    const unsub = concertStore.subscribe(() => setTick((t) => t + 1));
    // Re-render once a minute so the day count rolls over across midnight.
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => {
      unsub();
      window.clearInterval(id);
    };
  }, []);

  const event = concertStore.getEvent();
  const days = concertStore.getDaysUntil();

  const handleSave = () => {
    if (!date) return;
    concertStore.setEvent({ date, city: city.trim(), note: note.trim() });
    setEditing(false);
  };

  const handleDelete = () => {
    concertStore.clearEvent();
    setDate("");
    setCity("");
    setNote("");
    setEditing(true);
  };

  return (
    <div className="concert-window">
      <div className="concert-window__header">
        <span>下一次Jane面</span>
      </div>

      {!editing && event ? (
        <div className="concert-window__view">
          <div className="concert-window__date">{event.date}</div>
          <div className="concert-window__days">
            {days !== null ? formatDays(days) : ""}
          </div>
          {event.city && <div className="concert-window__city">{event.city}</div>}
          {event.note && <div className="concert-window__note">{event.note}</div>}
          <div className="concert-window__actions">
            <button type="button" onClick={() => setEditing(true)}>
              修改
            </button>
            <button type="button" onClick={handleDelete}>
              删除
            </button>
          </div>
        </div>
      ) : (
        <div className="concert-window__form">
          <label className="concert-window__row">
            <span>日期</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="concert-window__row">
            <span>城市</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
          <label className="concert-window__row">
            <span>备注</span>
            <input
              value={note}
              placeholder="可选"
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className="concert-window__actions">
            <button type="button" onClick={handleSave}>
              保存
            </button>
            {event && (
              <button type="button" onClick={() => setEditing(false)}>
                取消
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
