"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShieldCheck, LogOut } from "lucide-react";
import { Button } from "@/components/ui";
import { Logo } from "@/components/logo";
import { logout } from "@/lib/api";
import { useSession } from "@/lib/hooks";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, ready } = useSession("platform");
  const isLogin = pathname === "/platform/login";

  useEffect(() => {
    if (!ready || isLogin) return;
    if (!session || session.user.role !== "platform_admin") {
      router.replace("/platform/login");
    }
  }, [ready, isLogin, session, router]);

  if (isLogin) return <>{children}</>;

  if (!ready || !session || session.user.role !== "platform_admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50/70">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-ink-950 text-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href="/platform" className="flex items-center gap-2.5">
            <Logo size={26} showName={false} tone="light" />
            <span className="text-[14px] font-semibold tracking-tight">Library Cloud</span>
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/70">
              Platform
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-[12.5px] text-white/60 sm:flex">
              <ShieldCheck className="h-3.5 w-3.5" />
              {session.user.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-white/70 hover:bg-white/10 hover:text-white"
              icon={<LogOut className="h-3.5 w-3.5" />}
              onClick={async () => {
                await logout("platform");
                router.replace("/platform/login");
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
