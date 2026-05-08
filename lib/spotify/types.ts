// ---------------------------------------------------------------------------
// Spotify API — TypeScript interfaces
// ---------------------------------------------------------------------------

export type TimeRange = "short_term" | "medium_term" | "long_term"

// ---------------------------------------------------------------------------
// Spotify User
// ---------------------------------------------------------------------------

export interface SpotifyUser {
  id: string
  display_name: string | null
  email: string
  images: SpotifyImage[]
  country: string
  product: "free" | "premium" | string
  followers: { total: number }
  external_urls: { spotify: string }
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export interface SpotifyImage {
  url: string
  height: number | null
  width: number | null
}

export interface SpotifyExternalUrls {
  spotify: string
}

// ---------------------------------------------------------------------------
// Artist
// ---------------------------------------------------------------------------

export interface SpotifyArtist {
  id: string
  name: string
  genres: string[]
  popularity: number
  images: SpotifyImage[]
  followers: { total: number }
  external_urls: SpotifyExternalUrls
  type: "artist"
  uri: string
}

// Simplified artist reference embedded in track objects
export interface SpotifyArtistSimplified {
  id: string
  name: string
  external_urls: SpotifyExternalUrls
  type: "artist"
  uri: string
}

// ---------------------------------------------------------------------------
// Album
// ---------------------------------------------------------------------------

export interface SpotifyAlbum {
  id: string
  name: string
  album_type: "album" | "single" | "compilation"
  images: SpotifyImage[]
  release_date: string
  total_tracks: number
  artists: SpotifyArtistSimplified[]
  external_urls: SpotifyExternalUrls
}

// ---------------------------------------------------------------------------
// Track
// ---------------------------------------------------------------------------

export interface SpotifyTrack {
  id: string
  name: string
  duration_ms: number
  popularity: number
  preview_url: string | null
  explicit: boolean
  track_number: number
  disc_number: number
  artists: SpotifyArtistSimplified[]
  album: SpotifyAlbum
  external_urls: SpotifyExternalUrls
  type: "track"
  uri: string
}

// ---------------------------------------------------------------------------
// Recently Played
// ---------------------------------------------------------------------------

export interface SpotifyPlayHistoryObject {
  track: SpotifyTrack
  played_at: string // ISO 8601
  context: {
    type: "artist" | "playlist" | "album" | "show" | null
    href: string | null
    external_urls: SpotifyExternalUrls | null
    uri: string | null
  } | null
}

export interface SpotifyRecentlyPlayed {
  items: SpotifyPlayHistoryObject[]
  next: string | null
  cursors: {
    after: string
    before: string
  }
  limit: number
  href: string
}

// ---------------------------------------------------------------------------
// Audio Features
// ---------------------------------------------------------------------------

export interface SpotifyAudioFeatures {
  id: string
  uri: string
  track_href: string
  analysis_url: string
  type: "audio_features"
  /** Main musical key (0 = C, 1 = C#/Db, … 11 = B). -1 if not detected. */
  key: number
  /** 0 = minor, 1 = major */
  mode: number
  time_signature: number
  tempo: number
  loudness: number
  /** 0.0 – 1.0 */
  danceability: number
  /** 0.0 – 1.0 */
  energy: number
  /** 0.0 – 1.0 */
  valence: number
  /** 0.0 – 1.0 */
  acousticness: number
  /** 0.0 – 1.0 */
  instrumentalness: number
  /** 0.0 – 1.0 */
  liveness: number
  /** 0.0 – 1.0 */
  speechiness: number
  duration_ms: number
}

export interface SpotifyAudioFeaturesResponse {
  audio_features: (SpotifyAudioFeatures | null)[]
}

// ---------------------------------------------------------------------------
// Paginated top items response
// ---------------------------------------------------------------------------

export interface SpotifyTopTracksResponse {
  items: SpotifyTrack[]
  total: number
  limit: number
  offset: number
  next: string | null
  previous: string | null
  href: string
}

export interface SpotifyTopArtistsResponse {
  items: SpotifyArtist[]
  total: number
  limit: number
  offset: number
  next: string | null
  previous: string | null
  href: string
}

// ---------------------------------------------------------------------------
// Internal DB row types (matching supabase table schema)
// ---------------------------------------------------------------------------

export interface SpotifyTokenRow {
  id: string
  user_id: string
  access_token: string
  refresh_token: string
  expires_at: string // ISO string from Supabase
  created_at: string
  updated_at: string
}

export interface SpotifyCacheRow {
  id: string
  user_id: string
  cache_key: string
  data: unknown
  cached_at: string
  expires_at: string
}
