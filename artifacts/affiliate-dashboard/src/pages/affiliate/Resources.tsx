import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BookOpen, Copy, CheckCircle2, Download, Image as ImageIcon, 
  MessageSquare, FileText, AlertTriangle, Palette, ExternalLink
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useGetAffiliateDashboard } from '@workspace/api-client-react';

const BRAND_COLORS = [
  { name: 'Gold', hex: '#F5C518', usage: 'Primary CTA, accents, highlights' },
  { name: 'Deep Black', hex: '#080808', usage: 'Background, main canvas' },
  { name: 'Dark Card', hex: '#111111', usage: 'Cards, panels' },
  { name: 'White', hex: '#FFFFFF', usage: 'Body text, titles' },
  { name: 'Muted', hex: '#888888', usage: 'Secondary text, metadata' },
];

const CAPTIONS = [
  {
    platform: 'Twitter / X',
    label: 'Short & punchy',
    text: `🏆 The trading edge is real.\n\n1OF1 Trader Pro gives you:\n• Live market signals\n• Pro-grade analysis tools\n• A community of serious traders\n\nJoin via my link — first move matters 👇\n{LINK}`,
  },
  {
    platform: 'Instagram',
    label: 'Lifestyle-driven',
    text: `Stop trading on vibes. Start trading with data. 📊\n\n1OF1 Trader Pro is the platform I use to stay ahead of the market — real-time signals, community insights, and tools built for serious traders.\n\nLink in bio to get started. 🔗 #Trading #TradingCommunity #1OF1`,
  },
  {
    platform: 'TikTok',
    label: 'Hook-first',
    text: `POV: You found the trading platform that actually works.\n\n1OF1 Trader Pro → signals, analysis, community. Everything serious traders need in one place.\n\nLink in bio 👆\n\n#TradingTips #StockMarket #ForexTrading #1OF1TraderPro`,
  },
  {
    platform: 'YouTube Description',
    label: 'Long-form',
    text: `✅ Join 1OF1 Trader Pro — the platform I use to level up my trading:\n{LINK}\n\n1OF1 Trader Pro gives you access to:\n→ Real-time trading signals\n→ Professional market analysis\n→ A private community of serious traders\n→ Educational resources and mentorship\n\nUse my link to get started and start trading smarter today.`,
  },
  {
    platform: 'Discord / Telegram',
    label: 'Community-style',
    text: `Hey guys — for anyone looking to seriously level up their trading, I've been using 1OF1 Trader Pro and it's been a game changer. Real signals, real community, real results. Link here: {LINK} — no pressure, just sharing what's working for me 🙌\n\nAlso join our Discord community for daily insights: https://discord.gg/3tgVfjwT`,
  },
];

const SCRIPTS = [
  {
    title: 'Video Hook (15 sec)',
    text: `"If you're serious about trading but tired of guessing — 1OF1 Trader Pro is what I wish I had from day one. Signals, analysis, and a community of traders who actually know what they're doing. Link below."`,
  },
  {
    title: 'Story CTA',
    text: `"Swipe up to check out 1OF1 Trader Pro — the trading platform I use every single day. Real-time signals, pro tools, and a community you won't find anywhere else."`,
  },
  {
    title: 'Live Shout-out',
    text: `"Quick shoutout to my sponsor — 1OF1 Trader Pro. If you're watching this and you trade stocks, forex, or crypto, this platform is an absolute must-have. I'll drop the link in chat right now."`,
  },
  {
    title: 'Objection Handler',
    text: `"Yeah I know, there are tons of trading platforms out there — but 1OF1 is different. No fluff, no fake gurus. Just real signals, real analysis, and a community of people who are actually profitable. Check it out, link in bio."`,
  },
];

export default function AffiliateResources() {
  const { toast } = useToast();
  const { data } = useGetAffiliateDashboard();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const referralLink = data?.referralLink ?? '{LINK}';

  const copyText = (text: string, key: string) => {
    const final = text.replace(/\{LINK\}/g, referralLink);
    navigator.clipboard.writeText(final);
    setCopiedKey(key);
    toast({ title: 'Copied to clipboard!' });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const CopyButton = ({ text, id }: { text: string; id: string }) => (
    <Button
      size="sm"
      variant="outline"
      onClick={() => copyText(text, id)}
      className="shrink-0 border-white/10 hover:border-primary/50 hover:text-primary"
    >
      {copiedKey === id ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold">Resources</h1>
        <p className="text-muted-foreground mt-1">Everything you need to promote 1OF1 Trader Pro effectively.</p>
      </div>

      <Tabs defaultValue="captions">
        <TabsList className="bg-secondary/50 border border-white/10">
          <TabsTrigger value="captions"><MessageSquare className="w-4 h-4 mr-2" />Captions</TabsTrigger>
          <TabsTrigger value="scripts"><FileText className="w-4 h-4 mr-2" />Scripts</TabsTrigger>
          <TabsTrigger value="brand"><Palette className="w-4 h-4 mr-2" />Brand</TabsTrigger>
          <TabsTrigger value="compliance"><AlertTriangle className="w-4 h-4 mr-2" />Compliance</TabsTrigger>
        </TabsList>

        {/* Captions */}
        <TabsContent value="captions" className="mt-6 space-y-4">
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">Your referral link is automatically inserted where you see <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded text-xs">{'{LINK}'}</code> — just copy and paste!</p>
          </div>
          {CAPTIONS.map((c, i) => (
            <Card key={i} className="glass-panel">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-base text-white">{c.platform}</CardTitle>
                    <CardDescription>{c.label}</CardDescription>
                  </div>
                  <CopyButton text={c.text} id={`caption-${i}`} />
                </div>
              </CardHeader>
              <CardContent>
                <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed p-4 bg-background/50 rounded-lg border border-white/5">
                  {c.text.replace(/\{LINK\}/g, referralLink)}
                </pre>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Scripts */}
        <TabsContent value="scripts" className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">Use these scripts for videos, lives, stories, and podcasts. Customise the tone to match your voice.</p>
          {SCRIPTS.map((s, i) => (
            <Card key={i} className="glass-panel">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="text-base text-white">{s.title}</CardTitle>
                  <CopyButton text={s.text} id={`script-${i}`} />
                </div>
              </CardHeader>
              <CardContent>
                <blockquote className="text-sm text-muted-foreground italic leading-relaxed p-4 bg-background/50 rounded-lg border-l-4 border-primary/40">
                  {s.text}
                </blockquote>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Brand */}
        <TabsContent value="brand" className="mt-6 space-y-6">
          {/* Brand Colors */}
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Palette className="w-5 h-5 text-primary" />Brand Colors</CardTitle>
              <CardDescription>Use these exact colors in any creatives you make for 1OF1 Trader Pro.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {BRAND_COLORS.map(c => (
                  <div key={c.hex} className="flex items-center gap-3 p-3 rounded-xl bg-background/50 border border-white/5">
                    <div className="w-10 h-10 rounded-lg border border-white/10 shrink-0" style={{ backgroundColor: c.hex }} />
                    <div className="min-w-0">
                      <p className="font-medium text-white text-sm">{c.name}</p>
                      <p className="text-xs font-mono text-muted-foreground">{c.hex}</p>
                      <p className="text-xs text-muted-foreground/70 truncate">{c.usage}</p>
                    </div>
                    <button onClick={() => copyText(c.hex, `color-${c.hex}`)} className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
                      {copiedKey === `color-${c.hex}` ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Typography */}
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-base">Typography</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: 'Headlines', font: 'Big Shoulders Display, Impact, or similar', note: 'Bold, all-caps, high contrast' },
                { name: 'Body text', font: 'Inter, DM Sans, or system-ui', note: 'Clean, legible, weight 400–500' },
                { name: 'Code / Codes', font: 'JetBrains Mono, Fira Code', note: 'For referral codes and IDs' },
              ].map(t => (
                <div key={t.name} className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-white/5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.font}</p>
                    <p className="text-xs text-muted-foreground/60">{t.note}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Messaging */}
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-base">Brand Voice</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20">
                  <p className="text-xs font-bold text-green-400 uppercase tracking-wider mb-2">✓ Do say</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• "Professional trading tools"</li>
                    <li>• "Real-time signals"</li>
                    <li>• "Serious traders"</li>
                    <li>• "Level up your trading"</li>
                    <li>• "Trading community"</li>
                  </ul>
                </div>
                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                  <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">✗ Don't say</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• "Guaranteed profits"</li>
                    <li>• "Risk-free"</li>
                    <li>• "Get rich quick"</li>
                    <li>• "100% success rate"</li>
                    <li>• Specific return promises</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assets */}
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ImageIcon className="w-5 h-5 text-primary" />Logos & Assets</CardTitle>
              <CardDescription>Official brand assets for use in your content. Do not alter or distort.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-6 rounded-xl bg-background/50 border border-white/10 text-center space-y-3">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-primary" />
                </div>
                <p className="text-sm text-white font-medium">Logo & Asset Pack</p>
                <p className="text-xs text-muted-foreground">Contact support to request official logo files, banner templates, and social media kit.</p>
                <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10" onClick={() => window.location.href = '/dashboard/support'}>
                  Request Assets
                  <ExternalLink className="w-3.5 h-3.5 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compliance */}
        <TabsContent value="compliance" className="mt-6 space-y-4">
          <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-400 text-sm">Important: Disclosure Requirements</p>
              <p className="text-sm text-muted-foreground mt-1">As an affiliate, you are required by law (FTC guidelines) to clearly disclose your affiliate relationship whenever you share your referral link.</p>
            </div>
          </div>

          {[
            {
              title: '✅ Required Disclosures',
              content: [
                'Always disclose when you earn a commission from referrals',
                'Disclosure must be clear and conspicuous — not buried in a caption',
                'Use clear language: "Affiliate link", "Partner link", "I earn a commission", "#ad", "#sponsored"',
                'Disclosure must appear BEFORE or WITH the link — not after',
              ],
              color: 'border-green-500/20 bg-green-500/5',
            },
            {
              title: '✅ Approved Disclosure Phrases',
              content: [
                '"This is an affiliate link — I earn a small commission at no extra cost to you"',
                '"#ad | Partner with 1OF1 Trader Pro"',
                '"Affiliate link below"',
                '"Sponsored by 1OF1 Trader Pro"',
                '"I partner with 1OF1 Trader Pro and earn a commission from referrals"',
              ],
              color: 'border-cyan-500/20 bg-cyan-500/5',
            },
            {
              title: '⚠️ Financial Promotion Rules',
              content: [
                'Do NOT promise specific returns or profits (e.g. "make $500/day")',
                'Do NOT claim the platform guarantees profitable trades',
                'Always include a disclaimer: "Trading involves risk. Past performance is not indicative of future results."',
                'Do NOT use real P&L screenshots without proper context and disclaimers',
              ],
              color: 'border-yellow-500/20 bg-yellow-500/5',
            },
            {
              title: '❌ Prohibited Promotions',
              content: [
                'Spam in trading forums or communities where promotion is not allowed',
                'Fake reviews or testimonials',
                'Targeting minors (under 18)',
                'Impersonating the 1OF1 brand or team',
                'Creating lookalike websites or phishing pages',
              ],
              color: 'border-red-500/20 bg-red-500/5',
            },
          ].map((section, i) => (
            <Card key={i} className={`glass-panel border ${section.color}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {section.content.map((item, j) => (
                    <li key={j} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="shrink-0 mt-0.5 text-white/40">—</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}

          <Card className="glass-panel border-white/10">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">
                Questions about compliance? Contact us at{' '}
                <a href="mailto:support@1of1traderpro.com" className="text-primary hover:underline">support@1of1traderpro.com</a>
                {' '}— we're happy to review your content before you publish.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
