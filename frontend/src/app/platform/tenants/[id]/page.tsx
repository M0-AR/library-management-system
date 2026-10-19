"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Ban, Building2, CheckCircle2, ExternalLink, Library, Users } from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  ConfirmModal,
  Field,
  PageLoader,
  Select,
  useToast,
} from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { formatDate, formatMoney, titleCase } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { PlatformTenantDetail } from "@/lib/types";

const STATUS_TONES: Record<string, "success" | "info" | "warn" | "danger" | "neutral"> = {
  active: "success",
  trial: "info",
  suspended: "danger",
  cancelled: "neutral",
};

export default function TenantDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const router = useRouter();
  const { push } = useToast();
  const tenant = useApi<PlatformTenantDetail>(id ? `/tenants/${id}` : null, { scope: "platform" });

  const [status, setStatus] = useState<PlatformTenantDetail["status"]>("active");
  const [plan, setPlan] = useState<PlatformTenantDetail["plan"]>("free");
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [confirmSuspend, setConfirmSuspend] = useState(false);

  useEffect(() => {
    if (tenant.data) {
      setStatus(tenant.data.status);
      setPlan(tenant.data.plan);
    }
  }, [tenant.data]);

  async function applyStatus(next: PlatformTenantDetail["status"]) {
    setSavingStatus(true);
    try {
      await api.patch(`/tenants/${id}/status`, { status: next }, { scope: "platform" });
      push({ title: `Library ${next === "suspended" ? "suspended" : `set to ${next}`}`, tone: "success" });
      setStatus(next);
      tenant.reload();
    } catch (err) {
      push({ title: "Unable to update status", description: err instanceof ApiError ? err.message : undefined, tone: "error" });
      setStatus(tenant.data?.status ?? "active");
    } finally {
      setSavingStatus(false);
      setConfirmSuspend(false);
    }
  }

  async function applyPlan() {
    setSavingPlan(true);
    try {
      await api.patch(`/tenants/${id}/plan`, { plan }, { scope: "platform" });
      push({ title: `Plan changed to ${titleCase(plan)}`, tone: "success" });
      tenant.reload();
    } catch (err) {
      push({ title: "Unable to change plan", description: err instanceof ApiError ? err.message : undefined, tone: "error" });
    } finally {
      setSavingPlan(false);
    }
  }

  if (tenant.loading && !tenant.data) return <PageLoader label="Loading library" />;
  if (tenant.error || !tenant.data) {
    return (
      <div className="py-16 text-center">
        <Library className="mx-auto h-6 w-6 text-ink-300" />
        <h1 className="mt-3 text-lg font-bold text-ink-900">Library not found</h1>
        <Link href="/platform" className="mt-2 inline-block text-sm font-medium text-[var(--brand)] hover:underline">
          Back to platform overview
        </Link>
      </div>
    );
  }

  const detail = tenant.data;
  const branding = detail.settings?.branding;
  const circulation = detail.settings?.circulation;

  return (
    <div className="space-y-6">
      <Link href="/platform" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-400 hover:text-ink-700">
        <ArrowLeft className="h-3.5 w-3.5" /> All libraries
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold text-white"
            style={{ background: branding?.primaryColor ?? "#4f46e5" }}
          >
            {detail.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-ink-900">{detail.name}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[13px] text-ink-400">
              <span className="font-mono">/{detail.slug}</span>
              <Badge tone={STATUS_TONES[detail.status] ?? "neutral"}>{titleCase(detail.status)}</Badge>
              <Badge tone="brand">{titleCase(detail.plan)}</Badge>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/library/${detail.slug}`}
            target="_blank"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-50"
          >
            Visit catalog <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-[12.5px] text-ink-400">Staff users</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-bold text-ink-900">
            <Users className="h-5 w-5 text-ink-300" />
            {detail.counts?.users ?? 0}
          </p>
        </Card>
        <Card>
          <p className="text-[12.5px] text-ink-400">Created</p>
          <p className="mt-1 text-2xl font-bold text-ink-900">{formatDate(detail.createdAt)}</p>
        </Card>
        <Card>
          <p className="text-[12.5px] text-ink-400">Tenant ID</p>
          <p className="mt-1 truncate font-mono text-[13px] font-medium text-ink-600">{detail.id}</p>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Status" subtitle="Suspending blocks all API access for this tenant instantly" />
          <Field label="Tenant status">
            <Select value={status} onChange={(event) => setStatus(event.target.value as PlatformTenantDetail["status"])}>
              {(["active", "trial", "suspended", "cancelled"] as const).map((option) => (
                <option key={option} value={option}>
                  {titleCase(option)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {detail.status === "suspended" ? (
              <Callout tone="warn" className="flex-1">
                This library is suspended — members see “Library not found”.
              </Callout>
            ) : (
              <span className="flex-1 text-[12.5px] text-ink-400">
                Status changes take effect on the tenant’s very next request.
              </span>
            )}
            <div className="flex gap-2">
              {status === "suspended" && detail.status !== "suspended" ? (
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Ban className="h-3.5 w-3.5" />}
                  onClick={() => setConfirmSuspend(true)}
                  loading={savingStatus}
                >
                  Suspend
                </Button>
              ) : (
                <Button
                  size="sm"
                  icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                  disabled={status === detail.status}
                  loading={savingStatus}
                  onClick={() => applyStatus(status)}
                >
                  Apply status
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Plan" subtitle="Overrides the subscription plan for this tenant" />
          <Field label="Plan">
            <Select value={plan} onChange={(event) => setPlan(event.target.value as PlatformTenantDetail["plan"])}>
              {(["free", "starter", "growth", "enterprise"] as const).map((option) => (
                <option key={option} value={option}>
                  {titleCase(option)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="mt-4 flex justify-end">
            <Button size="sm" disabled={plan === detail.plan} loading={savingPlan} onClick={applyPlan}>
              Change plan
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Branding" subtitle="White-label settings as configured by the library" />
          <div className="space-y-3 text-[13.5px]">
            <div className="flex items-center justify-between">
              <span className="text-ink-400">Display name</span>
              <span className="font-medium text-ink-800">{branding?.displayName || detail.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-400">Primary color</span>
              <span className="flex items-center gap-2 font-mono text-ink-700">
                <span className="h-4 w-4 rounded-md ring-1 ring-ink-900/10" style={{ background: branding?.primaryColor ?? "#4f46e5" }} />
                {branding?.primaryColor ?? "#4f46e5"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-400">Accent color</span>
              <span className="flex items-center gap-2 font-mono text-ink-700">
                <span className="h-4 w-4 rounded-md ring-1 ring-ink-900/10" style={{ background: branding?.accentColor ?? "#0ea5e9" }} />
                {branding?.accentColor ?? "#0ea5e9"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-400">Public catalog</span>
              <Badge tone={detail.settings?.opac.enabled ? "success" : "neutral"}>
                {detail.settings?.opac.enabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Circulation policy" subtitle="Loan windows and fine schedule" />
          {circulation ? (
            <div className="grid grid-cols-2 gap-3 text-[13.5px]">
              <div className="rounded-xl bg-ink-50 p-3">
                <p className="text-[11.5px] text-ink-400">Loan period</p>
                <p className="mt-0.5 font-semibold text-ink-800">{circulation.loanPeriodDays} days</p>
              </div>
              <div className="rounded-xl bg-ink-50 p-3">
                <p className="text-[11.5px] text-ink-400">Max renewals</p>
                <p className="mt-0.5 font-semibold text-ink-800">{circulation.maxRenewals}×</p>
              </div>
              <div className="rounded-xl bg-ink-50 p-3">
                <p className="text-[11.5px] text-ink-400">Fine per day</p>
                <p className="mt-0.5 font-semibold text-ink-800">
                  {formatMoney(circulation.finePerDayCents, detail.settings?.currency ?? "USD")}
                </p>
              </div>
              <div className="rounded-xl bg-ink-50 p-3">
                <p className="text-[11.5px] text-ink-400">Holds</p>
                <p className="mt-0.5 font-semibold text-ink-800">{circulation.holdsEnabled ? "Enabled" : "Off"}</p>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-ink-400">No settings found.</p>
          )}
        </Card>
      </div>

      <ConfirmModal
        open={confirmSuspend}
        onClose={() => setConfirmSuspend(false)}
        onConfirm={() => applyStatus("suspended")}
        loading={savingStatus}
        title="Suspend this library?"
        description={`${detail.name} and its catalog go offline immediately. Members will see “Library not found”.`}
        confirmLabel="Suspend library"
      />

      <p className="flex items-center gap-2 text-[12px] text-ink-300">
        <Building2 className="h-3.5 w-3.5" /> tenant {detail.id}
      </p>
    </div>
  );
}
