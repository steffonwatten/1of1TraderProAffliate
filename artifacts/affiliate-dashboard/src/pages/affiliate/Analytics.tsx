import React, { useState } from 'react';
import { useGetAffiliateAnalytics } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MousePointerClick, Users, TrendingUp, Globe, Activity, Wifi, DollarSign, BarChart3 } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';

const COLORS = ['hsl(var(--primary))', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#10b981'];
const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

const FLAG_MAP: Record<string, string> = {
  US: '🇺🇸', GB: '🇬🇧', CA: '🇨🇦', AU: '🇦🇺', NG: '🇳🇬', GH: '🇬🇭', ZA: '🇿🇦',
  DE: '🇩🇪', FR: '🇫🇷', IN: '🇮🇳', SG: '🇸🇬', AE: '🇦🇪', KE: '🇰🇪',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel border border-white/15 px-3 py-2.5 text-sm shadow-xl rounded-xl">
      <p className="text-muted-foreground mb-1.5 text-xs">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="font-semibold" style={{ color: p.color }}>
          {typeof p.value === 'number' && p.name?.toLowerCase().includes('earn') ? formatCurrency(p.value) : p.value} <span className="text-xs font-normal opacity-70">{p.name}</span>
        </p>
      ))}
    </div>
  );
};

export default function AffiliateAnalytics() {
  const [days, setDays] = useState('30');
  const { data, isLoading } = useGetAffiliateAnalytics({ days: parseInt(days) });

  if (isLoading) return (
    <div className="animate-pulse space-y-6">
      <div className="h-9 bg-secondary rounded w-1/3" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1,2,3,4].map(i=><div key={i} className="h-28 bg-secondary rounded-xl"/>)}</div>
      <div className="h-72 bg-secondary rounded-xl" />
      <div className="grid grid-cols-2 gap-4"><div className="h-64 bg-secondary rounded-xl"/><div className="h-64 bg-secondary rounded-xl"/></div>
    </div>
  );

  const clicksData = (data?.clicksByDay ?? []).map(d => ({ date: formatDate(d.date), clicks: d.value ?? 0 }));
  const countryData = (data?.clicksByCountry ?? []).slice(0, 8);
  const sourceData = (data?.clicksBySource ?? []).map(s => ({ ...s, source: s.source || 'Direct' }));
  const totalSrcClicks = sourceData.reduce((a, s) => a + s.count, 0);

  const maxClicks = Math.max(...clicksData.map(d => d.clicks), 1);
  const yDomain: [number, number] = [0, Math.max(maxClicks + 1, 5)];

  const stats = [
    { label: 'Total Clicks', value: data?.totalClicks ?? 0, icon: MousePointerClick, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Unique Visitors', value: data?.uniqueVisitors ?? 0, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'New Signups', value: data?.totalSignups ?? 0, icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Conv. Rate', value: `${(data?.conversionRate ?? 0).toFixed(1)}%`, icon: Activity, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold">Analytics</h1>
          <p className="text-muted-foreground mt-1">Your referral traffic, conversions, and performance.</p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-40 bg-secondary/50"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="glass-panel">
              <CardContent className="p-5 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${s.bg} ${s.color} flex items-center justify-center shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="traffic">
        <TabsList className="bg-secondary/50 border border-white/10">
          <TabsTrigger value="traffic"><MousePointerClick className="w-4 h-4 mr-1.5" />Traffic</TabsTrigger>
          <TabsTrigger value="geography"><Globe className="w-4 h-4 mr-1.5" />Geography</TabsTrigger>
          <TabsTrigger value="sources"><Wifi className="w-4 h-4 mr-1.5" />Sources</TabsTrigger>
        </TabsList>

        {/* Traffic Tab */}
        <TabsContent value="traffic" className="mt-6">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MousePointerClick className="w-5 h-5 text-primary" />
                Clicks Over Time
              </CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              {clicksData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                  <MousePointerClick className="w-8 h-8 text-muted-foreground/25" />
                  <p className="text-sm">No click data for this period.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={clicksData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="analyticsClicks" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} domain={yDomain} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="clicks" name="clicks" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#analyticsClicks)" dot={{ fill: 'hsl(var(--primary))', r: 3 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Geography Tab */}
        <TabsContent value="geography" className="mt-6">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Top Countries
              </CardTitle>
            </CardHeader>
            <CardContent>
              {countryData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                  <Globe className="w-8 h-8 text-muted-foreground/25" />
                  <p className="text-sm">No geographic data for this period.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {countryData.map((c, i) => {
                    const flag = FLAG_MAP[c.country] ?? '🌍';
                    const pct = countryData[0]?.count > 0 ? Math.round((c.count / countryData[0].count) * 100) : 0;
                    return (
                      <div key={`${c.country}-${i}`} className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground w-4 shrink-0 text-right">{i + 1}</span>
                        <span className="text-lg shrink-0">{flag}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium text-white">{c.country}</span>
                            <div className="flex items-center gap-3 shrink-0 ml-2">
                              <span className="text-sm font-bold text-primary">{c.count}</span>
                              <span className="text-xs text-muted-foreground w-9 text-right">{c.percentage.toFixed(1)}%</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sources Tab */}
        <TabsContent value="sources" className="mt-6">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="w-5 h-5 text-primary" />
                Traffic Sources
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sourceData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                  <Wifi className="w-8 h-8 text-muted-foreground/25" />
                  <p className="text-sm">No source data for this period.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sourceData.map((s, i) => {
                    const pct = totalSrcClicks > 0 ? Math.round((s.count / totalSrcClicks) * 100) : 0;
                    const barPct = sourceData[0]?.count > 0 ? Math.round((s.count / sourceData[0].count) * 100) : 0;
                    const color = COLORS[i % COLORS.length];
                    return (
                      <div key={`${s.source}-${i}`} className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium text-white capitalize truncate">{s.source}</span>
                            <div className="flex items-center gap-3 shrink-0 ml-2">
                              <span className="text-sm font-bold" style={{ color }}>{s.count}</span>
                              <span className="text-xs text-muted-foreground w-9 text-right">{pct}%</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${barPct}%`, backgroundColor: color }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Landing Pages */}
      {(data?.topLandingPages?.length ?? 0) > 0 && (
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="w-4 h-4 text-primary" />
              Top Landing Pages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data!.topLandingPages.slice(0, 5).map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-4 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground w-4 text-right shrink-0">{i + 1}</span>
                    <code className="text-xs text-white bg-secondary/50 px-2 py-1 rounded truncate max-w-xs">{p.page || '/'}</code>
                  </div>
                  <span className="text-sm font-bold text-primary shrink-0">{p.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
