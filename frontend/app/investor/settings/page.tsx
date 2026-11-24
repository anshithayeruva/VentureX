"use client";

import { PortalLayout } from "@/components/PortalLayout";
import { SettingsView } from "@/components/SettingsView";

export default function InvestorSettingsPage() {
  return (
    <PortalLayout role="INVESTOR" activeItem="settings" title="Settings">
      <SettingsView role="INVESTOR" />
    </PortalLayout>
  );
}
