"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Button, Callout, Field, Input, Modal, Select, Textarea, useToast } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import type { Book, IsbnLookup } from "@/lib/types";

interface BookFormState {
  title: string;
  subtitle: string;
  authors: string;
  isbn13: string;
  isbn10: string;
  publisher: string;
  publishedYear: string;
  language: string;
  pages: string;
  description: string;
  coverUrl: string;
  categories: string;
  tags: string;
  dewey: string;
}

function toState(book?: Book | null): BookFormState {
  return {
    title: book?.title ?? "",
    subtitle: book?.subtitle ?? "",
    authors: book?.authors?.join(", ") ?? "",
    isbn13: book?.isbn13 ?? "",
    isbn10: book?.isbn10 ?? "",
    publisher: book?.publisher ?? "",
    publishedYear: book?.publishedYear ? String(book.publishedYear) : "",
    language: book?.language ?? "en",
    pages: book?.pages ? String(book.pages) : "",
    description: book?.description ?? "",
    coverUrl: book?.coverUrl ?? "",
    categories: book?.categories?.join(", ") ?? "",
    tags: book?.tags?.join(", ") ?? "",
    dewey: book?.dewey ?? "",
  };
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function BookFormModal({
  open,
  onClose,
  onSaved,
  book,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (book: Book) => void;
  book?: Book | null;
}) {
  const { push } = useToast();
  const [form, setForm] = useState<BookFormState>(toState(book));
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(toState(book));
      setError(null);
    }
  }, [open, book]);

  function set<K extends keyof BookFormState>(key: K, value: BookFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function lookupIsbn() {
    const isbn = (form.isbn13 || form.isbn10).replace(/[-\s]/g, "");
    if (!isbn) {
      setError("Enter an ISBN-10 or ISBN-13 first.");
      return;
    }
    setLookingUp(true);
    setError(null);
    try {
      const result = await api.get<IsbnLookup>(`/books/isbn/${isbn}`, { scope: "staff" });
      setForm((current) => ({
        ...current,
        title: result.title ?? current.title,
        subtitle: result.subtitle ?? current.subtitle,
        authors: result.authors?.length ? result.authors.join(", ") : current.authors,
        isbn13: result.isbn13 ?? current.isbn13,
        isbn10: result.isbn10 ?? current.isbn10,
        publisher: result.publisher ?? current.publisher,
        publishedYear: result.publishedYear ? String(result.publishedYear) : current.publishedYear,
        language: result.language ?? current.language,
        pages: result.pages ? String(result.pages) : current.pages,
        description: result.description ?? current.description,
        coverUrl: result.coverUrl ?? current.coverUrl,
        categories: result.categories?.length ? result.categories.join(", ") : current.categories,
      }));
      push({ title: "Metadata loaded", tone: "success" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Lookup failed.");
    } finally {
      setLookingUp(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      authors: splitList(form.authors),
      isbn13: form.isbn13.trim() || null,
      isbn10: form.isbn10.trim() || null,
      publisher: form.publisher.trim() || null,
      publishedYear: form.publishedYear ? Number(form.publishedYear) : null,
      language: form.language.trim() || "en",
      pages: form.pages ? Number(form.pages) : null,
      description: form.description.trim() || null,
      coverUrl: form.coverUrl.trim() || null,
      categories: splitList(form.categories),
      tags: splitList(form.tags),
      dewey: form.dewey.trim() || null,
    };
    try {
      const saved = book
        ? await api.patch<Book>(`/books/${book.id}`, payload, { scope: "staff" })
        : await api.post<Book>("/books", payload, { scope: "staff" });
      push({ title: book ? "Book updated" : "Book added", tone: "success" });
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save the book.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={book ? "Edit book" : "Add book"}
      subtitle={book ? book.title : "Add a title to your catalog"}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button form="book-form" type="submit" loading={saving}>
            {book ? "Save changes" : "Add book"}
          </Button>
        </>
      }
    >
      <form id="book-form" onSubmit={submit} className="space-y-4">
        {error ? <Callout tone="danger">{error}</Callout> : null}
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="ISBN-13 or ISBN-10" hint="Fill either and pull metadata automatically">
            <Input
              value={form.isbn13 || form.isbn10}
              onChange={(event) => {
                const value = event.target.value;
                if (value.replace(/[-\s]/g, "").length > 10) set("isbn13", value);
                else {
                  set("isbn10", value);
                  set("isbn13", "");
                }
              }}
              placeholder="9780143127741"
            />
          </Field>
          <Button variant="outline" onClick={lookupIsbn} loading={lookingUp} icon={<Search className="h-4 w-4" />}>
            Lookup
          </Button>
        </div>
        <Field label="Title">
          <Input value={form.title} onChange={(event) => set("title", event.target.value)} required />
        </Field>
        <Field label="Subtitle">
          <Input value={form.subtitle} onChange={(event) => set("subtitle", event.target.value)} />
        </Field>
        <Field label="Authors" hint="Comma separated">
          <Input value={form.authors} onChange={(event) => set("authors", event.target.value)} placeholder="Ursula K. Le Guin" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Publisher">
            <Input value={form.publisher} onChange={(event) => set("publisher", event.target.value)} />
          </Field>
          <Field label="Published year">
            <Input
              type="number"
              min={1000}
              max={2100}
              value={form.publishedYear}
              onChange={(event) => set("publishedYear", event.target.value)}
            />
          </Field>
          <Field label="Language">
            <Input value={form.language} onChange={(event) => set("language", event.target.value)} placeholder="en" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categories" hint="Comma separated">
            <Input value={form.categories} onChange={(event) => set("categories", event.target.value)} placeholder="Science Fiction, Classics" />
          </Field>
          <Field label="Tags" hint="Comma separated">
            <Input value={form.tags} onChange={(event) => set("tags", event.target.value)} placeholder="award-winner" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Pages">
            <Input type="number" min={1} value={form.pages} onChange={(event) => set("pages", event.target.value)} />
          </Field>
          <Field label="Dewey">
            <Input value={form.dewey} onChange={(event) => set("dewey", event.target.value)} placeholder="813.54" />
          </Field>
          <Field label="Cover URL">
            <Input value={form.coverUrl} onChange={(event) => set("coverUrl", event.target.value)} placeholder="https://…" />
          </Field>
        </div>
        <Field label="Description">
          <Textarea value={form.description} onChange={(event) => set("description", event.target.value)} rows={4} />
        </Field>
      </form>
    </Modal>
  );
}
