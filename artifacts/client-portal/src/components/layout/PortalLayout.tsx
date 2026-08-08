import React from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  CandlestickChart,
  History,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { useClientAuth } from "@/lib/clientAuth";
import { KycBanner } from "@/components/layout/KycBanner";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/deposit", label: "Deposit", icon: ArrowDownToLine },
  { href: "/transfer", label: "Transfer", icon: ArrowLeftRight },
  { href: "/withdraw", label: "Withdraw", icon: ArrowUpFromLine },
  { href: "/accounts", label: "Trading Accounts", icon: CandlestickChart },
  { href: "/history", label: "Transaction History", icon: History },
  { href: "/verification", label: "Verification", icon: ShieldCheck },
];

export function PortalLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { client, logout } = useClientAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex h-16 items-center gap-2 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-extrabold text-primary-foreground">
            1
          </div>
          <span className="font-bold tracking-tight">1OF1 Markets</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                location === href && "bg-secondary text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <button
          onClick={logout}
          className="mx-3 mb-4 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border px-4 md:px-8">
          <span className="font-semibold md:hidden">1OF1 Markets</span>
          <span className="hidden text-sm text-muted-foreground md:block">
            Welcome, {client?.fullName}
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-bold">
            {client?.fullName
              ?.split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
        </header>
        {/* Mobile nav */}
        <nav className="flex gap-1 overflow-x-auto border-b border-border px-2 py-2 md:hidden">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground",
                location === href && "bg-secondary text-foreground"
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        <main className="flex-1 px-4 py-6 md:px-8">
          <KycBanner />
          {children}
        </main>
      </div>
    </div>
  );
}
