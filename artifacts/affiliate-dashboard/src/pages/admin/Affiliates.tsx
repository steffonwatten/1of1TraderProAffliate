import React, { useState } from 'react';
import { useGetAdminAffiliates, getGetAdminAffiliatesQueryKey } from '@workspace/api-client-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { format } from 'date-fns';
import { Search, ChevronRight, Trash2, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const authFetch = (path: string, opts: RequestInit = {}) => {
  const token = localStorage.getItem('auth_token');
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers },
  });
};

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

type DeleteTarget = { id: number; name: string; email: string; code: string };

export default function AdminAffiliates() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useGetAdminAffiliates();
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState('');

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await authFetch(`/api/admin/affiliates/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Delete failed');
      toast({ title: 'Affiliate deleted', description: `${deleteTarget.name} has been removed. They can now re-register.` });
      queryClient.invalidateQueries({ queryKey: getGetAdminAffiliatesQueryKey() });
      setDeleteTarget(null);
      setConfirm('');
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-card border border-red-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">Delete Affiliate</h3>
                <p className="text-xs text-muted-foreground">This action cannot be undone</p>
              </div>
            </div>

            <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-4 space-y-1">
              <p className="text-sm text-white font-medium">{deleteTarget.name}</p>
              <p className="text-xs text-muted-foreground">{deleteTarget.email}</p>
              <p className="text-xs text-primary font-mono">{deleteTarget.code}</p>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p>This will permanently delete:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Their affiliate account & login credentials</li>
                <li>All active sessions (they'll be logged out immediately)</li>
                <li>Custom campaign links & commission rules</li>
                <li>All support tickets</li>
              </ul>
              <p className="text-xs mt-2">Financial history (payments, commissions) is preserved for records.</p>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Type <span className="font-mono text-white">DELETE</span> to confirm:</p>
              <Input
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="DELETE"
                className="bg-background/50 border-red-500/30 focus:border-red-500"
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setDeleteTarget(null); setConfirm(''); }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                disabled={confirm !== 'DELETE' || deleting}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white border-0"
              >
                {deleting ? 'Deleting...' : 'Delete Affiliate'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Affiliates</h1>
          <p className="text-muted-foreground mt-1">Manage active partners and view their performance.</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search affiliates..." className="pl-9 bg-card border-white/10" />
        </div>
      </div>

      <Card className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/50 text-muted-foreground uppercase font-semibold text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4">Partner</th>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Clicks</th>
                <th className="px-6 py-4 text-right">Customers</th>
                <th className="px-6 py-4 text-right">Revenue</th>
                <th className="px-6 py-4 text-right">Unpaid</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading && (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
              )}
              {data?.data.map((aff) => (
                <tr key={aff.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-medium text-white">{aff.user?.fullName ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">{aff.user?.email ?? '—'}</div>
                  </td>
                  <td className="px-6 py-4 font-mono text-primary bg-primary/5 rounded px-2">{aff.affiliateCode}</td>
                  <td className="px-6 py-4">
                    <Badge variant="outline" className={
                      aff.status === 'active' ? 'border-emerald-500/50 text-emerald-500' :
                      aff.status === 'paused' ? 'border-amber-500/50 text-amber-500' :
                      'border-red-500/50 text-red-500'
                    }>
                      {aff.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">{aff.totalClicks}</td>
                  <td className="px-6 py-4 text-right">{aff.totalCustomers}</td>
                  <td className="px-6 py-4 text-right font-medium">{formatCurrency(aff.totalRevenue)}</td>
                  <td className="px-6 py-4 text-right text-amber-500 font-medium">{formatCurrency(aff.unpaidCommission)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setDeleteTarget({
                          id: aff.id,
                          name: aff.user?.fullName ?? '—',
                          email: aff.user?.email ?? '—',
                          code: aff.affiliateCode,
                        })}
                        className="p-2 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete affiliate"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <Link href={`/admin/affiliates/${aff.id}`} className="inline-flex p-2 rounded hover:bg-secondary text-muted-foreground group-hover:text-primary transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
