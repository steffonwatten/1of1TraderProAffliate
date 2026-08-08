import { useState } from "react";
import { useLocation } from "wouter";
import { useClientSetPassword } from "@workspace/api-client-react";
import { useClientAuth } from "@/lib/clientAuth";
import { AuthShell } from "./AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SetPasswordPage() {
  const [, setLocation] = useLocation();
  const { login } = useClientAuth();
  const token = sessionStorage.getItem("set_password_token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const setPasswordMutation = useClientSetPassword({
    mutation: {
      onSuccess: (data) => {
        sessionStorage.removeItem("signup_email");
        sessionStorage.removeItem("set_password_token");
        login(data.token, data.client);
        setLocation("/");
      },
      onError: (err: any) => setError(err?.payload?.message ?? "Could not set the password."),
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setPasswordMutation.mutate({ data: { setPasswordToken: token, password } });
  };

  if (!token) {
    setLocation("/signup");
    return null;
  }

  return (
    <AuthShell title="Set your password" subtitle="Email verified. One last step.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat your password" required />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={setPasswordMutation.isPending}>
          {setPasswordMutation.isPending ? "Saving…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
