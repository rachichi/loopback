// Finds a map point for a ticket's location without anyone picking it from a list. It is deliberately strict:
// a wrong pin is worse than none, so it only pins what matches an actual place.
//   Two streets (typed as Cross streets, or worded "A and B" in a meeting): worked out from NYC's street
//   centerline data, which is the real intersection or, when the streets don't quite meet, the nearest point.
//   Photon, an OpenStreetMap search, is the backup when the centerline data doesn't know a street's name.
// The board's boundary is not a filter: boards discuss streets just outside their district, and a pin there is
// right. It only picks between lookalikes: if two streets cross in more than one place in the borough, the
// crossing nearest the board's centre wins. The borough is always enforced.
//   Anything else: an exact address or named place from NYC GeoSearch ("1000 Franklin Ave"). A bare street name
//   is not pinned: GeoSearch answers with some house on it, which would be a made-up point.
import type { CrossStreets, Place, TicketLocation } from "./features/tickets/types";
import { searchPlaces } from "./geosearch";

const PHOTON = "https://photon.komoot.io/api/";
// West, south, east, north: the five boroughs, the guard for a board with no boundary.
const NYC_BOX = { west: -74.26, south: 40.49, east: -73.69, north: 40.92 };

const ABBREVIATIONS: Record<string, string> = {
  ave: "avenue", av: "avenue", st: "street", blvd: "boulevard", rd: "road", pkwy: "parkway", pl: "place",
  dr: "drive", ln: "lane", ct: "court", hwy: "highway", terr: "terrace", n: "north", s: "south", e: "east", w: "west",
};

/** "5 Ave." and "5th Avenue" style names reduced to comparable words: lower case, abbreviations spelled out. */
export function normalizeStreet(text: string): string {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  // "St Marks Place" is Saint Marks, not Street Marks.
  if (words[0] === "st" && words.length > 2) words[0] = "saint";
  return words.map((word) => ABBREVIATIONS[word] ?? word).join(" ");
}

const STREET_WORD = /\b(street|st|avenue|ave|av|boulevard|blvd|road|rd|place|pl|parkway|pkwy|drive|dr|lane|ln|court|ct|way|terrace|plaza|highway|hwy|expressway|broadway|bowery)\b/i;

/** "Franklin and Eastern Parkway", "corner of Utica Ave & Bergen St": the two streets, or null if it doesn't read that way. */
export function crossStreetsFrom(text: string): CrossStreets | null {
  const match = text.trim().replace(/^(the\s+)?(corner|intersection)\s+of\s+/i, "").match(/^(.+?)\s+(?:and|&|at|@)\s+(.+)$/i);
  if (!match) return null;
  const [a, b] = [match[1].trim(), match[2].replace(/[.,;]+$/, "").trim()];
  const short = (street: string) => street.split(/\s+/).length <= 4;
  return a && b && short(a) && short(b) && (STREET_WORD.test(a) || STREET_WORD.test(b)) ? { a, b } : null;
}

type Context = { borough: string; boundary: GeoJSON.GeoJsonObject | null; signal?: AbortSignal };

// NYC Street Centerline (CSCL) on NYC Open Data: free, no key, fast, and allows browser requests.
const CENTERLINE = "https://data.cityofnewyork.us/resource/inkn-q76z.json";
const BOROUGH_CODE: Record<string, string> = { manhattan: "1", bronx: "2", brooklyn: "3", queens: "4", "staten island": "5" };
// South, west, north, east of each borough, so a lookup only fetches street segments that could matter.
const BOROUGH_BOX: Record<string, [number, number, number, number]> = {
  manhattan: [40.68, -74.03, 40.88, -73.9],
  bronx: [40.78, -73.94, 40.92, -73.76],
  brooklyn: [40.57, -74.05, 40.74, -73.83],
  queens: [40.54, -73.97, 40.8, -73.7],
  "staten island": [40.48, -74.26, 40.65, -74.04],
};

// Both the typed name and the centerline's name are cut down the same way, so "Avenue J", "Ave J", "E 45 ST"
// and "East 45th Street" compare equal. (Centerline names read "UTICA AVE", "E  45 ST", "ST MARKS PL".)
const CANON: Record<string, string> = {
  avenue: "ave", av: "ave", street: "st", saint: "st", boulevard: "blvd", parkway: "pkwy", road: "rd", place: "pl",
  drive: "dr", lane: "ln", court: "ct", terrace: "ter", terr: "ter", highway: "hwy", east: "e", west: "w", north: "n", south: "s",
};
const KINDS = new Set(["ave", "st", "blvd", "pkwy", "rd", "pl", "dr", "ln", "ct", "ter", "hwy", "e", "w", "n", "s"]);
const canon = (text: string) =>
  text.toLowerCase().replace(/(\d+)(st|nd|rd|th)\b/g, "$1").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean).map((word) => CANON[word] ?? word).join(" ");

// Street names for people: "UTICA AVE" and "fulton st" both read "Utica Avenue" and "Fulton Street", "E  45 ST" reads
// "East 45th Street". A word typed in mixed case ("McDonald") is left as it is.
const FULL: Record<string, string> = { ave: "Avenue", st: "Street", blvd: "Boulevard", pkwy: "Parkway", rd: "Road", pl: "Place", dr: "Drive", ln: "Lane", ct: "Court", ter: "Terrace", hwy: "Highway" };
const DIRECTIONS: Record<string, string> = { e: "East", w: "West", n: "North", s: "South" };
const ordinal = (n: string) => `${n}${/1[123]$/.test(n) ? "th" : { 1: "st", 2: "nd", 3: "rd" }[Number(n.slice(-1)) as 1 | 2 | 3] ?? "th"}`;

export function displayStreet(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.map((raw, index) => {
    const word = raw.replace(/[.,]+$/, "");
    const lower = word.toLowerCase();
    if (/^\d+$/.test(word)) return ordinal(word);
    if (/[a-z][A-Z]/.test(word)) return word; // a capital inside the word ("McDonald"): as typed
    if (index === 0 && words.length > 1 && (lower === "st" || lower === "saint")) return "Saint";
    if (index === 0 && words.length > 2 && DIRECTIONS[lower]) return DIRECTIONS[lower];
    // "Ave J" and "Avenue J" are lettered avenues: the type comes first and stays whole.
    if (index === words.length - 1 || index > 0) {
      const full = FULL[CANON[lower] ?? lower];
      if (full) return full;
    }
    if (index === 0 && FULL[CANON[lower] ?? lower] && words.length > 1) return FULL[CANON[lower] ?? lower];
    if (word.length === 1) return word.toUpperCase();
    return lower.replace(/\b([a-z])/g, (c) => c.toUpperCase());
  }).join(" ");
}

type Point = [number, number]; // longitude, latitude

const meters = (p: Point, q: Point) => Math.hypot((p[0] - q[0]) * Math.cos((p[1] * Math.PI) / 180) * 111320, (p[1] - q[1]) * 110540);

/** The vertices of every centerline segment named like this street, within the board's area. */
async function streetVertices(street: string, box: [number, number, number, number], ctx: Context): Promise<{ name: string; points: Point[] }> {
  const wanted = canon(street);
  // The most telling word ("utica", "45") narrows the query; the exact name is checked after.
  const core = wanted.split(" ").filter((word) => !KINDS.has(word)).sort((a, b) => b.length - a.length)[0] ?? wanted.split(" ")[0];
  if (!core) return { name: displayStreet(street), points: [] };
  const code = BOROUGH_CODE[ctx.borough.toLowerCase()];
  const where = [`upper(full_street_name) like '%${core.toUpperCase()}%'`, code ? `boroughcode='${code}'` : null, `within_box(the_geom, ${box.join(", ")})`].filter(Boolean).join(" AND ");
  const params = new URLSearchParams({ $select: "full_street_name,the_geom", $where: where, $limit: "2000" });
  const response = await fetch(`${CENTERLINE}?${params}`, { signal: ctx.signal });
  if (!response.ok) throw new Error(`Street lookup ${response.status}`);
  const rows = (await response.json()) as { full_street_name: string; the_geom?: { coordinates: number[][][] } }[];
  const matching = rows.filter((row) => canon(row.full_street_name) === wanted);
  return {
    // The city's own name for the street, so "fulton st" comes back as "Fulton Street".
    name: matching[0] ? displayStreet(matching[0].full_street_name) : displayStreet(street),
    points: matching.flatMap((row) => (row.the_geom?.coordinates ?? []).flat().map((point) => [point[0], point[1]] as Point)),
  };
}

// Segments are cut at intersections, so streets that cross share a vertex. Within this many meters counts as crossing.
const CROSSING_METERS = 15;
// Streets that almost meet (a jog, a dead end) get a "Near" pin; farther apart than this nothing is pinned, so
// a typo that pairs two parallel avenues doesn't drop a pin a few blocks away.
const NEAREST_METERS = 150;

/** Where two streets cross, or the closest point between them; null if either is unknown or they are far apart. */
async function findOnCenterlines(streets: CrossStreets, ctx: Context): Promise<{ place: Place; nearest: boolean; streets: CrossStreets } | null> {
  const box = BOROUGH_BOX[ctx.borough.toLowerCase()] ?? [NYC_BOX.south, NYC_BOX.west, NYC_BOX.north, NYC_BOX.east];
  const [a, b] = await Promise.all([streetVertices(streets.a, box, ctx), streetVertices(streets.b, box, ctx)]);
  if (!a.points.length || !b.points.length) return null;
  const centre = centreOf(ctx);
  let crossing: { at: Point; far: number } | null = null; // a crossing nearest the board's centre
  let closest: { at: Point; gap: number } | null = null;
  for (const p of a.points) {
    for (const q of b.points) {
      const gap = meters(p, q);
      const at: Point = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      if (gap <= CROSSING_METERS) {
        const far = meters(at, centre);
        if (!crossing || far < crossing.far) crossing = { at, far };
      }
      if (!closest || gap < closest.gap) closest = { at, gap };
    }
  }
  const name = `${a.name} & ${b.name}`;
  const named = { a: a.name, b: b.name };
  if (crossing) return { place: { name, lng: crossing.at[0], lat: crossing.at[1], source: "centerline" }, nearest: false, streets: named };
  if (closest && closest.gap <= NEAREST_METERS) return { place: { name: `Near ${name}`, lng: closest.at[0], lat: closest.at[1], source: "centerline" }, nearest: true, streets: named };
  return null;
}

/** South, west, north, east of a boundary, with a little room around it. */
function boundaryBox(boundary: GeoJSON.GeoJsonObject): [number, number, number, number] {
  let [south, west, north, east] = [90, 180, -90, -180];
  const visit = (value: unknown): void => {
    if (Array.isArray(value) && typeof value[0] === "number") {
      west = Math.min(west, value[0]); east = Math.max(east, value[0]);
      south = Math.min(south, value[1] as number); north = Math.max(north, value[1] as number);
    } else if (Array.isArray(value)) value.forEach(visit);
  };
  const geometry = (value: unknown): void => {
    const item = value as { type?: string; coordinates?: unknown; geometry?: unknown; features?: unknown[] };
    if (item.coordinates) visit(item.coordinates);
    if (item.geometry) geometry(item.geometry);
    item.features?.forEach(geometry);
  };
  geometry(boundary);
  const pad = 0.01;
  return south > north ? [NYC_BOX.south, NYC_BOX.west, NYC_BOX.north, NYC_BOX.east] : [south - pad, west - pad, north + pad, east + pad];
}

// The centre of the board (or, with no boundary, of its borough): where lookalike streets are told apart.
const centreOf = (ctx: Context): Point => {
  const box = ctx.boundary ? boundaryBox(ctx.boundary) : BOROUGH_BOX[ctx.borough.toLowerCase()] ?? [NYC_BOX.south, NYC_BOX.west, NYC_BOX.north, NYC_BOX.east];
  return [(box[1] + box[3]) / 2, (box[0] + box[2]) / 2];
};
const inNyc = (lng: number, lat: number) => lng >= NYC_BOX.west && lng <= NYC_BOX.east && lat >= NYC_BOX.south && lat <= NYC_BOX.north;
// The backup search can answer with another borough's lookalike; a point this far from the board is not taken.
const BACKUP_RADIUS_METERS = 8000;

type PhotonFeature = { properties: { name?: string }; geometry: { coordinates: [number, number] } };

async function findIntersection(streets: CrossStreets, ctx: Context): Promise<Place | null> {
  const query = `${streets.a} & ${streets.b}, ${ctx.borough}, New York`;
  const response = await fetch(`${PHOTON}?q=${encodeURIComponent(query)}&limit=5&lang=en`, { signal: ctx.signal });
  if (!response.ok) throw new Error(`Intersection search ${response.status}`);
  const { features } = (await response.json()) as { features: PhotonFeature[] };
  const words = (text: string) => normalizeStreet(text).split(" ");
  const [wantA, wantB] = [words(streets.a), words(streets.b)];
  for (const feature of features) {
    const name = feature.properties.name ?? "";
    // An intersection is named "A & B"; a station or business on one of the streets is not.
    if (!/&|\band\b/i.test(name)) continue;
    const have = new Set(words(name));
    const [lng, lat] = feature.geometry.coordinates;
    if (wantA.every((word) => have.has(word)) && wantB.every((word) => have.has(word)) && inNyc(lng, lat) && meters([lng, lat], centreOf(ctx)) <= BACKUP_RADIUS_METERS) {
      // Named for the streets as typed, not for whatever OpenStreetMap calls the point (a bike dock, a bus stop).
      return { name: `${displayStreet(streets.a)} & ${displayStreet(streets.b)}`, lat, lng, source: "osm" };
    }
  }
  return null;
}

async function findAddress(text: string, ctx: Context): Promise<Place | null> {
  const wanted = normalizeStreet(text.replace(/,.*$/, ""));
  if (!wanted) return null;
  const places = await searchPlaces(text.trim(), ctx.borough, ctx.signal);
  // Exact only: the label before the borough ("1000 FRANKLIN AVENUE") must say what the text says.
  const match = places.find((place) => normalizeStreet(place.name.replace(/,.*$/, "")) === wanted && place.name.toLowerCase().includes(`, ${ctx.borough.toLowerCase()}`));
  // Same casing as a place picked from the search box (GeoSearch labels are upper case).
  return match ? { ...match, name: match.name.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()) } : null;
}

/**
 * A place for the location, or null when nothing matches well enough. Cross streets come first, then wording
 * that reads as two streets, then an exact address or place. `streets` carries the best names for the two streets
 * ("Utica" becomes "Utica Avenue") so callers can update typed cross streets. Throws on network errors.
 */
export async function autoPlace(location: TicketLocation, ctx: Context): Promise<{ place: Place; via: "cross_streets" | "address"; nearest?: boolean; streets?: CrossStreets } | null> {
  const streets = location.crossStreets ?? crossStreetsFrom(location.text);
  if (streets) {
    let failed: unknown = null;
    try {
      const found = await findOnCenterlines(streets, ctx);
      if (found) return { place: found.place, via: "cross_streets", nearest: found.nearest, streets: found.streets };
    } catch (error) {
      failed = error;
    }
    // The centerline data doesn't know a street's name (or couldn't be reached): try the OpenStreetMap search.
    try {
      const place = await findIntersection(streets, ctx);
      if (place) return { place, via: "cross_streets", streets: { a: displayStreet(streets.a), b: displayStreet(streets.b) } };
    } catch (error) {
      if (failed) throw error;
    }
    // Cross streets typed by staff are not also read as an address.
    if (location.crossStreets) return null;
  }
  const text = location.text.trim();
  if (!text) return null;
  const place = await findAddress(text, ctx);
  return place ? { place, via: "address" } : null;
}
