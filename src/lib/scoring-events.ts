import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { earnedBadges } from "@/db/schema";
import { getInternScorecard } from "@/db/queries/scoring";
import { BADGES } from "@/lib/scoring";
import { notify, type Recipient } from "@/lib/notify";

/**
 * The intern's current derived level, or null if it can't be computed. Call this
 * *before* a grade write to capture the "before" level — `recordScoringMilestones`
 * compares against it to detect a crossing. Best-effort: never throws, so a read
 * hiccup here can't break grading (it just means no level-up ping this time).
 */
export async function currentLevel(userId: string): Promise<number | null> {
  try {
    const card = await getInternScorecard(userId);
    return card.level.level;
  } catch (e) {
    console.error("currentLevel() failed (non-fatal):", e);
    return null;
  }
}

/**
 * Award any badges the intern now qualifies for but hasn't been granted, and —
 * when `previousLevel` is given and they've climbed past it — record a level-up.
 * One in-app notification per new badge / level, deep-linking to `/progress`.
 *
 * Entirely best-effort and idempotent: the whole body is wrapped so nothing here
 * can throw into (and roll back) the calling mutation, and `earned_badge` is the
 * ledger that stops a re-grade from re-awarding. New badges are inserted *before*
 * their notifications fire, so even a failed notify can't cause a double award.
 *
 * Call this only *after* the grade/submission write has committed — it recomputes
 * the scorecard from the database, so it must see the new state.
 */
export async function recordScoringMilestones(opts: {
  intern: Recipient;
  /** Level captured before the grade write; omit when XP can't have changed. */
  previousLevel?: number | null;
}): Promise<void> {
  const { intern, previousLevel } = opts;
  try {
    const card = await getInternScorecard(intern.id);

    // --- newly-earned badges (earned_badge is the idempotency ledger) ---
    const computed = card.earnedBadges;
    if (computed.length > 0) {
      const already = await db.query.earnedBadges.findMany({
        where: and(
          eq(earnedBadges.userId, intern.id),
          inArray(earnedBadges.badgeKey, computed),
        ),
        columns: { badgeKey: true },
      });
      const have = new Set(already.map((r) => r.badgeKey));
      const fresh = computed.filter((k) => !have.has(k));
      if (fresh.length > 0) {
        // Persist first so a concurrent/re-grade can't double-award, even if a
        // notify below throws. onConflictDoNothing absorbs the race with the uq.
        await db
          .insert(earnedBadges)
          .values(fresh.map((badgeKey) => ({ userId: intern.id, badgeKey })))
          .onConflictDoNothing();
        const byKey = new Map(BADGES.map((b) => [b.key, b]));
        for (const key of fresh) {
          await notify([intern], {
            type: "badge_earned",
            payload: { badgeKey: key, label: byKey.get(key)?.label ?? key },
          });
        }
      }
    }

    // --- level-up (no stored level; detect the crossing at grade time) ---
    if (previousLevel != null && card.level.level > previousLevel) {
      await notify([intern], {
        type: "level_up",
        payload: { level: card.level.level },
      });
    }
  } catch (e) {
    console.error("recordScoringMilestones() failed (non-fatal):", e);
  }
}
