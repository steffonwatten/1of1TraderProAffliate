import React, { useState } from 'react';
import { useGetEmailLogs, getGetEmailLogsQueryKey } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';

const formatDate = (d: string) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const typeLabels: Record<string, string> = {
  application_received: 'Application Received',
  application_approved: 'Application Approved',
  application_denied: 'Application Denied',
  support_ticket: 'Support Ticket',
  admin_reply: 'Support Reply',
  password_reset: 'Password Reset',
};

function formatType(t: string) {
  return typeLabels[t] ?? t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function AdminEmailLogs() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { data, isLoading } = useGetEmailLogs({});

  const logs: any[] = data?.data ?? [];

  const failedCount = logs.filter(l => l.status === 'failed').length;

  const filtered = logs.filter(l => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (l.recipient ?? '').toLowerCase().includes(s) ||
      (l.subject ?? '').toLowerCase().includes(s) ||
      (l.emailType ?? '').toLowerCase().includes(s) ||
      (l.errorMessage ?? '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <Mail className="w-8 h-8 text-primary" />
            Email Logs
          </h1>
          <p className="text-muted-foreground mt-1">Every transactional email we tried to send, and whether it went through.</p>
        </div>
        <Button variant="outline" size="sm" className="text-muted-foreground"
          onClick={() => queryClient.invalidateQueries({ queryKey: getGetEmailLogsQueryKey() })}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {failedCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-300">
            {failedCount} {failedCount === 1 ? 'email' : 'emails'} failed to send. Check the details below so no one is left waiting.
          </p>
        </div>
      )}

      <div className="flex gap-4 flex-wrap">
        <Input placeholder="Search by recipient, subject, type…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm bg-secondary/50" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48 bg-secondary/50"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Emails</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center text-sm text-muted-foreground ml-auto">
          {filtered.length} of {logs.length} entries
        </div>
      </div>

      <Card className="glass-panel">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="animate-pulse p-8 space-y-4">
              {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-secondary rounded" />)}
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filtered.length === 0 && (
                <div className="px-6 py-12 text-center text-muted-foreground">No email logs found.</div>
              )}
              {filtered.map((log) => {
                const failed = log.status === 'failed';
                return (
                  <div key={log.id} className="px-6 py-4 flex items-start gap-4 hover:bg-white/2 transition-colors">
                    <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${failed ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                      {failed ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0">
                          <span className={`text-sm font-bold ${failed ? 'text-red-500' : 'text-green-500'}`}>
                            {failed ? 'Failed' : 'Sent'}
                          </span>
                          <span className="text-sm text-muted-foreground ml-2">{formatType(log.emailType ?? '')}</span>
                          <span className="text-sm text-muted-foreground ml-2">to</span>
                          <span className="text-sm font-medium text-white ml-2 break-all">{log.recipient}</span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{log.createdAt ? formatDate(log.createdAt) : '—'}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">{log.subject}</p>
                      {failed && log.errorMessage && (
                        <p className="mt-1 text-xs text-red-400 bg-red-500/5 border border-red-500/20 px-2 py-1.5 rounded font-mono break-words">
                          {log.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
