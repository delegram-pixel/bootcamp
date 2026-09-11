# Product Requirements Document (PRD)

## Admission Copilot
**AI-Guided Admission & Enrollment Assistant for Prospective Students**

| | |
|---|---|
| **Document Owner** | [Team Name] |
| **Track** | Education |
| **Status** | Draft — Hackathon MVP |
| **Version** | 1.0 |
| **Last Updated** | September 2026 |

---

## 1. Executive Summary

Admission Copilot is a web application that guides prospective students through the post-secondary admission process — from checking course eligibility against O-level results, to registering for JAMB/UTME, to navigating institution-specific application portals. It embeds an AI support agent (Swift Agents) that provides real-time guidance, step-by-step visual walkthroughs, and escalation to human counselors when a case is too complex for automation.

The goal is to reduce the number of qualified students who miss out on admission opportunities due to confusing processes, unclear eligibility requirements, and lack of access to affordable, reliable counseling.

---

## 2. Problem Statement

Every admission cycle, a significant number of otherwise qualified students in Nigeria (and similar markets) fail to secure admission — not because they aren't capable, but because:

- They don't understand JAMB/UTME registration steps or POST-UTME requirements for their chosen institutions.
- They pick subject combinations or courses that don't match their O-level results, discovering the mismatch too late.
- Institution portals are inconsistent, poorly documented, and often confusing even for tech-literate users.
- Professional admission counseling is expensive and inaccessible to most students, especially in underserved and rural areas.
- Support channels (school offices, JAMB call centers, institution help desks) are overwhelmed during peak admission periods, leaving students without timely answers.

This is a systemic access and information problem, not a content problem — the information mostly exists, but it is fragmented, poorly presented, and not delivered when and where students need it.

---

## 3. Goals & Objectives

### 3.1 Primary Goals
1. Help students determine, in minutes, whether they meet the requirements for a given course based on their O-level results.
2. Reduce admission process drop-off by providing step-by-step, visual guidance through registration flows.
3. Provide real-time answers to admission questions without requiring a paid counselor or a long wait on a support line.
4. Escalate genuinely complex cases to a human, with full context, rather than leaving students stuck.

### 3.2 Success Criteria (Hackathon Demo)
- A student can complete an end-to-end flow: select a course → check eligibility → get a guided walkthrough of registration → ask a follow-up question in chat → receive an escalation ticket for an edge case.
- The AI agent correctly answers at least 90% of scripted demo questions related to eligibility and process steps.
- Judges can clearly see where Swift Agents' guided navigation, chat, ticketing, and file upload features are used and why each was chosen.

---

## 4. Target Users & Personas

| Persona | Description | Core Need |
|---|---|---|
| **The Uncertain Applicant** | SS3/final-year secondary student unsure which course/institution fits their results | Clear eligibility check + course guidance |
| **The First-Time Navigator** | Student registering for JAMB/POST-UTME for the first time | Step-by-step guided navigation |
| **The Under-Resourced Parent** | Parent assisting a child through the process without access to paid counseling | Simple, jargon-free explanations |
| **The Edge Case** | Student with an unusual situation (result discrepancy, change of course, missed deadline) | Human escalation with context preserved |

---

## 5. Scope

### 5.1 In Scope (Hackathon MVP)
- Course selection and eligibility checker (2–3 sample courses/institutions)
- O-level result input (typed entry; file upload as a stretch goal)
- Guided, annotated walkthrough of JAMB/UTME registration and one sample institution's POST-UTME portal
- Embedded AI chat widget for open-ended admission questions
- Automatic ticket creation for unresolved or complex queries
- Human handoff simulation for escalated tickets

### 5.2 Out of Scope (MVP)
- Live integration with the actual JAMB or institutional systems (data will be mocked/sample)
- Payment processing for application fees
- Multi-institution comparison engine
- Native mobile app (web-first for hackathon; Flutter SDK noted as future work)
- Full multilingual support (English-first; local language support noted as future work)

---

## 6. User Stories

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US-1 | Applicant | enter my O-level subjects and grades | know if I qualify for my chosen course |
| US-2 | Applicant | see a step-by-step guide with screenshots for JAMB registration | avoid getting stuck or making mistakes |
| US-3 | Applicant | ask a question in chat at any point | get an instant answer without searching elsewhere |
| US-4 | Applicant | upload my result slip | have it checked against course requirements automatically |
| US-5 | Applicant | be handed off to a real person for a complex issue | get help the AI can't fully resolve |
| US-6 | Parent | understand the process in simple terms | support my child through admission without confusion |

---

## 7. Functional Requirements

### 7.1 Eligibility Checker
- User selects a target course from a predefined list.
- User inputs O-level subjects and grades (manual entry for MVP).
- System compares input against course requirements and returns:
  - Eligible / Not eligible / Partially eligible (with explanation)
  - Missing or insufficient subjects, if any

### 7.2 Guided Registration Walkthrough
- Powered by Swift Agents' guided navigation feature.
- Pre-configured, annotated screenshots for:
  - JAMB/UTME registration steps
  - One sample institution's POST-UTME application flow
- User can request "show me how" at any step and receive a visual walkthrough.

### 7.3 AI Chat Assistant
- Embedded via the Swift Agents web widget (script tag with company ID and API key).
- Handles open-ended questions on:
  - Subject combinations
  - Application deadlines
  - General process FAQs
- Streams responses in real time with markdown formatting.

### 7.4 Document Upload
- Student can upload a result slip (image/PDF) via the widget's file upload capability.
- Stretch goal: parse uploaded results to auto-populate the eligibility checker.

### 7.5 Ticketing & Human Handoff
- If the AI cannot resolve a query (e.g., disputed result, unusual eligibility case), it automatically raises a support ticket with a visible Ticket ID.
- Escalated conversations simulate a human counselor responding live, demonstrating the handoff flow.

### 7.6 Persona & Interest Profiling (Secondary Feature)
This is a lightweight, supplementary layer on top of the eligibility checker — not a core dependency of the MVP flow.

- A short, optional quiz captures the student's likes, dislikes, and interests (e.g., preference for hands-on work vs. theory, subjects enjoyed vs. subjects merely passed, extracurricular interests).
- The system builds a simple interest persona and compares it against the demands/nature of the student's chosen course.
- If a student is *eligible* for a course but their interest profile suggests low alignment (e.g., strong dislike of lab work paired with a science-heavy course), the app surfaces a **non-blocking advisory note** — flagging a potential engagement/dropout risk without stopping the student from proceeding.
- Purpose: eligibility answers "can you get in?"; the persona layer adds a soft signal for "are you likely to enjoy and stick with it?" — helping reduce course-switching and dropout later in the academic journey.
- Explicitly framed as guidance, not gatekeeping — the student always retains final choice.
- The AI chat agent can optionally conduct this quiz conversationally, making it feel like a natural part of the guidance flow rather than a separate form.

---

## 8. Swift Agents Integration Map

| Swift Agents Feature | Application in Admission Copilot |
|---|---|
| Web widget (script tag, company ID + API key) | Embedded across the applicant-facing portal |
| Streaming AI chat | Real-time Q&A on eligibility, deadlines, process |
| Guided navigation with annotated screenshots | Step-by-step JAMB/POST-UTME walkthroughs |
| Support tickets | Escalation path for unresolved or complex cases |
| Human handoff | Live counselor takeover for edge cases |
| File uploads | Result slip / document submission |

---

## 9. Non-Functional Requirements

- **Usability:** Interface must be simple enough for first-time internet users; minimal jargon.
- **Performance:** Chat responses should stream with low perceived latency for a smooth demo.
- **Reliability:** Core eligibility-check flow must work without dependency on live third-party systems.
- **Accessibility:** Legible typography and color contrast suitable for varied devices and connection speeds.
- **Scalability (post-hackathon):** Architecture should allow additional courses/institutions to be added without a full rebuild.

---

## 10. Technical Overview (Proposed)

| Layer | Approach |
|---|---|
| Frontend | Web app (React or similar), responsive design for mobile browsers |
| AI Support Layer | Swift Agents Widget (web script) configured with sample company/dashboard data |
| Data | Static/mock dataset for course requirements and institution steps (MVP); structured for future real data source |
| Hosting | Any standard static/web hosting suitable for a hackathon demo |

---

## 11. Success Metrics (Post-MVP Vision)

- % of users who complete an eligibility check
- % of users who complete a guided registration walkthrough without dropping off
- Average number of chat turns before resolution vs. escalation
- Ticket resolution time (in a live deployment with real counselors)
- User-reported confidence in their admission choice (survey-based)

---

## 12. Risks & Assumptions

| Risk / Assumption | Mitigation |
|---|---|
| Swift Agents widget requires configuration time (company ID, API key, content) | Prepare sample company/dashboard content and screenshots early in the build |
| Real JAMB/institutional data is not accessible in hackathon timeframe | Use a small, well-chosen set of mock courses/institutions for a convincing demo |
| Judges may equate "AI chatbot" with low technical depth | Emphasize the breadth of Swift features used (guided nav, tickets, handoff, uploads), not just chat |
| Scope creep across multiple institutions/courses | Lock MVP to 2–3 courses and one institution's flow; document rest as roadmap |

---

## 13. Roadmap (Beyond Hackathon)

- Expand course/institution coverage
- Integrate real result-slip parsing (OCR) for automatic eligibility checks
- Add multilingual chat support (English + local languages)
- Migrate to Flutter Mobile SDK for a native app experience
- Partner with schools/NGOs for counselor-backed human handoff at scale

---

## 14. Appendix

- **Reference platform:** [Swift Agents](https://swiftagents.org/en/products) — AI-powered customer engagement widget and SDK
- **Documentation:** [docs.swiftagents.org](https://docs.swiftagents.org/)

swift is very important