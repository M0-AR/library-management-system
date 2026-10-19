"use client";

import { useEffect, useState } from "react";
import { KeyRound, Pencil, ShieldOff, UserCog, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { TableSkeleton, TableWrap, Td, Th, Tr } from "@/components/table";
import {
  Avatar,
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
  useToast,
} from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { ROLES } from "@/lib/defaults";
import { formatDateTime, titleCase } from "@/lib/format";
import { useApi, useSession, useDebounced } from "@/lib/hooks";
import type { Branch, Paged, StaffUser } from "@/lib/types";

function roleTone(role: StaffUser["role"]) {
  if (role === "tenant_admin") return "brand" as const;
  if (role === "librarian") return "info" as const;
  return "neutral" as const;
}

function UserFormModal({
  open,
  onClose,
  onSaved,
  user,
  branches,
  isAdmin,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  user?: StaffUser | null;
  branches: Branch[];
  isAdmin: boolean;
}) {
  const { push } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("librarian");
  const [branchId, setBranchId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
    setPassword("");
    setRole(user?.role && user.role !== "patron" ? user.role : "librarian");
    setBranchId(user?.branchId ?? "");
    setError(null);
  }, [open, user]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (user) {
        await api.patch(
          `/users/${user.id}`,
          { name: name.trim(), role, branchId: branchId || null },
          { scope: "staff" },
        );
        push({ title: "Staff member updated", tone: "success" });
      } else {
        await api.post(
          "/users",
          {
            name: name.trim(),
            email: email.trim(),
            password,
            role,
            branchId: branchId || null,
          },
          { scope: "staff" },
        );
        push({ title: "Staff member added", tone: "success" });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save the account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={user ? `Edit ${user.name}` : "Add staff member"}
      subtitle={user ? user.email : "They sign in with the library slug + this email"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button form="user-form" type="submit" loading={saving}>
            {user ? "Save changes" : "Add staff"}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="space-y-4">
        {error ? <Callout tone="danger">{error}</Callout> : null}
        <Field label="Full name">
          <Input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={Boolean(user)}
            required
          />
        </Field>
        {!user ? (
          <Field label="Temporary password" hint="At least 8 characters; share it with the staff member">
            <Input
              type="text"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
              className="font-mono"
              autoComplete="off"
            />
          </Field>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Role">
            <Select value={role} onChange={(event) => setRole(event.target.value)} disabled={!isAdmin}>
              {ROLES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Branch" hint="Optional">
            <Select value={branchId} onChange={(event) => setBranchId(event.target.value)} disabled={!isAdmin}>
              <option value="">All branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} ({branch.code})
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Callout tone="info">
          <p className="font-medium">Role powers</p>
          <p className="mt-0.5">
            Administrators manage billing, domains and staff. Librarians run the full catalog and circulation.
            Assistants handle day-to-day desk work.
          </p>
        </Callout>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({
  user,
  onClose,
}: {
  user: StaffUser | null;
  onClose: () => void;
}) {
  const { push } = useToast();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPassword("");
    setError(null);
  }, [user]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/users/${user.id}/reset-password`, { newPassword: password }, { scope: "staff" });
      push({ title: "Password reset", description: `${user.name} must sign in again with the new password.`, tone: "success" });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to reset the password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={Boolean(user)}
      onClose={onClose}
      title="Reset password"
      subtitle={user ? `Issue a new password for ${user.name}` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button form="reset-form" type="submit" loading={saving}>
            Reset password
          </Button>
        </>
      }
    >
      <form id="reset-form" onSubmit={submit} className="space-y-4">
        {error ? <Callout tone="danger">{error}</Callout> : null}
        <Field label="New password" hint="Their current sessions are revoked immediately">
          <Input
            type="text"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
            className="font-mono"
            autoComplete="off"
          />
        </Field>
      </form>
    </Modal>
  );
}

export default function StaffPage() {
  const { push } = useToast();
  const { session } = useSession("staff");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<StaffUser | null>(null);
  const [resetUser, setResetUser] = useState<StaffUser | null>(null);
  const [disableUser, setDisableUser] = useState<StaffUser | null>(null);
  const [busy, setBusy] = useState(false);
  const query = useDebounced(search, 250);

  const isAdmin = session?.user.role === "tenant_admin";
  const branches = useApi<Branch[]>("/branches", { scope: "staff", query: { includeInactive: false } });
  const users = useApi<Paged<StaffUser>>("/users", {
    scope: "staff",
    query: {
      q: query || undefined,
      role: role || undefined,
      status: status || undefined,
      page,
      perPage: 20,
    },
  });

  const items = users.data?.items ?? [];

  async function confirmDisable() {
    if (!disableUser) return;
    setBusy(true);
    try {
      await api.delete(`/users/${disableUser.id}`, { scope: "staff" });
      push({ title: "Account disabled", description: disableUser.name, tone: "success" });
      setDisableUser(null);
      users.reload();
    } catch (err) {
      push({ title: "Action failed", description: err instanceof ApiError ? err.message : undefined, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Staff"
        description="Accounts, roles and branch assignments for your team."
        actions={
          isAdmin ? (
            <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
              Add staff
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 grid gap-2.5 sm:grid-cols-[1fr_auto_auto]">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search name or email…"
        />
        <Select
          value={role}
          onChange={(event) => {
            setRole(event.target.value);
            setPage(1);
          }}
          className="sm:w-44"
        >
          <option value="">All roles</option>
          {ROLES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </Select>
        <Select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className="sm:w-36"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </Select>
      </div>

      {users.loading && !users.data ? (
        <TableSkeleton rows={6} cols={6} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UserCog className="h-5 w-5" />}
            title={query ? "No matching accounts" : "No staff accounts"}
            description={query ? "Try a different search." : "Invite your team to help run the library."}
          />
        </Card>
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Branch</Th>
                <Th>Status</Th>
                <Th>Last login</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((user) => (
                <Tr key={user.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={user.name} size={32} />
                      <div>
                        <p className="font-semibold text-ink-900">{user.name}</p>
                        <p className="text-[12.5px] text-ink-400">{user.email}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={roleTone(user.role)}>{titleCase(user.role)}</Badge>
                  </Td>
                  <Td className="text-ink-500">
                    {user.branchId
                      ? branches.data?.find((branch) => branch.id === user.branchId)?.name ?? "—"
                      : "All branches"}
                  </Td>
                  <Td>
                    {user.status === "active" ? <Badge tone="success">Active</Badge> : <Badge>Disabled</Badge>}
                  </Td>
                  <Td className="text-ink-500">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Never"}</Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      {isAdmin ? (
                        <>
                          <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditUser(user)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<KeyRound className="h-3.5 w-3.5" />}
                            onClick={() => setResetUser(user)}
                          >
                            Reset
                          </Button>
                          {user.status === "active" && user.id !== session?.user.id ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                              icon={<ShieldOff className="h-3.5 w-3.5" />}
                              onClick={() => setDisableUser(user)}
                            >
                              Disable
                            </Button>
                          ) : null}
                        </>
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
            page={users.data?.meta.page ?? 1}
            totalPages={users.data?.meta.totalPages ?? 1}
            total={users.data?.meta.total ?? 0}
            perPage={users.data?.meta.perPage}
            onPage={setPage}
          />
        </>
      )}

      <UserFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => users.reload()}
        branches={branches.data ?? []}
        isAdmin={isAdmin}
      />
      <UserFormModal
        open={Boolean(editUser)}
        user={editUser}
        onClose={() => setEditUser(null)}
        onSaved={() => users.reload()}
        branches={branches.data ?? []}
        isAdmin={isAdmin}
      />
      <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />
      <ConfirmModal
        open={Boolean(disableUser)}
        onClose={() => setDisableUser(null)}
        onConfirm={confirmDisable}
        loading={busy}
        title="Disable this account?"
        description={disableUser ? `${disableUser.name} will be signed out and blocked from signing in until re-enabled.` : ""}
        confirmLabel="Disable account"
      />
    </div>
  );
}
