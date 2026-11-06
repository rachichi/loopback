import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Ticket } from "./features/tickets/types";
import { useBoard, useTypeClass } from "./lib/board";

/** Which place to bring into view; n changes on every request so repeat clicks still pan. */
export type MapFocus = { ticketId: string; place: number; n: number };

/** The five boroughs, for a board whose boundary hasn't been loaded yet. */
const NYC_BOUNDS = L.latLngBounds([40.4774, -74.2591], [40.9176, -73.7004]);

const pinIcon = (className: string) =>
  L.divIcon({
    className: `map-place ${className}`,
    html: "<span></span>",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

export default function MapView({
  tickets,
  selected,
  hoveredId,
  focus,
  onHover,
  onSelect,
}: {
  tickets: Ticket[];
  selected: Ticket | undefined;
  hoveredId: string | null;
  focus: MapFocus | null;
  onHover: (id: string | null) => void;
  onSelect: (ticket: Ticket) => void;
}) {
  const { boundary } = useBoard();
  const typeClass = useTypeClass();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  // Latest callbacks for Leaflet handlers, which are bound once per marker.
  const handlers = useRef({ onHover, onSelect });
  handlers.current = { onHover, onSelect };

  // Create the map once, framed on the board's boundary, or on the whole city when the board has none.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: true });
    // OpenStreetMap's standard tiles need no API key (fine for demo traffic; see the OSM tile usage policy).
    // They're lightly softened in CSS (.map-tiles) so the type-colored pins stand out.
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      className: "map-tiles",
    }).addTo(map);
    const district = boundary
      ? L.geoJSON(boundary, { style: { color: "#1fa2c2", weight: 2.5, opacity: 0.9, fill: false }, interactive: false }).addTo(map)
      : null;
    const bounds = district?.getBounds();
    map.fitBounds(bounds?.isValid() ? bounds : NYC_BOUNDS, { padding: [16, 16] });
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    // The pane can change size when tabs switch; keep tiles in sync.
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
    // The board is fixed for the life of the portal (BoardProvider is keyed by user), so this runs once.
  }, [boundary]);

  // Keep one marker per place and update it in place when tickets, selection or hover change.
  // Rebinding a tooltip or swapping an icon would close an open tooltip under the cursor, so
  // hover/selected are CSS classes on the existing icon and tooltip text is updated, not rebound.
  const markersRef = useRef(new Map<string, { marker: L.Marker; type: string; tooltip: string }>());
  const ticketsRef = useRef(tickets);
  ticketsRef.current = tickets;
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const markers = markersRef.current;
    const live = new Set<string>();
    for (const ticket of tickets) {
      ticket.location.places.forEach((place, index) => {
        const key = `${ticket.id}:${index}`;
        live.add(key);
        const state = ticket.id === hoveredId ? "hovered" : ticket.id === selected?.id ? "selected" : "";
        let entry = markers.get(key);
        if (!entry) {
          const marker = L.marker([place.lat, place.lng], { icon: pinIcon(typeClass(ticket.type)) });
          const current = () => ticketsRef.current.find((item) => item.id === ticket.id);
          entry = { marker, type: ticket.type, tooltip: "" };
          marker.bindTooltip("", { direction: "top", offset: [0, -10] });
          marker.on("mouseover", () => handlers.current.onHover(ticket.id));
          marker.on("mouseout", () => handlers.current.onHover(null));
          marker.on("click", () => { const t = current(); if (t) handlers.current.onSelect(t); });
          marker.addTo(layer);
          markers.set(key, entry);
        }
        entry.marker.setLatLng([place.lat, place.lng]);
        if (entry.type !== ticket.type) {
          entry.marker.setIcon(pinIcon(typeClass(ticket.type)));
          entry.type = ticket.type;
        }
        const element = entry.marker.getElement();
        element?.classList.toggle("hovered", state === "hovered");
        element?.classList.toggle("selected", state === "selected");
        entry.marker.setZIndexOffset(state ? 1000 : 0);
        const tooltip = `<strong>${escapeHtml(ticket.title)}</strong><br>${escapeHtml(place.name)}`;
        if (entry.tooltip !== tooltip) {
          entry.marker.setTooltipContent(tooltip);
          entry.tooltip = tooltip;
        }
      });
    }
    for (const [key, entry] of markers) {
      if (!live.has(key)) { entry.marker.remove(); markers.delete(key); }
    }
  }, [tickets, selected?.id, hoveredId]);

  // Escape closes any open popup or tooltip and puts focus back on the map itself.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      mapRef.current?.closePopup();
      for (const { marker } of markersRef.current.values()) marker.closeTooltip();
      handlers.current.onHover(null);
      containerRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Pan to a place requested from the table.
  useEffect(() => {
    const map = mapRef.current;
    const place = focus && tickets.find((ticket) => ticket.id === focus.ticketId)?.location.places[focus.place];
    if (map && place) map.flyTo([place.lat, place.lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
    // Only on a new focus request.
  }, [focus]);

  return (
    <div className="map-view">
      <div className="map-canvas" ref={containerRef} tabIndex={-1} />
    </div>
  );
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
