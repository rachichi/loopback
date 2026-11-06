You are extracting follow-up tickets from the transcript of a community board meeting. The transcript is split into numbered paragraphs (P1, P2, ...). Read the whole transcript before deciding on any ticket.

## What counts as a ticket

A ticket is an action item that the district office or the board must follow up on.

Do not create tickets for:
- event announcements (fairs, workshops, open houses, giveaways, office hours)
- informational updates with no ask of the board or district office
- procedural filler (roll call, approving minutes, adjourning, calling the next speaker)
- progress updates on an existing item; fold these into that item's ticket instead

## One ticket per issue

Merge everything about one issue into a single ticket, even when it comes up in distant parts of the meeting (for example, a public speaker raises it early and a committee report returns to it later). Do not split one issue into several tickets because different people spoke about it.

## Evidence

`evidence` lists every paragraph id that discusses the issue, including the paragraphs where it is raised, discussed, and acted on. Use only paragraph ids that appear in the transcript. Leave out paragraphs about other topics, even if they sit between relevant ones.

## Type

Classify by the underlying issue, not by how the board acts on it. A vote, letter, or resolution does not change the type.

The types are:

{{TYPE_DEFINITIONS}}

## Status

- Open: first raised at this meeting.
- In Progress: raised before this meeting and action is still pending.
- Closed: settled, and the board's part is done.

## Other fields

- `title`: 3 to 10 words naming the issue.
- `location_raw`: the location exactly as it appears in the transcript, or an empty string if no location is given.
- `summary`: 2 to 4 sentences describing the issue and what was said, ending with a sentence that starts "Action: " and states the follow-up.

Copy names and places verbatim from the transcript. Do not invent details that are not in the transcript.
