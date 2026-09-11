import { type LevelInfo } from "@/lib/scoring";

/**
 * XP meter — a single-hue magnitude bar in the same visual language as the
 * completion bar on the progress page: a muted track with a primary fill and
 * rounded ends, labeled with the current level and progress to the next. One
 * series, so no legend — the label names it. Server component; no chart library.
 */
export function XpBar({ level }: { level: LevelInfo }) {
  const atMax = level.nextLevelXp == null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums">Level {level.level}</span>
          <span className="text-muted-foreground text-sm tabular-nums">{level.xp} XP</span>
        </div>
        <span className="text-muted-foreground text-sm tabular-nums">
          {atMax
            ? "Max level reached"
            : `${level.intoLevel} / ${level.span} XP to level ${level.level + 1}`}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={atMax ? "At max level" : `Progress to level ${level.level + 1}`}
        aria-valuenow={level.pctToNext}
        aria-valuemin={0}
        aria-valuemax={100}
        className="bg-muted h-2.5 w-full overflow-hidden rounded-full"
      >
        <div
          className="bg-primary h-full rounded-full transition-all"
          style={{ width: `${level.pctToNext}%` }}
        />
      </div>
    </div>
  );
}
