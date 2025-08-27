# ADR-0002: Reminder Delivery Strategy (Cron vs Job Queue)

## Status
Proposed | Accepted | Rejected | Superseded by

## Context
- Summarize why we need reminders and current product/technical constraints.
- State scale assumptions, SLO (1–2h OK), stack, and UX rules (1 email/day).

## Decision
- Choose ONE strategy (Cron / Jobs / Hybrid / In-App Only Phase 0).
- Scope for MVP and what we defer.
- Data model additions (NotificationLedger, user timezone/opt-in).

## Consequences
- Benefits: correctness, simplicity, cost…
- Drawbacks: precision limits, batch load, stale jobs, ops needs…
- Ops: monitoring, retries, idempotency approach.

## Alternatives Considered
1) Daily Cron (Batch): pros/cons vs chosen approach.
2) Per-Card Delayed Jobs: pros/cons vs chosen approach.
3) Hybrid: when it would make sense; why not now.
4) In-App Only Phase 0: pros/cons; when to move beyond it.

## Implementation Notes
- High-level flow (diagrams welcome).
- API/queries needed (e.g., dueCount, ledger writes).
- Timezone handling approach.
- Rollout plan & guardrails (rate limit sending, opt-out).

## Open Questions
- Email provider? (e.g., Resend/SendGrid)
- Push later? Web push vs mobile.
- How to handle users in extreme timezones/default hour?







## Decision
Hybrid is the one that make sense
 Enqueue the jobs for the next reminder for the user is reliable, otherwise if we have a 1 time per day checking and the user just reviewed a card and the the next card review is after one we gonna wait for the next 24hr before noticing that theres a reminder that should be sent.
 however we may need to have a specific time where we run a daily cron to sweep for anything missed or far out.


## Consequences
The Benefits is sending a reminder at the correct time so the user get the most out of it



## Alternatives Considered
1) Daily Cron (Batch): pros/cons vs chosen approach.
if we have a 1 time per day checking and the user just reviewed a card and the the next card review is after one we gonna wait for the next 24hr before noticing that theres a reminder that should be sent.
the pros that we can have it in place where we run a daily cron to sweep for anything missed or far out.



2) Per-Card Delayed Jobs: pros/cons vs chosen approach.
it's part of our choice as we need to the user to revise it when it's time arrives so we get the retention, and effectiveness for the users learning journey.



3) Hybrid: when it would make sense; why not now.
it make sense right now as the time is a crucial part of the user retention, also run a daily cron to sweep for anything missed or far out is a must.



Implementation Notes
