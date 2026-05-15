import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { resolvePostLoginPath } from "@/lib/auth/post-login-redirect";

export async function GET() {
  const path = await resolvePostLoginPath(await headers());
  return NextResponse.json({ path });
}
