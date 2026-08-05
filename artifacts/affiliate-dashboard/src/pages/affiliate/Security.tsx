import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Shield, Key, Monitor, Trash2, CheckCircle2, AlertCircle, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const authFetch = (path: string, opts: RequestInit = {}) => {
  const token = localStorage.getItem('auth_token');
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers },
  });
};

const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const formatTime = (d: string) => new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

type Session = { id: number; createdAt: string; expiresAt: string; isCurrent: boolean };

export default function AffiliateSecurity() {
  const { toast } = useToast();
  const { user } = useAuth();

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await authFetch('/api/auth/sessions');
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch {
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => { fetchSessions(); }, []);

  const passwordStrength = (pw: string) => {
    if (!pw) return { level: 0, label: '', color: '' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { level: score, label: 'Weak', color: 'bg-red-500' };
    if (score <= 3) return { level: score, label: 'Fair', color: 'bg-yellow-500' };
    return { level: score, label: 'Strong', color: 'bg-green-500' };
  };

  const strength = passwordStrength(form.newPassword);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      toast({ title: 'Fill all fields', variant: 'destructive' }); return;
    }
    if (form.newPassword !== form.confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' }); return;
    }
    if (form.newPassword.length < 8) {
      toast({ title: 'Password must be at least 8 characters', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      const res = await authFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Failed to change password');
      toast({ title: 'Password updated!', description: 'Your password has been changed successfully.' });
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const revokeSession = async (id: number) => {
    setRevokingId(id);
    try {
      await authFetch(`/api/auth/sessions/${id}`, { method: 'DELETE' });
      toast({ title: 'Session revoked' });
      fetchSessions();
    } catch {
      toast({ title: 'Failed to revoke session', variant: 'destructive' });
    } finally {
      setRevokingId(null);
    }
  };

  const revokeAllOther = async () => {
    setRevokingAll(true);
    try {
      await authFetch('/api/auth/sessions', { method: 'DELETE' });
      toast({ title: 'All other sessions revoked', description: 'Only your current session remains active.' });
      fetchSessions();
    } catch {
      toast({ title: 'Failed to revoke sessions', variant: 'destructive' });
    } finally {
      setRevokingAll(false);
    }
  };

  const otherSessions = sessions.filter(s => !s.isCurrent);

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-3xl font-display font-bold">Security</h1>
        <p className="text-muted-foreground mt-1">Manage your password and active sessions.</p>
      </div>

      {/* Account Overview */}
      <Card className="glass-panel border-primary/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 blur-3xl rounded-full pointer-events-none" />
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="font-bold text-white text-lg">{user?.fullName}</p>
              <p className="text-muted-foreground text-sm">{user?.email}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-green-400 font-medium">Account Active</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            Change Password
          </CardTitle>
          <CardDescription>Use a strong, unique password to protect your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-5">
            <div className="space-y-2">
              <Label>Current Password</Label>
              <div className="relative">
                <Input
                  type={showCurrent ? 'text' : 'password'}
                  value={form.currentPassword}
                  onChange={e => setForm({ ...form, currentPassword: e.target.value })}
                  className="bg-background/50 pr-10"
                  placeholder="Enter your current password"
                />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors">
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Separator className="bg-white/5" />

            <div className="space-y-2">
              <Label>New Password</Label>
              <div className="relative">
                <Input
                  type={showNew ? 'text' : 'password'}
                  value={form.newPassword}
                  onChange={e => setForm({ ...form, newPassword: e.target.value })}
                  className="bg-background/50 pr-10"
                  placeholder="Min. 8 characters"
                />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.newPassword && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= strength.level ? strength.color : 'bg-white/10'}`} />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Strength: <span className="text-white font-medium">{strength.label}</span></p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={form.confirmPassword}
                onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                className="bg-background/50"
                placeholder="Re-enter your new password"
              />
              {form.confirmPassword && form.newPassword !== form.confirmPassword && (
                <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Passwords do not match</p>
              )}
              {form.confirmPassword && form.newPassword === form.confirmPassword && form.newPassword && (
                <p className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Passwords match</p>
              )}
            </div>

            <Button type="submit" disabled={saving} className="bg-primary text-background hover:bg-primary/90 h-10 px-6">
              {saving ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Updating...</>
              ) : (
                <><Key className="w-4 h-4 mr-2" />Update Password</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card className="glass-panel">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="w-5 h-5 text-primary" />
                Active Sessions
              </CardTitle>
              <CardDescription className="mt-1">Devices currently signed into your account.</CardDescription>
            </div>
            {otherSessions.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={revokeAllOther}
                disabled={revokingAll}
                className="text-red-400 border-red-500/30 hover:bg-red-500/10 hover:text-red-300 shrink-0"
              >
                {revokingAll ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
                Revoke All Others
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingSessions ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="h-16 bg-white/[0.03] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No active sessions found.</div>
          ) : (
            sessions.map(session => (
              <div key={session.id} className={`flex items-center justify-between gap-4 p-4 rounded-xl border transition-colors ${session.isCurrent ? 'border-primary/30 bg-primary/5' : 'border-white/5 bg-white/[0.02]'}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${session.isCurrent ? 'bg-primary/15 text-primary' : 'bg-white/5 text-muted-foreground'}`}>
                    <Monitor className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">Session #{session.id}</p>
                      {session.isCurrent && (
                        <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">Current</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Started {formatDate(session.createdAt)} · Expires {formatDate(session.expiresAt)}
                    </p>
                  </div>
                </div>
                {!session.isCurrent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revokeSession(session.id)}
                    disabled={revokingId === session.id}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0"
                  >
                    {revokingId === session.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* 2FA — Coming Soon */}
      <Card className="glass-panel border-white/5 opacity-70">
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                <Shield className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-white">Two-Factor Authentication</p>
                <p className="text-xs text-muted-foreground">Extra layer of security for your account</p>
              </div>
            </div>
            <span className="text-xs bg-secondary px-3 py-1 rounded-full text-muted-foreground font-medium">Coming Soon</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
