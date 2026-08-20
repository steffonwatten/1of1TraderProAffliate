import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, Users, RefreshCw,
  Download, ArrowUpRight, ArrowDownRight, Minus,
  CreditCard, PiggyBank, AlertCircle,
} from 'lucide-react';

const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
const fmtK = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : fmt(v);

const token = () => localStorage.getItem('auth_token') ?? '';

function StatCard({
  label, value, sub, icon: Icon, color = 'text-primary', trend,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color?: string;
  trend?: { value: number; label: string };
}) {
  return (
    <Card className="glass-panel">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className={`w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          {trend && (
            <span className={`text-xs font-medium flex items-center gap-0.5 ${
              trend.value > 0 ? 'text-emerald-400' : trend.value < 0 ? 'text-red-400' : 'text-muted-foreground'
            }`}>
              {trend.value > 0 ? <ArrowUpRight className="w-3 h-3" /> :
               trend.value < 0 ? <ArrowDownRight className="w-3 h-3" /> :
               <Minus className="w-3 h-3" />}
              {Math.abs(trend.value).toFixed(1)}%
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mt-4 mb-1">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function downloadCSV(path: string, filename: string) {
  const a = document.createElement('a');
  a.href = `/api/admin/export/${path}`;
  a.setAttribute('download', filename);
  const headers = new Headers({ 'Authorization': `Bearer ${token()}` });
  fetch(a.href, { headers }).then(r => r.blob()).then(blob => {
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  });
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-white/10 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name === 'revenue' ? fmt(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

export default function AdminFinance() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch('/api/admin/finance', { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const momChange = data && data.lastMonthRevenue > 0
    ? ((data.thisMonthRevenue - data.lastMonthRevenue) / data.lastMonthRevenue) * 100
    : 0;

  if (loading) return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-secondary rounded w-1/4" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => <div key={i} className="h-28 bg-secondary rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-72 bg-secondary rounded-xl" />
        <div className="h-72 bg-secondary rounded-xl" />
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="text-center py-20">
      <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
      <p className="text-muted-foreground">{error ?? 'Failed to load finance data.'}</p>
      <Button variant="outline" className="mt-4" onClick={load}>Retry</Button>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-white">Finance</h1>
          <p className="text-muted-foreground mt-1">Revenue, commissions, and financial health at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 border-white/10" onClick={load}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
          <div className="relative group">
            <Button variant="outline" size="sm" className="gap-2 border-white/10">
              <Download className="w-4 h-4" /> Export
            </Button>
            <div className="absolute right-0 top-full mt-1 z-10 hidden group-hover:flex flex-col bg-background border border-white/10 rounded-lg shadow-xl min-w-[160px]">
              {[
                ['customers', 'Customers CSV'],
                ['affiliates', 'Affiliates CSV'],
                ['commissions', 'Commissions CSV'],
                ['payments', 'Payments CSV'],
              ].map(([path, label]) => (
                <button key={path}
                  className="px-4 py-2.5 text-sm text-left hover:bg-white/5 text-muted-foreground hover:text-white transition-colors first:rounded-t-lg last:rounded-b-lg"
                  onClick={() => downloadCSV(path, `${path}.csv`)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Revenue stats */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Revenue</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={DollarSign} label="Gross Revenue" value={fmt(data.grossRevenue)} sub="All time" color="text-primary" />
          <StatCard icon={TrendingUp} label="This Month" value={fmt(data.thisMonthRevenue)}
            sub={`vs ${fmt(data.lastMonthRevenue)} last month`} color="text-emerald-400"
            trend={{ value: momChange, label: 'vs last month' }} />
          <StatCard icon={TrendingUp} label="MRR (est.)" value={fmt(data.mrr)}
            sub={`ARR ${fmtK(data.arr)}`} color="text-cyan-400" />
          <StatCard icon={CreditCard} label="Avg. Order Value" value={fmt(data.aov)}
            sub={`${data.totalTransactions} transactions`} color="text-violet-400" />
        </div>
      </div>

      {/* Commission stats */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Commissions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={PiggyBank} label="Total Accrued" value={fmt(data.commissionsAccrued)}
            sub="All commissions created" color="text-amber-400" />
          <StatCard icon={DollarSign} label="Commissions Paid" value={fmt(data.commissionsPaid)}
            sub="Marked as paid" color="text-emerald-400" />
          <StatCard icon={AlertCircle} label="Liability (Pending)" value={fmt(data.commissionLiability)}
            sub="Awaiting payout" color="text-red-400" />
          <StatCard icon={TrendingDown} label="Net Revenue" value={fmt(data.netRevenue)}
            sub="After commissions accrued" color="text-white" />
        </div>
      </div>

      {/* Members */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Members</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total Members" value={String(data.totalMembers)} color="text-primary" />
          <StatCard icon={Users} label="Active Members" value={String(data.activeMembers)}
            sub={`${data.totalMembers > 0 ? ((data.activeMembers / data.totalMembers) * 100).toFixed(1) : 0}% of total`}
            color="text-emerald-400" />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily revenue chart */}
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Daily Revenue — Last 30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            {data.dailySales?.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.dailySales} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(43 96% 52%)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="hsl(43 96% 52%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 12%)" />
                  <XAxis dataKey="date" tick={{ fill: 'hsl(0 0% 40%)', fontSize: 10 }}
                    tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fill: 'hsl(0 0% 40%)', fontSize: 10 }}
                    tickFormatter={v => `$${v}`} width={50} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(43 96% 52%)"
                    fill="url(#revGrad)" strokeWidth={2} dot={false} name="revenue" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">No data in last 30 days.</p>
            )}
          </CardContent>
        </Card>

        {/* Revenue by affiliate */}
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue by Affiliate</CardTitle>
          </CardHeader>
          <CardContent>
            {data.revenueByAffiliate?.length > 0 ? (
              <div className="space-y-3 pt-2">
                {data.revenueByAffiliate.map((a: any, i: number) => {
                  const maxRev = data.revenueByAffiliate[0]?.total ?? 1;
                  const pct = (a.total / maxRev) * 100;
                  return (
                    <div key={a.affiliateId ?? i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-white font-medium truncate max-w-[160px]">{a.name}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-muted-foreground">{a.txCount} tx</span>
                          <span className="text-primary font-semibold">{fmt(a.total)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">No affiliate revenue yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue by plan */}
      <Card className="glass-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Revenue by Payment Type</CardTitle>
        </CardHeader>
        <CardContent>
          {data.revenueByPlan?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium text-right">Transactions</th>
                    <th className="pb-3 font-medium text-right">Total Revenue</th>
                    <th className="pb-3 font-medium text-right">Avg / Tx</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.revenueByPlan.map((p: any, i: number) => (
                    <tr key={p.planId + i} className="hover:bg-white/3 transition-colors">
                      <td className="py-3">
                        <code className="text-xs text-primary bg-primary/5 px-2 py-0.5 rounded font-mono">{p.planId}</code>
                      </td>
                      <td className="py-3 text-right text-muted-foreground">{p.txCount}</td>
                      <td className="py-3 text-right font-semibold text-white">{fmt(p.total)}</td>
                      <td className="py-3 text-right text-muted-foreground">{fmt(p.txCount > 0 ? p.total / p.txCount : 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No plan data yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
