import { NextRequest, NextResponse } from "next/server";
import { tiktokApi, unsealToken } from "@/lib/tiktok";

export const dynamic = "force-dynamic";

type CreatorInfo = {
  data: {
    creator_username: string;
    creator_nickname: string;
    privacy_level_options: string[];
    comment_disabled?: boolean;
    duet_disabled?: boolean;
    stitch_disabled?: boolean;
    max_video_post_duration_sec?: number;
  };
};

type InitResponse = { data?: { publish_id?: string }; error?: { code?: string; message?: string } };

const allowedPrivacy = new Set(["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY"]);

export async function POST(request: NextRequest) {
  const raw = request.cookies.get("shortforge_tiktok")?.value;
  const token = raw ? await unsealToken(raw) : null;
  if (!token) return NextResponse.json({ error: "TikTok account is not connected" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    video_url?: string;
    title?: string;
    privacy_level?: string;
    disable_comment?: boolean;
    disable_duet?: boolean;
    disable_stitch?: boolean;
    cover_timestamp_ms?: number;
    is_aigc?: boolean;
    consent?: boolean;
  } | null;

  if (!body?.consent) return NextResponse.json({ error: "Explicit consent is required before publishing" }, { status: 400 });
  if (!body.video_url || !body.title) return NextResponse.json({ error: "video_url and title are required" }, { status: 400 });
  if (body.title.length > 2200) return NextResponse.json({ error: "TikTok caption exceeds 2200 UTF-16 characters" }, { status: 400 });

  let videoUrl: URL;
  try {
    videoUrl = new URL(body.video_url);
    if (videoUrl.protocol !== "https:") throw new Error("Video URL must use HTTPS");
  } catch {
    return NextResponse.json({ error: "video_url must be a valid HTTPS URL" }, { status: 400 });
  }

  try {
    // TikTok requires current creator info before every direct-post attempt.
    const creator = await tiktokApi<CreatorInfo>("/v2/post/publish/creator_info/query/", token, {
      method: "POST",
      body: JSON.stringify({}),
    });
    const privacy = body.privacy_level || "PUBLIC_TO_EVERYONE";
    if (!creator.data.privacy_level_options.includes(privacy) || !allowedPrivacy.has(privacy)) {
      return NextResponse.json({
        error: "Requested privacy level is not available for this creator",
        privacy_level_options: creator.data.privacy_level_options,
      }, { status: 400 });
    }

    const maxDuration = creator.data.max_video_post_duration_sec;
    const init = await tiktokApi<InitResponse>("/v2/post/publish/video/init/", token, {
      method: "POST",
      body: JSON.stringify({
        post_info: {
          title: body.title,
          privacy_level: privacy,
          disable_comment: body.disable_comment ?? Boolean(creator.data.comment_disabled),
          disable_duet: body.disable_duet ?? Boolean(creator.data.duet_disabled),
          disable_stitch: body.disable_stitch ?? Boolean(creator.data.stitch_disabled),
          ...(typeof body.cover_timestamp_ms === "number" ? { video_cover_timestamp_ms: body.cover_timestamp_ms } : {}),
          ...(typeof body.is_aigc === "boolean" ? { is_aigc: body.is_aigc } : {}),
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: videoUrl.toString(),
        },
      }),
    });

    const publishId = init.data?.publish_id;
    if (!publishId) throw new Error(init.error?.message || "TikTok did not return a publish_id");

    return NextResponse.json({
      ok: true,
      publish_id: publishId,
      creator: {
        username: creator.data.creator_username,
        nickname: creator.data.creator_nickname,
      },
      max_video_post_duration_sec: maxDuration,
      note: "Publishing is asynchronous; use the publish status endpoint to track this post.",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "TikTok publish failed" }, { status: 502 });
  }
}
