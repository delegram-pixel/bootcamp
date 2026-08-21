import { format, formatDistanceToNowStrict, isPast } from "date-fns";

export function formatDate(d?: Date | null): string {
  return d ? format(d, "MMM d, yyyy") : "—";
}

export function formatDateTime(d?: Date | null): string {
  return d ? format(d, "MMM d, yyyy · h:mm a") : "—";
}

export function fromNow(d?: Date | null): string {
  return d ? formatDistanceToNowStrict(d, { addSuffix: true }) : "";
}

/** Bytes → a compact human size, e.g. 2.4 MB. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}

/** A Date → the `YYYY-MM-DDTHH:mm` value an <input type="datetime-local"> expects (local time). */
export function toDateTimeLocalValue(d?: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type DueTone = "muted" | "soon" | "over";

/** Human label + tone for an assignment due date. */
export function dueLabel(dueAt?: Date | null): { text: string; tone: DueTone } {
  if (!dueAt) return { text: "No due date", tone: "muted" };
  const over = isPast(dueAt);
  const rel = formatDistanceToNowStrict(dueAt, { addSuffix: true });
  return {
    text: over ? `Overdue · was due ${rel}` : `Due ${format(dueAt, "MMM d")} · ${rel}`,
    tone: over ? "over" : "soon",
  };
}
