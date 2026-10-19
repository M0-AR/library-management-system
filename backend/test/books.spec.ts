import { beforeEach, describe, expect, it } from "vitest";
import {
  addCopies,
  api,
  createBook,
  mainBranch,
  registerTenant,
  resetDb,
} from "./helpers";
import type { TenantSession } from "./helpers";

describe("books catalog", () => {
  let session: TenantSession;
  let branchId: string;

  beforeEach(async () => {
    await resetDb();
    session = await registerTenant();
    branchId = (await mainBranch(session.token)).id;
  });

  it("creates a book with full metadata and reads it back", async () => {
    const res = await (await api())
      .post("/api/v1/books")
      .set(session.headers)
      .send({
        title: "The Hidden Library",
        subtitle: "A History",
        authors: ["Ada Lovelace", "Alan Turing"],
        isbn13: "9781234567897",
        isbn10: "123456789X",
        publisher: "Analytical Press",
        publishedYear: 2020,
        language: "en",
        pages: 320,
        description: "The story of libraries.",
        categories: ["History", "Science"],
        tags: ["classic"],
        dewey: "005.1",
      });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.title).toBe("The Hidden Library");
    expect(res.body.authors).toEqual(["Ada Lovelace", "Alan Turing"]);
    expect(res.body.categories).toEqual(["History", "Science"]);
    expect(res.body.status).toBe("active");

    const get = await (await api()).get(`/api/v1/books/${res.body.id}`).set(session.headers);
    expect(get.status).toBe(200);
    expect(get.body.copiesTotal).toBe(0);
    expect(get.body.copies).toEqual([]);
  });

  it("validates the create payload", async () => {
    const bad = await (await api()).post("/api/v1/books").set(session.headers).send({});
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("validation_failed");

    const badYear = await (await api())
      .post("/api/v1/books")
      .set(session.headers)
      .send({ title: "Future Book", publishedYear: 3000 });
    expect(badYear.status).toBe(400);

    const badAuthor = await (await api())
      .post("/api/v1/books")
      .set(session.headers)
      .send({ title: "Whitespace Author", authors: ["   "] });
    expect(badAuthor.status).toBe(400);
  });

  it("lists, searches and filters the catalog", async () => {
    await createBook(session.token, { title: "Alpha Tales", categories: ["Fiction"] });
    await createBook(session.token, { title: "Beta Science", categories: ["Science"] });
    await createBook(session.token, {
      title: "Gamma Tales",
      categories: ["Fiction"],
      authors: ["Zelda Fitzgerald"],
    });

    const all = await (await api()).get("/api/v1/books").set(session.headers);
    expect(all.status).toBe(200);
    expect(all.body.meta.total).toBe(3);

    const search = await (await api())
      .get("/api/v1/books?q=tales")
      .set(session.headers);
    expect(search.body.items.map((row: { title: string }) => row.title).sort()).toEqual([
      "Alpha Tales",
      "Gamma Tales",
    ]);

    const authorSearch = await (await api())
      .get("/api/v1/books?q=zelda")
      .set(session.headers);
    expect(authorSearch.body.items).toHaveLength(1);
    expect(authorSearch.body.items[0].title).toBe("Gamma Tales");

    const filtered = await (await api())
      .get("/api/v1/books?category=Fiction")
      .set(session.headers);
    expect(filtered.body.meta.total).toBe(2);

    const paged = await (await api()).get("/api/v1/books?perPage=2").set(session.headers);
    expect(paged.body.items).toHaveLength(2);
    expect(paged.body.meta.total).toBe(3);

    const sorted = await (await api()).get("/api/v1/books?sort=title").set(session.headers);
    expect(sorted.body.items[0].title).toBe("Alpha Tales");

    const categories = await (await api()).get("/api/v1/books/categories").set(session.headers);
    expect(categories.status).toBe(200);
    expect(categories.body.sort()).toEqual(["Fiction", "Science"]);
  });

  it("updates books and archives them", async () => {
    const book = await createBook(session.token, { title: "Draft Title", categories: ["Old"] });

    const patched = await (await api())
      .patch(`/api/v1/books/${book.id}`)
      .set(session.headers)
      .send({ title: "Final Title", categories: ["New", "Improved"] });
    expect(patched.status).toBe(200);
    expect(patched.body.title).toBe("Final Title");
    expect(patched.body.categories).toEqual(["New", "Improved"]);

    const archived = await (await api())
      .post(`/api/v1/books/${book.id}/status`)
      .set(session.headers)
      .send({ status: "archived" });
    expect(archived.status).toBe(201);
    expect(archived.body.status).toBe("archived");

    const defaultList = await (await api()).get("/api/v1/books").set(session.headers);
    expect(defaultList.body.meta.total).toBe(0);

    const archivedList = await (await api())
      .get("/api/v1/books?status=archived")
      .set(session.headers);
    expect(archivedList.body.meta.total).toBe(1);

    const quickSearch = await (await api())
      .get("/api/v1/books/search?q=Final")
      .set(session.headers);
    expect(quickSearch.body).toHaveLength(0);
  });

  it("rejects duplicate ISBNs", async () => {
    await createBook(session.token, { title: "First Edition", isbn13: "9789876543210" });
    const dup = await (await api())
      .post("/api/v1/books")
      .set(session.headers)
      .send({ title: "Second Edition", isbn13: "9789876543210" });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("isbn_taken");
  });

  it("manages copies through their lifecycle", async () => {
    const book = await createBook(session.token, { title: "Copy Test" });

    const created = await addCopies(session.token, book.id, branchId, 3);
    expect(created).toHaveLength(3);
    expect(created.every((copy) => copy.status === "available")).toBe(true);

    const mismatch = await (await api())
      .post(`/api/v1/books/${book.id}/copies`)
      .set(session.headers)
      .send({ branchId, count: 3, barcodes: ["ONE"] });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.error.code).toBe("barcode_count_mismatch");

    const named = await (await api())
      .post(`/api/v1/books/${book.id}/copies`)
      .set(session.headers)
      .send({ branchId, count: 1, barcodes: ["CUSTOM-001"], location: "Shelf A" });
    expect(named.status).toBe(201);
    expect(named.body[0].barcode).toBe("CUSTOM-001");

    const duplicate = await (await api())
      .post(`/api/v1/books/${book.id}/copies`)
      .set(session.headers)
      .send({ branchId, count: 1, barcodes: ["CUSTOM-001"] });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("barcode_taken");

    const list = await (await api())
      .get(`/api/v1/books/${book.id}/copies`)
      .set(session.headers);
    expect(list.body).toHaveLength(4);

    const copy = created[0];
    const patched = await (await api())
      .patch(`/api/v1/copies/${copy.id}`)
      .set(session.headers)
      .send({ condition: "Worn", location: "A-12", priceCents: 500 });
    expect(patched.status).toBe(200);
    expect(patched.body.condition).toBe("Worn");

    const withdrawn = await (await api())
      .delete(`/api/v1/copies/${copy.id}`)
      .set(session.headers);
    expect(withdrawn.status).toBe(204);

    const after = await (await api())
      .get(`/api/v1/books/${book.id}/copies`)
      .set(session.headers);
    const withdrawnCopy = after.body.find((row: { id: string }) => row.id === copy.id);
    expect(withdrawnCopy.status).toBe("withdrawn");

    const bookAfter = await (await api()).get(`/api/v1/books/${book.id}`).set(session.headers);
    expect(bookAfter.body.copiesTotal).toBe(4);
    expect(bookAfter.body.copiesAvailable).toBe(3);
  });

  it("isolates catalogs across tenants", async () => {
    const book = await createBook(session.token, { title: "Tenant Private" });
    const other = await registerTenant();

    const get = await (await api()).get(`/api/v1/books/${book.id}`).set(other.headers);
    expect(get.status).toBe(404);
    expect(get.body.error.code).toBe("book_not_found");

    const list = await (await api()).get("/api/v1/books").set(other.headers);
    expect(list.body.meta.total).toBe(0);

    const search = await (await api())
      .get(`/api/v1/books/search?q=${encodeURIComponent("Tenant Private")}`)
      .set(other.headers);
    expect(search.body).toHaveLength(0);
  });

  it("validates ISBN lookup input", async () => {
    const bad = await (await api()).get("/api/v1/books/isbn/not-an-isbn").set(session.headers);
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("validation_failed");
  });
});
