# Product Requirements Document (PRD)

## Admission Copilot
**A guided, trustworthy path from O-level results to a confident admission decision**

| | |
|---|---|
| **Document Owner** | [Team Name] |
| **Track** | Education |
| **Status** | Draft — Hackathon MVP |
| **Version** | 2.0 |
| **Last Updated** | September 2026 |

---

## 1. Executive Summary

Admission Copilot helps prospective students in Nigeria (and similar markets) navigate the admission process without getting lost, misinformed, or priced out of guidance. It does three things well:

1. **Tells a student, correctly, whether they qualify** for a chosen course — computed from their O-level results against verified course requirements.
2. **Guides them through the process** (JAMB/UTME registration, POST-UTME) with clear, current, step-by-step instructions.
3. **Answers their questions and escalates the hard ones** to a human counselor with full context preserved.

The organizing principle of this product is **trust**. A wrong eligibility answer or a hallucinated deadline is worse than no answer at all — it can cost a student a place. So the architecture draws a hard line: **facts are deterministic and verified; the AI is a guide over those facts, never a source of them.** Eligibility is computed by code from a vetted rules table. Deadlines, requirements, and steps come from a versioned content store where every record carries a source and a "last verified" date. The AI presents, explains, and converses — it does not invent.

This is what separates Admission Copilot from a generic admissions chatbot.

---

## 2. Problem Statement

Every admission cycle, many otherwise qualified students in Nigeria fail to secure admission — not for lack of ability, but because the process defeats them:

- They don't understand JAMB/UTME registration or POST-UTME requirements for their chosen institutions.
- They pick courses or subject combinations that don't match their O-level results, and discover the mismatch too late to fix it.
- Institution portals are inconsistent, poorly documented, and change between cycles.
- Professional counseling is expensive and inaccessible, especially in rural and under-resourced areas.
- Official support channels (school offices, JAMB centers, institution help desks) are overwhelmed during peak periods.

The information *mostly exists* — but it is **fragmented across many sources, inconsistently presented, frequently out of date, and never delivered in the moment a specific student needs it for their specific situation.** Aggregating that information, structuring it, keeping it verified, and delivering it in context is therefore the core work of this product — not an afterthought. (See §9, Data & Trust Model, which treats content currency as a first-class, ongoing responsibility rather than a one-time load.)

---

## 3. Goals & Objectives

### 3.1 Primary Goals
1. Let a student determine, in minutes and **correctly**, whether they meet the requirements for a given course based on their O-level results.
2. Reduce admission-process drop-off with clear, current, step-by-step guidance through registration flows.
3. Provide grounded, real-time answers to admission questions without a paid counselor or a long support-line wait.
4. Escalate genuinely complex cases to a human, with full context, rather than leaving students stuck.

### 3.2 Non-Goals (Principles)
- We do **not** trade correctness for conversational flair. The eligibility engine must be right far more than it is charming.
- We do **not** gatekeep. Guidance informs the student's decision; the student always retains final choice.
- We do **not** let the AI generate facts it cannot ground in a verified source.

### 3.3 Success Criteria (Hackathon Demo)
- A student completes an end-to-end flow: select a course → check eligibility → get a guided registration walkthrough → ask a follow-up in chat → receive an escalation ticket for an edge case.
- The **eligibility engine returns a correct verdict on 100% of scripted test cases** (eligible / not eligible / partially eligible), including the tricky ones (missing English/Math, insufficient grade, wrong subject combination, results across too many sittings).
- The AI assistant answers scripted process questions **from grounded content**, and when asked something outside its verified knowledge, it says so and offers escalation rather than guessing.
- Judges can clearly see the trust boundary — where a deterministic answer comes from code and verified data vs. where the AI is conversing — and why that boundary matters.

---

## 4. Design Principles

These principles govern every feature decision below.

1. **Facts are computed or verified, never generated.** Eligibility verdicts come from code. Requirements, deadlines, cutoffs, and steps come from a versioned content store with source + last-verified metadata. The AI reads from these; it does not author them.
2. **Show your work.** Every eligibility verdict explains *why* (which subjects/grades passed or failed). Every fact shown carries a source link and a "last verified" date so students (and counselors) can trust and check it.
3. **Fail toward a human.** When the system is unsure or the case is unusual, it escalates with context rather than improvising an answer.
4. **Design for the actual user's device and connection.** Text-first, low-bandwidth, progressive. The people who need this most have the least bandwidth.
5. **Guidance, not gatekeeping.** Advisory signals never block a student from proceeding.

---

## 5. Target Users & Personas

| Persona | Description | Core Need |
|---|---|---|
| **The Uncertain Applicant** | SS3/final-year secondary student unsure which course/institution fits their results | Correct eligibility check + course guidance |
| **The First-Time Navigator** | Student registering for JAMB/POST-UTME for the first time | Clear, current step-by-step guidance |
| **The Under-Resourced Parent** | Parent assisting a child without access to paid counseling | Simple, jargon-free explanations |
| **The Edge Case** | Student with an unusual situation (result discrepancy, change of course, missed deadline) | Human escalation with context preserved |

**Access reality:** these users often browse on modest Android phones over metered, intermittent connections, and many are more comfortable in Nigerian Pidgin or a local language than in formal English. This is a design constraint, not a footnote (see §10, §11).

---

## 6. Scope

### 6.1 In Scope (Hackathon MVP)
- **Eligibility checker** for 2–3 sample courses at one institution, computed from a verified requirements table (the deterministic core — must be correct).
- **O-level result input** (typed entry; file upload as a stretch goal).
- **Guided walkthrough** of JAMB/UTME registration and one sample institution's POST-UTME flow, delivered as structured, current steps (text-first, images optional).
- **Grounded AI assistant** for open-ended questions, answering only from verified content and escalating when it can't.
- **Automatic ticket creation** for unresolved or complex queries, with a visible Ticket ID.
- **Human-handoff simulation** for escalated tickets.

### 6.2 Out of Scope (MVP)
- Live integration with actual JAMB or institutional systems (data is mocked/sample, but structured and source-tagged as if real).
- Payment processing for application fees.
- Multi-institution comparison engine.
- Native mobile app (web-first; Flutter noted as future work).
- Full multilingual support (English-first for the demo; Nigerian Pidgin is the priority next step — see §11).

---

## 7. User Stories

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US-1 | Applicant | enter my O-level subjects and grades | know **correctly** whether I qualify for my chosen course |
| US-2 | Applicant | see *why* I did or didn't qualify | understand exactly what's missing and what to do |
| US-3 | Applicant | follow a step-by-step, current guide for JAMB registration | avoid getting stuck or making mistakes |
| US-4 | Applicant | ask a question in chat at any point | get an instant, trustworthy answer without searching elsewhere |
| US-5 | Applicant | see the source and date of any deadline or requirement | trust the information and verify it if I want |
| US-6 | Applicant | upload my result slip | have it checked against course requirements automatically |
| US-7 | Applicant | be handed off to a real person for a complex issue | get help the AI can't fully resolve, without repeating myself |
| US-8 | Parent | understand the process in simple terms | support my child through admission without confusion |

---

## 8. Functional Requirements

### 8.1 Eligibility Checker (Deterministic Core)
This is the product's backbone and the feature that must be correct.

**Inputs**
- Target course (from a predefined list).
- O-level results: subject + grade pairs, plus the number of sittings they were obtained in (manual entry for MVP).

**Logic** — computed in code, not by the AI (see §9 for the data model):
- Map each grade to a credit/non-credit classification (A1–C6 = credit pass; D7–F9 = not a credit pass).
- Check the course's required subjects (e.g., English Language and Mathematics are near-universal) for credit passes.
- Check subject-group rules (e.g., "credit passes in at least two of Physics/Chemistry/Biology").
- Check the total credit-pass count meets the minimum (typically five).
- Check the results satisfy the maximum-sittings rule.
- Note the required **UTME subject combination** for the course (informational for MVP).

**Output** — one of:
- **Eligible** — all rules satisfied. Show which requirements were met.
- **Partially eligible** — core met but a gap exists (e.g., needs one more credit, or the right UTME combination). Explain precisely what's missing and the shortest path to fix it.
- **Not eligible** — a hard requirement is unmet (e.g., no credit in English or Math). Explain exactly which, and suggest realistic alternatives (a resit, or a course whose requirements the student *does* meet).

**Requirement:** every verdict is explainable at the individual-subject level. No "computer says no."

### 8.2 Guided Registration Walkthrough
- Structured, ordered steps for (a) JAMB/UTME registration and (b) one sample institution's POST-UTME flow.
- **Text-first**, so it works on slow connections; annotated screenshots are a progressive enhancement, lazy-loaded, never required to understand a step.
- Each walkthrough carries a **source** and **last-verified date**; stale content is flagged rather than shown as current (see §9).
- The student can ask "what does this step mean?" at any point and get a grounded explanation.

### 8.3 AI Assistant (Grounded & Constrained)
- Handles open-ended questions on subject combinations, deadlines, and process FAQs.
- **Retrieval-grounded:** the assistant answers only from the verified content store and the computed eligibility result. It is explicitly instructed and constrained **not to invent deadlines, cutoffs, or requirements.**
- When it lacks a grounded answer, it says so plainly and offers escalation — it does not guess.
- Facts in its answers carry the same source + last-verified provenance shown elsewhere.
- Streams responses with markdown formatting where the connection allows, and degrades gracefully to a single non-streamed response when it doesn't.

### 8.4 Document Upload
- Student can upload a result slip (image/PDF).
- Handled with data minimization: processed for the eligibility check and not retained beyond the session unless the student explicitly opts in (see §12).
- **Stretch goal:** parse the slip (OCR) to auto-populate the checker — with a mandatory human-confirm step, since a misread grade is a correctness risk.

### 8.5 Ticketing & Human Handoff
- When the AI can't resolve a query (disputed result, unusual eligibility case, missed-deadline situation), it raises a support ticket with a visible **Ticket ID**.
- The ticket carries **full context**: the student's inputs, the computed eligibility result, and the conversation — so the student never has to repeat themselves.
- Escalated conversations simulate a live human counselor takeover, demonstrating the handoff flow.

### 8.6 Course-Fit Reflection (Optional, Advisory)
A lightweight, **optional** layer on top of eligibility — reframed deliberately as *reflection*, not prediction.

- A short, optional set of prompts invites the student to reflect on the nature of their chosen course (e.g., "Courses like this involve a lot of lab work — how do you feel about that?", "This path is heavy on theory and reading — does that appeal to you?").
- The output is a set of **plain-language things to consider**, surfaced as a **non-blocking note** — never a score, a risk rating, or a dropout prediction. We do not claim to predict who will drop out; a short quiz cannot responsibly do that.
- Purpose: eligibility answers "can you get in?"; this adds a gentle "here's what this path is actually like — is that what you want?" prompt.
- Explicitly **guidance, not gatekeeping.** The student always proceeds if they choose to.
- The AI can optionally run this conversationally so it feels like part of the guidance, not a separate form.

---

## 9. Data & Trust Model (Core Differentiator)

The single most important design decision: **the boundary between computed/verified facts and AI conversation.**

### 9.1 The trust boundary
| Layer | Who produces it | Guarantee |
|---|---|---|
| **Eligibility verdict** | Deterministic code over the requirements table | Correct and explainable, every time |
| **Requirements, deadlines, cutoffs, steps** | Human-curated content store, versioned | Sourced and dated; flagged when stale |
| **Explanation & conversation** | AI assistant, grounded in the two layers above | Never the origin of a fact |

The AI is a *presenter and guide* over the first two layers. It cannot originate a deadline, a cutoff, or a requirement.

### 9.2 Content currency (owned, not assumed)
Because portals and requirements change every cycle, every fact record carries:
- `source` — the official URL or document it came from.
- `lastVerified` — the date a human last confirmed it.
- A **staleness policy**: records past a freshness threshold are shown with a "verify before relying on this" flag and routed for re-check, rather than presented as current.

This is how we resolve the tension in §2: the information exists, but keeping it structured and current is ongoing work we design for explicitly.

### 9.3 Illustrative data schema (MVP)
```
Grade         = A1 | B2 | B3 | C4 | C5 | C6 | D7 | E8 | F9
creditPass(g) = g in { A1, B2, B3, C4, C5, C6 }

CourseRequirement {
  courseId, courseName, institutionId
  minCredits:        integer            // e.g. 5
  maxSittings:       integer            // e.g. 2
  requiredSubjects:  [Subject]          // credit pass required, e.g. [English Language, Mathematics]
  subjectGroups:     [{ anyOf: [Subject], minCount: integer }]  // e.g. any 2 of {Physics, Chemistry, Biology}
  utmeSubjects:      [Subject]          // prescribed JAMB combination (English compulsory + 3)
  jambCutoff:        integer?           // informational
  postUtmeInfo:      string?            // informational
  source:            url
  lastVerified:      date
}

StudentResult {
  sittings: [{ examBody, subjects: [{ subject, grade }] }]
}
```

The eligibility engine is a pure function: `evaluate(StudentResult, CourseRequirement) -> Verdict + per-subject explanation`. Being pure, it is trivially unit-testable — which is how we hit the 100%-correct demo criterion.

---

## 10. Non-Functional Requirements

- **Correctness (highest priority):** the eligibility engine is covered by unit tests over a table of known cases; a wrong verdict is a release blocker.
- **Usability:** simple enough for first-time internet users; minimal jargon; every result explained in plain language.
- **Low-bandwidth performance:** text-first content, small payloads, lazy/optional images, cached static data, graceful degradation of streaming. The core eligibility flow must work on a slow 3G connection.
- **Reliability:** the eligibility flow and verified content work without any dependency on live third-party systems.
- **Accessibility:** legible typography, strong color contrast, usable on small/older Android screens.
- **Trust & transparency:** sources and last-verified dates visible on facts; verdicts explainable.
- **Scalability (post-hackathon):** adding courses/institutions is a data operation (new records in the requirements table), not a code rewrite.

---

## 11. Language & Localization

The target users are disproportionately more comfortable in Nigerian Pidgin or a local language than in formal English. English-first is a hackathon-timeline concession, not a product stance.

- **MVP:** English, written at a low-jargon reading level.
- **Highest-leverage next step: Nigerian Pidgin**, because it reaches the widest slice of the underserved audience for the least effort. This is prioritized above breadth of course coverage in the roadmap.
- **Later:** Hausa, Yoruba, Igbo.

Calling this out explicitly keeps the equity mission honest: the people who most need this shouldn't be the last served.

---

## 12. Privacy & Data Protection

Result slips and O-level data are **personal data** (names, exam numbers, grades). Even for a demo:

- **Data minimization:** collect only what the eligibility check needs.
- **Ephemerality:** uploaded slips are processed and discarded within the session unless the student explicitly opts in to save.
- **Consent & clarity:** the student is told what is collected, why, and for how long, in plain language.
- **Real-deployment note:** production must comply with the **Nigeria Data Protection Regulation (NDPR)** — lawful basis, retention limits, subject-access, and secure handling of uploaded documents. Flagged now so it isn't retrofitted later.

---

## 13. Technical Overview (Proposed)

The architecture puts our own trustworthy core first and treats the AI-engagement vendor as a delivery layer on top of it.

| Layer | Approach | Notes |
|---|---|---|
| **Eligibility engine** | Pure function over the requirements table (our code) | The correctness-critical core; unit-tested |
| **Verified content store** | Structured, versioned data with source + last-verified metadata | Course requirements, steps, deadlines, cutoffs |
| **AI assistant** | Retrieval-grounded chat, constrained to the content store + computed result | Chat, tickets, handoff, uploads can be delivered via a widget/SDK (e.g., Swift Agents) |
| **Frontend** | Responsive web app, text-first, mobile-browser optimized | Progressive enhancement for images/streaming |
| **Hosting** | Standard static/web hosting suitable for a demo | — |

**On the AI-engagement vendor:** a widget such as Swift Agents (web script with company ID + API key, streaming chat, tickets, human handoff, file uploads) is a reasonable way to deliver the conversational surface *without building chat infrastructure from scratch*. It is chosen to serve the design — it does not define it. The eligibility engine and verified content store remain ours, and the assistant is grounded in them regardless of the delivery vendor.

---

## 14. Success Metrics (Post-MVP Vision)

- **Eligibility correctness rate** (audited against ground truth) — the headline metric; target near-100%.
- % of users who complete an eligibility check.
- % who complete a guided registration walkthrough without dropping off.
- Average chat turns before resolution vs. escalation.
- % of shown facts within the freshness threshold (content-currency health).
- Ticket resolution time (in live deployment with real counselors).
- User-reported confidence in their admission choice (survey-based).

---

## 15. Risks & Assumptions

| Risk / Assumption | Impact | Mitigation |
|---|---|---|
| **AI states a wrong deadline/requirement (hallucination)** | Student misses a real deadline or misjudges eligibility — direct harm | Facts are computed or retrieved from the verified store only; AI constrained from generating facts; provenance shown; "I don't know — let me escalate" is a valid, designed answer |
| **Eligibility engine returns a wrong verdict** | Student wrongly abandons or wrongly pursues a course | Deterministic pure-function engine; unit-tested against a table of known cases; wrong verdict is a release blocker |
| **Verified content goes stale between cycles** | Correct-looking but outdated guidance | Source + last-verified on every record; staleness flag and re-check routing; currency treated as ongoing work |
| **Low-bandwidth / low-end-device users can't use it** | The intended audience is excluded | Text-first, small payloads, optional images, graceful degradation; core flow tested on slow connections |
| **English-only excludes part of the audience** | Equity mission undercut | Low-jargon English for MVP; Nigerian Pidgin prioritized as the first localization |
| **Uploaded result slips create privacy exposure** | PII risk; NDPR non-compliance in production | Data minimization, ephemeral processing, explicit consent; NDPR flagged for real deployment |
| **Judges equate "AI chatbot" with low technical depth** | Undersold demo | Lead with the trust architecture and the deterministic engine — the parts a generic chatbot doesn't have — not the chat |
| **Scope creep across many courses/institutions** | Unfinished MVP | Lock MVP to 2–3 courses and one institution; growth is a data operation, documented as roadmap |
| **Vendor widget setup consumes build time** | Late integration | Prepare sample config/content early; keep the eligibility core independent of the vendor so it works regardless |

---

## 16. Roadmap (Beyond Hackathon)

1. **Nigerian Pidgin support** (highest-leverage localization for the target audience).
2. Expand course/institution coverage (data-driven, no rewrite).
3. Robust result-slip OCR with human-confirm, feeding the checker.
4. Additional local languages (Hausa, Yoruba, Igbo).
5. Real, maintained content pipelines with a verification workflow for counselors/partners.
6. Counselor-backed human handoff at scale, via school/NGO partnerships.
7. Native app (Flutter) once the web experience is proven.

---

## 17. Appendix

- **Domain reference:** O-level grading (WAEC/NECO): A1–C6 are credit passes; typical requirement is five credits including English and Mathematics, within a limited number of sittings. UTME requires English plus three course-relevant subjects; courses prescribe specific combinations. These rules live in the verified requirements table, not in prose, so they can be kept current and tested.
- **AI-engagement delivery layer (optional):** [Swift Agents](https://swiftagents.org/en/products) — widget/SDK for chat, tickets, handoff, and uploads. Documentation: [docs.swiftagents.org](https://docs.swiftagents.org/). Used as a delivery layer over our own eligibility engine and verified content store, not as the product's foundation.
