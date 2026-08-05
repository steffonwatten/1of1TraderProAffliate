import React, { useState } from 'react';
import { useGetAdminCommissions } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Percent, CheckCircle2, Clock, XCircle } from 'lucide-react';

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const statusBadge = (status: string) => {
  const map: Record<string, { color: string; icon: React.ReactNode }> = {
    pending: { color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', icon: <Clock className="w-3 h-3" /> },
    paid: { color: 'bg-green-500/10 text-green-500 border-green-500/20', icon: <CheckCircle2 className="w-3 h-3" /> },
    cancelled: { color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: <XCircle className="w-3 h-3" /> },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${s.color}`}>
      {s.icon} {status}
    </span>
  );
};

export default function AdminCommissions() {
  const { data: commissions, isLoading } = useGetAdminCommissions();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const rawCommissions = (commissions as any)?.data ?? [];
  const filtered = rawCommissions.filter((c: any) => {
    const matchSearch = !search || c.affiliateName?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.commissionStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPending = Number((commissions as any)?.totalPending ?? 0);
  const totalPaid = Number((commissions as any)?.totalApproved ?? (commissions as any)?.totalPaid ?? 0);

  if (isLoading) return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 bg-secondary rounded w-1/3" />
      <div className="h-64 bg-secondary rounded-xl" />
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold">Commissions</h1>
        <p className="text-muted-foreground mt-1">Track and manage all affiliate commissions.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="glass-panel">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/10 text-yellow-500 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{formatCurrency(totalPending)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Paid</p>
                <p className="text-2xl font-bold">{formatCurrency(totalPaid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{formatCurrency(totalPending + totalPaid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <Input
          placeholder="Search by affiliate..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm bg-secondary/50"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-secondary/50">
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
                <tr className="border-b border-white/10">
                  <th className="text-left px-6 py-4 text-muted-foreground font-medium">Affiliate</th>
                  <th className="text-left px-6 py-4 text-muted-foreground font-medium">Type</th>
                  <th className="text-left px-6 py-4 text-muted-foreground font-medium">Amount</th>
                  <th className="text-left px-6 py-4 text-muted-foreground font-medium">Rate</th>
                  <th className="text-left px-6 py-4 text-muted-foreground font-medium">Status</th>
                  <th className="text-left px-6 py-4 text-muted-foreground font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">No commissions found.</td>
                  </tr>
                )}
                {filtered.map((c: any) => (
                  <tr key={c.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                    <td className="px-6 py-4 font-medium text-white">{c.affiliateName ?? '—'}</td>
                    <td className="px-6 py-4">
                      <span className="text-xs px-2 py-1 bg-secondary rounded-full text-muted-foreground capitalize">
                        {c.commissionType?.replace('_', ' ') ?? '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-primary">{formatCurrency(Number(c.commissionAmount ?? 0))}</td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {c.commissionType === 'percent'
                        ? <span className="flex items-center gap-1"><Percent className="w-3 h-3" />{c.commissionValue}%</span>
                        : formatCurrency(Number(c.commissionValue ?? 0))}
                    </td>
                    <td className="px-6 py-4">{statusBadge(c.commissionStatus)}</td>
                    <td className="px-6 py-4 text-muted-foreground">{c.createdAt ? formatDate(c.createdAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
