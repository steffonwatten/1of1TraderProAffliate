import React, { useState, useEffect } from 'react';
import { useGetAffiliateProfile, useUpdateAffiliateProfile, getGetAffiliateProfileQueryKey, getGetAffiliateDashboardQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  User, Link as LinkIcon, Mail, Globe, Save, CheckCircle2, 
  Copy, Shield, ArrowRight, Percent, RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';

const PAYMENT_METHODS = [
  { value: 'crypto', label: 'Crypto (USDT / BTC / ETH)' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'bank_transfer', label: 'Wire / Bank Transfer' },
  { value: 'paypal', label: 'PayPal' },
];

const PAYMENT_PLACEHOLDERS: Record<string, string> = {
  crypto: 'Wallet address (e.g. 0x...)',
  zelle: 'Phone number or email',
  bank_transfer: 'Account number, routing number, IBAN',
  paypal: 'PayPal email address',
};

export default function AffiliateProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useGetAffiliateProfile();
  const updateMut = useUpdateAffiliateProfile();
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    country: '',
    telegram: '',
    discord: '',
    websiteUrl: '',
    twitterUrl: '',
    youtubeUrl: '',
    payoutMethod: '',
    payoutDetails: '',
  });

  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        fullName: data.fullName || '',
        phone: data.phone || '',
        country: data.country || '',
        telegram: data.telegram || '',
        discord: data.discord || '',
        websiteUrl: data.websiteUrl || '',
        twitterUrl: data.twitterUrl || '',
        youtubeUrl: data.youtubeUrl || '',
        payoutMethod: data.payoutMethod || '',
        payoutDetails: data.payoutDetails || '',
      });
      setDirty(false);
    }
  }, [data]);

  const update = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    updateMut.mutate({ data: form }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAffiliateProfileQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAffiliateDashboardQueryKey() });
        toast({ title: 'Profile saved!', description: 'Your changes have been applied.' });
        setDirty(false);
      },
      onError: () => toast({ title: 'Error', description: 'Failed to update profile.', variant: 'destructive' }),
    });
  };

  const copyCode = () => {
    if (!data?.affiliateCode) return;
    navigator.clipboard.writeText(data.affiliateCode);
    setCopied(true);
    toast({ title: 'Code copied!' });
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) return (
    <div className="animate-pulse space-y-6 max-w-3xl">
      <div className="h-9 bg-secondary rounded w-1/3" />
      <div className="h-24 bg-secondary rounded-xl" />
      <div className="h-64 bg-secondary rounded-xl" />
    </div>
  );

  // Profile completion
  const completionFields = [
    { label: 'Full name', done: !!form.fullName },
    { label: 'Phone', done: !!form.phone },
    { label: 'Country', done: !!form.country },
    { label: 'Payment method', done: !!form.payoutMethod },
    { label: 'Payment details', done: !!form.payoutDetails },
    { label: 'Telegram or Discord', done: !!(form.telegram || form.discord) },
  ];
  const completedCount = completionFields.filter(f => f.done).length;
  const completionPct = Math.round((completedCount / completionFields.length) * 100);

  const paymentPlaceholder = form.payoutMethod ? (PAYMENT_PLACEHOLDERS[form.payoutMethod] ?? 'Payment details') : 'Select a method first';

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-3xl font-display font-bold">Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your affiliate account and payout details.</p>
      </div>

      {/* Identity Card */}
      <Card className="glass-panel border-primary/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-56 h-56 bg-primary/6 blur-3xl rounded-full pointer-events-none" />
        <CardContent className="p-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground">Affiliate Code</p>
              <div className="flex items-center gap-3 mt-0.5">
                <p className="text-3xl font-display font-bold text-primary tracking-widest">{data?.affiliateCode ?? '—'}</p>
                <button onClick={copyCode} className="text-muted-foreground hover:text-primary transition-colors">
                  {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                <Mail className="w-3 h-3" />
                {data?.email}
                {data?.commissionRate !== undefined && (
                  <span className="flex items-center gap-0.5 ml-2 text-primary font-medium">
                    <Percent className="w-3 h-3" />{data.commissionRate}% commission
                  </span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Completion */}
      <Card className="glass-panel border-white/8">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <p className="text-sm font-medium text-white">Profile Completion</p>
              <p className="text-xs text-muted-foreground mt-0.5">{completedCount}/{completionFields.length} fields completed</p>
            </div>
            <span className={`text-lg font-bold ${completionPct === 100 ? 'text-green-400' : completionPct >= 60 ? 'text-primary' : 'text-yellow-400'}`}>
              {completionPct}%
            </span>
          </div>
          <Progress value={completionPct} className="h-2 bg-white/10" />
          {completionPct < 100 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {completionFields.filter(f => !f.done).map((f, i) => (
                <span key={i} className="text-xs bg-secondary/60 text-muted-foreground px-2.5 py-1 rounded-full">
                  {f.label}
                </span>
              ))}
            </div>
          )}
          {completionPct === 100 && (
            <p className="text-xs text-green-400 mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />Profile fully complete!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Personal Info */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="w-5 h-5 text-primary" />Personal Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={form.fullName} onChange={e => update('fullName', e.target.value)} className="bg-background/50" placeholder="Your full name" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => update('phone', e.target.value)} className="bg-background/50" placeholder="+1 234 567 8900" />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input value={form.country} onChange={e => update('country', e.target.value)} className="bg-background/50" placeholder="e.g. United Kingdom" />
            </div>
            <div className="space-y-2">
              <Label>Telegram</Label>
              <Input value={form.telegram} onChange={e => update('telegram', e.target.value)} className="bg-background/50" placeholder="@username" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Social Platforms */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5 text-primary" />Social & Platforms</CardTitle>
          <CardDescription>Help us understand your audience and promotion channels.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={form.websiteUrl} onChange={e => update('websiteUrl', e.target.value)} className="bg-background/50" placeholder="https://" />
            </div>
            <div className="space-y-2">
              <Label>Twitter / X</Label>
              <Input value={form.twitterUrl} onChange={e => update('twitterUrl', e.target.value)} className="bg-background/50" placeholder="https://x.com/..." />
            </div>
            <div className="space-y-2">
              <Label>YouTube</Label>
              <Input value={form.youtubeUrl} onChange={e => update('youtubeUrl', e.target.value)} className="bg-background/50" placeholder="https://youtube.com/@..." />
            </div>
            <div className="space-y-2">
              <Label>Discord</Label>
              <Input value={form.discord} onChange={e => update('discord', e.target.value)} className="bg-background/50" placeholder="username" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Details */}
      <Card className="glass-panel border-primary/15">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LinkIcon className="w-5 h-5 text-primary" />Payout Details</CardTitle>
          <CardDescription>How you'd like to receive commission payments. Minimum thresholds apply per method.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={form.payoutMethod} onValueChange={v => update('payoutMethod', v)}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment Details</Label>
              <Input
                value={form.payoutDetails}
                onChange={e => update('payoutDetails', e.target.value)}
                className="bg-background/50"
                placeholder={paymentPlaceholder}
                disabled={!form.payoutMethod}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="w-3.5 h-3.5 text-primary/60" />
            Your payment details are encrypted and only used when processing payouts.
          </div>
        </CardContent>
      </Card>

      {/* Save + Security Link */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Button
          onClick={handleSave}
          disabled={updateMut.isPending || !dirty}
          className={`h-11 px-8 ${dirty ? 'bg-primary text-background hover:bg-primary/90' : 'bg-secondary text-muted-foreground cursor-not-allowed'}`}
        >
          {updateMut.isPending ? (
            <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Saving...</>
          ) : dirty ? (
            <><Save className="w-4 h-4 mr-2" />Save Changes</>
          ) : (
            <><CheckCircle2 className="w-4 h-4 mr-2 text-green-400" />Up to date</>
          )}
        </Button>
        <Link href="/dashboard/security">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-white">
            <Shield className="w-3.5 h-3.5 mr-1.5" />
            Manage Security <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
