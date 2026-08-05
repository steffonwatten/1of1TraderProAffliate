import React, { useState } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { useLogin } from '@workspace/api-client-react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cleared, setCleared] = useState(false);
  const { login } = useAuth();

  const clearSession = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setCleared(true);
    setError('');
    setTimeout(() => setCleared(false), 3000);
  };

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (res) => {
        login(res.token, res.user);
      },
      onError: (err: any) => {
        setError(err?.message || 'Invalid email or password');
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    loginMutation.mutate({ data: { email, password } });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative p-4 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[url('/images/hero-bg.png')] bg-cover bg-center opacity-30 mix-blend-screen pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="1OF1 Trader Pro"
            className="h-20 w-auto object-contain mx-auto mb-4 drop-shadow-[0_0_24px_rgba(251,191,36,0.4)]"
          />
          <h1 className="text-3xl font-display font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-muted-foreground">Sign in to your partner dashboard</p>
        </div>

        <Card className="glass-panel border-white/10 shadow-2xl">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  className="bg-background/50 border-white/10 h-12"
                  placeholder="name@example.com"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                  className="bg-background/50 border-white/10 h-12"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="p-3 text-sm bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
                  {error}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 text-background rounded-xl"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-4 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={clearSession}
                className="w-full text-xs text-muted-foreground hover:text-white transition-colors py-2"
              >
                {cleared ? '✓ Session cleared — try signing in again' : 'Having trouble signing in? Clear saved session'}
              </button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center mt-8 text-muted-foreground">
          Don't have an account?{' '}
          <Link href="/" className="text-primary hover:underline font-medium">Apply here</Link>
        </p>
      </motion.div>
    </div>
  );
}
