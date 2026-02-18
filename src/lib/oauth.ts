import crypto from "crypto";
import { getSupabaseServer } from "@/lib/supabase";

/* ─── Provider configuration ──────────────────────────────────── */

export interface OAuthProviderConfig {
  id: string;
  name: string;
  type: "oauth" | "api_key";
  authorizeUrl?: string;
  tokenUrl?: string;
  scopes?: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
}

export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  gmail: {
    id: "gmail",
    name: "Gmail",
    type: "oauth",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "openid",
      "email",
    ],
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
  },
  github: {
    id: "github",
    name: "GitHub",
    type: "oauth",
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scopes: ["repo", "read:user"],
    clientIdEnv: "GITHUB_CLIENT_ID",
    clientSecretEnv: "GITHUB_CLIENT_SECRET",
  },
  vercel: {
    id: "vercel",
    name: "Vercel",
    type: "oauth",
    authorizeUrl: "https://vercel.com/integrations/authorize",
    tokenUrl: "https://api.vercel.com/v2/oauth/access_token",
    scopes: [],
    clientIdEnv: "VERCEL_CLIENT_ID",
    clientSecretEnv: "VERCEL_CLIENT_SECRET",
  },
  stripe: {
    id: "stripe",
    name: "Stripe",
    type: "oauth",
    authorizeUrl: "https://connect.stripe.com/oauth/authorize",
    tokenUrl: "https://connect.stripe.com/oauth/token",
    scopes: ["read_write"],
    clientIdEnv: "STRIPE_CONNECT_CLIENT_ID",
    clientSecretEnv: "STRIPE_SECRET_KEY",
  },
  mercury: { id: "mercury", name: "Mercury", type: "api_key", clientIdEnv: "", clientSecretEnv: "" },
  ramp: { id: "ramp", name: "Ramp", type: "api_key", clientIdEnv: "", clientSecretEnv: "" },
  supabase: { id: "supabase", name: "Supabase", type: "api_key", clientIdEnv: "", clientSecretEnv: "" },
};

/* ─── Token encryption ────────────────────────────────────────── */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.OAUTH_TOKEN_SECRET;
  if (!secret) throw new Error("Missing OAUTH_TOKEN_SECRET env var");
  return Buffer.from(secret, "hex");
}

export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:ciphertext (all base64)
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptToken(ciphertext: string): string {
  const key = getEncryptionKey();
  const [ivB64, tagB64, encB64] = ciphertext.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const encrypted = Buffer.from(encB64, "base64");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

/* ─── OAuth state management ──────────────────────────────────── */

export function generateState(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function buildAuthorizeUrl(
  provider: OAuthProviderConfig,
  state: string,
  redirectUri: string
): string {
  const clientId = process.env[provider.clientIdEnv];
  if (!clientId) throw new Error(`Missing ${provider.clientIdEnv} env var`);

  const params = new URLSearchParams();

  if (provider.id === "stripe") {
    // Stripe Connect uses different param names
    params.set("response_type", "code");
    params.set("client_id", clientId);
    params.set("scope", provider.scopes?.join(" ") ?? "");
    params.set("redirect_uri", redirectUri);
    params.set("state", state);
  } else if (provider.id === "github") {
    params.set("client_id", clientId);
    params.set("redirect_uri", redirectUri);
    params.set("scope", provider.scopes?.join(" ") ?? "");
    params.set("state", state);
  } else {
    // Standard OAuth2 (Google, Vercel)
    params.set("response_type", "code");
    params.set("client_id", clientId);
    params.set("redirect_uri", redirectUri);
    params.set("scope", provider.scopes?.join(" ") ?? "");
    params.set("state", state);
    params.set("access_type", "offline");
    params.set("prompt", "consent");
  }

  return `${provider.authorizeUrl}?${params.toString()}`;
}

/* ─── Token exchange ──────────────────────────────────────────── */

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

export async function exchangeCodeForToken(
  provider: OAuthProviderConfig,
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  const clientId = process.env[provider.clientIdEnv];
  const clientSecret = process.env[provider.clientSecretEnv];
  if (!clientId || !clientSecret) {
    throw new Error(`Missing OAuth credentials for ${provider.name}`);
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  // GitHub requires Accept: application/json
  if (provider.id === "github") {
    headers.Accept = "application/json";
  }

  const res = await fetch(provider.tokenUrl!, {
    method: "POST",
    headers,
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown error");
    throw new Error(`Token exchange failed for ${provider.name}: ${res.status} ${text}`);
  }

  return res.json();
}

/* ─── Token storage ───────────────────────────────────────────── */

export async function storeToken(
  userId: string,
  provider: string,
  tokenData: TokenResponse
): Promise<void> {
  const supabase = getSupabaseServer();
  const id = `tok_${crypto.randomBytes(8).toString("hex")}`;
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  await supabase.from("oauth_tokens").upsert(
    {
      id,
      user_id: userId,
      provider,
      access_token: encryptToken(tokenData.access_token),
      refresh_token: tokenData.refresh_token ? encryptToken(tokenData.refresh_token) : null,
      expires_at: expiresAt,
      scopes: tokenData.scope ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" }
  );
}

export async function storeApiKey(
  userId: string,
  provider: string,
  apiKey: string
): Promise<void> {
  const supabase = getSupabaseServer();
  const id = `tok_${crypto.randomBytes(8).toString("hex")}`;

  await supabase.from("oauth_tokens").upsert(
    {
      id,
      user_id: userId,
      provider,
      access_token: encryptToken(apiKey),
      refresh_token: null,
      expires_at: null,
      scopes: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" }
  );
}

export async function getToken(
  userId: string,
  provider: string
): Promise<{ accessToken: string; refreshToken?: string } | null> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("oauth_tokens")
    .select("access_token, refresh_token")
    .eq("user_id", userId)
    .eq("provider", provider)
    .single();

  if (!data) return null;

  return {
    accessToken: decryptToken(data.access_token),
    refreshToken: data.refresh_token ? decryptToken(data.refresh_token) : undefined,
  };
}

export async function deleteToken(userId: string, provider: string): Promise<void> {
  const supabase = getSupabaseServer();
  await supabase
    .from("oauth_tokens")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);
}

export async function getConnectionStatus(
  userId: string
): Promise<Record<string, boolean>> {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from("oauth_tokens")
    .select("provider")
    .eq("user_id", userId);

  const status: Record<string, boolean> = {};
  for (const row of data ?? []) {
    status[row.provider] = true;
  }
  return status;
}
