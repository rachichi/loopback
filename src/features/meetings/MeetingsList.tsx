// The Meetings tab's table of meetings: read-only, in the Tickets table's style, grouped into folders.
// Pinned folders come first, then every other folder A to Z (all collapsed to start, empty ones too). Clicking a row opens the meeting; the three dots on a row (or a right-click on it) offer Rename, Move to folder and Remove (staff only).
import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Folder, FolderInput, MoreVertical, Pencil, Pin, Plus, Trash2 } from "lucide-react";
import type { Ticket } from "../tickets/types";
import type { MeetingInfo, Suggestion } from "../transcript/types";

const dateLabel = (heldOn: string) => {
  const [year, month, day] = heldOn.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

/**
 * Folder names in display order: the pinned folders first, in the order they were pinned, then every other
 * folder A to Z. That is the board's own folders (all always shown, even empty) plus any other folder its
 * meetings use.
 */
export function folderOrder(boardFolders: string[], pinned: string[], meetings: MeetingInfo[]): string[] {
  const all = [...new Set([...boardFolders, ...meetings.map((meeting) => meeting.folder)])];
  const pins = pinned.filter((name) => all.includes(name));
  const rest = all.filter((name) => !pins.includes(name)).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return [...pins, ...rest];
}

export default function MeetingsList({ boardFolders, pinned, onPin, onRename, onMove, onRemove, onUpload, onAddFolder, meetings, tickets, suggestions, onOpen }: {
  /** The board's own folders, in order; may be empty. */
  boardFolders: string[];
  /** Folders kept at the top, shown with a filled pin icon. */
  pinned: string[];
  /** Pins or unpins a folder. Omitted when the user cannot edit, which leaves the pins out of sight. */
  onPin?: (folder: string, pinned: boolean) => void;
  /** Rename, move and remove a meeting. Omitted when the user cannot edit, which leaves the row menu off. */
  onRename?: (meetingId: string, title: string) => void;
  onMove?: (meetingId: string, folder: string) => void;
  onRemove?: (meetingId: string) => void;
  /** Adds a folder to the board; rejects with a readable message. Omitted when the user cannot edit. */
  onAddFolder?: (name: string) => Promise<void>;
  /** Opens the Upload transcript form. Omitted when the user cannot edit. */
  onUpload?: () => void;
  meetings: MeetingInfo[];
  tickets: Ticket[];
  suggestions: Suggestion[];
  onOpen: (meetingId: string) => void;
}) {
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<{ id: string; x: number; y: number; view: "main" | "move" } | null>(null);
  const folders = folderOrder(boardFolders, pinned, meetings);
  const hasMenu = Boolean(onRename);
  const openMenu = (id: string, x: number, y: number) => setMenu({ id, x: Math.min(x, window.innerWidth - 230), y: Math.min(y, window.innerHeight - 160), view: "main" });
  const [renaming, setRenaming] = useState<string | null>(null);
  // Any click, scroll or Escape outside the menu closes it.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("click", close); window.removeEventListener("scroll", close, true); window.removeEventListener("keydown", onKey); };
  }, [menu]);
  const finishRename = (meeting: MeetingInfo, value: string | null) => {
    setRenaming(null);
    const title = value?.trim();
    if (title && title !== meeting.title) onRename?.(meeting.id, title);
  };
  const toggle = (name: string) => setOpened((current) => {
    const next = new Set(current);
    if (!next.delete(name)) next.add(name);
    return next;
  });
  // The "+ Add folder" button turns into a name field.
  const [adding, setAdding] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderError, setFolderError] = useState<string | null>(null);
  const addFolder = async () => {
    const name = folderName.trim();
    if (!name) { setAdding(false); return; }
    if (folders.some((existing) => existing.toLowerCase() === name.toLowerCase())) { setFolderError("That folder already exists."); return; }
    try {
      await onAddFolder?.(name);
      setAdding(false);
      setFolderName("");
      setFolderError(null);
      setOpened((current) => new Set(current).add(name));
    } catch (error) {
      console.error(error);
      setFolderError(error instanceof Error && error.message ? error.message : "Couldn't add the folder.");
    }
  };
  const menuMeeting = menu ? meetings.find((meeting) => meeting.id === menu.id) : undefined;
  return (
    <div className="meetings-list">
      {onUpload && (
        <div className="meetings-toolbar">
          {adding ? (
            <form className="meetings-add-folder" onSubmit={(event) => { event.preventDefault(); void addFolder(); }}>
              <input autoFocus value={folderName} maxLength={80} placeholder="Folder name" aria-label="Folder name" onChange={(event) => { setFolderName(event.target.value); setFolderError(null); }} onKeyDown={(event) => { if (event.key === "Escape") { setAdding(false); setFolderName(""); setFolderError(null); } }} />
              <button type="submit" className="meetings-add-confirm">Add</button>
              <button type="button" className="meetings-add-cancel" onClick={() => { setAdding(false); setFolderName(""); setFolderError(null); }}>Cancel</button>
              {folderError && <span className="meetings-add-error" role="alert">{folderError}</span>}
            </form>
          ) : onAddFolder && <button type="button" className="meetings-add" onClick={() => setAdding(true)}><Plus size={14} /> Add folder</button>}
          <button type="button" className="meetings-upload" onClick={onUpload}><Plus size={14} /> Upload transcript</button>
        </div>
      )}
      <table>
        <thead>
          <tr><th>Title</th><th>Committee</th><th>Date</th><th>Tickets</th><th>Minutes</th>{hasMenu && <th className="meetings-actions-col"><span className="visually-hidden">Actions</span></th>}</tr>
        </thead>
        {!boardFolders.length && !meetings.length && <tbody><tr><td colSpan={hasMenu ? 6 : 5} className="meetings-empty">No meetings for this board yet. Transcripts appear here about a day after a meeting.</td></tr></tbody>}
        {folders.map((name) => {
          const inFolder = meetings.filter((meeting) => meeting.folder === name);
          const open = opened.has(name);
          return (
            <tbody key={name}>
              <tr className="meetings-folder" tabIndex={0} aria-expanded={open} onClick={() => toggle(name)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); toggle(name); } }}>
                <td colSpan={hasMenu ? 6 : 5}>
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
                  <tr key={meeting.id} tabIndex={0} onContextMenu={hasMenu ? (event) => { event.preventDefault(); openMenu(meeting.id, event.clientX, event.clientY); } : undefined} onClick={() => onOpen(meeting.id)} onKeyDown={(event) => { if (event.key === "Enter") onOpen(meeting.id); }}>
                    <td className="meetings-title" >
                      {renaming === meeting.id ? (
                        <input
                          className="meetings-rename"
                          autoFocus
                          defaultValue={meeting.title}
                          aria-label="Meeting title"
                          onFocus={(event) => event.target.select()}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => {
                            event.stopPropagation();
                            if (event.key === "Enter") finishRename(meeting, event.currentTarget.value);
                            else if (event.key === "Escape") finishRename(meeting, null);
                          }}
                          onBlur={(event) => finishRename(meeting, event.currentTarget.value)}
                        />
                      ) : meeting.title}
                    </td>
                    <td>{meeting.committee ?? ""}</td>
                    <td>{dateLabel(meeting.heldOn)}</td>
                    <td>
                      {meeting.matchedAt ? linked : <span className="meetings-muted">Not generated</span>}
                      {toReview > 0 && <span className="tab-count meetings-chip">{toReview} to review</span>}
                    </td>
                    <td>{meeting.minutesAt ? (meeting.minutesEditedAt ? "Edited" : "Draft ready") : <span className="meetings-muted">Not generated</span>}</td>
                    {hasMenu && (
                      <td className="meetings-actions-col">
                        <button type="button" className="meetings-more" aria-label={`Actions for ${meeting.title}`} aria-haspopup="menu" onClick={(event) => { event.stopPropagation(); const box = event.currentTarget.getBoundingClientRect(); openMenu(meeting.id, box.right - 200, box.bottom + 2); }}>
                          <MoreVertical size={16} aria-hidden="true" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {open && !inFolder.length && <tr><td colSpan={hasMenu ? 6 : 5} className="meetings-empty">Nothing in this folder yet.</td></tr>}
            </tbody>
          );
        })}
      </table>
      {menu && menuMeeting && (
        <div className="meetings-menu" role="menu" style={{ left: menu.x, top: menu.y }} onClick={(event) => event.stopPropagation()}>
          {menu.view === "main" ? (
            <>
              <button type="button" role="menuitem" autoFocus onClick={() => { setRenaming(menu.id); setMenu(null); }}><Pencil size={15} aria-hidden="true" /> Rename</button>
              {onMove && <button type="button" role="menuitem" onClick={() => setMenu({ ...menu, view: "move" })}><FolderInput size={15} aria-hidden="true" /> Move to folder</button>}
              {onRemove && <button type="button" role="menuitem" className="danger" onClick={() => {
                setMenu(null);
                if (window.confirm(`Remove "${menuMeeting.title}"? Its transcript and minutes are deleted. Its tickets stay, without the links to this meeting.`)) onRemove(menuMeeting.id);
              }}><Trash2 size={15} aria-hidden="true" /> Remove</button>}
            </>
          ) : (
            <>
              <button type="button" role="menuitem" className="back" onClick={() => setMenu({ ...menu, view: "main" })}><ChevronLeft size={15} aria-hidden="true" /> Move to folder</button>
              <div className="meetings-menu-list">
                {folders.map((name) => (
                  <button key={name} type="button" role="menuitem" disabled={name === menuMeeting.folder} onClick={() => { setMenu(null); onMove?.(menuMeeting.id, name); }}>
                    {name === menuMeeting.folder ? <Check size={15} aria-hidden="true" /> : <Folder size={15} aria-hidden="true" />} {name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
