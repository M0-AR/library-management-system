import { describe, expect, it } from "vitest";
import {
  canCheckout,
  canRenew,
  computeDueDate,
  fineForOverdue,
  overdueDays,
} from "../src/modules/loans/circulation";
import { DEFAULT_TENANT_SETTINGS } from "../src/modules/tenants/tenant-settings";

const policy = DEFAULT_TENANT_SETTINGS.circulation;

describe("circulation policy", () => {
  it("computes the due date from the loan period", () => {
    const from = new Date("2026-01-01T10:00:00Z");
    const due = computeDueDate(from, policy);
    expect(due.getTime()).toBe(from.getTime() + policy.loanPeriodDays * 86_400_000);
  });

  it("counts whole overdue days only", () => {
    const due = new Date("2026-01-10T10:00:00Z");
    expect(overdueDays(due, new Date("2026-01-10T09:00:00Z"))).toBe(0);
    expect(overdueDays(due, new Date("2026-01-10T10:00:00Z"))).toBe(0);
    expect(overdueDays(due, new Date("2026-01-11T09:00:00Z"))).toBe(0);
    expect(overdueDays(due, new Date("2026-01-11T10:00:00Z"))).toBe(1);
    expect(overdueDays(due, new Date("2026-01-13T12:00:00Z"))).toBe(3);
  });

  it("applies the grace period before fines", () => {
    expect(fineForOverdue(0, policy)).toBe(0);
    expect(fineForOverdue(policy.gracePeriodDays, policy)).toBe(0);
    expect(fineForOverdue(policy.gracePeriodDays + 1, policy)).toBe(policy.finePerDayCents);
    expect(fineForOverdue(policy.gracePeriodDays + 5, policy)).toBe(5 * policy.finePerDayCents);
  });

  it("blocks checkout for bad membership states", () => {
    const base = {
      memberStatus: "active" as const,
      activeLoans: 0,
      outstandingFineCents: 0,
      alreadyBorrowingCopy: false,
    };
    expect(canCheckout(base, policy)).toEqual({ allowed: true });
    expect(canCheckout({ ...base, memberStatus: "suspended" }, policy)).toEqual({
      allowed: false,
      reason: "member_suspended",
    });
    expect(canCheckout({ ...base, memberStatus: "expired" }, policy)).toEqual({
      allowed: false,
      reason: "membership_expired",
    });
    expect(canCheckout({ ...base, memberStatus: "closed" }, policy)).toEqual({
      allowed: false,
      reason: "membership_closed",
    });
  });

  it("blocks checkout on load, fine and loan limits", () => {
    const base = {
      memberStatus: "active" as const,
      activeLoans: 0,
      outstandingFineCents: 0,
      alreadyBorrowingCopy: false,
    };
    expect(canCheckout({ ...base, alreadyBorrowingCopy: true }, policy)).toEqual({
      allowed: false,
      reason: "already_borrowed",
    });
    expect(
      canCheckout({ ...base, outstandingFineCents: policy.maxOutstandingFineCents + 1 }, policy),
    ).toEqual({ allowed: false, reason: "fines_exceeded" });
    expect(
      canCheckout({ ...base, outstandingFineCents: policy.maxOutstandingFineCents }, policy),
    ).toEqual({ allowed: true });
    expect(canCheckout({ ...base, activeLoans: policy.maxLoansPerMember }, policy)).toEqual({
      allowed: false,
      reason: "loan_limit_reached",
    });
  });

  it("blocks renewals for returned, overdue, exhausted and held loans", () => {
    const loan = {
      status: "active" as const,
      dueAt: new Date(),
      renewedCount: 0,
    };
    expect(canRenew(loan, policy, 0)).toEqual({ allowed: true });
    expect(canRenew({ ...loan, status: "returned" }, policy, 0)).toEqual({
      allowed: false,
      reason: "already_returned",
    });
    expect(canRenew({ ...loan, status: "overdue" }, policy, 0)).toEqual({
      allowed: false,
      reason: "loan_overdue",
    });
    expect(canRenew({ ...loan, renewedCount: policy.maxRenewals }, policy, 0)).toEqual({
      allowed: false,
      reason: "renewal_limit_reached",
    });
    expect(canRenew(loan, policy, 1)).toEqual({ allowed: false, reason: "holds_waiting" });
  });
});
