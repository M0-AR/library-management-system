"use client";

import { useEffect, useState } from "react";
import { Building2, MapPin, Pencil, Phone, Plus } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
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
  PageLoader,
  Switch,
  useToast,
} from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import type { Branch } from "@/lib/types";

function BranchFormModal({
  open,
  onClose,
  onSaved,
  branch,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  branch?: Branch | null;
}) {
  const { push } = useToast();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(branch?.name ?? "");
    setCode(branch?.code ?? "");
    setAddress(branch?.address ?? "");
    setPhone(branch?.phone ?? "");
    setError(null);
  }, [open, branch]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (branch) {
        await api.patch(
          `/branches/${branch.id}`,
          { name: name.trim(), address: address.trim() || null, phone: phone.trim() || null },
          { scope: "staff" },
        );
        push({ title: "Branch updated", tone: "success" });
      } else {
        await api.post(
          "/branches",
          { name: name.trim(), code: code.trim().toUpperCase(), address: address.trim() || null, phone: phone.trim() || null },
          { scope: "staff" },
        );
        push({ title: "Branch created", tone: "success" });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save the branch.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={branch ? `Edit ${branch.name}` : "Add a branch"}
      subtitle={branch ? undefined : "Branches hold copies and scope staff access"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button form="branch-form" type="submit" loading={saving}>
            {branch ? "Save changes" : "Create branch"}
          </Button>
        </>
      }
    >
      <form id="branch-form" onSubmit={submit} className="space-y-4">
        {error ? <Callout tone="danger">{error}</Callout> : null}
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <Field label="Name">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Main Library" required />
          </Field>
          <Field label="Code" hint="2–12 chars">
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="MAIN"
              disabled={Boolean(branch)}
              minLength={2}
              maxLength={12}
              required
              className="font-mono"
            />
          </Field>
        </div>
        <Field label="Address">
          <Input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="12 Main Street" />
        </Field>
        <Field label="Phone">
          <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+1 555 0100" />
        </Field>
      </form>
    </Modal>
  );
}

export default function BranchesPage() {
  const { push } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Branch | null>(null);
  const [busy, setBusy] = useState(false);
  const [showInactive, setShowInactive] = useState(true);

  const branches = useApi<Branch[]>("/branches", {
    scope: "staff",
    query: { includeInactive: true },
  });

  const list = branches.data ?? [];

  async function confirmToggle() {
    if (!toggleTarget) return;
    setBusy(true);
    try {
      const nextStatus = toggleTarget.status === "active" ? "inactive" : "active";
      await api.patch(`/branches/${toggleTarget.id}`, { status: nextStatus }, { scope: "staff" });
      push({ title: nextStatus === "active" ? "Branch reactivated" : "Branch deactivated", tone: "success" });
      setToggleTarget(null);
      branches.reload();
    } catch (err) {
      push({ title: "Action failed", description: err instanceof ApiError ? err.message : undefined, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Branches"
        description="Physical locations where your collection lives."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
            Add branch
          </Button>
        }
      />

      <div className="mb-4 max-w-xs">
        <Switch
          checked={showInactive}
          onChange={setShowInactive}
          label="Show inactive branches"
          description="Include deactivated locations in the list"
        />
      </div>

      {branches.loading && !branches.data ? (
        <PageLoader label="Loading branches" />
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Building2 className="h-5 w-5" />}
            title="No branches yet"
            description="Create your first branch — copies must belong to one."
            action={
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
                Add branch
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(showInactive ? list : list.filter((branch) => branch.status === "active")).map((branch) => (
            <Card key={branch.id} className="flex flex-col gap-4 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-ink-900">{branch.name}</p>
                    <p className="font-mono text-[11.5px] text-ink-400">{branch.code}</p>
                  </div>
                </div>
                {branch.status === "active" ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}
              </div>
              <div className="space-y-1.5 text-[13px] text-ink-500">
                <p className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-ink-300" />
                  {branch.address ?? "No address on file"}
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-ink-300" />
                  {branch.phone ?? "No phone on file"}
                </p>
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-ink-100 pt-3.5">
                <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditBranch(branch)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className={branch.status === "active" ? "text-rose-500 hover:bg-rose-50 hover:text-rose-600" : ""}
                  onClick={() => setToggleTarget(branch)}
                >
                  {branch.status === "active" ? "Deactivate" : "Reactivate"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <BranchFormModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={() => branches.reload()} />
      <BranchFormModal
        open={Boolean(editBranch)}
        branch={editBranch}
        onClose={() => setEditBranch(null)}
        onSaved={() => branches.reload()}
      />
      <ConfirmModal
        open={Boolean(toggleTarget)}
        onClose={() => setToggleTarget(null)}
        onConfirm={confirmToggle}
        loading={busy}
        tone={toggleTarget?.status === "active" ? "danger" : "primary"}
        title={toggleTarget?.status === "active" ? "Deactivate this branch?" : "Reactivate this branch?"}
        description={
          toggleTarget?.status === "active"
            ? "Staff at this branch keep their access, but the location is hidden from new copy assignments and checkout screens."
            : "The branch becomes selectable again for copies and staff."
        }
        confirmLabel={toggleTarget?.status === "active" ? "Deactivate" : "Reactivate"}
      />
    </div>
  );
}
