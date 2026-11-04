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

// The backup search, OpenStreetMap's Nominatim, for addresses GeoSearch lacks (1555 Bedford Avenue, for one).
// Its usage policy allows about one search a second and no search-as-you-type, so it only runs when someone asks
// (Enter with no matches, or the list's last row). Its data is ODbL; the map already credits OpenStreetMap.
const BACKUP_ENDPOINT = "https://nominatim.openstreetmap.org/search";
// West, north, east, south: keeps results inside the five boroughs.
const NYC_VIEWBOX = "-74.26,40.92,-73.69,40.49";

type BackupResult = {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: { house_number?: string; road?: string; suburb?: string; city_district?: string };
};

/** Up to 5 places from the backup search, those in the board's borough first. Throws on network errors. */
export async function searchMorePlaces(text: string, borough: string, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ q: text, format: "jsonv2", addressdetails: "1", limit: "5", countrycodes: "us", viewbox: NYC_VIEWBOX, bounded: "1" });
  const response = await fetch(`${BACKUP_ENDPOINT}?${params}`, { signal });
  if (!response.ok) throw new Error(`Place search ${response.status}`);
  const found = (await response.json()) as BackupResult[];
  const places = new Map<string, Place & { borough: string }>();
  for (const result of found) {
    const { house_number, road, suburb, city_district } = result.address ?? {};
    const area = suburb ?? city_district ?? "";
    const street = [house_number, road].filter(Boolean).join(" ");
    // Named places keep their name; addresses read like GeoSearch's ("1555 Bedford Avenue, Brooklyn").
    const name = [result.name || street || result.display_name.split(",")[0], area].filter(Boolean).join(", ");
    // OpenStreetMap can hold one building as several features; keep the first.
    if (!places.has(name)) places.set(name, { name, lat: Number(result.lat), lng: Number(result.lon), source: "osm", borough: area });
  }
  const outside = (place: { borough: string }) => (place.borough.toLowerCase() === borough.toLowerCase() ? 0 : 1);
  return [...places.values()].sort((a, b) => outside(a) - outside(b)).map(({ borough: _, ...place }) => place);
}
