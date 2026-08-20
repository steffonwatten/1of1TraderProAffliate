import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LifeBuoy, ChevronDown, ChevronUp, Send, Mail, MessageCircle, ExternalLink, ArrowLeft, Plus, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const authFetch = (path: string, opts: RequestInit = {}) => {
  const token = localStorage.getItem('auth_token');
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers },
  });
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  in_progress: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  resolved: 'bg-green-500/15 text-green-400 border-green-500/30',
  closed: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
};

const CATEGORY_LABELS: Record<string, string> = {
  payouts: 'Payouts & Payments',
  tracking: 'Link Tracking',
  commissions: 'Commissions',
  account: 'Account Issues',
  technical: 'Technical Problem',
  other: 'Other',
};

type Ticket = {
  id: number;
  subject: string;
  category: string | null;
  status: string;
  createdAt: string;
  message: string;
};

type Message = {
  id: number;
  ticketId: number;
  senderType: 'affiliate' | 'admin';
  senderName: string;
  message: string;
  createdAt: string;
};

const FAQS = [
  { q: 'When do I get paid?', a: 'Payouts are processed manually on a rolling basis. Once you request a payout, the admin team reviews and processes it within 3–5 business days.' },
  { q: 'What is the minimum payout amount?', a: 'Crypto (USDT/BTC/ETH) and Zelle: $25 minimum. Wire transfers: $200 minimum due to processing fees.' },
  { q: 'How do I update my payout method?', a: 'Go to your Profile page or use the inline setter on the Payouts page to update your payment method and details.' },
  { q: 'What commission rate do I earn?', a: 'Your commission rate is set when your account is approved. You can see your rate on your Profile page.' },
  { q: 'How does click tracking work?', a: 'When someone clicks your referral link, we track the click and store a session ID in their browser. If they subscribe within that session, the conversion is attributed to you.' },
  { q: 'Do I earn commission on renewals?', a: 'Yes — recurring commissions are earned on membership renewals as long as the customer remains attributed to you.' },
];

function FAQItem({ faq }: { faq: typeof FAQS[0] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border-b border-white/5 last:border-0 ${open ? 'bg-white/[0.02]' : ''}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left hover:bg-white/[0.02] transition-colors">
        <span className="text-sm font-medium text-white">{faq.q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-primary shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>
      {open && <div className="px-6 pb-4"><p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p></div>}
    </div>
  );
}

// Chat thread view for a single ticket
function TicketThread({ ticketId, onBack, onTicketsRefresh }: { ticketId: number; onBack: () => void; onTicketsRefresh: () => void }) {
  const { toast } = useToast();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async (silent = false) => {
    try {
      const res = await authFetch(`/api/affiliate/support/tickets/${ticketId}/messages`);
      if (!res.ok) return;
      const data = await res.json();
      setTicket(data.ticket);
      setMessages(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(data.messages)) {
          return data.messages;
        }
        return prev;
      });
      if (!silent) setLoading(false);
    } catch {
      if (!silent) setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(() => fetchMessages(true), 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchMessages]);

  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    const optimistic: Message = {
      id: Date.now(),
      ticketId,
      senderType: 'affiliate',
      senderName: 'You',
      message: reply.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    setReply('');
    try {
      const res = await authFetch(`/api/affiliate/support/tickets/${ticketId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ message: optimistic.message }),
      });
      if (!res.ok) throw new Error('Failed');
      await fetchMessages(true);
      onTicketsRefresh();
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setReply(optimistic.message);
      toast({ title: 'Failed to send message', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  if (loading) return (
    <div className="space-y-3">
      <div className="h-10 w-28 bg-secondary/50 animate-pulse rounded-lg" />
      <div className="h-64 bg-secondary/50 animate-pulse rounded-xl" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground hover:text-white gap-1.5 -ml-1">
          <ArrowLeft className="w-4 h-4" /> Back to tickets
        </Button>
      </div>

      {ticket && (
        <div className="flex items-start gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-white">{ticket.subject}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[ticket.status] ?? STATUS_COLORS.open}`}>
                {ticket.status.replace('_', ' ')}
              </span>
              {ticket.category && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-medium">
                  {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                </span>
              )}
              <span className="text-xs text-muted-foreground">{format(new Date(ticket.createdAt), 'MMM d, yyyy')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Message thread */}
      <div className="bg-card/30 border border-white/8 rounded-xl flex flex-col" style={{ minHeight: '360px', maxHeight: '480px' }}>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">No messages yet</div>
          )}
          {messages.map(msg => {
            const isMe = msg.senderType === 'affiliate';
            return (
              <div key={msg.id} className={`flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  isMe
                    ? 'bg-primary text-background rounded-br-sm font-medium'
                    : 'bg-white/8 text-white border border-white/10 rounded-bl-sm'
                }`}>
                  {msg.message}
                </div>
                <div className={`flex items-center gap-1.5 text-xs text-muted-foreground ${isMe ? 'flex-row-reverse' : ''}`}>
                  {!isMe && <span className="font-medium text-primary/80">{msg.senderName}</span>}
                  <span>{format(new Date(msg.createdAt), 'MMM d, h:mm a')}</span>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Reply input */}
        {ticket?.status !== 'closed' ? (
          <form onSubmit={sendReply} className="border-t border-white/8 p-3 flex items-end gap-2">
            <Textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 min-h-[44px] max-h-[120px] resize-none bg-background/50 text-sm py-2.5"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(e as any); } }}
            />
            <Button
              type="submit"
              disabled={sending || !reply.trim()}
              className="bg-primary text-background hover:bg-primary/90 h-10 px-4 shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        ) : (
          <div className="border-t border-white/8 p-3 text-center text-xs text-muted-foreground">
            This ticket is closed. Open a new ticket if you need further help.
          </div>
        )}
      </div>
    </div>
  );
}

export default function AffiliateSupport() {
  const { toast } = useToast();
  const [view, setView] = useState<'list' | 'new' | 'thread'>('list');
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [form, setForm] = useState({ subject: '', category: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      const res = await authFetch('/api/affiliate/support/tickets');
      if (res.ok) setTickets(await res.json());
    } catch {} finally {
      setLoadingTickets(false);
    }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject || !form.message) {
      toast({ title: 'Fill in subject and message', variant: 'destructive' }); return;
    }
    setSubmitting(true);
    try {
      const res = await authFetch('/api/affiliate/support', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Failed to submit');
      toast({ title: 'Ticket submitted!' });
      setForm({ subject: '', category: '', message: '' });
      await fetchTickets();
      setActiveTicketId(data.ticketId);
      setView('thread');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const openThread = (ticketId: number) => {
    setActiveTicketId(ticketId);
    setView('thread');
  };

  const goBack = () => {
    setActiveTicketId(null);
    setView('list');
    fetchTickets();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold">Support</h1>
        <p className="text-muted-foreground mt-1">Get answers or reach out to the partner team.</p>
      </div>

      {/* Quick Contact Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="glass-panel border-primary/20 hover:border-primary/40 transition-colors">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-white text-sm">Email Support</p>
              <a href="mailto:support@1of1traderpro.com" className="text-xs text-primary hover:underline">support@1of1traderpro.com</a>
              <p className="text-xs text-muted-foreground mt-0.5">Response within 24 hours</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel border-white/10 hover:border-white/20 transition-colors">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-indigo-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.031.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold text-white text-sm">Discord Community</p>
              <a href="https://discord.gg/3tgVfjwT" target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:underline flex items-center gap-1">
                Join our Discord <ExternalLink className="w-2.5 h-2.5" />
              </a>
              <p className="text-xs text-muted-foreground mt-0.5">Partner announcements & chat</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* FAQ */}
        <div className="lg:col-span-3">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-primary" />
            Frequently Asked Questions
          </h2>
          <Card className="glass-panel">
            <CardContent className="p-0">
              {FAQS.map((faq, i) => <FAQItem key={i} faq={faq} />)}
            </CardContent>
          </Card>
        </div>

        {/* Right panel: tickets / thread */}
        <div className="lg:col-span-2">
          {view === 'thread' && activeTicketId ? (
            <TicketThread
              ticketId={activeTicketId}
              onBack={goBack}
              onTicketsRefresh={fetchTickets}
            />
          ) : view === 'new' ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Send className="w-5 h-5 text-primary" /> New Ticket
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setView('list')} className="text-muted-foreground hover:text-white gap-1">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </Button>
              </div>
              <Card className="glass-panel">
                <CardContent className="p-6">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                        <SelectTrigger className="bg-background/50"><SelectValue placeholder="Select a category" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="payouts">Payouts & Payments</SelectItem>
                          <SelectItem value="tracking">Link Tracking</SelectItem>
                          <SelectItem value="commissions">Commissions</SelectItem>
                          <SelectItem value="account">Account Issues</SelectItem>
                          <SelectItem value="technical">Technical Problem</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Subject <span className="text-red-400">*</span></Label>
                      <Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Brief description of your issue" className="bg-background/50" />
                    </div>
                    <div className="space-y-2">
                      <Label>Message <span className="text-red-400">*</span></Label>
                      <Textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Describe your issue in detail..." className="bg-background/50 min-h-[120px] resize-none" />
                    </div>
                    <Button type="submit" disabled={submitting || !form.subject || !form.message} className="w-full bg-primary text-background hover:bg-primary/90 h-10">
                      {submitting ? <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-background/50 border-t-background rounded-full animate-spin" />Submitting...</span> : <span className="flex items-center gap-2"><Send className="w-4 h-4" />Send Ticket</span>}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-primary" /> My Tickets
                </h2>
                <Button size="sm" onClick={() => setView('new')} className="bg-primary text-background hover:bg-primary/90 gap-1.5 h-8 px-3 text-xs">
                  <Plus className="w-3.5 h-3.5" /> New Ticket
                </Button>
              </div>

              {loadingTickets ? (
                <div className="space-y-2">
                  {[1, 2].map(i => <div key={i} className="h-14 bg-secondary/50 animate-pulse rounded-xl" />)}
                </div>
              ) : tickets.length === 0 ? (
                <Card className="glass-panel">
                  <CardContent className="p-8 text-center">
                    <LifeBuoy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">No tickets yet</p>
                    <Button size="sm" onClick={() => setView('new')} className="mt-4 bg-primary text-background hover:bg-primary/90 gap-1.5">
                      <Plus className="w-3.5 h-3.5" /> Open a Ticket
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {tickets.map(ticket => (
                    <button
                      key={ticket.id}
                      onClick={() => openThread(ticket.id)}
                      className="w-full text-left bg-card/30 border border-white/8 hover:border-white/15 rounded-xl p-3.5 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate group-hover:text-primary transition-colors">{ticket.subject}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{ticket.message}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[ticket.status] ?? STATUS_COLORS.open}`}>
                            {ticket.status.replace('_', ' ')}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(ticket.createdAt), 'MMM d')}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
