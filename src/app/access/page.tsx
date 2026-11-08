import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Accès · Dispatch 200 offres" };

async function ErrorMessage({ searchParams }: { searchParams: PageProps<"/access">["searchParams"] }) {
  const { error } = await searchParams;
  return error ? <p className="text-sm text-danger">Code incorrect.</p> : null;
}

export default function AccessPage({ searchParams }: PageProps<"/access">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold">Code d&apos;accès de la démo</h1>
      <form action="/api/access" method="post" className="space-y-3">
        <label htmlFor="code" className="block text-sm text-muted-foreground">
          Saisis le code communiqué par l&apos;organisateur.
        </label>
        <input
          id="code"
          name="code"
          type="password"
          autoComplete="off"
          required
          className="h-11 w-full rounded-md border border-border bg-card px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Suspense fallback={null}>
          <ErrorMessage searchParams={searchParams} />
        </Suspense>
        <button
          type="submit"
          className="h-11 w-full rounded-md bg-primary font-medium text-primary-foreground hover:bg-primary/90"
        >
          Entrer
        </button>
      </form>
    </main>
  );
}
