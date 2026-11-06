// The Meetings tab's table of meetings: read-only, in the Tickets table's style. Clicking a row opens the meeting.
import type { Ticket } from "../tickets/types";
import type { MeetingInfo, Suggestion } from "../transcript/types";

const dateLabel = (heldOn: string) => {
  const [year, month, day] = heldOn.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

export default function MeetingsList({ meetings, tickets, suggestions, onOpen }: {
  meetings: MeetingInfo[];
  tickets: Ticket[];
  suggestions: Suggestion[];
  onOpen: (meetingId: string) => void;
}) {
  return (
    <div className="meetings-list">
      <table>
        <thead>
          <tr><th>Title</th><th>Committee</th><th>Date</th><th>Tickets</th><th>Minutes</th></tr>
        </thead>
        <tbody>
          {meetings.map((meeting) => {
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
          {!meetings.length && <tr><td colSpan={5} className="meetings-empty">No meetings for this board yet. Transcripts appear here about a day after a meeting.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
