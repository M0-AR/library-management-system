"use client";

import type { ReactNode } from "react";
import { cx } from "./ui";

export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("overflow-x-auto rounded-2xl border border-ink-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]", className)}>
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <th className={cx("border-b border-ink-100 bg-ink-50/60 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-ink-400", className)}>
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return <td className={cx("border-b border-ink-100/70 px-4 py-3 align-middle text-ink-700", className)}>{children}</td>;
}

export function Tr({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={cx("transition-colors", onClick && "cursor-pointer hover:bg-ink-50/70", className)}
    >
      {children}
    </tr>
  );
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <TableWrap>
      <thead>
        <tr>
          {Array.from({ length: cols }).map((_, index) => (
            <Th key={index}>
              <div className="skeleton h-3 w-20 rounded" />
            </Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <tr key={rowIndex}>
            {Array.from({ length: cols }).map((_, colIndex) => (
              <Td key={colIndex}>
                <div className="skeleton h-4 w-full max-w-32 rounded" />
              </Td>
            ))}
          </tr>
        ))}
      </tbody>
    </TableWrap>
  );
}
