import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { resolveHotelPostLoginPath } from "@/lib/auth/hotel-post-login-redirect";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgSlug = searchParams.get("orgSlug")?.trim();
  if (!orgSlug) {
    return NextResponse.json({ error: "orgSlug requis." }, { status: 400 });
  }

  const path = await resolveHotelPostLoginPath(
    await headers(),
    orgSlug,
    searchParams.get("callbackUrl"),
  );
  return NextResponse.json({ path });
}
