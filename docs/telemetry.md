# Telemetry

Everything the app sends to Better Stack, and nothing else. The code is `src/lib/analytics.ts`; events are fired from `src/App.tsx`, `src/SignIn.tsx`, `src/ShareLink.tsx` and `src/features/landing/Landing.tsx`. For how the tag is configured and the dashboards, see "Usage analytics" in [`architecture.md`](architecture.md). Planned additions are in WA-194.

When you add or change an event, update this file in the same pull request.

A major feature must have its telemetry in place before it is turned on for any board other than `staging`. Staging is exempt, so a feature can be tried there first. Check this when changing a feature flag for a real board.

## When it runs

- Only when `VITE_BETTERSTACK_TOKEN` is set (production on Netlify). Local development and deploy previews send nothing unless given a token.
- Never on `/share/*` pages, or on any address with a query string or hash. Those addresses carry share and auth tokens, and the tag cannot be told to hide them.

## On every page view and event

| Field | Value |
| --- | --- |
| `board_id` | The signed-in user's current board |
| `role` | `platform_admin` or `staff` |

Set by `setAnalyticsUser` and cleared on the sign-in screen. Better Stack's own `user` call is not used, so no user id or email is attached. `login` and the sign-in page view carry neither field, because no one is signed in yet.

## Automatic

| What | Details |
| --- | --- |
| Web vitals | Collected by the Better Stack tag |
| Frontend errors | Sent through the Sentry SDK inside the tag. URLs are cleaned, cookies, headers and the query string are removed, and console and click (`ui.*`) breadcrumbs are dropped |

## Page views

Sent by the app, because the screens change without the address changing. Automatic page views are off.

| Event | Fields |
| --- | --- |
| `page-load` (first view of the tab), then `page-change` | `url` (cleaned address), `title`, `board_id` (not on Sign in) |

Screens: `/` (Home), `/tickets` (Tickets), `/meetings` (Meetings), `/submit` (the full-screen submit flow, used on phones), `/sign-in` (Sign in), `/landing` (the public landing page, no `board_id` or `role`). A `?submit` link opens the submit flow directly; like any address with a query string, it sends nothing.

## Events

### Account and board

| Event | Fired when | Fields |
| --- | --- | --- |
| `login` | Password sign-in succeeds | `method` (`password`) |
| `magic_link_sent` | A sign-in link email is requested successfully | none |
| `board_switched` | A platform admin switches boards | `board_id` (the board switched to) |

### Tickets

| Event | Fired when | Fields |
| --- | --- | --- |
| `ticket_created` | The database finishes inserting a new ticket | `board_id`, `source` (`manual` for tickets made in the app), `form_ms` (intake form open to submit), `save_ms` (submit to saved) |
| `ticket_deleted` | A ticket is deleted. Once per ticket, so a bulk delete sends several | `board_id` |
| `attachment_added` | A PDF is attached to a ticket | `board_id` |
| `attachment_removed` | An attachment is removed | `board_id` |
| `feedback_sent` | The footer's Contact us form is sent (by email or into the feedback table, either one counts) | `board_id`, `kind` (`bug`, `feature` or `feedback`) |
| `feedback_failed` | Sending it fails | `board_id`, `kind` |
| `location_autopin` | The app tries to find a map point for a location on its own: after staff save Cross streets, after a transcript suggestion is approved, or when staff click a row's no-pin warning | `board_id`, `trigger` (`cross_streets`, `approved`, or `warning_click` when staff click a row's no-pin warning), `outcome` (`pinned`, `pinned_nearest` for a "Near" pin when the streets almost meet, `no_match` or `error`) |

`location_autopin` never carries the streets or address it looked up. The lookup itself sends the two street names, or the address wording, to NYC Open Data (street centerlines), NYC GeoSearch or Photon (photon.komoot.io, OpenStreetMap data), not to Better Stack.

`form_ms` and `save_ms` are left out if the timing is unknown. `form_ms` is 0 if the form open time was not recorded.

### Sharing

| Event | Fired when | Fields |
| --- | --- | --- |
| `share_link_copied` | The share link is copied | `board_id` |
| `share_link_replaced` | The share link is replaced with a new one | `board_id` |

### Transcript matching (`transcript_matching` flag)

| Event | Fired when | Fields |
| --- | --- | --- |
| `transcript_opened` | The transcript panel opens on a meeting | `board_id` |
| `matching_started` | Generate runs, after the "Generate again?" confirm | `board_id`, `run_in_session` (runs of this meeting in this tab), `already_generated` (meeting was generated before) |
| `matching_run` | A run succeeds | `board_id`, `updates` (suggestions for existing tickets), `new` (suggestions for new tickets), `run_in_session`, `duration_ms` |
| `matching_failed` | A run errors | `board_id`, `run_in_session`, `duration_ms` |
| `suggestion_reviewed` | A suggestion is accepted or rejected | `board_id`, `kind` (`new` or `update`), `outcome` (`accepted` or `rejected`), `fields_changed` (number of fields the suggestion changes) |

`run_in_session` stands in for a meeting id, so repeat Generate clicks show up without sending which meeting.

### Meetings tab (`meetings_tab` flag)

Page views are sent as `/meetings`.

| Event | Fired when | Fields |
| --- | --- | --- |
| `meetings_opened` | A meeting's view opens (the default newest meeting counts) | `board_id` |
| `meeting_generate_started` | Generate Tickets and Minutes is pressed | `board_id` |
| `meeting_generate_done` | Both the tickets and the minutes finish | `board_id`, `duration_ms` |
| `meeting_generate_failed` | Either one errors | `board_id`, `duration_ms` |
| `minutes_copied` | The Copy button is pressed on the minutes | `board_id` |
| `minutes_edited` | An edit to the minutes is saved | `board_id` |
| `meeting_added` | A transcript is uploaded from the Meetings tab | `board_id`, `folder` |
| `meeting_renamed` | A meeting is renamed, from the list or the meeting's title | `board_id` |
| `meeting_moved` | A meeting is moved to another folder from the list | `board_id` |
| `meeting_removed` | A meeting is removed from the list | `board_id` |
| `meeting_folder_added` | A folder is added from the Meetings tab | `board_id` |

No meeting id, title, transcript or minutes text is sent. `folder` is the folder's name (for example Committee), which staff can choose but which holds no meeting content.

### Landing page (`/landing`)

No one is signed in, so none of these carry `board_id` or `role`.

| Event | Fired when | Fields |
| --- | --- | --- |
| `landing_cta_clicked` | A "Get Loopback" button or Contact us opens the contact popup | `source` (`hero`, `closing`, `footer` or `about`) |
| `landing_signin_clicked` | Sign in in the header is clicked | none |
| `landing_demo_tab` | The visitor switches tabs in the demo | `tab` (`home`, `tickets` or `meetings`) |
| `landing_demo_ticket_submitted` | A ticket is added through the demo phone form | `urgent` |
| `landing_contact_submitted` | The contact form posts successfully | none |
| `landing_contact_failed` | The contact form post fails | none |

The email and details a visitor types, and the demo ticket's text, are never sent.

## What the data can and cannot tell you

- Counts are per browser session (the first-party `_bs` cookie), not per person, because no user id is sent. Per-person counts, and suggestion acceptance by board, come from the database (`board_suggestion_stats`).
- Cancelling the "Generate again?" confirm is not tracked.
- `suggestion_reviewed` gives the acceptance rate only. It has no rejection reason and no suggestion id, and nothing feeds back into predictions.
- Clicks are not tracked beyond the events above. Autocapture is off on purpose.

## Never sent

- Ticket content, titles, quotes or ids
- Names, emails or user ids
- Share tokens, query strings or hashes
- Meeting ids
- Session replays, console logs, click autocapture or browser fingerprints. These must stay off in Better Stack, and the ingestion transformations drop them as a backstop.
