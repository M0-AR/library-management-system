export interface Meta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface Paged<T> {
  items: T[];
  meta: Meta;
}

export interface Book {
  id: string;
  title: string;
  subtitle?: string | null;
  authors: string[];
  isbn13?: string | null;
  isbn10?: string | null;
  publisher?: string | null;
  publishedYear?: number | null;
  language?: string | null;
  pages?: number | null;
  description?: string | null;
  coverUrl?: string | null;
  categories: string[];
  tags: string[];
  dewey?: string | null;
  status: "active" | "archived";
  createdAt: string;
  copiesTotal?: number;
  copiesAvailable?: number;
}

export interface IsbnLookup {
  title: string;
  subtitle?: string | null;
  authors: string[];
  isbn13?: string | null;
  isbn10?: string | null;
  publisher?: string | null;
  publishedYear?: number | null;
  pages?: number | null;
  language?: string | null;
  description?: string | null;
  coverUrl?: string | null;
  categories?: string[];
}

export interface Copy {
  id: string;
  barcode: string;
  status: "available" | "on_loan" | "reserved" | "lost" | "damaged" | "withdrawn";
  condition?: string | null;
  location?: string | null;
  branchId: string;
  branchName?: string | null;
  priceCents?: number | null;
  acquiredAt?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface Member {
  id: string;
  cardNumber: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  category: "child" | "student" | "adult" | "senior" | "teacher" | "staff" | "external";
  status: "active" | "suspended" | "expired" | "closed";
  joinedAt: string;
  expiresAt?: string | null;
  notes?: string | null;
  userId?: string | null;
  createdAt: string;
  updatedAt?: string;
  activeLoans?: number;
  overdueLoans?: number;
  openHolds?: number;
}

export interface MemberDetail extends Member {
  outstandingFineCents?: number;
}

export interface Loan {
  id: string;
  status: "active" | "overdue" | "returned" | "lost";
  checkedOutAt: string;
  dueAt: string;
  returnedAt?: string | null;
  renewedCount: number;
  memberId: string;
  memberName: string;
  memberCard?: string;
  bookId: string;
  bookTitle: string;
  copyId: string;
  copyBarcode: string;
  branchName?: string | null;
}

export interface Hold {
  id: string;
  status: "pending" | "ready" | "fulfilled" | "cancelled" | "expired";
  placedAt: string;
  expiresAt?: string | null;
  readyAt?: string | null;
  memberId: string;
  memberName: string;
  bookId: string;
  bookTitle: string;
  branchId?: string | null;
  branchName?: string | null;
  queuePosition?: number;
}

export interface Fine {
  id: string;
  type: "overdue" | "lost" | "damaged" | "manual";
  status: "outstanding" | "paid" | "waived";
  currency: string;
  amountCents: number;
  paidCents?: number;
  note?: string | null;
  createdAt: string;
  paidAt?: string | null;
  waivedAt?: string | null;
  memberId: string;
  memberName: string;
  memberCard?: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  status: "active" | "inactive";
  createdAt: string;
}

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: "tenant_admin" | "librarian" | "assistant" | "patron";
  status: "active" | "disabled";
  branchId?: string | null;
  memberId?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
}

export interface DashboardSummary {
  books: { titles: number; archived: number };
  copies: { total: number; available: number; onLoan: number; reserved: number; lost: number };
  members: { total: number; active: number; suspended: number; newThisMonth: number };
  loans: {
    active: number;
    overdue: number;
    checkedOutToday: number;
    returnedToday: number;
    checkedOutThisMonth: number;
  };
  holds: { ready: number; pending: number };
  fines: { outstandingCents: number; outstandingCount: number };
}

export interface CirculationPoint {
  day: string;
  checkouts: number;
  returns: number;
}

export interface TopTitle {
  bookId: string;
  title: string;
  authors?: string[];
  loanCount: number;
  coverUrl?: string | null;
}

export interface RecentCheckout {
  id: string;
  memberName: string;
  bookTitle: string;
  checkedOutAt: string;
  dueAt: string;
  copyBarcode?: string;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  status: "active" | "trial" | "suspended" | "cancelled";
  plan: "free" | "starter" | "growth" | "enterprise";
  createdAt: string;
  settings?: TenantSettings;
  userCount?: number;
  bookCount?: number;
  memberCount?: number;
  loanCount?: number;
}

export interface PlatformTenant {
  id: string;
  slug: string;
  name: string;
  status: "active" | "trial" | "suspended" | "cancelled";
  plan: "free" | "starter" | "growth" | "enterprise";
  createdAt: string;
  userCount: number;
}

export interface PlatformTenantDetail {
  id: string;
  slug: string;
  name: string;
  status: "active" | "trial" | "suspended" | "cancelled";
  plan: "free" | "starter" | "growth" | "enterprise";
  createdAt: string;
  settings: TenantSettings;
  counts: { users: number };
}

export interface GrowthPoint {
  day: string;
  count: number;
}

export interface BrandingSettings {
  displayName?: string;
  primaryColor: string;
  accentColor: string;
  logoUrl?: string;
  faviconUrl?: string;
  welcomeMessage?: string;
}

export interface CirculationSettings {
  loanPeriodDays: number;
  renewalPeriodDays: number;
  maxRenewals: number;
  maxLoansPerMember: number;
  gracePeriodDays: number;
  finePerDayCents: number;
  maxOutstandingFineCents: number;
  lostItemFeeCents: number;
  holdsEnabled: boolean;
  holdShelfExpiryDays: number;
}

export interface NotificationSettings {
  emailEnabled: boolean;
  dueSoonDaysBefore: number;
  overdueRemindersEnabled: boolean;
  holdReadyEmails: boolean;
}

export interface OpacSettings {
  enabled: boolean;
  showCovers: boolean;
  requireLoginToPlaceHolds: boolean;
}

export interface TenantSettings {
  currency: string;
  timezone: string;
  locale: string;
  branding: BrandingSettings;
  circulation: CirculationSettings;
  notifications: NotificationSettings;
  opac: OpacSettings;
}

export interface TenantDomain {
  id: string;
  domain: string;
  status: "pending" | "verified" | "failed";
  verificationToken: string;
  verifiedAt?: string | null;
  createdAt: string;
}

export interface Plan {
  id: "free" | "starter" | "growth" | "enterprise";
  name: string;
  priceCents: number;
  limits: { branches: number; staff: number; books: number; members: number };
  features?: string[];
  paddlePriceId?: string;
}

export interface Subscription {
  plan: "free" | "starter" | "growth" | "enterprise";
  status: "trialing" | "active" | "past_due" | "cancelled";
  priceCents: number;
  currentPeriodEnd?: string | null;
  provider: string;
}

export interface PatronMember {
  id: string;
  cardNumber: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  category: string;
  status: "active" | "suspended" | "expired" | string;
  joinedAt?: string | null;
  expiresAt?: string | null;
}

export interface PatronProfile {
  member: PatronMember;
  stats: { activeLoans: number; openHolds: number; outstandingCents: number };
}

export interface PatronLoan {
  id: string;
  status: "active" | "overdue";
  checkedOutAt: string;
  dueAt: string;
  renewedCount: number;
  bookId: string;
  bookTitle: string;
  bookAuthors?: string[] | null;
  coverUrl?: string | null;
  copyBarcode?: string;
}

export interface PatronLoanHistory {
  id: string;
  status: "returned" | "lost";
  checkedOutAt: string;
  dueAt: string;
  returnedAt?: string | null;
  bookId: string;
  bookTitle: string;
}

export interface PatronHoldItem {
  id: string;
  status: "pending" | "ready";
  placedAt: string;
  expiresAt?: string | null;
  bookId: string;
  bookTitle: string;
  bookAuthors?: string[] | null;
  coverUrl?: string | null;
}

export interface PublicTenant {
  id: string;
  slug: string;
  name: string;
  branding: TenantSettings["branding"];
  opac: TenantSettings["opac"];
}

export interface PublicBook {
  id: string;
  title: string;
  subtitle?: string | null;
  authors: string[];
  coverUrl?: string | null;
  categories: string[];
  publisher?: string | null;
  publishedYear?: number | null;
  availableCopies: number;
  totalCopies: number;
}

export interface PublicBookDetail extends PublicBook {
  isbn13?: string | null;
  isbn10?: string | null;
  description?: string | null;
  pages?: number | null;
  language?: string | null;
  availability?: { branchId: string; branchName: string; available: number; total: number }[];
}

export interface GrowthPoint {
  day: string;
  count: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
