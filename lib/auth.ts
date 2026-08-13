import { betterAuth, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "@/lib/prisma";
import { consumeAdminCreatedUserStash } from "@/lib/admin-created-user-password";
import {
  assertUserCanJoinOrganization,
  countUserOrganizations,
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

const authOptions = {
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
  },
  trustedOrigins: [process.env.BETTER_AUTH_URL || "http://localhost:3000"],
  user: {
    changeEmail: {
      enabled: true,
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
            if (stash.phone?.trim()) {
              await prisma.user
                .update({
                  where: { id: user.id },
                  data: { phone: stash.phone.trim() },
                })
                .catch(() => undefined);
            }
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
      // Création d’org réservée à l’admin plateforme (pas gestionnaire / guichetier / parent).
      allowUserToCreateOrganization: async (user) => isAppAdminRole(user.role),
      organizationLimit: async (user) => {
        if (isAppAdminRole(user.role)) return false;
        const count = await countUserOrganizations(user.id);
        return count >= 1;
      },
      dynamicAccessControl: {
        enabled: true,
      },
      roles: organizationRoles,
      organizationHooks: {
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
      const organization = await getSessionOrganizationContext(
        user.id,
        session.activeOrganizationId,
      );

      return {
        user,
        session,
        organization,
      };
    }, authOptions),
  ],
});
