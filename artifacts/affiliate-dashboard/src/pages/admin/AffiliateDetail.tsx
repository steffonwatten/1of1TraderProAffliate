import React, { useState } from 'react';
import { useParams, Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetAdminAffiliate,
  useUpdateAffiliateCommission,
  useUpdateAffiliateStatus,
  getGetAdminAffiliatesQueryKey,
  getGetAdminAffiliateQueryKey,
} from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, Copy, ExternalLink, Users, MousePointerClick,
  DollarSign, Clock, Check, AlertTriangle, TrendingUp, Globe,
} from 'lucide-react';
import { format } from 'date-fns';

const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
const fmtDate = (d: string | Date | null) => d ? format(new Date(d as string), 'MMM d, yyyy') : '—';

function StatCard({ icon: Icon, label, value, sub, color = 'text-primary' }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <Card className="glass-panel">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <code className="text-sm text-primary font-mono bg-primary/5 px-3 py-1.5 rounded-lg flex-1 truncate">
          {value}
        </code>
        <button onClick={copy} className="shrink-0 p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'border-emerald-500/50 text-emerald-500 bg-emerald-500/10' },
  paused: { label: 'Paused', className: 'border-amber-500/50 text-amber-500 bg-amber-500/10' },
  suspended: { label: 'Suspended', className: 'border-red-500/50 text-red-500 bg-red-500/10' },
};

export default function AdminAffiliateDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? '0');
  const qc = useQueryClient();

  const { data: aff, isLoading, error } = useGetAdminAffiliate(id);

  const [commType, setCommType] = useState('');
  const [commValue, setCommValue] = useState('');
  const [editingComm, setEditingComm] = useState(false);
  const [commSaved, setCommSaved] = useState(false);
  const [resetPwLoading, setResetPwLoading] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);

  const updateCommission = useUpdateAffiliateCommission({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetAdminAffiliateQueryKey(id) });
        qc.invalidateQueries({ queryKey: getGetAdminAffiliatesQueryKey() });
        setEditingComm(false);
        setCommSaved(true);
        setTimeout(() => setCommSaved(false), 3000);
      },
    },
  });

  const updateStatus = useUpdateAffiliateStatus({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: [`/api/admin/affiliates/${id}`] });
        qc.invalidateQueries({ queryKey: getGetAdminAffiliatesQueryKey() });
      },
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-secondary rounded w-1/3" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-secondary rounded-xl" />)}
        </div>
        <div className="h-64 bg-secondary rounded-xl" />
      </div>
    );
  }

  if (error || !aff) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <p className="text-muted-foreground">Affiliate not found.</p>
        <Link href="/admin/affiliates">
          <Button variant="outline" className="mt-4">Back to Affiliates</Button>
        </Link>
      </div>
    );
  }

  const currentStatus = aff.status ?? 'active';
  const sc = statusConfig[currentStatus] ?? statusConfig.active;

  const handleStartEditComm = () => {
    const normType = aff.defaultCommissionType ?? 'flat';
    setCommType(normType);
    setCommValue(String(aff.defaultCommissionValue ?? ''));
    setEditingComm(true);
  };

  const handleSaveComm = () => {
    updateCommission.mutate({
      id,
      data: { defaultCommissionType: commType as any, defaultCommissionValue: parseFloat(commValue) },
    });
  };

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === currentStatus) return;
    updateStatus.mutate({ id, data: { status: newStatus as any } });
  };

  const handleResetPassword = async () => {
    setResetPwLoading(true);
    setNewPassword(null);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/admin/affiliates/${id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.newPassword) setNewPassword(data.newPassword);
    } catch {
      alert('Failed to reset password');
    } finally {
      setResetPwLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/affiliates">
            <button className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-display font-bold text-white">{aff.user?.fullName ?? 'Unknown'}</h1>
              <Badge className={sc.className}>{sc.label}</Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">{aff.user?.email} · Joined {fmtDate(aff.createdAt ?? null)}</p>
          </div>
        </div>

        {/* Status Actions */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {(['active', 'paused', 'suspended'] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={currentStatus === s ? 'default' : 'outline'}
                className={currentStatus === s ? 'bg-primary text-background' : 'border-white/10'}
                onClick={() => handleStatusChange(s)}
                disabled={updateStatus.isPending}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              className="border-white/10 text-muted-foreground hover:text-white"
              onClick={handleResetPassword}
              disabled={resetPwLoading}
            >
              {resetPwLoading ? 'Resetting…' : 'Reset Password'}
            </Button>
          </div>
          {newPassword && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 text-sm">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-muted-foreground">New password:</span>
              <code className="text-emerald-400 font-mono font-semibold">{newPassword}</code>
              <button onClick={() => navigator.clipboard.writeText(newPassword)}
                className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
                <Copy className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={MousePointerClick} label="Total Clicks" value={String(aff.totalClicks ?? 0)} color="text-blue-400" />
        <StatCard icon={Users} label="Customers" value={String(aff.totalCustomers ?? 0)} color="text-emerald-400" />
        <StatCard icon={DollarSign} label="Total Revenue" value={fmt(aff.totalRevenue ?? 0)} color="text-primary" />
        <StatCard
          icon={Clock}
          label="Unpaid Commission"
          value={fmt(aff.unpaidCommission ?? 0)}
          sub={`${(aff.conversionRate ?? 0).toFixed(1)}% conversion`}
          color="text-amber-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Affiliate Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="glass-panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Referral Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CopyField label="Affiliate Code" value={aff.affiliateCode ?? ''} />
              {aff.referralUrl && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Referral URL</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-primary font-mono bg-primary/5 px-3 py-1.5 rounded-lg flex-1 truncate">
                      {aff.referralUrl}
                    </code>
                    <a href={aff.referralUrl} target="_blank" rel="noopener noreferrer"
                      className="shrink-0 p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                <div>
                  <p className="text-xs text-muted-foreground">Payout Method</p>
                  <p className="text-sm text-white font-medium mt-0.5 capitalize">{aff.payoutMethod ?? 'Not set'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Payout Details</p>
                  <p className="text-sm text-white font-medium mt-0.5 truncate">{aff.payoutDetails ?? '—'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Commission Editor */}
          <Card className="glass-panel">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Commission Rate</CardTitle>
                {!editingComm && (
                  <Button size="sm" variant="outline" className="border-white/10 text-xs" onClick={handleStartEditComm}>
                    Edit
                  </Button>
                )}
                {commSaved && (
                  <span className="flex items-center gap-1 text-emerald-400 text-xs">
                    <Check className="w-3.5 h-3.5" /> Saved
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editingComm ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Type</Label>
                      <Select value={commType} onValueChange={setCommType}>
                        <SelectTrigger className="bg-background/50 border-white/10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">Percentage (%)</SelectItem>
                          <SelectItem value="flat">Fixed Amount ($)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Value</Label>
                      <Input
                        type="number"
                        value={commValue}
                        onChange={(e) => setCommValue(e.target.value)}
                        className="bg-background/50 border-white/10"
                        placeholder={commType === 'percent' ? 'e.g. 25' : 'e.g. 25'}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveComm} disabled={updateCommission.isPending}
                      className="bg-primary text-background hover:bg-primary/90">
                      {updateCommission.isPending ? 'Saving...' : 'Save'}
                    </Button>
                    <Button size="sm" variant="outline" className="border-white/10" onClick={() => setEditingComm(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    {(aff.defaultCommissionType === 'percent')
                      ? <TrendingUp className="w-6 h-6 text-primary" />
                      : <DollarSign className="w-6 h-6 text-primary" />}
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-white">
                      {(aff.defaultCommissionType === 'percent')
                        ? `${aff.defaultCommissionValue}%`
                        : fmt(aff.defaultCommissionValue ?? 0)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {(aff.defaultCommissionType === 'percent') ? 'Percent' : 'Fixed'} Commission
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Payments */}
          {(aff as any).recentPayments?.length > 0 && (
            <Card className="glass-panel">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Recent Payments</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-white/5">
                  {(aff as any).recentPayments.map((p: any) => (
                    <div key={p.id} className="px-6 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-white">{p.whopMemberId ?? p.whopPaymentId ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(p.paidAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-primary">{fmt(Number(p.grossAmount ?? 0))}</p>
                        <p className="text-xs text-muted-foreground capitalize">{p.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: Click geography */}
        <div className="space-y-6">
          <Card className="glass-panel">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-base font-semibold">Clicks by Country</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {!(aff as any).clicksByCountry?.length ? (
                <p className="text-sm text-muted-foreground text-center py-4">No click data yet.</p>
              ) : (
                <div className="space-y-3">
                  {(aff as any).clicksByCountry.map((c: any) => (
                    <div key={c.country}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-white">{c.country}</span>
                        <span className="text-muted-foreground">{c.count} ({c.percentage.toFixed(1)}%)</span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${c.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
