// The meetings whose transcripts staff can flip through. These are bundled demo transcripts;
// in production this list comes from the Block Party API, and this module is the place to swap it in.
import rawTrain1 from "../data/raw_train1.txt?raw";
import rawTrain2 from "../data/raw_train2.txt?raw";
import { buildParagraphs, type Paragraph } from "./transcript";

export type Meeting = {
  id: string;
  /** Full name, shown above the transcript. */
  title: string;
  /** Short name for the ticket table's Transcript tag. */
  label: string;
  /** Meeting date as YYYY-MM-DD. */
  date: string;
  paragraphs: Paragraph[];
};

/** Newest first. */
export const meetings: Meeting[] = [
  { id: "cb3-full-2026-09-29", title: "CB3 - Full Board Meeting (9/29/26)", label: "Full Board 9/29/26", date: "2026-09-29", paragraphs: buildParagraphs(rawTrain1) },
  { id: "cb3-full-2026-07-28", title: "CB3 - Full Board Meeting (7/28/26)", label: "Full Board 7/28/26", date: "2026-07-28", paragraphs: buildParagraphs(rawTrain2) },
];

const byId = new Map(meetings.map((meeting) => [meeting.id, meeting]));
export const meetingById = (id: string | null): Meeting | undefined => (id ? byId.get(id) : undefined);
