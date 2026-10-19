import { BookMarked } from "lucide-react";

export function Logo({
  size = 34,
  showName = true,
  name,
  subtitle,
  tone = "brand",
}: {
  size?: number;
  showName?: boolean;
  name?: string;
  subtitle?: string;
  tone?: "brand" | "light";
}) {
  const appName = name ?? process.env.NEXT_PUBLIC_APP_NAME ?? "Library Cloud";
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className="inline-flex items-center justify-center rounded-xl text-white shadow-sm"
        style={{
          width: size,
          height: size,
          background: "linear-gradient(135deg, var(--brand), var(--accent))",
        }}
      >
        <BookMarked style={{ width: size * 0.52, height: size * 0.52 }} />
      </span>
      {showName ? (
        <span className="flex flex-col leading-none">
          <span className={`text-[15px] font-bold tracking-tight ${tone === "light" ? "text-white" : "text-ink-900"}`}>
            {appName}
          </span>
          {subtitle ? (
            <span className={`mt-0.5 text-[11px] font-medium ${tone === "light" ? "text-white/60" : "text-ink-400"}`}>
              {subtitle}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
