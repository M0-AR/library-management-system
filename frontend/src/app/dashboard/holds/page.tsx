"use client";

import { useState } from "react";
import { BookMarked, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
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
  useToast,
} from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format";
import { useApi, useDebounced } from "@/lib/hooks";
import type { Branch, Hold, Paged } from "@/lib/types";

type TabId = "pending" | "ready" | "fulfilled" | "cancelled" | "expired" | "";

function holdTone(status: Hold["status"]) {
  if (status === "pending") return "warn" as const;
  if (status === "ready") return "success" as const;
  if (status === "fulfilled") return "info" as const;
  if (status === "cancelled") return "neutral" as const;
  return "neutral" as const;
}

function PlaceHoldModal({
  open,
  onClose,
  onPlaced,
}: {
  open: boolean;
  onClose: () => void;
  onPlaced: () => void;
}) {
  const { push } = useToast();
  const branches = useApi<Branch[]>("/branches", { scope: "staff", query: { includeInactive: false } });
  const [bookQuery, setBookQuery] = useState("");
  const [bookId, setBookId] = useState<string | null>(null);
  const [bookLabel, setBookLabel] = useState("");
  const [card, setCard] = useState("");
  const [branchId, setBranchId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const debounced = useDebounced(bookQuery, 250);

  const results = useApi<{ id: string; title: string; authors: string[] }[]>("/books/search", {
    scope: "staff",
    query: { q: debounced || undefined, limit: 8 },
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!bookId) {
      setError("Pick a book from the search results first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const hold = await api.post<Hold>(
        "/holds",
        { bookId, cardNumber: card.trim(), branchId: branchId || undefined },
        { scope: "staff" },
      );
      push({
        title: hold.status === "ready" ? "Hold is ready now" : "Hold placed",
        description: bookLabel,
        tone: "success",
      });
      setBookQuery("");
      setBookId(null);
      setBookLabel("");
      setCard("");
      onPlaced();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to place the hold.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Place a hold"
      subtitle="Reserve the next available copy for a member"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button form="hold-form" type="submit" loading={saving}>
            Place hold
          </Button>
        </>
      }
    >
      <form id="hold-form" onSubmit={submit} className="space-y-4">
        {error ? <Callout tone="danger">{error}</Callout> : null}
        <Field label="Book" hint="Search the catalog by title or author">
          <Input
            value={bookId ? bookLabel : bookQuery}
            onChange={(event) => {
              setBookId(null);
              setBookLabel("");
              setBookQuery(event.target.value);
            }}
            placeholder="Start typing a title…"
          />
        </Field>
        {!bookId && debounced.length >= 2 ? (
          <div className="max-h-56 overflow-y-auto rounded-xl border border-ink-200">
            {(results.data ?? []).length === 0 ? (
              <p className="px-3.5 py-3 text-[13px] text-ink-400">No matches.</p>
            ) : (
              (results.data ?? []).map((book) => (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => {
                    setBookId(book.id);
                    setBookLabel(`${book.title}${book.authors?.length ? ` — ${book.authors.join(", ")}` : ""}`);
                  }}
                  className="block w-full border-b border-ink-100 px-3.5 py-2.5 text-left transition-colors last:border-0 hover:bg-ink-50"
                >
                  <p className="text-[13.5px] font-medium text-ink-800">{book.title}</p>
                  <p className="text-[12px] text-ink-400">{book.authors?.join(", ") || "Unknown author"}</p>
                </button>
              ))
            )}
          </div>
        ) : null}
        <Field label="Member card number">
          <Input
            value={card}
            onChange={(event) => setCard(event.target.value)}
            placeholder="LIB-00042"
            required
            className="font-mono"
          />
        </Field>
        <Field label="Pickup branch" hint="Optional — defaults to the copy's branch">
          <Select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
            <option value="">Any branch</option>
            {(branches.data ?? []).map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} ({branch.code})
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </Modal>
  );
}

export default function HoldsPage() {
  const { push } = useToast();
  const [tab, setTab] = useState<TabId>("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [cancelHold, setCancelHold] = useState<Hold | null>(null);
  const [busy, setBusy] = useState(false);
  const query = useDebounced(search, 250);

  const holds = useApi<Paged<Hold>>("/holds", {
    scope: "staff",
    query: {
      status: tab || undefined,
      q: query || undefined,
      page,
      perPage: 20,
    },
  });

  const items = holds.data?.items ?? [];

  async function confirmCancel() {
    if (!cancelHold) return;
    setBusy(true);
    try {
      await api.post(`/holds/${cancelHold.id}/cancel`, {}, { scope: "staff" });
      push({ title: "Hold cancelled", description: cancelHold.bookTitle, tone: "success" });
      setCancelHold(null);
      holds.reload();
    } catch (err) {
      push({ title: "Unable to cancel", description: err instanceof ApiError ? err.message : undefined, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Holds"
        description="Reservation queue — ready holds await pickup at the desk."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
            Place hold
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs<TabId>
          tabs={[
            { id: "pending", label: "Waiting" },
            { id: "ready", label: "Ready" },
            { id: "fulfilled", label: "Fulfilled" },
            { id: "cancelled", label: "Cancelled" },
            { id: "expired", label: "Expired" },
            { id: "", label: "All" },
          ]}
          active={tab}
          onChange={(id) => {
            setTab(id);
            setPage(1);
          }}
        />
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search member or title…"
          className="w-full sm:w-72"
        />
      </div>

      {holds.loading && !holds.data ? (
        <TableSkeleton rows={8} cols={6} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookMarked className="h-5 w-5" />}
            title={query ? "No matching holds" : "No holds in this view"}
            description={
              query ? "Try a different search." : "Place a hold when a title is popular and checkouts are out."
            }
            action={
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
                Place hold
              </Button>
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
                <Th>Branch</Th>
                <Th>Placed</Th>
                <Th>Ready / Expires</Th>
                <Th>Queue</Th>
                <Th>Status</Th>
                <Th className="w-24 text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((hold) => (
                <Tr key={hold.id}>
                  <Td>
                    <p className="max-w-64 truncate font-semibold text-ink-900">{hold.bookTitle}</p>
                  </Td>
                  <Td className="max-w-44 truncate text-ink-700">{hold.memberName}</Td>
                  <Td className="text-ink-500">{hold.branchName ?? "—"}</Td>
                  <Td className="text-ink-500">{formatDate(hold.placedAt)}</Td>
                  <Td className="text-ink-500">
                    {hold.status === "ready" && hold.expiresAt
                      ? `Pickup by ${formatDate(hold.expiresAt)}`
                      : hold.readyAt
                        ? formatDateTime(hold.readyAt)
                        : "—"}
                  </Td>
                  <Td className="text-ink-600">
                    {hold.status === "pending" && hold.queuePosition ? `#${hold.queuePosition}` : "—"}
                  </Td>
                  <Td>
                    <Badge tone={holdTone(hold.status)}>{hold.status}</Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end">
                      {hold.status === "pending" || hold.status === "ready" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<X className="h-3.5 w-3.5" />}
                          onClick={() => setCancelHold(hold)}
                        >
                          Cancel
                        </Button>
                      ) : (
                        <span className="text-[12.5px] text-ink-400">—</span>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination
            page={holds.data?.meta.page ?? 1}
            totalPages={holds.data?.meta.totalPages ?? 1}
            total={holds.data?.meta.total ?? 0}
            perPage={holds.data?.meta.perPage}
            onPage={setPage}
          />
        </>
      )}

      <p className="mt-4 text-[12.5px] text-ink-400">
        Fulfil a ready hold by checking out the reserved copy in{" "}
        <span className="font-medium text-ink-600">Circulation</span> — the hold closes automatically.
      </p>

      <PlaceHoldModal open={createOpen} onClose={() => setCreateOpen(false)} onPlaced={() => holds.reload()} />
      <ConfirmModal
        open={Boolean(cancelHold)}
        onClose={() => setCancelHold(null)}
        onConfirm={confirmCancel}
        loading={busy}
        title="Cancel this hold?"
        description={cancelHold ? `${cancelHold.memberName} will lose their place in the queue for “${cancelHold.bookTitle}”.` : ""}
        confirmLabel="Cancel hold"
      />
    </div>
  );
}
