import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 text-[13.5px] text-ink-400">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "danger" | "warn" | "success" | "brand";
}) {
  const tones = {
    neutral: "bg-ink-100 text-ink-500",
    danger: "bg-rose-50 text-rose-500",
    warn: "bg-amber-50 text-amber-500",
    success: "bg-emerald-50 text-emerald-500",
    brand: "bg-[var(--brand-soft)] text-[var(--brand)]",
  };
  return (
    <div className="rounded-2xl border border-ink-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-md animate-fade-up">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] font-medium text-ink-400">{label}</p>
        {icon ? <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${tones[tone]}`}>{icon}</span> : null}
      </div>
      <p className="mt-2 text-[26px] font-bold leading-none tracking-tight text-ink-900">{value}</p>
      {hint ? <div className="mt-2 text-[12px] text-ink-400">{hint}</div> : null}
    </div>
  );
}
