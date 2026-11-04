// The single source of truth for feature flag keys in the app. Keys match the rows of public.feature_flags
// (supabase/migrations/20261102120150_feature_flags.sql). The database resolves each board's value through
// board_effective_features; read it with useFeature(key) from ./board.
//
// The defaults here mirror feature_flags.default_enabled: manual_intake and district_map on, the rest off.
// Signed-in pages always read the database (a key it doesn't return reads as off, spec section 7). The only
// runtime use of these defaults is the public share page when public_board returns no flags.

export const featureFlags = {
  manual_intake: { version: "V1", defaultEnabled: true, description: "Staff intake form" },
  district_map: { version: "V1", defaultEnabled: true, description: "Ticket map over the board boundary" },
  transcript_matching: { version: "V2", defaultEnabled: false, description: "Transcript view and AI-drafted tickets" },
  email_intake: { version: "V3", defaultEnabled: false, description: "Tickets created from email" },
  asset_generation: { version: "V3", defaultEnabled: false, description: "Social posts, resolutions, meeting minutes" },
  data_aggregation: { version: "V3", defaultEnabled: false, description: "Roll-up for borough presidents and mayors" },
  meeting_minutes: { version: "V3", defaultEnabled: false, description: "Draft meeting minutes from a processed transcript" },
} as const satisfies Record<string, { version: "V1" | "V2" | "V3"; defaultEnabled: boolean; description: string }>;

export type FeatureKey = keyof typeof featureFlags;
