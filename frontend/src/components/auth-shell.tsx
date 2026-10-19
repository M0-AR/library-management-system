import Link from "next/link";
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Logo } from "@/components/logo";

export function AuthShell({
  children,
  title,
  subtitle,
  side = "staff",
}: {
  children: ReactNode;
  title: string;
  subtitle: ReactNode;
  side?: "staff" | "platform" | "patron";
}) {
  const bullets =
    side === "platform"
      ? ["All libraries in one view", "Suspend or upgrade tenants", "Growth and usage analytics"]
      : side === "patron"
        ? ["Browse the catalog", "Track loans and holds", "Pay or view fines"]
        : ["Circulation, holds and fines", "Members and catalog management", "Analytics for your team"];
  return (
    <div className="flex min-h-screen bg-white">
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-ink-950 p-10 text-white lg:flex">
        <div className="hero-grid absolute inset-0 opacity-60" />
        <div
          className="pointer-events-none absolute -left-24 top-1/3 h-[420px] w-[420px] rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(closest-side, var(--brand), transparent)" }}
        />
        <div className="relative">
          <Link href="/">
            <Logo tone="light" />
          </Link>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold leading-tight tracking-tight">
            The operating system for modern libraries.
          </h2>
          <ul className="mt-8 space-y-3.5">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex items-center gap-3 text-[15px] text-white/70">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10">
                  <Check className="h-3.5 w-3.5 text-[var(--accent)]" />
                </span>
                {bullet}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/35">
          Multi-tenant · White-label · Self-hosted on your terms
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-md animate-fade-up">
          <div className="mb-8 lg:hidden">
            <Link href="/">
              <Logo />
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900">{title}</h1>
          <div className="mt-1.5 text-sm text-ink-500">{subtitle}</div>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
