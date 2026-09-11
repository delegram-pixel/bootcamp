import {
  CheckCircle2Icon,
  ClipboardListIcon,
  ClockIcon,
  ListTodoIcon,
  SparklesIcon,
} from "lucide-react";

import { getInternDashboard } from "@/db/queries/dashboard";
import { requireUser } from "@/lib/authz";
import { internActionState, needsAction } from "@/lib/submission-status";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionHeading } from "@/components/section-heading";
import { AssignmentRow } from "@/components/intern/assignment-row";

export const metadata = { title: "Tasks" };

export default async function AssignmentsPage() {
  const user = await requireUser();
  const items = await getInternDashboard(user.id);

  const todo = items.filter((i) => needsAction(internActionState(i.status)));
  const awaiting = items.filter((i) => internActionState(i.status) === "awaiting");
  const graded = items.filter((i) => internActionState(i.status) === "graded");

  return (
    <>
      <PageHeader
        title="Tasks"
        description="All your work across every group, grouped by where it stands."
      />

      {items.length === 0 ? (
        <EmptyState
          icon={ClipboardListIcon}
          title="No tasks yet"
          description="When your mentor publishes a task, it shows up here."
        />
      ) : (
        <div className="space-y-10">
          {/* To do — always shown so the action items have a fixed home */}
          <section className="space-y-3">
            <SectionHeading icon={ListTodoIcon} count={todo.length}>
              To do
            </SectionHeading>
            {todo.length === 0 ? (
              <EmptyState
                icon={SparklesIcon}
                title="You’re all caught up"
                description="Nothing needs doing right now. New tasks will appear here."
              />
            ) : (
              <ul className="space-y-2">
                {todo.map((item) => (
                  <AssignmentRow key={item.id} item={item} />
                ))}
              </ul>
            )}
          </section>

          {/* Awaiting feedback */}
          {awaiting.length > 0 ? (
            <section className="space-y-3">
              <SectionHeading icon={ClockIcon} count={awaiting.length}>
                Awaiting feedback
              </SectionHeading>
              <ul className="space-y-2">
                {awaiting.map((item) => (
                  <AssignmentRow key={item.id} item={item} />
                ))}
              </ul>
            </section>
          ) : null}

          {/* Graded */}
          {graded.length > 0 ? (
            <section className="space-y-3">
              <SectionHeading icon={CheckCircle2Icon} count={graded.length}>
                Graded
              </SectionHeading>
              <ul className="space-y-2">
                {graded.map((item) => (
                  <AssignmentRow key={item.id} item={item} showScore />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
