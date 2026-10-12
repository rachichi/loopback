import type { Place } from "./goldTickets";

// NYC Planning Labs GeoSearch: free, no key; finds NYC addresses and named places (not intersections).
const ENDPOINT = "https://geosearch.planninglabs.nyc/v2/autocomplete";

type Feature = { properties: { label: string; name?: string }; geometry: { coordinates: [number, number] } };

/** Up to 6 matching places, Manhattan first. Throws on network errors; aborts with the signal. */
export async function searchPlaces(text: string, signal?: AbortSignal): Promise<Place[]> {
  const response = await fetch(`${ENDPOINT}?text=${encodeURIComponent(text)}`, { signal });
  if (!response.ok) throw new Error(`GeoSearch ${response.status}`);
  const { features } = (await response.json()) as { features: Feature[] };
  const places = features.map((feature) => ({
    name: feature.properties.label.replace(/, New York, NY, USA$/, "").replace(/, USA$/, ""),
    lng: feature.geometry.coordinates[0],
    lat: feature.geometry.coordinates[1],
    source: "geosearch" as const,
  }));
  const manhattan = (place: Place) => (place.name.includes(",") ? 1 : 0); // other boroughs carry ", Brooklyn" etc.
  return places.sort((a, b) => manhattan(a) - manhattan(b)).slice(0, 6);
}
