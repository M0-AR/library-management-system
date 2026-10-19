"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Button, Callout, Field, Input } from "@/components/ui";
import { ApiError, registerTenant } from "@/lib/api";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);
}

export default function RegisterPage() {
  const router = useRouter();
  const [libraryName, setLibraryName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const effectiveSlug = useMemo(
    () => (slugTouched ? slug : slugify(libraryName)),
    [slug, slugTouched, libraryName],
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await registerTenant({
        slug: effectiveSlug,
        libraryName: libraryName.trim(),
        name: name.trim(),
        email: email.trim(),
        password,
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create the library. Try again.");
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create your library"
      subtitle={
        <>
          Already have one?{" "}
          <Link href="/login" className="font-medium text-[var(--brand)] hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error ? <Callout tone="danger">{error}</Callout> : null}
        <Field label="Library name">
          <Input
            value={libraryName}
            onChange={(event) => setLibraryName(event.target.value)}
            placeholder="Riverside Public Library"
            required
          />
        </Field>
        <Field label="Catalog address" hint={`Your OPAC will live at /library/${effectiveSlug || "your-slug"}`}>
          <Input
            value={effectiveSlug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(slugify(event.target.value));
            }}
            placeholder="riverside-library"
            pattern="[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?"
            title="Lowercase letters, numbers and hyphens"
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ada Lovelace" required />
          </Field>
          <Field label="Work email">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@library.org"
              autoComplete="email"
              required
            />
          </Field>
        </div>
        <Field label="Password" hint="At least 8 characters">
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            minLength={8}
            autoComplete="new-password"
            required
          />
        </Field>
        <Button type="submit" loading={loading} className="w-full" size="lg">
          Create library
        </Button>
        <p className="text-center text-[12px] text-ink-400">
          By creating a library you agree to the fair use of shared infrastructure.
        </p>
      </form>
    </AuthShell>
  );
}
