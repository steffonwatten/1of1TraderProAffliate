import { useEffect, useState } from "react";
import { customerFetch } from "@/lib/customerAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, ChevronLeft } from "lucide-react";

// Customer support threads. The same support_tickets table the affiliates use,
// so everything lands in one admin inbox rather than a second place to check.

type Ticket = {
  id: number;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
};

type Message = {
  id: number;
  senderType: string;
  senderName: string;
  message: string;
  createdAt: string;
};

function when(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CustomerSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [open, setOpen] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTickets = async () => {
    try {
      const data = await customerFetch<{ tickets: Ticket[] }>("/support/tickets");
      setTickets(data.tickets);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your messages.");
    }
  };

  useEffect(() => {
    void loadTickets();
  }, []);

  const openThread = async (t: Ticket) => {
    setOpen(t);
    setMessages([]);
    try {
      const data = await customerFetch<{ messages: Message[] }>(`/support/tickets/${t.id}/messages`);
      setMessages(data.messages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load that conversation.");
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await customerFetch("/support/tickets", {
        method: "POST",
        body: JSON.stringify({ subject, message: body }),
      });
      setSubject("");
      setBody("");
      await loadTickets();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send that message.");
    } finally {
      setBusy(false);
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!open) return;
    setBusy(true);
    try {
      await customerFetch(`/support/tickets/${open.id}/reply`, {
        method: "POST",
        body: JSON.stringify({ message: reply }),
      });
      setReply("");
      await openThread(open);
      await loadTickets();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send that reply.");
    } finally {
      setBusy(false);
    }
  };

  if (open) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setOpen(null)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white"
        >
          <ChevronLeft className="w-4 h-4" /> All messages
        </button>

        <div>
          <h1 className="text-2xl font-bold text-white">{open.subject}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Opened {when(open.createdAt)} · {open.status}
          </p>
        </div>

        <div className="space-y-3">
          {messages.map((m) => {
            const mine = m.senderType === "customer";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    mine
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-card border border-border text-white rounded-bl-sm"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                  <p className={`text-[11px] mt-1.5 ${mine ? "text-white/70" : "text-muted-foreground"}`}>
                    {mine ? "You" : m.senderName} · {when(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <form onSubmit={send} className="flex gap-2">
              <Input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Write a reply…"
              />
              <Button type="submit" disabled={busy || !reply.trim()} className="shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Support</h1>
        <p className="text-muted-foreground mt-1">
          Message us about anything — we reply here and by email.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <form onSubmit={create} className="space-y-4">
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What's it about?"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="body">Message</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Tell us what's happening…"
                rows={4}
                className="mt-1.5"
              />
            </div>
            <Button type="submit" disabled={busy || !subject.trim() || !body.trim()}>
              {busy ? "Sending…" : "Send message"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Your conversations
        </h2>
        {tickets.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-10 text-center">
              <MessageSquare className="w-7 h-7 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                No messages yet. Anything you send appears here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {tickets.map((t) => (
              <Card
                key={t.id}
                onClick={() => void openThread(t)}
                className="bg-card border-border hover:border-primary/40 transition-colors cursor-pointer"
              >
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">{t.subject}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{t.message}</p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${
                      t.status === "open"
                        ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                        : "bg-white/5 text-muted-foreground border-border"
                    }`}
                  >
                    {t.status}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
