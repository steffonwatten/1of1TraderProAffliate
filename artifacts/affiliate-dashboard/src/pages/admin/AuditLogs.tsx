import React, { useState } from 'react';
import { useGetAuditLogs, getGetAuditLogsQueryKey } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldCheck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';

const formatDate = (d: string) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const actionConfig: Record<string, { color: string; bg: string; label: string }> = {
  approve:            { color: 'text-green-500',  bg: 'bg-green-500/10',  label: 'Approve' },
  deny:               { color: 'text-red-500',    bg: 'bg-red-500/10',    label: 'Deny / Reject' },
  reject:             { color: 'text-red-500',    bg: 'bg-red-500/10',    label: 'Deny / Reject' },
  payout:             { color: 'text-primary',    bg: 'bg-primary/10',    label: 'Payout' },
  mark_payout:        { color: 'text-primary',    bg: 'bg-primary/10',    label: 'Payout' },
  create_payout:      { color: 'text-primary',    bg: 'bg-primary/10',    label: 'Payout' },
  update:             { color: 'text-blue-500',   bg: 'bg-blue-500/10',   label: 'Update' },
  adjust:             { color: 'text-blue-500',   bg: 'bg-blue-500/10',   label: 'Update' },
  attribute:          { color: 'text-amber-400',  bg: 'bg-amber-400/10',  label: 'Attribution' },
  create_commission:  { color: 'text-purple-400', bg: 'bg-purple-400/10', label: 'Commission Rule' },
  reset:              { color: 'text-orange-400', bg: 'bg-orange-400/10', label: 'Password Reset' },
  login:              { color: 'text-purple-500', bg: 'bg-purple-500/10', label: 'Login' },
  delete:             { color: 'text-red-500',    bg: 'bg-red-500/10',    label: 'Delete' },
};

function getActionStyle(action: string) {
  const a = (action ?? '').toLowerCase();
  const key = Object.keys(actionConfig).find(k => a.startsWith(k) || a.includes(k));
  return key ? actionConfig[key] : { color: 'text-muted-foreground', bg: 'bg-secondary/50', label: action };
}

function formatActionLabel(action: string) {
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function renderDetails(log: any) {
  const parts: Record<string, any> = {};
  if (log.oldValue) {
    try { parts['Before'] = JSON.parse(log.oldValue); } catch { parts['Before'] = log.oldValue; }
  }
  if (log.newValue) {
    try { parts['After'] = JSON.parse(log.newValue); } catch { parts['After'] = log.newValue; }
  }
  if (log.targetType) parts['Target'] = `${log.targetType} #${log.targetId}`;
  return Object.keys(parts).length > 0 ? parts : null;
}

export default function AdminAuditLogs() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const { data, isLoading } = useGetAuditLogs({});

  const logs: any[] = data?.data ?? [];

  const filtered = logs.filter(l => {
    const action = (l.action ?? '').toLowerCase();
    if (actionFilter !== 'all' && !action.startsWith(actionFilter) && !action.includes(actionFilter)) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (l.adminEmail ?? '').toLowerCase().includes(s) ||
      action.includes(s) ||
      JSON.stringify(l.newValue ?? '').toLowerCase().includes(s) ||
      JSON.stringify(l.oldValue ?? '').toLowerCase().includes(s) ||
      (l.targetType ?? '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary" />
            Audit Logs
          </h1>
          <p className="text-muted-foreground mt-1">Complete history of all admin actions.</p>
        </div>
        <Button variant="outline" size="sm" className="text-muted-foreground"
          onClick={() => queryClient.invalidateQueries({ queryKey: getGetAuditLogsQueryKey() })}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="flex gap-4 flex-wrap">
        <Input placeholder="Search logs…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm bg-secondary/50" />
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-48 bg-secondary/50"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="approve">Approve Application</SelectItem>
            <SelectItem value="deny">Deny Application</SelectItem>
            <SelectItem value="create_payout">Create Payout</SelectItem>
            <SelectItem value="mark_payout">Mark Payout Paid</SelectItem>
            <SelectItem value="adjust_commission">Adjust Commission</SelectItem>
            <SelectItem value="update_commission">Update Commission</SelectItem>
            <SelectItem value="update_affiliate">Update Affiliate Status</SelectItem>
            <SelectItem value="create_commission_rule">Commission Rule</SelectItem>
            <SelectItem value="reset">Password Reset</SelectItem>
            <SelectItem value="attribute">Membership Attribution</SelectItem>
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
                <div className="px-6 py-12 text-center text-muted-foreground">No audit logs found.</div>
              )}
              {filtered.map((log) => {
                const ac = getActionStyle(log.action ?? '');
                const details = renderDetails(log);
                return (
                  <div key={log.id} className="px-6 py-4 flex items-start gap-4 hover:bg-white/2 transition-colors">
                    <div className={`mt-0.5 w-8 h-8 rounded-lg ${ac.bg} ${ac.color} flex items-center justify-center shrink-0`}>
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <span className={`text-sm font-bold ${ac.color}`}>{formatActionLabel(log.action ?? '')}</span>
                          <span className="text-sm text-muted-foreground ml-2">by</span>
                          <span className="text-sm font-medium text-white ml-2">{log.adminEmail || 'Admin'}</span>
                          {log.targetType && (
                            <span className="text-xs text-muted-foreground ml-2">
                              · {log.targetType} #{log.targetId}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{log.createdAt ? formatDate(log.createdAt) : '—'}</span>
                      </div>
                      {details && (
                        <pre className="mt-1 text-xs text-muted-foreground bg-background/50 p-2 rounded font-mono overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(details, null, 2)}
                        </pre>
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
