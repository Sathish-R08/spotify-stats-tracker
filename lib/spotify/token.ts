import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import type { SpotifyTokenRow } from "@/lib/spotify/types"

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isExpired(expiresAt: string): boolean {
  // Treat as expired 60 seconds early to avoid edge-case races
  return new Date(expiresAt).getTime() - 60_000 < Date.now()
}

function basicAuthHeader(): string {
  const id = process.env.SPOTIFY_CLIENT_ID!
  const secret = process.env.SPOTIFY_CLIENT_SECRET!
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64")
}

// ---------------------------------------------------------------------------
// refreshSpotifyToken
// Calls the Spotify /api/token endpoint with grant_type=refresh_token,
// then upserts the new access_token + expires_at into spotify_tokens.
// Returns the new access token on success, throws on failure.
// ---------------------------------------------------------------------------

export async function refreshSpotifyToken(userId: string): Promise<string> {
  const admin = createAdminClient()

  // Fetch the current refresh token for this user
  const { data: row, error: fetchError } = await admin
    .from("spotify_tokens")
    .select("refresh_token")
    .eq("user_id", userId)
    .single()

  if (fetchError || !row) {
    throw new Error(`No Spotify token found for user ${userId}: ${fetchError?.message}`)
  }

  // Exchange refresh token with Spotify
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: row.refresh_token,
  })

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body: body.toString(),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Spotify token refresh failed (${response.status}): ${text}`)
  }

  const json = await response.json()
  const newAccessToken: string = json.access_token
  // Spotify returns expires_in in seconds (usually 3600)
  const expiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString()
  // Spotify may or may not return a new refresh_token — use the new one if provided
  const newRefreshToken: string = json.refresh_token ?? row.refresh_token

  // Persist updated tokens
  const { error: upsertError } = await admin
    .from("spotify_tokens")
    .update({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_at: expiresAt,
    })
    .eq("user_id", userId)

  if (upsertError) {
    throw new Error(`Failed to persist refreshed Spotify token: ${upsertError.message}`)
  }

  return newAccessToken
}

// ---------------------------------------------------------------------------
// getTokenForUser
// Returns a valid (non-expired) Spotify access token for the given Supabase
// user ID. Automatically refreshes if the stored token is expired or close
// to expiring.
// ---------------------------------------------------------------------------

export async function getTokenForUser(userId: string): Promise<string> {
  const admin = createAdminClient()

  const { data: row, error } = await admin
    .from("spotify_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .single<Pick<SpotifyTokenRow, "access_token" | "refresh_token" | "expires_at">>()

  if (error || !row) {
    throw new Error(
      `No Spotify token found for user ${userId}. The user must connect their Spotify account first.`,
    )
  }

  if (isExpired(row.expires_at)) {
    return refreshSpotifyToken(userId)
  }

  return row.access_token
}

// ---------------------------------------------------------------------------
// upsertSpotifyToken
// Called from the OAuth callback route after a successful Spotify login.
// Inserts or updates the full token set for a user.
// ---------------------------------------------------------------------------

export async function upsertSpotifyToken(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresInSeconds: number,
): Promise<void> {
  const admin = createAdminClient()
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()

  const { error } = await admin.from("spotify_tokens").upsert(
    {
      user_id: userId,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
    },
    { onConflict: "user_id" },
  )

  if (error) {
    throw new Error(`Failed to upsert Spotify token for user ${userId}: ${error.message}`)
  }
}
