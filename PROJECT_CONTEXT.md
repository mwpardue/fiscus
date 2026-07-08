# Billing App — Project Context

## Status

This project has moved past product-definition into an early working
implementation. The approved product requirements remain the main planning
source, and the current codebase now includes a Next.js/Supabase vertical
slice with authentication, entry creation, schedule generation, occurrence
editing/completion, profile preferences, and database-level ownership tests.

The intended project directory is:

```text
~/Documents/codex-projects/fiscus
```

The repository is still pre-first-commit. Early migration history may be
squashed before the first commit if doing so keeps the database history clearer.

## Product Goal

Build a web application for tracking personal bills, income, and monthly or
recurring expenses. The application should work well on desktop and mobile,
with a clean mobile-first interface.

The initial user will be the owner, but the architecture must support multiple
users later. Authentication, privacy, and per-user data isolation are
first-class requirements from the beginning.

## Confirmed Version 1 Scope

- All financial records are entered manually.
- Bills and income are supported.
- Bills and income use the same scheduling engine.
- One currency and one timezone per user are sufficient for v1.
- Currency and timezone should still be stored explicitly to avoid a future
  migration problem.
- Authentication supports both email/password and email magic links.
- Bill amounts may be:
  - fixed;
  - estimated; or
  - unknown/undefined until the amount becomes available.
- Basic reporting includes:
  - incoming totals;
  - outgoing totals;
  - incoming-to-outgoing ratio;
  - counts of bills, including bills whose amounts are unknown.
- The interface is responsive and mobile-first.

## Explicitly Deferred

These features are not priorities and should not shape the initial
implementation:

- bank integrations;
- biller integrations;
- automatic transaction imports;
- receipt uploads;
- advanced analytics;
- advanced budgeting;
- shared accounts or households;
- multiple currencies per user;
- multiple timezones per user;
- native mobile applications.

## Scheduling Requirements

Scheduling is a core differentiator of the application. It must support both
ordinary recurring bills and short-term irregular payment plans.

### Schedule Modes

#### 1. Ongoing recurring

A schedule that repeats every N days, weeks, months, or years without requiring
an end date.

Examples:

- every 2 weeks;
- every month;
- every 3 months;
- annually.

#### 2. Finite recurring

A regular schedule that ends after a defined number of occurrences or on a
specified end date.

Examples:

- four biweekly payments;
- six monthly installments;
- weekly payments through a specified date.

#### 3. Manual schedule

A finite schedule whose due dates are entered individually instead of generated
from an interval.

The user must be able to:

- define the number of occurrences;
- manually enter every due date;
- assign one amount to all occurrences;
- assign amounts individually;
- bulk-assign an amount and override selected occurrences;
- leave one or more amounts unknown;
- add, remove, reorder, or edit future occurrences.

This mode is intended for Pay-in-4 providers, personal transactions, and other
short-term arrangements with non-standard dates or amounts.

A generated finite schedule should be convertible to a manual schedule so the
user can generate a useful starting point and then modify individual dates or
amounts.

### Short-Month Behavior

For monthly schedules anchored to a day that does not exist in a given month,
behavior is configurable per bill. The default is to use the month's final day.

Proposed options:

- `last_day`: use February 28/29 or the month's final valid day;
- `next_month`: roll the overflow into the following month;
- `skip`: create no occurrence for that month.

### Scheduling Principles

- A recurrence rule generates occurrences; it is not the financial history.
- Individual occurrences are the authoritative financial records.
- Paid or received occurrences must not be silently rewritten when a schedule
  changes.
- Schedule edits should regenerate or modify only future unpaid occurrences.
- Historical occurrences remain preserved.
- Recurrence logic should be framework-independent and extensively tested,
  especially for:
  - month ends;
  - leap years;
  - daylight-saving transitions;
  - end dates;
  - occurrence-count limits;
  - schedule edits;
  - conversion from generated to manual schedules.

## Proposed Financial Record Model

An occurrence should contain at least:

- explicit due date;
- expected amount, which may be null;
- amount status: `fixed`, `estimated`, or `unknown`;
- actual amount, which may be null until paid or received;
- lifecycle status such as `upcoming`, `paid`, `received`, or `skipped`;
- ownership/user identifier;
- timestamps and suitable audit metadata.

Unknown amounts must use a null expected amount plus an explicit `unknown`
status. Zero must remain a legitimate amount and must not mean "unknown."

Money should be stored as integer minor units plus an ISO currency code, never
as floating-point values.

Estimated amounts should contribute to projected totals while being visually
identified as estimates. Unknown amounts should not contribute a monetary value
to totals, but their count should be shown prominently.

Paid or received occurrences should be immutable during ordinary schedule
editing. Corrections should require a separate explicit action and should be
auditable.

## Implemented Domain Entities

The current user-facing terminology is account → plan → event. The database
still uses the original internal names in several places: `counterparties`
for accounts, `financial_items` for plans, and `occurrences` for events.

The current Supabase/PostgreSQL schema includes:

- `profiles`: user preferences, timezone, and default currency;
- `counterparties`: optional account information for a merchant, biller, payer,
  employer, lender, or person;
- `categories`;
- `financial_items`: plans under one internal financial sequence model;
- `recurrence_rules`: schedule definitions and termination conditions;
- `occurrences`: concrete events with due dates, expected amounts, and
  lifecycle state;
- `payments`: actual payment or receipt records;
- `audit_events`.

The model should avoid treating a mutable `next_due_date` as the only schedule
state because that would lose history and complicate corrections.

The primary application surfaces are now Dashboard, Accounts, and Events.
Plans remain part of the domain model, but there is no standalone top-level
Plans page; plan-level editing is exposed from an event edit page.

## Current Technical Architecture

The current implementation is a single full-stack Progressive Web Application:

- Next.js with TypeScript and the App Router;
- Tailwind CSS;
- Supabase for PostgreSQL and authentication;
- PostgreSQL Row-Level Security for per-user authorization;
- Vitest for domain and unit tests.

The current implementation includes initial Playwright coverage for protected
route redirects, signup, and standalone account creation. It does not yet
include a component-library scaffold, production hosting configuration, or
deployment automation. A monorepo and microservices are still not recommended
for v1 because there is currently one application and one developer.

## Current Vertical Slice

The current application supports:

1. sign-up and login through Supabase authentication;
2. login with email/password or magic link;
3. profile creation with default currency and timezone;
4. dashboard access protection and sign-out;
5. event creation for bills and income;
6. ongoing, finite, and manual schedules;
7. date-based, weekly weekday, and monthly ordinal weekday recurrence;
8. short-month behavior for date-based monthly/yearly schedules;
9. category, counterparty, and color metadata;
10. event editing for upcoming occurrences, including event-only and
    plan-level updates from the event edit page;
11. occurrence completion, reopening support at the database level, skipping,
    archiving, and audit records;
12. basic dashboard totals and calendar counts;
13. profile week-start and theme preferences;
14. private account/plan icon uploads and Brandfetch logo fallback, with
    uploaded icons taking precedence over external logos;
15. standalone account creation and editing at `/accounts`;
16. database-backed rate limiting for auth and mutation actions;
17. initial Playwright browser tests for auth and account workflows.

Recent security hardening includes local-only redirect normalization for auth
callbacks, broader protected-route middleware coverage, neutral user-facing
error messages, explicit owner filters in app-layer updates, and database tests
for row-level isolation.

## Security and Privacy Baseline

- Use managed authentication rather than implementing password storage.
- Support email/password and email magic-link authentication in v1.
- Enforce authorization in PostgreSQL Row-Level Security, not only in UI or
  application code.
- Every user-owned row should carry a user identifier.
- Add database-level tests proving one user cannot select, create, modify, or
  delete another user's records.
- Keep privileged/service-role credentials server-only.
- Use secure HTTP-only session cookies where applicable.
- Validate all input on the server.
- Rate-limit authentication and mutation endpoints.
- Record destructive and security-sensitive actions.
- Configure database backups and verify restoration procedures.
- Do not store bank credentials.
- Follow least-privilege access throughout local development and deployment.

## Proposed Repository Shape

```text
fiscus/
├── src/
│   ├── app/
│   ├── components/
│   │   ├── ui/
│   │   └── bills/
│   ├── features/
│   │   ├── bills/
│   │   ├── dashboard/
│   │   ├── payments/
│   │   └── settings/
│   ├── domain/
│   │   ├── recurrence/
│   │   └── money/
│   ├── server/
│   │   ├── database/
│   │   ├── auth/
│   │   └── services/
│   └── lib/
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── tests/
├── tests/
│   ├── unit/
│   └── e2e/
└── docs/
    ├── product-requirements.md
    ├── data-model.md
    ├── recurrence.md
    └── security-model.md
```

## Proposed First Vertical Slice

The first usable slice should allow the user to:

1. sign in;
2. create an ordinary recurring bill;
3. create a finite or fully manual payment schedule;
4. see upcoming records grouped by month;
5. distinguish fixed, estimated, and unknown amounts;
6. mark a bill occurrence paid or an income occurrence received;
7. edit a schedule without changing its completed history;
8. view basic incoming and outgoing monthly totals;
9. complete the entire workflow comfortably at a narrow mobile viewport.

## Proposed Next Steps

Before scaffolding application code:

1. Write and approve the product requirements.
2. Define lifecycle states and correction behavior.
3. Define the database model.
4. Specify recurrence and manual-schedule behavior with examples.
5. Define the security model and RLS policy matrix.
6. Break the first vertical slice into implementation milestones.
7. Scaffold the application only after explicit approval.

## Project Working Agreement

The user instructed Codex to:

- keep answers concise where appropriate and provide more detail for complex
  subjects;
- ask two or three clarifying questions when appropriate for complex tasks;
- not modify existing files, folders, or repositories without first obtaining
  express approval.

The creation of this context document was expressly approved. Future changes
still require approval under that instruction.
