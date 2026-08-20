import React, { useState } from 'react';
import { Link } from 'wouter';
import { useGetAdminMemberships } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, CheckCircle2, XCircle, RefreshCw, ExternalLink } from 'lucide-react';

const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

const statusConfig: Record<string, { color: string; label: string }> = {
  active:    { color: 'bg-green-500/10 text-green-500 border-green-500/20',   label: 'Active' },
  expired:   { color: 'bg-red-500/10 text-red-500 border-red-500/20',         label: 'Expired' },
  trialing:  { color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',      label: 'Trialing' },
  canceled:  { color: 'bg-gray-500/10 text-gray-400 border-gray-500/20',      label: 'Canceled' },
  completed: { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',   label: 'Completed' },
};

export default function AdminMemberships() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { data, isLoading } = useGetAdminMemberships({ status: statusFilter === 'all' ? undefined : statusFilter });

  const rawMemberships = (data as any)?.memberships ?? [];
  const filtered = rawMemberships.filter((m: any) =>
    !search || m.customerEmail?.toLowerCase().includes(search.toLowerCase()) || m.customerName?.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 bg-secondary rounded w-1/3" />
      <div className="h-64 bg-secondary rounded-xl" />
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold">Memberships</h1>
        <p className="text-muted-foreground mt-1">All Whop memberships synced from your platform.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total',     value: (data as any)?.total ?? 0,          color: 'text-primary',     bg: 'bg-primary/10',       icon: <Users className="w-5 h-5" /> },
          { label: 'Active',    value: (data as any)?.totalActive ?? 0,    color: 'text-green-500',   bg: 'bg-green-500/10',     icon: <CheckCircle2 className="w-5 h-5" /> },
          { label: 'Trialing',  value: (data as any)?.totalTrialing ?? 0,  color: 'text-cyan-500',    bg: 'bg-cyan-500/10',      icon: <RefreshCw className="w-5 h-5" /> },
          { label: 'Completed', value: (data as any)?.totalCompleted ?? 0, color: 'text-amber-400',   bg: 'bg-amber-500/10',     icon: <CheckCircle2 className="w-5 h-5" /> },
          { label: 'Expired',   value: (data as any)?.totalExpired ?? 0,   color: 'text-red-500',     bg: 'bg-red-500/10',       icon: <XCircle className="w-5 h-5" /> },
          { label: 'Canceled',  value: (data as any)?.totalCanceled ?? 0,  color: 'text-gray-400',    bg: 'bg-gray-500/10',      icon: <XCircle className="w-5 h-5" /> },
        ].map(s => (
          <Card key={s.label} className="glass-panel">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${s.bg} ${s.color} flex items-center justify-center shrink-0`}>{s.icon}</div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <Input placeholder="Search by email or name..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm bg-secondary/50" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 bg-secondary/50"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trialing">Trialing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="glass-panel">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-6 py-4 text-muted-foreground font-medium">Customer</th>
                  <th className="text-left px-6 py-4 text-muted-foreground font-medium">Plan</th>
                  <th className="text-left px-6 py-4 text-muted-foreground font-medium">Status</th>
                  <th className="text-left px-6 py-4 text-muted-foreground font-medium">Affiliate</th>
                  <th className="text-left px-6 py-4 text-muted-foreground font-medium">Revenue</th>
                  <th className="text-left px-6 py-4 text-muted-foreground font-medium">Started</th>
                  <th className="text-left px-6 py-4 text-muted-foreground font-medium">Expires</th>
                  <th className="px-6 py-4" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">No memberships found.</td></tr>
                )}
                {filtered.map((m: any) => {
                  const sc = statusConfig[m.status] ?? statusConfig.expired;
                  const rev = Number(m.totalRevenue ?? 0);
                  return (
                    <tr key={m.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-white">{m.customerName || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{m.customerEmail || m.whopUserId || '—'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs px-2 py-1 bg-secondary rounded-full text-muted-foreground">{m.whopPlanId || 'Default'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${sc.color}`}>{sc.label}</span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-xs">{m.affiliateName || '—'}</td>
                      <td className="px-6 py-4 font-bold text-primary">
                        {rev > 0 ? formatCurrency(rev) : <span className="text-muted-foreground font-normal">$0</span>}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{m.startDate ? formatDate(m.startDate) : '—'}</td>
                      <td className="px-6 py-4 text-muted-foreground">{m.renewalDate ? formatDate(m.renewalDate) : 'Lifetime'}</td>
                      <td className="px-6 py-4">
                        <Link href={`/admin/memberships/${m.id}/detail`}>
                          <button className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
