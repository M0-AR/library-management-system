# Library Cloud — business playbook

This document is for the operator: the person who deploys Library Cloud and sells it to libraries. It covers who buys, why they buy, what to charge, what it costs to serve, and how to get the first ten customers. Everything here is a starting point — adjust to your market.

---

## 1. The market

### Who buys

| Segment | Size signal | Today they use | Willingness to pay |
|---|---|---|---|
| Small public libraries (1–3 branches) | Tens of thousands worldwide | Legacy desktop ILS, spreadsheets | $30–$200/mo |
| School & university department libraries | Hundreds of thousands | Spreadsheets, donated software | $20–$100/mo (often via the school) |
| Private & membership libraries | Niche but wealthy | Bespoke systems, paper ledgers | $50–$300/mo |
| Religious & community libraries | Very large, very underserved | Paper, spreadsheets | $10–$50/mo |
| Corporate & office libraries | Thousands | Spreadsheets | $50–$200/mo |

### What they hate about the status quo

1. **Price** — legacy ILS licenses run $2,000–$20,000+/year with per-module upcharges and per-seat fees.
2. **Complexity** — systems designed for consortiums, then sold to a two-branch town.
3. **Old technology** — desktop clients, local servers, backup tapes, no mobile experience.
4. **Lock-in** — data export costs extra; leaving is impractical.
5. **No self-service** — patrons call the desk for what a web page should do.

Library Cloud answers each of these head-on. The README's comparison table is your sales sheet; this document is your operating manual.

---

## 2. What you are selling

Three things, in the order buyers feel them:

1. **Peace of mind** — data is isolated, backed up, and exportable. No per-seat surprises.
2. **A modern public face** — a white-label catalog and patron self-service on the library's own domain. This is the demo people say "oh" to.
3. **Time back** — renewals, hold queues, fine math, and reminders run themselves. Front-desk minutes are the currency libraries actually count.

### Positioning statement (template)

> [Library name] runs on Library Cloud: a complete, modern catalog, circulation and holds system with a public catalog branded as your own — for a fraction of what legacy systems charge, with your data always exportable.

### Objection handling

| Objection | Answer |
|---|---|
| "We've used [legacy product] for 15 years." | Nothing to relearn for patrons; staff learn the six screens that matter in an afternoon. CSV import gets your catalog in; your old system stays untouched until you're confident. |
| "Is our data safe in the cloud?" | One library per tenant, enforced at the database level (row-level security), daily backups, encryption in transit, export any time. Or self-host it — same product, your server. |
| "What if you go out of business?" | MIT-licensed source, self-hostable today, your data exportable in standard formats. The product doesn't depend on us existing. |
| "We have no IT staff." | One URL to open, one password per staff member. The hosted plan includes upgrades and backups; there is nothing to install. |
| "It's missing MARC21 / self-checkout machines / [feature]." | Honest roadmap, public issue tracker, and the source is MIT — features can be sponsored or built by anyone, including your local developer. |

---

## 3. Pricing

Three plans ship in the product's billing module; the numbers below are placeholders you can change in one migration-free settings change.

| | **Starter** | **Growth** | **Enterprise** |
|---|---|---|---|
| Price | $29/mo | $79/mo | $199/mo |
| Branches | 1 | 3 | Unlimited |
| Staff seats | 5 | 25 | Unlimited |
| Members | 2,000 | 20,000 | Unlimited |
| White-label OPAC | ✓ | ✓ | ✓ |
| Custom domain | — | ✓ | ✓ |
| Support | Email | Priority email | Priority + onboarding call |

**Pricing psychology that works in this market**

- Anchor against legacy software on every page: "$199/mo vs. $12,000/year" is the whole argument.
- Offer **annual billing with two months free** — libraries budget annually anyway.
- Charge for *onboarding*, not features: imported catalog + staff training as a one-time $300–$800 service. It's the highest-margin revenue you'll have.
- Offer a **free tier for a single-branch library under 500 titles** if you want a volume funnel; the marginal cost of a light tenant is pennies.

---

## 4. Unit economics

Per-tenant cost on a $12–24/mo VM (2 vCPU / 2 GB), measured on this stack:

| Item | Monthly |
|---|---|
| VM (shared across all tenants) | $12–24 total |
| Backups / snapshots | $1–5 total |
| Domain & TLS | ~$1 (amortized) |
| Email (SMTP provider) | $0–10 total |
| **Marginal cost per light tenant** | **< $0.50** |

At $29–$199/mo per library, gross margin is **98 %+** until you add humans. The real cost centers are support and onboarding — which the product deliberately minimizes (self-service seed data, obvious screens, one-command deploy) and which you should charge for anyway.

**Break-even math:** 1 VM + one part-time operator costs ~$500/mo; 7 Starter customers or 3 Growth customers covers it. Everything after is profit or reinvestment.

---

## 5. Go-to-market: the first ten customers

### Before selling

1. Deploy on a real domain (`make up` + DNS), not localhost — credibility is visual.
2. Create **three demo tenants** with realistic, localized data (your city's library names, local authors). Recruit a librarian acquaintance to play with it for an hour and fix the top three confusions.
3. Prepare a 3-minute screen-share script: create a library, add a book, check it out, let a "patron" place a hold, return it, show the dashboard and audit log. That's the whole pitch.
4. Put a pricing page on your marketing site. This README's [screenshot gallery](../README.md#-screenshot-gallery) is your asset library.

### Channels that work for this buyer

| Channel | Why it works | First action |
|---|---|---|
| Local library associations & conferences | Librarians trust peers, not ads | Offer a free talk: "Modern catalog on a small budget" |
| Direct outreach to small libraries | Decision-maker is one person | Email: 3 sentences + 3-minute video + free pilot |
| School districts & private schools | One sale = many small libraries | Pilot with one department library |
| Community/religious organizations | Underserved, grateful, refer each other | Offer a steep discount for a public testimonial |
| Freelance developers | They get asked to build exactly this | Referral partnership: 20 % first-year commission |

### The pilot offer that converts

> "We'll import your catalog, set up your branded public page, and train your staff — free for 60 days. If it isn't better than what you use now, we remove it, no invoice."

Why this converts: switching cost is the real competitor. A pilot removes it. Import work is 1–3 hours per library with a CSV script; training is one video call.

### Metrics to watch

- **Activation**: days from signup → first checkout recorded. Target < 7.
- **Catalog depth**: titles added in week one — correlates with retention more than any survey.
- **OPAC traffic**: public catalog visits per month — the white-label value proof.
- **Staff weekly actives**: if the desk isn't logging in, churn is coming. Call them before it does.

---

## 6. Support & operations checklist

- **Backup**: nightly `pg_dump` + weekly volume snapshot. Test a restore quarterly; it takes minutes and saves companies.
- **Monitoring**: at minimum an uptime check on `/api/v1/health` and the frontend `/healthz`.
- **Upgrades**: pull, `make rebuild`, watch migrations run, smoke-test login + one circulation action.
- **Incident comms**: email your tenant admins with status, impact, ETA. This market forgives downtime; it does not forgive silence.
- **Data requests**: exports are built in (CSV). For full-tenant data, `pg_dump` filtered by `tenant_id` — document the query once, reuse forever.

---

## 7. When to grow beyond this repository

The product is deliberately complete for the 1–3-branch market. Signs it's time to invest further:

- Multiple prospects asking for **MARC21 import** → build it; it's also your migration weapon.
- Schools asking for **student rostering (SSO/CSV sync)** → an integration, not a feature race.
- Libraries with **self-checkout machines** → SIP2 becomes worth a paid milestone.
- A consortium wants **shared catalogs across tenants** → this is a different product shape; price it as Enterprise+ and design carefully (it contradicts strict isolation as a default).

Every one of these is in the public roadmap of the main README. Sell the destination; ship the next step.
