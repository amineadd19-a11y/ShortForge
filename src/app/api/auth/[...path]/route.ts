import { NextRequest, NextResponse } from 'next/server';

const AUTH_BASE =
  process.env.NEON_AUTH_BASE_URL ||
  'https://ep-spring-darkness-autn74r8.neonauth.c-10.us-east-1.aws.neon.tech/neondb/auth';

const ALLOWED = new Set(['sign-in/email', 'sign-up/email', 'sign-out', 'get-session']);

async function proxy(request: NextRequest, path: string) {
  if (!ALLOWED.has(path)) {
    return NextResponse.json({ error: 'Unsupported authentication action.' }, { status: 404 });
  }

  const origin = request.nextUrl.origin;
  const headers = new Headers();
  headers.set('accept', 'application/json');
  headers.set('origin', origin);
  headers.set('referer', `${origin}/`);

  const cookie = request.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);

  let body: string | undefined;
  if (request.method !== 'GET') {
    body = await request.text();
    headers.set('content-type', request.headers.get('content-type') || 'application/json');
  }

  try {
    const upstream = await fetch(`${AUTH_BASE}/${path}`, {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
      cache: 'no-store',
    });

    const response = new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
    });

    const contentType = upstream.headers.get('content-type');
    if (contentType) response.headers.set('content-type', contentType);

    const setCookies = upstream.headers.getSetCookie?.() || [];
    for (const setCookie of setCookies) response.headers.append('set-cookie', setCookie);

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Authentication service is temporarily unavailable.' },
      { status: 503 },
    );
  }
}

export async function GET(request: NextRequest, context: { params: { path?: string[] } }) {
  return proxy(request, (context.params.path || []).join('/'));
}

export async function POST(request: NextRequest, context: { params: { path?: string[] } }) {
  return proxy(request, (context.params.path || []).join('/'));
}
