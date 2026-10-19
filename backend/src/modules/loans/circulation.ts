import type { CirculationSettings } from "../tenants/tenant-settings";

export type CirculationPolicy = CirculationSettings;

export interface LoanLike {
  status: "active" | "overdue" | "returned";
  dueAt: Date;
  renewedCount: number;
}

export interface CheckoutCandidate {
  memberStatus: "active" | "suspended" | "expired" | "closed";
  activeLoans: number;
  outstandingFineCents: number;
  alreadyBorrowingCopy: boolean;
}

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function computeDueDate(from: Date, policy: CirculationPolicy): Date {
  return new Date(from.getTime() + policy.loanPeriodDays * DAY_MS);
}

export function overdueDays(dueAt: Date, now: Date): number {
  const diff = now.getTime() - dueAt.getTime();
  if (diff <= 0) return 0;
  return Math.floor(diff / DAY_MS);
}

export function fineForOverdue(days: number, policy: CirculationPolicy): number {
  const chargeable = Math.max(0, days - policy.gracePeriodDays);
  return chargeable * policy.finePerDayCents;
}

export function canCheckout(candidate: CheckoutCandidate, policy: CirculationPolicy): PolicyDecision {
  if (candidate.memberStatus === "suspended") {
    return { allowed: false, reason: "member_suspended" };
  }
  if (candidate.memberStatus === "expired") {
    return { allowed: false, reason: "membership_expired" };
  }
  if (candidate.memberStatus === "closed") {
    return { allowed: false, reason: "membership_closed" };
  }
  if (candidate.alreadyBorrowingCopy) {
    return { allowed: false, reason: "already_borrowed" };
  }
  if (candidate.outstandingFineCents > policy.maxOutstandingFineCents) {
    return { allowed: false, reason: "fines_exceeded" };
  }
  if (candidate.activeLoans >= policy.maxLoansPerMember) {
    return { allowed: false, reason: "loan_limit_reached" };
  }
  return { allowed: true };
}

export function canRenew(
  loan: LoanLike,
  policy: CirculationPolicy,
  pendingHoldsForBook: number,
): PolicyDecision {
  if (loan.status === "returned") {
    return { allowed: false, reason: "already_returned" };
  }
  if (loan.status === "overdue") {
    return { allowed: false, reason: "loan_overdue" };
  }
  if (loan.renewedCount >= policy.maxRenewals) {
    return { allowed: false, reason: "renewal_limit_reached" };
  }
  if (pendingHoldsForBook > 0) {
    return { allowed: false, reason: "holds_waiting" };
  }
  return { allowed: true };
}
