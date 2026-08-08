import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useClientRegister } from "@workspace/api-client-react";
import { AuthShell } from "./AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [error, setError] = useState<string | null>(null);

  const register = useClientRegister({
    mutation: {
      onSuccess: () => {
        sessionStorage.setItem("signup_email", email.toLowerCase().trim());
        setLocation("/verify");
      },
      onError: (err: any) => setError(err?.payload?.message ?? "Something went wrong. Try again."),
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    register.mutate({ data: { email, fullName, phone: phone || null, country: country || null } });
  };

  return (
    <AuthShell title="Create your account" subtitle="Trade global markets in minutes.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter your full name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 000 0000" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Country (optional)</Label>
          <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="United States" />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={register.isPending}>
          {register.isPending ? "Sending code…" : "Continue"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary">Log in</Link>
      </p>
    </AuthShell>
  );
}
