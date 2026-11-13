import { useCallback, useRef, useState } from "react";
import { EyeOff } from "lucide-react";
import { columnIcons, columns } from "./TicketTable";
import { useHiddenColumns } from "./hiddenColumns";
import { useFeature } from "./lib/board";
import { useDismiss } from "./lib/useDismiss";

/** The toolbar's Hide fields button, as in Airtable: a switch per column. Hidden columns come back here or by
 *  Show all. The title can't be hidden. */
export default function HideFieldsMenu() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  const { hidden, setHidden, toggle, locked } = useHiddenColumns();
  const mapOn = useFeature("district_map");
  const transcriptOn = useFeature("transcript_matching");
  // The same columns the table has: Transcript only with transcript_matching, and Map is Location without the map.
  const fields = columns
    .filter((column) => column.key !== "transcript" || transcriptOn)
    .map((column) => ({ ...column, label: column.key === "location" && !mapOn ? "Location" : column.label }));
  const matches = fields.filter((field) => field.label.toLowerCase().includes(search.trim().toLowerCase()));
  const hiddenCount = fields.filter((field) => hidden.has(field.key)).length;
  return (
    <div className="hide-fields" ref={ref}>
      <button type="button" className={`hide-fields-button ${hiddenCount ? "active" : ""}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <EyeOff size={14} aria-hidden="true" /> {hiddenCount ? `${hiddenCount} hidden ${hiddenCount === 1 ? "field" : "fields"}` : "Hide fields"}
      </button>
      {open && (
        <div className="popover-menu hide-fields-menu" role="dialog" aria-label="Hide fields">
          <input className="hide-fields-search" autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a field" aria-label="Find a field" />
          <div className="hide-fields-list">
            {matches.map((field) => {
              const Icon = columnIcons[field.key];
              const isLocked = locked.has(field.key);
              return (
                <label key={field.key} className={`hide-fields-row ${isLocked ? "locked" : ""}`} title={isLocked ? "The title can't be hidden" : undefined}>
                  <input type="checkbox" role="switch" checked={!hidden.has(field.key)} disabled={isLocked} onChange={() => toggle(field.key)} />
                  <Icon size={14} aria-hidden="true" />
                  <span>{field.label}</span>
                </label>
              );
            })}
            {!matches.length && <p className="hide-fields-none">No field matches.</p>}
          </div>
          <div className="hide-fields-actions">
            <button type="button" onClick={() => setHidden(fields.map((field) => field.key))}>Hide all</button>
            <button type="button" onClick={() => setHidden([])}>Show all</button>
          </div>
        </div>
      )}
    </div>
  );
}
