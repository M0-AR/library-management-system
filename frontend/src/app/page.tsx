import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  Check,
  Clock,
  Globe,
  Layers,
  Library,
  Palette,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Logo } from "@/components/logo";

const features = [
  {
    icon: Library,
    title: "Catalog & copies",
    body: "ISBN lookup, cover art, categories, tags and per-branch copy tracking with barcodes.",
  },
  {
    icon: Clock,
    title: "Circulation",
    body: "Checkout, returns, renewals and overdue handling with configurable loan policies.",
  },
  {
    icon: Layers,
    title: "Holds queue",
    body: "Automatic allocation when a copy returns, ready-for-pickup shelf with expiry.",
  },
  {
    icon: Users,
    title: "Members & patrons",
    body: "Membership cards, categories, self-service portal with loans, holds and fines.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    body: "Circulation trends, top titles and live operational metrics on one dashboard.",
  },
  {
    icon: ShieldCheck,
    title: "Multi-tenant security",
    body: "Row-level isolation per library, role-based staff access, audit trails built in.",
  },
];

const plans = [
  { name: "Free", price: "$0", period: "forever", tagline: "For single-branch trials", features: ["250 books", "100 members", "1 branch", "Full circulation"] },
  { name: "Starter", price: "$29", period: "per month", tagline: "For growing libraries", features: ["2,500 books", "1,000 members", "3 branches", "OPAC + patron portal"], highlight: false },
  { name: "Growth", price: "$79", period: "per month", tagline: "For library networks", features: ["25,000 books", "10,000 members", "10 branches", "Custom domain"], highlight: true },
  { name: "Enterprise", price: "$199", period: "per month", tagline: "For large institutions", features: ["250,000 books", "100,000 members", "Unlimited branches", "Priority support"] },
];

const opacHighlights = [
  { icon: Search, title: "Public catalog", body: "Shareable OPAC with instant search, categories and live availability." },
  { icon: Globe, title: "Custom domains", body: "Serve each library on your own domain with full white-label branding." },
  { icon: Palette, title: "Your brand", body: "Colors, logo and welcome message configured per library in seconds." },
  { icon: Building2, title: "Any deployment", body: "Docker Compose to your cloud — data stays in your own Postgres." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ink-950 text-white">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-ink-950/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo tone="light" />
          <nav className="hidden items-center gap-8 text-sm text-white/70 md:flex">
            <a href="#features" className="transition-colors hover:text-white">Features</a>
            <a href="#opac" className="transition-colors hover:text-white">OPAC</a>
            <a href="#pricing" className="transition-colors hover:text-white">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-xl px-3.5 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-white"
            >
              Staff sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-ink-950 transition-all hover:bg-white/90"
            >
              Start free
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <section className="hero-grid relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(closest-side, var(--brand), transparent)" }}
        />
        <div className="relative mx-auto max-w-6xl px-5 pb-24 pt-20 text-center sm:pt-28">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-[13px] text-white/70">
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
            Catalog · Circulation · Holds · Fines · OPAC — one platform
          </div>
          <h1 className="text-balance mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
            Run your library like a{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(120deg, var(--brand), var(--accent))" }}
            >
              modern product
            </span>
          </h1>
          <p className="text-balance mx-auto mt-6 max-w-2xl text-lg text-white/60">
            Library Cloud gives your team a beautiful staff console, your patrons a polished catalog,
            and gives you per-library isolation, branding and analytics out of the box.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex h-12 items-center gap-2 rounded-xl px-6 text-[15px] font-semibold text-white shadow-lg transition-all hover:brightness-110"
              style={{ background: "linear-gradient(135deg, var(--brand), var(--accent))" }}
            >
              Create your library
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 text-[15px] font-medium text-white/90 transition-colors hover:bg-white/10"
            >
              <BookOpen className="h-4 w-4" />
              Open staff console
            </Link>
          </div>

          <div className="relative mx-auto mt-16 max-w-4xl">
            <div className="absolute inset-x-8 -top-6 h-24 rounded-3xl bg-white/5 blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-ink-900/80 shadow-2xl backdrop-blur">
              <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                <span className="ml-3 text-xs text-white/40">library-cloud / dashboard</span>
              </div>
              <div className="grid gap-3 p-5 text-left sm:grid-cols-3">
                {[
                  { label: "Active loans", value: "1,284", delta: "+6.4% this month" },
                  { label: "Ready holds", value: "37", delta: "12 expiring today" },
                  { label: "Outstanding fines", value: "$412", delta: "94 open fines" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                    <p className="text-xs text-white/40">{stat.label}</p>
                    <p className="mt-1 text-2xl font-bold">{stat.value}</p>
                    <p className="mt-1 text-[11px] text-emerald-400/80">{stat.delta}</p>
                  </div>
                ))}
                <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4 sm:col-span-2">
                  <p className="text-xs text-white/40">Circulation, last 30 days</p>
                  <div className="mt-3 flex h-24 items-end gap-1">
                    {[38, 44, 41, 52, 49, 61, 58, 66, 62, 71, 68, 77, 73, 82, 79, 88, 84, 92, 87, 95].map(
                      (value, index) => (
                        <span
                          key={index}
                          className="flex-1 rounded-sm"
                          style={{
                            height: `${value}%`,
                            background: "linear-gradient(180deg, var(--accent), var(--brand))",
                            opacity: 0.5 + (index / 20) * 0.5,
                          }}
                        />
                      ),
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                  <p className="text-xs text-white/40">Top title</p>
                  <p className="mt-2 text-sm font-semibold">The Midnight Library</p>
                  <p className="text-[11px] text-white/40">142 checkouts · 6 copies</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="border-t border-white/5 bg-ink-950 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Everything a library runs on</h2>
            <p className="mt-4 text-white/50">
              Built for real circulation workflows — not a spreadsheet with a login page.
            </p>
          </div>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-colors hover:border-white/10 hover:bg-white/[0.04]"
              >
                <div
                  className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl text-white"
                  style={{ background: "linear-gradient(135deg, var(--brand), var(--accent))" }}
                >
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="text-[15px] font-semibold">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/50">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="opac" className="border-t border-white/5 bg-ink-900/40 py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              A catalog your patrons will actually enjoy
            </h2>
            <p className="mt-4 text-white/50">
              Every library gets a public OPAC at its own address, styled with its own branding.
              Search, availability, holds and self-service — on any device.
            </p>
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {opacHighlights.map((item) => (
                <div key={item.title} className="flex gap-3.5">
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-[var(--accent)]">
                    <item.icon className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-white/45">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-6 rounded-3xl opacity-20 blur-2xl" style={{ background: "radial-gradient(closest-side, var(--brand), transparent)" }} />
            <div className="relative rounded-2xl border border-white/10 bg-ink-950 p-5 shadow-2xl">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5">
                <Search className="h-4 w-4 text-white/40" />
                <span className="text-sm text-white/50">Search the catalog — title, author or ISBN</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  { t: "Klara and the Sun", a: "Kazuo Ishiguro", s: "2 of 4 available" },
                  { t: "Project Hail Mary", a: "Andy Weir", s: "Waitlist · 3" },
                  { t: "Dune", a: "Frank Herbert", s: "1 of 6 available" },
                ].map((book) => (
                  <div key={book.t} className="rounded-xl border border-white/5 bg-white/[0.03] p-3.5">
                    <div
                      className="mb-3 h-24 rounded-lg"
                      style={{ background: "linear-gradient(150deg, color-mix(in oklab, var(--brand) 55%, #0f172a), color-mix(in oklab, var(--accent) 45%, #0f172a))" }}
                    />
                    <p className="truncate text-[13px] font-semibold">{book.t}</p>
                    <p className="truncate text-[11px] text-white/40">{book.a}</p>
                    <p className="mt-1.5 text-[11px] font-medium text-[var(--accent)]">{book.s}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="border-t border-white/5 py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Simple, honest pricing</h2>
            <p className="mt-4 text-white/50">Start free today. Upgrade when your collection grows.</p>
          </div>
          <div className="mt-14 grid gap-4 lg:grid-cols-4">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border p-6 ${
                  plan.highlight
                    ? "border-[var(--brand)]/60 bg-gradient-to-b from-[var(--brand)]/15 to-transparent shadow-xl"
                    : "border-white/8 bg-white/[0.02]"
                }`}
              >
                {plan.highlight ? (
                  <span className="absolute -top-3 left-6 rounded-full bg-[var(--brand)] px-3 py-1 text-[11px] font-semibold text-white">
                    Most popular
                  </span>
                ) : null}
                <h3 className="text-[15px] font-semibold">{plan.name}</h3>
                <p className="mt-0.5 text-[13px] text-white/40">{plan.tagline}</p>
                <p className="mt-5">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="ml-2 text-sm text-white/40">{plan.period}</span>
                </p>
                <ul className="mt-6 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2.5 text-[13px] text-white/65">
                      <Check className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`mt-7 flex h-10 items-center justify-center rounded-xl text-sm font-semibold transition-all ${
                    plan.highlight
                      ? "bg-[var(--brand)] text-white hover:brightness-110"
                      : "border border-white/15 text-white/85 hover:bg-white/5"
                  }`}
                >
                  Get started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/5 py-20">
        <div className="mx-auto max-w-4xl px-5 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Your library deserves better software</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/50">
            Spin up a fully working library in under a minute. No credit card required.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl px-7 text-[15px] font-semibold text-white shadow-lg transition-all hover:brightness-110"
            style={{ background: "linear-gradient(135deg, var(--brand), var(--accent))" }}
          >
            Start free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-sm text-white/40 sm:flex-row">
          <Logo tone="light" size={28} />
          <p>Multi-tenant library management, self-hosted on your terms.</p>
          <div className="flex items-center gap-5">
            <Link href="/login" className="transition-colors hover:text-white">Staff</Link>
            <Link href="/platform/login" className="transition-colors hover:text-white">Platform</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
