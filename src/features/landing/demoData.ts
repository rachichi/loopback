// Invented content for the landing page demo: a made-up public hearing, the tickets "generated" from it and the
// draft minutes. The speakers and the wording are fiction; the intersections are real places inside the district,
// so the map looks right. Never import real meeting data here (src/meetings.ts, goldTickets.ts or evals/).
import { buildParagraphs, spansFromParagraphIds } from "../../transcript";
import type { Place, Ticket } from "../tickets/types";
import type { TranscriptMeeting } from "../transcript/types";

export const DEMO_MEETING_ID = "demo-hearing";

const lines = [
  "Chair: Good evening. I'm the district manager, and this is our public hearing on the district's needs for the coming fiscal year.",
  "Chair: Each speaker gets two minutes. Please state your name and the block you're speaking about.",
  "Resident: I live on Nostrand Avenue near Eastern Parkway. Cars run the light there every morning while kids are crossing to school.",
  "Resident: Last month a driver clipped a stroller in the crosswalk. We need the signal timing reviewed and a speed camera at that intersection before the winter break.",
  "Chair: Noted. That one is urgent. We will send it to DOT this week.",
  "Resident: I'm on Kingston Avenue at Empire Boulevard. Every time it rains the catch basin backs up and the water reaches the curb on both sides.",
  "Resident: Last Thursday it flooded the entrance to the building next door. That basin has not been cleaned in over a year.",
  "Chair: Thank you. We will ask DEP to clean the catch basin and mark it urgent because of the flooding.",
  "Resident: On Winthrop Street by the Nostrand Avenue station, three streetlights have been out since September. People are walking home in the dark.",
  "Resident: Someone was followed last week. Please ask the city to replace those lights as soon as possible.",
  "Chair: That is a safety issue and we will treat it as urgent.",
  "Resident: I want to talk about rats. The corner of Rogers Avenue and Lefferts Avenue has overflowing trash cans, and the rats come out at dusk.",
  "Resident: We need more frequent sanitation pickups and a bigger basket on that corner.",
  "Chair: We will add that to the district's sanitation list.",
  "Resident: I'm here about the bar on Franklin Avenue near Montgomery Street. It is applying to renew its liquor license.",
  "Resident: Neighbors have complained about noise after midnight. We would like the board to ask for stipulations on closing hours before it renews.",
  "Chair: We will bring that to the committee ahead of the next State Liquor Authority hearing.",
  "Board member: Before we close, the vacant lot at Empire Boulevard and Bedford Avenue has sat empty for years. We should ask the city what it plans for the site.",
  "Chair: Good point. Written testimony may be emailed to the board office through Monday. Thank you all for coming. This hearing is adjourned.",
];

const paragraphs = buildParagraphs(lines.join("\n"));

export const demoMeeting: TranscriptMeeting = {
  id: DEMO_MEETING_ID,
  title: "FY 2028 Statement of Needs Public Hearing",
  label: "Needs Hearing",
  date: "2026-10-23",
  paragraphs,
};

const place = (name: string, lat: number, lng: number): Place => ({ name, lat, lng, source: "manual" });

type Seed = { title: string; type: string; urgent: boolean; status: Ticket["status"]; paragraphs: string[]; place: Place; summary: string; deadline?: string };

const seeds: Seed[] = [
  { title: "Signal timing and speed camera at Nostrand Ave and Eastern Pkwy", type: "Transportation Request", urgent: true, status: "Open", paragraphs: ["P3", "P4", "P5"], place: place("Nostrand Ave & Eastern Pkwy", 40.6693, -73.9503), summary: "Drivers run the light during the school crossing. A stroller was clipped last month. Ask DOT to review the signal timing and add a speed camera.", deadline: "2026-12-18" },
  { title: "Flooding and clogged catch basin at Kingston Ave and Empire Blvd", type: "Quality of Life Complaint", urgent: true, status: "In Progress", paragraphs: ["P6", "P7", "P8"], place: place("Kingston Ave & Empire Blvd", 40.6629, -73.9422), summary: "The basin backs up in every rainstorm and flooded a building entrance. It has not been cleaned in over a year. Ask DEP for a cleaning." },
  { title: "Streetlights out on Winthrop St near Nostrand Ave station", type: "Public Safety Issue", urgent: true, status: "Open", paragraphs: ["P9", "P10", "P11"], place: place("Winthrop St & Nostrand Ave", 40.657, -73.9502), summary: "Three streetlights have been out since September. A resident was followed last week. Ask the city to replace them." },
  { title: "Rats and overflowing trash at Rogers Ave and Lefferts Ave", type: "Quality of Life Complaint", urgent: false, status: "Open", paragraphs: ["P12", "P13", "P14"], place: place("Rogers Ave & Lefferts Ave", 40.6603, -73.9531), summary: "Trash cans overflow and rats come out at dusk. Request more frequent pickups and a larger basket." },
  { title: "Liquor license renewal and closing hours on Franklin Ave", type: "Liquor License", urgent: false, status: "In Progress", paragraphs: ["P15", "P16", "P17"], place: place("Franklin Ave & Montgomery St", 40.6655, -73.9577), summary: "Neighbors report noise after midnight. Ask for stipulations on closing hours before the renewal." },
  { title: "Plans for the vacant lot at Empire Blvd and Bedford Ave", type: "Land Use Request", urgent: false, status: "Open", paragraphs: ["P18"], place: place("Empire Blvd & Bedford Ave", 40.6628, -73.9568), summary: "The lot has sat empty for years. Ask the city what is planned for the site." },
];

export const demoTickets: Ticket[] = seeds.map((seed, index) => ({
  id: `demo-${index + 1}`,
  number: String(index + 1),
  title: seed.title,
  type: seed.type,
  status: seed.status,
  location: { text: seed.place.name, places: [seed.place] },
  requester: "Resident",
  summary: seed.summary,
  urgent: seed.urgent,
  deadline: seed.deadline ?? "",
  submittedBy: "Needs hearing",
  submittedAt: "2026-10-23",
  meetingIds: [DEMO_MEETING_ID],
  spans: spansFromParagraphIds(paragraphs, seed.paragraphs).map((span) => ({ ...span, meetingId: DEMO_MEETING_ID })),
  ownerId: null,
  source: "transcript",
  closedAt: null,
  createdBy: null,
  evidence: { [DEMO_MEETING_ID]: seed.paragraphs },
}));

/** The draft minutes, as the generate step would write them from the transcript above. */
export const demoMinutes = `
<h1>Brooklyn Community Board 9</h1>
<p>FY 2028 Statement of Needs Public Hearing Minutes</p>
<p>Friday, October 23, 2026</p>
<h2>1. Call to Order</h2>
<ul>
<li>The district manager opened the public hearing on the district's needs for the coming fiscal year.</li>
<li>Each speaker was given two minutes and asked to name the block they were speaking about.</li>
</ul>
<h2>2. Public Testimony</h2>
<ul>
<li><strong>Nostrand Avenue and Eastern Parkway.</strong> A resident reported drivers running the light during the school crossing and a stroller struck last month. The board will ask DOT to review the signal timing and add a speed camera. Marked urgent.</li>
<li><strong>Kingston Avenue and Empire Boulevard.</strong> A resident reported a catch basin that backs up in every rainstorm and flooded a building entrance. The board will ask DEP to clean it. Marked urgent.</li>
<li><strong>Winthrop Street near the Nostrand Avenue station.</strong> A resident reported three streetlights out since September. The board will ask the city to replace them. Marked urgent.</li>
<li><strong>Rogers Avenue and Lefferts Avenue.</strong> A resident reported overflowing trash and rats. The board will add the corner to the district's sanitation list.</li>
<li><strong>Franklin Avenue near Montgomery Street.</strong> A resident asked the board to seek closing-hour stipulations before a bar's liquor license is renewed. The matter goes to the committee ahead of the next SLA hearing.</li>
</ul>
<h2>3. New Business</h2>
<ul>
<li>A board member asked the city for its plans for the vacant lot at Empire Boulevard and Bedford Avenue.</li>
</ul>
<h2>4. Adjournment</h2>
<ul>
<li>Written testimony may be emailed to the board office through Monday. The hearing was adjourned.</li>
</ul>
`;
