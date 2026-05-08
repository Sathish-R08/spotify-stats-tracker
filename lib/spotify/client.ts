import "server-only"

import { getTokenForUser, refreshSpotifyToken } from "@/lib/spotify/token"

const SPOTIFY_BASE_URL = "https://api.spotify.com/v1"

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class SpotifyAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SpotifyAuthError"
  }
}

export class SpotifyRateLimitError extends Error {
  retryAfter: number
  constructor(retryAfter: number) {
    super(`Spotify rate limit hit. Retry after ${retryAfter}s`)
    this.name = "SpotifyRateLimitError"
    this.retryAfter = retryAfter
  }
}

export class SpotifyApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "SpotifyApiError"
    this.status = status
  }
}

// ---------------------------------------------------------------------------
// Internal fetch helper
// ---------------------------------------------------------------------------

async function fetchWithToken(endpoint: string, accessToken: string): Promise<Response> {
  const url = endpoint.startsWith("https://")
    ? endpoint
    : `${SPOTIFY_BASE_URL}${endpoint}`

  return fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    // Disable Next.js data cache for Spotify responses — we use our own DB cache
    cache: "no-store",
  })
}

// ---------------------------------------------------------------------------
// spotifyFetch
//
// Authenticated fetch wrapper for Spotify API endpoints.
//
// @param endpoint  - API path (e.g. "/me/top/tracks") or full URL
// @param userId    - Supabase user UUID, used to look up & refresh the token
//
// Handles:
//   401 — token expired mid-request: refreshes once and retries
//   429 — rate limited: throws SpotifyRateLimitError with retryAfter seconds
//   other 4xx/5xx — throws SpotifyApiError
// ---------------------------------------------------------------------------

export async function spotifyFetch<T = unknown>(
  endpoint: string,
  userId: string,
): Promise<T> {
  let accessToken = await getTokenForUser(userId)
  let response = await fetchWithToken(endpoint, accessToken)

  // Handle token expiry reported by Spotify mid-request (race with our 60s buffer)
  if (response.status === 401) {
    try {
      accessToken = await refreshSpotifyToken(userId)
      response = await fetchWithToken(endpoint, accessToken)
    } catch {
      throw new SpotifyAuthError(
        "Spotify token refresh failed. The user must reconnect their Spotify account.",
      )
    }

    // If still 401 after refresh, the user has revoked access
    if (response.status === 401) {
      throw new SpotifyAuthError(
        "Spotify access was revoked. Please reconnect your Spotify account.",
      )
    }
  }

  // Rate limit
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get("Retry-After") ?? "30", 10)
    throw new SpotifyRateLimitError(retryAfter)
  }

  // Other error responses
  if (!response.ok) {
    let message = `Spotify API error ${response.status}`
    try {
      const body = await response.json()
      if (body?.error?.message) message = body.error.message
    } catch {
      // ignore JSON parse errors on error bodies
    }
    throw new SpotifyApiError(response.status, message)
  }

  // 204 No Content (e.g. some player endpoints)
  if (response.status === 204) {
    return null as T
  }

  return response.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Convenience wrappers for common Spotify endpoints
// ---------------------------------------------------------------------------

import type {
  SpotifyUser,
  SpotifyTopTracksResponse,
  SpotifyTopArtistsResponse,
  SpotifyRecentlyPlayed,
  SpotifyAudioFeaturesResponse,
  TimeRange,
} from "@/lib/spotify/types"

export function getSpotifyProfile(userId: string): Promise<SpotifyUser> {
  return spotifyFetch<SpotifyUser>("/me", userId)
}

export function getTopTracks(
  userId: string,
  timeRange: TimeRange,
  limit = 50,
): Promise<SpotifyTopTracksResponse> {
  return spotifyFetch<SpotifyTopTracksResponse>(
    `/me/top/tracks?time_range=${timeRange}&limit=${limit}`,
    userId,
  )
}

export function getTopArtists(
  userId: string,
  timeRange: TimeRange,
  limit = 50,
): Promise<SpotifyTopArtistsResponse> {
  return spotifyFetch<SpotifyTopArtistsResponse>(
    `/me/top/artists?time_range=${timeRange}&limit=${limit}`,
    userId,
  )
}

export function getRecentlyPlayed(
  userId: string,
  limit = 50,
): Promise<SpotifyRecentlyPlayed> {
  return spotifyFetch<SpotifyRecentlyPlayed>(
    `/me/player/recently-played?limit=${limit}`,
    userId,
  )
}

export function getAudioFeatures(
  userId: string,
  trackIds: string[],
): Promise<SpotifyAudioFeaturesResponse> {
  const ids = trackIds.slice(0, 100).join(",") // Spotify max = 100
  return spotifyFetch<SpotifyAudioFeaturesResponse>(
    `/audio-features?ids=${ids}`,
    userId,
  )
}
