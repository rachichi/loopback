# Brooklyn CB9 general board meeting, September 29, 2026

A minutes test case: the inputs a board office has before the meeting, the transcript, and the minutes the board published.

| File | Source |
| --- | --- |
| `psplit_transcript.txt` | YouTube auto-captions of the livestream (https://www.youtube.com/watch?v=tNw7vAquJfQ), converted with `scripts/vtt_to_paragraphs.py`. Names, numbers and addresses are often misheard. |
| `meeting.txt` | Header facts of the meeting (date, place, livestream, signer). |
| `agenda.txt` | The agenda items, rebuilt from the public-session list in the published minutes. |
| `roster.txt` | Board members (from the roll call, without attendance marks), officers, committee chairs, and the district's elected officials with the representatives who attended earlier 2026 meetings. |
| `example_minutes.txt` | February 2026 general board minutes, as a style example. Text extracted from the PDF on https://www.nyc.gov/site/brooklyncb9/about/minutes.page. |
| `official_minutes.txt` | The published minutes of this meeting, from the same page. Use it to compare drafts; it is never sent to the model. The published minutes have their own errors (attendance table, typos), so treat it as a reference, not ground truth. |
