# Library Cloud — frontend

Next.js 16 (App Router) + React 19 + Tailwind v4. The entire user experience: staff dashboard, platform console, sign-in flows, and the white-label public catalog (OPAC) with patron self-service.

> The top-level [`README.md`](../README.md) explains the product; this file explains the code.

## Run it

```bash
# Recommended — full stack from the repository root:
make up && make seed          # production build on :80
# or hot-reload development:
make db-dev && make backend-dev && make frontend-dev

# Frontend only (needs the API reachable):
pnpm install
pnpm dev                      # http://localhost:3000
pnpm build && pnpm start      # production
pnpm typecheck                # tsc --noEmit
```

The dev server expects the backend at `http://127.0.0.1:4000` by default; override with `BACKEND_URL`. In production (compose), Next rewrites `/api/v1/*` to `http://backend:4000` — so the browser only ever talks to one origin, and there is no CORS surface.

## Routes

```
src/app/
├── page.tsx                      marketing landing (pricing, sign-up CTA)
├── register/page.tsx             self-serve: create a library
├── login/page.tsx                staff sign-in (tenant slug + email)
├── dashboard/                    staff console
│   ├── page.tsx                  overview metrics, charts, recent checkouts
│   ├── books, books/[id]         catalog & title detail (copies, history)
│   ├── circulation               checkout / check-in / renew desk
│   ├── holds                     queue management & promotion
│   ├── fines                     payments & waivers (role-gated UI)
│   ├── members                   registry
│   ├── branches                  locations
│   ├── users                     staff accounts & roles (admin)
│   ├── messages                  member notifications inbox view
│   ├── activity                  audit trail
│   └── settings                  library policies (loan period, fines, branding…)
├── platform/                     operator console
│   ├── login/page.tsx            platform sign-in
│   ├── page.tsx                  all libraries, search, growth
│   └── tenants/[id]/page.tsx     tenant detail: plan, usage, suspend, overrides
└── library/[slug]/               the white-label OPAC (per library)
    ├── page.tsx                  public catalog + search (signed out or in)
    ├── books/[id]/page.tsx       title detail, branch availability, place hold
    └── account/page.tsx          patron self-service: loans, holds, fines, profile
```

## Layout & conventions

```
src/
├── app/            routes above (server components by default)
├── components/
│   ├── ui.tsx      the design system: Button, Card, Table, Modal, Field,
│   │               Badge, Callout, Skeleton, EmptyState (one file on purpose)
│   ├── dashboard/  console-specific composition
│   ├── opac.tsx    public-catalog components
│   ├── charts.tsx  dependency-free SVG charts
│   ├── auth-shell.tsx, logo.tsx, providers.tsx, table.tsx
└── lib/
    ├── api.ts      single API client — all backend calls go through it
    ├── session.ts  token storage per client scope (staff/patron/platform)
    ├── tenant-context.tsx, hooks.ts, types.ts, format.ts, defaults.ts
```

Rules of the house:

- **One API client.** No `fetch` calls scattered through components; everything goes through `src/lib/api.ts` so auth, refresh, and error shapes stay consistent.
- **Server-first.** Pages fetch on the server where possible; client components are opt-in.
- **Design tokens, not one-off values.** Colors come from CSS variables (including per-tenant branding), surfaces from `components/ui.tsx`. There is intentionally **no component library dependency** beyond `lucide-react` icons — the primitives are ~a few hundred lines you can read in one sitting.
- **Accessibility is a test requirement**, not a nice-to-have: labels are associated with controls, dialogs implement the ARIA dialog pattern, and the E2E suite exercises sign-in flows by label.
- **Public catalog theming** — `tenant-context.tsx` injects the tenant's brand color as a CSS variable; the OPAC (and staff console) inherit it. White-labeling is a variable, not a build.

## End-to-end tests (Playwright)

```bash
pnpm exec playwright test              # full suite (desktop + mobile projects)
pnpm exec playwright test --ui         # interactive
pnpm exec playwright test --update-snapshots   # only when a visual change is intended
```

- `e2e/auth.setup.ts` signs in once per role and caches sessions (`.auth/*.json`) — specs reuse state and stay fast.
- `e2e/visual.spec.ts` guards sign-in surfaces, the platform console, and key dashboard pages with pixel snapshots (animations are disabled for determinism).
- `e2e/mobile.spec.ts` runs on a phone viewport: catalog browsing, patron sign-in, the staff nav drawer.
- The suite expects the app under test at `http://localhost:18081` by default (see `playwright.config.ts`); point it elsewhere with `PLAYWRIGHT_BASE_URL` or let the config's web server handle it.

Because this suite doubles as the marketing-asset pipeline, the same flows are what you see in the README screenshots and GIFs.
