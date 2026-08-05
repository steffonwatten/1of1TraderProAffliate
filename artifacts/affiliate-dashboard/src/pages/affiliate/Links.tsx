import React, { useState } from 'react';
import { useGetAffiliateLinks, useCreateCampaignLink, getGetAffiliateLinksQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Link as LinkIcon, Copy, Plus, CheckCircle2, QrCode, 
  MousePointerClick, ExternalLink, Sparkles, Trash2, Download
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

const DESTINATIONS = [
  { label: 'Main Referral Page', value: '/' },
  { label: 'Checkout / Sign Up', value: '/checkout' },
  { label: 'About / Sales Page', value: '/about' },
];

function QrModal({ url, onClose }: { url: string; onClose: () => void }) {
  const encoded = encodeURIComponent(url);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encoded}&size=300x300&margin=20&color=F5C518&bgcolor=080808`;

  const download = () => {
    const a = document.createElement('a');
    a.href = qrUrl;
    a.download = 'referral-qr.png';
    a.target = '_blank';
    a.click();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm glass-panel border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            QR Code
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-center p-4 bg-[#080808] rounded-xl border border-white/10">
            <img src={qrUrl} alt="QR Code" className="w-56 h-56 rounded-lg" />
          </div>
          <p className="text-xs text-muted-foreground text-center font-mono truncate px-2">{url}</p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 border-white/10" onClick={() => { navigator.clipboard.writeText(url); }}>
              <Copy className="w-3.5 h-3.5 mr-1.5" />Copy URL
            </Button>
            <Button onClick={download} className="flex-1 bg-primary text-background hover:bg-primary/90">
              <Download className="w-3.5 h-3.5 mr-1.5" />Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AffiliateLinks() {
  const { data, isLoading } = useGetAffiliateLinks();
  const queryClient = useQueryClient();
  const createMut = useCreateCampaignLink();
  const { toast } = useToast();

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    utmSource: '',
    utmMedium: '',
    utmCampaign: '',
    landingPage: '/',
    notes: '',
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({ title: 'Copied to clipboard!' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { toast({ title: 'Campaign name required', variant: 'destructive' }); return; }
    createMut.mutate({ data: form }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAffiliateLinksQueryKey() });
        setForm({ name: '', utmSource: '', utmMedium: '', utmCampaign: '', landingPage: '/', notes: '' });
        toast({ title: 'Campaign link created!' });
      },
      onError: () => toast({ title: 'Failed to create link', variant: 'destructive' }),
    });
  };

  if (isLoading) return (
    <div className="space-y-6 animate-pulse">
      <div className="h-9 bg-secondary rounded w-1/3" />
      <div className="h-20 bg-secondary rounded-xl" />
      <div className="h-80 bg-secondary rounded-xl" />
    </div>
  );

  return (
    <div className="space-y-8">
      {qrUrl && <QrModal url={qrUrl} onClose={() => setQrUrl(null)} />}

      <div>
        <h1 className="text-3xl font-display font-bold">My Links</h1>
        <p className="text-muted-foreground mt-1">Your referral links, campaign trackers, and QR codes.</p>
      </div>

      {/* Primary Link */}
      <Card className="glass-panel border-primary/25 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/8 blur-3xl rounded-full pointer-events-none" />
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <CardTitle className="text-primary">Primary Referral Link</CardTitle>
          </div>
          <CardDescription>Your main affiliate link — use this everywhere when you don't need campaign tracking.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <Input readOnly value={data?.primaryLink ?? ''} className="bg-background/50 h-11 font-mono text-sm text-white" />
            <Button onClick={() => handleCopy(data?.primaryLink ?? '', 'primary')} className="h-11 px-5 bg-primary text-background hover:bg-primary/90 shrink-0">
              {copiedId === 'primary' ? <CheckCircle2 className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
              Copy
            </Button>
            <Button variant="outline" onClick={() => setQrUrl(data?.primaryLink ?? '')} className="h-11 px-4 border-white/15 hover:border-white/30 shrink-0">
              <QrCode className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Create Form */}
        <Card className="glass-panel lg:col-span-2 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Create Campaign Link
            </CardTitle>
            <CardDescription>Track performance per platform, video, or campaign.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Campaign Name <span className="text-red-400">*</span></Label>
                <Input
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. YouTube Q1 Promo"
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Destination</Label>
                <Select value={form.landingPage} onValueChange={v => setForm({ ...form, landingPage: v })}>
                  <SelectTrigger className="bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DESTINATIONS.map(d => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">UTM Source</Label>
                  <Input value={form.utmSource} onChange={e => setForm({ ...form, utmSource: e.target.value })} placeholder="youtube" className="bg-background/50 h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">UTM Medium</Label>
                  <Input value={form.utmMedium} onChange={e => setForm({ ...form, utmMedium: e.target.value })} placeholder="video" className="bg-background/50 h-9 text-sm" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">UTM Campaign</Label>
                <Input value={form.utmCampaign} onChange={e => setForm({ ...form, utmCampaign: e.target.value })} placeholder="q1_promo" className="bg-background/50 h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notes (private)</Label>
                <Input value={form.notes ?? ''} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="e.g. Pinned YouTube video" className="bg-background/50 h-9 text-sm" />
              </div>
              <Button type="submit" disabled={createMut.isPending} className="w-full bg-primary text-background hover:bg-primary/90 h-10">
                {createMut.isPending ? (
                  <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-background/40 border-t-background rounded-full animate-spin" />Creating...</span>
                ) : (
                  <span className="flex items-center gap-2"><Plus className="w-4 h-4" />Create Link</span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Campaign Links */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Active Campaigns</h2>
            <span className="text-xs text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full">
              {data?.campaignLinks?.length ?? 0} links
            </span>
          </div>

          {(data?.campaignLinks?.length ?? 0) === 0 ? (
            <Card className="glass-panel border-dashed border-white/10">
              <CardContent className="py-14 text-center text-muted-foreground space-y-2">
                <LinkIcon className="w-8 h-8 mx-auto text-muted-foreground/30" />
                <p className="text-sm">No campaign links yet. Create one to track where your traffic comes from.</p>
              </CardContent>
            </Card>
          ) : (
            data!.campaignLinks.map(link => (
              <Card key={link.id} className="glass-panel hover:border-white/10 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-white">{link.name}</h4>
                        {link.utmSource && (
                          <span className="text-xs bg-secondary/60 px-2 py-0.5 rounded-full text-muted-foreground">{link.utmSource}</span>
                        )}
                        {link.utmMedium && (
                          <span className="text-xs bg-secondary/60 px-2 py-0.5 rounded-full text-muted-foreground">{link.utmMedium}</span>
                        )}
                        {link.utmCampaign && (
                          <span className="text-xs bg-secondary/60 px-2 py-0.5 rounded-full text-muted-foreground">{link.utmCampaign}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <code className="text-xs text-primary bg-primary/8 px-2 py-1 rounded border border-primary/15 truncate max-w-xs">{link.url}</code>
                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-white transition-colors shrink-0">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3 shrink-0">
                      <div className="flex items-center gap-2">
                        <div className="text-center bg-secondary/50 px-4 py-2 rounded-lg border border-white/5">
                          <div className="flex items-center gap-1.5 justify-center">
                            <MousePointerClick className="w-3.5 h-3.5 text-primary" />
                            <span className="text-base font-bold text-white">{link.clicks}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Clicks</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => handleCopy(link.url, link.id.toString())} className="border-white/10 hover:border-white/20 h-8 px-2.5">
                          {copiedId === link.id.toString() ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setQrUrl(link.url)} className="border-white/10 hover:border-white/20 h-8 px-2.5">
                          <QrCode className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
