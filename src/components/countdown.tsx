"use client";

import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

/**
 * One shared 1-second clock for every countdown on the page. `getSnapshot`
 * returns a *cached* timestamp (mutated only on each tick) so React sees a
 * stable value between ticks — a fresh `Date.now()` per call would trip
 * useSyncExternalStore's "snapshot should be cached" contract. The interval
 * only runs while at least one countdown is mounted.
 */
let clockNow = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (timer === null) {
    timer = setInterval(() => {
      clockNow = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const getSnapshot = () => clockNow;
// Server render (and the matching first client paint) shows the placeholder;
// the live clock swaps in right after hydration. No flash, no mismatch.
const getServerSnapshot = () => null;

function Segment({ display, label }: { display: string; label: string }) {
  return (
    <div className="flex min-w-[2.5ch] flex-col items-center">
      <span className="text-2xl font-semibold tabular-nums sm:text-3xl">
        {display}
      </span>
      <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}

function Colon() {
  return <span className="text-2xl font-semibold opacity-30 sm:text-3xl">:</span>;
}

/**
 * A live, ticking countdown to `dueAtMs` (epoch ms). Counts down d : h : m : s,
 * turns red under an hour, and flips to "Past due" the moment it hits zero.
 */
export function Countdown({
  dueAtMs,
  className,
}: {
  dueAtMs: number;
  className?: string;
}) {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // SSR / first paint: a same-shaped skeleton so there's no layout shift.
  if (now === null) {
    return (
      <div className={cn("flex items-center gap-2", className)} aria-hidden>
        <Segment display="––" label="days" />
        <Colon />
        <Segment display="––" label="hrs" />
        <Colon />
        <Segment display="––" label="min" />
        <Colon />
        <Segment display="––" label="sec" />
      </div>
    );
  }

  const remaining = dueAtMs - now;

  if (remaining <= 0) {
    return (
      <div
        className={cn(
          "text-destructive inline-flex items-center gap-2 text-base font-semibold",
          className,
        )}
      >
        <span className="bg-destructive size-2 rounded-full" aria-hidden />
        Past due
      </div>
    );
  }

  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const urgent = remaining < 60 * 60 * 1000; // under an hour
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div
      role="timer"
      aria-label={`${days} days, ${hours} hours, ${minutes} minutes and ${seconds} seconds until due`}
      className={cn(
        "flex items-center gap-2",
        urgent ? "text-destructive" : "text-foreground",
        className,
      )}
    >
      <Segment display={String(days)} label="days" />
      <Colon />
      <Segment display={pad(hours)} label="hrs" />
      <Colon />
      <Segment display={pad(minutes)} label="min" />
      <Colon />
      <Segment display={pad(seconds)} label="sec" />
    </div>
  );
}
