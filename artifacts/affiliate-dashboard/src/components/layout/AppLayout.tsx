import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { 
  LayoutDashboard, Users, DollarSign, Wallet, 
  Settings, Activity, Link as LinkIcon, LogOut, ShieldCheck, Database, UserSquare2, BarChart3,
  BookOpen, LifeBuoy, Shield, ChevronRight, Menu, X, Mail
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { BrandLockup } from "@workspace/brand";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation('/login');
    }
    if (user && user.role === 'admin' && location.startsWith('/dashboard')) {
      setLocation('/admin');
    }
    if (user && user.role === 'affiliate' && location.startsWith('/admin')) {
      setLocation('/dashboard');
    }
  }, [user, isLoading, location, setLocation]);

  useEffect(() => { setMobileOpen(false); }, [location]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const adminLinks = [
    { name: 'Overview', href: '/admin', icon: LayoutDashboard },
    { name: 'Customers', href: '/admin/customers', icon: UserSquare2 },
    { name: 'Applications', href: '/admin/applications', icon: BookOpen },
    { name: 'Affiliates', href: '/admin/affiliates', icon: Users },
    { name: 'Commissions', href: '/admin/commissions', icon: DollarSign },
    { name: 'Payouts', href: '/admin/payouts', icon: Wallet },
    { name: 'Memberships', href: '/admin/memberships', icon: Database },
    { name: 'Finance', href: '/admin/finance', icon: BarChart3 },
    { name: 'Analytics', href: '/admin/analytics', icon: Activity },
    { name: 'Support Tickets', href: '/admin/support-tickets', icon: LifeBuoy },
    { name: 'Audit Logs', href: '/admin/audit-logs', icon: ShieldCheck },
    { name: 'Email Logs', href: '/admin/email-logs', icon: Mail },
  ];

  const affiliateLinks = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'My Links', href: '/dashboard/links', icon: LinkIcon },
    { name: 'Customers', href: '/dashboard/customers', icon: Users },
    { name: 'Commissions', href: '/dashboard/commissions', icon: DollarSign },
    { name: 'Payouts', href: '/dashboard/payouts', icon: Wallet },
    { name: 'Analytics', href: '/dashboard/analytics', icon: Activity },
    { name: 'Resources', href: '/dashboard/resources', icon: BookOpen },
    { name: 'Support', href: '/dashboard/support', icon: LifeBuoy },
    { name: 'Profile', href: '/dashboard/profile', icon: Settings },
    { name: 'Security', href: '/dashboard/security', icon: Shield },
  ];

  const links = user.role === 'admin' ? adminLinks : affiliateLinks;

  const SidebarContent = () => (
    <>
      <div className="p-5 flex items-center gap-3 border-b border-border">
        <BrandLockup height={34} className="text-white" />
      </div>

      <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
        {links.map((link: any, idx) => {
          if (link.divider) {
            return (
              <div key={`divider-${idx}`} className="pt-4 pb-1.5 px-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">{link.label}</p>
              </div>
            );
          }
          const isActive = location === link.href || 
            (link.href !== '/admin' && link.href !== '/dashboard' && location.startsWith(link.href));
          const Icon = link.icon;
          
          return (
            <Link key={link.href} href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group relative ${
                isActive 
                  ? 'text-primary font-semibold' 
                  : 'text-muted-foreground hover:text-white hover:bg-white/[0.04]'
              }`}
              style={isActive ? { 
                background: 'linear-gradient(90deg, hsl(var(--primary) / 0.12) 0%, transparent 100%)', 
                borderLeft: '2px solid hsl(var(--primary))',
                paddingLeft: '10px'
              } : { borderLeft: '2px solid transparent' }}
            >
              <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-primary' : 'group-hover:text-white/80 transition-colors'}`} />
              <span className="text-sm">{link.name}</span>
              {isActive && <ChevronRight className="w-3 h-3 ml-auto text-primary/60" />}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-3 mb-3 px-2 py-2 rounded-lg bg-white/[0.03]">
          <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
            {user.fullName?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
          <div className="overflow-hidden flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user.fullName}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>
        <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-9 text-sm" onClick={logout}>
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="w-60 shrink-0 flex-col z-10 hidden md:flex" style={{ background: 'hsl(var(--card))', borderRight: '1px solid hsl(var(--border))' }}>
        <SidebarContent />
      </aside>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 w-60 flex flex-col z-50 md:hidden"
              style={{ background: 'hsl(var(--card))', borderRight: '1px solid hsl(var(--border))' }}
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="h-14 flex items-center justify-between px-4 md:hidden" style={{ background: 'hsl(var(--card))', borderBottom: '1px solid hsl(var(--border))' }}>
          <button onClick={() => setMobileOpen(true)} className="text-muted-foreground hover:text-white transition-colors p-1">
            <Menu className="w-6 h-6" />
          </button>
          <BrandLockup height={28} className="text-white" />
          <button onClick={logout} className="text-muted-foreground hover:text-white transition-colors p-1">
            <LogOut className="w-5 h-5" />
          </button>
        </header>
        
        <div className="flex-1 overflow-auto p-4 md:p-8">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="max-w-7xl mx-auto"
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
