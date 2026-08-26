import React, { useState } from 'react';
import { useGetAdminAnalytics } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MousePointerClick, Users, TrendingUp, Globe, Activity } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['hsl(var(--primary))', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#10b981'];

const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function AdminAnalytics() {
  const [days, setDays] = useState('30');
  const { data, isLoading } = useGetAdminAnalytics({ days: parseInt(days) });

  if (isLoading) return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 bg-secondary rounded w-1/3" />
      <div className="grid grid-cols-4 gap-6">{[1,2,3,4].map(i => <div key={i} className="h-32 bg-secondary rounded-xl" />)}</div>
      <div className="h-80 bg-secondary rounded-xl" />
    </div>
  );

  const clicksData = data?.clicksByDay?.map(d => ({ ...d, date: formatDate(d.date) })) ?? [];
  const countryData = data?.clicksByCountry?.slice(0, 6) ?? [];
  const sourceData = data?.clicksBySource ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold">Analytics</h1>
          <p className="text-muted-foreground mt-1">Platform-wide traffic and performance insights.</p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-36 bg-secondary/50"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Clicks', value: data?.totalClicks ?? 0, icon: <MousePointerClick />, color: 'text-primary' },
          { label: 'Unique Visitors', value: data?.uniqueVisitors ?? 0, icon: <Users />, color: 'text-cyan-500' },
          { label: 'Signups', value: data?.totalSignups ?? 0, icon: <TrendingUp />, color: 'text-green-500' },
          { label: 'Conv. Rate', value: `${(data?.conversionRate ?? 0).toFixed(2)}%`, icon: <Activity />, color: 'text-amber-500' },
        ].map(s => (
          <Card key={s.label} className="glass-panel">
            <CardContent className="p-6 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg bg-white/5 ${s.color} flex items-center justify-center`}>
                {React.cloneElement(s.icon as React.ReactElement<{ className?: string }>, { className: 'w-5 h-5' })}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Clicks Over Time */}
      <Card className="glass-panel">
        <CardHeader><CardTitle>Clicks Over Time</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={clicksData}>
              <defs>
                <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
              <Area type="monotone" dataKey="clicks" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#colorClicks)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Countries */}
        <Card className="glass-panel">
          <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5 text-primary" />Top Countries</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {countryData.map((c, i) => (
                <div key={c.country} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-white">{c.country || 'Unknown'}</span>
                      <span className="text-sm text-primary font-bold">{c.count}</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(c.count / (countryData[0]?.count || 1)) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
              {countryData.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">No data available yet.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Traffic Sources */}
        <Card className="glass-panel">
          <CardHeader><CardTitle>Traffic Sources</CardTitle></CardHeader>
          <CardContent className="h-64">
            {sourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sourceData} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {sourceData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No source data yet.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
