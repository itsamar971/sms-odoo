# Brightloop SMS — Subscription Management System

Next.js 14 (App Router, Server Actions) · TypeScript · Tailwind + shadcn-style UI · TanStack Table · Recharts · Zod · bcrypt · Nodemailer · @react-pdf/renderer · Vitest

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # 40 unit tests
```

No database to install. On boot the app seeds an **in-memory cache DB** (≈3s):
5,000 subscriptions, ~30,000 invoices and ~26,000 payments, all generated through the real billing engine.

| Role | Email | Password |
|---|---|---|
| Admin | admin@brightloop.com | Admin@1234 |
| Internal | ops@brightloop.com (also finance@brightloop.com) | Internal@1234 |
| Customer portal | accounts@acmeretail.in (any seeded customer email works) | Customer@1234 |

The login page has one-click demo buttons for each role.

## The cache DB (no Postgres)

`lib/db/store.ts` is a small transactional table store that lives in the Node process:

- **Data lasts until the server restarts.** You can also wipe it with **Billing runs → Reset demo data** (admin only). Then it re-seeds automatically.
- **Unique constraints** work like DB unique indexes: email (case-insensitive), SUB/INV numbers, and **`(subscriptionId, periodStart)` on invoices**. That last one is what guarantees nothing is billed twice. Cancelled invoices drop out of the key, so their period can be billed again.
- **`db.transaction(fn)`** keeps an undo journal and rolls back every write if `fn` throws.
- **Sequences** produce `SUB/2026/00001` and `INV/2026/00001`. Like Postgres sequences, they are never rolled back, so numbers can have gaps.
- Money is computed with Decimal.js and rounded half-up to 2 decimal places.

Because the data layer is reached only through `/lib/services`, you can swap in Prisma/Postgres later without touching the UI.

## Business rules (all in `/lib/services`, unit-tested)

| Rule | Where |
|---|---|
| Password: >8 chars, upper, lower, special (client + server Zod) | `services/password.ts` |
| Variant price = sales price + Σ attribute extra price | `services/pricing.ts` |
| Taxes: PERCENT on post-discount line, FIXED per unit, half-up | `services/tax.ts` |
| Discounts: active, in date, under usage limit, min purchase/qty; PRODUCT vs SUBSCRIPTION scope; shown as invoice lines; usedCount incremented in the same transaction | `services/discounts.ts`, `services/billing.ts` |
| State machine DRAFT→QUOTATION→CONFIRMED→ACTIVE⇄PAUSED→CLOSED; illegal moves rejected; every move logged | `services/state-machine.ts`, `services/subscriptions.ts` |
| Plan availability, min quantity, pause/close/renew flags, auto-close | `services/subscriptions.ts`, `services/billing.ts` |
| Quotation from template: validity = today + validityDays; expired quotes can't be confirmed | `services/subscriptions.ts` |
| Billing run: idempotent, catch-up (one invoice per missed period), batches of 100, created/skipped/failed summary | `services/billing.ts` |
| Payments: CONFIRMED invoices only, partial allowed, overpayment blocked, auto PAID | `services/payments.ts` |
| Overdue is computed (CONFIRMED, due > 0, dueDate < today), never stored | `services/invoices.ts` |

## Billing triggers

- **Manual:** the "Run Billing Now" button on `/billing`. You can also run it for a past date.
- **In-process scheduler:** runs once a day (checked hourly), started from `instrumentation.ts`.
- **Cron:** `curl -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/billing`. The default secret in dev is `dev-cron-secret`.

## RBAC

`lib/auth/rbac.ts` is the single permission map. Access is enforced in three places:

1. Edge middleware: no session means a redirect to `/login`.
2. Every layout and page calls `requirePermission(...)`.
3. Every server action is wrapped in `guarded(permission, fn)`.

Portal queries and actions are always scoped by the session's `customerId`. Another customer's invoice, PDF or subscription returns 404.

- **ADMIN:** everything.
- **INTERNAL:** customers, subscriptions, invoices, payments, billing and reports. Configuration is read-only.
- **PORTAL:** `/portal` only.

## Email

If `SMTP_HOST` is not set, emails are printed to the server console: reset links, invoices with the PDF attached, and overdue reminders. In that dev mode the forgot-password page also shows the reset link. See `.env.example`.

## Performance

- Every list uses server-side pagination (25 per page), sorting and filtering through URL params, so only one page is sent to the browser.
- Lookups use indexed fields such as status, customerId and subscriptionId.
- Dashboard aggregates are computed in a single pass over the tables.
- Lists stream in behind Suspense skeletons.
- With 5,000 subscriptions and 30,000 invoices in the production build, every page loads in 0.6–0.95s, including network idle.

## Project layout

```
app/(auth)        login, signup, forgot/reset password
app/(staff)       dashboard, reports, customers, subscriptions, invoices, payments, billing, config, users
app/portal        customer self-service
app/actions       server actions (thin: guard → service)
app/api           invoice PDF, CSV export, cron billing
lib/db            cache DB (store, schema, seed)
lib/services      all business logic
components        UI kit, data table, filters, forms, charts
tests             vitest unit tests
```

