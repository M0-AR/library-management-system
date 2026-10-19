# Contributing

Thanks for wanting to make Library Cloud better. This document is deliberately short; the two non-negotiables are at the bottom.

## Ways to contribute

- **Report bugs** — open an issue with steps to reproduce, what you expected, and what happened. Screenshots help.
- **Suggest features** — open an issue describing the library problem first, and the feature second. This project optimizes for small libraries' daily reality.
- **Improve docs** — including translations and fixing confusing explanations (the [Beginner guide](README.md#-beginner-guide--read-this-and-you-are-a-professional) grew from exactly that kind of feedback).
- **Send code** — features, fixes, tests, tooling.

## Development setup

```bash
git clone https://github.com/YOUR-GITHUB-USERNAME/library-management-system.git
cd library-management-system
make install        # pnpm install in backend/ and frontend/
make db-dev         # postgres + redis only, exposed locally
make backend-dev    # API with hot reload on :4000
make frontend-dev   # UI with hot reload on :3000
```

Or run the full production stack: `make up && make seed`.

Requirements: Node 24+ (backend also runs `tsx` directly), pnpm 9+, Docker for the databases.

## Before you open a PR

```bash
make typecheck              # both packages, must be clean
make test                   # backend suite — spins up a disposable Postgres
cd frontend && pnpm exec playwright test   # E2E + visual regression
```

If your change touches UI that has a visual snapshot, run the E2E suite and update snapshots intentionally (`pnpm exec playwright test --update-snapshots` only when the visual diff is the intended change), and say so in the PR description.

## Architecture rules (the non-negotiables)

1. **Tenant isolation must never regress.** Every tenant-scoped query runs inside a tenant context; every tenant table keeps `FORCE ROW LEVEL SECURITY`; request traffic only ever uses the non-owner role. If you add a table or a query path, add it to the isolation tests.
2. **Tests must pass.** Bug fixes come with a regression test. Features come with tests at the level they live at (backend spec, E2E, or both).

## Code style

- TypeScript strict; no `any` without a comment explaining why.
- Backend: NestJS idioms (module / controller / service), Zod DTOs at the edge, Drizzle for SQL — keep queries explicit.
- Frontend: App Router, server-first, Tailwind v4 utilities; there is intentionally no component library — shared primitives live in `src/components`.
- No comments unless they explain *why*, not *what*.
- Small commits with clear messages (`fix(holds): promote next hold when a ready hold expires`).

## Pull requests

- One logical change per PR; if you bundled two, expect a request to split.
- Describe the **library problem** being solved, then the change.
- Link related issues (`Closes #123`).
- CI-equivalent commands (above) should pass locally before review.

## Reporting security issues

See [SECURITY.md](SECURITY.md) — please report privately, never as a public issue.

## License

By contributing, you agree your contributions are licensed under the [MIT License](LICENSE).
