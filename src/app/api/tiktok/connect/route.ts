import { NextResponse } from "next/server";
import { authorizationUrl, createState } from "@/lib/tiktok";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = createState();
    const response = NextResponse.redirect(authorizationUrl(state));
    response.cookies.set("shortforge_tiktok_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "TikTok is not configured" }, { status: 503 });
  }
}
