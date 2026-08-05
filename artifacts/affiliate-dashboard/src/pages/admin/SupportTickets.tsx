import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { LifeBuoy, ChevronDown, ChevronUp, Send, CheckCircle, Clock, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

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
  in_progress: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
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
  affiliateName: string;
  affiliateEmail: string;
  category: string | null;
  subject: string;
  message: string;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

type Message = {
  id: number;
  ticketId: number;
  senderType: 'affiliate' | 'admin';
  senderName: string;
  message: string;
  createdAt: string;
};

function TicketRow({ ticket, onUpdate }: { ticket: Ticket; onUpdate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [notes, setNotes] = useState(ticket.adminNotes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(ticket.status);
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async (silent = false) => {
    if (!expanded) return;
    try {
      const res = await authFetch(`/api/admin/support-tickets/${ticket.id}/messages`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(data.messages)) return data.messages;
        return prev;
      });
      setCurrentStatus(data.ticket.status);
      if (!silent) setLoadingMessages(false);
    } catch {
      if (!silent) setLoadingMessages(false);
    }
  }, [ticket.id, expanded]);

  useEffect(() => {
    if (expanded) {
      setLoadingMessages(true);
      fetchMessages();
      pollRef.current = setInterval(() => fetchMessages(true), 3000);
    } else {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [expanded, fetchMessages]);

  useEffect(() => {
    if (messages.length > 0 && expanded) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, expanded]);

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    const optimistic: Message = {
      id: Date.now(),
      ticketId: ticket.id,
      senderType: 'admin',
      senderName: 'Support Team',
      message: reply.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    const sentText = reply.trim();
    setReply('');
    try {
      const res = await authFetch(`/api/admin/support-tickets/${ticket.id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ message: sentText }),
      });
      if (!res.ok) throw new Error('Failed');
      await fetchMessages(true);
      onUpdate();
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setReply(sentText);
      toast({ title: 'Failed to send reply', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const updateTicket = async (status?: string) => {
    setSavingNotes(true);
    try {
      const res = await authFetch(`/api/admin/support-tickets/${ticket.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: status ?? currentStatus, adminNotes: notes }),
      });
      if (!res.ok) throw new Error('Failed');
      if (status) setCurrentStatus(status);
      toast({ title: status ? `Marked as ${status.replace('_', ' ')}` : 'Notes saved' });
      onUpdate();
    } catch {
      toast({ title: 'Failed to update ticket', variant: 'destructive' });
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div className="border border-white/8 rounded-xl overflow-hidden bg-card/30">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-white text-sm truncate">{ticket.subject}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[currentStatus] ?? STATUS_COLORS.open}`}>
              {currentStatus.replace('_', ' ')}
            </span>
            {ticket.category && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-medium">
                {CATEGORY_LABELS[ticket.category] ?? ticket.category}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{ticket.affiliateName}</span>
            <span>·</span>
            <span>{ticket.affiliateEmail}</span>
            <span>·</span>
            <span>{format(new Date(ticket.createdAt), 'MMM d, yyyy h:mm a')}</span>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-white/5 space-y-4 p-4">
          {/* Message thread */}
          <div className="bg-background/40 border border-white/8 rounded-xl flex flex-col" style={{ minHeight: '280px', maxHeight: '420px' }}>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMessages && messages.length === 0 && (
                <div className="text-center py-8"><div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" /></div>
              )}
              {!loadingMessages && messages.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">No messages yet</div>
              )}
              {messages.map(msg => {
                const isAdmin = msg.senderType === 'admin';
                return (
                  <div key={msg.id} className={`flex flex-col gap-1 ${isAdmin ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      isAdmin
                        ? 'bg-primary text-background rounded-br-sm font-medium'
                        : 'bg-white/8 text-white border border-white/10 rounded-bl-sm'
                    }`}>
                      {msg.message}
                    </div>
                    <div className={`flex items-center gap-1.5 text-xs text-muted-foreground ${isAdmin ? 'flex-row-reverse' : ''}`}>
                      {!isAdmin && <span className="font-medium text-primary/80">{msg.senderName}</span>}
                      <span>{format(new Date(msg.createdAt), 'MMM d, h:mm a')}</span>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Admin reply input */}
            <form onSubmit={sendReply} className="border-t border-white/8 p-3 flex items-end gap-2">
              <Textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                placeholder="Reply to affiliate..."
                className="flex-1 min-h-[44px] max-h-[120px] resize-none bg-background/50 text-sm py-2.5"
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(e as any); } }}
              />
              <Button type="submit" disabled={sending || !reply.trim()} className="bg-primary text-background hover:bg-primary/90 h-10 px-4 shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>

          {/* Internal notes */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Internal Notes (not visible to affiliate)</label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Internal notes..."
              className="bg-background/50 min-h-[70px] resize-none text-sm"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => updateTicket()} disabled={savingNotes} className="text-xs">
              Save Notes
            </Button>
            {currentStatus !== 'in_progress' && (
              <Button size="sm" variant="outline" onClick={() => updateTicket('in_progress')} disabled={savingNotes} className="text-xs text-blue-400 border-blue-500/30 hover:bg-blue-500/10">
                <Clock className="w-3.5 h-3.5 mr-1" /> Mark In Progress
              </Button>
            )}
            {currentStatus !== 'resolved' && (
              <Button size="sm" variant="outline" onClick={() => updateTicket('resolved')} disabled={savingNotes} className="text-xs text-green-400 border-green-500/30 hover:bg-green-500/10">
                <CheckCircle className="w-3.5 h-3.5 mr-1" /> Mark Resolved
              </Button>
            )}
            {currentStatus !== 'closed' && (
              <Button size="sm" variant="outline" onClick={() => updateTicket('closed')} disabled={savingNotes} className="text-xs text-zinc-400 border-zinc-500/30 hover:bg-zinc-500/10">
                <XCircle className="w-3.5 h-3.5 mr-1" /> Close
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminSupportTickets() {
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ status: statusFilter, page: String(page), limit: '20' });
      const res = await authFetch(`/api/admin/support-tickets?${qs}`);
      const data = await res.json();
      setTickets(data.data ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const TAB_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-display font-bold">Support Tickets</h1>
          <p className="text-muted-foreground mt-1">Manage partner support requests. Chat replies update in real time.</p>
        </div>
        <Badge variant="outline" className="text-muted-foreground">
          {total} ticket{total !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="flex space-x-1 bg-secondary/50 p-1 rounded-xl w-fit border border-white/5">
        {TAB_STATUSES.map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
              statusFilter === s
                ? 'bg-primary text-primary-foreground shadow-lg'
                : 'text-muted-foreground hover:text-white hover:bg-white/5'
            }`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading && (
          <>{[1, 2, 3].map(i => <div key={i} className="h-16 bg-secondary/50 animate-pulse rounded-xl" />)}</>
        )}
        {!loading && tickets.length === 0 && (
          <div className="text-center py-20 bg-card/30 rounded-xl border border-dashed border-white/10">
            <LifeBuoy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No {statusFilter.replace('_', ' ')} tickets.</p>
          </div>
        )}
        {!loading && tickets.map(ticket => (
          <TicketRow key={ticket.id} ticket={ticket} onUpdate={fetchTickets} />
        ))}
      </div>
    </div>
  );
}
