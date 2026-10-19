"use client";

import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  Search,
  X,
  XCircle,
} from "lucide-react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className,
  type = "button",
  ...rest
}: {
  children?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline" | "subtle";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
  type?: "button" | "submit";
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type">) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-150 select-none disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";
  const sizes = {
    sm: "h-8 px-3 text-[13px]",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-5 text-[15px]",
  };
  const variants = {
    primary:
      "text-white shadow-sm hover:brightness-110 active:brightness-95 bg-[var(--brand)]",
    secondary: "bg-ink-900 text-white hover:bg-ink-800 active:bg-ink-950 shadow-sm",
    outline: "border border-ink-200 bg-white text-ink-700 hover:bg-ink-50 hover:border-ink-300",
    ghost: "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
    subtle: "bg-ink-100 text-ink-700 hover:bg-ink-200",
    danger: "bg-rose-600 text-white hover:bg-rose-500 active:bg-rose-700 shadow-sm",
  };
  return (
    <button
      type={type}
      className={cx(base, sizes[size], variants[variant], className)}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function IconButton({
  children,
  className,
  label,
  ...rest
}: { children: ReactNode; className?: string; label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800 disabled:opacity-40",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Label({ children, htmlFor, className }: { children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cx("block text-[13px] font-medium text-ink-700", className)}>
      {children}
    </label>
  );
}

const fieldClass =
  "w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 transition-colors hover:border-ink-300 focus:border-[var(--brand)] focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]/40 disabled:bg-ink-50 disabled:text-ink-500";

export function Input({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(fieldClass, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(fieldClass, "min-h-24 resize-y", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(fieldClass, "appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m4%206%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_12px_center] bg-no-repeat pr-9", className)} {...rest}>
      {children}
    </select>
  );
}

export function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label?: string;
  error?: string | null;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children as React.ReactElement<{ id?: string; "aria-describedby"?: string }>, {
        id,
        "aria-describedby": describedBy,
      })
    : children;
  return (
    <div className={cx("space-y-1.5", className)}>
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <div>{control}</div>
      {error ? <p id={`${id}-error`} className="text-xs font-medium text-rose-600">{error}</p> : null}
      {!error && hint ? <p id={`${id}-hint`} className="text-xs text-ink-400">{hint}</p> : null}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 text-left"
    >
      {(label || description) && (
        <span className="min-w-0">
          {label ? <span className="block text-sm font-medium text-ink-800">{label}</span> : null}
          {description ? <span className="block text-xs text-ink-400">{description}</span> : null}
        </span>
      )}
      <span
        className={cx(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-[var(--brand)]" : "bg-ink-200",
        )}
      >
        <span
          className={cx(
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

export function Card({ children, className, padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <div className={cx("rounded-2xl border border-ink-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]", padded && "p-5", className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("mb-4 flex flex-wrap items-start justify-between gap-3", className)}>
      <div>
        <h3 className="text-[15px] font-semibold text-ink-900">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-[13px] text-ink-400">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warn" | "danger" | "info" | "brand";
  className?: string;
}) {
  const tones = {
    neutral: "bg-ink-100 text-ink-600 ring-ink-200",
    success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    warn: "bg-amber-50 text-amber-700 ring-amber-200",
    danger: "bg-rose-50 text-rose-700 ring-rose-200",
    info: "bg-sky-50 text-sky-700 ring-sky-200",
    brand: "bg-[var(--brand-soft)] text-[var(--brand)] ring-[var(--brand-ring)]/50",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx("h-5 w-5 animate-spin text-ink-400", className)} />;
}

export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-ink-400">
      <Spinner className="h-6 w-6" />
      <p className="text-sm">{label}…</p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton rounded-lg", className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center animate-fade-in">
      {icon ? (
        <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-100 text-ink-400">{icon}</div>
      ) : null}
      <h3 className="text-sm font-semibold text-ink-800">{title}</h3>
      {description ? <p className="max-w-sm text-[13px] text-ink-400">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  const sizes = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          "relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl animate-fade-up sm:rounded-2xl",
          sizes[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-6 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[13px] text-ink-400">{subtitle}</p> : null}
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-2 border-t border-ink-100 bg-ink-50/50 px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  tone = "danger",
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-600">{description}</p>
    </Modal>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  onPage,
  perPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (page: number) => void;
  perPage?: number;
}) {
  if (total === 0) return null;
  const from = perPage ? (page - 1) * perPage + 1 : (page - 1) * 20 + 1;
  const to = perPage ? Math.min(page * perPage, total) : Math.min(page * 20, total);
  return (
    <div className="flex items-center justify-between gap-3 pt-4">
      <p className="text-[13px] text-ink-400">
        Showing <span className="font-medium text-ink-600">{from}–{to}</span> of{" "}
        <span className="font-medium text-ink-600">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <IconButton label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </IconButton>
        <span className="min-w-16 text-center text-[13px] font-medium text-ink-600">
          {page} / {Math.max(1, totalPages)}
        </span>
        <IconButton label="Next page" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cx("relative", className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cx(fieldClass, "pl-10")}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: { id: T; label: string; count?: number }[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-wrap items-center gap-1 rounded-xl bg-ink-100/80 p-1", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cx(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all",
            active === tab.id ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800",
          )}
        >
          {tab.label}
          {tab.count !== undefined ? (
            <span className={cx("rounded-full px-1.5 py-px text-[11px] font-semibold", active === tab.id ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "bg-ink-200/70 text-ink-500")}>
              {tab.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function Avatar({ name, size = 36, className }: { name: string; size?: number; className?: string }) {
  const text = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  const hue = useMemo(() => {
    let hash = 0;
    for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360;
    return hash;
  }, [name]);
  return (
    <span
      className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, hsl(${hue} 70% 52%), hsl(${(hue + 40) % 360} 70% 44%))`,
      }}
    >
      {text || "?"}
    </span>
  );
}

interface Toast {
  id: number;
  title: string;
  description?: string;
  tone: "success" | "error" | "info";
}

const ToastContext = createContext<{ push: (toast: Omit<Toast, "id">) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { ...toast, id }]);
    setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4200);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-ink-200 bg-white p-3.5 shadow-lg animate-fade-up"
          >
            {toast.tone === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-emerald-500" />
            ) : toast.tone === "error" ? (
              <XCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-rose-500" />
            ) : (
              <Info className="mt-0.5 h-4.5 w-4.5 shrink-0 text-sky-500" />
            )}
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-ink-800">{toast.title}</p>
              {toast.description ? <p className="mt-0.5 text-xs text-ink-500">{toast.description}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}

export function Callout({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "warn" | "danger" | "success";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    info: "bg-sky-50 text-sky-800 border-sky-200",
    warn: "bg-amber-50 text-amber-800 border-amber-200",
    danger: "bg-rose-50 text-rose-800 border-rose-200",
    success: "bg-emerald-50 text-emerald-800 border-emerald-200",
  };
  const icons = {
    info: <Info className="h-4 w-4" />,
    warn: <AlertTriangle className="h-4 w-4" />,
    danger: <AlertTriangle className="h-4 w-4" />,
    success: <Check className="h-4 w-4" />,
  };
  return (
    <div className={cx("flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[13px]", tones[tone], className)}>
      <span className="mt-0.5 shrink-0">{icons[tone]}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export { fieldClass };
