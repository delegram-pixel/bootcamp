# Build Prompt — Intern Portal (v1)

> Paste this into an AI coding agent (Claude Code, Cursor, v0, etc.) at the root of a fresh
> repo. It is self-contained; `PLAN.md` in this folder is the fuller spec if you want more detail.

---

## Role & goal

You are building **v1 of an Intern Portal**: a web app where a mentor/admin runs internship
cohorts — posting notes and assignments — and interns submit work and receive graded feedback.
The program runs **several independent groups in parallel**. Build the core loop
(post → submit → grade → feedback) on flexible foundations. Work in small, verifiable steps;
after each phase, stop and show me what runs.

## Non-negotiable requirements

- Submissions accept **any mix** of: file upload, text/markdown, external link, and GitHub PR/repo link.
- Feedback = **rubric scores (criteria × points) + a written comment thread**.
- **Groups are first-class**; an intern can belong to several. All content is scoped per group.
- Two roles: **admin** (full access) and **intern** (only their groups, only their own submissions).
- Never trust the client for authorization — enforce every access rule server-side.

## Stack (use exactly this)

- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- Auth.js (NextAuth) with Google provider + Drizzle adapter
- Postgres (Neon) + Drizzle ORM + drizzle-kit migrations
- UploadThing for file storage · Resend + React Email for email
- Zod + react-hook-form; mutations via Server Actions
- Target deploy: Vercel (+ Vercel Cron)

## Conventions

- `src/app` routes, `src/db` (schema + queries), `src/lib` (auth, utils), `src/components/ui` (shadcn).
- All mutations are Server Actions with Zod-validated input.
- One central `authorize(user, action, resource)` helper; call it in every action and loader.
- Derive submission status server-side (`submitted` vs `late` from `dueAt`); never let the client set it.
- Seed script creates: 1 admin, 4 interns, 2 groups, 2 assignments (one with a rubric), a note, sample submissions.

## Data model (Drizzle)

Implement these tables (see PLAN.md §5 for field-level notes). `⧉`=unique, `?`=nullable:

```
User(id, name, email⧉, image, role: admin|intern, createdAt)  + Auth.js adapter tables
Group(id, name, description, status: active|archived, createdAt)
Membership(id, userId, groupId, roleInGroup: mentor|intern, createdAt)  ⧉(userId, groupId)
Assignment(id, groupId, title, descriptionMd, dueAt?, points?, status: draft|published, createdById, createdAt)
AssignmentAttachment(id, assignmentId, kind: file|link, label, url, fileKey?, mime?, size?)
Rubric(id, assignmentId⧉)
RubricCriterion(id, rubricId, label, description?, maxPoints, order)
Submission(id, assignmentId, internId, status: draft|submitted|late|graded|returned, submittedAt?, createdAt, updatedAt)  ⧉(assignmentId, internId)
SubmissionItem(id, submissionId, kind: file|text|link|github, content?, url?, fileKey?, mime?, size?, meta_json?, createdAt)
Grade(id, submissionId⧉, score, gradedById, gradedAt)
CriterionScore(id, gradeId, criterionId, points, comment?)
Comment(id, submissionId, authorId, bodyMd, createdAt)
Note(id, groupId?, title, bodyMd, week?, topic?, createdById, createdAt)
Announcement(id, groupId?, authorId, bodyMd, createdAt)
Notification(id, userId, type, payload_json, readAt?, createdAt)
```

## Build in these phases — stop after each and show me it running

1. **Foundations** — scaffold; Auth.js Google login; Drizzle+Postgres; `User/Group/Membership`; role-gated layout (admin shell vs intern shell). Seed + `authorize` helper.
2. **Groups & roster** — admin CRUD groups; invite interns by email; an invited intern signs in and sees their group(s).
3. **Content** — Assignment create/edit (draft→publish, markdown, attachments, optional rubric) and Note CRUD; intern group home lists published assignments + notes.
4. **Submissions** — submit form accepting a mix of file/text/link/github items; edit until graded; server-derived status.
5. **Grading** — admin submission grid (status per intern) + grading screen (rubric scoring + comment thread); grading flips status to `graded`.
6. **Comms** — Resend emails + in-app notification bell for published/graded/comment/announcement; `/api/cron/due-soon` (guarded by `CRON_SECRET`) for due-soon nudges; announcements.
7. **Dashboards & ship** — intern "what's due across my groups"; admin overview (pending grading, upcoming due dates); empty states; mobile pass; deploy to Vercel with the seeded demo group.

## Explicitly OUT of scope for v1 (do not build; just leave clean seams)

GitHub diff/auto-grading, peer review, gamification, analytics dashboards, AI features,
certificates, office-hours booking. Store `github` submission metadata in `meta_json` so the
diff/auto-grade feature can attach later.

## Acceptance for v1 (definition of done)

An admin can sign in, create two groups, invite interns, publish an assignment (with a rubric) to
each, and interns — signed in with Google — can submit a mix of a file + a GitHub link + a text
note, then see the rubric score and written feedback the admin leaves. Emails and in-app
notifications fire on publish and on grade. Deployed to a live Vercel URL.

## First step

Confirm the stack choices, list the exact packages you'll install, generate the initial folder
structure and Drizzle schema, then pause for my go-ahead before Phase 1.
