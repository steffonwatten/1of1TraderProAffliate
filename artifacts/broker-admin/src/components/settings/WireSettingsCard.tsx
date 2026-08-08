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
  beneficiaryAddress: "",
  bankName: "",
  bankAddress: "",
  domRouting: "",
  domAccount: "",
  intlIntermediary: "",
  intlSwift: "",
  intlBeneficiaryBank: "",
  intlRouting: "",
  intlAccount: "",
  intlMemo: "",
  referenceInstructions: "",
};

function Field({ label, value, onChange, placeholder }: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  );
}

export function WireSettingsCard() {
  const { toast } = useToast();
  const { data } = useGetBrokerWireSettings();
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    const w = data?.wire;
    if (w) {
      setForm({
        beneficiaryName: w.beneficiaryName ?? "",
        beneficiaryAddress: w.beneficiaryAddress ?? "",
        bankName: w.bankName ?? "",
        bankAddress: w.bankAddress ?? "",
        domRouting: w.domestic?.routingNumber ?? "",
        domAccount: w.domestic?.accountNumber ?? "",
        intlIntermediary: w.international?.intermediaryBank ?? "",
        intlSwift: w.international?.swift ?? "",
        intlBeneficiaryBank: w.international?.beneficiaryBank ?? "",
        intlRouting: w.international?.routingNumber ?? "",
        intlAccount: w.international?.accountNumber ?? "",
        intlMemo: w.international?.memo ?? "",
        referenceInstructions: w.referenceInstructions ?? "",
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

  const save = () =>
    update.mutate({
      data: {
        wire: {
          beneficiaryName: form.beneficiaryName,
          beneficiaryAddress: form.beneficiaryAddress || null,
          bankName: form.bankName,
          bankAddress: form.bankAddress || null,
          domestic:
            form.domRouting && form.domAccount
              ? { routingNumber: form.domRouting, accountNumber: form.domAccount }
              : null,
          international: form.intlSwift
            ? {
                intermediaryBank: form.intlIntermediary || null,
                swift: form.intlSwift,
                beneficiaryBank: form.intlBeneficiaryBank || null,
                routingNumber: form.intlRouting || null,
                accountNumber: form.intlAccount || null,
                memo: form.intlMemo || null,
              }
            : null,
          referenceInstructions: form.referenceInstructions || null,
        },
      },
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wire transfer details</CardTitle>
        <p className="text-sm text-muted-foreground">Shown to clients on the deposit page.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Beneficiary name" value={form.beneficiaryName} onChange={set("beneficiaryName")} />
          <Field label="Beneficiary address" value={form.beneficiaryAddress} onChange={set("beneficiaryAddress")} />
          <Field label="Beneficiary bank" value={form.bankName} onChange={set("bankName")} />
          <Field label="Bank address" value={form.bankAddress} onChange={set("bankAddress")} />
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Domestic US wires
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Routing number" value={form.domRouting} onChange={set("domRouting")} />
            <Field label="Account number" value={form.domAccount} onChange={set("domAccount")} />
          </div>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            International wires
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Send funds to (intermediary bank)" value={form.intlIntermediary} onChange={set("intlIntermediary")} />
            <Field label="SWIFT code" value={form.intlSwift} onChange={set("intlSwift")} />
            <Field label="Beneficiary (bank)" value={form.intlBeneficiaryBank} onChange={set("intlBeneficiaryBank")} />
            <Field label="Routing number" value={form.intlRouting} onChange={set("intlRouting")} />
            <Field label="Account number" value={form.intlAccount} onChange={set("intlAccount")} />
            <Field label="Memo / Ref" value={form.intlMemo} onChange={set("intlMemo")} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Reference instructions</Label>
          <Textarea
            value={form.referenceInstructions}
            onChange={set("referenceInstructions")}
            placeholder="e.g. Include your client email in the wire memo/reference"
          />
        </div>
        <Button disabled={!form.beneficiaryName || !form.bankName || update.isPending} onClick={save}>
          {update.isPending ? "Saving…" : "Save wire details"}
        </Button>
      </CardContent>
    </Card>
  );
}
