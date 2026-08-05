import React, { useState } from 'react';
import { useGetAffiliateDashboard } from '@workspace/api-client-react';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  MousePointerClick, Users, DollarSign, Wallet, 
  Activity, Copy, CheckCircle2, ArrowRight, Link as LinkIcon,
  BarChart3, TrendingUp, Gift, Settings, Shield
} from 'lucide-react';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const FLAG_MAP: Record<string, string> = {
  US: '🇺🇸', GB: '🇬🇧', CA: '🇨🇦', AU: '🇦🇺', NG: '🇳🇬', GH: '🇬🇭', ZA: '🇿🇦',
  DE: '🇩🇪', FR: '🇫🇷', IN: '🇮🇳', BR: '🇧🇷', JP: '🇯🇵', SG: '🇸🇬', AE: '🇦🇪',
  KE: '🇰🇪', PK: '🇵🇰', PH: '🇵🇭', MX: '🇲🇽', NL: '🇳🇱', ES: '🇪🇸', IT: '🇮🇹',
};

export default function AffiliateDashboard() {
  const { data, isLoading } = useGetAffiliateDashboard();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-9 bg-secondary rounded w-1/2" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1,2,3,4].map(i=><div key={i} className="h-28 bg-secondary rounded-xl"/>)}</div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><div className="lg:col-span-2 h-72 bg-secondary rounded-xl"/><div className="h-72 bg-secondary rounded-xl"/></div>
      </div>
    );
  }

  const handleCopy = () => {
    if (!data?.referralLink) return;
    navigator.clipboard.writeText(data.referralLink);
    setCopied(true);
    toast({ title: 'Link copied!', description: 'Your referral link is ready to share.' });
    setTimeout(() => setCopied(false), 2500);
  };

  const chartData = (data?.salesOverTime?.length ?? 0) > 0
    ? data!.salesOverTime.map(d => ({ date: formatDate(d.date), sales: d.value }))
    : [{ date: 'Today', sales: 0 }];

  const clickChartData = (data?.clicksByDay?.length ?? 0) > 0
    ? data!.clicksByDay.map(d => ({ date: formatDate(d.date), clicks: d.value }))
    : [{ date: 'Today', clicks: 0 }];

  const hasPaymentMethod = !!data?.paymentMethod;
  const hasReferralClicks = (data?.totalClicks ?? 0) > 0;
  const hasPaidCustomer = (data?.paidCustomers ?? 0) > 0;
  const profileComplete = !!data?.affiliateCode;

  const checklist = [
    { done: profileComplete, label: 'Account activated', href: '/dashboard/profile' },
    { done: hasPaymentMethod, label: 'Payment method added', href: '/dashboard/profile' },
    { done: hasReferralClicks, label: 'First referral click', href: '/dashboard/links' },
    { done: hasPaidCustomer, label: 'First paying customer', href: '/dashboard/customers' },
  ];
  const checklistDone = checklist.filter(c => c.done).length;
  const checklistPct = (checklistDone / checklist.length) * 100;

  const quickActions = [
    { label: 'Copy Link', icon: Copy, action: handleCopy, primary: true },
    { label: 'Create Campaign', icon: LinkIcon, href: '/dashboard/links', primary: false },
    { label: 'View Analytics', icon: BarChart3, href: '/dashboard/analytics', primary: false },
    { label: 'Request Payout', icon: Wallet, href: '/dashboard/payouts', primary: false },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Partner Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {data?.affiliateCode ? (
              <>Your code: <span className="font-mono text-primary font-bold">{data.affiliateCode}</span> · {data.commissionRate ?? 25}% commission rate</>
            ) : 'Welcome back. Here\'s your performance summary.'}
          </p>
        </div>
        {/* Referral Link Copy */}
        <div className="flex items-center gap-2 bg-secondary/40 border border-white/8 rounded-xl p-2 pl-4 max-w-sm w-full">
          <span className="text-xs text-muted-foreground truncate flex-1 font-mono">{data?.referralLink ?? '—'}</span>
          <Button onClick={handleCopy} size="sm" className="shrink-0 bg-primary text-background hover:bg-primary/90 h-8 px-3">
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        {quickActions.map((a, i) => {
          const Icon = a.icon;
          if (a.action) return (
            <Button key={i} onClick={a.action} variant={a.primary ? 'default' : 'outline'} size="sm" className={a.primary ? 'bg-primary text-background hover:bg-primary/90' : 'border-white/10 hover:border-white/20'}>
              <Icon className="w-3.5 h-3.5 mr-1.5" />{a.label}
            </Button>
          );
          return (
            <Link key={i} href={a.href!}>
              <Button variant={a.primary ? 'default' : 'outline'} size="sm" className={a.primary ? 'bg-primary text-background hover:bg-primary/90' : 'border-white/10 hover:border-white/20'}>
                <Icon className="w-3.5 h-3.5 mr-1.5" />{a.label}
              </Button>
            </Link>
          );
        })}
      </div>

      {/* Onboarding Checklist */}
      {checklistDone < checklist.length && (
        <Card className="glass-panel border-primary/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-3xl rounded-full pointer-events-none" />
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Gift className="w-5 h-5 text-primary" />
                Getting Started
              </CardTitle>
              <span className="text-xs text-muted-foreground font-medium">{checklistDone}/{checklist.length} complete</span>
            </div>
            <Progress value={checklistPct} className="h-1.5 bg-white/10 mt-2" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {checklist.map((item, i) => (
                <Link key={i} href={item.href}>
                  <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${item.done ? 'border-green-500/20 bg-green-500/5' : 'border-white/8 hover:border-white/15 hover:bg-white/[0.02]'}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${item.done ? 'bg-green-500 border-green-500' : 'border-white/20'}`}>
                      {item.done && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                    <span className={`text-sm flex-1 ${item.done ? 'text-muted-foreground line-through' : 'text-white'}`}>{item.label}</span>
                    {!item.done && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Clicks" value={data?.totalClicks ?? 0} icon={MousePointerClick} />
        <StatCard title="Paid Customers" value={data?.paidCustomers ?? 0} icon={Users} />
        <StatCard title="Conversion Rate" value={`${(data?.conversionRate ?? 0).toFixed(1)}%`} icon={Activity} />
        <StatCard title="Revenue Generated" value={formatCurrency(data?.revenueGenerated ?? 0)} icon={DollarSign} />
      </div>

      {/* Commission Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="glass-panel border-primary/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full pointer-events-none" />
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Unpaid Commissions</p>
              <p className="text-2xl font-bold text-primary mt-0.5">{formatCurrency(data?.unpaidCommissions ?? 0)}</p>
              <Link href="/dashboard/payouts">
                <span className="text-xs text-primary/70 hover:text-primary transition-colors flex items-center gap-1 mt-1">
                  Request payout <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel border-green-500/20">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 text-green-500 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Paid Out</p>
              <p className="text-2xl font-bold text-green-400 mt-0.5">{formatCurrency(data?.paidCommissions ?? 0)}</p>
              <Link href="/dashboard/commissions">
                <span className="text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors flex items-center gap-1 mt-1">
                  View history <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="glass-panel lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Clicks Over Time
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={clickChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashClicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} itemStyle={{ color: 'hsl(var(--primary))' }} />
                <Area type="monotone" dataKey="clicks" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#dashClicks)" dot={{ fill: 'hsl(var(--primary))', r: 3 }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="text-base">Top Countries</CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.topCountries?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm gap-2">
                <MousePointerClick className="w-8 h-8 text-muted-foreground/30" />
                <p>Share your link to see geographic data</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data!.topCountries.slice(0, 6).map((c, i) => {
                  const flag = FLAG_MAP[c.country] ?? '🌍';
                  const pct = i === 0 ? 100 : Math.round((c.count / data!.topCountries[0].count) * 100);
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-lg shrink-0">{flag}</span>
                          <span className="text-sm font-medium text-white truncate">{c.country}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-bold text-primary">{c.count}</span>
                          <span className="text-xs text-muted-foreground w-9 text-right">{c.percentage.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="h-1 bg-white/8 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
