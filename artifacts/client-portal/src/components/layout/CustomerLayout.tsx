import { Link, useLocation } from "wouter";
import { useState } from "react";
import { BrandLockup } from "@workspace/brand";
import { LayoutDashboard, LineChart, LifeBuoy, User, LogOut, Menu, X } from "lucide-react";
import { useCustomerAuth } from "@/lib/customerAuth";

// Chrome for the indicator customer portal. Deliberately a small, flat nav:
// a customer has four things to do here, and a sidebar built for the admin
// back office would make it look like there is more.

const LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/indicator", label: "Indicator Access", icon: LineChart },
  { href: "/support", label: "Support", icon: LifeBuoy },
  { href: "/account", label: "Account", icon: User },
];

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { customer, logout } = useCustomerAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = location === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              active
                ? "bg-primary/12 text-primary font-semibold border-l-2 border-primary pl-[10px]"
                : "text-muted-foreground hover:text-white hover:bg-white/[0.04] border-l-2 border-transparent"
            }`}
          >
            <Icon className="w-[18px] h-[18px] shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="p-3 border-t border-border">
      <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-white/[0.03] mb-2">
        <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
          {(customer?.fullName ?? customer?.email ?? "?").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white truncate">{customer?.fullName ?? "Customer"}</p>
          <p className="text-xs text-muted-foreground truncate">{customer?.email}</p>
        </div>
      </div>
      <button
        onClick={logout}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-white hover:bg-white/[0.04] transition-colors"
      >
        <LogOut className="w-4 h-4" /> Sign out
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-60 shrink-0 hidden md:flex flex-col bg-card border-r border-border">
        <div className="p-5 border-b border-border">
          <BrandLockup height={30} className="text-white" />
        </div>
        {nav}
        {footer}
      </aside>

      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-60 z-50 md:hidden flex flex-col bg-card border-r border-border">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <BrandLockup height={26} className="text-white" />
              <button onClick={() => setMobileOpen(false)} className="text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </>
      )}

      <main className="flex-1 flex flex-col min-h-screen min-w-0">
        <header className="h-14 flex items-center justify-between px-4 md:hidden bg-card border-b border-border">
          <button onClick={() => setMobileOpen(true)} className="text-muted-foreground p-1">
            <Menu className="w-6 h-6" />
          </button>
          <BrandLockup height={26} className="text-white" />
          <button onClick={logout} className="text-muted-foreground p-1">
            <LogOut className="w-5 h-5" />
          </button>
        </header>
        <div className="flex-1 p-6 md:p-8 max-w-5xl w-full">{children}</div>
      </main>
    </div>
  );
}
