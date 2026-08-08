import { WireSettingsCard } from "@/components/settings/WireSettingsCard";
import { CryptoAddressesCard } from "@/components/settings/CryptoAddressesCard";
import { AccountTypesCard } from "@/components/settings/AccountTypesCard";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl">Settings</h1>
      <WireSettingsCard />
      <CryptoAddressesCard />
      <AccountTypesCard />
    </div>
  );
}
