"use client";

import { useRef, useState } from "react";
import {
  ArrowLeftRight,
  BookDown,
  BookUp,
  CheckCircle2,
  RotateCcw,
  SearchX,
  Skull,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { ExportButton } from "@/components/dashboard/export-button";
import { TableSkeleton, TableWrap, Td, Th, Tr } from "@/components/table";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  ConfirmModal,
  EmptyState,
  Pagination,
  SearchInput,
  Tabs,
  useToast,
} from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { dueLabel, formatDateTime } from "@/lib/format";
import { useApi, useDebounced } from "@/lib/hooks";
import type { Loan, Paged } from "@/lib/types";
import { cx } from "@/components/ui";

type TabId = "active" | "overdue" | "returned" | "";

function CheckoutPanel({ onDone }: { onDone: () => void }) {
  const { push } = useToast();
  const barcodeRef = useRef<HTMLInputElement>(null);
  const [barcode, setBarcode] = useState("");
  const [card, setCard] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoan, setLastLoan] = useState<Loan | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const loan = await api.post<Loan>(
        "/loans/checkout",
        { barcode: barcode.trim(), cardNumber: card.trim() },
        { scope: "staff" },
      );
      setLastLoan(loan);
      setBarcode("");
      barcodeRef.current?.focus();
      push({ title: "Checked out", description: `${loan.bookTitle} → ${loan.memberName}`, tone: "success" });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Checkout failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <BookUp className="h-4 w-4 text-[var(--brand)]" /> Check out
          </span>
        }
        subtitle="Scan the copy barcode, then the member card"
      />
      <form onSubmit={submit} className="space-y-3">
        <input
          ref={barcodeRef}
          value={barcode}
          onChange={(event) => setBarcode(event.target.value)}
          placeholder="Copy barcode (e.g. LIB-0001)"
          autoFocus
          required
          className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 font-mono text-sm text-ink-900 placeholder:font-sans placeholder:text-ink-400 focus:border-[var(--brand)] focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]/40"
        />
        <input
          value={card}
          onChange={(event) => setCard(event.target.value)}
          placeholder="Member card number"
          required
          className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 font-mono text-sm text-ink-900 placeholder:font-sans placeholder:text-ink-400 focus:border-[var(--brand)] focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]/40"
        />
        <Button type="submit" loading={busy} className="w-full" icon={<BookUp className="h-4 w-4" />}>
          Check out
        </Button>
      </form>
      {error ? (
        <div className="mt-3">
          <Callout tone="danger">{error}</Callout>
        </div>
      ) : null}
      {lastLoan ? (
        <div className="mt-3">
          <Callout tone="success">
            <span className="font-medium">{lastLoan.bookTitle}</span> is due {formatDateTime(lastLoan.dueAt)}.
          </Callout>
        </div>
      ) : null}
    </Card>
  );
}

function CheckinPanel({ onDone }: { onDone: () => void }) {
  const { push } = useToast();
  const [barcode, setBarcode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReturn, setLastReturn] = useState<Loan | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const loan = await api.post<Loan>("/loans/checkin", { barcode: barcode.trim() }, { scope: "staff" });
      setLastReturn(loan);
      setBarcode("");
      push({ title: "Returned", description: loan.bookTitle, tone: "success" });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Check-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <BookDown className="h-4 w-4 text-emerald-500" /> Check in
          </span>
        }
        subtitle="Scan a returned copy to close its loan"
      />
      <form onSubmit={submit} className="space-y-3">
        <input
          value={barcode}
          onChange={(event) => setBarcode(event.target.value)}
          placeholder="Copy barcode"
          required
          className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 font-mono text-sm text-ink-900 placeholder:font-sans placeholder:text-ink-400 focus:border-[var(--brand)] focus:outline-none focus:ring-4 focus:ring-[var(--brand-ring)]/40"
        />
        <Button type="submit" loading={busy} variant="secondary" className="w-full" icon={<BookDown className="h-4 w-4" />}>
          Check in
        </Button>
      </form>
      {error ? (
        <div className="mt-3">
          <Callout tone="danger">{error}</Callout>
        </div>
      ) : null}
      {lastReturn ? (
        <div className="mt-3">
          <Callout tone="success">
            <span className="font-medium">{lastReturn.bookTitle}</span> returned by {lastReturn.memberName}.
          </Callout>
        </div>
      ) : null}
    </Card>
  );
}

export default function CirculationPage() {
  const { push } = useToast();
  const [tab, setTab] = useState<TabId>("active");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [lostLoan, setLostLoan] = useState<Loan | null>(null);
  const [busy, setBusy] = useState(false);
  const query = useDebounced(search, 250);

  const loans = useApi<Paged<Loan>>("/loans", {
    scope: "staff",
    query: {
      status: tab || undefined,
      q: query || undefined,
      page,
      perPage: 20,
    },
  });

  const items = loans.data?.items ?? [];

  async function renew(loan: Loan) {
    try {
      const updated = await api.post<Loan>(`/loans/${loan.id}/renew`, {}, { scope: "staff" });
      push({ title: "Loan renewed", description: `New due date ${formatDateTime(updated.dueAt)}`, tone: "success" });
      loans.reload();
    } catch (err) {
      push({ title: "Renewal failed", description: err instanceof ApiError ? err.message : undefined, tone: "error" });
    }
  }

  async function confirmLost() {
    if (!lostLoan) return;
    setBusy(true);
    try {
      await api.post(`/loans/${lostLoan.id}/lost`, {}, { scope: "staff" });
      push({ title: "Marked as lost", description: lostLoan.bookTitle, tone: "success" });
      setLostLoan(null);
      loans.reload();
    } catch (err) {
      push({ title: "Action failed", description: err instanceof ApiError ? err.message : undefined, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Circulation" description="The front desk: checkouts, returns and overdue loans." />

      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <CheckoutPanel onDone={() => loans.reload()} />
        <CheckinPanel onDone={() => loans.reload()} />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs<TabId>
          tabs={[
            { id: "active", label: "Active" },
            { id: "overdue", label: "Overdue" },
            { id: "returned", label: "Returned" },
            { id: "", label: "All" },
          ]}
          active={tab}
          onChange={(id) => {
            setTab(id);
            setPage(1);
          }}
        />
        <div className="flex items-center gap-2.5">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search member or title…"
            className="w-full sm:w-72"
          />
          <ExportButton resource="loans" />
        </div>
      </div>

      {loans.loading && !loans.data ? (
        <TableSkeleton rows={8} cols={7} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<SearchX className="h-5 w-5" />}
            title={query ? "No matching loans" : tab === "overdue" ? "Nothing overdue — nice!" : "No loans here"}
            description={
              query ? "Try a different search term." : "Loans you create at the desk appear here in real time."
            }
          />
        </Card>
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th>Title</Th>
                <Th>Member</Th>
                <Th>Barcode</Th>
                <Th>Checked out</Th>
                <Th>Due</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((loan) => {
                const due = dueLabel(loan.dueAt, loan.status);
                return (
                  <Tr key={loan.id}>
                    <Td>
                      <p className="max-w-64 truncate font-semibold text-ink-900">{loan.bookTitle}</p>
                    </Td>
                    <Td>
                      <p className="max-w-44 truncate text-ink-700">{loan.memberName}</p>
                      {loan.memberCard ? (
                        <p className="font-mono text-[11.5px] text-ink-400">{loan.memberCard}</p>
                      ) : null}
                    </Td>
                    <Td className="font-mono text-[12.5px] text-ink-500">{loan.copyBarcode}</Td>
                    <Td className="text-ink-500">{formatDateTime(loan.checkedOutAt)}</Td>
                    <Td>
                      <span
                        className={cx(
                          "font-medium",
                          due.tone === "danger" && "text-rose-600",
                          due.tone === "warn" && "text-amber-600",
                          due.tone === "ok" && "text-ink-700",
                          due.tone === "muted" && "text-ink-400",
                        )}
                      >
                        {loan.status === "returned" ? `Returned ${formatDateTime(loan.returnedAt)}` : due.label}
                      </span>
                    </Td>
                    <Td>
                      {loan.status === "active" ? (
                        <Badge tone="info">Active</Badge>
                      ) : loan.status === "overdue" ? (
                        <Badge tone="danger">Overdue</Badge>
                      ) : loan.status === "lost" ? (
                        <Badge tone="warn">Lost</Badge>
                      ) : (
                        <Badge tone="success">Returned</Badge>
                      )}
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        {loan.status === "active" || loan.status === "overdue" ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={<RotateCcw className="h-3.5 w-3.5" />}
                              onClick={() => renew(loan)}
                              disabled={loan.renewedCount >= 99}
                            >
                              Renew
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={<Skull className="h-3.5 w-3.5" />}
                              onClick={() => setLostLoan(loan)}
                            >
                              Lost
                            </Button>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[12.5px] text-ink-400">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            {loan.renewedCount > 0 ? `${loan.renewedCount}× renewed` : "Closed"}
                          </span>
                        )}
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </TableWrap>
          <Pagination
            page={loans.data?.meta.page ?? 1}
            totalPages={loans.data?.meta.totalPages ?? 1}
            total={loans.data?.meta.total ?? 0}
            perPage={loans.data?.meta.perPage}
            onPage={setPage}
          />
        </>
      )}

      <div className="mt-4 flex items-center gap-2 text-[12.5px] text-ink-400">
        <ArrowLeftRight className="h-3.5 w-3.5" />
        Tip: barcode scanners type + Enter — the form submits automatically.
      </div>

      <ConfirmModal
        open={Boolean(lostLoan)}
        onClose={() => setLostLoan(null)}
        onConfirm={confirmLost}
        loading={busy}
        title="Mark loan as lost?"
        description="The copy is marked lost and a replacement fine is issued to the member according to your circulation settings."
        confirmLabel="Mark lost"
      />
    </div>
  );
}
