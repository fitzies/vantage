import { Suspense } from "react";

import { AuthForm } from "./_components/auth-form";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background px-6 py-16">
      <main className="w-full max-w-xs">
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight">Vantage</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to your analytics workspace.
          </p>
        </div>
        <Suspense fallback={null}>
          <AuthForm />
        </Suspense>
      </main>
    </div>
  );
}
