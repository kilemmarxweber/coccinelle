import { createAuthClient } from "better-auth/react";
import { adminClient, customSessionClient, organizationClient } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";
import {
  APP_ROLE,
  ORG_ROLE,
  applicationRoles,
  authAccessControl,
  organizationRoles,
} from "@/lib/permissions";


function resolveAuthBaseURL(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return (
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:3000"
  );
}

export const authClient = createAuthClient({
  baseURL: resolveAuthBaseURL(),
  plugins: [
    adminClient({
      ac:authAccessControl, 
      roles:applicationRoles
    }),
    organizationClient({
      dynamicAccessControl: { enabled: true },
      ac:authAccessControl, 
      roles:organizationRoles,
      
    }),
    customSessionClient<typeof auth>(),
  ],
});

export const { signIn, signUp, useSession } = authClient;
