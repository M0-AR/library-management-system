"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  BookOpen,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { BookFormModal } from "@/components/dashboard/book-form";
import { PageHeader } from "@/components/dashboard/page-header";
import { TableWrap, Td, Th, Tr } from "@/components/table";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  ConfirmModal,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  PageLoader,
  Select,
  Textarea,
  useToast,
} from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { formatDate, formatMoney, titleCase } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { useTenant } from "@/lib/tenant-context";
import type { Book, Branch, Copy } from "@/lib/types";

interface BookDetail extends Book {
  copies: Copy[];
}

const COPY_STATUSES = ["available", "lost", "damaged", "withdrawn"] as const;

function statusTone(status: Copy["status"]) {
  if (status === "available") return "success" as const;
  if (status === "on_loan") return "info" as const;
  if (status === "reserved") return "warn" as const;
  if (status === "lost") return "danger" as const;
  return "neutral" as const;
}

export default function BookDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { push } = useToast();
  const { settings } = useTenant();
  const bookId = params.id;

  const book = useApi<BookDetail>(`/books/${bookId}`, { scope: "staff" });
  const branches = useApi<Branch[]>("/branches", { scope: "staff", query: { includeInactive: false } });

  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [withdrawCopy, setWithdrawCopy] = useState<Copy | null>(null);
  const [busy, setBusy] = useState(false);

  if (book.loading && !book.data) return <PageLoader label="Loading book" />;
  if (book.error || !book.data) {
    return (
      <Card>
        <EmptyState
          icon={<BookOpen className="h-5 w-5" />}
          title="Book not found"
          description="It may have been removed from the catalog."
          action={
            <Button variant="outline" onClick={() => router.push("/dashboard/books")}>
              Back to catalog
            </Button>
          }
        />
      </Card>
    );
  }

  const data = book.data;
  const copies = data.copies ?? [];

  async function toggleArchive() {
    if (!data) return;
    setBusy(true);
    try {
      await api.post(
        `/books/${data.id}/status`,
        { status: data.status === "active" ? "archived" : "active" },
        { scope: "staff" },
      );
      push({ title: data.status === "active" ? "Book archived" : "Book restored", tone: "success" });
      setArchiveConfirm(false);
      book.reload();
    } catch (err) {
      push({ title: "Action failed", description: err instanceof ApiError ? err.message : undefined, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function changeCopyStatus(copy: Copy, status: string) {
    try {
      await api.patch(`/copies/${copy.id}`, { status }, { scope: "staff" });
      push({ title: `Copy ${copy.barcode} marked ${status}`, tone: "success" });
      book.reload();
    } catch (err) {
      push({ title: "Unable to update copy", description: err instanceof ApiError ? err.message : undefined, tone: "error" });
    }
  }

  async function confirmWithdraw() {
    if (!withdrawCopy) return;
    setBusy(true);
    try {
      await api.delete(`/copies/${withdrawCopy.id}`, { scope: "staff" });
      push({ title: `Copy ${withdrawCopy.barcode} withdrawn`, tone: "success" });
      setWithdrawCopy(null);
      book.reload();
    } catch (err) {
      push({ title: "Unable to withdraw copy", description: err instanceof ApiError ? err.message : undefined, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  const meta: { label: string; value: string }[] = [
    { label: "Publisher", value: data.publisher ?? "—" },
    { label: "Published", value: data.publishedYear ? String(data.publishedYear) : "—" },
    { label: "Pages", value: data.pages ? String(data.pages) : "—" },
    { label: "Language", value: data.language ?? "—" },
    { label: "ISBN-13", value: data.isbn13 ?? "—" },
    { label: "ISBN-10", value: data.isbn10 ?? "—" },
    { label: "Dewey", value: data.dewey ?? "—" },
    { label: "Added", value: formatDate(data.createdAt) },
  ];

  return (
    <div>
      <Link
        href="/dashboard/books"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-400 transition-colors hover:text-ink-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to catalog
      </Link>

      <div className="mb-6 flex flex-wrap items-start gap-5">
        {data.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.coverUrl}
            alt=""
            className="h-44 w-32 rounded-xl border border-ink-200 object-cover shadow-sm"
          />
        ) : (
          <div className="flex h-44 w-32 items-center justify-center rounded-xl border border-ink-200 bg-gradient-to-br from-ink-100 to-ink-200 text-2xl font-bold text-ink-400">
            {data.title.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <PageHeader
            title={data.title}
            description={data.subtitle ?? data.authors?.join(", ") ?? undefined}
            actions={
              <>
                <Button variant="outline" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditOpen(true)}>
                  Edit
                </Button>
                <Button variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => setAddOpen(true)}>
                  Add copies
                </Button>
                <Button
                  variant={data.status === "active" ? "outline" : "primary"}
                  icon={data.status === "active" ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                  onClick={() => (data.status === "active" ? setArchiveConfirm(true) : toggleArchive())}
                >
                  {data.status === "active" ? "Archive" : "Restore"}
                </Button>
              </>
            }
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {data.status === "active" ? <Badge tone="success">Active</Badge> : <Badge>Archived</Badge>}
            <Badge tone={copies.filter((copy) => copy.status === "available").length > 0 ? "brand" : "warn"}>
              {copies.filter((copy) => copy.status === "available").length} of {copies.length} available
            </Badge>
            {(data.categories ?? []).map((item) => (
              <Badge key={item} tone="neutral">
                {item}
              </Badge>
            ))}
            {(data.tags ?? []).map((tag) => (
              <Badge key={tag} tone="info">
                #{tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {data.authors?.length ? (
        <p className="mb-6 text-sm text-ink-500">
          by <span className="font-medium text-ink-700">{data.authors.join(", ")}</span>
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Copies"
              subtitle="Every physical copy, its branch and condition"
              action={
                <Button size="sm" variant="outline" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAddOpen(true)}>
                  Add copies
                </Button>
              }
            />
            {copies.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="h-5 w-5" />}
                title="No copies yet"
                description="Add at least one copy before this title can circulate."
              />
            ) : (
              <TableWrap className="rounded-xl">
                <thead>
                  <tr>
                    <Th>Barcode</Th>
                    <Th>Branch</Th>
                    <Th>Status</Th>
                    <Th>Condition</Th>
                    <Th>Shelf</Th>
                    <Th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {copies.map((copy) => (
                    <Tr key={copy.id}>
                      <Td className="font-mono text-[12.5px] font-medium text-ink-800">{copy.barcode}</Td>
                      <Td className="text-ink-500">{copy.branchName ?? "—"}</Td>
                      <Td>
                        {copy.status === "on_loan" || copy.status === "reserved" ? (
                          <Badge tone={statusTone(copy.status)}>{titleCase(copy.status)}</Badge>
                        ) : (
                          <Select
                            value={copy.status}
                            onChange={(event) => changeCopyStatus(copy, event.target.value)}
                            className="h-8 w-32 py-0 text-[12.5px]"
                          >
                            {COPY_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {titleCase(status)}
                              </option>
                            ))}
                          </Select>
                        )}
                      </Td>
                      <Td className="text-ink-500">{copy.condition ?? "—"}</Td>
                      <Td className="text-ink-500">{copy.location ?? "—"}</Td>
                      <Td>
                        <IconButton label="Withdraw copy" onClick={() => setWithdrawCopy(copy)}>
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Card>

          {data.description ? (
            <Card>
              <CardHeader title="Description" />
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink-600">{data.description}</p>
            </Card>
          ) : null}
        </div>

        <Card className="self-start">
          <CardHeader title="Metadata" />
          <dl className="divide-y divide-ink-100">
            {meta.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-[13px] text-ink-400">{row.label}</dt>
                <dd className="max-w-48 truncate text-right text-[13px] font-medium text-ink-700">{row.value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <BookFormModal open={editOpen} onClose={() => setEditOpen(false)} book={data} onSaved={() => book.reload()} />
      <AddCopiesModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        bookId={data.id}
        branches={branches.data ?? []}
        currency={settings.currency}
        onAdded={() => book.reload()}
      />
      <ConfirmModal
        open={archiveConfirm}
        onClose={() => setArchiveConfirm(false)}
        onConfirm={toggleArchive}
        loading={busy}
        title="Archive this book?"
        description="Archived books are hidden from search and the public catalog. Copies stay intact and you can restore it anytime."
        confirmLabel="Archive"
      />
      <ConfirmModal
        open={Boolean(withdrawCopy)}
        onClose={() => setWithdrawCopy(null)}
        onConfirm={confirmWithdraw}
        loading={busy}
        title={`Withdraw copy ${withdrawCopy?.barcode ?? ""}?`}
        description="The copy will be removed from the collection permanently. This cannot be undone."
        confirmLabel="Withdraw"
      />
    </div>
  );
}

function AddCopiesModal({
  open,
  onClose,
  bookId,
  branches,
  currency,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  bookId: string;
  branches: Branch[];
  currency: string;
  onAdded: () => void;
}) {
  const { push } = useToast();
  const [branchId, setBranchId] = useState("");
  const [count, setCount] = useState("1");
  const [barcodes, setBarcodes] = useState("");
  const [location, setLocation] = useState("");
  const [condition, setCondition] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const activeBranches = branches.filter((branch) => branch.status === "active");
  const lines = barcodes
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const targetBranch = branchId || activeBranches[0]?.id;
    if (!targetBranch) {
      setError("Create a branch first — copies must belong to a branch.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post(
        `/books/${bookId}/copies`,
        {
          branchId: targetBranch,
          count: lines.length > 0 ? lines.length : Number(count),
          barcodes: lines.length > 0 ? lines : undefined,
          location: location.trim() || null,
          condition: condition.trim() || null,
          priceCents: price ? Math.round(Number(price) * 100) : null,
        },
        { scope: "staff" },
      );
      push({ title: lines.length > 1 || Number(count) > 1 ? "Copies added" : "Copy added", tone: "success" });
      setBarcodes("");
      setCount("1");
      setLocation("");
      setCondition("");
      setPrice("");
      onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to add copies.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add copies"
      subtitle="Create one or many physical copies of this title"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button form="add-copies-form" type="submit" loading={saving}>
            Add copies
          </Button>
        </>
      }
    >
      <form id="add-copies-form" onSubmit={submit} className="space-y-4">
        {error ? <Callout tone="danger">{error}</Callout> : null}
        <Field label="Branch">
          <Select value={branchId || activeBranches[0]?.id || ""} onChange={(event) => setBranchId(event.target.value)}>
            {activeBranches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} ({branch.code})
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="How many" hint="Number of copies to create">
            <Input
              type="number"
              min={1}
              max={200}
              value={count}
              onChange={(event) => setCount(event.target.value)}
              disabled={lines.length > 0}
            />
          </Field>
          <Field label="Unit price" hint={`Optional, in ${currency}`}>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="e.g. 24.99"
            />
          </Field>
        </div>
        <Field label="Barcodes" hint="Optional — one per line. Leave empty to auto-generate.">
          <Textarea
            value={barcodes}
            onChange={(event) => setBarcodes(event.target.value)}
            rows={3}
            placeholder={"LIB-0001\nLIB-0002"}
            className="font-mono text-[12.5px]"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Shelf location">
            <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Shelf A-3" />
          </Field>
          <Field label="Condition">
            <Input value={condition} onChange={(event) => setCondition(event.target.value)} placeholder="New / Good …" />
          </Field>
        </div>
        {lines.length > 0 ? (
          <Callout tone="info">
            {lines.length} barcode{lines.length === 1 ? "" : "s"} will be created (the count field is ignored).
          </Callout>
        ) : null}
      </form>
    </Modal>
  );
}
