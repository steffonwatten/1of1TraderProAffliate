import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, DollarSign, Calendar, User, MapPin,
  Link as LinkIcon, AlertTriangle, CheckCircle2, XCircle,
  Clock, CreditCard, TrendingUp, ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';

const fmt = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
const fmtDate = (d: string | Date | null | undefined) =>
  d ? format(new Date(d as string), 'MMM d, yyyy') : '—';
const fmtDateTime = (d: string | Date | null | undefined) =>
  d ? format(new Date(d as string), 'MMM d, yyyy h:mm a') : '—';

const statusConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  active:    { label: 'Active',    icon: CheckCircle2, className: 'border-emerald-500/50 text-emerald-500 bg-emerald-500/10' },
  trialing:  { label: 'Trialing', icon: Clock,        className: 'border-blue-500/50 text-blue-400 bg-blue-500/10' },
  completed: { label: 'Completed', icon: CheckCircle2, className: 'border-amber-500/50 text-amber-400 bg-amber-500/10' },
  expired:   { label: 'Expired',  icon: XCircle,      className: 'border-white/20 text-white/40 bg-white/5' },
  canceled:  { label: 'Canceled', icon: XCircle,      className: 'border-red-500/50 text-red-400 bg-red-500/10' },
};

const commStatusConfig: Record<string, string> = {
  pending: 'border-amber-500/40 text-amber-400 bg-amber-500/10',
  approved: 'border-blue-500/40 text-blue-400 bg-blue-500/10',
  paid: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
  rejected: 'border-red-500/40 text-red-400 bg-red-500/10',
};

function InfoRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2.5 border-b border-white/5 last:border-0">
      <p className="text-xs text-muted-foreground shrink-0 w-28">{label}</p>
      <div className={`text-sm text-white text-right min-w-0 break-all ${mono ? 'font-mono text-primary' : ''}`}>{value}</div>
    </div>
  );
}

export default function AdminCustomerDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? '0');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('auth_token') ?? '';
    setLoading(true);
    fetch(`/api/admin/memberships/${id}/detail`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-secondary rounded w-1/3" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-secondary rounded-xl" />)}
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 h-64 bg-secondary rounded-xl" />
        <div className="h-64 bg-secondary rounded-xl" />
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="text-center py-20">
      <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
      <p className="text-muted-foreground">{error ?? 'Customer not found.'}</p>
      <Link href="/admin/memberships">
        <Button variant="outline" className="mt-4">Back to Memberships</Button>
      </Link>
    </div>
  );

  const sc = statusConfig[data.status] ?? statusConfig.expired;
  const StatusIcon = sc.icon;
  const displayName = data.customer?.fullName || data.customer?.email || 'Unknown Customer';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/admin/memberships">
          <button className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors mt-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-display font-bold text-white">{displayName}</h1>
            <Badge className={sc.className}>
              <StatusIcon className="w-3 h-3 mr-1" />{sc.label}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">
            {data.customer?.email}
            {data.customer?.country ? ` · ${data.customer.country}` : ''}
            {' · '}Joined {fmtDate(data.createdAt)}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-panel">
          <CardContent className="p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Paid</p>
              <p className="text-2xl font-bold text-white">{fmt(data.totalPaid ?? 0)}</p>
              <p className="text-xs text-muted-foreground">{data.payments?.length ?? 0} payments</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Plan</p>
              <p className="text-sm font-bold text-white leading-tight">
                {data.planName ?? '1OF1 Trader Pro'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {data.renewalDate ? `Renews ${fmtDate(data.renewalDate)}` : `Started ${fmtDate(data.startDate)}`}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Commissions</p>
              <p className="text-2xl font-bold text-white">
                {fmt((data.commissions ?? []).reduce((s: number, c: any) => s + Number(c.commissionAmount), 0))}
              </p>
              <p className="text-xs text-muted-foreground">{data.commissions?.length ?? 0} records</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Source</p>
              {data.affiliate ? (
                <>
                  <p className="text-sm font-bold text-white truncate">{data.affiliate.name ?? 'Affiliate'}</p>
                  <p className="text-xs text-muted-foreground font-mono">{data.affiliate.code}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Direct / Organic</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: membership + customer info */}
        <div className="space-y-6">
          <Card className="glass-panel">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-base font-semibold">Customer Profile</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <InfoRow label="Full Name" value={data.customer?.fullName || '—'} />
              <InfoRow label="Email" value={data.customer?.email || '—'} />
              {data.customer?.whopUsername && (
                <InfoRow label="Whop Username" value={`@${data.customer.whopUsername}`} />
              )}
              <InfoRow label="Country" value={data.customer?.country || '—'} />
            </CardContent>
          </Card>

          <Card className="glass-panel">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-base font-semibold">Membership Info</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <InfoRow label="Status" value={<Badge className={`${sc.className} text-xs`}>{sc.label}</Badge>} />
              {data.planName && <InfoRow label="Plan Name" value={data.planName} />}
              <InfoRow label="Plan ID" value={
                <code className="text-xs text-primary font-mono">{data.whopPlanId ?? '—'}</code>
              } />
              <InfoRow label="Start Date" value={fmtDate(data.startDate)} />
              <InfoRow label="Renewal Date" value={fmtDate(data.renewalDate)} />
              {data.canceledAt && <InfoRow label="Canceled" value={fmtDate(data.canceledAt)} />}
              <InfoRow label="Membership ID" value={
                <code className="text-xs text-muted-foreground font-mono">{data.whopMembershipId ?? '—'}</code>
              } />
            </CardContent>
          </Card>

          {data.affiliate && (
            <Card className="glass-panel">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-base font-semibold">Referral Source</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <InfoRow label="Affiliate" value={data.affiliate.name ?? 'Unknown'} />
                <InfoRow label="Email" value={data.affiliate.email ?? '—'} />
                <InfoRow label="Code" value={
                  <code className="text-xs text-primary font-mono">{data.affiliate.code}</code>
                } />
                <InfoRow label="Commission Rate" value={
                  `${data.affiliate.commissionRate}${data.affiliate.commissionType === 'percent' ? '%' : ' USD'}`
                } />
                <div className="pt-2">
                  <Link href={`/admin/affiliates/${data.affiliate.id}`}>
                    <Button size="sm" variant="outline" className="w-full border-white/10 text-xs gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5" /> View Affiliate Profile
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: payment history + commissions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Payment History */}
          <Card className="glass-panel">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-base font-semibold">Payment History</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {data.payments?.length > 0 ? (
                <div className="divide-y divide-white/5">
                  {data.payments.map((p: any) => (
                    <div key={p.id} className="px-6 py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm text-white font-medium">{fmtDateTime(p.paidAt)}</p>
                        <code className="text-xs text-muted-foreground font-mono">{p.whopPaymentId ?? '—'}</code>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <p className="text-sm font-semibold text-primary">{fmt(p.grossAmount)}</p>
                        <div className="flex gap-1">
                          {p.paymentType && (
                            <Badge variant="outline" className="text-xs border-white/10 text-white/40 capitalize">
                              {p.paymentType}
                            </Badge>
                          )}
                          <Badge variant="outline" className={`text-xs ${
                            p.status === 'paid' ? 'border-emerald-500/40 text-emerald-400' :
                            p.status === 'refunded' ? 'border-red-500/40 text-red-400' :
                            'border-white/20 text-white/40'
                          }`}>{p.status}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-8 text-center text-muted-foreground text-sm">No payments recorded.</div>
              )}
            </CardContent>
          </Card>

          {/* Commission records */}
          {data.commissions?.length > 0 && (
            <Card className="glass-panel">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-base font-semibold">Commission Records</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-white/5">
                  {data.commissions.map((c: any) => (
                    <div key={c.id} className="px-6 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-white">{fmtDate(c.createdAt)}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.commissionValue}{c.commissionType === 'percent' ? '%' : ' USD'} rate
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-amber-400">{fmt(c.commissionAmount)}</p>
                        <Badge variant="outline"
                          className={`text-xs mt-0.5 ${commStatusConfig[c.commissionStatus] ?? 'border-white/20 text-white/40'}`}>
                          {c.commissionStatus}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
