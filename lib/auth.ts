import { betterAuth, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "@/lib/prisma";
import { consumeAdminCreatedUserPlainPassword } from "@/lib/admin-created-user-password";
import {
  assertUserCanJoinOrganization,
  countUserOrganizations,
  getSessionOrganizationContext,
} from "@/lib/auth/org-membership";
import { isAppAdminRole } from "@/lib/permissions";
import { sendNewUserCredentialsEmail } from "@/lib/email/send-new-user-credentials";
import { sendVerificationEmail } from "@/lib/email/send-verification-email";
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
          const plain = consumeAdminCreatedUserPlainPassword(user.email);
          if (!plain) return;
          try {
            await sendNewUserCredentialsEmail({
              to: user.email,
              name: user.name,
              temporaryPassword: plain,
            });
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error("[databaseHooks.user.create.after] envoi email nouveau compte:", err);
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
