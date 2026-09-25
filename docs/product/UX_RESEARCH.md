# SAMADHAN — UX Research

Compiled 2026-09-25 from public sources: government grievance portals (CPGRAMS /
pgportal.gov.in, state RTI and KSRTC grievance flows), civic-tech literature
(Digital.gov, GovTech, e-government studies), form-usability research
(NN/g web-form guidelines), and public discussion threads (Reddit r/indiasocial,
consumer forums) on complaint-portal experiences. This is directional research,
not a controlled study; confidence reflects evidence strength.

## Observations

| # | Source | Problem | User impact | Existing pattern | Samadhan improvement | Confidence |
|---|--------|---------|-------------|------------------|----------------------|------------|
| 1 | GovTech (2026), "Why are government applications left unfinished" | Form design itself triggers privacy discomfort → abandonment mid-form | Users drop out rather than reveal identity/phone | Progressive disclosure; explicit "why we need this" microcopy | Phone is already optional and labelled; add one-line "only used for depot callbacks, never published" under the field (partially present on Review page) | High |
| 2 | NN/g form guidelines | Long single-page forms with irrelevant fields | Overwhelm, skip, submit garbage | Multi-step wizards with progress | 3-step flow (Details → Route → Review) already matches; keep fields per step ≤5 | High |
| 3 | CPGRAMS user threads (Facebook/Quora/Reddit) | Registration ID shown once, lost → tracking impossible | Users can't check status, re-file duplicates | Email/SMS the reference; portal account history | Reference ID is permanent + /track + /my + web account panel; **gap: web file-success page should prompt to save/copy the ID** | High |
| 4 | CPGRAMS discussions | Status opaque after filing ("resolved" without user-visible action) | Distrust, re-complaints, escalation via Twitter | Status history timeline | Status-history timeline already on /track; audit_log (migration 011) now backs it operationally | Medium |
| 5 | GovTech UX trust study (2025) | Jargon (verbatim department names, field codes) | Wrong-category filings, triage load | Plain-language categories with icons | 9 icon categories already plain-language; bot uses same labels cross-channel | High |
| 6 | Form-abandonment analyses (Loqate 2026, YourCX 2026) | Error-on-submit-only; users fix one field at a time through full re-validation | Rage-quits at step N of N | Inline validation on blur | FileComplaint validates per step; keep error copy actionable ("add the destination stop") | Medium |
| 7 | Mobile-first India usage (gov UXDt case studies) | Desktop-oriented portals on phones | Typing burden → abandonment | Big touch targets, minimal typing | Bot flow is tap-first (buttons, ticket photo, voice note); web flow minimal-typing with route autocomplete | High |
| 8 | Consumer forums (duplicate filing) | No feedback after submit → user submits again | Duplicate workload, conflicting records | Idempotent submit + confirmation screen | Idempotency key (011) + success page showing the reference — **implemented this pass** | High |
| 9 | Civic-tech pattern (311-style systems) | Users don't know which authority handles what | Wrong-depot complaints, manual re-routing | Auto-routing by data | Route→depot dataset mapping already automatic; needs_triage is the honest fallback, never a guess | High |

## Priority gaps worth a follow-up

1. Success page: add a prominent "copy reference" affordance and a WhatsApp/TG
   share of `KSRTC-…` (addresses #3; cheap, high value).
2. Review step: show SLA due date ("depot must respond by …") — sets the
   expectation the status timeline then has to meet (#4).
3. Post-resolution feedback prompt on /track when status = resolved (#4).

## What we deliberately did NOT adopt

- Mandatory sign-up before filing (friction with no proven benefit for
  anonymous grievance filing; Clerk sign-in stays optional and value-linked).
- Chat-style freeform-only web filing — bot already covers conversational
  filing; web form benefits from structure.
- Rating the depot publicly on the track page (single-anonymous-review abuse;
  out of scope for a grievance system).
