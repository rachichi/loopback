// Usage analytics through Google Analytics 4. Off unless VITE_GA_MEASUREMENT_ID is set (a public "G-..."
// id), so local development and deploy previews send nothing unless they are given one.
//
// What is sent: page views of the app's screens, a few named events (sign in, ticket created or deleted,
// share link copied or replaced, board switched), and two user properties: board id and role.
// What is never sent: ticket content, names, emails, user ids, or the secret part of a share link.
// Page addresses are rewritten before they leave the browser (see safeLocation).

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const measurementId = (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined)?.trim() || undefined;
let started = false;

/** The page address with anything secret removed: no query string or hash (auth links put tokens
 *  there), and /share/<token> reported as /share/:token. */
function safeLocation(path = window.location.pathname): string {
  const url = new URL(window.location.origin);
  url.pathname = path.replace(/^\/share\/[^/]+/, "/share/:token");
  return url.toString();
}

/** Loads gtag.js once. Safe to call when analytics is off. */
export function initAnalytics(): void {
  if (!measurementId || started) return;
  started = true;
  window.dataLayer = window.dataLayer ?? [];
  // gtag.js reads the arguments object itself, so this must be a function, not an arrow function.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  // Every hit, including GA's automatic ones (session_start, user_engagement), uses the cleaned address
  // instead of the real one, which on a share page contains the token.
  window.gtag("set", { page_location: safeLocation() });
  // Page views are sent by trackPage, because the app changes screens without changing the address.
  window.gtag("config", measurementId, { send_page_view: false, page_location: safeLocation() });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
}

/** A screen view. `path` is a stable, content-free name such as "/tickets". */
export function trackPage(path: string, title: string): void {
  if (!started) return;
  // Also the default for later events on this screen.
  window.gtag?.("set", { page_location: safeLocation(path), page_title: title });
  window.gtag?.("event", "page_view", { page_location: safeLocation(path), page_title: title });
}

type EventName = "login" | "ticket_created" | "ticket_deleted" | "share_link_copied" | "share_link_replaced" | "board_switched";

/** A named usage event. Parameters must never contain ticket content or personal details. */
export function trackEvent(name: EventName, params: Record<string, string | number | boolean> = {}): void {
  if (!started) return;
  window.gtag?.("event", name, params);
}

/** Who is using the app, by board and role only. Register both as user-scoped custom dimensions in
 *  GA (Admin > Custom definitions) to filter reports by them. */
export function setAnalyticsUser(props: { board_id: string; role: string }): void {
  if (!started) return;
  window.gtag?.("set", "user_properties", props);
}
