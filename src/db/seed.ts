/**
 * Seed data for the Intern Portal.
 *
 * Creates the cast from BUILD_PROMPT: 1 admin, 4 interns, 2 groups, four
 * published assignments (one with a rubric), notes, and a spread of sample
 * submissions — including several fully graded submissions (one with a comment
 * thread) so the whole post → submit → grade → feedback loop, and the derived
 * standing / XP / badges, are all visible immediately after seeding.
 *
 * IDs are fixed and deterministic so re-seeding is idempotent and dev-login
 * sessions (which carry a user id in the JWT) stay valid across reseeds.
 *
 * Runs against whatever `@/db` resolves to — the local PGlite dev database, or
 * a real Postgres when DATABASE_URL is set.
 */
import bcrypt from "bcryptjs";

import { db, schema } from "@/db";
import { features } from "@/lib/env";

const {
  users,
  groups,
  memberships,
  assignments,
  assignmentAttachments,
  rubrics,
  rubricCriteria,
  submissions,
  submissionItems,
  grades,
  criterionScores,
  comments,
  notes,
  announcements,
  notifications,
} = schema;

const now = new Date();
const days = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

/**
 * A KNOWN, INSECURE password shared by every seeded account — fine for a demo
 * database, never for real users. Printed at the end of the seed so you can log
 * in immediately. Real (admin-created) accounts set their own via the email link.
 */
const DEMO_PASSWORD = "portal1234";

async function main() {
  console.log(
    features.localDb
      ? "Seeding local PGlite database…"
      : "Seeding remote database…",
  );

  await db.transaction(async (tx) => {
    // Wipe in child → parent order so FK constraints never trip.
    await tx.delete(notifications);
    await tx.delete(criterionScores);
    await tx.delete(grades);
    await tx.delete(comments);
    await tx.delete(submissionItems);
    await tx.delete(submissions);
    await tx.delete(rubricCriteria);
    await tx.delete(rubrics);
    await tx.delete(assignmentAttachments);
    await tx.delete(assignments);
    await tx.delete(announcements);
    await tx.delete(notes);
    await tx.delete(memberships);
    await tx.delete(schema.sessions);
    await tx.delete(schema.accounts);
    await tx.delete(groups);
    await tx.delete(users);

    /* ---------------------------------------------------------- users */
    // Every seeded account shares one known demo password, hashed exactly the
    // way the app hashes real ones. Demo-only — see DEMO_PASSWORD above.
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    await tx.insert(users).values([
      { id: "u-admin", name: "Alex Mentor", email: "admin@example.com", role: "admin", passwordHash },
      { id: "u-ava", name: "Ava Chen", email: "ava@example.com", role: "intern", passwordHash },
      { id: "u-ben", name: "Ben Ortiz", email: "ben@example.com", role: "intern", passwordHash },
      { id: "u-cara", name: "Cara Okafor", email: "cara@example.com", role: "intern", passwordHash },
      { id: "u-dan", name: "Dan Park", email: "dan@example.com", role: "intern", passwordHash },
    ]);

    /* --------------------------------------------------------- groups */
    await tx.insert(groups).values([
      {
        id: "g-fe",
        name: "Frontend Cohort",
        description: "Interns learning HTML, CSS, and React fundamentals.",
        status: "active",
      },
      {
        id: "g-be",
        name: "Backend Cohort",
        description: "Interns building APIs, databases, and services.",
        status: "active",
      },
    ]);

    /* ---------------------------------------------------- memberships */
    // Admin mentors both cohorts; Ava is in both (interns can belong to several).
    await tx.insert(memberships).values([
      { userId: "u-admin", groupId: "g-fe", roleInGroup: "mentor" },
      { userId: "u-admin", groupId: "g-be", roleInGroup: "mentor" },
      { userId: "u-ava", groupId: "g-fe", roleInGroup: "intern" },
      { userId: "u-ava", groupId: "g-be", roleInGroup: "intern" },
      { userId: "u-ben", groupId: "g-fe", roleInGroup: "intern" },
      { userId: "u-cara", groupId: "g-be", roleInGroup: "intern" },
      { userId: "u-dan", groupId: "g-fe", roleInGroup: "intern" },
    ]);

    /* ---------------------------------------------------- assignments */
    await tx.insert(assignments).values([
      {
        id: "a-html",
        groupId: "g-fe",
        title: "Build a semantic landing page",
        descriptionMd:
          "Build a responsive landing page using **semantic HTML** and modern CSS.\n\n" +
          "- Use appropriate landmark elements (`header`, `nav`, `main`, `footer`)\n" +
          "- Make it responsive down to 360px\n" +
          "- Score 90+ on Lighthouse accessibility\n\n" +
          "Submit a link to your deployed page **and** the repo.",
        dueAt: days(-2),
        points: 25,
        status: "published",
        publishedAt: days(-9),
        createdById: "u-admin",
      },
      {
        id: "a-api",
        groupId: "g-be",
        title: "Design a REST API for a todo service",
        descriptionMd:
          "Design and document a REST API for a simple todo service.\n\n" +
          "- CRUD for todos\n- Sensible status codes\n- A short README describing the endpoints",
        dueAt: days(1),
        status: "published",
        publishedAt: days(-3),
        createdById: "u-admin",
      },
      {
        id: "a-css",
        groupId: "g-fe",
        title: "Style a component library with CSS",
        descriptionMd:
          "Build a small, reusable component library with modern CSS.\n\n" +
          "- Buttons, cards, and form inputs\n- Consistent spacing scale and tokens\n- A light/dark theme toggle",
        dueAt: days(-7),
        points: 20,
        status: "published",
        publishedAt: days(-20),
        createdById: "u-admin",
      },
      {
        id: "a-js",
        groupId: "g-fe",
        title: "Add interactivity with vanilla JS",
        descriptionMd:
          "Add keyboard-accessible interactivity without a framework.\n\n" +
          "- A tabs widget and a modal dialog\n- Full keyboard support and focus management\n- No external libraries",
        dueAt: days(-1),
        points: 30,
        status: "published",
        publishedAt: days(-20),
        createdById: "u-admin",
      },
    ]);

    await tx.insert(assignmentAttachments).values([
      {
        assignmentId: "a-html",
        kind: "link",
        label: "Design reference (Figma)",
        url: "https://www.figma.com/file/example-landing",
      },
    ]);

    /* --------------------------------------------- rubric for a-html */
    await tx.insert(rubrics).values([{ id: "r-html", assignmentId: "a-html" }]);
    await tx.insert(rubricCriteria).values([
      { id: "rc-1", rubricId: "r-html", label: "Semantic structure", maxPoints: 10, order: 0 },
      { id: "rc-2", rubricId: "r-html", label: "Responsive CSS", maxPoints: 10, order: 1 },
      { id: "rc-3", rubricId: "r-html", label: "Accessibility", maxPoints: 5, order: 2 },
    ]);

    /* ----------------------------------------------------- notes */
    await tx.insert(notes).values([
      {
        id: "n-welcome",
        groupId: null, // global — visible to everyone
        title: "Welcome to the bootcamp",
        bodyMd:
          "Welcome! This portal is where you'll find **notes**, **tasks**, and your **feedback**.\n\n" +
          "1. Check your Dashboard for what's due\n2. Submit work as a link, file, text, or GitHub repo\n3. Watch for graded feedback and comments",
        week: "Week 0",
        weekNumber: 0,
        topic: "Orientation",
        createdById: "u-admin",
      },
      {
        id: "n-fe-semantics",
        groupId: "g-fe",
        title: "HTML semantics cheatsheet",
        bodyMd:
          "Prefer meaningful elements over `div` soup:\n\n" +
          "- `header`, `nav`, `main`, `section`, `article`, `aside`, `footer`\n" +
          "- One `h1` per page; don't skip heading levels\n" +
          "- Buttons for actions, links for navigation",
        week: "Week 1",
        weekNumber: 1,
        topic: "HTML",
        createdById: "u-admin",
      },
    ]);

    /* ---------------------------------------------- announcements */
    await tx.insert(announcements).values([
      {
        id: "an-welcome",
        groupId: null, // global — everyone sees it
        authorId: "u-admin",
        bodyMd:
          "👋 **Welcome to the cohort!** Office hours are Tuesdays at 4pm. " +
          "Check the **Tasks** on your dashboard and don't hesitate to ask questions in the comment thread on any submission.",
        createdAt: days(-3),
      },
      {
        id: "an-fe-kickoff",
        groupId: "g-fe",
        authorId: "u-admin",
        bodyMd:
          "Frontend crew — your first task (**semantic landing page**) is live. " +
          "Aim to submit a day early so there's time to act on feedback.",
        createdAt: days(-1),
      },
    ]);

    /* ----------------------------------------------- submissions */
    await tx.insert(submissions).values([
      // Ava: three graded submissions across three consecutive weeks — powers a
      // streak plus enough graded, varied work for the high-flyer / polyglot /
      // perfect-score badges and a higher level than Ben.
      { id: "s-ava-html", assignmentId: "a-html", internId: "u-ava", status: "graded", submittedAt: days(-16) },
      { id: "s-ava-css", assignmentId: "a-css", internId: "u-ava", status: "graded", submittedAt: days(-9) },
      { id: "s-ava-js", assignmentId: "a-js", internId: "u-ava", status: "graded", submittedAt: days(-2) },
      { id: "s-ben-html", assignmentId: "a-html", internId: "u-ben", status: "graded", submittedAt: days(-4) },
      { id: "s-cara-api", assignmentId: "a-api", internId: "u-cara", status: "submitted", submittedAt: days(-1) },
      { id: "s-dan-html", assignmentId: "a-html", internId: "u-dan", status: "draft" },
    ]);

    await tx.insert(submissionItems).values([
      // Ava: a GitHub repo (metaJson is the seam for future diff/auto-grade) + a note.
      {
        submissionId: "s-ava-html",
        kind: "github",
        url: "https://github.com/ava/landing-page/pull/3",
        content: "PR #3 — semantic landing page",
        metaJson: { repo: "ava/landing-page", prNumber: 3, commitSha: "a1b2c3d" },
      },
      {
        submissionId: "s-ava-html",
        kind: "text",
        content: "Deployed at https://ava-landing.vercel.app — feedback welcome on the mobile nav.",
      },
      // Ava's later submissions use different formats — enough kinds for Polyglot.
      {
        submissionId: "s-ava-css",
        kind: "file",
        url: "https://utfs.io/f/example-ava-components.zip",
        fileKey: "example-ava-components.zip",
        content: "component-library.zip",
        mime: "application/zip",
        size: 96_500,
      },
      {
        submissionId: "s-ava-js",
        kind: "link",
        url: "https://ava-interactive.vercel.app",
        content: "Live demo — keyboard-accessible tabs + modal",
      },
      // Ben: an uploaded file (mock UploadThing url/key).
      {
        submissionId: "s-ben-html",
        kind: "file",
        url: "https://utfs.io/f/example-ben-landing.zip",
        fileKey: "example-ben-landing.zip",
        content: "landing-page.zip",
        mime: "application/zip",
        size: 148_320,
      },
      // Cara: an external link + note.
      {
        submissionId: "s-cara-api",
        kind: "link",
        url: "https://www.notion.so/cara/todo-api-design",
        content: "API design doc",
      },
      {
        submissionId: "s-cara-api",
        kind: "text",
        content: "Documented all 5 endpoints with example requests and responses.",
      },
      // Dan: a work-in-progress draft.
      {
        submissionId: "s-dan-html",
        kind: "text",
        content: "Still working on the responsive breakpoints — will add the repo link before the deadline.",
      },
    ]);

    /* -------------------------------------- grade + feedback (Ben) */
    await tx.insert(grades).values([
      { id: "gr-ben", submissionId: "s-ben-html", score: 21, gradedById: "u-admin", gradedAt: days(-2) },
      { id: "gr-ava-html", submissionId: "s-ava-html", score: 24, gradedById: "u-admin", gradedAt: days(-14) },
      { id: "gr-ava-css", submissionId: "s-ava-css", score: 20, gradedById: "u-admin", gradedAt: days(-7) },
      { id: "gr-ava-js", submissionId: "s-ava-js", score: 28, gradedById: "u-admin", gradedAt: days(-1) },
    ]);
    await tx.insert(criterionScores).values([
      { gradeId: "gr-ben", criterionId: "rc-1", points: 9, comment: "Great use of landmarks." },
      { gradeId: "gr-ben", criterionId: "rc-2", points: 8, comment: "Breakpoints solid; watch the 768px gap." },
      { gradeId: "gr-ben", criterionId: "rc-3", points: 4, comment: "Add alt text to the hero image." },
      { gradeId: "gr-ava-html", criterionId: "rc-1", points: 10, comment: "Textbook landmark structure." },
      { gradeId: "gr-ava-html", criterionId: "rc-2", points: 9, comment: "Fluid down to 320px — nicely done." },
      { gradeId: "gr-ava-html", criterionId: "rc-3", points: 5, comment: "Full marks: labels, alt text, and contrast all there." },
    ]);
    await tx.insert(comments).values([
      {
        submissionId: "s-ben-html",
        authorId: "u-admin",
        bodyMd: "Nice work, Ben! Tighten the header semantics and you're basically there.",
        createdAt: days(-2),
      },
      {
        submissionId: "s-ben-html",
        authorId: "u-ben",
        bodyMd: "Thanks! I'll fix the header and re-check the hero alt text.",
        createdAt: days(-1),
      },
    ]);

    /* --------------------------------------------- notifications */
    await tx.insert(notifications).values([
      { userId: "u-ben", type: "graded", payloadJson: { title: "Build a semantic landing page", submissionId: "s-ben-html" } },
      { userId: "u-ava", type: "assignment_published", payloadJson: { title: "Build a semantic landing page" }, readAt: days(-8) },
      { userId: "u-cara", type: "due_soon", payloadJson: { title: "Design a REST API for a todo service" } },
    ]);
  });

  console.log("✓ Seed complete");
  console.log(`  Password for all seeded accounts: ${DEMO_PASSWORD}`);
  console.log("  Admin login:   admin@example.com");
  console.log("  Intern logins: ava@example.com, ben@example.com, cara@example.com, dan@example.com");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
