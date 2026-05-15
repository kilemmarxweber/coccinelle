import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getUserOrganizationMembership } from "@/lib/auth/org-membership";
import { resolvePostLoginPath } from "@/lib/auth/post-login-redirect";
import { APP_ROLE, isAppAdminRole } from "@/lib/permissions";

const SIGN_IN_PATH = "/auth/sign-in";

function isAuthPage(pathname: string): boolean {
  return (
    pathname.startsWith("/auth/sign-in") ||
    pathname.startsWith("/auth/sign-up") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up")
  );
}

function isProtectedPage(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isProtectedApi(pathname: string): boolean {
  return pathname.startsWith("/api/admin/");
}

function isPublicAuthApi(pathname: string): boolean {
  if (!pathname.startsWith("/api/auth/")) return false;
  const publicPrefixes = [
    "/api/auth/sign-in",
    "/api/auth/sign-up",
    "/api/auth/get-session",
    "/api/auth/ok",
    "/api/auth/error",
  ];
  return publicPrefixes.some((prefix) => pathname.startsWith(prefix));
}

function requiresAuthApi(pathname: string): boolean {
  if (isProtectedApi(pathname)) return true;
  if (!pathname.startsWith("/api/auth/")) return false;
  return !isPublicAuthApi(pathname);
}

async function getSession(request: NextRequest) {
  return auth.api.getSession({ headers: request.headers });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await getSession(request);
  const isAuthenticated = Boolean(session?.user);

  if (requiresAuthApi(pathname) && !isAuthenticated) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  if (isAuthPage(pathname) && isAuthenticated) {
    const destination = await resolvePostLoginPath(request.headers);
    return NextResponse.redirect(new URL(destination, request.url));
  }

  if (isProtectedPage(pathname) && !isAuthenticated) {
    const signInUrl = new URL(SIGN_IN_PATH, request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (isProtectedPage(pathname) && isAuthenticated && session?.user) {
    const role = session.user.role;

    if (role === APP_ROLE.USER) {
      const homePath = await resolvePostLoginPath(request.headers);

      if (
        pathname === "/admin" ||
        pathname === "/admin/organizations" ||
        pathname.startsWith("/admin/organizations/new")
      ) {
        return NextResponse.redirect(new URL(homePath, request.url));
      }

      const orgRoute = pathname.match(/^\/admin\/organizations\/([^/]+)/);
      if (orgRoute) {
        const requestedOrgId = orgRoute[1];
        const membership = await getUserOrganizationMembership(session.user.id);
        if (membership && membership.organizationId !== requestedOrgId) {
          return NextResponse.redirect(new URL(homePath, request.url));
        }
      }
    }

    if (!isAppAdminRole(role) && pathname.startsWith("/admin/organizations/new")) {
      const homePath = await resolvePostLoginPath(request.headers);
      return NextResponse.redirect(new URL(homePath, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/auth/sign-in",
    "/auth/sign-in/:path*",
    "/auth/sign-up",
    "/auth/sign-up/:path*",
    "/sign-in/:path*",
    "/sign-up/:path*",
    "/admin",
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/auth/:path*",
  ],
};
