import { betterAuth, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "@/lib/prisma";
import { consumeAdminCreatedUserStash } from "@/lib/admin-created-user-password";
import {
  assertUserCanJoinOrganization,
  getSessionOrganizationContext,
} from "@/lib/auth/org-membership";
import { isAppAdminRole } from "@/lib/permissions";
import { sendNewUserCredentialsEmail } from "@/lib/email/send-new-user-credentials";
import { sendVerificationEmail } from "@/lib/email/send-verification-email";
import { resolveNotificationBranch } from "@/lib/notifications/branch-context";
import { admin, customSession, organization } from "better-auth/plugins";
import {
  APP_ROLE,
  ORG_ROLE,
  applicationRoles,
  authAccessControl,
  organizationRoles,
} from "@/lib/permissions";
import { seedOrganizationRolePresets } from "@/lib/org/seed-org-roles";

function resolveAuthBaseURL() {
  const port = process.env.PORT?.trim() || "3000";
  const localFallback = `http://localhost:${port}`;
  const fromEnv =
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim();
  if (!fromEnv) return localFallback;
  const cleaned = fromEnv.replace(/\/$/, "");
  // En local : si BETTER_AUTH_URL pointe un autre port que PORT (ex. 3011 vs 3000),
  // Next ne recharge pas .env par-dessus la variable système → on suit le PORT réel.
  if (process.env.NODE_ENV !== "production") {
    try {
      const u = new URL(cleaned);
      if (
        (u.hostname === "localhost" || u.hostname === "127.0.0.1") &&
        u.port &&
        u.port !== port
      ) {
        return localFallback;
      }
    } catch {
      /* ignore */
    }
  }
  return cleaned;
}

const authBaseURL = resolveAuthBaseURL();

/** Origines locales usuelles (localhost ↔ 127.0.0.1, PORT). */
function localDevOrigins(baseURL: string): string[] {
  const origins = new Set<string>([baseURL]);
  try {
    const u = new URL(baseURL);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
      const port = u.port || (u.protocol === "https:" ? "443" : "80");
      origins.add(`http://localhost:${port}`);
      origins.add(`http://127.0.0.1:${port}`);
      origins.add(`https://localhost:${port}`);
      origins.add(`https://127.0.0.1:${port}`);
    }
  } catch {
    /* ignore */
  }
  const port = process.env.PORT?.trim();
  if (port) {
    origins.add(`http://localhost:${port}`);
    origins.add(`http://127.0.0.1:${port}`);
  }
  // Toujours accepter 3000 en dev (cas BETTER_AUTH_URL désaligné)
  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }
  return [...origins];
}

const authOptions = {
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: authBaseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    minPasswordLength: 1,
    maxPasswordLength: 256,
  },
  trustedOrigins: localDevOrigins(authBaseURL),
  user: {
    changeEmail: {
      enabled: true,
    },
    additionalFields: {
      mustChangePassword: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      void sendVerificationEmail({
        to: user.email,
        url,
      });
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          if (!user?.email) return;
          const stash = consumeAdminCreatedUserStash(user.email);
          if (!stash?.password) return;
          try {
            await prisma.user
              .update({
                where: { id: user.id },
                data: {
                  mustChangePassword: true,
                  ...(stash.phone?.trim()
                    ? { phone: stash.phone.trim() }
                    : {}),
                },
              })
              .catch(() => undefined);
            const branch = await resolveNotificationBranch({
              branchId: stash.branchId,
            });
            await sendNewUserCredentialsEmail({
              to: user.email,
              phone: stash.phone,
              name: user.name,
              temporaryPassword: stash.password,
              role: stash.role,
              organizationName: stash.organizationName,
              branchName: branch.name,
              branchPhone: branch.phone,
              branchId: branch.id,
              loginUrl: stash.loginUrl ?? undefined,
            });
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error(
              "[databaseHooks.user.create.after] envoi credentials nouveau compte:",
              err,
            );
          }
        },
      },
    },
  },
  plugins: [
    admin({
      ac: authAccessControl,
      defaultRole: APP_ROLE.USER,
      adminRoles: [APP_ROLE.ADMIN],
      roles: applicationRoles,
    }),
    organization({
      ac: authAccessControl,
      creatorRole: ORG_ROLE.OWNER,
      // Création d’org réservée à l’admin plateforme.
      allowUserToCreateOrganization: async (user) => isAppAdminRole(user.role),
      // Multi-org : pas de limite (owner / admin / user peuvent appartenir à plusieurs orgs).
      organizationLimit: async () => false,
      dynamicAccessControl: {
        enabled: true,
      },
      roles: organizationRoles,
      organizationHooks: {
        afterCreateOrganization: async ({ organization }) => {
          // R02 — presets DAC (caissier, serveur, …). Owner reste creatorRole système.
          try {
            await seedOrganizationRolePresets(organization.id);
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error(
              "[organizationHooks.afterCreateOrganization] seed org role presets:",
              err,
            );
          }
        },
        beforeAddMember: async ({ user, organization }) => {
          await assertUserCanJoinOrganization(user.id, organization.id);
        },
        beforeAcceptInvitation: async ({ user, organization }) => {
          await assertUserCanJoinOrganization(user.id, organization.id);
        },
      },
    }),
  ],
} satisfies BetterAuthOptions;

export const auth = betterAuth({
  ...authOptions,
  plugins: [
    ...(authOptions.plugins ?? []),
    customSession(async ({ user, session }) => {
      const [organization, flags] = await Promise.all([
        getSessionOrganizationContext(
          user.id,
          session.activeOrganizationId,
        ),
        prisma.user.findUnique({
          where: { id: user.id },
          select: { mustChangePassword: true },
        }),
      ]);

      return {
        user: {
          ...user,
          mustChangePassword: flags?.mustChangePassword === true,
        },
        session,
        organization,
      };
    }, authOptions),
  ],
});
