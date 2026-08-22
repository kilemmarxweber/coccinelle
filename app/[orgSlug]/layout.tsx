import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { OrgBrandHeader } from "@/components/pwa/org-brand-header";
import { ApplyCustomerUiTheme } from "@/components/theme/apply-customer-ui-theme";
import { getPublicOrganizationThemeBySlug } from "@/lib/pwa/org";

type OrgPwaLayoutProps = {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
};

export default async function OrgPwaLayout({
  children,
  params,
}: OrgPwaLayoutProps) {
  const { orgSlug } = await params;
  const org = await getPublicOrganizationThemeBySlug(orgSlug);
  if (!org) notFound();

  return (
    <div className="min-h-svh bg-background">
      <ApplyCustomerUiTheme
        theme={org.customerUiTheme}
        enabled={org.customerUiEnabled}
      />
      <OrgBrandHeader org={org} />
      <div className="mx-auto w-full max-w-lg px-4 pb-10 pt-6">{children}</div>
    </div>
  );
}
