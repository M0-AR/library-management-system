"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  CreditCard,
  ExternalLink,
  Globe2,
  Palette,
  Plus,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  ConfirmModal,
  EmptyState,
  Field,
  Input,
  PageLoader,
  Select,
  Switch,
  Tabs,
  Textarea,
  useToast,
} from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { CURRENCIES, LOCALES, TIMEZONES } from "@/lib/defaults";
import { formatDate, formatMoney, titleCase } from "@/lib/format";
import { useApi, useSession } from "@/lib/hooks";
import { useTenant } from "@/lib/tenant-context";
import type { Plan, Subscription, TenantDomain, TenantSettings } from "@/lib/types";

type TabId = "general" | "branding" | "circulation" | "notifications" | "opac" | "domains" | "billing";

function SectionCard({
  title,
  subtitle,
  onSave,
  saving,
  children,
  saveLabel = "Save changes",
}: {
  title: string;
  subtitle?: string;
  onSave?: () => void;
  saving?: boolean;
  children: React.ReactNode;
  saveLabel?: string;
}) {
  return (
    <Card className="max-w-3xl">
      <CardHeader title={title} subtitle={subtitle} />
      <div className="space-y-4">{children}</div>
      {onSave ? (
        <div className="mt-5 flex justify-end border-t border-ink-100 pt-4">
          <Button onClick={onSave} loading={saving}>
            {saveLabel}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function useSettingsSave() {
  const { push } = useToast();
  const { reload } = useTenant();
  const [saving, setSaving] = useState(false);

  async function save(patch: Partial<TenantSettings>) {
    setSaving(true);
    try {
      await api.patch("/tenants/me/settings", patch, { scope: "staff" });
      push({ title: "Settings saved", tone: "success" });
      reload();
    } catch (err) {
      push({ title: "Unable to save", description: err instanceof ApiError ? err.message : undefined, tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return { save, saving };
}

function GeneralSection() {
  const { settings } = useTenant();
  const { save, saving } = useSettingsSave();
  const [currency, setCurrency] = useState(settings.currency);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [locale, setLocale] = useState(settings.locale);

  useEffect(() => {
    setCurrency(settings.currency);
    setTimezone(settings.timezone);
    setLocale(settings.locale);
  }, [settings]);

  return (
    <SectionCard
      title="General"
      subtitle="Currency and locale used across the dashboard and receipts"
      onSave={() => save({ currency, timezone, locale })}
      saving={saving}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Currency">
          <Select value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {CURRENCIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Timezone">
          <Select value={timezone} onChange={(event) => setTimezone(event.target.value)}>
            {TIMEZONES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Language">
          <Select value={locale} onChange={(event) => setLocale(event.target.value)}>
            {LOCALES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Callout tone="info">
        Fines, prices and reports are displayed in {currency}. Members see the same currency in the public catalog.
      </Callout>
    </SectionCard>
  );
}

function BrandingSection() {
  const { tenant, settings } = useTenant();
  const { save, saving } = useSettingsSave();
  const [displayName, setDisplayName] = useState(settings.branding.displayName ?? "");
  const [primary, setPrimary] = useState(settings.branding.primaryColor);
  const [accent, setAccent] = useState(settings.branding.accentColor);
  const [welcome, setWelcome] = useState(settings.branding.welcomeMessage ?? "");
  const [logoUrl, setLogoUrl] = useState(settings.branding.logoUrl ?? "");

  useEffect(() => {
    setDisplayName(settings.branding.displayName ?? "");
    setPrimary(settings.branding.primaryColor);
    setAccent(settings.branding.accentColor);
    setWelcome(settings.branding.welcomeMessage ?? "");
    setLogoUrl(settings.branding.logoUrl ?? "");
  }, [settings]);

  return (
    <SectionCard
      title="Branding"
      subtitle="White-label the dashboard and public catalog"
      onSave={() =>
        save({
          branding: {
            displayName: displayName.trim() || undefined,
            primaryColor: primary,
            accentColor: accent,
            welcomeMessage: welcome.trim() || undefined,
            logoUrl: logoUrl.trim() || undefined,
          },
        })
      }
      saving={saving}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Display name" hint={`Defaults to “${tenant?.name ?? "library name"}”`}>
          <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={tenant?.name} />
        </Field>
        <Field label="Logo URL" hint="Shown in the public catalog header">
          <Input value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} placeholder="https://…/logo.png" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Primary color" hint="Buttons, links and highlights">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primary}
              onChange={(event) => setPrimary(event.target.value)}
              className="h-10 w-14 cursor-pointer rounded-lg border border-ink-200 bg-white p-1"
            />
            <Input value={primary} onChange={(event) => setPrimary(event.target.value)} className="font-mono" />
          </div>
        </Field>
        <Field label="Accent color" hint="Charts and secondary highlights">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={accent}
              onChange={(event) => setAccent(event.target.value)}
              className="h-10 w-14 cursor-pointer rounded-lg border border-ink-200 bg-white p-1"
            />
            <Input value={accent} onChange={(event) => setAccent(event.target.value)} className="font-mono" />
          </div>
        </Field>
      </div>
      <Field label="Welcome message" hint="Shown on your OPAC landing page">
        <Textarea value={welcome} onChange={(event) => setWelcome(event.target.value)} rows={2} maxLength={500} />
      </Field>
      <div className="rounded-xl border border-ink-200/80 p-4">
        <p className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold text-ink-700">
          <Palette className="h-3.5 w-3.5" /> Live preview
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="inline-flex h-9 items-center rounded-xl px-4 text-sm font-medium text-white shadow-sm"
            style={{ background: primary }}
          >
            Check out
          </span>
          <span className="inline-flex h-9 items-center rounded-xl px-4 text-sm font-medium text-white" style={{ background: accent }}>
            Return
          </span>
          <span className="inline-flex h-9 items-center rounded-xl border px-4 text-sm font-medium" style={{ borderColor: primary, color: primary }}>
            {displayName || tenant?.name}
          </span>
        </div>
      </div>
    </SectionCard>
  );
}

function NumberField({
  label,
  value,
  onChange,
  hint,
  suffix,
  min = 0,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  suffix?: string;
  min?: number;
}) {
  return (
    <Field label={suffix ? `${label} (${suffix})` : label} hint={hint}>
      <Input type="number" min={min} value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function CirculationSection() {
  const { settings } = useTenant();
  const { save, saving } = useSettingsSave();
  const circulation = settings.circulation;
  const [draft, setDraft] = useState({
    loanPeriodDays: String(circulation.loanPeriodDays),
    renewalPeriodDays: String(circulation.renewalPeriodDays),
    maxRenewals: String(circulation.maxRenewals),
    maxLoansPerMember: String(circulation.maxLoansPerMember),
    gracePeriodDays: String(circulation.gracePeriodDays),
    finePerDayCents: (circulation.finePerDayCents / 100).toFixed(2),
    maxOutstandingFineCents: (circulation.maxOutstandingFineCents / 100).toFixed(2),
    lostItemFeeCents: (circulation.lostItemFeeCents / 100).toFixed(2),
  });
  const [holdsEnabled, setHoldsEnabled] = useState(circulation.holdsEnabled);
  const [holdShelfExpiryDays, setHoldShelfExpiryDays] = useState(String(circulation.holdShelfExpiryDays));

  useEffect(() => {
    setDraft({
      loanPeriodDays: String(circulation.loanPeriodDays),
      renewalPeriodDays: String(circulation.renewalPeriodDays),
      maxRenewals: String(circulation.maxRenewals),
      maxLoansPerMember: String(circulation.maxLoansPerMember),
      gracePeriodDays: String(circulation.gracePeriodDays),
      finePerDayCents: (circulation.finePerDayCents / 100).toFixed(2),
      maxOutstandingFineCents: (circulation.maxOutstandingFineCents / 100).toFixed(2),
      lostItemFeeCents: (circulation.lostItemFeeCents / 100).toFixed(2),
    });
    setHoldsEnabled(circulation.holdsEnabled);
    setHoldShelfExpiryDays(String(circulation.holdShelfExpiryDays));
  }, [circulation]);

  function set(key: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <SectionCard
      title="Circulation policies"
      subtitle="Loan periods, limits and fine amounts applied to every new checkout"
      onSave={() =>
        save({
          circulation: {
            loanPeriodDays: Number(draft.loanPeriodDays),
            renewalPeriodDays: Number(draft.renewalPeriodDays),
            maxRenewals: Number(draft.maxRenewals),
            maxLoansPerMember: Number(draft.maxLoansPerMember),
            gracePeriodDays: Number(draft.gracePeriodDays),
            finePerDayCents: Math.round(Number(draft.finePerDayCents) * 100),
            maxOutstandingFineCents: Math.round(Number(draft.maxOutstandingFineCents) * 100),
            lostItemFeeCents: Math.round(Number(draft.lostItemFeeCents) * 100),
            holdsEnabled,
            holdShelfExpiryDays: Number(holdShelfExpiryDays),
          },
        })
      }
      saving={saving}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <NumberField label="Loan period" suffix="days" value={draft.loanPeriodDays} onChange={(v) => set("loanPeriodDays", v)} min={1} />
        <NumberField label="Renewal period" suffix="days" value={draft.renewalPeriodDays} onChange={(v) => set("renewalPeriodDays", v)} min={1} />
        <NumberField label="Max renewals" value={draft.maxRenewals} onChange={(v) => set("maxRenewals", v)} hint="Per loan" min={0} />
        <NumberField label="Max loans per member" value={draft.maxLoansPerMember} onChange={(v) => set("maxLoansPerMember", v)} min={1} />
        <NumberField label="Grace period" suffix="days" value={draft.gracePeriodDays} onChange={(v) => set("gracePeriodDays", v)} hint="Before fines start" min={0} />
        <NumberField label="Fine per day" suffix={settings.currency} value={draft.finePerDayCents} onChange={(v) => set("finePerDayCents", v)} />
        <NumberField label="Outstanding cap" suffix={settings.currency} value={draft.maxOutstandingFineCents} onChange={(v) => set("maxOutstandingFineCents", v)} hint="Blocks new checkouts above this" />
        <NumberField label="Lost item fee" suffix={settings.currency} value={draft.lostItemFeeCents} onChange={(v) => set("lostItemFeeCents", v)} />
      </div>
      <div className="space-y-3 rounded-xl border border-ink-200/80 p-4">
        <Switch
          checked={holdsEnabled}
          onChange={setHoldsEnabled}
          label="Enable holds"
          description="Let members reserve titles that are on loan"
        />
        {holdsEnabled ? (
          <div className="max-w-56">
            <NumberField
              label="Ready-shelf expiry"
              suffix="days"
              value={holdShelfExpiryDays}
              onChange={setHoldShelfExpiryDays}
              hint="Uncollected holds expire"
              min={1}
            />
          </div>
        ) : null}
      </div>
      <Callout tone="warn">
        Changes apply to loans created from now on — existing due dates and fines stay as they were.
      </Callout>
    </SectionCard>
  );
}

function NotificationsSection() {
  const { settings } = useTenant();
  const { save, saving } = useSettingsSave();
  const notifications = settings.notifications;
  const [emailEnabled, setEmailEnabled] = useState(notifications.emailEnabled);
  const [dueSoonDaysBefore, setDueSoonDaysBefore] = useState(String(notifications.dueSoonDaysBefore));
  const [overdueRemindersEnabled, setOverdueRemindersEnabled] = useState(notifications.overdueRemindersEnabled);
  const [holdReadyEmails, setHoldReadyEmails] = useState(notifications.holdReadyEmails);

  useEffect(() => {
    setEmailEnabled(notifications.emailEnabled);
    setDueSoonDaysBefore(String(notifications.dueSoonDaysBefore));
    setOverdueRemindersEnabled(notifications.overdueRemindersEnabled);
    setHoldReadyEmails(notifications.holdReadyEmails);
  }, [notifications]);

  return (
    <SectionCard
      title="Notifications"
      subtitle="Automated emails sent to your members"
      onSave={() =>
        save({
          notifications: {
            emailEnabled,
            dueSoonDaysBefore: Number(dueSoonDaysBefore),
            overdueRemindersEnabled,
            holdReadyEmails,
          },
        })
      }
      saving={saving}
    >
      <Switch
        checked={emailEnabled}
        onChange={setEmailEnabled}
        label="Member emails"
        description="Master switch for all outgoing member email"
      />
      <div className="space-y-4 rounded-xl border border-ink-200/80 p-4">
        <div className="max-w-56">
          <NumberField
            label="Due-soon reminder"
            suffix="days before"
            value={dueSoonDaysBefore}
            onChange={setDueSoonDaysBefore}
            min={1}
          />
        </div>
        <Switch
          checked={overdueRemindersEnabled}
          onChange={setOverdueRemindersEnabled}
          label="Overdue reminders"
          description="Email members when items pass their due date"
        />
        <Switch
          checked={holdReadyEmails}
          onChange={setHoldReadyEmails}
          label="Hold-ready alerts"
          description="Email members the moment their hold is available"
        />
      </div>
    </SectionCard>
  );
}

function OpacSection() {
  const { tenant, settings } = useTenant();
  const { save, saving } = useSettingsSave();
  const opac = settings.opac;
  const [enabled, setEnabled] = useState(opac.enabled);
  const [showCovers, setShowCovers] = useState(opac.showCovers);
  const [requireLogin, setRequireLogin] = useState(opac.requireLoginToPlaceHolds);

  useEffect(() => {
    setEnabled(opac.enabled);
    setShowCovers(opac.showCovers);
    setRequireLogin(opac.requireLoginToPlaceHolds);
  }, [opac]);

  return (
    <SectionCard
      title="Public catalog"
      subtitle="How your library appears to the outside world"
      onSave={() =>
        save({ opac: { enabled, showCovers, requireLoginToPlaceHolds: requireLogin } })
      }
      saving={saving}
    >
      <Switch checked={enabled} onChange={setEnabled} label="Public catalog enabled" description="Turn off to hide the OPAC entirely" />
      <Switch checked={showCovers} onChange={setShowCovers} label="Show cover images" description="Display book covers in search results" />
      <Switch
        checked={requireLogin}
        onChange={setRequireLogin}
        label="Require sign-in to place holds"
        description="Members must log in before reserving a title"
      />
      <Callout tone="info">
        Your catalog lives at{" "}
        <a
          className="inline-flex items-center gap-1 font-medium underline"
          href={`/library/${tenant?.slug ?? ""}`}
          target="_blank"
          rel="noreferrer"
        >
          /library/{tenant?.slug} <ExternalLink className="h-3 w-3" />
        </a>
      </Callout>
    </SectionCard>
  );
}

function DomainsSection() {
  const { push } = useToast();
  const domains = useApi<TenantDomain[]>("/tenants/me/domains", { scope: "staff" });
  const [domain, setDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [removing, setRemoving] = useState<TenantDomain | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setAdding(true);
    setError(null);
    try {
      await api.post("/tenants/me/domains", { domain: domain.trim().toLowerCase() }, { scope: "staff" });
      push({ title: "Domain added", description: "Add the verification TXT record, then verify.", tone: "success" });
      setDomain("");
      domains.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to add the domain.");
    } finally {
      setAdding(false);
    }
  }

  async function verify(item: TenantDomain) {
    setVerifying(item.id);
    try {
      const result = await api.post<{ verified: boolean; reason: string | null }>(
        `/tenants/me/domains/${item.id}/verify`,
        {},
        { scope: "staff" },
      );
      if (result.verified) {
        push({ title: "Domain verified", description: item.domain, tone: "success" });
      } else {
        push({
          title: "Verification failed",
          description:
            result.reason === "txt_record_mismatch"
              ? "The TXT record does not match the token yet — DNS can take a few minutes."
              : "DNS lookup failed — check that the record is published.",
          tone: "error",
        });
      }
      domains.reload();
    } catch (err) {
      push({ title: "Verification failed", description: err instanceof ApiError ? err.message : undefined, tone: "error" });
    } finally {
      setVerifying(null);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    try {
      await api.delete(`/tenants/me/domains/${removing.id}`, { scope: "staff" });
      push({ title: "Domain removed", tone: "success" });
      setRemoving(null);
      domains.reload();
    } catch (err) {
      push({ title: "Unable to remove", description: err instanceof ApiError ? err.message : undefined, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard title="Custom domains" subtitle="Serve the catalog on your own domain with automatic TLS">
      <form onSubmit={add} className="flex flex-wrap items-end gap-3">
        <Field label="Domain" className="min-w-64 flex-1">
          <Input
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            placeholder="catalog.mylibrary.org"
            required
          />
        </Field>
        <Button type="submit" loading={adding} icon={<Plus className="h-4 w-4" />}>
          Add domain
        </Button>
      </form>
      {error ? <Callout tone="danger">{error}</Callout> : null}

      {domains.loading && !domains.data ? (
        <PageLoader label="Loading domains" />
      ) : (domains.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Globe2 className="h-5 w-5" />}
          title="No custom domains"
          description="Add a domain to give your catalog a branded address."
        />
      ) : (
        <div className="space-y-3">
          {(domains.data ?? []).map((item) => (
            <div key={item.id} className="rounded-xl border border-ink-200/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Globe2 className="h-4.5 w-4.5 text-ink-400" />
                  <div>
                    <p className="font-medium text-ink-800">{item.domain}</p>
                    <p className="text-[11.5px] text-ink-400">Added {formatDate(item.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {item.status === "verified" ? <Badge tone="success">{titleCase(item.status)}</Badge> : null}
                  {item.status === "pending" ? <Badge tone="warn">Pending</Badge> : null}
                  {item.status === "failed" ? <Badge tone="danger">Failed</Badge> : null}
                  {item.status !== "verified" ? (
                    <Button size="sm" variant="outline" loading={verifying === item.id} onClick={() => verify(item)} icon={<RefreshCcw className="h-3.5 w-3.5" />}>
                      Verify
                    </Button>
                  ) : (
                    <BadgeCheck className="h-4.5 w-4.5 text-emerald-500" />
                  )}
                  <Button size="sm" variant="ghost" className="text-rose-500 hover:bg-rose-50" onClick={() => setRemoving(item)} icon={<Trash2 className="h-3.5 w-3.5" />}>
                    Remove
                  </Button>
                </div>
              </div>
              {item.status !== "verified" ? (
                <div className="mt-3 rounded-lg bg-ink-50 p-3 font-mono text-[12px] text-ink-600">
                  <p className="font-sans font-medium text-ink-500">Create this DNS record, then press Verify:</p>
                  <p className="mt-1.5">TXT&nbsp;&nbsp;_lms-verify.{item.domain}</p>
                  <p className="break-all">= {item.verificationToken}</p>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
        loading={busy}
        title="Remove this domain?"
        description={removing ? `${removing.domain} will stop serving your catalog.` : ""}
        confirmLabel="Remove domain"
      />
    </SectionCard>
  );
}

function BillingSection() {
  const { push } = useToast();
  const { tenant, reload } = useTenant();
  const plans = useApi<Plan[]>("/billing/plans", { scope: "staff" });
  const subscription = useApi<Subscription>("/billing/subscription", { scope: "staff" });
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  async function checkout(plan: Plan) {
    setCheckingOut(plan.id);
    try {
      const result = await api.post<{ mode: string; plan: string; checkoutUrl?: string }>(
        "/billing/checkout",
        { plan: plan.id },
        { scope: "staff" },
      );
      if (result.mode === "paddle" && result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      push({ title: `Switched to ${plan.name}`, description: "Your plan is updated immediately.", tone: "success" });
      subscription.reload();
      reload();
    } catch (err) {
      push({ title: "Checkout failed", description: err instanceof ApiError ? err.message : undefined, tone: "error" });
    } finally {
      setCheckingOut(null);
    }
  }

  const currentPlan = subscription.data?.plan ?? tenant?.plan ?? "free";

  return (
    <div className="max-w-5xl space-y-5">
      <Card>
        <CardHeader
          title="Subscription"
          subtitle="Manage your plan — changes take effect immediately"
          action={
            subscription.data ? (
              <Badge tone={subscription.data.status === "past_due" ? "danger" : "success"}>
                {titleCase(subscription.data.status)}
              </Badge>
            ) : null
          }
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-[12.5px] text-ink-400">Current plan</p>
            <p className="mt-1 text-lg font-bold text-ink-900">{titleCase(currentPlan)}</p>
          </div>
          <div>
            <p className="text-[12.5px] text-ink-400">Price</p>
            <p className="mt-1 text-lg font-bold text-ink-900">
              {formatMoney(subscription.data?.priceCents ?? 0, "USD")}
              <span className="text-[13px] font-medium text-ink-400">/mo</span>
            </p>
          </div>
          <div>
            <p className="text-[12.5px] text-ink-400">Renews</p>
            <p className="mt-1 text-lg font-bold text-ink-900">
              {subscription.data?.currentPeriodEnd ? formatDate(subscription.data.currentPeriodEnd) : "—"}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {(plans.data ?? []).map((plan) => {
          const isCurrent = plan.id === currentPlan;
          return (
            <Card
              key={plan.id}
              className={isCurrent ? "border-[var(--brand)]/40 ring-2 ring-[var(--brand)]/20" : ""}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-ink-900">{plan.name}</h3>
                {isCurrent ? <Badge tone="brand">Current</Badge> : null}
              </div>
              <p className="mt-2 text-2xl font-bold text-ink-900">
                {formatMoney(plan.priceCents, "USD")}
                <span className="text-[13px] font-medium text-ink-400">/mo</span>
              </p>
              <ul className="mt-4 space-y-1.5 text-[13px] text-ink-500">
                <li>{plan.limits.branches === -1 ? "Unlimited" : plan.limits.branches} branches</li>
                <li>{plan.limits.staff === -1 ? "Unlimited" : plan.limits.staff} staff seats</li>
                <li>{plan.limits.books === -1 ? "Unlimited" : plan.limits.books.toLocaleString()} titles</li>
                <li>{plan.limits.members === -1 ? "Unlimited" : plan.limits.members.toLocaleString()} members</li>
              </ul>
              <Button
                className="mt-5 w-full"
                variant={isCurrent ? "outline" : "primary"}
                disabled={isCurrent}
                loading={checkingOut === plan.id}
                onClick={() => checkout(plan)}
                icon={<CreditCard className="h-4 w-4" />}
              >
                {isCurrent ? "Your plan" : `Switch to ${plan.name}`}
              </Button>
            </Card>
          );
        })}
      </div>
      <Callout tone="info">
        Billing runs through Paddle when configured — in self-hosted mode plan changes apply instantly and are free.
      </Callout>
    </div>
  );
}

export default function SettingsPage() {
  const { session } = useSession("staff");
  const { tenant, settings } = useTenant();
  const [tab, setTab] = useState<TabId>("general");

  if (session && session.user.role !== "tenant_admin") {
    return (
      <div>
        <PageHeader title="Settings" />
        <Callout tone="warn">Only tenant administrators can manage library settings.</Callout>
      </div>
    );
  }

  if (!tenant) return <PageLoader label="Loading settings" />;

  return (
    <div>
      <PageHeader
        title="Settings"
        description={`${tenant.name} · ${tenant.slug} · ${titleCase(tenant.plan)} plan`}
      />

      <Tabs<TabId>
        tabs={[
          { id: "general", label: "General" },
          { id: "branding", label: "Branding" },
          { id: "circulation", label: "Circulation" },
          { id: "notifications", label: "Notifications" },
          { id: "opac", label: "Public catalog" },
          { id: "domains", label: "Domains" },
          { id: "billing", label: "Billing" },
        ]}
        active={tab}
        onChange={setTab}
        className="mb-6"
      />

      {tab === "general" ? <GeneralSection /> : null}
      {tab === "branding" ? <BrandingSection /> : null}
      {tab === "circulation" ? <CirculationSection /> : null}
      {tab === "notifications" ? <NotificationsSection /> : null}
      {tab === "opac" ? <OpacSection /> : null}
      {tab === "domains" ? <DomainsSection /> : null}
      {tab === "billing" ? <BillingSection /> : null}

      <p className="mt-6 text-[12px] text-ink-300">
        Library Cloud · tenant {tenant.id.slice(0, 8)}… · {settings.timezone}
      </p>
    </div>
  );
}
