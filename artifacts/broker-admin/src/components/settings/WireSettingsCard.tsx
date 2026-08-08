import { useEffect, useState } from "react";
import { useGetBrokerWireSettings, useUpdateBrokerWireSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const EMPTY = {
  beneficiaryName: "",
  bankName: "",
  accountNumber: "",
  iban: "",
  swift: "",
  bankAddress: "",
  referenceInstructions: "",
};

export function WireSettingsCard() {
  const { toast } = useToast();
  const { data } = useGetBrokerWireSettings();
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (data?.wire) {
      setForm({
        beneficiaryName: data.wire.beneficiaryName ?? "",
        bankName: data.wire.bankName ?? "",
        accountNumber: data.wire.accountNumber ?? "",
        iban: data.wire.iban ?? "",
        swift: data.wire.swift ?? "",
        bankAddress: data.wire.bankAddress ?? "",
        referenceInstructions: data.wire.referenceInstructions ?? "",
      });
    }
  }, [data]);

  const update = useUpdateBrokerWireSettings({
    mutation: {
      onSuccess: () => toast({ title: "Wire details saved" }),
      onError: (err: any) =>
        toast({ title: "Could not save", description: err?.payload?.message, variant: "destructive" }),
    },
  });

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wire transfer details</CardTitle>
        <p className="text-sm text-muted-foreground">Shown to clients on the deposit page.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Beneficiary name</Label>
            <Input value={form.beneficiaryName} onChange={set("beneficiaryName")} />
          </div>
          <div className="space-y-2">
            <Label>Bank name</Label>
            <Input value={form.bankName} onChange={set("bankName")} />
          </div>
          <div className="space-y-2">
            <Label>IBAN</Label>
            <Input value={form.iban} onChange={set("iban")} />
          </div>
          <div className="space-y-2">
            <Label>Account number</Label>
            <Input value={form.accountNumber} onChange={set("accountNumber")} />
          </div>
          <div className="space-y-2">
            <Label>SWIFT / BIC</Label>
            <Input value={form.swift} onChange={set("swift")} />
          </div>
          <div className="space-y-2">
            <Label>Bank address</Label>
            <Input value={form.bankAddress} onChange={set("bankAddress")} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Reference instructions</Label>
          <Textarea value={form.referenceInstructions} onChange={set("referenceInstructions")} placeholder="e.g. Include your client email as the payment reference" />
        </div>
        <Button
          disabled={!form.beneficiaryName || !form.bankName || update.isPending}
          onClick={() =>
            update.mutate({
              data: {
                wire: {
                  beneficiaryName: form.beneficiaryName,
                  bankName: form.bankName,
                  accountNumber: form.accountNumber || null,
                  iban: form.iban || null,
                  swift: form.swift || null,
                  bankAddress: form.bankAddress || null,
                  referenceInstructions: form.referenceInstructions || null,
                },
              },
            })
          }
        >
          {update.isPending ? "Saving…" : "Save wire details"}
        </Button>
      </CardContent>
    </Card>
  );
}
