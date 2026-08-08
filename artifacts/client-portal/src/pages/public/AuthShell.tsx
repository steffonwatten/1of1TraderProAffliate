import React from "react";

// Shared centered card for the signup/login funnel pages.
export function AuthShell({ title, subtitle, children }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-lg font-extrabold text-primary-foreground">
            1
          </div>
          <span className="text-xl font-bold tracking-tight">1OF1 Markets</span>
        </div>
        <div className="rounded-2xl border border-border bg-card p-8">
          <h1 className="mb-1 text-2xl">{title}</h1>
          {subtitle && <p className="mb-6 text-sm text-muted-foreground">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
