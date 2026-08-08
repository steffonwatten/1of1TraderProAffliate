import { useState } from "react";
import { useLocation } from "wouter";
import { useClientVerifyEmail, useClientResendCode } from "@workspace/api-client-react";
import { AuthShell } from "./AuthShell";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export default function VerifyEmailPage() {
  const [, setLocation] = useLocation();
  const email = sessionStorage.getItem("signup_email") ?? "";
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const verify = useClientVerifyEmail({
    mutation: {
      onSuccess: (data) => {
        sessionStorage.setItem("set_password_token", data.setPasswordToken);
        setLocation("/set-password");
      },
      onError: (err: any) => setError(err?.payload?.message ?? "Invalid code."),
    },
  });
  const resend = useClientResendCode({
    mutation: {
      onSuccess: () => setResent(true),
      onError: (err: any) => setError(err?.payload?.message ?? "Could not resend the code."),
    },
  });

  const submit = (value: string) => {
    setError(null);
    verify.mutate({ data: { email, code: value } });
  };

  if (!email) {
    setLocation("/signup");
    return null;
  }

  return (
    <AuthShell title="Check your email" subtitle={`We sent a 6-digit code to ${email}.`}>
      <div className="flex flex-col items-center gap-6">
        <InputOTP
          maxLength={6}
          value={code}
          onChange={(v) => {
            setCode(v);
            if (v.length === 6) submit(v);
          }}
        >
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" disabled={code.length !== 6 || verify.isPending} onClick={() => submit(code)}>
          {verify.isPending ? "Verifying…" : "Verify"}
        </Button>
        <button
          className="text-sm text-muted-foreground hover:text-foreground"
          disabled={resend.isPending}
          onClick={() => {
            setResent(false);
            setError(null);
            resend.mutate({ data: { email } });
          }}
        >
          {resent ? "Code sent ✓" : "Resend code"}
        </button>
      </div>
    </AuthShell>
  );
}
