/**
 * Check gold statuses across meetings: tickets sharing an `issue` are the same issue at successive meetings.
 *
 *   tsx scripts/check_issues.ts
 *
 * Flags a ticket marked Open when an earlier meeting already has the issue, and an issue
 * that comes back after being marked Closed.
 */
import { loadGold, MEETINGS } from "../lib/data.ts";

const byIssue = new Map<string, { meeting: string; date: string; id: string; title: string; status: string }[]>();
for (const m of MEETINGS) {
  for (const g of loadGold(m.gold)) {
    if (!g.issue) continue;
    byIssue.set(g.issue, [...(byIssue.get(g.issue) ?? []), { meeting: m.name, date: m.date, id: g.id, title: g.title, status: g.status }]);
  }
}

let problems = 0;
for (const [issue, tickets] of byIssue) {
  console.log(`\n${issue}`);
  for (const t of tickets) console.log(`  ${t.date} ${t.meeting} ${t.id.padEnd(4)} ${t.status.padEnd(11)} "${t.title.trim()}"`);
  if (tickets.length < 2) console.log("  ! only one meeting has this issue");
  tickets.forEach((t, i) => {
    if (i > 0 && t.status === "Open") {
      console.log(`  ! ${t.meeting} ${t.id} is Open, but ${tickets[i - 1].meeting} ${tickets[i - 1].id} raised it earlier (expected In Progress or Closed)`);
      problems++;
    }
    if (i > 0 && tickets[i - 1].status === "Closed") {
      console.log(`  ! ${t.meeting} ${t.id} follows ${tickets[i - 1].meeting} ${tickets[i - 1].id}, which was Closed (same issue, or a new one?)`);
      problems++;
    }
  });
}
console.log(`\n${byIssue.size} issues, ${problems} problems`);
