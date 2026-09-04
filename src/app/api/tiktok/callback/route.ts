import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, sealToken } from "@/lib/tiktok";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error_description") || url.searchParams.get("error");
  const savedState = request.cookies.get("shortforge_tiktok_state")?.value;

  if (error) return NextResponse.json({ error }, { status: 400 });
  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.json({ error: "Invalid TikTok OAuth state" }, { status: 400 });
  }

  try {
    const token = await exchangeCode(code);
    const sealed = await sealToken(token);
    const response = NextResponse.redirect(new URL("/?tiktok=connected", request.url));
    response.cookies.set("shortforge_tiktok", sealed, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    response.cookies.delete("shortforge_tiktok_state");
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "TikTok authorization failed" }, { status: 502 });
  }
}
