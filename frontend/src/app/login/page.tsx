"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Button, Callout, Field, Input } from "@/components/ui";
import { ApiError, loginStaff } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await loginStaff(slug.trim().toLowerCase(), email.trim(), password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in. Try again.");
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Staff sign in"
      subtitle={
        <>
          New here?{" "}
          <Link href="/register" className="font-medium text-[var(--brand)] hover:underline">
            Create a library
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error ? <Callout tone="danger">{error}</Callout> : null}
        <Field label="Library slug" hint="The slug you chose when registering, e.g. city-library">
          <Input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="city-library"
            autoComplete="organization"
            required
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@library.org"
            autoComplete="email"
            required
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </Field>
        <Button type="submit" loading={loading} className="w-full" size="lg">
          Sign in
        </Button>
        <p className="text-center text-[13px] text-ink-400">
          Patron? Use your library&apos;s catalog page to sign in.{" "}
          <Link href="/platform/login" className="font-medium text-ink-500 hover:text-ink-800">
            Platform admin
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
