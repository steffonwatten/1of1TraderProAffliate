import React, { useState, useEffect } from 'react';
import { useGetAdminOverview } from '@workspace/api-client-react';
import { StatCard } from '@/components/ui/StatCard';
import { 
  Users, UserCheck, FilePlus, MousePointerClick, 
  UserPlus, DollarSign, Wallet, Activity, RefreshCw, CheckCircle2, AlertCircle,
  TrendingUp, ShoppingCart, BarChart2, CalendarDays
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, ComposedChart, Line
} from 'recharts';

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

type SyncStatus = 'idle' | 'loading' | 'success' | 'error';

async function callAdminSync(endpoint: string): Promise<string> {
  const token = localStorage.getItem('auth_token') ?? '';
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data.message ?? 'Done';
}

type WhopStats = {
  totalMembers: number;
  activeMembers: number;
  totalRevenue: number;
  totalSales: number;
  mrr: number;
  error?: string;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-xl text-sm">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name === 'revenue' ? formatCurrency(p.value) : `${p.value} sales`}
        </p>
      ))}
    </div>
  );
};

export default function AdminOverview() {
  const { data, isLoading, refetch } = useGetAdminOverview();
  const [syncState, setSyncState] = useState<Record<string, SyncStatus>>({});
  const [syncMsg, setSyncMsg] = useState<Record<string, string>>({});
  const [whopStats, setWhopStats] = useState<WhopStats | null>(null);
  const [whopLoading, setWhopLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('auth_token') ?? '';
    fetch('/api/admin/whop/stats', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setWhopStats(d))
      .catch(() => setWhopStats({ totalMembers: 0, activeMembers: 0, totalRevenue: 0, totalSales: 0, mrr: 0, error: 'Failed to load' }))
      .finally(() => setWhopLoading(false));
  }, []);

  const runSync = async (key: string, endpoint: string) => {
    setSyncState(s => ({ ...s, [key]: 'loading' }));
    setSyncMsg(s => ({ ...s, [key]: '' }));
    try {
      const msg = await callAdminSync(endpoint);
      setSyncState(s => ({ ...s, [key]: 'success' }));
      setSyncMsg(s => ({ ...s, [key]: msg }));
      refetch();
    } catch (err: any) {
      setSyncState(s => ({ ...s, [key]: 'error' }));
      setSyncMsg(s => ({ ...s, [key]: err?.message ?? 'Failed' }));
    }
  };

  if (isLoading || !data) {
    return (
      <div className="animate-pulse space-y-8">
        <div className="h-8 bg-secondary rounded w-1/4" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-32 bg-secondary rounded-xl" />)}
        </div>
      </div>
    );
  }

  // Build daily sales chart data
  const salesByDay: { date: string; revenue: number; sales: number }[] = (data as any).salesByDay ?? [];
  const chartData = salesByDay.map(d => ({ ...d, name: formatDate(d.date) }));

  // Today's revenue
  const todayStr = new Date().toISOString().split('T')[0];
  const todayData = salesByDay.find(d => d.date === todayStr);
  const todayRevenue = todayData?.revenue ?? 0;
  const todaySales = todayData?.sales ?? 0;

  // Total revenue last 30 days
  const totalRevenue30 = salesByDay.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold">Admin Overview</h1>
        <p className="text-muted-foreground mt-1">Platform performance and affiliate metrics.</p>
      </div>

      {/* Whop Platform Revenue — live from Whop API */}
      <Card className="glass-panel border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart2 className="w-4 h-4 text-primary" />
            Whop Platform Revenue
            <span className="ml-auto text-xs text-muted-foreground font-normal">Live from Whop</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {whopLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <div key={i} className="h-16 bg-secondary/50 rounded-lg animate-pulse" />)}
            </div>
          ) : whopStats?.error ? (
            <p className="text-sm text-red-400">{whopStats.error}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-secondary/40 rounded-lg p-4 border border-white/5">
                <p className="text-xs text-muted-foreground mb-1">Total Revenue</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(whopStats?.totalRevenue ?? 0)}</p>
              </div>
              <div className="bg-secondary/40 rounded-lg p-4 border border-white/5">
                <p className="text-xs text-muted-foreground mb-1">Est. MRR</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(whopStats?.mrr ?? 0)}</p>
              </div>
              <div className="bg-secondary/40 rounded-lg p-4 border border-white/5">
                <p className="text-xs text-muted-foreground mb-1">Total Sales</p>
                <p className="text-2xl font-bold text-white">{(whopStats?.totalSales ?? 0).toLocaleString()}</p>
              </div>
              <div className="bg-secondary/40 rounded-lg p-4 border border-white/5">
                <p className="text-xs text-muted-foreground mb-1">Active Members</p>
                <p className="text-2xl font-bold text-white">{(whopStats?.activeMembers ?? 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{(whopStats?.totalMembers ?? 0).toLocaleString()} total</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stat cards — real data from our DB */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Today's Revenue" value={formatCurrency(todayRevenue)} icon={CalendarDays} delay={0.05}
          subtitle={todaySales > 0 ? `${todaySales} sale${todaySales !== 1 ? 's' : ''} today` : 'No sales yet today'} />
        <StatCard title="Revenue (30d)" value={formatCurrency(totalRevenue30)} icon={DollarSign} delay={0.1} />
        <StatCard title="Commissions Paid" value={formatCurrency(data.totalCommissionsPaid)} icon={Wallet} delay={0.2} />
        <StatCard title="Commissions Owed" value={formatCurrency(data.totalCommissionsOwed)} icon={Activity} delay={0.25} />

        <StatCard title="Active Affiliates" value={data.activeAffiliates} icon={UserCheck} delay={0.3} />
        <StatCard title="Pending Apps" value={data.pendingApplications} icon={FilePlus} delay={0.4} />
        <StatCard title="Total Clicks" value={data.totalClicks} icon={MousePointerClick} delay={0.5} />
        <StatCard title="Total Members" value={data.totalSignups} icon={Users} delay={0.6} />
      </div>

      {/* Daily Sales Chart — real data */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Daily Sales — Last 30 Days
            <span className="ml-auto text-xs text-muted-foreground font-normal">
              {salesByDay.length} day{salesByDay.length !== 1 ? 's' : ''} with sales · {formatCurrency(totalRevenue30)} total
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              No sales data in the last 30 days. Run a sync to pull Whop history.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  yAxisId="revenue"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `$${v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}`}
                />
                <YAxis yAxisId="sales" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="revenue"
                  name="revenue"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                />
                <Bar
                  yAxisId="sales"
                  dataKey="sales"
                  name="sales"
                  fill="hsl(var(--primary))"
                  opacity={0.25}
                  radius={[3, 3, 0, 0]}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Affiliates */}
        <Card className="glass-panel lg:col-span-2">
          <CardHeader>
            <CardTitle>Top Affiliates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topAffiliates.length > 0 ? (
                data.topAffiliates.map((affiliate, i) => (
                  <div key={affiliate.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-white">{affiliate.fullName}</p>
                        <p className="text-xs text-muted-foreground">{affiliate.totalCustomers} customer{affiliate.totalCustomers !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{formatCurrency(affiliate.totalRevenue)}</p>
                      {affiliate.unpaidCommission > 0 && (
                        <p className="text-xs text-amber-400">{formatCurrency(affiliate.unpaidCommission)} owed</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">No affiliate revenue yet</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(data as any).recentActivity?.length > 0 ? (
                (data as any).recentActivity.slice(0, 6).map((act: any, i: number) => (
                  <div key={i} className="flex gap-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div>
                      <p className="text-white/80 text-xs leading-snug">{act.description}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        {new Date(act.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">No recent activity</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sync & Maintenance */}
      <Card className="glass-panel border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-primary" />
            Sync & Maintenance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Manually pull data from Whop and backfill any missing payment records for affiliate-attributed memberships.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { key: 'fullsync', label: 'Full Historical Sync', endpoint: '/api/admin/sync/whop/full', desc: 'Backdate all Whop history — memberships, payments, commissions & referral clicks' },
              { key: 'memberships', label: 'Sync Memberships', endpoint: '/api/admin/sync/whop/memberships', desc: 'Pull latest memberships from Whop' },
              { key: 'payments', label: 'Sync Payments', endpoint: '/api/admin/sync/whop/payments', desc: 'Pull invoices/payments from Whop API' },
              { key: 'backfill', label: 'Backfill Missing Revenue', endpoint: '/api/admin/backfill/membership-payments', desc: 'Create payment records for memberships with no revenue logged' },
            ].map(({ key, label, endpoint, desc }) => (
              <div key={key} className="flex flex-col gap-2 p-4 bg-secondary/30 rounded-lg border border-white/5">
                <p className="font-medium text-sm text-white">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
                <Button
                  size="sm"
                  variant={syncState[key] === 'error' ? 'destructive' : 'outline'}
                  className="mt-auto"
                  disabled={syncState[key] === 'loading'}
                  onClick={() => runSync(key, endpoint)}
                >
                  {syncState[key] === 'loading' ? (
                    <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />
                  ) : syncState[key] === 'success' ? (
                    <CheckCircle2 className="w-3 h-3 mr-1.5 text-green-500" />
                  ) : syncState[key] === 'error' ? (
                    <AlertCircle className="w-3 h-3 mr-1.5" />
                  ) : (
                    <RefreshCw className="w-3 h-3 mr-1.5" />
                  )}
                  {syncState[key] === 'loading' ? 'Running...' : 'Run'}
                </Button>
                {syncMsg[key] && (
                  <p className={`text-xs mt-1 ${syncState[key] === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                    {syncMsg[key]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
