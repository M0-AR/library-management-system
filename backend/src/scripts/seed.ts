import { and, eq, inArray, isNull, sql as dsql } from "drizzle-orm";
import { closeDb, initDb, withTenantContext } from "../db/client";
import type { Db } from "../db/client";
import {
  auditLogs,
  books,
  branches,
  copies,
  domains,
  fines,
  holds,
  loans,
  members,
  notifications,
  tenants,
  users,
} from "../db/schema";
import type {
  BookStatus,
  CopyStatus,
  FineStatus,
  FineType,
  HoldStatus,
  LoanStatus,
  Tenant,
  TenantPlan,
} from "../db/schema";
import { hashPassword } from "../modules/auth/password";
import { DEFAULT_TENANT_SETTINGS } from "../modules/tenants/tenant-settings";
import { env } from "../env";

const DEMO_PASSWORD = "Password123!";

interface TenantSeed {
  slug: string;
  name: string;
  plan: TenantPlan;
  primaryColor: string;
  accentColor: string;
  tagline: string;
  domain: string;
}

const RIVERSIDE: TenantSeed = {
  slug: "riverside",
  name: "Riverside Public Library",
  plan: "growth",
  primaryColor: "#4f46e5",
  accentColor: "#0ea5e9",
  tagline: "Books for everyone on the riverfront",
  domain: "riverside.localhost",
};

const LAKESIDE: TenantSeed = {
  slug: "lakeside",
  name: "Lakeside Community Library",
  plan: "starter",
  primaryColor: "#0f766e",
  accentColor: "#f59e0b",
  tagline: "Your window on the lake",
  domain: "lakeside.localhost",
};

interface BookSeed {
  title: string;
  subtitle?: string;
  authors: string[];
  isbn13?: string | null;
  isbn10?: string;
  publisher: string;
  publishedYear: number;
  pages: number;
  language?: string;
  categories: string[];
  description: string;
  copies: number;
  status?: BookStatus;
}

const RIVERSIDE_BOOKS: BookSeed[] = [
  { title: "Pride and Prejudice", authors: ["Jane Austen"], isbn13: "9780141439518", publisher: "Penguin Classics", publishedYear: 2003, pages: 480, categories: ["Fiction", "Classics"], description: "Elizabeth Bennet navigates courtship, class and family in Regency England.", copies: 3 },
  { title: "To Kill a Mockingbird", authors: ["Harper Lee"], isbn13: "9780061120084", publisher: "Harper Perennial", publishedYear: 2006, pages: 336, categories: ["Fiction", "Classics"], description: "A young girl's view of racial injustice in a small Alabama town.", copies: 3 },
  { title: "1984", authors: ["George Orwell"], isbn13: "9780451524935", publisher: "Signet Classics", publishedYear: 1961, pages: 328, categories: ["Fiction", "Science Fiction"], description: "Winston Smith rebels against a totalitarian regime that rewrites history.", copies: 3 },
  { title: "The Great Gatsby", authors: ["F. Scott Fitzgerald"], isbn13: "9780743273565", publisher: "Scribner", publishedYear: 2004, pages: 180, categories: ["Fiction", "Classics"], description: "Jay Gatsby's doomed pursuit of the American Dream in the Jazz Age.", copies: 2 },
  { title: "The Catcher in the Rye", authors: ["J. D. Salinger"], isbn13: "9780316769488", publisher: "Little, Brown", publishedYear: 2001, pages: 288, categories: ["Fiction", "Classics"], description: "Holden Caulfield drifts through New York after being expelled from school.", copies: 2 },
  { title: "Brave New World", authors: ["Aldous Huxley"], isbn13: "9780060850524", publisher: "Harper Perennial", publishedYear: 2006, pages: 288, categories: ["Fiction", "Science Fiction"], description: "A engineered utopia where comfort has replaced freedom.", copies: 2 },
  { title: "Dune", authors: ["Frank Herbert"], isbn13: "9780441013593", publisher: "Ace", publishedYear: 2005, pages: 704, categories: ["Science Fiction"], description: "Paul Atreides rises amid spice, prophecy and empire on the desert planet Arrakis.", copies: 2 },
  { title: "Foundation", authors: ["Isaac Asimov"], isbn13: "9780553293357", publisher: "Spectra", publishedYear: 1991, pages: 296, categories: ["Science Fiction"], description: "Psychohistory guides a foundation to shorten a galactic dark age.", copies: 2 },
  { title: "The Hitchhiker's Guide to the Galaxy", authors: ["Douglas Adams"], isbn13: "9780345391803", publisher: "Del Rey", publishedYear: 1995, pages: 224, categories: ["Science Fiction", "Humor"], description: "Arthur Dent is swept off Earth moments before its demolition.", copies: 2 },
  { title: "The Hobbit", authors: ["J. R. R. Tolkien"], isbn13: "9780547928227", publisher: "Mariner Books", publishedYear: 2012, pages: 300, categories: ["Fantasy", "Fiction"], description: "Bilbo Baggins sets out on an unexpected journey to reclaim a dragon's hoard.", copies: 3 },
  { title: "The Fellowship of the Ring", authors: ["J. R. R. Tolkien"], isbn13: "9780547928210", publisher: "Mariner Books", publishedYear: 2012, pages: 432, categories: ["Fantasy", "Fiction"], description: "A hobbit inherits a ring that must be destroyed in the fires of Mordor.", copies: 2 },
  { title: "Fahrenheit 451", authors: ["Ray Bradbury"], isbn13: "9781451673319", publisher: "Simon & Schuster", publishedYear: 2012, pages: 256, categories: ["Science Fiction", "Classics"], description: "A fireman who burns books begins to question his work.", copies: 2 },
  { title: "The Martian", authors: ["Andy Weir"], isbn13: "9780553418026", publisher: "Broadway Books", publishedYear: 2014, pages: 384, categories: ["Science Fiction", "Adventure"], description: "An astronaut must science his way out of being stranded on Mars.", copies: 2 },
  { title: "Sapiens: A Brief History of Humankind", authors: ["Yuval Noah Harari"], isbn13: "9780062316097", publisher: "Harper", publishedYear: 2015, pages: 464, categories: ["History", "Science"], description: "How Homo sapiens came to dominate the planet.", copies: 3 },
  { title: "Educated", authors: ["Tara Westover"], isbn13: "9780399590504", publisher: "Random House", publishedYear: 2018, pages: 352, categories: ["Biography", "Memoir"], description: "A memoir of self-invention, from survivalist childhood to Cambridge doctorate.", copies: 2 },
  { title: "The Immortal Life of Henrietta Lacks", authors: ["Rebecca Skloot"], isbn13: "9781400052189", publisher: "Broadway Books", publishedYear: 2011, pages: 400, categories: ["Science", "Biography"], description: "The story of HeLa cells and the woman behind them.", copies: 2 },
  { title: "A Brief History of Time", authors: ["Stephen Hawking"], isbn13: "9780553380163", publisher: "Bantam", publishedYear: 1998, pages: 212, categories: ["Science"], description: "Black holes, the Big Bang and the nature of time, for everyone.", copies: 2 },
  { title: "Cosmos", authors: ["Carl Sagan"], isbn13: "9780345539434", publisher: "Ballantine Books", publishedYear: 2013, pages: 396, categories: ["Science"], description: "A tour of fourteen billion years of cosmic evolution.", copies: 2 },
  { title: "The Diary of a Young Girl", authors: ["Anne Frank"], isbn13: "9780553296983", publisher: "Bantam", publishedYear: 1993, pages: 283, categories: ["Biography", "History"], description: "Anne Frank's diary written while hiding from the Nazis in Amsterdam.", copies: 2 },
  { title: "Long Walk to Freedom", authors: ["Nelson Mandela"], isbn13: "9780316548182", publisher: "Back Bay Books", publishedYear: 1995, pages: 656, categories: ["Biography", "History"], description: "Mandela's autobiography of struggle, prison and presidency.", copies: 2 },
  { title: "Charlotte's Web", authors: ["E. B. White"], isbn13: "9780064400558", publisher: "HarperCollins", publishedYear: 2012, pages: 192, categories: ["Children", "Fiction"], description: "A spider, a pig and the power of friendship.", copies: 3 },
  { title: "Harry Potter and the Sorcerer's Stone", authors: ["J. K. Rowling"], isbn13: "9780590353427", publisher: "Scholastic", publishedYear: 1998, pages: 309, categories: ["Children", "Fantasy"], description: "An orphan discovers he is a wizard on his eleventh birthday.", copies: 3 },
  { title: "The Little Prince", authors: ["Antoine de Saint-Exupéry"], isbn13: "9780156012195", publisher: "Harvest", publishedYear: 2000, pages: 96, categories: ["Children", "Classics"], description: "A pilot meets a small prince who travels between asteroids.", copies: 2 },
  { title: "The Silent Patient", authors: ["Alex Michaelides"], isbn13: "9781250301697", publisher: "Celadon Books", publishedYear: 2019, pages: 336, categories: ["Thriller", "Fiction"], description: "A psychotherapist investigates why a painter stopped speaking after a murder.", copies: 2 },
  { title: "Cien años de soledad", authors: ["Gabriel García Márquez"], isbn13: "9780060883287", publisher: "Harper Perennial", publishedYear: 2006, pages: 417, language: "es", categories: ["Fiction", "Classics"], description: "La saga de los Buendía en Macondo, cumbre del realismo mágico.", copies: 2 },
  { title: "The Design of Everyday Things", subtitle: "Revised and Expanded Edition", authors: ["Don Norman"], isbn13: "9780465050659", publisher: "Basic Books", publishedYear: 2013, pages: 368, categories: ["Design", "Nonfiction"], description: "Why good design is invisible and how the objects around us shape behaviour.", copies: 2 },
  { title: "The Midnight Library", authors: ["Matt Haig"], isbn13: "9781786892737", publisher: "Canongate Books", publishedYear: 2020, pages: 304, categories: ["Fiction", "Fantasy"], description: "Between life and death, Nora Seed explores the lives she might have lived.", copies: 5 },
  { title: "Zen and the Art of Motorcycle Maintenance", authors: ["Robert M. Pirsig"], isbn13: null, isbn10: "0688002307", publisher: "William Morrow", publishedYear: 1974, pages: 412, categories: ["Philosophy", "Memoir"], description: "A father-son road trip becomes an inquiry into quality and values.", copies: 1 },
  { title: "The Pragmatic Programmer", subtitle: "Your Journey to Mastery, 20th Anniversary Edition", authors: ["David Thomas", "Andrew Hunt"], isbn13: "9780135957059", publisher: "Addison-Wesley", publishedYear: 2019, pages: 352, categories: ["Technology", "Nonfiction"], description: "Timeless advice on the craft of software development.", copies: 2 },
  { title: "The Computer Encyclopedia", authors: ["Meridian Editorial Board"], isbn13: null, publisher: "Meridian Press", publishedYear: 1998, pages: 1120, categories: ["Reference"], description: "A pre-millennium reference work on computing, now superseded.", copies: 1, status: "archived" },
];

const LAKESIDE_BOOKS: BookSeed[] = [
  { title: "The Old Man and the Sea", authors: ["Ernest Hemingway"], isbn13: "9780684801223", publisher: "Scribner", publishedYear: 1995, pages: 128, categories: ["Fiction", "Classics"], description: "Santiago's lonely battle with a giant marlin on the Gulf Stream.", copies: 2 },
  { title: "Walden", authors: ["Henry David Thoreau"], isbn13: "9780486284958", publisher: "Dover Publications", publishedYear: 1995, pages: 224, categories: ["Philosophy", "Nature"], description: "Two years of simple living by a Massachusetts pond.", copies: 2 },
  { title: "The River Why", authors: ["David James Duncan"], isbn13: "9780316182845", publisher: "Back Bay Books", publishedYear: 2016, pages: 432, categories: ["Fiction", "Nature"], description: "A young fly-fisherman searches for meaning along Oregon rivers.", copies: 2 },
  { title: "Paddle-to-the-Sea", authors: ["Holling C. Holling"], isbn13: "9780395150825", publisher: "HMH Books", publishedYear: 1969, pages: 64, categories: ["Children", "Geography"], description: "A carved canoe journeys from Lake Nipigon to the Atlantic.", copies: 2 },
  { title: "The Wind in the Willows", authors: ["Kenneth Grahame"], isbn13: "9780143039099", publisher: "Penguin Classics", publishedYear: 2005, pages: 240, categories: ["Children", "Classics"], description: "Mole, Rat, Badger and Toad on the riverbank.", copies: 2 },
];

const COPY_OVERRIDES: Array<{
  title: string;
  copyIndex: number;
  status: CopyStatus;
  condition?: string;
  notes: string;
}> = [
  { title: "The Catcher in the Rye", copyIndex: 1, status: "lost", notes: "Reported lost; replacement copy billed to the member" },
  { title: "Brave New World", copyIndex: 1, status: "damaged", condition: "fair", notes: "Water damage on pages 40-52; under assessment" },
  { title: "The Computer Encyclopedia", copyIndex: 0, status: "withdrawn", notes: "Superseded by the online reference shelf; pending disposal" },
];

const RIVERSIDE_LOANS: Array<{
  title: string;
  copyIndex?: number;
  memberIndex: number;
  status: LoanStatus;
  checkedOutDaysAgo: number;
  dueInDays: number;
  returnedDaysAgo?: number;
  renewedCount?: number;
}> = [
  { title: "1984", memberIndex: 2, status: "active", checkedOutDaysAgo: 5, dueInDays: 9 },
  { title: "Dune", copyIndex: 0, memberIndex: 2, status: "active", checkedOutDaysAgo: 8, dueInDays: 6 },
  { title: "Dune", copyIndex: 1, memberIndex: 3, status: "active", checkedOutDaysAgo: 12, dueInDays: 2 },
  { title: "The Hobbit", memberIndex: 0, status: "active", checkedOutDaysAgo: 9, dueInDays: 12, renewedCount: 1 },
  { title: "The Little Prince", copyIndex: 0, memberIndex: 0, status: "active", checkedOutDaysAgo: 11, dueInDays: 3 },
  { title: "The Little Prince", copyIndex: 1, memberIndex: 3, status: "active", checkedOutDaysAgo: 7, dueInDays: 7 },
  { title: "Sapiens: A Brief History of Humankind", memberIndex: 3, status: "overdue", checkedOutDaysAgo: 16, dueInDays: -2 },
  { title: "The Midnight Library", memberIndex: 1, status: "overdue", checkedOutDaysAgo: 20, dueInDays: -6 },
  { title: "The Silent Patient", memberIndex: 0, status: "returned", checkedOutDaysAgo: 26, dueInDays: -12, returnedDaysAgo: 12 },
  { title: "Educated", memberIndex: 1, status: "returned", checkedOutDaysAgo: 40, dueInDays: -28, returnedDaysAgo: 28 },
];

const RIVERSIDE_HOLDS: Array<{
  title: string;
  memberIndex: number;
  status: HoldStatus;
  placedDaysAgo: number;
  readyDaysAgo?: number;
  expiresInDays?: number;
  reserveFirstCopy?: boolean;
}> = [
  { title: "Foundation", memberIndex: 0, status: "ready", placedDaysAgo: 4, readyDaysAgo: 1, expiresInDays: 2, reserveFirstCopy: true },
  { title: "The Little Prince", memberIndex: 1, status: "pending", placedDaysAgo: 5 },
  { title: "The Little Prince", memberIndex: 2, status: "pending", placedDaysAgo: 2 },
  { title: "The Martian", memberIndex: 3, status: "fulfilled", placedDaysAgo: 40, readyDaysAgo: 32, expiresInDays: -25 },
  { title: "Cosmos", memberIndex: 2, status: "cancelled", placedDaysAgo: 15 },
  { title: "The Silent Patient", memberIndex: 2, status: "expired", placedDaysAgo: 34, readyDaysAgo: 24, expiresInDays: -17 },
];

const RIVERSIDE_FINES: Array<{
  memberIndex: number;
  loanKey?: string;
  type: FineType;
  amountCents: number;
  status: FineStatus;
  note: string;
  createdDaysAgo: number;
  paidDaysAgo?: number;
}> = [
  { memberIndex: 3, loanKey: "Sapiens: A Brief History of Humankind#3", type: "overdue", amountCents: 50, status: "outstanding", note: "2 days overdue at 25¢/day", createdDaysAgo: 1 },
  { memberIndex: 1, loanKey: "The Midnight Library#1", type: "overdue", amountCents: 150, status: "outstanding", note: "6 days overdue at 25¢/day", createdDaysAgo: 2 },
  { memberIndex: 3, type: "lost", amountCents: 1800, status: "outstanding", note: "Replacement copy for The Catcher in the Rye", createdDaysAgo: 120 },
  { memberIndex: 0, type: "manual", amountCents: 100, status: "paid", note: "Settled at the circulation desk", createdDaysAgo: 30, paidDaysAgo: 10 },
  { memberIndex: 2, type: "damaged", amountCents: 300, status: "waived", note: "Small water stain; waived as first-time courtesy", createdDaysAgo: 8 },
];

const RIVERSIDE_NOTIFICATIONS: Array<{
  memberIndex: number;
  template: string;
  channel: "email" | "sms" | "in_app";
  subject: string;
  body: string;
  status: "queued" | "sent" | "failed";
  createdDaysAgo: number;
  sentDaysAgo?: number;
  error?: string;
  loanKey?: string;
}> = [
  { memberIndex: 0, template: "hold_ready", channel: "email", subject: "Your hold is ready: Foundation", body: "Foundation is waiting for you at Main Library. Please collect it within 3 days.", status: "sent", createdDaysAgo: 1, sentDaysAgo: 1 },
  { memberIndex: 3, template: "due_soon", channel: "email", subject: "Almost due: Dune", body: "Dune is due in 2 days. Renew online or return it to the library to avoid a fine.", status: "sent", createdDaysAgo: 0.5, sentDaysAgo: 0.5, loanKey: "Dune#3" },
  { memberIndex: 3, template: "overdue", channel: "email", subject: "Overdue: Sapiens: A Brief History of Humankind", body: "Sapiens: A Brief History of Humankind is 2 days overdue. A fine of 25¢ per day is accruing.", status: "sent", createdDaysAgo: 1, sentDaysAgo: 1, loanKey: "Sapiens: A Brief History of Humankind#3" },
  { memberIndex: 1, template: "overdue", channel: "email", subject: "Overdue: The Midnight Library", body: "The Midnight Library is 6 days overdue. Please return it to the library.", status: "failed", createdDaysAgo: 1, error: "SMTP timeout (upside-down)", loanKey: "The Midnight Library#1" },
  { memberIndex: 0, template: "welcome", channel: "email", subject: "Welcome to Riverside Public Library", body: "Your membership M100001 is active. Browse the catalogue and place your first hold today.", status: "queued", createdDaysAgo: 0.2 },
];

const RIVERSIDE_AUDIT: Array<{
  action: string;
  entityType: string;
  entityRef?: "tenant" | "duneBook" | "hobbitLoan" | "littlePrinceHold" | "priyaMember" | "midnightCopy" | "damagedFine";
  actor: "admin" | "librarian";
  daysAgo: number;
  ip: string;
  metadata?: Record<string, unknown>;
}> = [
  { action: "tenant.registered", entityType: "tenant", entityRef: "tenant", actor: "admin", daysAgo: 420, ip: "203.0.113.10", metadata: { slug: "riverside" } },
  { action: "branch.created", entityType: "branch", actor: "admin", daysAgo: 419, ip: "203.0.113.10", metadata: { code: "MAIN" } },
  { action: "branch.created", entityType: "branch", actor: "admin", daysAgo: 380, ip: "203.0.113.10", metadata: { code: "EAST" } },
  { action: "book.created", entityType: "book", entityRef: "duneBook", actor: "admin", daysAgo: 300, ip: "203.0.113.10", metadata: { title: "Dune" } },
  { action: "user.created", entityType: "user", actor: "admin", daysAgo: 210, ip: "203.0.113.10", metadata: { email: "marcus@example.com", role: "patron" } },
  { action: "member.created", entityType: "member", entityRef: "priyaMember", actor: "admin", daysAgo: 600, ip: "203.0.113.10", metadata: { cardNumber: "M100005" } },
  { action: "copy.created", entityType: "copy", entityRef: "midnightCopy", actor: "librarian", daysAgo: 90, ip: "203.0.113.22", metadata: { title: "The Midnight Library" } },
  { action: "book.updated", entityType: "book", actor: "librarian", daysAgo: 30, ip: "203.0.113.22", metadata: { fields: ["publisher"] } },
  { action: "hold.placed", entityType: "hold", entityRef: "littlePrinceHold", actor: "librarian", daysAgo: 5, ip: "203.0.113.22" },
  { action: "loan.checkout", entityType: "loan", entityRef: "hobbitLoan", actor: "librarian", daysAgo: 9, ip: "203.0.113.22" },
  { action: "fine.waived", entityType: "fine", entityRef: "damagedFine", actor: "admin", daysAgo: 6, ip: "203.0.113.10" },
  { action: "tenant.settings_updated", entityType: "tenant", entityRef: "tenant", actor: "admin", daysAgo: 7, ip: "203.0.113.10" },
  { action: "auth.login", entityType: "user", actor: "librarian", daysAgo: 1, ip: "203.0.113.22" },
];

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createBarcodeFactory(): () => string {
  const rng = mulberry32(0x4c4d53);
  let counter = 0;
  return () => {
    counter += 1;
    const suffix = Math.floor(rng() * 36 ** 2)
      .toString(36)
      .toUpperCase()
      .padStart(2, "0");
    return `BC${String(counter).padStart(6, "0")}${suffix}`;
  };
}

function isoDate(offsetDays: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function tenantSettings(cfg: TenantSeed): Record<string, unknown> {
  return {
    ...DEFAULT_TENANT_SETTINGS,
    branding: {
      ...DEFAULT_TENANT_SETTINGS.branding,
      name: cfg.name,
      primaryColor: cfg.primaryColor,
      accentColor: cfg.accentColor,
    },
    opac: {
      ...DEFAULT_TENANT_SETTINGS.opac,
      enabled: true,
      tagline: cfg.tagline,
    },
  };
}

async function resetSeedData(): Promise<void> {
  await withTenantContext({ isPlatformAdmin: true, platformLogin: true }, async (db) => {
    await db.delete(tenants).where(inArray(tenants.slug, [RIVERSIDE.slug, LAKESIDE.slug]));
  });
}

async function ensurePlatformAdmin(passwordHash: string) {
  return withTenantContext({ isPlatformAdmin: true, platformLogin: true }, async (db) => {
    const existing = await db
      .select()
      .from(users)
      .where(and(isNull(users.tenantId), eq(dsql`lower(${users.email})`, "platform@lms.test")))
      .limit(1);
    if (existing[0]) return existing[0];
    const [created] = await db
      .insert(users)
      .values({
        tenantId: null,
        email: "platform@lms.test",
        passwordHash,
        name: "Platform Admin",
        role: "platform_admin",
      })
      .returning();
    return created;
  });
}

async function ensureTenant(cfg: TenantSeed): Promise<Tenant> {
  return withTenantContext({ isPlatformAdmin: true, platformLogin: true }, async (db) => {
    const existing = await db.select().from(tenants).where(eq(tenants.slug, cfg.slug)).limit(1);
    if (existing[0]) return existing[0];
    const [created] = await db
      .insert(tenants)
      .values({
        slug: cfg.slug,
        name: cfg.name,
        status: "active",
        plan: cfg.plan,
        settings: tenantSettings(cfg),
      })
      .returning();
    return created;
  });
}

interface SeedOutcome {
  seeded: boolean;
}

async function seedBooksAndCopies(
  db: Db,
  tenantId: string,
  bookSeeds: BookSeed[],
  branchIds: { main: string; secondary: string },
  nextBarcode: () => string,
): Promise<{
  copiesByTitle: Map<string, Array<{ id: string; bookId: string; branchId: string; barcode: string }>>;
  bookIdByTitle: Map<string, string>;
  copies: number;
}> {
  const copiesByTitle = new Map<string, Array<{ id: string; bookId: string; branchId: string; barcode: string }>>();
  const bookIdByTitle = new Map<string, string>();
  let copyCount = 0;
  for (const seed of bookSeeds) {
    const [book] = await db
      .insert(books)
      .values({
        tenantId,
        title: seed.title,
        subtitle: seed.subtitle ?? null,
        authors: seed.authors,
        isbn13: seed.isbn13 ?? null,
        isbn10: seed.isbn10 ?? null,
        publisher: seed.publisher,
        publishedYear: seed.publishedYear,
        language: seed.language ?? "en",
        pages: seed.pages,
        categories: seed.categories,
        description: seed.description,
        status: seed.status ?? "active",
      })
      .returning();
    bookIdByTitle.set(seed.title, book.id);
    const bookCopies: Array<{ id: string; bookId: string; branchId: string; barcode: string }> = [];
    for (let i = 0; i < seed.copies; i += 1) {
      const branchId = seed.copies > 1 && i === seed.copies - 1 ? branchIds.secondary : branchIds.main;
      const barcode = nextBarcode();
      const shelf = seed.categories[0].toUpperCase().slice(0, 3);
      const [copy] = await db
        .insert(copies)
        .values({
          tenantId,
          bookId: book.id,
          branchId,
          barcode,
          status: "available",
          condition: copyCount % 5 === 0 ? "fair" : "good",
          location: `${shelf}-${String(i + 1).padStart(2, "0")}`,
          acquiredAt: isoDate(-500),
          priceCents: 1499 + (copyCount % 7) * 100,
        })
        .returning();
      bookCopies.push({ id: copy.id, bookId: book.id, branchId, barcode });
      copyCount += 1;
    }
    copiesByTitle.set(seed.title, bookCopies);
  }
  return { copiesByTitle, bookIdByTitle, copies: copyCount };
}

async function seedRiverside(
  db: Db,
  tenant: Tenant,
  passwordHash: string,
  nextBarcode: () => string,
): Promise<SeedOutcome> {
  const [existing] = await db
    .select({ total: dsql<number>`count(*)::int` })
    .from(copies)
    .where(eq(copies.tenantId, tenant.id));
  if ((existing?.total ?? 0) > 0) {
    return { seeded: false };
  }

  const [mainBranch] = await db
    .insert(branches)
    .values({
      tenantId: tenant.id,
      name: "Main Library",
      code: "MAIN",
      address: "1 Riverside Plaza, River City",
      phone: "+1 555 010 1000",
    })
    .returning();
  const [eastBranch] = await db
    .insert(branches)
    .values({
      tenantId: tenant.id,
      name: "Eastside Branch",
      code: "EAST",
      address: "88 Harbor Street, River City",
      phone: "+1 555 010 2000",
    })
    .returning();

  await db
    .insert(domains)
    .values({
      tenantId: tenant.id,
      domain: RIVERSIDE.domain,
      verificationToken: `lms-verify-${tenant.id.slice(0, 8)}`,
      status: "verified",
      verifiedAt: new Date(),
    })
    .onConflictDoNothing();

  const staffRows = await db
    .insert(users)
    .values([
      { tenantId: tenant.id, email: "admin@riverside.test", passwordHash, name: "Riley Chen", role: "tenant_admin" as const, branchId: mainBranch.id },
      { tenantId: tenant.id, email: "librarian@riverside.test", passwordHash, name: "Morgan Ortiz", role: "librarian" as const, branchId: mainBranch.id },
      { tenantId: tenant.id, email: "assistant@riverside.test", passwordHash, name: "Sam Patel", role: "assistant" as const, branchId: eastBranch.id },
    ])
    .returning();
  const adminUser = staffRows.find((row) => row.role === "tenant_admin")!;
  const librarianUser = staffRows.find((row) => row.role === "librarian")!;

  const patronRows = await db
    .insert(users)
    .values([
      { tenantId: tenant.id, email: "jane@example.com", passwordHash, name: "Jane Cooper", role: "patron" as const },
      { tenantId: tenant.id, email: "marcus@example.com", passwordHash, name: "Marcus Bell", role: "patron" as const },
      { tenantId: tenant.id, email: "sofia@example.com", passwordHash, name: "Sofia Ramirez", role: "patron" as const },
      { tenantId: tenant.id, email: "ethan@example.com", passwordHash, name: "Ethan Wright", role: "patron" as const },
    ])
    .returning();

  const memberRows = await db
    .insert(members)
    .values([
      { tenantId: tenant.id, userId: patronRows[0].id, cardNumber: "M100001", fullName: "Jane Cooper", email: "jane@example.com", phone: "+1 555 010 3001", category: "adult" as const, status: "active" as const, joinedAt: isoDate(-420), expiresAt: isoDate(300) },
      { tenantId: tenant.id, userId: patronRows[1].id, cardNumber: "M100002", fullName: "Marcus Bell", email: "marcus@example.com", phone: "+1 555 010 3002", category: "student" as const, status: "active" as const, joinedAt: isoDate(-210), expiresAt: isoDate(155) },
      { tenantId: tenant.id, userId: patronRows[2].id, cardNumber: "M100003", fullName: "Sofia Ramirez", email: "sofia@example.com", phone: "+1 555 010 3003", category: "adult" as const, status: "active" as const, joinedAt: isoDate(-90), expiresAt: isoDate(275) },
      { tenantId: tenant.id, userId: patronRows[3].id, cardNumber: "M100004", fullName: "Ethan Wright", email: "ethan@example.com", phone: "+1 555 010 3004", category: "senior" as const, status: "active" as const, joinedAt: isoDate(-800), expiresAt: isoDate(120) },
      { tenantId: tenant.id, cardNumber: "M100005", fullName: "Priya Raman", email: "priya.raman@example.com", phone: "+1 555 010 3005", category: "teacher" as const, status: "suspended" as const, joinedAt: isoDate(-600), expiresAt: isoDate(40), notes: "Suspended pending address verification" },
      { tenantId: tenant.id, cardNumber: "M100006", fullName: "Lucas Meyer", email: "lucas.meyer@example.com", category: "child" as const, status: "expired" as const, joinedAt: isoDate(-900), expiresAt: isoDate(-30), notes: "Junior membership lapsed; guardian contacted" },
    ])
    .returning();

  const { copiesByTitle, bookIdByTitle } = await seedBooksAndCopies(
    db,
    tenant.id,
    RIVERSIDE_BOOKS,
    { main: mainBranch.id, secondary: eastBranch.id },
    nextBarcode,
  );

  for (const override of COPY_OVERRIDES) {
    const copy = copiesByTitle.get(override.title)?.[override.copyIndex];
    if (!copy) continue;
    await db
      .update(copies)
      .set({
        status: override.status,
        condition: override.condition ?? "good",
        notes: override.notes,
        updatedAt: new Date(),
      })
      .where(eq(copies.id, copy.id));
  }

  const loanIdByMemberTitle = new Map<string, string>();
  const loanIdsByTitle = new Map<string, string>();
  const overdueLoanByTitle = new Map<string, string>();
  for (const seed of RIVERSIDE_LOANS) {
    const copy = copiesByTitle.get(seed.title)?.[seed.copyIndex ?? 0];
    if (!copy) continue;
    const member = memberRows[seed.memberIndex];
    const [loan] = await db
      .insert(loans)
      .values({
        tenantId: tenant.id,
        copyId: copy.id,
        bookId: copy.bookId,
        memberId: member.id,
        branchId: copy.branchId,
        checkedOutBy: adminUser.id,
        checkedOutAt: daysFromNow(-seed.checkedOutDaysAgo),
        dueAt: daysFromNow(seed.dueInDays),
        renewedCount: seed.renewedCount ?? 0,
        status: seed.status,
        returnedAt: seed.status === "returned" ? daysFromNow(-(seed.returnedDaysAgo ?? 0)) : null,
        checkedInBy: seed.status === "returned" ? adminUser.id : null,
      })
      .returning();
    loanIdByMemberTitle.set(`${seed.title}#${seed.memberIndex}`, loan.id);
    loanIdsByTitle.set(seed.title, loan.id);
    if (seed.status === "overdue") overdueLoanByTitle.set(seed.title, loan.id);
    if (seed.status !== "returned") {
      await db.update(copies).set({ status: "on_loan", updatedAt: new Date() }).where(eq(copies.id, copy.id));
    }
  }

  let readyHoldId: string | null = null;
  for (const seed of RIVERSIDE_HOLDS) {
    const copy = seed.reserveFirstCopy ? copiesByTitle.get(seed.title)?.[0] : undefined;
    if (copy) {
      await db.update(copies).set({ status: "reserved", updatedAt: new Date() }).where(eq(copies.id, copy.id));
    }
    const [hold] = await db
      .insert(holds)
      .values({
        tenantId: tenant.id,
        bookId: bookIdByTitle.get(seed.title)!,
        memberId: memberRows[seed.memberIndex].id,
        branchId: copy?.branchId ?? null,
        status: seed.status,
        placedAt: daysFromNow(-seed.placedDaysAgo),
        readyAt: seed.readyDaysAgo !== undefined ? daysFromNow(-seed.readyDaysAgo) : null,
        expiresAt: seed.expiresInDays !== undefined ? daysFromNow(seed.expiresInDays) : null,
      })
      .returning();
    if (seed.title === "The Little Prince" && seed.memberIndex === 1) {
      readyHoldId = hold.id;
    }
  }

  const fineIdsByNote = new Map<string, string>();
  for (const seed of RIVERSIDE_FINES) {
    const [fine] = await db
      .insert(fines)
      .values({
        tenantId: tenant.id,
        memberId: memberRows[seed.memberIndex].id,
        loanId: seed.loanKey ? loanIdByMemberTitle.get(seed.loanKey) ?? null : null,
        type: seed.type,
        amountCents: seed.amountCents,
        currency: "USD",
        status: seed.status,
        note: seed.note,
        createdBy: adminUser.id,
        createdAt: daysFromNow(-seed.createdDaysAgo),
        paidAt: seed.paidDaysAgo !== undefined ? daysFromNow(-seed.paidDaysAgo) : null,
      })
      .returning();
    fineIdsByNote.set(seed.note, fine.id);
  }

  for (const seed of RIVERSIDE_NOTIFICATIONS) {
    await db.insert(notifications).values({
      tenantId: tenant.id,
      memberId: memberRows[seed.memberIndex].id,
      userId: patronRows[seed.memberIndex]?.id ?? null,
      loanId: seed.loanKey ? loanIdByMemberTitle.get(seed.loanKey) ?? null : null,
      channel: seed.channel,
      template: seed.template,
      subject: seed.subject,
      body: seed.body,
      status: seed.status,
      error: seed.error ?? null,
      createdAt: daysFromNow(-seed.createdDaysAgo),
      sentAt: seed.sentDaysAgo !== undefined ? daysFromNow(-seed.sentDaysAgo) : null,
    });
  }

  const entityIds: Record<string, string | null> = {
    tenant: tenant.id,
    duneBook: bookIdByTitle.get("Dune") ?? null,
    hobbitLoan: loanIdsByTitle.get("The Hobbit") ?? null,
    littlePrinceHold: readyHoldId,
    priyaMember: memberRows[4].id,
    midnightCopy: copiesByTitle.get("The Midnight Library")?.[0]?.id ?? null,
    damagedFine: fineIdsByNote.get("Small water stain; waived as first-time courtesy") ?? null,
  };
  for (const entry of RIVERSIDE_AUDIT) {
    const actorId = entry.actor === "admin" ? adminUser.id : librarianUser.id;
    await db.insert(auditLogs).values({
      tenantId: tenant.id,
      actorUserId: actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityRef ? entityIds[entry.entityRef] ?? null : null,
      metadata: entry.metadata ?? {},
      ip: entry.ip,
      createdAt: daysFromNow(-entry.daysAgo),
    });
  }

  return { seeded: true };
}

async function seedLakeside(
  db: Db,
  tenant: Tenant,
  passwordHash: string,
  nextBarcode: () => string,
): Promise<SeedOutcome> {
  const [existing] = await db
    .select({ total: dsql<number>`count(*)::int` })
    .from(copies)
    .where(eq(copies.tenantId, tenant.id));
  if ((existing?.total ?? 0) > 0) {
    return { seeded: false };
  }

  const [central] = await db
    .insert(branches)
    .values({
      tenantId: tenant.id,
      name: "Lakeside Central",
      code: "LK01",
      address: "12 Shoreline Drive, Laketown",
      phone: "+1 555 020 1000",
    })
    .returning();

  await db
    .insert(domains)
    .values({
      tenantId: tenant.id,
      domain: LAKESIDE.domain,
      verificationToken: `lms-verify-${tenant.id.slice(0, 8)}`,
      status: "verified",
      verifiedAt: new Date(),
    })
    .onConflictDoNothing();

  const staffRows = await db
    .insert(users)
    .values([
      { tenantId: tenant.id, email: "admin@lakeside.test", passwordHash, name: "Dana Whitfield", role: "tenant_admin" as const, branchId: central.id },
      { tenantId: tenant.id, email: "librarian@lakeside.test", passwordHash, name: "Owen Brooks", role: "librarian" as const, branchId: central.id },
    ])
    .returning();
  const adminUser = staffRows.find((row) => row.role === "tenant_admin")!;

  const patronRows = await db
    .insert(users)
    .values([
      { tenantId: tenant.id, email: "nina@example.com", passwordHash, name: "Nina Alvarez", role: "patron" as const },
      { tenantId: tenant.id, email: "tom@example.com", passwordHash, name: "Tom Becker", role: "patron" as const },
    ])
    .returning();

  const memberRows = await db
    .insert(members)
    .values([
      { tenantId: tenant.id, userId: patronRows[0].id, cardNumber: "L200001", fullName: "Nina Alvarez", email: "nina@example.com", phone: "+1 555 020 3001", category: "adult" as const, status: "active" as const, joinedAt: isoDate(-260), expiresAt: isoDate(250) },
      { tenantId: tenant.id, userId: patronRows[1].id, cardNumber: "L200002", fullName: "Tom Becker", email: "tom@example.com", phone: "+1 555 020 3002", category: "senior" as const, status: "active" as const, joinedAt: isoDate(-150), expiresAt: isoDate(90) },
    ])
    .returning();

  const { copiesByTitle, bookIdByTitle } = await seedBooksAndCopies(
    db,
    tenant.id,
    LAKESIDE_BOOKS,
    { main: central.id, secondary: central.id },
    nextBarcode,
  );

  const lakeLoans: Array<{
    title: string;
    memberIndex: number;
    status: LoanStatus;
    checkedOutDaysAgo: number;
    dueInDays: number;
    returnedDaysAgo?: number;
  }> = [
    { title: "Walden", memberIndex: 0, status: "active", checkedOutDaysAgo: 9, dueInDays: 5 },
    { title: "The Old Man and the Sea", memberIndex: 1, status: "overdue", checkedOutDaysAgo: 17, dueInDays: -3 },
    { title: "Paddle-to-the-Sea", memberIndex: 0, status: "returned", checkedOutDaysAgo: 24, dueInDays: -10, returnedDaysAgo: 10 },
  ];
  const loanIdByTitle = new Map<string, string>();
  for (const seed of lakeLoans) {
    const copy = copiesByTitle.get(seed.title)?.[0];
    if (!copy) continue;
    const [loan] = await db
      .insert(loans)
      .values({
        tenantId: tenant.id,
        copyId: copy.id,
        bookId: copy.bookId,
        memberId: memberRows[seed.memberIndex].id,
        branchId: copy.branchId,
        checkedOutBy: adminUser.id,
        checkedOutAt: daysFromNow(-seed.checkedOutDaysAgo),
        dueAt: daysFromNow(seed.dueInDays),
        status: seed.status,
        returnedAt: seed.status === "returned" ? daysFromNow(-(seed.returnedDaysAgo ?? 0)) : null,
        checkedInBy: seed.status === "returned" ? adminUser.id : null,
      })
      .returning();
    loanIdByTitle.set(seed.title, loan.id);
    if (seed.status !== "returned") {
      await db.update(copies).set({ status: "on_loan", updatedAt: new Date() }).where(eq(copies.id, copy.id));
    }
  }

  await db
    .insert(holds)
    .values({
      tenantId: tenant.id,
      bookId: bookIdByTitle.get("The Wind in the Willows")!,
      memberId: memberRows[1].id,
      branchId: central.id,
      status: "pending",
      placedAt: daysFromNow(-3),
    })
    .returning();

  await db
    .insert(fines)
    .values({
      tenantId: tenant.id,
      memberId: memberRows[1].id,
      loanId: loanIdByTitle.get("The Old Man and the Sea") ?? null,
      type: "overdue",
      amountCents: 75,
      currency: "USD",
      status: "outstanding",
      note: "3 days overdue at 25¢/day",
      createdBy: adminUser.id,
      createdAt: daysFromNow(-1),
    })
    .returning();

  await db.insert(notifications).values([
    {
      tenantId: tenant.id,
      memberId: memberRows[0].id,
      userId: patronRows[0].id,
      loanId: loanIdByTitle.get("Walden") ?? null,
      channel: "email",
      template: "due_soon",
      subject: "Almost due: Walden",
      body: "Walden is due in 5 days. Renew online or return it to the library.",
      status: "sent",
      createdAt: daysFromNow(-0.5),
      sentAt: daysFromNow(-0.5),
    },
    {
      tenantId: tenant.id,
      memberId: memberRows[1].id,
      userId: patronRows[1].id,
      loanId: loanIdByTitle.get("The Old Man and the Sea") ?? null,
      channel: "email",
      template: "overdue",
      subject: "Overdue: The Old Man and the Sea",
      body: "The Old Man and the Sea is 3 days overdue. A fine of 25¢ per day is accruing.",
      status: "sent",
      createdAt: daysFromNow(-1),
      sentAt: daysFromNow(-1),
    },
  ]);

  const auditRows: Array<{ action: string; entityType: string; entityId: string | null; daysAgo: number; metadata?: Record<string, unknown> }> = [
    { action: "tenant.registered", entityType: "tenant", entityId: tenant.id, daysAgo: 430, metadata: { slug: "lakeside" } },
    { action: "auth.login", entityType: "user", entityId: adminUser.id, daysAgo: 1, metadata: {} },
    { action: "book.created", entityType: "book", entityId: bookIdByTitle.get("Walden") ?? null, daysAgo: 60, metadata: { title: "Walden" } },
    { action: "loan.checkout", entityType: "loan", entityId: loanIdByTitle.get("Walden") ?? null, daysAgo: 9, metadata: {} },
  ];
  for (const entry of auditRows) {
    await db.insert(auditLogs).values({
      tenantId: tenant.id,
      actorUserId: adminUser.id,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: entry.metadata ?? {},
      ip: "198.51.100.7",
      createdAt: daysFromNow(-entry.daysAgo),
    });
  }

  return { seeded: true };
}

interface TenantCounts {
  books: number;
  copies: number;
  members: number;
  loans: number;
  holds: number;
  fines: number;
  notifications: number;
}

async function tenantCounts(tenantId: string): Promise<TenantCounts> {
  return withTenantContext({ tenantId, isPlatformAdmin: true }, async (db) => {
    const [row] = await db
      .select({
        books: dsql<number>`(select count(*)::int from books where tenant_id = ${tenantId})`,
        copies: dsql<number>`(select count(*)::int from copies where tenant_id = ${tenantId})`,
        members: dsql<number>`(select count(*)::int from members where tenant_id = ${tenantId})`,
        loans: dsql<number>`(select count(*)::int from loans where tenant_id = ${tenantId})`,
        holds: dsql<number>`(select count(*)::int from holds where tenant_id = ${tenantId})`,
        fines: dsql<number>`(select count(*)::int from fines where tenant_id = ${tenantId})`,
        notifications: dsql<number>`(select count(*)::int from notifications where tenant_id = ${tenantId})`,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    return row!;
  });
}

function formatLine(label: string, cfg: TenantSeed, counts: TenantCounts): string {
  return `  ${label.padEnd(12)} ${cfg.name} (${cfg.slug})\n` +
    `               ${counts.books} books · ${counts.copies} copies · ${counts.members} members · ${counts.loans} loans · ${counts.holds} holds · ${counts.fines} fines · ${counts.notifications} notifications`;
}

async function main(): Promise<void> {
  await initDb(env().DATABASE_URL, { max: env().DB_POOL_MAX });
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const nextBarcode = createBarcodeFactory();

  if (process.env.SEED_RESET === "1") {
    await resetSeedData();
  }

  const platformAdmin = await ensurePlatformAdmin(passwordHash);
  const riverside = await ensureTenant(RIVERSIDE);
  const lakeside = await ensureTenant(LAKESIDE);

  const riversideResult = await withTenantContext(
    { tenantId: riverside.id, userId: platformAdmin.id, isPlatformAdmin: true },
    (db) => seedRiverside(db, riverside, passwordHash, nextBarcode),
  );
  const lakesideResult = await withTenantContext(
    { tenantId: lakeside.id, userId: platformAdmin.id, isPlatformAdmin: true },
    (db) => seedLakeside(db, lakeside, passwordHash, nextBarcode),
  );

  const riversideCounts = await tenantCounts(riverside.id);
  const lakesideCounts = await tenantCounts(lakeside.id);
  const newlySeeded = [riversideResult, lakesideResult].filter((result) => result.seeded).length;

  process.stdout.write(
    [
      "",
      "==============================================",
      "  Library Cloud seed complete",
      "==============================================",
      `  Newly seeded:  ${newlySeeded} tenant(s)${newlySeeded === 0 ? " (data already present)" : ""}`,
      formatLine("Demo:", RIVERSIDE, riversideCounts),
      formatLine("Second:", LAKESIDE, lakesideCounts),
      "",
      "  Staff logins (password: Password123!)",
      "    Platform admin   platform@lms.test",
      "    Riverside admin  admin@riverside.test",
      "    Riverside staff  librarian@riverside.test, assistant@riverside.test",
      "    Lakeside admin   admin@lakeside.test",
      "    Lakeside staff   librarian@lakeside.test",
      "  Patron logins",
      "    jane@example.com, marcus@example.com, sofia@example.com, ethan@example.com",
      "    nina@example.com, tom@example.com",
      "",
      "  Demo highlights",
      "    · 8 active/overdue loans, 2 overdue fines, 1 hold ready for pickup",
      "    · 2 patrons queued on The Little Prince; lost/damaged/withdrawn copies",
      "    · Notifications and audit history pre-populated for the staff console",
      "",
      `  OPAC:      http://localhost:3000/library/${RIVERSIDE.slug}  ·  http://localhost:3000/library/${LAKESIDE.slug}`,
      "  Dashboard: http://localhost:3000/app",
      "  Reset:     SEED_RESET=1 re-creates all demo data from scratch",
      "==============================================",
      "",
    ].join("\n"),
  );

  await closeDb();
}

main().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`Seed failed:\n${message}\n`);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
