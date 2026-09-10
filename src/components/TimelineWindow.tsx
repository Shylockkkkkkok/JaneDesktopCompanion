import { useEffect, useRef, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import type {
  TimelineEventType,
  TimelineRecord,
} from "../types/timeline";
import { TIMELINE_EVENT_TYPE_LABELS } from "../types/timeline";
import { timelineStore } from "../infrastructure/TimelineStore";
import { concertStore } from "../infrastructure/ConcertStore";
import {
  saveCover,
  deleteCover,
  deleteRecordAssets,
  coverDataUrl,
  dropCoverCache,
  isSupportedImageMime,
  extForMime,
} from "../services/timelineAssets";

const EVENT_TYPES: TimelineEventType[] = ["concert", "festival", "event", "other"];

/** "2026-05-16" → "2026.05.16" */
function formatDate(date: string): string {
  return date.split("-").join(".");
}

/** Pending cover image held in memory until the form is submitted. */
interface PendingCover {
  dataUrl: string;
  base64: string;
  ext: string;
}

/** Resolve a cover ref to a display data URL. */
function useCoverUrl(coverRef: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (coverRef) {
      coverDataUrl(coverRef).then((u) => {
        if (alive) setUrl(u);
      });
    }
    return () => {
      alive = false;
    };
  }, [coverRef]);
  return url;
}

/** Small thumbnail in the list. Missing/broken files degrade to a placeholder. */
function CoverThumb({
  coverRef,
  onOpen,
}: {
  coverRef: string;
  onOpen: (url: string) => void;
}) {
  const url = useCoverUrl(coverRef);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);

  if (url === null) {
    return <div className="timeline-cover timeline-cover--placeholder">…</div>;
  }
  if (broken) {
    return (
      <div className="timeline-cover timeline-cover--placeholder" title="图片加载失败">
        无预览
      </div>
    );
  }
  return (
    <img
      className="timeline-cover"
      src={url}
      alt="见面照片"
      onClick={() => onOpen(url)}
      onError={() => setBroken(true)}
    />
  );
}

/** Full-window preview overlay; click anywhere to close. */
function CoverPreview({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="timeline-cover-preview" onClick={onClose}>
      <img src={url} alt="见面照片预览" onError={onClose} />
    </div>
  );
}

interface RecordFormProps {
  initial: { date: string; city: string; eventType: TimelineEventType; note: string };
  /** Cover ref currently stored on the record (edit mode only). */
  existingCover?: string | null;
  /** In-memory cover chosen but not yet persisted. */
  pendingCover: PendingCover | null;
  coverRemoved: boolean;
  onPickImage: () => void;
  onClearPendingCover: () => void;
  onRemoveCover: () => void;
  submitLabel: string;
  onSubmit: (fields: {
    date: string;
    city: string;
    eventType: TimelineEventType;
    note: string;
  }) => void;
  onCancel?: () => void;
}

function RecordForm({
  initial,
  existingCover,
  pendingCover,
  coverRemoved,
  onPickImage,
  onClearPendingCover,
  onRemoveCover,
  submitLabel,
  onSubmit,
  onCancel,
}: RecordFormProps) {
  const [date, setDate] = useState(initial.date);
  const [city, setCity] = useState(initial.city);
  const [eventType, setEventType] = useState<TimelineEventType>(initial.eventType);
  const [note, setNote] = useState(initial.note);

  const showCoverActions =
    pendingCover !== null || (existingCover != null && !coverRemoved);
  const showAddButton = pendingCover === null && (coverRemoved || existingCover == null);

  return (
    <div className="timeline-window__form">
      <label className="timeline-window__row">
        <span>日期</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <label className="timeline-window__row">
        <span>城市</span>
        <input value={city} onChange={(e) => setCity(e.target.value)} />
      </label>
      <label className="timeline-window__row">
        <span>类型</span>
        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value as TimelineEventType)}
        >
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {TIMELINE_EVENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="timeline-window__row">
        <span>备注</span>
        <input
          value={note}
          placeholder="可选"
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      {(showCoverActions || showAddButton) && (
        <div className="timeline-window__row timeline-window__cover-row">
          <span>照片</span>
          {pendingCover !== null ? (
            <div className="timeline-window__cover-actions">
              <img
                className="timeline-cover timeline-cover--form"
                src={pendingCover.dataUrl}
                alt="待保存照片"
              />
              <button type="button" onClick={onPickImage}>
                替换
              </button>
              <button type="button" className="timeline-window__secondary" onClick={onClearPendingCover}>
                删除
              </button>
            </div>
          ) : existingCover != null && !coverRemoved ? (
            <div className="timeline-window__cover-actions">
              <FormCoverThumb coverRef={existingCover} />
              <button type="button" onClick={onPickImage}>
                替换
              </button>
              <button type="button" className="timeline-window__secondary" onClick={onRemoveCover}>
                删除
              </button>
            </div>
          ) : (
            <button type="button" onClick={onPickImage}>
              添加照片 / 票根
            </button>
          )}
        </div>
      )}

      <div className="timeline-window__actions">
        <button
          type="button"
          disabled={!date}
          onClick={() => onSubmit({ date, city: city.trim(), eventType, note: note.trim() })}
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="timeline-window__secondary" onClick={onCancel}>
            取消
          </button>
        )}
      </div>
    </div>
  );
}

/** Form thumbnail for an already-persisted cover. */
function FormCoverThumb({ coverRef }: { coverRef: string }) {
  const url = useCoverUrl(coverRef);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  if (url === null || broken) {
    return <div className="timeline-cover timeline-cover--placeholder">无预览</div>;
  }
  return <img className="timeline-cover timeline-cover--form" src={url} alt="封面照片" />;
}

/**
 * Lightweight "I saw Jane" timeline (window label "timeline"). Past occasions
 * only: add / edit / delete, newest first, with an optional cover image
 * (max 1 per record, copied into app-managed storage). Saving a new record
 * emits "timeline-record-added" so the character can give a small reaction.
 */
export default function TimelineWindow() {
  const [, setTick] = useState(0);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  /** Prefilled draft (date+city) when converting a past Next Jane event. */
  const [prefill, setPrefill] = useState<RecordFormProps["initial"] | null>(null);
  const [pendingCover, setPendingCover] = useState<PendingCover | null>(null);
  const [coverRemoved, setCoverRemoved] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const unsub = timelineStore.subscribe(() => setTick((t) => t + 1));
    // Re-render once a minute so the past-concert suggestion rolls over.
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => {
      unsub();
      window.clearInterval(id);
    };
  }, []);

  const resetPending = () => {
    setPendingCover(null);
    setCoverRemoved(false);
    setCoverError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setCoverError(null);
    if (!isSupportedImageMime(file.type)) {
      setCoverError("仅支持 PNG / JPG / WebP 图片");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setCoverError("图片读取失败，请重试");
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const idx = dataUrl.indexOf(",");
      if (idx < 0) {
        setCoverError("图片读取失败，请重试");
        return;
      }
      setPendingCover({
        dataUrl,
        base64: dataUrl.slice(idx + 1),
        ext: extForMime(file.type),
      });
      setCoverRemoved(false);
    };
    reader.readAsDataURL(file);
  };

  const handleAdd = async (fields: Parameters<RecordFormProps["onSubmit"]>[0]) => {
    const record = timelineStore.add(fields.date, fields.city, fields.eventType, fields.note);
    if (pendingCover) {
      try {
        const ref = await saveCover(record.id, pendingCover.base64, pendingCover.ext);
        timelineStore.setCover(record.id, ref);
      } catch {
        // Cover failure must not lose the record itself.
        setCoverError("照片保存失败，记录已保存");
      }
    }
    void emit("timeline-record-added", {});
    setAdding(false);
    resetPending();
  };

  const handleEdit = async (
    record: TimelineRecord,
    fields: Parameters<RecordFormProps["onSubmit"]>[0],
  ) => {
    timelineStore.update(record.id, fields);
    if (pendingCover) {
      try {
        const ref = await saveCover(record.id, pendingCover.base64, pendingCover.ext);
        // The Rust side removed the old cover file when writing the new one.
        if (record.coverImage) dropCoverCache(record.coverImage);
        timelineStore.setCover(record.id, ref);
      } catch {
        setCoverError("照片保存失败，其他修改已保存");
      }
    } else if (coverRemoved && record.coverImage) {
      try {
        await deleteCover(record.coverImage);
      } catch {
        /* file cleanup is best-effort; the ref is cleared regardless */
      }
      dropCoverCache(record.coverImage);
      timelineStore.setCover(record.id, null);
    }
    setEditingId(null);
    resetPending();
  };

  const handleDeleteRecord = (record: TimelineRecord) => {
    timelineStore.remove(record.id);
    if (record.coverImage) {
      dropCoverCache(record.coverImage);
      // Best-effort asset cleanup; missing files are tolerated.
      void deleteRecordAssets(record.id).catch(() => {});
    }
  };

  const records = timelineStore.getAll();
  const count = timelineStore.getCount();

  // ── Concert Countdown linkage ─────────────────────────────
  // When the Next Jane date has passed, isn't already recorded and wasn't
  // dismissed, offer a one-tap way to turn it into a timeline entry. Never
  // auto-added; dismissing is remembered per event date.
  const concertEvent = concertStore.getEvent();
  const concertDays = concertStore.getDaysUntil();
  const suggestConcert =
    concertEvent !== null &&
    concertDays !== null &&
    concertDays < 0 &&
    !timelineStore.hasDate(concertEvent.date) &&
    !timelineStore.isDismissed(concertEvent.date);

  return (
    <div className="timeline-window">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <div className="timeline-window__header">
        <span className="timeline-window__title">我与Jane的约会记录</span>
        <span className="timeline-window__count">
          {count > 0 ? `见过 Jane ${count} 次` : "还没有记录。"}
        </span>
      </div>

      {coverError && (
        <div className="timeline-window__error">{coverError}</div>
      )}

      {suggestConcert && (
        <div className="timeline-window__suggest">
          <span>
            {formatDate(concertEvent!.date)} 的下一次Jane面已经过去了
            {concertEvent!.city ? `（${concertEvent!.city}）` : ""}，要加入记录吗？
          </span>
          <div className="timeline-window__suggest-actions">
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setPrefill({
                  date: concertEvent!.date,
                  city: concertEvent!.city,
                  eventType: "concert",
                  note: "",
                });
                setAdding(true);
              }}
            >
              加入记录
            </button>
            <button
              type="button"
              className="timeline-window__secondary"
              onClick={() => timelineStore.dismissDate(concertEvent!.date)}
            >
              忽略
            </button>
          </div>
        </div>
      )}

      {count > 0 && (
        <div className="timeline-window__list">
          {records.map((record) =>
            editingId === record.id ? (
              <RecordForm
                key={record.id}
                initial={{
                  date: record.date,
                  city: record.city,
                  eventType: record.eventType,
                  note: record.note,
                }}
                existingCover={record.coverImage ?? null}
                pendingCover={pendingCover}
                coverRemoved={coverRemoved}
                onPickImage={() => fileInputRef.current?.click()}
                onClearPendingCover={() => {
                  setPendingCover(null);
                  // If an old cover still exists on disk, keep it.
                  setCoverRemoved(record.coverImage != null);
                }}
                onRemoveCover={() => setCoverRemoved(true)}
                submitLabel="保存修改"
                onSubmit={(fields) => void handleEdit(record, fields)}
                onCancel={() => {
                  setEditingId(null);
                  resetPending();
                }}
              />
            ) : (
              <div key={record.id} className="timeline-item">
                {record.coverImage && (
                  <CoverThumb
                    coverRef={record.coverImage}
                    onOpen={(url) => setPreviewUrl(url)}
                  />
                )}
                <div className="timeline-item__main">
                  <div className="timeline-item__date">{formatDate(record.date)}</div>
                  <div className="timeline-item__meta">
                    {[
                      record.city,
                      TIMELINE_EVENT_TYPE_LABELS[record.eventType],
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  {record.note && (
                    <div className="timeline-item__note">{record.note}</div>
                  )}
                </div>
                <div className="timeline-item__buttons">
                  <button
                    type="button"
                    onClick={() => {
                      setAdding(false);
                      resetPending();
                      setEditingId(record.id);
                    }}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    className="timeline-item__delete"
                    onClick={() => handleDeleteRecord(record)}
                  >
                    删除
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {adding ? (
        <RecordForm
          initial={prefill ?? { date: "", city: "", eventType: "concert", note: "" }}
          existingCover={null}
          pendingCover={pendingCover}
          coverRemoved={false}
          onPickImage={() => fileInputRef.current?.click()}
          onClearPendingCover={() => setPendingCover(null)}
          onRemoveCover={() => setCoverRemoved(true)}
          submitLabel="保存"
          onSubmit={(fields) => void handleAdd(fields)}
          onCancel={() => {
            setAdding(false);
            resetPending();
          }}
        />
      ) : (
        editingId === null && (
          <div className="timeline-window__add">
            <button
              type="button"
              onClick={() => {
                setPrefill(null);
                resetPending();
                setAdding(true);
              }}
            >
              + 添加一次见面
            </button>
          </div>
        )
      )}

      {previewUrl && (
        <CoverPreview url={previewUrl} onClose={() => setPreviewUrl(null)} />
      )}
    </div>
  );
}
