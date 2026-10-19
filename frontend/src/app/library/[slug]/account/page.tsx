"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  BookMarked,
  BookOpen,
  CalendarClock,
  CircleDollarSign,
  Clock3,
  Library,
  LogOut,
  RefreshCcw,
  Undo2,
  UserRound,
} from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageLoader,
  Tabs,
  useToast,
} from "@/components/ui";
import { StatCard } from "@/components/dashboard/page-header";
import { OpacFooter, OpacHeader, usePublicTenant } from "@/components/opac";
import { ApiError, api, loginPatron, logout } from "@/lib/api";
import { dueLabel, formatDate, formatMoney } from "@/lib/format";
import { useApi, useSession } from "@/lib/hooks";
import type { Fine, PatronHoldItem, PatronLoan, PatronLoanHistory, PatronProfile } from "@/lib/types";

type TabId = "loans" | "holds" | "history" | "fines" | "profile";

function LoginCard({ slug, onSuccess }: { slug: string; onSuccess: () => void }) {
  const { push } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await loginPatron(slug, email.trim(), password);
      push({ title: "Welcome back", tone: "success" });
      onSuccess();
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "invalid_credentials"
          ? "Email or password is incorrect."
          : err instanceof ApiError
            ? err.message
            : "Sign-in failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-10">
      <Card>
        <CardHeader title="Sign in to your account" subtitle="Your library card, holds and loans in one place" />
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email">
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
          </Field>
          {error ? <Callout tone="danger">{error}</Callout> : null}
          <Button type="submit" className="w-full" loading={busy}>
            Sign in
          </Button>
        </form>
        <p className="mt-4 text-center text-[12.5px] text-ink-400">
          Don’t have an account? Ask the library desk to register you, or visit{" "}
          <Link href={`/library/${slug}`} className="font-medium text-[var(--brand)] hover:underline">
            the catalog
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}

function LoansTab() {
  const { push } = useToast();
  const loans = useApi<PatronLoan[]>("/me/loans", { scope: "patron" });
  const [renewing, setRenewing] = useState<string | null>(null);

  async function renew(loan: PatronLoan) {
    setRenewing(loan.id);
    try {
      await api.post(`/me/loans/${loan.id}/renew`, {}, { scope: "patron" });
      push({ title: "Loan renewed", description: loan.bookTitle, tone: "success" });
      loans.reload();
    } catch (err) {
      push({
        title: "Unable to renew",
        description:
          err instanceof ApiError && err.code === "renewal_limit_reached"
            ? "You’ve used all your renewals for this loan."
            : err instanceof ApiError
              ? err.message
              : undefined,
        tone: "error",
      });
    } finally {
      setRenewing(null);
    }
  }

  const items = loans.data ?? [];
  if (loans.loading && !loans.data) return <PageLoader label="Loading your loans" />;
  if (items.length === 0)
    return (
      <EmptyState
        icon={<BookOpen className="h-5 w-5" />}
        title="No active loans"
        description="Borrow something from the catalog and it will appear here."
      />
    );

  return (
    <div className="space-y-3">
      {items.map((loan) => {
        const due = dueLabel(loan.dueAt, loan.status);
        const badgeTone = due.tone === "danger" ? "danger" : due.tone === "warn" ? "warn" : "success";
        return (
          <Card key={loan.id} padded={false} className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                {loan.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={loan.coverUrl} alt="" className="h-16 w-11 shrink-0 rounded-lg object-cover ring-1 ring-ink-900/5" />
                ) : (
                  <span className="flex h-16 w-11 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-300">
                    <BookOpen className="h-4 w-4" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-ink-800">{loan.bookTitle}</p>
                  <p className="mt-0.5 text-[12.5px] text-ink-400">
                    {(loan.bookAuthors ?? []).join(", ") || "Unknown author"}
                    {loan.copyBarcode ? ` · ${loan.copyBarcode}` : ""}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge tone={badgeTone}>{due.label}</Badge>
                    <span className="text-[11.5px] text-ink-300">Renewed {loan.renewedCount}×</span>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                icon={<RefreshCcw className="h-3.5 w-3.5" />}
                loading={renewing === loan.id}
                onClick={() => renew(loan)}
              >
                Renew
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function HoldsTab() {
  const { push } = useToast();
  const holds = useApi<PatronHoldItem[]>("/me/holds", { scope: "patron" });
  const [cancelling, setCancelling] = useState<string | null>(null);

  async function cancel(hold: PatronHoldItem) {
    setCancelling(hold.id);
    try {
      await api.post(`/me/holds/${hold.id}/cancel`, {}, { scope: "patron" });
      push({ title: "Hold cancelled", description: hold.bookTitle, tone: "success" });
      holds.reload();
    } catch (err) {
      push({ title: "Unable to cancel", description: err instanceof ApiError ? err.message : undefined, tone: "error" });
    } finally {
      setCancelling(null);
    }
  }

  const items = holds.data ?? [];
  if (holds.loading && !holds.data) return <PageLoader label="Loading your holds" />;
  if (items.length === 0)
    return (
      <EmptyState
        icon={<BookMarked className="h-5 w-5" />}
        title="No open holds"
        description="Reserve a title from the catalog and track it here."
      />
    );

  return (
    <div className="space-y-3">
      {items.map((hold) => (
        <Card key={hold.id} className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            {hold.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hold.coverUrl} alt="" className="h-16 w-11 shrink-0 rounded-lg object-cover ring-1 ring-ink-900/5" />
            ) : (
              <span className="flex h-16 w-11 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-300">
                <BookOpen className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-ink-800">{hold.bookTitle}</p>
              <p className="mt-0.5 text-[12.5px] text-ink-400">Placed {formatDate(hold.placedAt)}</p>
              <div className="mt-1.5">
                {hold.status === "ready" ? (
                  <Badge tone="success">Ready for pickup</Badge>
                ) : (
                  <Badge tone="warn">Waiting</Badge>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-rose-500 hover:bg-rose-50"
            icon={<Undo2 className="h-3.5 w-3.5" />}
            loading={cancelling === hold.id}
            onClick={() => cancel(hold)}
          >
            Cancel
          </Button>
        </Card>
      ))}
    </div>
  );
}

function HistoryTab() {
  const history = useApi<PatronLoanHistory[]>("/me/loans/history", { scope: "patron" });
  const items = history.data ?? [];
  if (history.loading && !history.data) return <PageLoader label="Loading history" />;
  if (items.length === 0)
    return (
      <EmptyState
        icon={<Clock3 className="h-5 w-5" />}
        title="No borrowing history yet"
        description="Returned loans show up here."
      />
    );

  return (
    <Card padded={false}>
      <div className="divide-y divide-ink-100">
        {items.map((loan) => (
          <div key={loan.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-medium text-ink-800">{loan.bookTitle}</p>
              <p className="mt-0.5 text-[12px] text-ink-400">
                Checked out {formatDate(loan.checkedOutAt)}
                {loan.returnedAt ? ` · Returned ${formatDate(loan.returnedAt)}` : ""}
              </p>
            </div>
            <Badge tone={loan.status === "returned" ? "neutral" : "danger"}>{loan.status === "returned" ? "Returned" : "Lost"}</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

function FinesTab({ currency }: { currency: string }) {
  const fines = useApi<{ items: Fine[]; outstandingCents: number }>("/me/fines", { scope: "patron" });
  const data = fines.data;
  if (fines.loading && !fines.data) return <PageLoader label="Loading fines" />;

  return (
    <div className="space-y-4">
      {data && data.outstandingCents > 0 ? (
        <Callout tone="warn">
          You have {formatMoney(data.outstandingCents, currency)} outstanding — please settle at the library desk.
        </Callout>
      ) : null}
      {(data?.items ?? []).length === 0 ? (
        <EmptyState
          icon={<CircleDollarSign className="h-5 w-5" />}
          title="No fines"
          description="Clean record — keep returning on time."
        />
      ) : (
        <Card padded={false}>
          <div className="divide-y divide-ink-100">
            {(data?.items ?? []).map((fine) => (
              <div key={fine.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div>
                  <p className="text-[13.5px] font-medium text-ink-800">{fine.type === "overdue" ? "Overdue fee" : `${fine.type[0]?.toUpperCase()}${fine.type.slice(1)} fee`}</p>
                  <p className="mt-0.5 text-[12px] text-ink-400">
                    {formatDate(fine.createdAt)}
                    {fine.note ? ` · ${fine.note}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[13.5px] font-semibold text-ink-800">{formatMoney(fine.amountCents, fine.currency || currency)}</span>
                  <Badge tone={fine.status === "outstanding" ? "danger" : fine.status === "paid" ? "success" : "neutral"}>
                    {fine.status === "outstanding" ? "Outstanding" : fine.status === "paid" ? "Paid" : "Waived"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function ProfileTab({ profile, onSaved }: { profile: PatronProfile; onSaved: () => void }) {
  const { push } = useToast();
  const [email, setEmail] = useState(profile.member.email ?? "");
  const [phone, setPhone] = useState(profile.member.phone ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEmail(profile.member.email ?? "");
    setPhone(profile.member.phone ?? "");
  }, [profile]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.patch("/me", { email: email.trim() || null, phone: phone.trim() || null }, { scope: "patron" });
      push({ title: "Contact details updated", tone: "success" });
      onSaved();
    } catch (err) {
      push({ title: "Unable to save", description: err instanceof ApiError ? err.message : undefined, tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="Contact details" subtitle="Used for due-date reminders and hold alerts" />
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email">
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+1 555 0100" />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              Save
            </Button>
          </div>
        </form>
      </Card>
      <Card>
        <CardHeader title="Library card" subtitle="Presented at the desk when borrowing" />
        <div className="space-y-3 text-[13.5px]">
          <div className="flex justify-between">
            <span className="text-ink-400">Card number</span>
            <span className="font-mono font-semibold text-ink-800">{profile.member.cardNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-400">Name</span>
            <span className="font-medium text-ink-800">{profile.member.fullName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-400">Category</span>
            <span className="font-medium text-ink-800">{profile.member.category}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-400">Member since</span>
            <span className="font-medium text-ink-800">{profile.member.joinedAt ? formatDate(profile.member.joinedAt) : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-400">Status</span>
            <Badge tone={profile.member.status === "active" ? "success" : "warn"}>{profile.member.status}</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-ink-50/60">
          <PageLoader label="Opening your account" />
        </div>
      }
    >
      <AccountContent />
    </Suspense>
  );
}

function AccountContent() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const searchParams = useSearchParams();
  const router = useRouter();
  const { tenant, error, loading } = usePublicTenant(slug);
  const { session, ready } = useSession("patron");
  const [tab, setTab] = useState<TabId>("loans");
  const [version, setVersion] = useState(0);

  const matches = Boolean(session && (!session.tenant || session.tenant.slug === slug));
  const profile = useApi<PatronProfile>(matches ? "/me" : null, { scope: "patron", query: { v: version } });

  const next = searchParams.get("next");

  if (loading || !ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50/60">
        <PageLoader label="Opening your account" />
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink-50/60 px-4 text-center">
        <Library className="h-6 w-6 text-ink-400" />
        <h1 className="text-lg font-bold text-ink-900">Library not found</h1>
        <Link href="/" className="text-sm font-medium text-[var(--brand)] hover:underline">
          Go to Library Cloud →
        </Link>
      </div>
    );
  }

  const currency = "USD";

  return (
    <div className="min-h-screen bg-ink-50/60">
      <OpacHeader
        tenant={tenant}
        slug={slug}
        showSearch={false}
        session={matches ? { name: session?.user.name ?? "" } : null}
      />

      <main className="mx-auto max-w-5xl px-4 pb-10 pt-8 sm:px-6">
        {!matches ? (
          <LoginCard
            slug={slug}
            onSuccess={() => {
              if (next && next.startsWith("/")) router.push(next);
            }}
          />
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-ink-900">
                  Hello, {profile.data?.member.fullName?.split(" ")[0] ?? session?.user.name?.split(" ")[0] ?? "reader"}
                </h1>
                <p className="mt-0.5 text-[13px] text-ink-400">{tenant.branding.displayName || tenant.name}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                icon={<LogOut className="h-3.5 w-3.5" />}
                onClick={async () => {
                  await logout("patron");
                }}
              >
                Sign out
              </Button>
            </div>

            {profile.error ? (
              <Callout tone="danger">We couldn’t load your account. Please sign out and try again.</Callout>
            ) : (
              <>
                <div className="mb-6 grid gap-4 sm:grid-cols-3">
                  <StatCard
                    label="Active loans"
                    value={profile.data?.stats.activeLoans ?? "—"}
                    icon={<BookOpen className="h-4 w-4" />}
                  />
                  <StatCard
                    label="Open holds"
                    value={profile.data?.stats.openHolds ?? "—"}
                    icon={<BookMarked className="h-4 w-4" />}
                  />
                  <StatCard
                    label="Outstanding fines"
                    value={profile.data ? formatMoney(profile.data.stats.outstandingCents, currency) : "—"}
                    icon={<CircleDollarSign className="h-4 w-4" />}
                    tone={profile.data && profile.data.stats.outstandingCents > 0 ? "danger" : "neutral"}
                  />
                </div>

                <Tabs<TabId>
                  tabs={[
                    { id: "loans", label: "Loans" },
                    { id: "holds", label: "Holds" },
                    { id: "history", label: "History" },
                    { id: "fines", label: "Fines" },
                    { id: "profile", label: "Profile" },
                  ]}
                  active={tab}
                  onChange={setTab}
                  className="mb-5"
                />

                {tab === "loans" ? <LoansTab /> : null}
                {tab === "holds" ? <HoldsTab /> : null}
                {tab === "history" ? <HistoryTab /> : null}
                {tab === "fines" ? <FinesTab currency={currency} /> : null}
                {tab === "profile" && profile.data ? (
                  <ProfileTab profile={profile.data} onSaved={() => setVersion((value) => value + 1)} />
                ) : null}
                {tab === "profile" && !profile.data ? (
                  <div className="flex justify-center py-10">
                    <PageLoader label="Loading profile" />
                  </div>
                ) : null}
              </>
            )}
          </>
        )}
      </main>

      <OpacFooter tenant={tenant} slug={slug} />
    </div>
  );
}
