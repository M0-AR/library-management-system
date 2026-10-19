function formatDate(value: Date): string {
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function holdReadyEmail(params: {
  memberName: string;
  bookTitle: string;
  libraryName: string;
  expiresAt: Date;
}): { subject: string; body: string } {
  return {
    subject: `Ready for pickup: ${params.bookTitle}`,
    body: [
      `Hello ${params.memberName},`,
      "",
      `The book you requested, "${params.bookTitle}", is now available at ${params.libraryName}.`,
      `Please pick it up by ${formatDate(params.expiresAt)}.`,
      "",
      "Thank you,",
      params.libraryName,
    ].join("\n"),
  };
}

export function dueSoonEmail(params: {
  memberName: string;
  bookTitle: string;
  libraryName: string;
  dueAt: Date;
}): { subject: string; body: string } {
  return {
    subject: `Due soon: ${params.bookTitle}`,
    body: [
      `Hello ${params.memberName},`,
      "",
      `"${params.bookTitle}" is due on ${formatDate(params.dueAt)}.`,
      "You can renew it from your account if no one else is waiting for it.",
      "",
      "Thank you,",
      params.libraryName,
    ].join("\n"),
  };
}

export function overdueEmail(params: {
  memberName: string;
  bookTitle: string;
  libraryName: string;
  dueAt: Date;
  fineCents: number;
}): { subject: string; body: string } {
  return {
    subject: `Overdue: ${params.bookTitle}`,
    body: [
      `Hello ${params.memberName},`,
      "",
      `"${params.bookTitle}" was due on ${formatDate(params.dueAt)} and is now overdue.`,
      `Current charges: ${formatMoney(params.fineCents)}.`,
      "Please return it as soon as possible.",
      "",
      "Thank you,",
      params.libraryName,
    ].join("\n"),
  };
}

export function welcomeEmail(params: {
  memberName: string;
  libraryName: string;
  cardNumber: string;
}): { subject: string; body: string } {
  return {
    subject: `Welcome to ${params.libraryName}`,
    body: [
      `Hello ${params.memberName},`,
      "",
      `Your membership is ready. Your card number is ${params.cardNumber}.`,
      "Visit the online catalog to browse and reserve books.",
      "",
      "Thank you,",
      params.libraryName,
    ].join("\n"),
  };
}
