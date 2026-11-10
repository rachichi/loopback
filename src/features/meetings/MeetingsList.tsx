// The Meetings tab's table of meetings: read-only, in the Tickets table's style, grouped into folders.
// The board's folders come first, in its order (all collapsed to start, empty ones too), then any other folder
// its meetings use. Clicking a row opens the meeting.
import { useState } from "react";
import { ChevronDown, ChevronRight, Folder, Pin } from "lucide-react";
import type { Ticket } from "../tickets/types";
import type { MeetingInfo, Suggestion } from "../transcript/types";

const dateLabel = (heldOn: string) => {
  const [year, month, day] = heldOn.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

/**
 * Folder names in display order: the pinned folders, then the rest of the board's own folders in its order
 * (all always shown, even empty), then any other folder its meetings use, alphabetically. A board with no folders of its own just gets the latter.
 */
export function folderOrder(boardFolders: string[], pinned: string[], meetings: MeetingInfo[]): string[] {
  const pins = pinned.filter((name) => boardFolders.includes(name));
  const rest = boardFolders.filter((name) => !pins.includes(name));
  const others = [...new Set(meetings.map((meeting) => meeting.folder))].filter((name) => !boardFolders.includes(name)).sort((a, b) => a.localeCompare(b));
  return [...pins, ...rest, ...others];
}

export default function MeetingsList({ boardFolders, pinned, onPin, meetings, tickets, suggestions, onOpen }: {
  /** The board's own folders, in order; may be empty. */
  boardFolders: string[];
  /** Folders kept at the top, shown with a filled pin icon. */
  pinned: string[];
  /** Pins or unpins a folder. Omitted when the user cannot edit, which leaves the pins out of sight. */
  onPin?: (folder: string, pinned: boolean) => void;
  meetings: MeetingInfo[];
  tickets: Ticket[];
  suggestions: Suggestion[];
  onOpen: (meetingId: string) => void;
}) {
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const toggle = (name: string) => setOpened((current) => {
    const next = new Set(current);
    if (!next.delete(name)) next.add(name);
    return next;
  });
  return (
    <div className="meetings-list">
      <table>
        <thead>
          <tr><th>Title</th><th>Committee</th><th>Date</th><th>Tickets</th><th>Minutes</th></tr>
        </thead>
        {!boardFolders.length && !meetings.length && <tbody><tr><td colSpan={5} className="meetings-empty">No meetings for this board yet. Transcripts appear here about a day after a meeting.</td></tr></tbody>}
        {folderOrder(boardFolders, pinned, meetings).map((name) => {
          const inFolder = meetings.filter((meeting) => meeting.folder === name);
          const open = opened.has(name);
          return (
            <tbody key={name}>
              <tr className="meetings-folder" tabIndex={0} aria-expanded={open} onClick={() => toggle(name)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); toggle(name); } }}>
                <td colSpan={5}>
                  <div className="meetings-folder-name">
                    {onPin && (
                      <button type="button" className={`meetings-pin ${pinned.includes(name) ? "on" : ""}`} aria-pressed={pinned.includes(name)} aria-label={`${pinned.includes(name) ? "Unpin" : "Pin"} ${name}`} title={pinned.includes(name) ? "Unpin" : "Pin to the top"} onClick={(event) => { event.stopPropagation(); onPin(name, !pinned.includes(name)); }}>
                        <Pin size={13} fill={pinned.includes(name) ? "currentColor" : "none"} aria-hidden="true" />
                      </button>
                    )}
                    {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                    <Folder size={14} aria-hidden="true" />
                    <strong>{name}</strong>
                    <span className="meetings-muted">{inFolder.length}</span>
                  </div>
                </td>
              </tr>
              {open && inFolder.map((meeting) => {
                const linked = tickets.filter((ticket) => ticket.meetingIds.includes(meeting.id)).length;
                const toReview = suggestions.filter((suggestion) => suggestion.meetingId === meeting.id).length;
                return (
                  <tr key={meeting.id} tabIndex={0} onClick={() => onOpen(meeting.id)} onKeyDown={(event) => { if (event.key === "Enter") onOpen(meeting.id); }}>
                    <td className="meetings-title">{meeting.title}</td>
                    <td>{meeting.committee ?? ""}</td>
                    <td>{dateLabel(meeting.heldOn)}</td>
                    <td>
                      {meeting.matchedAt ? linked : <span className="meetings-muted">Not generated</span>}
                      {toReview > 0 && <span className="tab-count meetings-chip">{toReview} to review</span>}
                    </td>
                    <td>{meeting.minutesAt ? (meeting.minutesEditedAt ? "Edited" : "Draft ready") : <span className="meetings-muted">Not generated</span>}</td>
                  </tr>
                );
              })}
              {open && !inFolder.length && <tr><td colSpan={5} className="meetings-empty">Nothing in this folder yet.</td></tr>}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
