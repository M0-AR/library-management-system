# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report privately via GitHub's [Security → Report a vulnerability](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) tab on this repository, or email the maintainer listed in the repository profile.

Include:

- what you found and where (file, endpoint, or component),
- a reproduction (request, payload, or PoC),
- the impact you believe it has,
- any suggested fix.

You can expect an acknowledgement within 72 hours and a resolution plan (or a clear "won't fix, because…") within 14 days. Good-faith reports will be credited in the release notes unless you prefer to stay anonymous.

## Supported versions

The latest minor release on the default branch receives security fixes. This project is self-hosted: applying a fix means pulling and redeploying.

## Scope

In scope:

- **Tenant isolation** — any way one library can read or modify another library's data. This is the crown-jewel property; the codebase even ships tests trying to break it. Reports here are the highest priority.
- Authentication & token handling (JWT, refresh rotation, scope separation between staff / patron / platform clients).
- Authorization bypasses (role gating for waivers, refunds, role changes, domain changes…).
- SQL injection, XSS, CSRF, SSRF, mass assignment.
- Billing webhook forgery or replay.
- Custom-domain verification bypass.
- Secrets exposure and insecure defaults.

Out of scope:

- Vulnerabilities that require an already-compromised operator host, database, or `.env` (at that point the attacker owns the deployment).
- Denial of service by resource exhaustion against a deliberately misconfigured installation (rate limiting is on by default; expose the stack to the internet with the provided Caddy setup).
- Social engineering, physical access, and reports about demo credentials in `make seed` data (they exist on purpose, in development only).
- Missing security headers on a reverse proxy you added yourself that replaces Caddy.

## Hardening checklist for operators

If you are deploying Library Cloud for real users:

1. **Rotate every secret** in `.env` — `JWT_SECRET` (`openssl rand -hex 32`) and both database passwords, at minimum. The generated defaults are placeholders.
2. Keep `RATE_LIMIT_ENABLED=true` and set `REDIS_URL` (in-memory fallback is single-node only).
3. Run the app as the non-owner role (`APP_DB_ROLE`) — never point `DATABASE_URL` at the Postgres superuser. `DATABASE_URL_ADMIN` is for migrations only.
4. Keep TLS on (the bundled Caddy does this automatically once `ACME_EMAIL` and `APP_DOMAIN` are set).
5. Back up `pgdata` on a schedule and test restores.
6. Do not seed demo data in production (`make seed` is for demos; create your first library at `/register`).
