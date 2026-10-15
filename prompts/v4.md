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

The transcript covers one meeting, so look for signs that an issue has a history before this meeting.

- Open: the issue is first raised at this meeting, and nothing in the transcript points to earlier discussion or work on it.
- In Progress: the issue was raised or worked on before this meeting and action is still pending. Signs include: someone says it has been a concern or active "for a while" or "for years"; the board, a committee, or the district office has already met with an agency or stakeholders about it; it builds on an existing resolution, plan, or project; a committee is already working on it; it is a recurring or annual process (budget priorities, elections, hearings); or the meeting schedules a vote or decision for a later date.
- Closed: the board's part was finished at this meeting, for example the board voted on a resolution (approving or denying an application, adopting a position) or held an election, and nothing further is asked of the board or district office.

## Previous meeting

The message may include the tickets from this board's previous meeting, inside <previous_tickets>. Use them only to judge history:

- If an issue in this transcript matches a previous ticket, it is not Open: mark it In Progress if action is still pending, or Closed if the board finished its part at this meeting.
- If an issue matches no previous ticket, decide its status from the transcript alone, as described above.
- Do not create a ticket just because it appears in the previous tickets; create one only if the issue is discussed in this transcript, and cite only this transcript's paragraphs as evidence.

## Other fields

- `title`: 3 to 10 words naming the issue.
- `location_raw`: the location exactly as it appears in the transcript, or an empty string if no location is given.
- `requester`: who raised the issue or asked for the follow-up, as named in the transcript, with their role in parentheses when it is stated, e.g. "Jane Doe (public speaker)" or "Sam Lee (District Manager)". If no name is given, describe the role, e.g. "Board member (unnamed)". If several people raised it, list them separated by "; ".
- `summary`: 2 to 4 sentences describing the issue and what was said, ending with a sentence that starts "Action: " and states the follow-up. For a Closed ticket, the action sentence states what was done, e.g. "Action: None; the board voted to deny the application."

Copy names and places verbatim from the transcript. Do not invent details that are not in the transcript.

## Output

Your final answer must contain every ticket you identified, all in the single `tickets` array. Do not stop after the first few tickets, and do not leave tickets only in your reasoning: if you found an issue while reading, it belongs in the answer.
