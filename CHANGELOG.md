# Changelog

All notable changes to this project are documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-10-19

First public release.

### Added

- **Circulation** — checkout/check-in with row-level locking, renewals with policy limits, overdue tracking, lost-item handling.
- **Catalog** — titles with ISBN metadata, per-branch copies with conditions and replacement prices, categories, archive/restore, full-text search.
- **Holds** — queue with automatic promotion to *ready* on return, pickup-expiry windows, per-branch availability.
- **Fines** — overdue/lost/damaged/manual fines, configurable per-day rates and caps, checkout blocking, role-gated payment and waiver workflows.
- **Members & staff** — member cards and categories, suspensions and expiry, role-based staff accounts (`tenant_admin`, `librarian`, `assistant`) plus patron accounts.
- **White-label OPAC** — public catalog per library at `/library/<slug>` with branding, per-branch availability, hold placement, and full patron self-service (loans, renewals, holds, fines, profile).
- **Custom domains** — DNS TXT-verified domain mapping with automatic TLS via Caddy on-demand certificates.
- **Billing** — provider-agnostic layer with local `stub` provider and Paddle integration (checkout, signature-verified webhooks, full lifecycle).
- **Platform console** — operator view of all libraries: search, growth, plan overrides, suspend/reactivate.
- **Dashboard & analytics** — live operational metrics, 30-day circulation series, top titles.
- **Notifications, audit log, CSV exports** — per-member in-app inbox with optional SMTP delivery; immutable audit trail; loans/fines/members exports.
- **Multi-tenancy** — Postgres Row-Level Security with `FORCE`, dedicated non-owner runtime role, transaction-scoped tenant context, isolated client scopes for staff/patron/platform.
- **Background jobs** — hold maintenance (15 min), overdue sweep (hourly), due-soon reminders (daily), all gated by `JOBS_ENABLED`.
- **Operations** — single-command `docker compose` stack (Postgres 18, Redis 8, Caddy 2), Makefile workflows, idempotent migrations, healthchecks, `.env.example` with every knob documented.

### Quality

- 132 backend tests across 21 spec files, running against a real Postgres with the real RLS setup.
- 30 end-to-end Playwright tests (desktop + mobile viewports) including 7 visual-regression snapshots.
- TypeScript strict typechecking on both packages.
