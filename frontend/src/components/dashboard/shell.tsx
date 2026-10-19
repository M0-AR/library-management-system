"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  Bell,
  BookOpen,
  Building2,
  CircleDollarSign,
  ExternalLink,
  History,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  Settings,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Avatar, cx, IconButton, PageLoader, useToast } from "@/components/ui";
import { logout } from "@/lib/api";
import { useSession } from "@/lib/hooks";
import { useTenant, TenantProvider } from "@/lib/tenant-context";
import { titleCase } from "@/lib/format";

const DASH_ROLES = ["tenant_admin", "librarian", "assistant"] as const;
type NavRole = (typeof DASH_ROLES)[number];

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  adminOnly?: boolean;
  roles?: NavRole[];
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/books", label: "Catalog", icon: BookOpen },
  { href: "/dashboard/members", label: "Members", icon: Users },
  { href: "/dashboard/loans", label: "Circulation", icon: ArrowLeftRight },
  { href: "/dashboard/holds", label: "Holds", icon: Layers },
  { href: "/dashboard/fines", label: "Fines", icon: CircleDollarSign },
  { href: "/dashboard/messages", label: "Messages", icon: Bell, roles: ["tenant_admin", "librarian"] },
  { href: "/dashboard/activity", label: "Activity", icon: History, roles: ["tenant_admin"] },
  { href: "/dashboard/branches", label: "Branches", icon: Building2 },
  { href: "/dashboard/users", label: "Staff", icon: UserCog, adminOnly: true },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, adminOnly: true },
];

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { push } = useToast();
  const { session, ready } = useSession("staff");
  const { tenant } = useTenant();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  useEffect(() => {
    if (ready && !session) router.replace("/login");
  }, [ready, session, router]);

  useEffect(() => {
    setMenuOpen(false);
    setUserOpen(false);
  }, [pathname]);

  if (!ready || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50">
        <PageLoader label="Loading workspace" />
      </div>
    );
  }

  const role = session.user.role;
  const nav = NAV.filter(
    (item) =>
      (!item.adminOnly || role === "tenant_admin") &&
      (!item.roles || item.roles.includes(role as NavRole)),
  );
  const isActive = (item: (typeof NAV)[number]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  async function signOut() {
    await logout("staff");
    push({ title: "Signed out", tone: "info" });
    router.push("/login");
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-ink-100 px-5">
        <Link href="/dashboard" className="min-w-0">
          <Logo size={30} subtitle={tenant?.name ?? session.tenant?.name ?? ""} name={tenant?.settings?.branding.displayName ?? undefined} />
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {nav.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all",
                active
                  ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                  : "text-ink-500 hover:bg-ink-100/70 hover:text-ink-800",
              )}
            >
              <item.icon className="h-4.5 w-4.5" />
              {item.label}
              {active ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--brand)]" /> : null}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-ink-100 p-3">
        <a
          href={`/library/${tenant?.slug ?? session.tenant?.slug ?? ""}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-ink-500 transition-colors hover:bg-ink-100/70 hover:text-ink-800"
        >
          <ExternalLink className="h-4.5 w-4.5" />
          View public catalog
        </a>
        <div className="mt-2 flex items-center gap-3 rounded-xl bg-ink-50 p-2.5">
          <Avatar name={session.user.name} size={34} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-ink-800">{session.user.name}</p>
            <p className="truncate text-[11px] text-ink-400">{titleCase(role)}</p>
          </div>
          <IconButton label="Sign out" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-ink-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-ink-200/70 bg-white lg:block">
        {sidebar}
      </aside>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px] animate-fade-in" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-2xl animate-fade-in">{sidebar}</div>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-ink-200/70 bg-white/80 px-4 backdrop-blur-lg sm:px-6">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-ink-800">
              {tenant?.settings?.branding.displayName ?? tenant?.name ?? session.tenant?.name ?? "Library"}
            </p>
            <p className="truncate text-[11px] text-ink-400">
              {tenant?.slug ?? session.tenant?.slug} · {titleCase(String(tenant?.plan ?? session.tenant?.plan ?? "free"))}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-[13px] text-ink-500 sm:flex">
              <Avatar name={session.user.name} size={22} />
              {session.user.name}
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <TenantProvider>
      <Shell>{children}</Shell>
    </TenantProvider>
  );
}
