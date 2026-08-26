import React, { useState } from 'react';
import { useGetAffiliatePayouts, getGetAffiliatePayoutsQueryKey, useGetAffiliateProfile, useUpdateAffiliateProfile, getGetAffiliateProfileQueryKey, getGetAffiliateDashboardQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wallet, Clock, CheckCircle2, Plus, Info, ArrowRight, AlertTriangle, RefreshCw, XCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const METHOD_MINIMUMS: Record<string, { min: number; label: string }> = {
  crypto: { min: 25, label: 'Crypto (USDT / BTC / ETH) — $25 min' },
  zelle: { min: 25, label: 'Zelle — $25 min' },
  bank_transfer: { min: 200, label: 'Wire Transfer — $200 min' },
};

const statusConfig: Record<string, { color: string; label: string; dot: string }> = {
  pending: { color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/25', label: 'Under Review', dot: 'bg-yellow-400' },
  processing: { color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25', label: 'Processing', dot: 'bg-cyan-400' },
  paid: { color: 'bg-green-500/10 text-green-400 border-green-500/25', label: 'Paid', dot: 'bg-green-400' },
  failed: { color: 'bg-red-500/10 text-red-400 border-red-500/25', label: 'Failed', dot: 'bg-red-400' },
};

const PAYMENT_PLACEHOLDERS: Record<string, string> = {
  crypto: 'Wallet address (e.g. 0x...)',
  zelle: 'Phone number or email',
  bank_transfer: 'Account number, routing number, IBAN',
  paypal: 'PayPal email address',
};

export default function AffiliatePayouts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useGetAffiliatePayouts();
  const { data: profile } = useGetAffiliateProfile();
  const updateProfile = useUpdateAffiliateProfile();
  const [showForm, setShowForm] = useState(false);
  const [method, setMethod] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Inline payment method setter state
  const [showPaymentSetup, setShowPaymentSetup] = useState(false);
  const [setupMethod, setSetupMethod] = useState('');
  const [setupDetails, setSetupDetails] = useState('');
  const [savingSetup, setSavingSetup] = useState(false);

  const handleSavePaymentMethod = async () => {
    if (!setupMethod || !setupDetails) { toast({ title: 'Please fill in both fields', variant: 'destructive' }); return; }
    setSavingSetup(true);
    try {
      await updateProfile.mutateAsync({ data: { payoutMethod: setupMethod, payoutDetails: setupDetails } });
      queryClient.invalidateQueries({ queryKey: getGetAffiliateProfileQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetAffiliateDashboardQueryKey() });
      toast({ title: 'Payment method saved!', description: 'You can now request payouts.' });
      setShowPaymentSetup(false);
    } catch {
      toast({ title: 'Failed to save payment method', variant: 'destructive' });
    } finally {
      setSavingSetup(false);
    }
  };

  const available = data?.availableBalance ?? 0;
  const selectedMethodData = method ? METHOD_MINIMUMS[method] : null;
  const meetsMinimum = selectedMethodData ? available >= selectedMethodData.min : false;

  const handleRequest = async () => {
    if (!method || !details) { toast({ title: 'Fill in all fields', variant: 'destructive' }); return; }
    if (!meetsMinimum) { toast({ title: `Minimum ${formatCurrency(selectedMethodData!.min)} required for ${method}`, variant: 'destructive' }); return; }
    setSubmitting(true);
    try {
      const token = localStorage.getItem('auth_token');
      const base = import.meta.env.BASE_URL.replace(/\/$/, '');
      const res = await fetch(`${base}/api/affiliate/payouts/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ paymentMethod: method, paymentDetails: details }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? body?.error ?? 'Failed to request payout');
      queryClient.invalidateQueries({ queryKey: getGetAffiliatePayoutsQueryKey() });
      toast({ title: 'Payout requested!', description: 'We\'ll process your request within 3–5 business days.' });
      setShowForm(false);
      setMethod('');
      setDetails('');
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to request payout.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return (
    <div className="animate-pulse space-y-6">
      <div className="h-9 bg-secondary rounded w-1/3" />
      <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i=><div key={i} className="h-24 bg-secondary rounded-xl"/>)}</div>
      <div className="h-64 bg-secondary rounded-xl" />
    </div>
  );

  const hasPendingPayout = (data?.payouts ?? []).some(p => p.status === 'pending' || p.status === 'processing');

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold">Payouts</h1>
          <p className="text-muted-foreground mt-1">Request and track your commission payouts.</p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          disabled={available <= 0 || hasPendingPayout}
          className="bg-primary text-background hover:bg-primary/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          Request Payout
        </Button>
      </div>

      {/* No payment method — inline setup */}
      {!profile?.payoutMethod && (
        <div className="rounded-xl bg-yellow-500/8 border border-yellow-500/25 overflow-hidden">
          <div className="flex items-center gap-3 p-4">
            <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-yellow-400">Payment method not set</p>
              <p className="text-xs text-muted-foreground mt-0.5">Add your payment details here to request payouts.</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 shrink-0"
              onClick={() => setShowPaymentSetup(v => !v)}
            >
              {showPaymentSetup ? 'Cancel' : 'Add Now'} <ArrowRight className={`w-3.5 h-3.5 ml-1 transition-transform ${showPaymentSetup ? 'rotate-90' : ''}`} />
            </Button>
          </div>
          {showPaymentSetup && (
            <div className="px-4 pb-4 border-t border-yellow-500/15 pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={setupMethod} onValueChange={v => { setSetupMethod(v); setSetupDetails(''); }}>
                    <SelectTrigger className="bg-background/50">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(METHOD_MINIMUMS).map(([key, val]) => (
                        <SelectItem key={key} value={key}>{val.label}</SelectItem>
                      ))}
                      <SelectItem value="paypal">PayPal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Payment Details</Label>
                  <Input
                    value={setupDetails}
                    onChange={e => setSetupDetails(e.target.value)}
                    placeholder={setupMethod ? (PAYMENT_PLACEHOLDERS[setupMethod] ?? 'Payment details') : 'Select a method first'}
                    disabled={!setupMethod}
                    className="bg-background/50"
                  />
                </div>
              </div>
              <Button
                onClick={handleSavePaymentMethod}
                disabled={savingSetup || !setupMethod || !setupDetails}
                className="bg-primary text-background hover:bg-primary/90 h-9 px-5"
              >
                {savingSetup ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Save Payment Method'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Pending payout notice */}
      {hasPendingPayout && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-cyan-500/8 border border-cyan-500/25">
          <Clock className="w-5 h-5 text-cyan-400 shrink-0" />
          <p className="text-sm text-cyan-400">You have a payout request under review. You can request another once it's processed.</p>
        </div>
      )}

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="glass-panel border-primary/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-28 h-28 bg-primary/10 blur-3xl rounded-full pointer-events-none" />
          <CardContent className="p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Wallet className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Available Balance</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(available)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel border-yellow-500/15">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 text-yellow-400 flex items-center justify-center shrink-0"><Clock className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Pending Requests</p>
              <p className="text-2xl font-bold text-yellow-400">{formatCurrency(data?.pendingAmount ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel border-green-500/15">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 text-green-400 flex items-center justify-center shrink-0"><CheckCircle2 className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Received</p>
              <p className="text-2xl font-bold text-green-400">{formatCurrency(data?.totalPaid ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payout Rules */}
      <Card className="glass-panel border-white/8">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-white">Payout Rules</p>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                {Object.entries(METHOD_MINIMUMS).map(([key, val]) => (
                  <li key={key} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                    {val.label}
                  </li>
                ))}
                <li className="flex items-start gap-2 pt-1 border-t border-white/5 mt-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 shrink-0 mt-1" />
                  <span>Processing time: 3–5 business days after request approval.</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Request Form */}
      {showForm && (
        <Card className="glass-panel border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              New Payout Request
            </CardTitle>
            <CardDescription>Requesting {formatCurrency(available)} — your full available balance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={method} onValueChange={v => { setMethod(v); if (profile?.payoutDetails) setDetails(profile.payoutDetails); }}>
                  <SelectTrigger className="bg-background/50"><SelectValue placeholder="Select method" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(METHOD_MINIMUMS).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {method && !meetsMinimum && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    Minimum {formatCurrency(selectedMethodData!.min)} required for this method
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Payment Details</Label>
                <Input
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  placeholder="Wallet address, email, or account number"
                  className="bg-background/50"
                />
                {profile?.payoutDetails && !details && (
                  <button className="text-xs text-primary hover:text-primary/80 transition-colors" onClick={() => setDetails(profile.payoutDetails ?? '')}>
                    Use saved: {profile.payoutDetails}
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleRequest}
                disabled={submitting || !method || !details || !meetsMinimum}
                className="bg-primary text-background hover:bg-primary/90 h-10 px-6"
              >
                {submitting ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : <>Request {formatCurrency(available)}</>}
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)} className="h-10">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payout History */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Payout History</h2>
        <Card className="glass-panel">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <th className="text-left px-6 py-4 text-muted-foreground font-medium text-xs uppercase tracking-wider">Amount</th>
                    <th className="text-left px-6 py-4 text-muted-foreground font-medium text-xs uppercase tracking-wider">Method</th>
                    <th className="text-left px-6 py-4 text-muted-foreground font-medium text-xs uppercase tracking-wider">Status</th>
                    <th className="text-left px-6 py-4 text-muted-foreground font-medium text-xs uppercase tracking-wider">Transaction ID</th>
                    <th className="text-left px-6 py-4 text-muted-foreground font-medium text-xs uppercase tracking-wider">Requested</th>
                  </tr>
                </thead>
                <tbody>
                  {(!data?.payouts?.length) && (
                    <tr>
                      <td colSpan={5} className="px-6 py-14 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Wallet className="w-8 h-8 text-muted-foreground/30" />
                          <p className="text-sm">No payout requests yet. Earn commissions and request your first payout.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                  {data?.payouts?.map((p) => {
                    const sc = statusConfig[p.status] ?? statusConfig.pending;
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }} className="hover:bg-white/[0.015] transition-colors">
                        <td className="px-6 py-4 font-bold text-primary">{formatCurrency(p.amount)}</td>
                        <td className="px-6 py-4">
                          <span className="text-xs px-2.5 py-1 bg-secondary/60 rounded-full text-muted-foreground capitalize">
                            {p.paymentMethod?.replace(/_/g, ' ') ?? '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${sc.color}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{p.transactionId ?? '—'}</td>
                        <td className="px-6 py-4 text-muted-foreground text-xs">{p.createdAt ? formatDate(p.createdAt) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
