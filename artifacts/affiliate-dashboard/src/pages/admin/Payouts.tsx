import React, { useState } from 'react';
import { useGetAdminPayouts, useMarkPayoutPaid, getGetAdminPayoutsQueryKey, type GetAdminPayoutsStatus, type AdminPayoutRow } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle2, Clock, Wallet, Copy, ExternalLink } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const statusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', label: 'Pending' },
  processing: { color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', label: 'Processing' },
  paid: { color: 'bg-green-500/10 text-green-500 border-green-500/20', label: 'Paid' },
  failed: { color: 'bg-red-500/10 text-red-500 border-red-500/20', label: 'Failed' },
};

export default function AdminPayouts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPayout, setSelectedPayout] = useState<AdminPayoutRow | null>(null);
  const [txId, setTxId] = useState('');
  const [marking, setMarking] = useState(false);

  const { data, isLoading } = useGetAdminPayouts({ status: statusFilter === 'all' ? undefined : (statusFilter as GetAdminPayoutsStatus) });
  const markPaidMut = useMarkPayoutPaid();

  const rawPayouts = data?.data ?? [];
  const filtered = rawPayouts.filter((p) =>
    !search || p.affiliateName?.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenDetail = (p: AdminPayoutRow) => {
    setSelectedPayout(p);
    setTxId('');
  };

  const handleMarkPaid = () => {
    if (!selectedPayout) return;
    setMarking(true);
    const ref = txId.trim() || undefined;
    markPaidMut.mutate({ id: selectedPayout.id, data: { payoutReference: ref } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminPayoutsQueryKey() });
        toast({ title: 'Payout marked as paid', description: `Payout #${selectedPayout.id} has been marked paid.` });
        setSelectedPayout(null);
        setMarking(false);
      },
      onError: () => {
        toast({ title: 'Error', description: 'Failed to mark payout paid.', variant: 'destructive' });
        setMarking(false);
      },
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied`, description: text.substring(0, 40) + (text.length > 40 ? '…' : '') });
  };

  if (isLoading) return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 bg-secondary rounded w-1/3" />
      <div className="h-64 bg-secondary rounded-xl" />
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold">Payouts</h1>
        <p className="text-muted-foreground mt-1">Manage affiliate payout requests and processing.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="glass-panel">
          <CardContent className="p-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/10 text-yellow-500 flex items-center justify-center"><Clock className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">{formatCurrency(data?.totalPending ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center"><CheckCircle2 className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Paid Out</p>
              <p className="text-2xl font-bold">{formatCurrency(data?.totalPaid ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Wallet className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Total Requests</p>
              <p className="text-2xl font-bold">{data?.total ?? 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <Input placeholder="Search affiliate..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm bg-secondary/50" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-secondary/50"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="glass-panel">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-6 py-4 text-muted-foreground font-medium">Affiliate</th>
                  <th className="text-left px-6 py-4 text-muted-foreground font-medium">Amount</th>
                  <th className="text-left px-6 py-4 text-muted-foreground font-medium">Method</th>
                  <th className="text-left px-6 py-4 text-muted-foreground font-medium">Status</th>
                  <th className="text-left px-6 py-4 text-muted-foreground font-medium">Requested</th>
                  <th className="text-left px-6 py-4 text-muted-foreground font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">No payouts found.</td></tr>
                )}
                {filtered.map((p) => {
                  const sc = statusConfig[p.status] ?? statusConfig.pending;
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => handleOpenDetail(p)}
                    >
                      <td className="px-6 py-4">
                        <p className="font-medium text-white">{p.affiliateName ?? '—'}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate max-w-[160px]">{p.payoutReference ?? '—'}</p>
                      </td>
                      <td className="px-6 py-4 font-bold text-primary">{formatCurrency(Number(p.totalAmount ?? 0))}</td>
                      <td className="px-6 py-4">
                        <span className="text-xs px-2 py-1 bg-secondary rounded-full text-muted-foreground capitalize">{p.payoutMethod ?? '—'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${sc.color}`}>{sc.label}</span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{p.createdAt ? formatDate(p.createdAt) : '—'}</td>
                      <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                        <Button size="sm" variant="outline" className="text-xs border-white/10 text-muted-foreground hover:bg-white/5"
                          onClick={() => handleOpenDetail(p)}>
                          View Details
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Payout Detail Modal */}
      <Dialog open={!!selectedPayout} onOpenChange={open => !open && setSelectedPayout(null)}>
        <DialogContent className="bg-card border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Payout Details</DialogTitle>
          </DialogHeader>

          {selectedPayout && (() => {
            const sc = statusConfig[selectedPayout.status] ?? statusConfig.pending;
            return (
              <div className="space-y-5 py-2">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${sc.color}`}>{sc.label}</span>
                </div>

                {/* Affiliate */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Affiliate</span>
                  <span className="font-medium">{selectedPayout.affiliateName ?? '—'}</span>
                </div>

                {/* Amount */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Amount to Send</span>
                  <span className="text-2xl font-bold text-primary">{formatCurrency(Number(selectedPayout.totalAmount ?? 0))}</span>
                </div>

                {/* Method */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Payment Method</span>
                  <span className="capitalize font-medium">{selectedPayout.payoutMethod ?? '—'}</span>
                </div>

                {/* Wallet / Payment Address */}
                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">
                    {selectedPayout.payoutMethod === 'crypto' ? 'Wallet Address' : 'Payment Details'}
                  </span>
                  <div className="flex items-center gap-2 bg-secondary/50 rounded-lg p-3 border border-white/10">
                    <p className="font-mono text-sm text-white break-all flex-1">{selectedPayout.payoutReference ?? '—'}</p>
                    {selectedPayout.payoutReference && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="shrink-0 h-7 w-7 text-muted-foreground hover:text-white"
                        onClick={() => copyToClipboard(selectedPayout.payoutReference!, selectedPayout.payoutMethod === 'crypto' ? 'Wallet address' : 'Payment details')}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Dates */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Requested</span>
                  <span>{selectedPayout.createdAt ? formatDate(selectedPayout.createdAt) : '—'}</span>
                </div>
                {selectedPayout.paidAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Paid</span>
                    <span>{formatDate(selectedPayout.paidAt)}</span>
                  </div>
                )}

                {/* Mark Paid section */}
                {selectedPayout.status === 'pending' && (
                  <div className="space-y-3 pt-2 border-t border-white/10">
                    <p className="text-sm text-muted-foreground">Enter a transaction reference after sending (optional):</p>
                    <Input
                      placeholder="Transaction hash or ID (optional)"
                      value={txId}
                      onChange={e => setTxId(e.target.value)}
                      className="bg-secondary/50 border-white/10 font-mono text-sm"
                    />
                  </div>
                )}
              </div>
            );
          })()}

          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-white/10" onClick={() => setSelectedPayout(null)}>
              Close
            </Button>
            {selectedPayout?.status === 'pending' && (
              <Button
                className="bg-primary text-background hover:bg-primary/90 font-semibold"
                onClick={handleMarkPaid}
                disabled={marking}
              >
                {marking ? 'Marking...' : 'Mark as Paid'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
