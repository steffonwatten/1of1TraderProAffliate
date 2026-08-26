import React, { useState } from 'react';
import { useGetAffiliateCommissions } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Clock, CheckCircle2, Percent, ArrowUpRight, Info, TrendingUp } from 'lucide-react';

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const statusConfig: Record<string, { color: string; label: string; dot: string }> = {
  pending: { color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/25', label: 'Pending', dot: 'bg-yellow-400' },
  paid: { color: 'bg-green-500/10 text-green-400 border-green-500/25', label: 'Paid', dot: 'bg-green-400' },
  cancelled: { color: 'bg-red-500/10 text-red-400 border-red-500/25', label: 'Cancelled', dot: 'bg-red-400' },
};

const commissionTypeLabel: Record<string, string> = {
  initial: 'Initial Sale',
  recurring: 'Renewal',
  percent: 'Commission',
};

export default function AffiliateCommissions() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const { data, isLoading } = useGetAffiliateCommissions({ status: statusFilter === 'all' ? undefined : statusFilter });

  if (isLoading) return (
    <div className="animate-pulse space-y-6">
      <div className="h-9 bg-secondary rounded w-1/3" />
      <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i=><div key={i} className="h-24 bg-secondary rounded-xl"/>)}</div>
      <div className="h-64 bg-secondary rounded-xl" />
    </div>
  );

  const commissions = (data?.commissions ?? []).filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.customerEmail ?? '').toLowerCase().includes(q) || (c.customerName ?? '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold">Commissions</h1>
        <p className="text-muted-foreground mt-1">Your commission earnings, statuses, and payout history.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="glass-panel border-primary/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-28 h-28 bg-primary/10 blur-3xl rounded-full pointer-events-none" />
          <CardContent className="p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Earned</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(data?.totalEarned ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel border-yellow-500/15">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 text-yellow-400 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Pending Payout</p>
              <p className="text-2xl font-bold text-yellow-400">{formatCurrency(data?.totalPending ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel border-green-500/15">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 text-green-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Paid Out</p>
              <p className="text-2xl font-bold text-green-400">{formatCurrency(data?.totalPaid ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          You earn commission on <strong className="text-white">initial sales</strong> and <strong className="text-white">renewals</strong> from customers you referred. Pending commissions are paid out when you request a payout.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Search by customer..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-56 bg-secondary/50"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 bg-secondary/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="glass-panel">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <th className="text-left px-6 py-4 text-muted-foreground font-medium text-xs uppercase tracking-wider">Customer</th>
                  <th className="text-left px-6 py-4 text-muted-foreground font-medium text-xs uppercase tracking-wider">Type</th>
                  <th className="text-left px-6 py-4 text-muted-foreground font-medium text-xs uppercase tracking-wider">Sale Amount</th>
                  <th className="text-left px-6 py-4 text-muted-foreground font-medium text-xs uppercase tracking-wider">Your Earnings</th>
                  <th className="text-left px-6 py-4 text-muted-foreground font-medium text-xs uppercase tracking-wider">Rate</th>
                  <th className="text-left px-6 py-4 text-muted-foreground font-medium text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-4 text-muted-foreground font-medium text-xs uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                {commissions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <DollarSign className="w-8 h-8 text-muted-foreground/30" />
                        <p className="text-sm">{search || statusFilter !== 'all' ? 'No commissions match your filters.' : 'No commissions yet — refer customers to start earning!'}</p>
                      </div>
                    </td>
                  </tr>
                )}
                {commissions.map((c) => {
                  const sc = statusConfig[c.status] ?? statusConfig.pending;
                  const typeKey = c.commissionType?.toLowerCase() ?? '';
                  const typeLabel = commissionTypeLabel[typeKey] ?? (c.commissionType?.replace(/_/g, ' ') ?? 'Commission');
                  const customerDisplay = c.customerName || c.customerEmail || 'Member';
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }} className="hover:bg-white/[0.015] transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-white">{customerDisplay}</p>
                          {c.customerEmail && c.customerName && (
                            <p className="text-xs text-muted-foreground mt-0.5">{c.customerEmail}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${typeKey === 'recurring' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-white/8 text-muted-foreground'}`}>
                          {typeKey === 'recurring' && <ArrowUpRight className="w-3 h-3" />}
                          {typeLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-sm">
                        {c.saleAmount ? formatCurrency(c.saleAmount) : '—'}
                      </td>
                      <td className="px-6 py-4 font-bold text-primary">{formatCurrency(c.amount)}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {c.rateType === 'percent'
                          ? <span className="flex items-center gap-1 text-sm"><Percent className="w-3 h-3" />{c.rateValue}%</span>
                          : <span>{formatCurrency(c.rateValue)}</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${sc.color}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-xs">{c.createdAt ? formatDate(c.createdAt) : '—'}</td>
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
