import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Markdown,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import { env } from "@/lib/env";

const APP = env.APP_URL.replace(/\/$/, "");
const url = (path: string) => `${APP}${path.startsWith("/") ? path : `/${path}`}`;

/* ------------------------------------------------------------------ styles */

const main = {
  backgroundColor: "#f4f4f5",
  fontFamily:
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  padding: "24px 0",
};
const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #e4e4e7",
  borderRadius: "12px",
  margin: "0 auto",
  maxWidth: "480px",
  padding: "32px",
};
const h1 = { color: "#18181b", fontSize: "20px", fontWeight: 600, margin: "0 0 16px" };
const para = { color: "#3f3f46", fontSize: "14px", lineHeight: "22px", margin: "0 0 12px" };
const button = {
  backgroundColor: "#18181b",
  borderRadius: "8px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: 600,
  padding: "10px 18px",
  textDecoration: "none",
};
const hr = { borderColor: "#e4e4e7", margin: "24px 0 16px" };
const footer = { color: "#a1a1aa", fontSize: "12px", margin: 0 };

/* ------------------------------------------------------------------- shell */

function Shell({
  preview,
  heading,
  children,
  cta,
}: {
  preview: string;
  heading: string;
  children: React.ReactNode;
  cta?: { href: string; label: string };
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{heading}</Heading>
          {children}
          {cta ? (
            <Section style={{ marginTop: "20px" }}>
              <Button href={cta.href} style={button}>
                {cta.label}
              </Button>
            </Section>
          ) : null}
          <Hr style={hr} />
          <Text style={footer}>
            <Link href={url("/dashboard")} style={{ color: "#a1a1aa" }}>
              Intern Portal
            </Link>{" "}
            · You’re receiving this because you’re enrolled in a cohort.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const hi = (name?: string | null) => (name ? `Hi ${name.split(" ")[0]},` : "Hi,");

/* --------------------------------------------------------------- templates */

export function GradedEmail({
  name,
  assignmentTitle,
  score,
  total,
  assignmentId,
}: {
  name?: string | null;
  assignmentTitle: string;
  score: number;
  total: number | null;
  assignmentId: string;
}) {
  return (
    <Shell
      preview={`Your submission for ${assignmentTitle} was graded`}
      heading="Your submission was graded"
      cta={{ href: url(`/assignments/${assignmentId}`), label: "View feedback" }}
    >
      <Text style={para}>{hi(name)}</Text>
      <Text style={para}>
        <strong>{assignmentTitle}</strong> has been graded. You scored{" "}
        <strong>
          {score}
          {total != null ? ` / ${total}` : ""}
        </strong>
        . Open the assignment to read your mentor’s feedback and rubric notes.
      </Text>
    </Shell>
  );
}

export function ReturnedEmail({
  name,
  assignmentTitle,
  assignmentId,
}: {
  name?: string | null;
  assignmentTitle: string;
  assignmentId: string;
}) {
  return (
    <Shell
      preview={`${assignmentTitle} was sent back for revision`}
      heading="Sent back for revision"
      cta={{ href: url(`/assignments/${assignmentId}`), label: "Revise submission" }}
    >
      <Text style={para}>{hi(name)}</Text>
      <Text style={para}>
        Your mentor sent <strong>{assignmentTitle}</strong> back for revision. Check the
        comment thread for what to change, then resubmit.
      </Text>
    </Shell>
  );
}

export function AssignmentPublishedEmail({
  name,
  assignmentTitle,
  groupName,
  dueText,
  assignmentId,
}: {
  name?: string | null;
  assignmentTitle: string;
  groupName: string;
  dueText?: string | null;
  assignmentId: string;
}) {
  return (
    <Shell
      preview={`New assignment: ${assignmentTitle}`}
      heading="New assignment posted"
      cta={{ href: url(`/assignments/${assignmentId}`), label: "Open assignment" }}
    >
      <Text style={para}>{hi(name)}</Text>
      <Text style={para}>
        A new assignment is live in <strong>{groupName}</strong>:{" "}
        <strong>{assignmentTitle}</strong>.
        {dueText ? ` ${dueText}.` : ""}
      </Text>
    </Shell>
  );
}

export function DueSoonEmail({
  name,
  assignmentTitle,
  dueText,
  assignmentId,
}: {
  name?: string | null;
  assignmentTitle: string;
  dueText: string;
  assignmentId: string;
}) {
  return (
    <Shell
      preview={`Due soon: ${assignmentTitle}`}
      heading="An assignment is due soon"
      cta={{ href: url(`/assignments/${assignmentId}`), label: "Submit your work" }}
    >
      <Text style={para}>{hi(name)}</Text>
      <Text style={para}>
        Heads up — <strong>{assignmentTitle}</strong> is {dueText} and you haven’t
        submitted yet. Get your work in before the deadline.
      </Text>
    </Shell>
  );
}

export function AnnouncementEmail({
  audience,
  bodyMd,
}: {
  audience: string;
  bodyMd: string;
}) {
  return (
    <Shell
      preview={`Announcement for ${audience}`}
      heading={`Announcement · ${audience}`}
      cta={{ href: url("/announcements"), label: "View announcements" }}
    >
      <Markdown
        markdownContainerStyles={{ color: "#3f3f46", fontSize: "14px", lineHeight: "22px" }}
      >
        {bodyMd}
      </Markdown>
    </Shell>
  );
}

export function PasswordResetEmail({
  name,
  url: link,
}: {
  name?: string | null;
  url: string;
}) {
  return (
    <Shell
      preview="Set your Intern Portal password"
      heading="Set your password"
      cta={{ href: link, label: "Set password" }}
    >
      <Text style={para}>{hi(name)}</Text>
      <Text style={para}>
        Use the button below to set a new password for your Intern Portal account.
        The link is single-use and expires soon — if it stops working, request a
        fresh one from the “Forgot password?” link on the sign-in page.
      </Text>
      <Text style={{ ...para, color: "#a1a1aa" }}>
        If you didn’t expect this, you can safely ignore this email.
      </Text>
    </Shell>
  );
}
