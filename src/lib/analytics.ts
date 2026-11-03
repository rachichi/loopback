// Usage analytics and frontend errors through Better Stack (its JS tag). Off unless VITE_BETTERSTACK_TOKEN
// is set (the public application token from Better Stack's Frontend tab), so local development and
// deploy previews send nothing unless they are given one.
//
// What is sent: page views of the app's screens, a few named events (sign in, ticket created or deleted,
// share link copied or replaced, board switched), board id and role on each of those, web vitals, and
// frontend errors. What is never sent: ticket content, names, emails, user ids, or the secret part of a
// share link. Page addresses are rewritten before they leave the browser (see safeLocation and safeUrl).
//
// The tag turns every feature on by default and most can only be switched off in Better Stack's UI.
// Session replays, console logs, click autocapture and browser fingerprinting must stay off there:
// they would capture ticket content. The tag keeps a first-party `_bs` session cookie.

type BetterStack = ((...args: unknown[]) => void) & { q?: unknown[][]; l?: number };

declare global {
  interface Window {
    betterstack?: BetterStack;
  }
}

const token = (import.meta.env.VITE_BETTERSTACK_TOKEN as string | undefined)?.trim() || undefined;
let started = false;
let pageViews = 0;
let userProps: Record<string, string> = {};

/** The page address with anything secret removed: no query string or hash (auth links put tokens
 *  there), and /share/<token> reported as /share/:token. */
function safeLocation(path = window.location.pathname): string {
  const url = new URL(window.location.origin);
  url.pathname = path.replace(/^\/share\/[^/]+/, "/share/:token");
  return url.toString();
}

/** Any URL with the same cleaning as safeLocation. Other origins (Supabase, map tiles) keep only origin
 *  and path, since their query strings can carry keys or tokens. */
function safeUrl(raw: string): string {
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin === window.location.origin) return safeLocation(url.pathname);
    return url.origin + url.pathname;
  } catch {
    return "[url]";
  }
}

type SentryEvent = { request?: { url?: string; query_string?: unknown; cookies?: unknown; headers?: unknown } };
type SentryBreadcrumb = { category?: string; data?: Record<string, unknown> };

/** Errors go through the Sentry SDK inside Better Stack's tag. Strip addresses, cookies and headers. */
function beforeSend(event: SentryEvent): SentryEvent {
  if (event.request) {
    if (event.request.url) event.request.url = safeUrl(event.request.url);
    delete event.request.query_string;
    delete event.request.cookies;
    delete event.request.headers;
  }
  return event;
}

/** Click and console breadcrumbs can contain ticket text, so drop them. Clean every URL in the rest. */
function beforeBreadcrumb(crumb: SentryBreadcrumb): SentryBreadcrumb | null {
  if (crumb.category === "console" || crumb.category?.startsWith("ui.")) return null;
  const data = crumb.data;
  if (data) {
    for (const key of ["url", "from", "to"]) {
      if (typeof data[key] === "string") data[key] = safeUrl(data[key]);
    }
  }
  return crumb;
}

function bs(...args: unknown[]): void {
  window.betterstack?.(...args);
}

/** True when the address itself is secret. The tag adds location.href to every event it sends (session
 *  start, page hidden, memory) and has no hook to change it, so on these pages it is not loaded at all:
 *  share links carry the token in the path, and auth links put tokens in the query string or hash. */
function secretAddress(): boolean {
  const { pathname, search, hash } = window.location;
  return pathname.startsWith("/share/") || search !== "" || hash !== "";
}

/** Loads Better Stack's tag once. Safe to call when analytics is off. */
export function initAnalytics(): void {
  if (!token || started || secretAddress()) return;
  started = true;
  // Same queue as Better Stack's snippet: calls made before b.js loads wait in `q`.
  const stub: BetterStack = (...args: unknown[]) => {
    (stub.q = stub.q ?? []).push(args);
  };
  stub.l = Date.now();
  window.betterstack = window.betterstack ?? stub;
  bs("config", {
    environment: import.meta.env.MODE,
    sentry: { sendDefaultPii: false, beforeSend, beforeBreadcrumb },
  });
  // Page views are sent by trackPage, because the app changes screens without changing the address and
  // the real address on a share page contains the token.
  bs("init", { autoPageview: false });
  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://betterstack.net/b.js?t=${encodeURIComponent(token)}`;
  document.head.appendChild(script);
}

/** A screen view. `path` is a stable, content-free name such as "/tickets". `boardId` is the board the
 *  screen shows, so views can be filtered by board even after a platform admin switches boards; omit it
 *  for screens with no board (sign in). */
export function trackPage(path: string, title: string, boardId?: string): void {
  if (!started) return;
  bs("track", pageViews++ === 0 ? "page-load" : "page-change", {
    ...userProps,
    url: safeLocation(path),
    title,
    ...(boardId ? { board_id: boardId } : {}),
  });
}

type EventName =
  | "login" | "ticket_created" | "ticket_deleted" | "share_link_copied" | "share_link_replaced" | "board_switched"
  // Transcript matching: board_id and suggestion kind or counts only, never quotes, titles or ids.
  | "transcript_opened" | "matching_run" | "suggestion_reviewed";

/** A named usage event. Parameters must never contain ticket content or personal details. */
export function trackEvent(name: EventName, params: Record<string, string | number | boolean> = {}): void {
  if (!started) return;
  bs("track", name, { ...userProps, ...params });
}

/** Who is using the app, by board and role only. Added to every later page view and event. This is not
 *  Better Stack's `user` call, which would attach an id and email to everything. Pass null on sign-out so
 *  the next sign-in is not reported with the previous user's board and role. */
export function setAnalyticsUser(props: { board_id: string; role: string } | null): void {
  userProps = props ? { ...props } : {};
}
