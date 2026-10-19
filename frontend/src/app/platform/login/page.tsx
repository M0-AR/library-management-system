"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { Button, Callout, Field, Input } from "@/components/ui";
import { ApiError, loginPlatform } from "@/lib/api";

export default function PlatformLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await loginPlatform(email.trim(), password);
      router.replace("/platform");
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "invalid_credentials"
          ? "Email or password is incorrect."
          : err instanceof ApiError
            ? err.message
            : "Sign-in failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      side="platform"
      title="Platform console"
      subtitle={
        <>
          Operator access only. Library staff should{" "}
          <Link href="/login" className="font-medium text-[var(--brand)] hover:underline">
            sign in here
          </Link>
          .
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Operator email">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ops@librarycloud.app"
            required
            autoComplete="email"
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
          />
        </Field>
        {error ? <Callout tone="danger">{error}</Callout> : null}
        <Button type="submit" className="w-full" size="lg" loading={busy} icon={<ShieldCheck className="h-4 w-4" />}>
          Enter console
        </Button>
      </form>
    </AuthShell>
  );
}
