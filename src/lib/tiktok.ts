import { createHash, randomBytes } from "node:crypto";

export const TIKTOK_API = "https://open.tiktokapis.com";
export const TIKTOK_AUTHORIZE = "https://www.tiktok.com/v2/auth/authorize/";
export const TIKTOK_SCOPES = "user.info.basic,video.publish";

export type TikTokToken = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  refresh_expires_at?: number;
  open_id?: string;
  scope?: string;
};

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function redirectUri(): string {
  return requiredEnv("TIKTOK_REDIRECT_URI");
}

export function createState(): string {
  return randomBytes(32).toString("base64url");
}

export function authorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_key: requiredEnv("TIKTOK_CLIENT_KEY"),
    response_type: "code",
    scope: process.env.TIKTOK_SCOPES || TIKTOK_SCOPES,
    redirect_uri: redirectUri(),
    state,
  });
  return `${TIKTOK_AUTHORIZE}?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<TikTokToken> {
  const body = new URLSearchParams({
    client_key: requiredEnv("TIKTOK_CLIENT_KEY"),
    client_secret: requiredEnv("TIKTOK_CLIENT_SECRET"),
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(),
  });

  const response = await fetch(`${TIKTOK_API}/v2/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const data = (await response.json()) as TikTokToken & { error?: string; error_description?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "TikTok token exchange failed");
  }
  return {
    ...data,
    expires_at: Date.now() + Number((data as TikTokToken & { expires_in?: number }).expires_in || 86400) * 1000,
  };
}

export async function refreshToken(token: TikTokToken): Promise<TikTokToken> {
  const body = new URLSearchParams({
    client_key: requiredEnv("TIKTOK_CLIENT_KEY"),
    client_secret: requiredEnv("TIKTOK_CLIENT_SECRET"),
    grant_type: "refresh_token",
    refresh_token: token.refresh_token,
  });
  const response = await fetch(`${TIKTOK_API}/v2/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const data = (await response.json()) as TikTokToken & { error?: string; error_description?: string; expires_in?: number };
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || "TikTok token refresh failed");
  return {
    ...token,
    ...data,
    refresh_token: data.refresh_token || token.refresh_token,
    expires_at: Date.now() + Number(data.expires_in || 86400) * 1000,
  };
}

export async function getValidToken(token: TikTokToken): Promise<TikTokToken> {
  if (token.expires_at > Date.now() + 60_000) return token;
  return refreshToken(token);
}

export async function tiktokApi<T>(path: string, token: TikTokToken, init: RequestInit = {}): Promise<T> {
  const valid = await getValidToken(token);
  const response = await fetch(`${TIKTOK_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${valid.access_token}`,
      "Content-Type": "application/json; charset=UTF-8",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  const data = (await response.json()) as T & { error?: { code?: string; message?: string } };
  if (!response.ok || (data.error?.code && data.error.code !== "ok")) {
    throw new Error(data.error?.message || `TikTok API request failed (${response.status})`);
  }
  return data;
}

// Encrypt tokens before putting them in an HttpOnly cookie. TIKTOK_COOKIE_SECRET is never exposed to the browser.
const encoder = new TextEncoder();
async function key(): Promise<CryptoKey> {
  const secret = requiredEnv("TIKTOK_COOKIE_SECRET");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function sealToken(token: TikTokToken): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), encoder.encode(JSON.stringify(token)));
  return `${Buffer.from(iv).toString("base64url")}.${Buffer.from(encrypted).toString("base64url")}`;
}

export async function unsealToken(value: string): Promise<TikTokToken | null> {
  try {
    const [ivPart, encryptedPart] = value.split(".");
    if (!ivPart || !encryptedPart) return null;
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: Buffer.from(ivPart, "base64url") },
      await key(),
      Buffer.from(encryptedPart, "base64url"),
    );
    return JSON.parse(new TextDecoder().decode(decrypted)) as TikTokToken;
  } catch {
    return null;
  }
}

export function hashState(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}
