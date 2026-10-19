import type { TenantSettings } from "./types";

export const DEFAULT_SETTINGS: TenantSettings = {
  currency: "USD",
  timezone: "UTC",
  locale: "en",
  branding: {
    primaryColor: "#4f46e5",
    accentColor: "#0ea5e9",
  },
  circulation: {
    loanPeriodDays: 14,
    renewalPeriodDays: 14,
    maxRenewals: 2,
    maxLoansPerMember: 10,
    gracePeriodDays: 1,
    finePerDayCents: 25,
    maxOutstandingFineCents: 5000,
    lostItemFeeCents: 3000,
    holdsEnabled: true,
    holdShelfExpiryDays: 3,
  },
  notifications: {
    emailEnabled: true,
    dueSoonDaysBefore: 3,
    overdueRemindersEnabled: true,
    holdReadyEmails: true,
  },
  opac: {
    enabled: true,
    showCovers: true,
    requireLoginToPlaceHolds: true,
  },
};

export const ROLES = [
  { id: "tenant_admin", label: "Administrator" },
  { id: "librarian", label: "Librarian" },
  { id: "assistant", label: "Assistant" },
] as const;

export const MEMBER_CATEGORIES = [
  "child",
  "student",
  "adult",
  "senior",
  "teacher",
  "staff",
  "external",
] as const;

export const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "SAR", "AED", "EGP", "TRY", "JPY", "INR"] as const;

export const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Istanbul",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;

export const LOCALES = ["en", "ar", "fr", "de", "es", "tr"] as const;
