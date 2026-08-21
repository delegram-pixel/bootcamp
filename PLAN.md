# Intern Portal — Build Plan

A web app where a mentor/admin runs internship cohorts: posts notes & assignments,
and interns submit work and receive graded feedback. Designed from day one to run
**several groups in parallel**.

---

## 1. Decisions locked (from planning)

| Decision | Choice |
|---|---|
| Submission types | **All**: file upload · text/markdown · external link · GitHub PR/repo |
| Feedback style | **Rubric score + written comments** |
| Program shape | **Several independent groups running at once** |
| v1 ambition | Lean core loop on **flexible foundations**; heavy features deferred but designed-for |

---

## 2. Users & roles

- **Admin** (you + any co-mentors) — create groups, invite interns, post assignments/notes/announcements, grade, see everything.
- **Intern** — sees only the groups they belong to; reads notes/assignments; submits work; sees their own grades & feedback.

Global role lives on the `User` row (`admin` | `intern`). Per-group relationships live in
`Membership` (a user can be an intern in several groups, or a mentor of specific ones).

---

## 3. Scope

### In v1
- Google sign-in, two roles
- **Groups** as first-class objects; interns can belong to several
- **Assignments** per group: markdown body, attachments, due date, points, draft/publish
- **Flexible submissions** — one submission carries any mix of file / text / link / GitHub link
- **Grading**: optional rubric (criteria × points) **+** a feedback comment thread
- **Notes / resources**, organized by week/topic (per-group or global)
- **Announcements** per group
- **Dashboards** — intern: *what's due across my groups*; admin: *per-group submission grid*
- **Email + in-app notifications**: assignment published · due-soon · graded · new comment

### Deferred to v2+ (priority order) — see §12 for how each attaches cleanly
GitHub diff view → **auto-grading** (sandboxed test runner) → **peer review** →
**gamification** (XP/streaks/badges/leaderboard) → **analytics** (completion, grade trends, at-risk flags) →
**AI** (first-pass feedback, quiz-from-notes, "explain my mistake") → certificates → office-hours booking.

---

## 4. Feature detail

**Assignments.** Created as `draft`, then `published` (publish is what triggers notifications).
Markdown description, 0..n attachments (mentor handouts: file or link), optional due date,
optional rubric. Points either set directly or summed from rubric criteria.

**Submissions.** One `Submission` per intern per assignment, holding 1..n `SubmissionItem`s of
mixed `kind`. Status auto-derives: `draft` → `submitted` (on submit) → `late` (submitted after due) →
`graded` → `returned` (if sent back for revision). Interns may edit until graded; comment thread stays open.

**Grading.** Per submission: score each rubric criterion (or a single overall score if no rubric)
plus threaded comments. Grading flips status to `graded` and notifies the intern.

**Notes/resources.** Markdown body + optional attachments, tagged by `week`/`topic`, scoped to a
group or global (all groups). This is your "send them notes" channel.

**Announcements.** Short markdown broadcasts per group (or global), notified.

---

## 5. Data model

```
User(id, name, email⧉, image, role: admin|intern, createdAt)
  └─ Auth.js adapter tables: Account, Session, VerificationToken

Group(id, name, description, status: active|archived, createdAt)
Membership(id, userId→User, groupId→Group, roleInGroup: mentor|intern, createdAt)   ⧉(userId, groupId)

Assignment(id, groupId→Group, title, descriptionMd, dueAt?, points?, status: draft|published,
           createdById→User, createdAt)
AssignmentAttachment(id, assignmentId→Assignment, kind: file|link, label, url, fileKey?, mime?, size?)

Rubric(id, assignmentId→Assignment⧉)
RubricCriterion(id, rubricId→Rubric, label, description?, maxPoints, order)

Submission(id, assignmentId→Assignment, internId→User,
           status: draft|submitted|late|graded|returned, submittedAt?, createdAt, updatedAt)  ⧉(assignmentId, internId)
SubmissionItem(id, submissionId→Submission, kind: file|text|link|github,
               content?, url?, fileKey?, mime?, size?, meta_json?, createdAt)

Grade(id, submissionId→Submission⧉, score, gradedById→User, gradedAt)
CriterionScore(id, gradeId→Grade, criterionId→RubricCriterion, points, comment?)
Comment(id, submissionId→Submission, authorId→User, bodyMd, createdAt)

Note(id, groupId→Group?, title, bodyMd, week?, topic?, createdById→User, createdAt)
Announcement(id, groupId→Group?, authorId→User, bodyMd, createdAt)
Notification(id, userId→User, type, payload_json, readAt?, createdAt)
```
`⧉` = unique. `?` = nullable. `groupId?` null on Note/Announcement means "global / all groups."

- `SubmissionItem.kind` is what makes "all submission types" work — one table, one submit UI.
- `Membership` is what makes "several groups at once" work.
- `meta_json` on a `github` item stores `{ repo, prNumber, commitSha }` — the seam for the future diff/auto-grade features.

---

## 6. Screens & routes

**Intern**
- `/dashboard` — my groups, what's due (all groups), recent feedback
- `/groups/[groupId]` — group home: announcements, assignment list, notes
- `/groups/[groupId]/assignments/[assignmentId]` — detail + submit form
- `/submissions/[submissionId]` — my submission, grade, feedback thread
- `/notifications`

**Admin**
- `/admin` — cross-group overview (pending grading, upcoming due dates)
- `/admin/groups` · `/admin/groups/[groupId]` — CRUD groups, manage roster
- `/admin/assignments/new` · `/admin/assignments/[id]/edit` — assignment + rubric + attachments
- `/admin/assignments/[id]/submissions` — submission grid (status per intern)
- `/admin/submissions/[id]` — grading screen (items + rubric + comments)
- `/admin/members` — invite / manage users

---

## 7. Key user flows

1. **Onboarding** — admin creates a group → invites interns by email → intern signs in with Google → auto-joins the groups they were invited to.
2. **Assignment cycle** — admin drafts (body + rubric + attachments) → publishes (interns notified) → intern submits mixed items → status `submitted`/`late` → admin grades (rubric + comment) → status `graded` (intern notified) → optional comment back-and-forth → optional `returned` for resubmission.
3. **Notes** — admin posts a note/resource to a group or globally → appears in group home & `/notes`.
4. **Announcement** — admin broadcasts → interns notified.

---

## 8. Permissions (v1, keep simple)

- `admin` → full access.
- `intern` → only groups they're a member of; only their own submissions; all *published* assignments/notes/announcements in those groups.
- Enforce in a single server-side `authorize(user, action, resource)` helper; never trust the client. Per-group mentor scoping can tighten later.

---

## 9. Notifications

- Dual channel: `Notification` row (in-app bell) + email via Resend (React Email templates).
- Triggers: assignment published · graded · new comment on your submission · announcement.
- **Due-soon** needs a schedule → Vercel Cron hits `/api/cron/due-soon` daily, finds assignments due in 24–48h with no submission, notifies.

---

## 10. Tech stack

- **Next.js** (App Router) + **TypeScript** + **Tailwind** + **shadcn/ui**
- **Auth.js** (NextAuth) — Google provider + Drizzle adapter
- **Postgres** (Neon or Supabase) + **Drizzle ORM** + drizzle-kit migrations
- **UploadThing** for file storage (simplest); Supabase Storage / S3 as alternative
- **Resend** + React Email for mail
- **Zod** validation, **react-hook-form**, **Server Actions** for mutations
- Deploy on **Vercel** (+ Vercel Cron). All services have free tiers → ~$0 to start.

---

## 11. Build phases (milestones & acceptance)

- **P0 — Foundations.** Next.js/TS/Tailwind/shadcn scaffold, Auth.js Google login, Drizzle + Postgres, `User/Group/Membership`, role-gated layout. ✅ *Sign in with Google; admin vs intern see different shells.*
- **P1 — Groups & roster.** Admin CRUD groups; invite interns by email; membership. ✅ *Admin creates a group and adds an intern who then sees it.*
- **P2 — Content.** Assignments (draft/publish + attachments + rubric) and Notes CRUD; intern group views. ✅ *Published assignment & a note appear for group members.*
- **P3 — Submissions.** Multi-type submit form + status logic + edit-until-graded. ✅ *Intern submits file+link+text+github in one submission.*
- **P4 — Grading.** Submission grid; grading screen (rubric scores + comment thread). ✅ *Admin grades; intern sees score & feedback.*
- **P5 — Comms.** Resend emails + in-app bell + announcements + due-soon cron. ✅ *Publish/grade/announce send mail and in-app notifications.*
- **P6 — Dashboards & ship.** Intern "what's due", admin overview, empty states, mobile, deploy to Vercel. ✅ *Live URL, seeded demo group.*

---

## 12. v2 backlog & the seams that make it cheap

- **GitHub diff / auto-grade** — `SubmissionItem.kind='github'` + `meta_json` already capture repo/PR/commit. Add a viewer, then a sandboxed runner keyed on a per-assignment `autograde` config.
- **Peer review** — add `PeerReview(assignmentId, reviewerId, submissionId, ...)`; reuse the comment/rubric UI.
- **Gamification** — emit an `Event` on submit/grade; derive XP/streaks/badges; leaderboard is a query.
- **Analytics** — all data already in Postgres; add read-only aggregate queries + a charts page.
- **AI** — a server action over `SubmissionItem`s → draft feedback the admin approves; notes → quiz generator.

---

## 13. Setup checklist (env)

```
DATABASE_URL=              # Neon/Supabase Postgres
AUTH_SECRET=               # openssl rand -base64 32
AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
UPLOADTHING_TOKEN=
RESEND_API_KEY=
CRON_SECRET=               # guards /api/cron/*
```
