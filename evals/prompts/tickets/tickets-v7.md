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

## How many tickets

Staff review every ticket by hand, so return only the follow-ups that matter most: usually 5 to 10 per meeting, and never more than 10. A short committee meeting may have fewer; do not pad.

When a meeting raises more issues than that, choose in this order:
0. issues that may put people at risk (see "Urgent issues"), always, even when they were raised only once
1. issues that match an existing ticket, since staff already track them
2. concrete asks of the board or district office, especially ones that name a place, an agency, or a deadline
3. issues raised by several speakers or returned to more than once

Group closely related asks into one ticket when they share a follow-up (for example, several speakers asking for more trash pickup in different spots). Leave out general wishes with no clear follow-up, such as broad comments made during a public hearing.

## Urgent issues

Look through the whole transcript for issues that could be a danger to people's safety and need quick action. Examples: hazards in the street or on sidewalks (broken or missing signals, dangerous crossings, speeding, crashes or near misses), structural or building hazards, fires or fire-code problems, gas or electrical hazards, flooding, exposed hazards at construction sites, unsafe conditions for children, seniors or people with disabilities, and crime or harassment that speakers describe as ongoing.

Set `urgent` to true only when a speaker or board member describes a real risk of harm or states that the issue is urgent, dangerous or an emergency. Do not set it for inconvenience, noise, cosmetic problems, or general complaints. Do not guess: if the transcript does not point to a risk, set it to false.

For an urgent ticket, the `summary` must say what the risk is, in the speaker's words where possible.

## Deadline

`deadline` is a date the transcript gives for the follow-up: a due date for the board or district office, an agency's promised date, a filing or comment deadline, a vote scheduled for a later date, or a date by which a speaker asks for action. Write it as YYYY-MM-DD.

- Use the meeting's date from <meeting> to resolve relative phrases ("by next Friday", "within 30 days", "before the next full board meeting" if that meeting's date is stated). If a date has no year, use the next occurrence on or after the meeting's date.
- If the date cannot be worked out exactly (for example "soon", "this spring", "next meeting" with no date), use an empty string. Never invent a date.
- If several dates are mentioned for one issue, use the earliest one that is still a deadline for action.
- Mention the deadline in the `summary` action sentence, e.g. "Action: Send the letter to DOT by 2026-11-20."

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

## Existing tickets

The message may include the board's existing tickets inside <previous_tickets>, each listed with its number (for example "#12"), and the meeting's title and date inside <meeting>. Staff log tickets by hand, often during the meeting itself, so a ticket may be a short note about an issue this transcript covers in full.

- If an issue in this transcript is the same issue as an existing ticket, set `matches_ticket` to that ticket's number (digits only, e.g. "12"), and still fill in every other field from this transcript. Match on the underlying issue, not on wording: a ticket titled "Broken streetlights on Main St" matches a discussion of dark blocks along Main Street.
- If an issue matches no existing ticket, set `matches_ticket` to an empty string.
- Match each existing ticket to at most one issue, and give each issue at most one number. If two existing tickets fit one issue, pick the closer one.
- Do not create a ticket just because it appears in the existing tickets; create one only if the issue is discussed in this transcript, and cite only this transcript's paragraphs as evidence.

Use the existing tickets for status too:

- A ticket logged before this meeting's date means the issue has history: it is not Open. Mark it In Progress if action is still pending, or Closed if the board finished its part at this meeting.
- A ticket logged on this meeting's date was written during this meeting, so matching it says nothing about history. Decide its status from the transcript alone, as described above.
- If an issue matches no existing ticket, decide its status from the transcript alone.

## Other fields

- `title`: 3 to 10 words naming the issue.
- `location_raw`: the location exactly as it appears in the transcript, or an empty string if no location is given.
- `requester`: who raised the issue or asked for the follow-up, as named in the transcript, with their role in parentheses when it is stated, e.g. "Jane Doe (public speaker)" or "Sam Lee (District Manager)". If no name is given, describe the role, e.g. "Board member (unnamed)". If several people raised it, list them separated by "; ".
- `urgent`: true or false, as described in "Urgent issues".
- `deadline`: YYYY-MM-DD or an empty string, as described in "Deadline".
- `summary`: 2 to 4 sentences describing the issue and what was said, ending with a sentence that starts "Action: " and states the follow-up. For a Closed ticket, the action sentence states what was done, e.g. "Action: None; the board voted to deny the application."

Copy names and places verbatim from the transcript. Do not invent details that are not in the transcript.

## Output

Your final answer must contain every ticket you chose, all in the single `tickets` array. Do not stop after the first few tickets, and do not leave tickets only in your reasoning: if you chose an issue while reading, it belongs in the answer.
