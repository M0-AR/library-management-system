"use client";

import { useState } from "react";
import { Bell, SearchX } from "lucide-react";
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
  Tabs,
} from "@/components/ui";
import { formatDateTime, titleCase } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { Paged } from "@/lib/types";

interface NotificationRow {
  id: string;
  channel: "email" | "sms" | "in_app";
  template: string;
  subject: string;
  body: string;
  status: "queued" | "sent" | "failed";
  error: string | null;
  createdAt: string;
  sentAt: string | null;
}

type TabId = "queued" | "sent" | "failed" | "";

const STATUS_TONE: Record<NotificationRow["status"], "success" | "neutral" | "danger"> = {
  sent: "success",
  queued: "neutral",
  failed: "danger",
};

export default function MessagesPage() {
  const [tab, setTab] = useState<TabId>("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<NotificationRow | null>(null);

  const list = useApi<Paged<NotificationRow>>("/notifications", {
    scope: "staff",
    query: { status: tab || undefined, page, perPage: 20 },
  });

  const items = list.data?.items ?? [];
  const meta = list.data?.meta;

  return (
    <div>
      <PageHeader
        title="Messages"
        description="The outbox — every email the library queued for patrons."
      />

      {list.error ? (
        <Callout tone="danger">We couldn’t load messages. Please refresh the page.</Callout>
      ) : (
        <>
          <div className="mb-4">
            <Tabs<TabId>
              tabs={[
                { id: "", label: "All" },
                { id: "sent", label: "Sent" },
                { id: "queued", label: "Queued" },
                { id: "failed", label: "Failed" },
              ]}
              active={tab}
              onChange={(id) => {
                setTab(id);
                setPage(1);
              }}
            />
          </div>

          {list.loading && !list.data ? (
            <TableSkeleton rows={8} cols={4} />
          ) : items.length === 0 ? (
            <Card>
              <EmptyState
                icon={<SearchX className="h-5 w-5" />}
                title={tab ? "Nothing in this view" : "No messages yet"}
                description="Hold-ready, due-soon and overdue emails appear here as they go out."
              />
            </Card>
          ) : (
            <>
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Message</Th>
                    <Th>Channel</Th>
                    <Th>Status</Th>
                    <Th>Created</Th>
                    <Th className="text-right">Details</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <Tr key={row.id}>
                      <Td>
                        <p className="max-w-80 truncate font-semibold text-ink-900">{row.subject}</p>
                        <p className="text-[11.5px] text-ink-400">{titleCase(row.template)}</p>
                      </Td>
                      <Td className="text-ink-500">{titleCase(row.channel)}</Td>
                      <Td>
                        <Badge tone={STATUS_TONE[row.status]}>
                          {row.status === "failed" && row.error ? `Failed · ${row.error.slice(0, 32)}` : titleCase(row.status)}
                        </Badge>
                      </Td>
                      <Td className="text-ink-500">
                        {row.sentAt ? `Sent ${formatDateTime(row.sentAt)}` : formatDateTime(row.createdAt)}
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
        </>
      )}

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={
          <span className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-ink-400" />
            {selected?.subject}
          </span>
        }
        subtitle={
          selected
            ? `${titleCase(selected.template)} · ${titleCase(selected.status)}${
                selected.sentAt ? ` · sent ${formatDateTime(selected.sentAt)}` : ` · created ${formatDateTime(selected.createdAt)}`
              }`
            : undefined
        }
        size="lg"
      >
        {selected?.error ? <Callout tone="danger">{selected.error}</Callout> : null}
        <pre className="mt-1 whitespace-pre-wrap font-sans text-[13.5px] leading-relaxed text-ink-700">
          {selected?.body}
        </pre>
      </Modal>
    </div>
  );
}
