"use client";

import { useEffect, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function OrganizationSectionLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const organizationId = params.organizationId as string;

  useEffect(() => {
    void authClient.organization.setActive({ organizationId });
  }, [organizationId]);

  return <div className="flex flex-col">{children}</div>;
}
