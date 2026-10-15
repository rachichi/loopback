import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";

// Airtable exports keep their "-Grid view" names; override any of these with CLI flags.
export const DATA_FILES = {
  transcript: "data/psplit_train1.txt",
  gold: "data/train1_goldtickets-Grid view.csv",
  rejected: "data/Gold Rejected-Grid view.csv",
  annotators: "data/Annotator Tickets-Grid view.csv",
  types: "data/Ticket Types-Grid view.csv",
};

// CB3 meetings with gold tickets, oldest first. Gold tickets sharing an `issue` across meetings are the same issue updated.
export const MEETINGS = [
  { name: "train2", date: "2026-07-28", transcript: "data/psplit_train2.txt", gold: "data/train2_goldtickets-Grid view.csv" },
  { name: "train1", date: "2026-09-29", transcript: DATA_FILES.transcript, gold: DATA_FILES.gold },
];

export const GOLD_BY_TRANSCRIPT: Record<string, string> = Object.fromEntries(MEETINGS.map((m) => [m.transcript, m.gold]));

/** "data/psplit_train2.txt" -> "train2" */
export function meetingName(transcript: string): string {
  return transcript.replace(/^.*\//, "").replace(/\.txt$/, "").replace(/^psplit_/, "");
}

export const STATUSES = ["Open", "In Progress", "Closed"] as const;
export type Status = (typeof STATUSES)[number];

export type Ticket = {
  id: string;
  title: string;
  evidence: string[];
  type: string;
  status: string;
  location_raw?: string;
  requester?: string;
  summary?: string;
};

export type GoldTicket = Ticket & { sourceTickets: string[]; adjudicationNote: string; issue: string };

export type TicketType = { name: string; definition: string };

// Shape written by scripts/run.ts and read by scripts/score.ts.
export type RunFile = {
  prompt: string;
  model: string;
  run: number;
  transcript: string;
  createdAt: string;
  usage: { inputTokens: number; outputTokens: number; reasoningTokens?: number };
  finishReason?: string;
  attempts?: number;
  costUsd: number;
  tickets: Omit<Ticket, "id">[];
  dropped?: string[];
  /** Gold file of the previous meeting whose tickets were given to the model as history. */
  previous?: string;
};

export type Paragraph = { id: string; text: string };

function readCsv(path: string): Record<string, string>[] {
  return parse(readFileSync(path, "utf8"), { columns: true, bom: true, skip_empty_lines: true });
}

/** "P15,P17" / "P15, P17" / " p15 ; P17 " -> ["P15", "P17"] */
export function parseEvidence(raw: string | undefined): string[] {
  if (!raw) return [];
  const ids = raw
    .split(/[,;\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^P\d+$/.test(s));
  return [...new Set(ids)];
}

function splitList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function loadParagraphs(path = DATA_FILES.transcript): Paragraph[] {
  return readFileSync(path, "utf8")
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => {
      const tab = line.indexOf("\t");
      return { id: line.slice(0, tab).trim(), text: line.slice(tab + 1).trim() };
    });
}

export function loadGold(path = DATA_FILES.gold): GoldTicket[] {
  return readCsv(path).map((r) => ({
    id: r.gold_id.trim(),
    title: r.title.trim(),
    evidence: parseEvidence(r.evidence),
    type: r.type.trim(),
    status: r.status.trim(),
    location_raw: r.location_raw?.trim(),
    summary: r.summary?.trim(),
    sourceTickets: splitList(r.source_tickets),
    adjudicationNote: r.adjudication_note?.trim() ?? "",
    // Airtable exports name the column "Issue" or "Issues" depending on the table.
    issue: (r.Issue ?? r.Issues ?? "").trim(),
  }));
}

export type AnnotatorTicket = Ticket & { annotator: string };

/** Ids are the "Ticket - Annotator" key (e.g. "T3 - GPT-5.6 Luna"), which gold source_tickets reference. */
export function loadAnnotatorTickets(path = DATA_FILES.annotators): AnnotatorTicket[] {
  return readCsv(path).map((r) => ({
    id: r["Ticket - Annotator"].trim(),
    title: r.title.trim(),
    evidence: parseEvidence(r.evidence),
    type: r.type.trim(),
    status: r.status.trim(),
    location_raw: r.location_raw?.trim(),
    requester: r.requester?.trim(),
    summary: r.summary?.trim(),
    annotator: r.annotator.trim(),
  }));
}

export function loadRejected(path = DATA_FILES.rejected): { id: string; sourceTicket: string; category: string }[] {
  return readCsv(path).map((r) => ({
    id: r.rejected_id.trim(),
    sourceTicket: r.source_ticket.trim(),
    category: r.rejection_category.trim(),
  }));
}

export function loadTicketTypes(path = DATA_FILES.types): TicketType[] {
  return readCsv(path).map((r) => ({ name: r.Name.trim(), definition: (r.Notes ?? r.Definitions ?? "").trim() }));
}

export function loadRunTickets(path: string): { run: RunFile; tickets: Ticket[] } {
  const run = JSON.parse(readFileSync(path, "utf8")) as RunFile;
  const tickets = run.tickets.map((t, i) => ({ ...t, id: `T${i + 1}`, evidence: parseEvidence(t.evidence.join(",")) }));
  return { run, tickets };
}
