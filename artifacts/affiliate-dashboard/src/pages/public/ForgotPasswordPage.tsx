import React, { useState } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        let message = 'Something went wrong. Please try again.';
        try {
          const data = await res.json();
          message = data.message || message;
        } catch {}
        throw new Error(message);
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative p-4 overflow-hidden">
      <div className="absolute inset-0 hero-grid opacity-30 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary mx-auto mb-6 flex items-center justify-center font-display font-bold text-background text-3xl shadow-[0_0_30px_rgba(250,204,21,0.4)]">
            1
          </div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">
            {submitted ? 'Check Your Email' : 'Forgot Password'}
          </h1>
          <p className="text-muted-foreground">
            {submitted
              ? 'If an account exists for that email, a reset link is on its way.'
              : 'Enter your email and we\'ll send you a reset link.'}
          </p>
        </div>

        <Card className="glass-panel border-white/10 shadow-2xl">
          <CardContent className="p-8">
            {submitted ? (
              <div className="text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-primary/20 border border-primary/30 mx-auto flex items-center justify-center">
                  <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  The reset link expires in <span className="text-white font-medium">1 hour</span>.
                  Check your spam folder if you don't see it.
                </p>
                <Link href="/login">
                  <Button className="w-full h-12 bg-primary hover:bg-primary/90 text-background font-bold rounded-xl">
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
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

                {error && (
                  <div className="p-3 text-sm bg-destructive/10 border border-destructive/20 text-destructive rounded-lg">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 text-background rounded-xl"
                  disabled={loading}
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center mt-8 text-muted-foreground">
          Remember your password?{' '}
          <Link href="/login" className="text-primary hover:underline font-medium">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
