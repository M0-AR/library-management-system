# 📚 Library Cloud

**The complete, self-hosted library management SaaS — catalog, circulation, holds, fines, members, a white-label public catalog, custom domains, and subscription billing. One `docker compose up` and a real library runs on it.**

[![License: MIT](https://img.shields.io/badge/License-MIT-2ea44f.svg)](LICENSE)
[![Backend tests](https://img.shields.io/badge/backend-132%20tests%20passing-2ea44f.svg)](#-testing--quality)
[![E2E tests](https://img.shields.io/badge/E2E-30%20tests%20passing-2ea44f.svg)](#-testing--quality)
[![Docker](https://img.shields.io/badge/docker%20compose-ready-2496ed.svg)](#-60-second-quick-start)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-blueviolet.svg)](CONTRIBUTING.md)

![Staff dashboard walkthrough — circulation metrics, top titles, and recent checkouts](docs/demo/staff-demo.gif)

*Staff demo: the dashboard a librarian sees every morning — live circulation metrics, overdue alerts, top titles, and recent checkouts. The patron demo is [further down](#-the-patron-experience-end-to-end).*

**🌐 Live showcase in your browser:** [site root](https://m0-ar.github.io/library-management-system/) · [preview.html](https://m0-ar.github.io/library-management-system/preview.html) · [docs/preview.html](https://m0-ar.github.io/library-management-system/docs/preview.html) — an interactive tour of the product: screenshots, demo GIFs, a six-question quiz, and a zero-to-pro learning path. All three URLs serve the same page.

**Jump to:** [30-second version](#-the-30-second-version-for-busy-people) · [Plain language](#-what-is-this-in-plain-language) · [Business case](#-why-this-exists--the-business-case) · [Feature tour](#-feature-tour) · [Patron experience](#-the-patron-experience-end-to-end) · [Screenshots](#-screenshot-gallery) · [Quick start](#-60-second-quick-start) · [What it replaces](#-what-this-replaces-the-honest-comparison) · [Repository map](#-repository-map) · [🌱 Beginner guide](#-beginner-guide--read-this-and-you-are-a-professional) · [Architecture](#-architecture) · [Data model](#-data-model-at-a-glance) · [API](#-api) · [Security](#-security) · [Testing & quality](#-testing--quality) · [Deployment](#-deployment) · [Business](#-business--licensing) · [Roadmap](#-roadmap) · [FAQ](#-faq)

---

## 🧭 The 30-second version (for busy people)

Library Cloud is **software a library buys instead of builds**. It replaces spreadsheets, a card box, or a decade-old desktop program with a modern web app that handles the entire daily operation of a library:

- **Everyday staff work** — check books in and out, renew, place holds, collect fines, register members, manage branches, print activity.
- **A public catalog (OPAC)** on your own domain, with your logo and colors, where the public searches books and members self-serve their loans, renewals, holds, and fines.
- **A platform console** for the operator (that's you, if you sell it): every library, every plan, every bill, in one place.

It is **multi-tenant by design** — one deployment serves unlimited independent libraries with enterprise-grade data isolation (Postgres Row-Level Security, forced, tested). You can run it for one library, or sell it as a subscription product to hundreds.

> **If you read only one paragraph:** this repository is a finished, tested, deployable business — not a demo. 132 backend tests, 30 end-to-end browser tests, real billing hooks, real security isolation, and documentation that explains everything from what a "hold" is to how to price a hosted plan.

---

## 🗣️ What is this, in plain language?

**A library management system (LMS)** — sometimes called an *integrated library system (ILS)* — is the software a library lives inside. Staff use it dozens of times a day; patrons feel it every time they borrow a book.

**"SaaS"** means *Software as a Service*: instead of installing software once per library, you host it centrally and libraries subscribe to it. **"Multi-tenant"** means many libraries share one installation while never seeing each other's data — like apartments in one building, each with its own locked door.

**"White-label"** means the public side looks like *the library's* website, not ours. Each library gets its own name, logo, colors, and — on paid plans — its own custom domain.

**"OPAC"** is library-speak for *Online Public Access Catalog*: the public search-and-borrow website. (More jargon in the [Beginner guide](#-beginner-guide--read-this-and-you-are-a-professional).)

So, concretely, with Library Cloud:

| If you are… | You get… |
|---|---|
| A **library** | A modern system at a fraction of legacy ILS prices — no server room, no installer, no mystery |
| An **entrepreneur** | A ready-to-sell product: multi-tenancy, plans, billing webhooks, platform console, white-label branding |
| A **developer** | A clean, modern, fully tested codebase to learn from, extend, or fork — MIT licensed |
| A **city / school district** | Multiple independent libraries on one controlled deployment, each isolated, all auditable |

---

## 💰 Why this exists — the business case

Legacy library software is expensive, dated, and locked down. Newer cloud options exist but cost thousands per year and still don't let a small operator run their own show.

Library Cloud is built for a specific, underserved buyer: **small public libraries, school libraries, private/Members-only libraries, church and mosque libraries, community reading rooms, and the entrepreneurs who serve them.**

**The economics, plainly:**

- **Hosting cost per library is negligible.** A single small cloud VM (2 vCPU / 2 GB) comfortably runs dozens of light-use library tenants on this stack. Marginal infrastructure cost per added library is close to zero.
- **Value per library is high.** A library that pays $2,000–$20,000/year for legacy software can happily pay a subscription that still saves it 60–90%.
- **The hard part is done.** Multi-tenant isolation, billing lifecycle (trial → active → past due → canceled), plan limits, white-label branding, custom domains, staff roles, audit logs — the unglamorous machinery that takes months to build — is implemented and tested here.
- **You keep the margin.** MIT license, self-hosted, no revenue share, no vendor calling you.

Suggested positioning you can start from (details and a full go-to-market playbook in [`docs/BUSINESS.md`](docs/BUSINESS.md)):

| Plan | Price (suggested) | Who it fits |
|---|---|---|
| **Starter** | $29/mo | One site, one branch, up to 5 staff, 2 000 members |
| **Growth** | $79/mo | Up to 3 branches, 25 staff, 20 000 members |
| **Enterprise** | $199/mo | Unlimited branches, staff and members, custom domain |

---

## ✨ Feature tour

Everything below is implemented, running in the screenshots and GIFs, and covered by tests. No mockups.

### ⚡ Circulation — the heartbeat

Barcode-style checkout and check-in (type or scan a card number or copy barcode into the searchable picker), renewals with policy limits, due-date calculation, overdue tracking that updates itself, and lost-item handling — all in a transaction-safe flow with row-level locking so two librarians can never lend the last copy to two people at once.

![Circulation desk](docs/screenshots/07-circulation.png)

### 📖 Catalog & copies

Titles with ISBN metadata (publisher, year, pages, language), **per-branch physical copies** with conditions and replacement prices, category tagging, archive/restore instead of destructive deletes, and instant full-text search across title, author, and ISBN.

![Catalog](docs/screenshots/04-catalog.png)

### ⏳ Holds with automatic promotion

When every copy is out, patrons join the waitlist. When a copy returns, the system **automatically promotes the next hold to "ready"** with a pickup-expiry window and notifies the patron. Staff see the queue per title, per branch.

![Holds](docs/screenshots/08-holds.png)

### 🧾 Fines that behave like real library policy

Overdue fines accrue per day at a configurable rate with a cap; lost and damaged items bill at the copy's replacement price; manual fines for anything else. **Outstanding fines can block checkout**, and payments and waivers are policy-gated by role — an assistant can collect, only a librarian or admin can waive.

![Fines](docs/screenshots/09-fines.png)

### 👥 Members & staff

Member cards with typed categories (adult, student, child, senior…), suspension and expiry controls, per-member history, and **role-based staff accounts**: `tenant_admin` (full control), `librarian` (operations + sensitive actions), `assistant` (front desk). Every sensitive change lands in the audit log.

![Members](docs/screenshots/10-members.png)

### 🌐 White-label public catalog (OPAC)

Every library gets a public site at `/library/<slug>` — its name, logo, colors, and welcome message. Visitors search the catalog, open a title, see **live availability per branch**, and can place a hold. Signed-in patrons get a full self-service area: their loans and renewals, hold queue positions, fine balances, and profile.

| Public catalog | Book detail | Patron account |
|---|---|---|
| ![OPAC](docs/screenshots/16-opac.png) | ![Book detail](docs/screenshots/17-opac-book.png) | ![Patron account](docs/screenshots/18-patron-account.png) |

### 🏛️ Branches

Multiple branches per library, each with its own copy stock and availability — "Main Library has 2, Eastside has 0" is visible everywhere it matters, including the public catalog.

![Branches](docs/screenshots/11-branches.png)

### 📊 Dashboard & analytics

The morning-coffee screen: active loans, overdue count, ready holds, outstanding fines, new members, a 30-day checkouts/returns chart, top titles of the last 90 days, and the latest checkouts — all computed live from the database.

![Dashboard](docs/screenshots/02-dashboard.png)

### 🔐 Custom domains (paid plans)

A library can attach `catalog.theircity.org` to its tenant. The domain is verified with a DNS TXT record before activation, and TLS certificates are issued and renewed automatically by the bundled Caddy server. The same deployment serves every library's domain.

### 💳 Subscription billing, ready for production

Provider-agnostic billing with a **local `stub` provider** for self-hosting (instant plan changes, no external calls) and a full **Paddle integration** for selling: checkout links per plan, signature-verified webhooks, and a webhook-driven lifecycle (subscribed → past due → canceled) that keeps tenant state truthful even if the browser closes mid-checkout.

### 🛰️ Platform console

The operator's cockpit: every library with search and growth chart, plan and usage, suspend/reactivate, and plan overrides for support cases.

| Platform console | Library detail |
|---|---|
| ![Platform](docs/screenshots/21-platform.png) | ![Tenant detail](docs/screenshots/22-platform-tenant.png) |

### 🔔 Notifications, 📜 audit log, 📤 exports

Every hold-ready, due-soon, overdue, and fine event is recorded in-app per member (and optionally emailed via SMTP). Sensitive actions — fining, waiving, role changes, domain changes, suspension — are written to an **immutable audit log** with actor, action, entity, and time. Loans, fines, and member lists **export to CSV**, and the activity page shows the audit trail.

| Audit / activity | Settings |
|---|---|
| ![Activity](docs/screenshots/13-activity.png) | ![Settings](docs/screenshots/12-settings.png) |

### 🛡️ Multi-tenancy you can actually trust

One database, one schema, every tenant table protected by Postgres **Row-Level Security with `FORCE`**, enforced for a dedicated **non-owner runtime role**, with the tenant context set **transaction-scoped** on every request. Cross-tenant reads are impossible even if application code has a bug — and that claim is backed by dedicated isolation tests, not hope.

---

## 🧑‍🤝‍🧑 Who is it for? (three personas, three paths)

**1. The library director** — wants a system that works on day one, costs a fraction of legacy software, and doesn't require an IT department. Start with the [quick start](#-60-second-quick-start), click around the demo, then read [What this replaces](#-what-this-replaces-the-honest-comparison).

**2. The entrepreneur / operator** — wants to sell library software as a service. Read [Why this exists](#-why-this-exists--the-business-case) and [`docs/BUSINESS.md`](docs/BUSINESS.md), then bring the stack up and register your first paying library.

**3. The developer** — wants a non-trivial, modern, fully tested reference application (NestJS 12 + Next.js 16 + Postgres 18 RLS + Playwright). Read the [Architecture](#-architecture) and [Testing & quality](#-testing--quality) sections, then `make dev`.

---

## 🖼️ The patron experience, end to end

![Patron demo — search, book detail, placing a hold, checking it in the account area](docs/demo/patron-demo.gif)

*Patron demo: a signed-out visitor searches the catalog, opens a book that is fully on loan, joins the waitlist, and then checks the hold in their account area.*

## 📸 Screenshot gallery

All 24 screenshots live in [`docs/screenshots/`](docs/screenshots/) — captured from the running application at 1440×900 (desktop) and mobile.

| | |
|---|---|
| ![Staff sign-in](docs/screenshots/01-staff-login.png) **Staff sign-in** — tenant slug + email, knowledge of a URL is not enough | ![Dashboard analytics](docs/screenshots/03-dashboard-analytics.png) **Analytics** — 30-day circulation trend |
| ![Catalog search](docs/screenshots/05-catalog-search.png) **Full-text catalog search** | ![Book detail, staff side](docs/screenshots/06-book-detail.png) **Staff book detail** — copies, conditions, history |
| ![Landing page](docs/screenshots/14-landing.png) **Marketing landing** — pricing and registration | ![Registration](docs/screenshots/15-register.png) **Self-serve registration** — a new library in one form |
| ![Patron holds](docs/screenshots/19-patron-holds.png) **Patron holds** — queue position and pickup state | ![Patron profile](docs/screenshots/20-patron-profile.png) **Patron profile** — contact details and preferences |
| ![Mobile catalog](docs/screenshots/23-mobile-opac.png) **Mobile public catalog** | ![Mobile account](docs/screenshots/24-mobile-account.png) **Mobile patron account** |

---

## 🚀 60-second quick start

**Requirements:** Docker with Docker Compose v2, `make` (optional but convenient), and about 2 GB of free RAM.

```bash
git clone https://github.com/M0-AR/library-management-system.git
cd library-management-system
make up          # generates .env with real secrets, builds images, migrates, starts
make seed        # loads a demo library: 35 books, 78 copies, members, loans, holds, fines
```

Open **http://localhost**. Done — you are running a library SaaS.

Prefer raw Docker over `make up`? The same flow:

```bash
cp .env.example .env   # then edit the secrets (see Environment below)
docker compose up -d --build
docker compose run --rm migrate node dist/scripts/bootstrap.js  # migrations + bootstrap
docker compose run --rm -e SEED_RESET=1 backend node dist/scripts/seed.js
```

### Demo logins (after `make seed`)

Password for every demo account: `Password123!`

| Role | Email | Where to sign in |
|---|---|---|
| Platform operator (you) | `platform@lms.test` | http://localhost/platform/login |
| Library admin — Riverside | `admin@riverside.test` | http://localhost/login (slug: `riverside`) |
| Librarian — Riverside | `librarian@riverside.test` | http://localhost/login |
| Assistant — Riverside | `assistant@riverside.test` | http://localhost/login |
| Library admin — Lakeside | `admin@lakeside.test` | http://localhost/login (slug: `lakeside`) |
| Librarian — Lakeside | `librarian@lakeside.test` | http://localhost/login |
| Patrons | `jane@example.com`, `marcus@example.com`, `sofia@example.com`, `ethan@example.com`, `nina@example.com`, `tom@example.com` | http://localhost/library/riverside/account |

The seed deliberately includes **overdue loans, an overdue fine, a ready hold, patrons queued on a title, and a lost/damaged/withdrawn copy** — so every screen has something real to show.

### Everyday commands

```bash
make logs      # tail all container logs
make ps        # container status
make down      # stop everything (data survives)
make rebuild   # rebuild images after code changes
make seed      # re-seed demo data (add SEED_RESET=1 for a clean slate)
make test      # backend test suite — spins up a disposable Postgres, never touches your data
make clean     # stop and DESTROY volumes (all data) — careful
```

### Creating your own library (no demo data required)

1. Open http://localhost and click **Start free** (`/register`).
2. Pick your library name and slug — that's your public catalog address (`/library/<slug>`).
3. Sign in at `/login`, add books, copies, and members.
4. Promote yourself to operator to see the platform console:

```sql
UPDATE users SET role = 'platform_admin', tenant_id = NULL WHERE email = 'you@example.com';
```

---

## ⚖️ What this replaces: the honest comparison

| | Spreadsheets | Legacy desktop ILS | Typical hosted ILS | **Library Cloud** |
|---|---|---|---|---|
| Multi-branch stock | ✗ | ✓ | ✓ | ✓ |
| Holds with auto-promotion | ✗ | varies | ✓ | ✓ |
| Public catalog on your domain | ✗ | rare | usually a subdomain | ✓ white-label + custom domains |
| Patron self-service | ✗ | ✗ | ✓ | ✓ |
| Staff roles & audit log | ✗ | partial | ✓ | ✓ |
| You own the data & deployment | ✓ (sort of) | ~ | ✗ | ✓ |
| Multi-library tenancy built in | ✗ | ✗ | n/a (per-customer) | ✓ — run one or sell many |
| Cost trend as you grow | manual work grows | license per seat | per-year, per-module | flat hosting, unlimited seats |
| License | — | proprietary | proprietary | **MIT — fork it, sell it, keep it** |

This is not a MARC21/SIP2-complete ILS for a national library with 40 branches and an acquisitions department. It is the **80% of daily reality** for the other libraries — done properly. Missing pieces are on the [roadmap](#-roadmap), openly.

---

## 🗺️ Repository map

```
library-management-system/
├── backend/                 NestJS 12 API (Fastify, Drizzle ORM, Zod)
│   ├── src/modules/         auth, books, copies, loans, holds, fines, members,
│   │                        branches, users, dashboard, exports, public (OPAC),
│   │                        tenants, billing, notifications, audit-logs, jobs…
│   ├── src/db/              schema, connection, migrations, tenant context
│   └── test helpers + 21 spec files
├── frontend/                Next.js 16 App Router UI (React 19, Tailwind v4)
│   ├── src/app/             /login /register /dashboard /platform /library/[slug]
│   └── e2e/                 Playwright specs + visual snapshots
├── caddy/                   Caddyfile — automatic HTTPS & domain routing
├── docs/
│   ├── BUSINESS.md          pricing, go-to-market, unit economics
│   ├── screenshots/         24 product screenshots
│   └── demo/                staff & patron demo GIFs
├── docker-compose.yml       postgres, redis, migrate, backend, frontend, caddy
├── Makefile                 one-word commands for everything
└── .env.example             every knob, documented
```

Secondary entry points after a clone: [`backend/README.md`](backend/README.md) for the API internals, [`frontend/README.md`](frontend/README.md) for the UI internals, [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a PR, and [`SECURITY.md`](SECURITY.md) to report a vulnerability privately.

---

## 🌱 Beginner guide — read this and you are a professional

> **You will know more than most interview candidates.**
> This section assumes you have never heard a single library term. Ten minutes here and every word in this README, every screen in the app, and every table in a library's annual report becomes obvious.

### The 60 seconds of jargon, decoded

| Term you'll meet | What it actually means |
|---|---|
| **ILS / LMS** | *Integrated/​Library Management System* — the software a library runs on. Same thing, two names. |
| **Catalog** | The list of everything a library owns: titles (books) and their physical copies. |
| **Title vs. copy** | *Dune* is a **title**. The three worn paperbacks of *Dune* on the shelf are **copies**. Holds, loans, and shelves care about copies; search cares about titles. |
| **Circulation** | Library-speak for *lending*: checkouts, returns, and renewals. "Circulation desk" = front desk. |
| **Checkout / check-in** | The two verbs of the desk: handing a book to a member (loan) and taking it back (return). |
| **Loan** | One active checkout: this copy, that member, this due date. |
| **Renewal** | Extending a loan's due date — allowed up to a policy limit. |
| **Hold / waitlist** | A reservation. When every copy is out, a patron joins the hold queue. On return, the next hold **auto-promotes to *ready*** and the patron is told to pick it up. |
| **Fine** | Money owed — usually accruing per overdue day, capped by policy. Fines can block new checkouts until settled. |
| **Member / patron** | Library-speak for a customer. Members borrow; staff serve them. |
| **Branch** | A physical building. Each branch has its own copies — availability is per branch. |
| **OPAC** | *Online Public Access Catalog* — the public website where people search and borrow. The library's shopfront. |
| **Tenant** | In this product, one **library** (with all its data). Multi-tenant = many libraries in one deployment, sealed apart. |
| **White-label** | The public catalog shows the *library's* brand, not ours. |
| **SaaS** | *Software as a Service* — you host once, customers subscribe. |
| **RLS** | *Row-Level Security* — a Postgres feature that makes one library's rows mathematically invisible to another library's requests, even if the code has a bug. See [Security](#-security). |
| **MARC / SIP2 / Z39.50** | Old library interop standards (metadata exchange, self-checkout machines, cross-catalog search). Not implemented yet — see [Roadmap](#-roadmap). |

### Let's work this out in a step-by-step way to be sure we have the right answer

Try this exercise — you'll use every core concept in under five minutes:

1. **Start the stack** — `make up && make seed`, open http://localhost.
2. **Be a clerk for a minute.** Sign in at `/login` (slug `riverside`, `assistant@riverside.test`). Open **Circulation** and check out *The Midnight Library* to `jane@example.com`. Watch the active-loans number move.
3. **Be a patron.** Open http://localhost/library/riverside in a private window, sign in as `jane@example.com`. Your loan is already there. Try renewing it. Now find *Dune* — all copies out — and **place a hold** (join the waitlist).
4. **Complete the circle.** Back as the librarian, open **Circulation** and return *Dune*. The hold system instantly promotes Jane's hold to **ready** and records a notification. Check **Holds** — then check Jane's account again.
5. **Feel the policy engine.** Open **Fines**. You can take a payment; you *cannot* waive (that's a librarian-or-admin action). Sign in as `librarian@riverside.test` and the waive button appears. **That's role-based authorization**, visible in five clicks.
6. **Be the owner.** Sign in at `/platform/login` as `platform@lms.test`. You see both libraries (riverside and lakeside) in one console — and zero cross-library data, ever, because of row-level security.
7. **Read your own audit trail.** As librarian, open **Activity** — every sensitive action you just performed is logged with actor and timestamp.

That sequence *is* the product. Everything else in this repository is that loop, made robust for real daily use.

**If you're a developer**, continue with the [Architecture](#-architecture) section; if you're evaluating the business, continue with [`docs/BUSINESS.md`](docs/BUSINESS.md); if you're a librarian, you already know the whole system — the rest is just polish.

---

## 🏗️ Architecture

```
                        ┌────────────────────────────────────────────┐
  Browser  ──────►      │  Caddy 2 (:80/:443, automatic HTTPS)       │
                        └──────────────┬─────────────────────────────┘
                                       │ reverse proxy, on-demand TLS for
                                       │ white-label tenant domains
                        ┌──────────────▼─────────────────────────────┐
                        │  frontend — Next.js 16 (standalone)        │
                        │  /api/v1/* rewritten same-origin ──────┐   │
                        └────────────────────────────────────────┼───┘
                                                                 │
                        ┌────────────────────────────────────────▼───┐
                        │  backend — NestJS 12 on Fastify            │
                        │  JWT auth · Zod validation · rate limits   │
                        │  Drizzle ORM · scheduled jobs · billing    │
                        └───────┬─────────────────────────┬──────────┘
                                │                         │
                     ┌──────────▼─────────┐     ┌─────────▼──────────┐
                     │  Postgres 18       │     │  Redis 8           │
                     │  RLS (FORCE) ·     │     │  rate-limit        │
                     │  tenant context    │     │  counters, cache   │
                     └────────────────────┘     └────────────────────┘
```

**Why these choices**

- **Caddy** terminates TLS for every domain — the platform domain *and* each library's custom domain — with on-demand certificates, so white-labeling costs zero operations work.
- **Next.js rewrites** proxy `/api/v1/*` to the backend, so the browser only ever talks to one origin: no CORS surface, no backend URL leaked to clients.
- **NestJS + Fastify + Zod** gives a typed, DI-structured API with validation at the edge and speed under load.
- **Drizzle** keeps SQL explicit and auditable — important when the correctness story rests on transaction-scoped tenant context.
- **Postgres RLS** is the isolation backbone (below). Redis is only rate limiting and caching; losing it degrades, not breaks.

### Tenant isolation — the three-lock model

1. **Every request runs `SET LOCAL app.current_tenant = <tenant_id>`** inside a transaction; the value evaporates with the transaction and can never leak to the next pool checkout.
2. **Every tenant-scoped table has `FORCE ROW LEVEL SECURITY`** with policies keyed to that session variable — `FORCE` means even the table owner can't bypass it.
3. **The application connects as a dedicated non-owner role** (`app_user`), so it has no superuser escape hatch at all. Migrations and bootstrap use a separate admin URL that never runs request traffic.

Public OPAC requests (signed-out browsing) and refresh-token rotation run in their own narrowly-scoped contexts. The isolation tests exist specifically to try to break this and fail loudly if they can.

### Authentication & authorization

- **15-minute JWT access tokens** + **rotating refresh tokens** (30 days, stored hashed, revoked on password reset or account disable — replayed tokens are rejected).
- **Three separate client scopes with separate storage** — `staff`, `patron`, `platform`. A patron session can never act on the staff dashboard, and vice-versa; the scopes cannot be mixed up by a UI bug.
- **Roles:** `platform_admin` (operator), `tenant_admin`, `librarian`, `assistant`, `patron`. Sensitive actions are role-gated server-side (waiving fines, editing roles, domain changes…).
- **Passwords** hashed with scrypt; login is rate-limited per IP (20 attempts / 5 min) with a separate registration budget (10 / hour).

### Background jobs (gated by `JOBS_ENABLED`)

| Schedule | Job | What it does |
|---|---|---|
| every 15 min | Hold maintenance | expires holds whose pickup window lapsed and re-promotes the queue |
| hourly (min :05) | Overdue sweep | marks newly overdue loans and notifies members |
| daily 08:30 | Due-soon reminders | notifies members whose loans expire within the horizon |

### Emails & notifications

Every event is written to the member's **in-app inbox** regardless of configuration. If `SMTP_*` is set, matching emails are sent through the bundled Nodemailer transport. The pattern is deliberate: **records never depend on email**.

---

## 🗃️ Data model (at a glance)

Fourteen tables, all tenant-sealed where relevant (`tenants` is the root — every other seed row carries a `tenant_id`):

| Table | What it stores |
|---|---|
| `tenants` | A library: name, slug, status, plan, branding, `settings` (JSONB: policies, OPAC preferences, notifications) |
| `users` | Staff and operator accounts (roles, scrypt password hash, 2FA-ready fields) |
| `members` | Patrons: card number, category, contact, status, expiry |
| `branches` | Physical locations per library |
| `books` | Titles: title, authors, ISBN, publisher, year, language, categories, description |
| `copies` | Physical items: barcode, condition, price, status (available, on loan, lost, damaged, withdrawn), branch |
| `loans` | Checkout records: copy, member, due date, return date, renewal count, status |
| `holds` | Reservations: book (or copy), member, queue position, status (pending, ready, fulfilled, canceled, expired) |
| `fines` | Charges: type (overdue/lost/damaged/manual), amount, status (outstanding/paid/waived) |
| `notifications` | Per-member in-app inbox (hold ready, due soon, overdue, fine events) |
| `refresh_tokens` | Hashed rotating refresh tokens per client scope |
| `audit_logs` | Immutable trail of sensitive actions with actor, action, entity |
| `domains` | Custom domain claims per library, with DNS TXT verification state and activation flags |
| `_migrations` | Applied migration ledger |

Mixed into `tenants.settings` (parsed and validated with Zod, defaults applied): loan period **14 days**, **2 renewals** per loan, fine rate **$0.25/day**, and an **outstanding-fine block at $50** — every value is per-library configurable in under ten seconds. (These live in JSONB on purpose: policy data changes without database migrations.)

---

## 🔌 API

Base path: `/api/v1` — JSON in, JSON out, bearer tokens in `Authorization: Bearer <token>`.

| Controller | Surface |
|---|---|
| `auth` | login, refresh (rotating), logout, register a library |
| `books` · `copies` | catalog CRUD, search, archive/restore; physical copies per branch |
| `loans` | checkout, check-in, renew, list with filters |
| `holds` | place, cancel, queue view, manual promotion |
| `fines` | assess, pay, waive, list outstanding |
| `members` · `users` | patron registry; staff accounts & roles (admin-gated) |
| `branches` | branch CRUD |
| `dashboard` | live metrics + 30-day circulation series + top titles |
| `exports` | CSV streams for loans, fines, members |
| `public` | the entire OPAC: search, book detail with per-branch availability, patron self-service, hold placement |
| `tenants` | operator console: list, stats, suspend/reactivate, plan overrides |
| `billing` | plan catalog, checkout, provider webhooks |
| `notifications` | member inbox; `audit-logs` for the trail |
| `health` | liveness + database check |

**The classic five-command tour** (works against the seeded demo):

```bash
# 1. Sign in a staff user
curl -s -X POST http://localhost/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"tenantSlug":"riverside","email":"librarian@riverside.test","password":"Password123!"}'
# → { "accessToken": "…", "refreshToken": "…", "user": { … } }

# 2. Search the catalog (staff side)
curl -s "http://localhost/api/v1/books?search=dune" -H "Authorization: Bearer $TOKEN"

# 3. See availability per branch for a title
curl -s "http://localhost/api/v1/books/<bookId>" -H "Authorization: Bearer $TOKEN"

# 4. Check a copy out to a member (barcode or UUID)
curl -s -X POST http://localhost/api/v1/loans/checkout \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"copyBarcode":"RIV-000123","memberCard":"RIV-2024-0001"}'

# 5. Take a fine payment
curl -s -X POST http://localhost/api/v1/fines/<fineId>/pay \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"amountCents":50}'
```

The public OPAC needs no token: `GET /api/v1/public/library/riverside/books?search=…` — and patron self-service uses the `patron` client scope, isolated from staff tokens by design.

> **Tip:** the full request/response shapes are in the DTOs (`backend/src/modules/*/dto.ts`), which are also the Zod schemas actually enforced at runtime. The code and the contract are the same artifact.

---

## 🔒 Security

- **Isolation by construction** — RLS `FORCE` + non-owner role + transaction-scoped context, with dedicated tests attempting cross-tenant access (see [Tenant isolation](#tenant-isolation--the-three-lock-model)).
- **Tokens** — short-lived access JWTs; rotating, hashed, revocable refresh tokens; separate scopes per surface.
- **Passwords** — scrypt hashing; login/registration rate-limited; refresh tokens invalidated on password reset and user disable.
- **Webhooks** — billing webhooks signature-verified on every request; idempotent processing.
- **Custom domains** — activation requires a DNS TXT record proving control; the host allow-list resolves per tenant server-side.
- **Audit trail** — sensitive operations (fines, roles, domains, suspension) recorded with actor and entity; exports are role-gated.
- **Operational posture** — no secrets in the repository (`.env` is generated locally and git-ignored), Helmet security headers, compression, and structured logs.

Found something? Please read [`SECURITY.md`](SECURITY.md) and report privately instead of opening a public issue.

---

## 🧪 Testing & quality

| Suite | What it covers | How to run |
|---|---|---|
| **132 backend tests** across 21 spec files (Vitest + supertest against a **real Postgres**) | auth flows, RBAC gates, circulation rules, hold promotion, fine policy, RLS tenant isolation, billing webhooks, exports, jobs | `make test` (or `cd backend && pnpm test`) |
| **30 end-to-end browser tests** (Playwright: Chromium desktop + a mobile viewport) | staff journeys, patron journeys, platform console, tenant isolation, CSV export, mobile catalog & account, visual regression | `cd frontend && pnpm exec playwright test` |
| **Visual regression** (7 snapshots) | pixel-level guards on the sign-in surfaces, platform console, and key dashboard pages | included above |
| **Typecheck** | TypeScript strict on both packages | `make typecheck` |

Notable testing choices: the backend suite runs against **real Postgres with the real migration and RLS setup** — a disposable database is spun up per run and destroyed (`make test-clean` removes leftovers); E2E uses **cached authenticated sessions** so the suite stays fast; visual snapshots run on a pinned viewport with animations disabled for determinism. Test knobs: `KEEP_TEST_DB=1`, `TEST_APP_LOG=1`, `TEST_DB_PORT=55440`.

---

## 🚢 Deployment

1. **Provision** any 2 vCPU / 2 GB VM with Docker & Compose.
2. **Point DNS** — an A/AAAA record for your app domain at the VM.
3. **Configure `.env`** — `APP_DOMAIN`, `PUBLIC_APP_URL`, `ACME_EMAIL` for HTTPS, and **rotate every secret** from the placeholders.
4. **Launch** — `make up`. Caddy obtains certificates automatically; migrations run on every boot (idempotent `migrate` service); the backend waits for a healthy database before starting.
5. **Create your first library** at `/register` and promote your operator account (SQL in the [quick start](#-60-second-quick-start)).
6. **Backups** — the `pgdata` volume holds everything; snapshot it nightly, or schedule `pg_dump`. Redis holds only caches and counters — safe to lose.

Scaling notes: the backend is stateless (JWTs + Redis), so `docker compose up --scale backend=3` works behind Caddy; Postgres is the single node to watch, and its workload is intentionally small for this market.

### Environment variables (highlights — full list in [`.env.example`](.env.example))

| Variable | Default | Purpose |
|---|---|---|
| `PUBLIC_APP_URL` | `http://localhost` | Canonical origin used in links & redirects |
| `APP_DOMAIN` | `localhost` | Primary domain; any other host is treated as a custom tenant domain |
| `JWT_SECRET` | — | Signing key for access/refresh tokens (≥32 chars, `openssl rand -hex 32`) |
| `APP_DB_ROLE` / `APP_DB_PASSWORD` | `app_user` | Runtime DB role — RLS applies; **never** the table owner |
| `DATABASE_URL_ADMIN` | — | Migrations/bootstrap only; never used by request traffic |
| `BILLING_PROVIDER` | `stub` | `stub` (self-host, instant plan changes) or `paddle` (sell for real) |
| `PADDLE_*` | — | API key, webhook secret, and price IDs per plan |
| `SMTP_*` | — | Optional email transport; in-app inbox works regardless |
| `REDIS_URL` | `redis://redis:6379` | Rate-limit counters & cache (graceful in-memory fallback) |
| `RATE_LIMIT_ENABLED` | `true` | Global throttling; auth endpoints have stricter windows |
| `JOBS_ENABLED` | `true` | Scheduled hold/overdue/reminder sweeps |
| `ACME_EMAIL` | — | Let's Encrypt contact for HTTPS |

---

## 🧾 Business & licensing

- **License:** MIT — use it commercially, fork it, rebrand it, sell it. Attribution welcome, not required.
- **Pricing guidance, unit economics, and a go-to-market playbook:** [`docs/BUSINESS.md`](docs/BUSINESS.md).
- **The bet, stated plainly:** small libraries are badly served by expensive legacy software and by cloud ILS products priced for consortiums. A lean operator, one deployment, honest pricing, and white-label polish wins them one at a time.

---

## 🛣️ Roadmap

Deliberately deferred, roughly in order of demand:

- [ ] MARC21 import/export (migrate from legacy ILS data)
- [ ] Self-service intake built on the existing circulation core — SIP2
- [ ] Z39.50 / SRU cross-catalog search
- [ ] Barcode scanning UX hardening (USB scanners work today as keyboards)
- [ ] Reviews & ratings on catalog titles
- [ ] Two-factor authentication for staff (schema is ready)
- [ ] API keys & outbound webhooks for integration partners
- [ ] Acquisitions & serials modules
- [ ] Stripe as an additional billing provider (the provider layer is abstract)
- [ ] Dark mode

---

## ❓ FAQ

**Is this production-ready or a portfolio piece?**
Both. It is a complete, tested product (132 backend + 30 E2E tests) that a small library can genuinely run today — and a reference codebase for engineers who want to see multi-tenant SaaS done with real isolation.

**How many libraries can one deployment serve?**
Dozens on a small VM; hundreds on modest hardware. The tenant model has no per-library process — it's rows and policies, not containers.

**Can two libraries share members or books?**
No, and that's the point — full isolation by design. Transfers between systems are a future roadmap item.

**What's the minimum a library needs to start?**
A browser. Staff can type ISBNs and catalog as they go; barcodes are optional (USB scanners work as keyboards). Nothing to install.

**Can I host this for customers and charge them?**
Yes — that's what the billing module, plans, platform console, and MIT license are for. Register libraries at `/register`, or create them from the operator console.

**Does it handle RTL / Arabic?**
The UI is responsive and localized-ready; Arabic RTL is a roadmap item. The data model stores titles/descriptions in any script today.

**What happens if Redis dies?**
Rate limiting falls back to an in-memory store and caching degrades; the library keeps working. Postgres is the only truly stateful component.

**How do I migrate data from an old system?**
Start with CSV import scripts (a great first contribution — the data model is documented above and the exports show the shape); MARC21 is on the roadmap.

**Why is there no Stripe support?**
The billing layer is provider-agnostic with a working Paddle integration and a local stub. Stripe is a small, well-scoped addition — see the roadmap and [`CONTRIBUTING.md`](CONTRIBUTING.md).

**Is there a hosted demo?**
The browser showcase is live at **[m0-ar.github.io/library-management-system](https://m0-ar.github.io/library-management-system/)** — an interactive guided tour with screenshots, quiz, and a hands-on learning path (also reachable at [`/preview.html`](https://m0-ar.github.io/library-management-system/preview.html) and [`/docs/preview.html`](https://m0-ar.github.io/library-management-system/docs/preview.html)). For the real thing, the quick start is the demo — one minute of Docker and you have the full seeded system with all demo logins. (Screenshots and GIFs in this README are from that exact system.)

---

## 🤝 Contributing

Contributions are welcome — bug reports, features, docs, and translations. Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) for the workflow (fork → branch → tests → PR), and keep the two non-negotiables: **tests must pass** and **tenant isolation must never regress**.

## 📄 License

[MIT](LICENSE) © Library Cloud contributors. The name "Library Cloud" and the demo brands (Riverside/Lakeside) are placeholders — replace them with your own when you ship.

---

<div align="center">

**If this project is useful to you, a ⭐ helps other libraries and builders find it.**

Built with ❤️ for libraries that deserve better software.

</div>
