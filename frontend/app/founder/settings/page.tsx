"use client";

import { PortalLayout } from "@/components/PortalLayout";
import { SettingsView } from "@/components/SettingsView";

export default function FounderSettingsPage() {
  return (
    <PortalLayout role="FOUNDER" activeItem="settings" title="Settings">
      <SettingsView role="FOUNDER" />
    </PortalLayout>
  );
}
