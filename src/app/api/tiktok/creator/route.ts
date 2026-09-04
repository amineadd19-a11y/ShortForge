import { NextRequest, NextResponse } from "next/server";
import { tiktokApi, unsealToken } from "@/lib/tiktok";

export const dynamic = "force-dynamic";

type CreatorInfo = {
  data: {
    creator_avatar_url?: string;
    creator_username: string;
    creator_nickname: string;
    privacy_level_options: string[];
    comment_disabled?: boolean;
    duet_disabled?: boolean;
    stitch_disabled?: boolean;
    max_video_post_duration_sec?: number;
  };
};

export async function GET(request: NextRequest) {
  const raw = request.cookies.get("shortforge_tiktok")?.value;
  const token = raw ? await unsealToken(raw) : null;
  if (!token) return NextResponse.json({ connected: false }, { status: 401 });

  try {
    const result = await tiktokApi<CreatorInfo>("/v2/post/publish/creator_info/query/", token, {
      method: "POST",
      body: JSON.stringify({}),
    });
    return NextResponse.json({ connected: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "TikTok creator info failed" }, { status: 502 });
  }
}
