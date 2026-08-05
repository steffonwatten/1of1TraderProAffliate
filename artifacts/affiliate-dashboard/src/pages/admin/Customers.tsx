import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Users, CheckCircle2, XCircle, Search, UserCheck, RefreshCw, Link as LinkIcon, Trash2, AlertTriangle, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const authFetch = (path: string, opts: RequestInit = {}) => {
  const token = localStorage.getItem('auth_token');
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers },
  });
};

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

type Customer = {
  id: string;
  name: string;
  email: string;
  package: string;
  packagePrice: number;
  status: 'active' | 'inactive';
  whopStatus: string;
  joinedAt: string | null;
  planId: string;
  isAffiliate: boolean;
  affiliateCode: string | null;
  affiliateStatus: string | null;
  referredById: number | null;
  referredByCode: string | null;
  referredByName: string | null;
};

type AffiliateOption = { id: number; name: string; email: string; code: string; commission: number };
type DeleteTarget = { id: string; name: string; email: string };
type AssignTarget = { id: string; name: string; email: string; currentAffiliateId: number | null };

export default function AdminCustomers() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [packageFilter, setPackageFilter] = useState('all');
  const [affiliateFilter, setAffiliateFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [affiliates, setAffiliates] = useState<AffiliateOption[]>([]);
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null);
  const [assignAffiliateId, setAssignAffiliateId] = useState<string>('');
  const [assigning, setAssigning] = useState(false);

  const fetchCustomers = () => {
    setLoading(true);
    setError(null);
    authFetch('/api/admin/whop/customers')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.message ?? d.error);
        setCustomers(d.customers ?? []);
      })
      .catch(e => setError(e.message ?? 'Failed to load customers'))
      .finally(() => setLoading(false));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await authFetch(`/api/admin/whop/customers/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Delete failed');
      toast({ title: 'Customer removed', description: `${deleteTarget.name} removed from local records. Sync Whop to re-import.` });
      setCustomers(prev => prev.filter(c => c.id !== deleteTarget.id));
      setDeleteTarget(null);
      setConfirm('');
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const fetchAffiliates = () => {
    authFetch('/api/admin/affiliates')
      .then(r => r.json())
      .then(d => {
        const list: AffiliateOption[] = (d.affiliates ?? []).map((a: any) => ({
          id: a.id,
          name: a.user?.fullName ?? a.affiliateCode,
          email: a.user?.email ?? '',
          code: a.affiliateCode,
          commission: a.defaultCommissionValue ?? 25,
        }));
        setAffiliates(list);
      })
      .catch(() => {});
  };

  const handleAssign = async () => {
    if (!assignTarget || !assignAffiliateId) return;
    setAssigning(true);
    try {
      const res = await authFetch(`/api/admin/whop/customers/${assignTarget.id}/assign-affiliate`, {
        method: 'POST',
        body: JSON.stringify({ affiliateId: parseInt(assignAffiliateId) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Assignment failed');

      const aff = affiliates.find(a => a.id === parseInt(assignAffiliateId));
      toast({
        title: 'Affiliate credited',
        description: `${assignTarget.name} → ${aff?.name ?? 'affiliate'}. ${data.commissionsCreated > 0 ? `${data.commissionsCreated} commission(s) created.` : 'No new commissions (no payments found).'}`,
      });

      // Update local state to reflect new attribution
      setCustomers(prev => prev.map(c =>
        c.id === assignTarget.id
          ? { ...c, referredById: parseInt(assignAffiliateId), referredByCode: aff?.code ?? null, referredByName: aff?.name ?? null }
          : c
      ));
      setAssignTarget(null);
      setAssignAffiliateId('');
    } catch (err: any) {
      toast({ title: 'Assignment failed', description: err.message, variant: 'destructive' });
    } finally {
      setAssigning(false);
    }
  };

  useEffect(() => { fetchCustomers(); fetchAffiliates(); }, []);

  const packageOptions = Array.from(new Set(customers.map(c => c.package))).sort();

  const filtered = customers.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (packageFilter !== 'all' && c.package !== packageFilter) return false;
    if (affiliateFilter === 'yes' && !c.isAffiliate) return false;
    if (affiliateFilter === 'no' && c.isAffiliate) return false;
    if (search) {
      const s = search.toLowerCase();
      return c.name.toLowerCase().includes(s) || c.email.toLowerCase().includes(s);
    }
    return true;
  });

  const totalActive = customers.filter(c => c.status === 'active').length;
  const totalInactive = customers.filter(c => c.status === 'inactive').length;
  const totalAffiliates = customers.filter(c => c.isAffiliate).length;

  if (loading) return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 bg-secondary rounded w-1/3" />
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-secondary rounded-xl" />)}
      </div>
      <div className="h-96 bg-secondary rounded-xl" />
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-card border border-red-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">Remove Customer Record</h3>
                <p className="text-xs text-muted-foreground">Removes local DB record only — Whop account is unaffected</p>
              </div>
            </div>

            <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-4 space-y-1">
              <p className="text-sm text-white font-medium">{deleteTarget.name}</p>
              <p className="text-xs text-muted-foreground">{deleteTarget.email}</p>
            </div>

            <div className="space-y-1 text-sm text-muted-foreground">
              <p>This will remove their membership record from your local database, including any affiliate attribution. Their Whop account remains intact.</p>
              <p className="text-xs mt-2">After removal, sync Whop to re-import them with fresh attribution.</p>
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
              <Button variant="outline" className="flex-1" onClick={() => { setDeleteTarget(null); setConfirm(''); }} disabled={deleting}>
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                disabled={confirm !== 'DELETE' || deleting}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white border-0"
              >
                {deleting ? 'Removing...' : 'Remove Customer'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Assign affiliate modal */}
      {assignTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-card border border-primary/30 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                <UserPlus className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">Assign Affiliate Credit</h3>
                <p className="text-xs text-muted-foreground">Give an affiliate retroactive credit for this customer</p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-1">
              <p className="text-sm text-white font-medium">{assignTarget.name}</p>
              <p className="text-xs text-muted-foreground">{assignTarget.email}</p>
              {assignTarget.currentAffiliateId && (
                <p className="text-xs text-amber-400 mt-1">Already attributed — selecting a new affiliate will override it.</p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Select which affiliate referred this customer:</p>
              <Select value={assignAffiliateId} onValueChange={setAssignAffiliateId}>
                <SelectTrigger className="bg-background/50 border-primary/30">
                  <SelectValue placeholder="Choose affiliate..." />
                </SelectTrigger>
                <SelectContent>
                  {affiliates.map(a => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      <span className="font-medium">{a.name}</span>
                      <span className="text-muted-foreground ml-2 text-xs">({a.code} · {a.commission}%)</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {assignAffiliateId && (() => {
              const aff = affiliates.find(a => a.id === parseInt(assignAffiliateId));
              return aff ? (
                <div className="bg-primary/8 border border-primary/20 rounded-xl p-3 text-xs text-muted-foreground space-y-1">
                  <p className="text-white font-medium">What will happen:</p>
                  <p>• Membership attributed to <span className="text-primary">{aff.name}</span> ({aff.code})</p>
                  <p>• Any existing payments for this membership will be credited at <span className="text-white">{aff.commission}% commission</span></p>
                  <p>• Commission records created for unpaid amounts</p>
                </div>
              ) : null;
            })()}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setAssignTarget(null); setAssignAffiliateId(''); }} disabled={assigning}>
                Cancel
              </Button>
              <Button
                onClick={handleAssign}
                disabled={!assignAffiliateId || assigning}
                className="flex-1 bg-primary text-black hover:bg-primary/90 border-0 font-semibold"
              >
                {assigning ? 'Assigning...' : 'Assign & Credit'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Customers</h1>
          <p className="text-muted-foreground mt-1">All customers from your Whop platform — live data.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchCustomers} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="glass-panel">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-2xl font-bold text-primary">{customers.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="text-2xl font-bold text-green-500">{totalActive}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Inactive</p>
              <p className="text-2xl font-bold text-red-500">{totalInactive}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Also Affiliates</p>
              <p className="text-2xl font-bold text-amber-400">{totalAffiliates}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="glass-panel">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search name or email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-background/50"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40 bg-background/50"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={packageFilter} onValueChange={setPackageFilter}>
              <SelectTrigger className="w-full sm:w-44 bg-background/50"><SelectValue placeholder="Package" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Packages</SelectItem>
                {packageOptions.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={affiliateFilter} onValueChange={setAffiliateFilter}>
              <SelectTrigger className="w-full sm:w-44 bg-background/50"><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                <SelectItem value="yes">Affiliates Only</SelectItem>
                <SelectItem value="no">Non-Affiliates</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
          )}

          {/* Table */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-muted-foreground">
                  <th className="pb-3 pr-4 font-medium">Customer</th>
                  <th className="pb-3 pr-4 font-medium">Package</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 pr-4 font-medium">Referred By</th>
                  <th className="pb-3 pr-4 font-medium">Is Affiliate</th>
                  <th className="pb-3 font-medium">Joined</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      No customers found
                    </td>
                  </tr>
                ) : (
                  filtered.map(c => (
                    <tr key={c.id} className="hover:bg-white/3 transition-colors group">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-primary font-bold text-xs shrink-0">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-white truncate max-w-[140px]">{c.name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[140px]">{c.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline" className={`text-xs font-medium ${
                          c.packagePrice >= 1500 ? 'border-purple-500/40 text-purple-400 bg-purple-500/10' :
                          c.packagePrice >= 375 ? 'border-blue-500/40 text-blue-400 bg-blue-500/10' :
                          c.packagePrice >= 175 ? 'border-primary/40 text-primary bg-primary/10' :
                          'border-white/20 text-white/60 bg-white/5'
                        }`}>
                          {c.package}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        {c.status === 'active' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                            <CheckCircle2 className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                            <XCircle className="w-3 h-3" /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {c.referredById ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/25">
                              <LinkIcon className="w-3 h-3" />
                              {c.referredByName ?? c.referredByCode}
                            </span>
                            <button
                              onClick={() => setAssignTarget({ id: c.id, name: c.name, email: c.email, currentAffiliateId: c.referredById })}
                              className="p-1 rounded hover:bg-white/10 text-transparent group-hover:text-muted-foreground hover:!text-primary transition-colors"
                              title="Change attribution"
                            >
                              <UserPlus className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAssignTarget({ id: c.id, name: c.name, email: c.email, currentAffiliateId: null })}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border border-dashed border-white/15 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                          >
                            <UserPlus className="w-3 h-3" /> Assign
                          </button>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {c.isAffiliate ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <UserCheck className="w-3 h-3" />
                            {c.affiliateStatus === 'approved' ? 'Yes' : c.affiliateStatus ?? 'Yes'}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground text-xs">{formatDate(c.joinedAt)}</td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => setDeleteTarget({ id: c.id, name: c.name, email: c.email })}
                          className="p-1.5 rounded hover:bg-red-500/10 text-transparent group-hover:text-muted-foreground hover:!text-red-400 transition-colors"
                          title="Remove customer record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <p className="text-xs text-muted-foreground mt-4">{filtered.length} of {customers.length} customers</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
