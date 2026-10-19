"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useApi, useSession } from "@/lib/hooks";
import type { Tenant, TenantSettings } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/defaults";

interface TenantContextValue {
  tenant: Tenant | null;
  settings: TenantSettings;
  loading: boolean;
  reload: () => void;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { session } = useSession("staff");
  const isAdmin = session?.user.role === "tenant_admin";
  const { data, loading, reload } = useApi<Tenant>(isAdmin ? "/tenants/me" : null, { scope: "staff" });
  const settings = useMemo(() => data?.settings ?? DEFAULT_SETTINGS, [data]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--brand", settings.branding.primaryColor);
    root.style.setProperty("--accent", settings.branding.accentColor);
  }, [settings]);

  const value = useMemo(
    () => ({ tenant: data, settings, loading, reload }),
    [data, settings, loading, reload],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const context = useContext(TenantContext);
  if (!context) throw new Error("useTenant must be used within TenantProvider");
  return context;
}
