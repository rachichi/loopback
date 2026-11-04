import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import { searchMorePlaces, searchPlaces } from "./geosearch";
import type { Place, TicketLocation } from "./features/tickets/types";
import { useBoard } from "./lib/board";

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
}: {
  location: TicketLocation;
  /** Names what the places belong to, for the search box's accessible label. */
  label: string;
  onChange: (location: TicketLocation) => void;
  /** Omitted where there's no map to show (the intake form); the chips are then plain labels. */
  onShowOnMap?: (placeIndex: number) => void;
}) {
  const { borough } = useBoard();
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  // The backup search, for one query at a time; it runs only when asked (see searchMorePlaces).
  const [more, setMore] = useState<{ query: string; status: "loading" | "done" | "error"; results: Place[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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

  return (
    <div className="location-cell">
      <div className="place-chips">
        {!location.places.length && location.text.trim() && !adding && (
          <span className="location-text" title={`From the meeting: ${location.text}\nAdd a place to put it on the map.`}>{location.text}</span>
        )}
        {location.places.map((place, index) => (
          <span className="place-chip" key={`${place.name}-${index}`}>
            {onShowOnMap ? (
              <button type="button" title="Show on map" onClick={(event) => { event.stopPropagation(); onShowOnMap(index); }}>
                <span>{place.name}</span>
              </button>
            ) : <span>{place.name}</span>}
            <button type="button" className="place-remove" aria-label={`Remove ${place.name}`} onClick={(event) => { event.stopPropagation(); remove(index); }}><X size={9} /></button>
          </span>
        ))}
        {adding ? (
          <input
            ref={inputRef}
            className="place-search"
            autoFocus
            placeholder="Search NYC places…"
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
          <button type="button" className="place-add" onClick={(event) => { event.stopPropagation(); if (!location.places.length) setQuery(location.text.trim()); setAdding(true); }}><Plus size={9} /> Place</button>
        )}
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
            : !results.length && !moreResults.length ? <li className="muted">No matches. Try an address or a named place; intersections aren't supported.</li>
            : null)}
        </ul>,
        document.body,
      )}
    </div>
  );
}
