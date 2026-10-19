"use client";

import { useEffect, useState } from "react";
import { Pencil, UserPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { ExportButton } from "@/components/dashboard/export-button";
import { TableSkeleton, TableWrap, Td, Th, Tr } from "@/components/table";
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Pagination,
  SearchInput,
  Select,
  Textarea,
  useToast,
} from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { MEMBER_CATEGORIES } from "@/lib/defaults";
import { formatDate, formatMoney, titleCase } from "@/lib/format";
import { useApi, useDebounced } from "@/lib/hooks";
import { useTenant } from "@/lib/tenant-context";
import type { Member, MemberDetail, Paged } from "@/lib/types";

export function memberStatusTone(status: Member["status"]) {
  if (status === "active") return "success" as const;
  if (status === "suspended") return "danger" as const;
  return "neutral" as const;
}

export function MemberFormModal({
  open,
  onClose,
  onSaved,
  member,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  member?: MemberDetail | Member | null;
}) {
  const { push } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("adult");
  const [cardNumber, setCardNumber] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFullName(member?.fullName ?? "");
    setEmail(member?.email ?? "");
    setPhone(member?.phone ?? "");
    setCategory(member?.category ?? "adult");
    setCardNumber(member?.cardNumber ?? "");
    setExpiresAt(member?.expiresAt ? String(member.expiresAt).slice(0, 10) : "");
    setNotes(member?.notes ?? "");
    setError(null);
  }, [open, member]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      fullName: fullName.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      category,
      expiresAt: expiresAt || null,
      notes: notes.trim() || null,
    };
    try {
      if (member) {
        await api.patch(`/members/${member.id}`, payload, { scope: "staff" });
        push({ title: "Member updated", tone: "success" });
      } else {
        await api.post(
          "/members",
          { ...payload, cardNumber: cardNumber.trim() || undefined },
          { scope: "staff" },
        );
        push({ title: "Member registered", tone: "success" });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save the member.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={member ? "Edit member" : "Register member"}
      subtitle={member ? member.fullName : "Create a new library card"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button form="member-form" type="submit" loading={saving}>
            {member ? "Save changes" : "Register"}
          </Button>
        </>
      }
    >
      <form id="member-form" onSubmit={submit} className="space-y-4">
        {error ? <Callout tone="danger">{error}</Callout> : null}
        <Field label="Full name">
          <Input value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={2} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <Select value={category} onChange={(event) => setCategory(event.target.value)}>
              {MEMBER_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {titleCase(item)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Card number" hint={member ? "Card numbers cannot be changed" : "Leave empty to auto-generate"}>
            <Input
              value={cardNumber}
              onChange={(event) => setCardNumber(event.target.value)}
              disabled={Boolean(member)}
              placeholder="LIB-00042"
            />
          </Field>
        </div>
        <Field label="Membership expires" hint="Optional — expired cards block new checkouts">
          <Input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
        </Field>
        <Field label="Notes">
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
        </Field>
      </form>
    </Modal>
  );
}

function MemberDrawer({
  memberId,
  onClose,
  onEdit,
}: {
  memberId: string | null;
  onClose: () => void;
  onEdit: (member: MemberDetail) => void;
}) {
  const { push } = useToast();
  const { settings } = useTenant();
  const detail = useApi<MemberDetail>(memberId ? `/members/${memberId}` : null, { scope: "staff" });
  const [busy, setBusy] = useState(false);

  const member = detail.data;

  async function setStatus(status: Member["status"]) {
    if (!member) return;
    setBusy(true);
    try {
      await api.patch(`/members/${member.id}`, { status }, { scope: "staff" });
      push({ title: `Member ${status === "active" ? "reactivated" : status}`, tone: "success" });
      detail.reload();
    } catch (err) {
      push({ title: "Unable to update member", description: err instanceof ApiError ? err.message : undefined, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={Boolean(memberId)}
      onClose={onClose}
      title={member ? member.fullName : "Member"}
      subtitle={member ? `Card ${member.cardNumber}` : undefined}
      size="lg"
      footer={
        member ? (
          <>
            {member.status === "active" ? (
              <Button variant="outline" loading={busy} onClick={() => setStatus("suspended")}>
                Suspend
              </Button>
            ) : (
              <Button variant="outline" loading={busy} onClick={() => setStatus("active")}>
                Reactivate
              </Button>
            )}
            <Button icon={<Pencil className="h-4 w-4" />} onClick={() => onEdit(member)}>
              Edit details
            </Button>
          </>
        ) : undefined
      }
    >
      {!member ? (
        <div className="py-10 text-center text-sm text-ink-400">Loading…</div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={member.fullName} size={52} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={memberStatusTone(member.status)}>{titleCase(member.status)}</Badge>
                <Badge>{titleCase(member.category)}</Badge>
                {member.expiresAt ? <Badge tone="info">Expires {formatDate(member.expiresAt)}</Badge> : null}
              </div>
              <p className="mt-1.5 text-[13px] text-ink-400">
                {member.email ?? "No email"} · {member.phone ?? "No phone"} · Joined {formatDate(member.joinedAt)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Active loans", value: member.activeLoans ?? 0, danger: (member.overdueLoans ?? 0) > 0 },
              { label: "Open holds", value: member.openHolds ?? 0 },
              { label: "Overdue", value: member.overdueLoans ?? 0, danger: (member.overdueLoans ?? 0) > 0 },
              {
                label: "Fines owed",
                value: formatMoney(member.outstandingFineCents ?? 0, settings.currency),
                danger: (member.outstandingFineCents ?? 0) > 0,
              },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-ink-200/80 bg-ink-50/50 p-3">
                <p className="text-[11.5px] font-medium text-ink-400">{stat.label}</p>
                <p className={`mt-1 text-lg font-bold ${stat.danger ? "text-rose-600" : "text-ink-900"}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          {member.notes ? <Callout tone="info">{member.notes}</Callout> : null}

          <div className="rounded-xl border border-ink-200/80">
            <p className="border-b border-ink-100 px-4 py-2.5 text-[13px] font-semibold text-ink-700">Activity</p>
            <div className="px-4 py-3 text-[13px] text-ink-400">
              Open the member&apos;s loans, holds and fines from{" "}
              <span className="font-medium text-ink-600">Circulation</span>,{" "}
              <span className="font-medium text-ink-600">Holds</span> and{" "}
              <span className="font-medium text-ink-600">Fines</span> — filtered automagically by card number.
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function MembersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editMember, setEditMember] = useState<MemberDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const query = useDebounced(search, 250);
  const { settings } = useTenant();

  const members = useApi<Paged<Member>>("/members", {
    scope: "staff",
    query: {
      q: query || undefined,
      status: status || undefined,
      category: category || undefined,
      page,
      perPage: 20,
    },
  });

  const items = members.data?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Members"
        description="Library cards, contact details and account standing."
        actions={
          <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
            Register member
          </Button>
        }
      />

      <div className="mb-4 grid gap-2.5 sm:grid-cols-[1fr_auto_auto_auto]">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search name, card number, email…"
        />
        <Select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className="sm:w-40"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="expired">Expired</option>
          <option value="closed">Closed</option>
        </Select>
        <Select
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setPage(1);
          }}
          className="sm:w-40"
        >
          <option value="">All categories</option>
          {MEMBER_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {titleCase(item)}
            </option>
          ))}
        </Select>
        <ExportButton resource="members" />
      </div>

      {members.loading && !members.data ? (
        <TableSkeleton rows={8} cols={6} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title={query ? "No members match" : "No members yet"}
            description={query ? "Try a different search." : "Register your first member to start lending."}
            action={
              <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
                Register member
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th>Member</Th>
                <Th>Card</Th>
                <Th>Category</Th>
                <Th>Loans</Th>
                <Th>Holds</Th>
                <Th>Status</Th>
                <Th>Joined</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((member) => (
                <Tr key={member.id} onClick={() => setSelectedId(member.id)}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={member.fullName} size={34} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink-900">{member.fullName}</p>
                        <p className="truncate text-[12.5px] text-ink-400">{member.email ?? member.phone ?? "—"}</p>
                      </div>
                    </div>
                  </Td>
                  <Td className="font-mono text-[12.5px] text-ink-500">{member.cardNumber}</Td>
                  <Td>
                    <Badge>{titleCase(member.category)}</Badge>
                  </Td>
                  <Td>
                    <span className={`font-medium ${(member.overdueLoans ?? 0) > 0 ? "text-rose-600" : "text-ink-700"}`}>
                      {member.activeLoans ?? 0}
                    </span>
                    {(member.overdueLoans ?? 0) > 0 ? (
                      <span className="ml-1.5 text-[12px] text-rose-500">({member.overdueLoans} overdue)</span>
                    ) : null}
                  </Td>
                  <Td className="text-ink-600">{member.openHolds ?? 0}</Td>
                  <Td>
                    <Badge tone={memberStatusTone(member.status)}>{titleCase(member.status)}</Badge>
                  </Td>
                  <Td className="text-ink-500">{formatDate(member.joinedAt)}</Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination
            page={members.data?.meta.page ?? 1}
            totalPages={members.data?.meta.totalPages ?? 1}
            total={members.data?.meta.total ?? 0}
            perPage={members.data?.meta.perPage}
            onPage={setPage}
          />
        </>
      )}

      <MemberFormModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={() => members.reload()} />
      <MemberFormModal
        open={Boolean(editMember)}
        member={editMember}
        onClose={() => setEditMember(null)}
        onSaved={() => {
          members.reload();
          setSelectedId(editMember?.id ?? null);
        }}
      />
      <MemberDrawer memberId={selectedId} onClose={() => setSelectedId(null)} onEdit={(member) => setEditMember(member)} />

      <p className="mt-4 text-[12.5px] text-ink-400">
        Outstanding balances show in the member profile once fines exist. Currency: {settings.currency}.
      </p>
    </div>
  );
}
