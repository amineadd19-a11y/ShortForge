import { NextRequest, NextResponse } from "next/server";
import { tiktokApi, unsealToken } from "@/lib/tiktok";

export const dynamic = "force-dynamic";

type StatusResponse = {
  data?: {
    status?: string;
    fail_reason?: string;
    publicaly_available_post_id?: string[];
    uploaded_bytes?: number;
  };
};

export async function POST(request: NextRequest) {
  const raw = request.cookies.get("shortforge_tiktok")?.value;
  const token = raw ? await unsealToken(raw) : null;
  if (!token) return NextResponse.json({ error: "TikTok account is not connected" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { publish_id?: string } | null;
  if (!body?.publish_id) return NextResponse.json({ error: "publish_id is required" }, { status: 400 });

  try {
    const result = await tiktokApi<StatusResponse>("/v2/post/publish/status/fetch/", token, {
      method: "POST",
      body: JSON.stringify({ publish_id: body.publish_id }),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "TikTok status check failed" }, { status: 502 });
  }
}
