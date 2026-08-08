import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetClientKyc, useUploadClientKycDocument } from "@workspace/api-client-react";
import { FileUp, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const DOC_TYPES = [
  { key: "id_front", label: "ID — front side", hint: "Passport or ID card, photo side" },
  { key: "id_back", label: "ID — back side", hint: "Back of your ID card (skip for passports)" },
  { key: "proof_of_address", label: "Proof of address", hint: "Utility bill or bank statement, under 3 months old" },
] as const;

function statusIcon(status: string | undefined) {
  if (status === "approved") return <CheckCircle2 className="h-5 w-5 text-[hsl(var(--positive))]" />;
  if (status === "rejected") return <XCircle className="h-5 w-5 text-destructive" />;
  if (status === "pending") return <Clock className="h-5 w-5 text-primary" />;
  return null;
}

function UploadTile({ docType, label, hint, latest }: {
  docType: (typeof DOC_TYPES)[number]["key"];
  label: string;
  hint: string;
  latest?: { status: string; originalName: string };
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = useUploadClientKycDocument({
    mutation: {
      onSuccess: () => {
        toast({ title: "Document uploaded", description: "We'll review it shortly." });
        queryClient.invalidateQueries();
      },
      onError: (err: any) =>
        toast({ title: "Upload failed", description: err?.payload?.message, variant: "destructive" }),
      onSettled: () => setUploading(false),
    },
  });

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum size is 10 MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    upload.mutate({ data: { docType, file } });
  };

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
        {statusIcon(latest?.status) ?? <FileUp className="h-5 w-5 text-muted-foreground" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {latest ? `${latest.originalName} — ${latest.status}` : hint}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <Button
        size="sm"
        variant={latest?.status === "approved" ? "secondary" : "default"}
        disabled={uploading || latest?.status === "approved"}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? "Uploading…" : latest ? "Replace" : "Upload"}
      </Button>
    </div>
  );
}

export default function VerificationPage() {
  const { data } = useGetClientKyc();
  const documents = data?.documents ?? [];

  const latestByType = new Map<string, (typeof documents)[number]>();
  for (const d of documents) {
    if (!latestByType.has(d.docType)) latestByType.set(d.docType, d);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl">Identity verification</h1>
        {data && (
          <Badge variant="secondary" className="capitalize">
            {data.kycStatus === "none" ? "Not started" : data.kycStatus}
          </Badge>
        )}
      </div>

      {data?.kycStatus === "rejected" && data.kycNotes && (
        <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          Review note: {data.kycNotes}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Upload your documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {DOC_TYPES.map((d) => (
            <UploadTile
              key={d.key}
              docType={d.key}
              label={d.label}
              hint={d.hint}
              latest={latestByType.get(d.key)}
            />
          ))}
          <p className="pt-2 text-xs text-muted-foreground">
            JPEG, PNG, WebP or PDF, up to 10 MB. Verification is required before you can open
            trading accounts.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
