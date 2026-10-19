"use client";

import { useState } from "react";
import { BadgeDollarSign, CircleDollarSign, HandCoins, Plus } from "lucide-react";
import { PageHeader, StatCard } from "@/components/dashboard/page-header";
import { ExportButton } from "@/components/dashboard/export-button";
import { TableSkeleton, TableWrap, Td, Th, Tr } from "@/components/table";
import {
  Badge,
  Button,
  Callout,
  Card,
  ConfirmModal,
  EmptyState,
  Field,
  Input,
  Modal,
  Pagination,
  SearchInput,
  Select,
  Tabs,
  Textarea,
  useToast,
} from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { formatDate, formatMoney, formatUnit, titleCase } from "@/lib/format";
import { useApi, useSession, useDebounced } from "@/lib/hooks";
import { useTenant } from "@/lib/tenant-context";
import type { Fine, Paged } from "@/lib/types";

type TabId = "outstanding" | "paid" | "waived" | "";

interface FinesSummary {
  outstandingCents: number;
  outstandingCount: number;
  collectedCents: number;
  waivedCents: number;
  collectedLast30: number;
}

function fineTone(status: Fine["status"]) {
  if (status === "outstanding") return "warn" as const;
  if (status === "paid") return "success" as const;
  return "neutral" as const;
}

function AddFineModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { push } = useToast();
  const { settings } = useTenant();
  const [card, setCard] = useState("");
  const [type, setType] = useState<"manual" | "damaged">("manual");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post(
        "/fines",
        {
          cardNumber: card.trim(),
          type,
          amountCents: Math.round(Number(amount) * 100),
          note: note.trim() || undefined,
        },
        { scope: "staff" },
      );
      push({ title: "Fine issued", tone: "success" });
      setCard("");
      setAmount("");
      setNote("");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create the fine.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a fine"
      subtitle="Charge a member manually — e.g. for damage"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button form="fine-form" type="submit" loading={saving}>
            Issue fine
          </Button>
        </>
      }
    >
      <form id="fine-form" onSubmit={submit} className="space-y-4">
        {error ? <Callout tone="danger">{error}</Callout> : null}
        <Field label="Member card number">
          <Input value={card} onChange={(event) => setCard(event.target.value)} className="font-mono" required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            <Select value={type} onChange={(event) => setType(event.target.value as "manual" | "damaged")}>
              <option value="manual">Manual charge</option>
              <option value="damaged">Damaged item</option>
            </Select>
          </Field>
          <Field label={`Amount (${settings.currency})`}>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </Field>
        </div>
        <Field label="Note">
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="Reason for the charge" />
        </Field>
      </form>
    </Modal>
  );
}

export default function FinesPage() {
  const { push } = useToast();
  const { settings } = useTenant();
  const { session } = useSession("staff");
  const [tab, setTab] = useState<TabId>("outstanding");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [waiveFine, setWaiveFine] = useState<Fine | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const query = useDebounced(search, 250);

  const summary = useApi<FinesSummary>("/fines/summary", { scope: "staff" });
  const fines = useApi<Paged<Fine>>("/fines", {
    scope: "staff",
    query: {
      status: tab || undefined,
      type: type || undefined,
      q: query || undefined,
      page,
      perPage: 20,
    },
  });

  const items = fines.data?.items ?? [];
  const canWaive = session?.user.role === "tenant_admin" || session?.user.role === "librarian";

  async function pay(fine: Fine) {
    setBusy(fine.id);
    try {
      await api.post(`/fines/${fine.id}/pay`, {}, { scope: "staff" });
      push({ title: "Fine paid", description: `${formatMoney(fine.amountCents, fine.currency)} from ${fine.memberName}`, tone: "success" });
      fines.reload();
      summary.reload();
    } catch (err) {
      push({ title: "Payment failed", description: err instanceof ApiError ? err.message : undefined, tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function confirmWaive() {
    if (!waiveFine) return;
    setBusy(waiveFine.id);
    try {
      await api.post(`/fines/${waiveFine.id}/waive`, {}, { scope: "staff" });
      push({ title: "Fine waived", tone: "success" });
      setWaiveFine(null);
      fines.reload();
      summary.reload();
    } catch (err) {
      push({ title: "Unable to waive", description: err instanceof ApiError ? err.message : undefined, tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Fines"
        description="Outstanding balances, collections and waivers."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
            Add fine
          </Button>
        }
      />

      <div className="mb-6 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Outstanding"
          value={formatMoney(summary.data?.outstandingCents ?? 0, settings.currency)}
          hint={`${summary.data?.outstandingCount ?? 0} open fines`}
          icon={<CircleDollarSign className="h-4 w-4" />}
          tone="danger"
        />
        <StatCard
          label="Collected (all time)"
          value={formatMoney(summary.data?.collectedCents ?? 0, settings.currency)}
          icon={<BadgeDollarSign className="h-4 w-4" />}
          tone="success"
        />
        <StatCard
          label="Collected (30 days)"
          value={formatMoney(summary.data?.collectedLast30 ?? 0, settings.currency)}
          icon={<HandCoins className="h-4 w-4" />}
          tone="brand"
        />
        <StatCard
          label="Waived"
          value={formatMoney(summary.data?.waivedCents ?? 0, settings.currency)}
          icon={<BadgeDollarSign className="h-4 w-4" />}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs<TabId>
          tabs={[
            { id: "outstanding", label: "Outstanding" },
            { id: "paid", label: "Paid" },
            { id: "waived", label: "Waived" },
            { id: "", label: "All" },
          ]}
          active={tab}
          onChange={(id) => {
            setTab(id);
            setPage(1);
          }}
        />
        <div className="flex flex-wrap items-center gap-2.5">
          <Select
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setPage(1);
            }}
            className="w-40"
          >
            <option value="">All types</option>
            <option value="overdue">Overdue</option>
            <option value="lost">Lost</option>
            <option value="damaged">Damaged</option>
            <option value="manual">Manual</option>
          </Select>
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search member…"
            className="w-full sm:w-64"
          />
          <ExportButton resource="fines" />
        </div>
      </div>

      {fines.loading && !fines.data ? (
        <TableSkeleton rows={8} cols={6} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CircleDollarSign className="h-5 w-5" />}
            title="No fines in this view"
            description="Overdue, lost and damaged charges appear here automatically."
          />
        </Card>
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th>Member</Th>
                <Th>Type</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th>Note</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((fine) => (
                <Tr key={fine.id}>
                  <Td>
                    <p className="font-semibold text-ink-900">{fine.memberName}</p>
                    {fine.memberCard ? <p className="font-mono text-[11.5px] text-ink-400">{fine.memberCard}</p> : null}
                  </Td>
                  <Td>
                    <Badge tone={fine.type === "overdue" ? "warn" : fine.type === "lost" ? "danger" : "neutral"}>
                      {titleCase(fine.type)}
                    </Badge>
                  </Td>
                  <Td className="font-semibold text-ink-800">{formatMoney(fine.amountCents, fine.currency)}</Td>
                  <Td>
                    <Badge tone={fineTone(fine.status)}>{titleCase(fine.status)}</Badge>
                  </Td>
                  <Td className="text-ink-500">{formatDate(fine.createdAt)}</Td>
                  <Td className="max-w-48 truncate text-ink-500">{fine.note ?? "—"}</Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      {fine.status === "outstanding" ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            loading={busy === fine.id}
                            onClick={() => pay(fine)}
                            icon={<BadgeDollarSign className="h-3.5 w-3.5" />}
                          >
                            Collect
                          </Button>
                          {canWaive ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy === fine.id}
                              onClick={() => setWaiveFine(fine)}
                              icon={<HandCoins className="h-3.5 w-3.5" />}
                            >
                              Waive
                            </Button>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-[12.5px] text-ink-400">
                          {fine.paidAt ? `Paid ${formatDate(fine.paidAt)}` : fine.waivedAt ? `Waived ${formatDate(fine.waivedAt)}` : "—"}
                        </span>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination
            page={fines.data?.meta.page ?? 1}
            totalPages={fines.data?.meta.totalPages ?? 1}
            total={fines.data?.meta.total ?? 0}
            perPage={fines.data?.meta.perPage}
            onPage={setPage}
          />
        </>
      )}

      <p className="mt-4 text-[12.5px] text-ink-400">
        Daily overdue fines accrue at {formatMoney(settings.circulation.finePerDayCents, settings.currency)} per day,{" "}
        {formatUnit(settings.circulation.maxOutstandingFineCents, "cap")} — configurable in Settings → Circulation.
      </p>

      <AddFineModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={() => { fines.reload(); summary.reload(); }} />
      <ConfirmModal
        open={Boolean(waiveFine)}
        onClose={() => setWaiveFine(null)}
        onConfirm={confirmWaive}
        loading={Boolean(busy)}
        title="Waive this fine?"
        description={
          waiveFine
            ? `${formatMoney(waiveFine.amountCents, waiveFine.currency)} owed by ${waiveFine.memberName} will be forgiven.`
            : ""
        }
        confirmLabel="Waive fine"
      />
    </div>
  );
}
