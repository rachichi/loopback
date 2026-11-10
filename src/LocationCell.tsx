import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Plus, X } from "lucide-react";
import { searchMorePlaces, searchPlaces } from "./geosearch";
import type { Place, TicketLocation } from "./features/tickets/types";
import { autoPlace, displayStreet } from "./autoPin";
import { trackEvent } from "./lib/analytics";
import { useBoard, useFeature } from "./lib/board";

const NO_PIN_TEXT = "No map pin yet. Choose an address from the search so this ticket shows on the map.";
const MISSED_TEXT = "Couldn't find that on the map. Choose an address from the search so this ticket shows on the map.";

const titleCase = (text: string) => text.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());

/**
 * The ticket's mapped places, plus a GeoSearch box to add more. The meeting's wording stays in location.text;
 * it shows while the ticket has no places (tickets drafted from a transcript start that way) and seeds the search.
 */
export default function LocationCell({
  location,
  label,
  onChange,
  onShowOnMap,
  warningText,
  onFix,
}: {
  location: TicketLocation;
  /** Names what the places belong to, for the search box's accessible label. */
  label: string;
  onChange: (location: TicketLocation) => void;
  /** Omitted where there's no map to show (the intake form); the chips are then plain labels. */
  onShowOnMap?: (placeIndex: number) => void;
  /** The ticket form sets this to show the no-pin message as red text under the box. Without it (the table) a warning icon shows, with the message on hover. */
  warningText?: boolean;
  /** The table passes this so the warning icon can be clicked: it opens the ticket and tries to find its pin. */
  onFix?: () => void;
}) {
  const { id: boardId, borough, boundary } = useBoard();
  // With the map on, a location with no place is a ticket missing from the map, so it gets a warning.
  const mapOn = useFeature("district_map");
  // Something is in the box but none of it is on the map: say so, under the box. An empty box says nothing.
  const hasContent = Boolean(location.text.trim() || location.crossStreets);
  const noPin = mapOn && hasContent && !location.places.length;
  // Once the cross streets have a pin, its chip carries the same words, so the cross streets chip steps aside.
  // Removing the pin brings it back.
  const crossLabel = location.crossStreets ? `${location.crossStreets.a} & ${location.crossStreets.b}`.toLowerCase() : "";
  const crossPinned = Boolean(crossLabel) && location.places.some((place) => place.name.replace(/^near /i, "").toLowerCase() === crossLabel);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  // The backup search, for one query at a time; it runs only when asked (see searchMorePlaces).
  const [more, setMore] = useState<{ query: string; status: "loading" | "done" | "error"; results: Place[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // The cross streets editor: two boxes, one per street. Saved when focus leaves both, or on Enter in the second.
  const [crossing, setCrossing] = useState(false);
  const [streetA, setStreetA] = useState("");
  const [streetB, setStreetB] = useState("");
  const secondStreet = useRef<HTMLInputElement>(null);
  // The latest location, for the pin that arrives after the lookup finishes.
  const latest = useRef(location);
  latest.current = location;
  const [pinning, setPinning] = useState(false);
  // True after a lookup from the form's red message found nothing, so it can say so instead of inviting another click.
  const [missed, setMissed] = useState(false);
  useEffect(() => setMissed(false), [location.text, location.crossStreets?.a, location.crossStreets?.b]);
  // Looks up a map point for the location (the cross streets just saved, or the wording from the meeting) and adds
  // it, unless the cell changed meanwhile.
  const pinFrom = async (next: TicketLocation, trigger: "cross_streets" | "warning_click") => {
    setPinning(true);
    setMissed(false);
    try {
      const found = await autoPlace(next, { borough, boundary });
      trackEvent("location_autopin", { board_id: boardId, trigger, outcome: found ? (found.nearest ? "pinned_nearest" : "pinned") : "no_match" });
      const now = latest.current;
      const same = now.text === next.text && now.crossStreets?.a === next.crossStreets?.a && now.crossStreets?.b === next.crossStreets?.b;
      if (found && same && !now.places.length) onChange({ ...now, places: [found.place] });
      else if (!found) setMissed(true);
    } catch (error) {
      console.error(error);
      trackEvent("location_autopin", { board_id: boardId, trigger, outcome: "error" });
      setMissed(true);
    } finally {
      setPinning(false);
    }
  };
  const startCrossing = () => { setStreetA(location.crossStreets?.a ?? ""); setStreetB(location.crossStreets?.b ?? ""); setCrossing(true); };
  const saveCrossing = () => {
    setCrossing(false);
    // Saved as the street's proper name ("fulton st" becomes "Fulton Street").
    const a = displayStreet(streetA);
    const b = displayStreet(streetB);
    // Both boxes filled saves; both empty clears; one box alone is an unfinished edit and changes nothing.
    if (a && b) {
      const next = { ...location, crossStreets: { a, b } };
      onChange(next);
      // With the map on, a location with no pin gets one automatically when the streets match a real intersection.
      if (mapOn && !location.places.length) void pinFrom(next, "cross_streets");
    }
    else if (!a && !b && location.crossStreets) onChange({ ...location, crossStreets: undefined });
  };
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  // Debounced GeoSearch lookups; stale requests are aborted.
  useEffect(() => {
    if (!adding || query.trim().length < 3) { setResults([]); setStatus("idle"); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setStatus("loading");
      try {
        setResults(await searchPlaces(query.trim(), borough, controller.signal));
        setStatus("idle");
      } catch (error) {
        if (!controller.signal.aborted) setStatus("error");
      }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [adding, query, borough]);

  // The table scrolls and clips overflow, so the suggestion list is a fixed-position portal.
  useEffect(() => {
    if (adding) setAnchor(inputRef.current?.getBoundingClientRect() ?? null);
  }, [adding, query, results]);

  const close = () => { setAdding(false); setQuery(""); setResults([]); setMore(null); };
  const text = query.trim();
  const current = more?.query === text ? more : null;
  const moreResults = current ? current.results.filter((place) => !results.some((result) => result.name.toLowerCase() === place.name.toLowerCase())) : [];
  const searchMore = async () => {
    if (text.length < 3 || (current && current.status !== "error")) return;
    setMore({ query: text, status: "loading", results: [] });
    try {
      const found = await searchMorePlaces(text, borough);
      setMore((latest) => latest?.query === text ? { query: text, status: "done", results: found } : latest);
    } catch {
      setMore((latest) => latest?.query === text ? { ...latest, status: "error" } : latest);
    }
  };
  const add = (place: Place) => {
    onChange({ ...location, places: [...location.places, { ...place, name: titleCase(place.name) }] });
    close();
  };
  const remove = (index: number) => onChange({ ...location, places: location.places.filter((_, i) => i !== index) });

  const crossChip = location.crossStreets && !crossing && !crossPinned && (
    <span className="place-chip cross-chip">
      <button type="button" title="Edit cross streets" onClick={(event) => { event.stopPropagation(); startCrossing(); }}>
        <span>{location.crossStreets.a} &amp; {location.crossStreets.b}</span>
      </button>
      <button type="button" className="place-remove" aria-label="Remove cross streets" onClick={(event) => { event.stopPropagation(); onChange({ ...location, crossStreets: undefined }); }}><X size={9} /></button>
    </span>
  );
  const crossEditor = crossing && (
    <span
      className="cross-edit"
      onClick={(event) => event.stopPropagation()}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) saveCrossing(); }}
    >
      <input
        className="place-search"
        autoFocus
        placeholder="Cross street 1"
        aria-label={`First cross street of ${label}`}
        value={streetA}
        onChange={(event) => setStreetA(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") { event.stopPropagation(); setCrossing(false); }
          if (event.key === "Enter") { event.preventDefault(); secondStreet.current?.focus(); }
        }}
      />
      <span aria-hidden="true">&amp;</span>
      <input
        ref={secondStreet}
        className="place-search"
        placeholder="Cross street 2"
        aria-label={`Second cross street of ${label}`}
        value={streetB}
        onChange={(event) => setStreetB(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") { event.stopPropagation(); setCrossing(false); }
          if (event.key === "Enter") { event.preventDefault(); saveCrossing(); }
        }}
      />
    </span>
  );
  // The meeting's wording. With the map on it is a button: in the table it opens the ticket and tries to find the
  // location (onFix); in the form it tries right there.
  const meetingText = !location.places.length && location.text.trim() && !adding && (mapOn ? (
    <button
      type="button"
      className="location-text location-link"
      title={`From the meeting: ${location.text}\nClick to try to find it on the map.`}
      onClick={(event) => { event.stopPropagation(); if (onFix) onFix(); else void pinFrom(location, "warning_click"); }}
    >{location.text}</button>
  ) : (
    <span className="location-text" title={`From the meeting: ${location.text}\nAdd a place to put it on the map.`}>{location.text}</span>
  ));
  const placeChips = (include: (place: Place) => boolean) => location.places.map((place, index) => include(place) && (
    <span className="place-chip" key={`${place.name}-${index}`}>
      {onShowOnMap ? (
        <button type="button" title="Show on map" onClick={(event) => { event.stopPropagation(); onShowOnMap(index); }}>
          <span>{place.name}</span>
        </button>
      ) : <span>{place.name}</span>}
      <button type="button" className="place-remove" aria-label={`Remove ${place.name}`} onClick={(event) => { event.stopPropagation(); remove(index); }}><X size={9} /></button>
    </span>
  ));
  const addressControl = adding ? (
    <input
      ref={inputRef}
      className="place-search"
      autoFocus
      placeholder="Address"
      aria-label={`Add a place to ${label}`}
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      onBlur={close}
      onKeyDown={(event) => {
        // Keep Escape and Enter from also closing or submitting a surrounding form.
        if (event.key === "Escape") { event.stopPropagation(); close(); }
        if (event.key === "Enter") {
          event.preventDefault();
          const first = results[0] ?? moreResults[0];
          if (first) add(first);
          else if (status !== "loading") void searchMore();
        }
      }}
    />
  ) : (
    <button type="button" className="place-add" onClick={(event) => { event.stopPropagation(); if (!location.places.length) setQuery(location.text.trim()); setAdding(true); }}><Plus size={9} /> Address</button>
  );
  const crossControl = !adding && !crossing && !location.crossStreets && (
    <button type="button" className="place-add" onClick={(event) => { event.stopPropagation(); startCrossing(); }}><Plus size={9} /> Cross streets</button>
  );

  return (
    <div className="location-wrap">
      <div className="location-cell">
        <div className="place-chips">
          {pinning && <span className="location-text">Finding it on the map…</span>}
          {noPin && !pinning && !warningText && (onFix
            ? (
              <button type="button" className="no-pin-icon" title={`${NO_PIN_TEXT} Click to open the ticket and try to find the location.`} aria-label="No map pin. Open the ticket and try to find the location" onClick={(event) => { event.stopPropagation(); onFix(); }}>
                <AlertTriangle size={12} aria-hidden="true" />
              </button>
            )
            : <span className="no-pin-icon" title={NO_PIN_TEXT}><AlertTriangle size={12} role="img" aria-label="No map pin" /></span>)}
          {crossChip}
          {crossEditor}
          {meetingText}
          {placeChips(() => true)}
          {addressControl}
          {crossControl}
        </div>
        {adding && anchor && query.trim().length >= 3 && createPortal(
          <ul className="place-results" style={{ left: anchor.left, top: anchor.bottom + 4, minWidth: Math.max(anchor.width, 220) }}>
            {status === "loading" && !results.length && <li className="muted">Searching…</li>}
            {status === "error" && <li className="muted">Couldn't reach the place search</li>}
            {[...results, ...moreResults].map((place) => (
              // mousedown, not click, so the input's blur doesn't close the list first
              <li key={`${place.name}-${place.lat}`} onMouseDown={(event) => { event.preventDefault(); add(place); }}>
                {titleCase(place.name)}
              </li>
            ))}
            {/* The last row runs the backup search, which also finds addresses missing from the first one. */}
            {status !== "loading" && (!current || current.status === "error"
              ? <li className="search-more" onMouseDown={(event) => { event.preventDefault(); void searchMore(); }}>{current ? "Couldn't search more places. Try again" : results.length ? "Search more places" : "No matches. Search more places (Enter)"}</li>
              : current.status === "loading" ? <li className="muted">Searching more places…</li>
              : !results.length && !moreResults.length ? <li className="muted">No matches. Try an address or a named place. For an intersection, use Cross streets.</li>
              : null)}
          </ul>,
          document.body,
        )}
      </div>
      {noPin && !pinning && warningText && <p className="no-pin-text" role="status">{missed ? MISSED_TEXT : NO_PIN_TEXT}</p>}
    </div>
  );
}
