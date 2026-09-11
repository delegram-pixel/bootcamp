import {
  AwardIcon,
  CheckCircle2Icon,
  FlameIcon,
  GaugeIcon,
  ListTodoIcon,
  TrophyIcon,
  ZapIcon,
} from "lucide-react";

import { getInternScorecard } from "@/db/queries/scoring";
import { requireUser } from "@/lib/authz";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionHeading } from "@/components/section-heading";
import { StatTile } from "@/components/scoring/stat-tile";
import { XpBar } from "@/components/scoring/xp-bar";
import { BadgeGrid } from "@/components/scoring/badge-grid";
import { InfoHint } from "@/components/scoring/info-hint";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Progress" };

export default async function ProgressPage() {
  const user = await requireUser();
  const { grade, progress, level, streakWeeks, earnedBadges } =
    await getInternScorecard(user.id);

  if (progress.total === 0) {
    return (
      <>
        <PageHeader
          title="Your progress"
          description="Your overall standing and how far you've come."
        />
        <EmptyState
          icon={TrophyIcon}
          title="Nothing to measure yet"
          description="Once you're in a group with published assignments, your standing shows up here."
        />
      </>
    );
  }

  const gradeValue = grade.pct == null ? "—" : `${grade.pct}%`;
  const gradeHint =
    grade.pct == null
      ? "No graded work yet"
      : `${grade.earned} / ${grade.possible} points`;

  return (
    <>
      <PageHeader
        title="Your progress"
        description="Your overall standing and how far you've come."
      />

      <div className="space-y-10">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Overall grade"
            value={gradeValue}
            hint={gradeHint}
            info="Points earned ÷ points possible across your graded work. Assignments with no point value aren't counted toward it."
            icon={TrophyIcon}
          />
          <StatTile
            label="Completion"
            value={`${progress.completionPct}%`}
            hint={`${progress.done} of ${progress.total} submitted`}
            icon={GaugeIcon}
          />
          <StatTile
            label="Graded"
            value={progress.graded}
            hint={
              progress.awaiting > 0
                ? `${progress.awaiting} awaiting feedback`
                : "All feedback in"
            }
            icon={CheckCircle2Icon}
          />
          <StatTile
            label="To do"
            value={progress.todo}
            hint={progress.todo === 0 ? "You're all caught up" : "Needs your attention"}
            icon={ListTodoIcon}
          />
        </div>

        <section className="space-y-3">
          <SectionHeading icon={GaugeIcon}>Where your work stands</SectionHeading>
          <div className="space-y-2">
            <div
              role="progressbar"
              aria-label="Assignment completion"
              aria-valuenow={progress.completionPct}
              aria-valuemin={0}
              aria-valuemax={100}
              className="bg-muted h-2.5 w-full overflow-hidden rounded-full"
            >
              <div
                className="bg-primary h-full rounded-full transition-all"
                style={{ width: `${progress.completionPct}%` }}
              />
            </div>
            <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span>
                <span className="text-foreground font-medium tabular-nums">
                  {progress.todo}
                </span>{" "}
                to do
              </span>
              <span>
                <span className="text-foreground font-medium tabular-nums">
                  {progress.awaiting}
                </span>{" "}
                awaiting feedback
              </span>
              <span>
                <span className="text-foreground font-medium tabular-nums">
                  {progress.graded}
                </span>{" "}
                graded
              </span>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeading icon={ZapIcon}>
            Level &amp; XP
            <InfoHint label="How XP and levels work">
              XP comes from graded work — the points you score, plus 10 for
              submitting on time and 25 for a perfect score. Your level comes
              from total XP: 100 for level 2, 250 for level 3, 500 for level 4,
              and up. The leaderboard ranks by XP, so steady volume can outrank a
              higher grade&nbsp;%.
            </InfoHint>
          </SectionHeading>
          <Card>
            <CardContent className="space-y-4">
              <XpBar level={level} />
              <div className="flex items-center gap-2 text-sm">
                <FlameIcon
                  className={
                    streakWeeks > 0
                      ? "size-4 text-orange-500"
                      : "text-muted-foreground size-4"
                  }
                />
                {streakWeeks > 0 ? (
                  <span>
                    <span className="text-foreground font-medium tabular-nums">
                      {streakWeeks}
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      week{streakWeeks === 1 ? "" : "s"} in a row with a submission
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    No active streak — submit something this week to start one.
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <SectionHeading icon={AwardIcon}>Badges</SectionHeading>
          <BadgeGrid earned={earnedBadges} />
        </section>
      </div>
    </>
  );
}
