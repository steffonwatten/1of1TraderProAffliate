import { useState } from "react";
import { useLocation } from "wouter";
import { BrandLockup } from "@workspace/brand";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCustomerAuth, type CustomerProfile } from "@/lib/customerAuth";

// Sign in, and claim-your-account, on one screen.
//
// Customers arrive here from a purchase confirmation, often months later and
// unsure whether they ever set a password. Two separate screens would make them
// guess which one they need; a single toggle does not.

type Mode = "login" | "claim" | "verify" | "forgot" | "reset";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/customer${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? "Something went wrong.");
  return data as T;
}

export default function CustomerAuthPage() {
  const [, navigate] = useLocation();
  const { login } = useCustomerAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (mode === "login") {
        const data = await post<{ token: string; customer: CustomerProfile }>("/auth/login", {
          email,
          password,
        });
        login(data.token, data.customer);
        navigate("/");
        return;
      }
      if (mode === "claim") {
        const data = await post<{ message: string }>("/auth/register", { email });
        setNotice(data.message);
        setMode("verify");
        return;
      }
      if (mode === "verify") {
        const data = await post<{ token: string; customer: CustomerProfile }>("/auth/verify", {
          email,
          code,
          password,
        });
        login(data.token, data.customer);
        navigate("/");
        return;
      }
      if (mode === "forgot") {
        const data = await post<{ message: string }>("/auth/forgot-password", { email });
        setNotice(data.message);
        setMode("reset");
        return;
      }
      const data = await post<{ message: string }>("/auth/reset-password", {
        email,
        code,
        password,
      });
      setNotice(data.message);
      setMode("login");
      setCode("");
      setPassword("");
    });
  };

  const copy: Record<Mode, { title: string; sub: string; cta: string }> = {
    login: {
      title: "Sign in",
      sub: "Access your indicator and support in one place.",
      cta: "Sign in",
    },
    claim: {
      title: "Set up your account",
      sub: "Use the email address you bought the indicator with — we'll send you a code.",
      cta: "Send code",
    },
    verify: {
      title: "Enter your code",
      sub: "Check your inbox for a 6-digit code, then choose a password.",
      cta: "Create account",
    },
    forgot: {
      title: "Reset your password",
      sub: "We'll email you a 6-digit code.",
      cta: "Send code",
    },
    reset: {
      title: "Choose a new password",
      sub: "Enter the code we emailed you and your new password.",
      cta: "Update password",
    },
  };

  const showCode = mode === "verify" || mode === "reset";
  const showPassword = mode === "login" || mode === "verify" || mode === "reset";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <BrandLockup height={42} className="mx-auto mb-5 text-white" />
          <h1 className="text-2xl font-bold text-white">{copy[mode].title}</h1>
          <p className="text-muted-foreground text-sm mt-1.5">{copy[mode].sub}</p>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="mt-1.5"
                />
              </div>

              {showCode && (
                <div>
                  <Label htmlFor="code">6-digit code</Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="000000"
                    autoComplete="one-time-code"
                    className="mt-1.5 tracking-[0.4em] text-center"
                  />
                </div>
              )}

              {showPassword && (
                <div>
                  <Label htmlFor="password">
                    {mode === "login" ? "Password" : "Choose a password"}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "login" ? "••••••••" : "At least 8 characters"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    className="mt-1.5"
                  />
                </div>
              )}

              {notice && <p className="text-sm text-primary">{notice}</p>}
              {error && <p className="text-sm text-red-400">{error}</p>}

              <Button type="submit" className="w-full" disabled={busy || !email.trim()}>
                {busy ? "Please wait…" : copy[mode].cta}
              </Button>
            </form>

            <div className="mt-5 pt-5 border-t border-border space-y-2 text-center text-sm">
              {mode === "login" && (
                <>
                  <p className="text-muted-foreground">
                    First time here?{" "}
                    <button onClick={() => setMode("claim")} className="text-primary hover:underline">
                      Set up your account
                    </button>
                  </p>
                  <p className="text-muted-foreground">
                    <button onClick={() => setMode("forgot")} className="text-primary hover:underline">
                      Forgot your password?
                    </button>
                  </p>
                </>
              )}
              {mode !== "login" && (
                <button onClick={() => setMode("login")} className="text-primary hover:underline">
                  Back to sign in
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Bought the indicator but can't get in? Email support and we'll sort it out.
        </p>
      </div>
    </div>
  );
}
