import { createAuthClient } from "better-auth/react";
import { adminClient, customSessionClient, organizationClient } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";


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
    adminClient(),
    organizationClient({
      dynamicAccessControl: { enabled: true },
    }),
    customSessionClient<typeof auth>(),
  ],
});

export const { signIn, signUp, useSession } = authClient;
