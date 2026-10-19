"use client";

import { useState } from "react";
import { History, SearchX } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { TableSkeleton, TableWrap, Td, Th, Tr } from "@/components/table";
import {
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  Modal,
  Pagination,
  SearchInput,
  Select,
} from "@/components/ui";
import { formatDateTime, titleCase } from "@/lib/format";
import { useApi, useDebounced } from "@/lib/hooks";
import type { Paged } from "@/lib/types";

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
}

const ENTITY_TYPES = [
  "book",
  "copy",
  "member",
  "loan",
  "hold",
  "fine",
  "branch",
  "user",
  "tenant",
  "domain",
];

export default function ActivityPage() {
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const debouncedAction = useDebounced(action, 350);

  const list = useApi<Paged<AuditRow>>("/audit-logs", {
    scope: "staff",
    query: {
      action: debouncedAction || undefined,
      entityType: entityType || undefined,
      page,
      perPage: 25,
    },
  });

  const items = list.data?.items ?? [];
  const meta = list.data?.meta;

  return (
    <div>
      <PageHeader
        title="Activity"
        description="An audit trail of everything your team changed — newest first."
      />

      <div className="mb-4 grid gap-2.5 sm:grid-cols-[1fr_auto]">
        <SearchInput
          value={action}
          onChange={(value) => {
            setAction(value);
            setPage(1);
          }}
          placeholder="Filter by action, e.g. book.created…"
        />
        <Select
          value={entityType}
          onChange={(event) => {
            setEntityType(event.target.value);
            setPage(1);
          }}
          className="sm:w-44"
        >
          <option value="">All entities</option>
          {ENTITY_TYPES.map((type) => (
            <option key={type} value={type}>
              {titleCase(type)}
            </option>
          ))}
        </Select>
      </div>

      {list.error ? (
        <Callout tone="danger">We couldn’t load the activity log. Please refresh the page.</Callout>
      ) : list.loading && !list.data ? (
        <TableSkeleton rows={8} cols={5} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<SearchX className="h-5 w-5" />}
            title={debouncedAction || entityType ? "No matching entries" : "No activity yet"}
            description={
              debouncedAction || entityType
                ? "Try a different action or entity filter."
                : "Changes your team makes will show up here."
            }
          />
        </Card>
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Actor</Th>
                <Th>Action</Th>
                <Th>Entity</Th>
                <Th className="text-right">Details</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <Tr key={row.id}>
                  <Td className="whitespace-nowrap text-ink-500">{formatDateTime(row.createdAt)}</Td>
                  <Td>
                    <p className="max-w-44 truncate font-medium text-ink-800">
                      {row.actorName ?? "System"}
                    </p>
                    {row.actorEmail ? (
                      <p className="max-w-44 truncate text-[11.5px] text-ink-400">{row.actorEmail}</p>
                    ) : null}
                  </Td>
                  <Td>
                    <Badge tone="neutral">{row.action}</Badge>
                  </Td>
                  <Td className="text-ink-500">
                    {titleCase(row.entityType)}
                    {row.entityId ? (
                      <span className="ml-1.5 font-mono text-[11px] text-ink-300">
                        {row.entityId.slice(0, 8)}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setSelected(row)}>
                      View
                    </Button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>

          {meta && meta.totalPages > 1 ? (
            <div className="mt-6">
              <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />
            </div>
          ) : null}
        </>
      )}

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={
          <span className="flex items-center gap-2">
            <History className="h-4 w-4 text-ink-400" />
            {selected?.action}
          </span>
        }
        subtitle={selected ? `${titleCase(selected.entityType)} · ${selected.entityId}` : undefined}
        size="lg"
      >
        <dl className="mb-4 grid gap-2 text-[13px] sm:grid-cols-2">
          <div className="flex justify-between gap-3 rounded-xl bg-ink-50 px-3.5 py-2.5">
            <dt className="text-ink-400">When</dt>
            <dd className="font-medium text-ink-700">
              {selected ? formatDateTime(selected.createdAt) : ""}
            </dd>
          </div>
          <div className="flex justify-between gap-3 rounded-xl bg-ink-50 px-3.5 py-2.5">
            <dt className="text-ink-400">IP</dt>
            <dd className="font-mono text-[12px] font-medium text-ink-700">{selected?.ip ?? "—"}</dd>
          </div>
        </dl>
        <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-400">Metadata</p>
        <pre className="max-h-72 overflow-auto rounded-xl bg-ink-950 p-4 font-mono text-[12px] leading-relaxed text-ink-100">
          {JSON.stringify(selected?.metadata ?? {}, null, 2)}
        </pre>
      </Modal>
    </div>
  );
}
