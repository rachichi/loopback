import type { Place } from "./features/tickets/types";

// NYC Planning Labs GeoSearch: free, no key; finds NYC addresses and named places (not intersections).
const ENDPOINT = "https://geosearch.planninglabs.nyc/v2/autocomplete";

type Feature = {
  properties: { label: string; name?: string; borough?: string };
  geometry: { coordinates: [number, number] };
};

/** Up to 6 matching places, those in the board's borough first. Throws on network errors; aborts with the signal. */
export async function searchPlaces(text: string, borough: string, signal?: AbortSignal): Promise<Place[]> {
  const response = await fetch(`${ENDPOINT}?text=${encodeURIComponent(text)}`, { signal });
  if (!response.ok) throw new Error(`GeoSearch ${response.status}`);
  const { features } = (await response.json()) as { features: Feature[] };
  // GeoSearch names the borough on each result. The sort is stable, so GeoSearch's own ranking holds within each group.
  const outside = (feature: Feature) => (feature.properties.borough?.toLowerCase() === borough.toLowerCase() ? 0 : 1);
  return [...features]
    .sort((a, b) => outside(a) - outside(b))
    .slice(0, 6)
    .map((feature) => ({
      name: feature.properties.label.replace(/, New York, NY, USA$/, "").replace(/, USA$/, ""),
      lng: feature.geometry.coordinates[0],
      lat: feature.geometry.coordinates[1],
      source: "geosearch" as const,
    }));
}
