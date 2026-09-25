# Why This Matters

The non-technical case for this transformation — for maintainers, for the
hackathon judges, for KSRTC stakeholders, and for the passengers whose
complaints this system exists to carry. (The engineering detail lives in
[WHAT_WE_ARE_DOING.md](WHAT_WE_ARE_DOING.md); the decision reasoning in
[WHY_WE_DID_IT.md](WHY_WE_DID_IT.md).)

## For the passenger

A complaint is an act of trust: "I believe reporting this is worth my time."
That trust survives only if the system behaves predictably:

- **A complaint cannot be silently duplicated.** A shaky-network retry used to
  be able to file the same grievance twice — now the second attempt simply
  returns the first reference ID.
- **You can see the depot working.** Operator notes ("crew cleaned the bay")
  now appear in the tracking timeline, so "in review" is a human process, not
  a black box.
- **Your data is yours.** Reading a chat's complaint history requires proving
  the account is yours; tracking responses expose no phone, no description,
  no location.
- **You cannot lose your draft to a mis-tap.** Cancel asks first.

Each of these is small; together they decide whether a first-time user
finishes the flow. That is the difference between a demo and a public service.

## For the depot and transport authority

- **Statuses are finally writable** — officers record real actions with notes,
  and the DB itself refuses impossible transitions (no "resolved" complaint
  going back to "submitted" by accident).
- **Channel analytics are real** — `source_channel` splits web vs Telegram vs
  WhatsApp volumes, so outreach investment follows evidence.
- **Every consequential action is auditable** — who changed what, when, under
  which request ID. Disputes and audits stop being archaeology.
- **The dashboard reflects truth** — SLA breaches, escalations, and triage
  queues are computed from the same rows the passengers see.

## For the team (the six-month test)

> "Another engineer can understand, test, debug, deploy and modify this six
> months from now."

- One filing pipeline means one place to fix or extend (WhatsApp evidence
  uploads? one RPC parameter away).
- 52 automated tests + typecheck + clean builds make changes *cheap to
  attempt* — the CI typecheck was broken before; a red build normalizes
  ignoring red builds.
- Deployment is a runbook, not folklore (`docs/operations/DEPLOYMENT.md`).
- Known gaps are written down honestly (`KNOWN_LIMITATIONS.md`) instead of
  being rediscovered in production.

## For the project's credibility

Samadhan asks a public transport corporation to route citizen grievances
through this software. Before this pass, the honest answer to "what happens
when a user double-submits / a webhook is forged / an officer typos a status?"
was "we don't know." Now each answer is written, enforced in the database,
and covered by a test. That is the minimum bar for calling software
*grievance infrastructure* rather than a prototype.

## The principle we optimized for

Not "the demo works" — **"a real user can reliably file a complaint, and a
real officer can reliably resolve it."** Every item in
[WHAT_WE_ARE_DOING.md](WHAT_WE_ARE_DOING.md) exists to remove one specific way
that reliability could fail.
