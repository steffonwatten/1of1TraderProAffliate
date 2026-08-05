import React, { useState } from 'react';
import { useGetAffiliateCustomers } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, CheckCircle2, XCircle, Copy, Mail, Globe, TrendingUp, UserX, DollarSign, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

const FLAG_MAP: Record<string, string> = {
  US: '🇺🇸', GB: '🇬🇧', CA: '🇨🇦', AU: '🇦🇺', NG: '🇳🇬', GH: '🇬🇭', ZA: '🇿🇦',
  DE: '🇩🇪', FR: '🇫🇷', IN: '🇮🇳', BR: '🇧🇷', SG: '🇸🇬', AE: '🇦🇪', KE: '🇰🇪',
};

type Customer = {
  id: number;
  email: string | null;
  name: string | null;
  country: string | null;
  membershipStatus: string;
  planId: string | null;
  totalRevenue: number;
  yourEarnings: number;
  joinedAt: string | null;
  renewalDate: string | null;
  canceledAt: string | null;
};

const STATUS_LABELS: Record<string, { label: string; color: string; dot: string }> = {
  active: { label: 'Active', color: 'text-green-400', dot: 'bg-green-400' },
  trialing: { label: 'Trial', color: 'text-blue-400', dot: 'bg-blue-400' },
  past_due: { label: 'Past Due', color: 'text-yellow-400', dot: 'bg-yellow-400' },
  canceled: { label: 'Cancelled', color: 'text-red-400', dot: 'bg-red-400' },
  expired: { label: 'Expired', color: 'text-red-400/80', dot: 'bg-red-400/80' },
};

function CustomerRow({ c, toast }: { c: Customer; toast: any }) {
  const isActive = c.membershipStatus === 'active' || c.membershipStatus === 'trialing';
  const statusInfo = STATUS_LABELS[c.membershipStatus] ?? STATUS_LABELS.expired;
  const flag = c.country ? (FLAG_MAP[c.country] ?? '🌍') : null;
  const initials = (c.name || c.email || 'U').charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      {/* Avatar */}
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isActive ? 'bg-green-500/15 text-green-400 border border-green-500/25' : 'bg-red-500/10 text-red-400/70 border border-red-500/15'}`}>
        {initials}
      </div>

      {/* Customer Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-white text-sm truncate">{c.name || 'Member'}</p>
          {flag && <span className="text-base">{flag}</span>}
          <span className={`flex items-center gap-1 text-xs ${statusInfo.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot} ${isActive ? 'animate-pulse' : ''}`} />
            {statusInfo.label}
          </span>
        </div>
        {c.email ? (
          <button
            onClick={() => { navigator.clipboard.writeText(c.email!); toast({ title: 'Email copied!' }); }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mt-0.5 group"
          >
            <span className="truncate max-w-[200px]">{c.email}</span>
            <Copy className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </button>
        ) : (
          <p className="text-xs text-muted-foreground/50 mt-0.5 italic">No email</p>
        )}
      </div>

      {/* Dates */}
      <div className="hidden md:flex flex-col items-end gap-0.5 shrink-0 text-right w-28">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {isActive ? 'Joined' : 'Churned'}
        </p>
        <p className="text-xs text-white">
          {isActive ? formatDate(c.joinedAt) : formatDate(c.canceledAt ?? c.renewalDate)}
        </p>
      </div>

      {/* Revenue */}
      <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0 text-right w-28">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <DollarSign className="w-3 h-3" />
          Revenue
        </p>
        <p className="text-xs text-white">{c.totalRevenue > 0 ? formatCurrency(c.totalRevenue) : '—'}</p>
      </div>

      {/* Earnings */}
      <div className="flex flex-col items-end gap-0.5 shrink-0 text-right w-20">
        <p className="text-xs text-muted-foreground">Earned</p>
        <p className="text-sm font-bold text-primary">{c.yourEarnings > 0 ? formatCurrency(c.yourEarnings) : '—'}</p>
      </div>

      {/* Contact */}
      {c.email && (
        <a
          href={`mailto:${c.email}`}
          className="hidden lg:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary/80 text-muted-foreground hover:text-white text-xs font-medium transition-colors shrink-0"
        >
          <Mail className="w-3 h-3" />
          Contact
        </a>
      )}
    </div>
  );
}

export default function AffiliateCustomers() {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useGetAffiliateCustomers({});
  const { toast } = useToast();

  const allCustomers: Customer[] = data?.customers ?? [];

  const filtered = allCustomers.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.email ?? '').toLowerCase().includes(q) || (c.name ?? '').toLowerCase().includes(q);
  });

  const active = filtered.filter(c => c.membershipStatus === 'active' || c.membershipStatus === 'trialing');
  const inactive = filtered.filter(c => c.membershipStatus !== 'active' && c.membershipStatus !== 'trialing');

  if (isLoading) return (
    <div className="animate-pulse space-y-6">
      <div className="h-9 bg-secondary rounded w-1/3" />
      <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i=><div key={i} className="h-24 bg-secondary rounded-xl"/>)}</div>
      <div className="h-64 bg-secondary rounded-xl" />
    </div>
  );

  const totalRevenue = allCustomers.reduce((s, c) => s + c.totalRevenue, 0);
  const totalEarnings = allCustomers.reduce((s, c) => s + c.yourEarnings, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold">My Customers</h1>
        <p className="text-muted-foreground mt-1">Members who joined through your referral links.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="glass-panel border-green-500/15">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-500/10 text-green-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="text-xl font-bold text-green-400">{data?.activeMembers ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel border-red-500/15">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center shrink-0">
              <UserX className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Churned</p>
              <p className="text-xl font-bold text-red-400">{(data?.totalCustomers ?? 0) - (data?.activeMembers ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel border-white/8">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/5 text-muted-foreground flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Revenue</p>
              <p className="text-xl font-bold text-white">{formatCurrency(totalRevenue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel border-primary/15">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Your Earnings</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(totalEarnings)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Input
        placeholder="Search by name or email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-sm bg-secondary/50"
      />

      {/* Tabs */}
      <Tabs defaultValue="active">
        <TabsList className="bg-secondary/50 border border-white/10">
          <TabsTrigger value="active">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              Active <span className="bg-green-500/15 text-green-400 text-xs px-2 py-0.5 rounded-full font-medium">{active.length}</span>
            </span>
          </TabsTrigger>
          <TabsTrigger value="inactive">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400/70" />
              Inactive <span className="bg-red-500/15 text-red-400 text-xs px-2 py-0.5 rounded-full font-medium">{inactive.length}</span>
            </span>
          </TabsTrigger>
          <TabsTrigger value="all">All ({filtered.length})</TabsTrigger>
        </TabsList>

        {[
          { key: 'active', list: active, emptyIcon: CheckCircle2, emptyMsg: search ? 'No active members match your search.' : 'No active members yet — share your link!' },
          { key: 'inactive', list: inactive, emptyIcon: UserX, emptyMsg: search ? 'No inactive members match your search.' : 'No churned members — great retention! 🎉' },
          { key: 'all', list: filtered, emptyIcon: Users, emptyMsg: search ? 'No customers match your search.' : 'No customers yet — refer your first member!' },
        ].map(tab => (
          <TabsContent key={tab.key} value={tab.key} className="mt-4">
            <Card className="glass-panel">
              <CardContent className="p-0">
                {tab.list.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                    <tab.emptyIcon className="w-8 h-8 text-muted-foreground/25" />
                    <p className="text-sm">{tab.emptyMsg}</p>
                  </div>
                ) : (
                  tab.list.map(c => <CustomerRow key={c.id} c={c} toast={toast} />)
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
