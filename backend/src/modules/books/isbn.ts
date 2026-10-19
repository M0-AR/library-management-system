interface OpenLibraryEdition {
  title?: string;
  subtitle?: string;
  publishers?: string[];
  publish_date?: string;
  number_of_pages?: number;
  covers?: number[];
  authors?: { key: string }[];
  works?: { key: string }[];
  description?: string | { value?: string };
}

interface GoogleBooksVolume {
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    categories?: string[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    industryIdentifiers?: { type: string; identifier: string }[];
  };
}

export interface IsbnLookupResult {
  title: string;
  subtitle: string | null;
  authors: string[];
  publisher: string | null;
  publishedYear: number | null;
  pages: number | null;
  description: string | null;
  coverUrl: string | null;
  categories: string[];
  isbn13: string | null;
  isbn10: string | null;
  source: "google_books" | "open_library";
}

export function normalizeIsbn(raw: string): string {
  return raw.replace(/[-\s]/g, "").toUpperCase();
}

export function isValidIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i += 1) {
    const char = isbn[i];
    const value = char === "X" ? 10 : Number(char);
    sum += value * (10 - i);
  }
  return sum % 11 === 0;
}

export function isValidIsbn13(isbn: string): boolean {
  if (!/^\d{13}$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i += 1) {
    sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return sum % 10 === 0;
}

export function isbn10To13(isbn10: string): string | null {
  if (!isValidIsbn10(isbn10)) return null;
  const core = `978${isbn10.slice(0, 9)}`;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return `${core}${check}`;
}

export function isbn13To10(isbn13: string): string | null {
  if (!isValidIsbn13(isbn13) || !isbn13.startsWith("978")) return null;
  const core = isbn13.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += Number(core[i]) * (10 - i);
  }
  const remainder = (11 - (sum % 11)) % 11;
  const check = remainder === 10 ? "X" : String(remainder);
  return `${core}${check}`;
}

export function parsePublishedYear(value: string | undefined | null): number | null {
  if (!value) return null;
  const match = value.match(/\d{4}/);
  if (!match) return null;
  const year = Number(match[0]);
  return year >= 1000 && year <= 2100 ? year : null;
}

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "user-agent": "LibraryManagementSystem/1.0 (isbn-lookup)",
        accept: "application/json",
      },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function lookupGoogleBooks(isbn: string): Promise<IsbnLookupResult | null> {
  const data = await fetchJson<{ items?: GoogleBooksVolume[] }>(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&maxResults=1`,
  );
  const info = data?.items?.[0]?.volumeInfo;
  if (!info?.title) return null;

  const identifiers = info.industryIdentifiers ?? [];
  const isbn13 =
    identifiers.find((entry) => entry.type === "ISBN_13")?.identifier ??
    (isbn.length === 13 ? isbn : null);
  const isbn10 =
    identifiers.find((entry) => entry.type === "ISBN_10")?.identifier ??
    (isbn.length === 10 ? isbn : null);

  const cover = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null;

  return {
    title: info.title,
    subtitle: info.subtitle ?? null,
    authors: info.authors?.slice(0, 20) ?? [],
    publisher: info.publisher ?? null,
    publishedYear: parsePublishedYear(info.publishedDate),
    pages: info.pageCount ?? null,
    description: info.description ?? null,
    coverUrl: cover ? cover.replace(/^http:/, "https:") : null,
    categories: info.categories?.slice(0, 20) ?? [],
    isbn13,
    isbn10,
    source: "google_books",
  };
}

async function lookupOpenLibrary(isbn: string): Promise<IsbnLookupResult | null> {
  const edition = await fetchJson<OpenLibraryEdition>(
    `https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`,
  );
  if (!edition?.title) return null;

  let authors: string[] = [];
  if (edition.authors?.length) {
    const names = await Promise.all(
      edition.authors.slice(0, 20).map(async (author) => {
        const record = await fetchJson<{ name?: string }>(`https://openlibrary.org${author.key}.json`);
        return record?.name ?? null;
      }),
    );
    authors = names.filter((name): name is string => Boolean(name));
  }

  let description: string | null = null;
  if (typeof edition.description === "string") {
    description = edition.description;
  } else if (edition.description?.value) {
    description = edition.description.value;
  }

  const coverId = edition.covers?.find((id) => id > 0);
  const normalized = normalizeIsbn(isbn);
  return {
    title: edition.title,
    subtitle: edition.subtitle ?? null,
    authors,
    publisher: edition.publishers?.[0] ?? null,
    publishedYear: parsePublishedYear(edition.publish_date),
    pages: edition.number_of_pages ?? null,
    description,
    coverUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null,
    categories: [],
    isbn13: normalized.length === 13 ? normalized : null,
    isbn10: normalized.length === 10 ? normalized : null,
    source: "open_library",
  };
}

export async function lookupIsbn(rawIsbn: string): Promise<IsbnLookupResult | null> {
  const isbn = normalizeIsbn(rawIsbn);
  const valid =
    (isbn.length === 10 && isValidIsbn10(isbn)) || (isbn.length === 13 && isValidIsbn13(isbn));
  if (!valid) return null;

  const google = await lookupGoogleBooks(isbn);
  if (google) {
    if (!google.isbn13 && isbn.length === 10) google.isbn13 = isbn10To13(isbn);
    if (!google.isbn10 && isbn.length === 13) google.isbn10 = isbn13To10(isbn);
    return google;
  }
  const openLibrary = await lookupOpenLibrary(isbn);
  if (openLibrary) {
    if (!openLibrary.isbn13 && isbn.length === 10) openLibrary.isbn13 = isbn10To13(isbn);
    if (!openLibrary.isbn10 && isbn.length === 13) openLibrary.isbn10 = isbn13To10(isbn);
    return openLibrary;
  }
  return null;
}
