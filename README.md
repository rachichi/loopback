# Loopback Portal

Loopback is a civic operations dashboard for community board service tickets. It gives staff a single place to track resident requests, review the issue map for Community Board 3, and triage follow-up work from one shared workspace.

## Portal structure

- Header: top bar with the Loopback brand, notification button, and current user badge.
- Navigation: ticket, calendar, roles, and resource tabs.
- Ticket table: the main records list on the left with filters, search, and ticket rows.
- Ticket inspector: detail panel for the selected issue showing owner, next steps, and quick actions.
- Right sidebar: interactive map for Community Board 3 and summary cards for current workload.

## How to use it

1. Open the app with the local Vite dev server.
2. Use the search box or status filter in the toolbar to narrow the ticket list.
3. Click any ticket row to inspect the details and suggested next steps.
4. Use the Map tab in the right sidebar to review the live NYC Boundaries map for Community Board 3.
5. Switch to the Summary tab to view counts by status and ticket category.
6. Use the close button in the ticket inspector if you want to collapse the detail panel while keeping the list visible.

## Local development

```bash
npm install
npm run dev
```

Then open the local URL shown in the terminal, typically:

```text
http://localhost:8443/
```

## Production build

```bash
npm run build
```

## Notes

- The current dashboard ships with a curated sample set of civic tickets for Community Board 3.
- The map panel embeds the NYC Boundaries tool for neighborhood and district viewing.
- Branding is driven by the Loopback image asset in the app asset folder and the favicon served from the public folder.
