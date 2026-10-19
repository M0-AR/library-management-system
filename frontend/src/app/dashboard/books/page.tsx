"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookOpen, Plus } from "lucide-react";
import { BookFormModal } from "@/components/dashboard/book-form";
import { PageHeader } from "@/components/dashboard/page-header";
import { TableSkeleton, TableWrap, Td, Th, Tr } from "@/components/table";
import { Badge, Button, Card, EmptyState, Pagination, SearchInput, Select } from "@/components/ui";
import { useApi, useDebounced } from "@/lib/hooks";
import type { Book, Paged } from "@/lib/types";

function CoverThumb({ book }: { book: Book }) {
  if (book.coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={book.coverUrl}
        alt=""
        className="h-12 w-9 rounded-md border border-ink-200 object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <span className="flex h-12 w-9 items-center justify-center rounded-md border border-ink-200 bg-gradient-to-br from-ink-100 to-ink-200 text-[11px] font-bold text-ink-400">
      {book.title.slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function BooksPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<"recent" | "title">("recent");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const query = useDebounced(search, 250);

  const categories = useApi<string[]>("/books/categories", { scope: "staff" });
  const books = useApi<Paged<Book>>("/books", {
    scope: "staff",
    query: {
      q: query || undefined,
      category: category || undefined,
      status: status || undefined,
      sort,
      page,
      perPage: 20,
    },
  });

  function resetTo(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  const items = books.data?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Catalog"
        description="Every title in your collection, with copy availability at a glance."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
            Add book
          </Button>
        }
      />

      <div className="mb-4 grid gap-2.5 sm:grid-cols-[1fr_auto_auto_auto]">
        <SearchInput
          value={search}
          onChange={(value) => resetTo(setSearch, value)}
          placeholder="Search title, author, ISBN…"
        />
        <Select
          value={category}
          onChange={(event) => resetTo(setCategory, event.target.value)}
          className="sm:w-44"
        >
          <option value="">All categories</option>
          {(categories.data ?? []).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(event) => resetTo(setStatus, event.target.value)} className="sm:w-36">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </Select>
        <Select
          value={sort}
          onChange={(event) => {
            setSort(event.target.value as "recent" | "title");
            setPage(1);
          }}
          className="sm:w-36"
        >
          <option value="recent">Recently added</option>
          <option value="title">Title A–Z</option>
        </Select>
      </div>

      {books.loading && !books.data ? (
        <TableSkeleton rows={8} cols={6} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpen className="h-5 w-5" />}
            title={query || category || status ? "No books match your filters" : "Your catalog is empty"}
            description={
              query || category || status
                ? "Try a different search or clear the filters."
                : "Add your first book to start circulating."
            }
            action={
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
                Add book
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th className="w-14" />
                <Th>Title</Th>
                <Th>Categories</Th>
                <Th>ISBN</Th>
                <Th>Copies</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((book) => (
                <Tr key={book.id} onClick={() => router.push(`/dashboard/books/${book.id}`)}>
                  <Td>
                    <CoverThumb book={book} />
                  </Td>
                  <Td>
                    <div className="min-w-0 max-w-md">
                      <p className="truncate font-semibold text-ink-900">{book.title}</p>
                      <p className="truncate text-[12.5px] text-ink-400">
                        {book.authors?.length ? book.authors.join(", ") : "Unknown author"}
                        {book.publishedYear ? ` · ${book.publishedYear}` : ""}
                      </p>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex max-w-56 flex-wrap gap-1">
                      {(book.categories ?? []).slice(0, 2).map((item) => (
                        <Badge key={item}>{item}</Badge>
                      ))}
                      {(book.categories ?? []).length > 2 ? (
                        <Badge>+{(book.categories ?? []).length - 2}</Badge>
                      ) : null}
                    </div>
                  </Td>
                  <Td className="font-mono text-[12.5px] text-ink-500">{book.isbn13 ?? book.isbn10 ?? "—"}</Td>
                  <Td>
                    <Badge
                      tone={
                        (book.copiesAvailable ?? 0) > 0
                          ? "success"
                          : (book.copiesTotal ?? 0) > 0
                            ? "warn"
                            : "neutral"
                      }
                    >
                      {book.copiesAvailable ?? 0}/{book.copiesTotal ?? 0} available
                    </Badge>
                  </Td>
                  <Td>
                    {book.status === "active" ? <Badge tone="success">Active</Badge> : <Badge>Archived</Badge>}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
          <Pagination
            page={books.data?.meta.page ?? 1}
            totalPages={books.data?.meta.totalPages ?? 1}
            total={books.data?.meta.total ?? 0}
            perPage={books.data?.meta.perPage}
            onPage={setPage}
          />
        </>
      )}

      <p className="mt-4 text-[12.5px] text-ink-400">
        Looking for a quick action?{" "}
        <Link href="/dashboard/loans" className="font-medium text-[var(--brand)] hover:underline">
          Check out a book
        </Link>{" "}
        from the circulation desk.
      </p>

      <BookFormModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={() => books.reload()} />
    </div>
  );
}
