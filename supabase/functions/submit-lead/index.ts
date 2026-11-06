// submit-lead: the landing page's "Get Loopback for your board" form. Saves the request in board_leads, then
// emails it to the team.
//
//   POST /functions/v1/submit-lead   { "email": "...", "details": "...", "website": "" }
//
// Called by visitors who are not signed in, so it holds the only write path: the table has no anon access.
// "website" is a honeypot; people leave it empty and bots fill it in. A bot gets the same success reply and
// nothing is stored.
//
// Secrets (function secrets): RESEND_API_KEY, LEAD_NOTIFY_TO (comma-separated recipients, kept out of the
// repo), LEAD_FROM (a sender on a domain verified in Resend). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
// provided by Supabase. If the email fails the lead is still saved and the visitor still sees success.
import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Use POST." });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Send JSON: { \"email\": \"...\", \"details\": \"...\" }." });
  }
  if (typeof body.website === "string" && body.website.trim()) return json(200, { ok: true });

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const details = typeof body.details === "string" ? body.details.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json(400, { error: "Enter a valid email address." });
  if (!details || details.length > 4000) return json(400, { error: "Tell us a little about how you would use Loopback." });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: lead, error } = await db.from("board_leads").insert({ email, details }).select("id").single();
  if (error) {
    console.error("board_leads insert failed", error.message);
    return json(500, { error: "Couldn't save your request. Please try again." });
  }

  // The email is best effort: the lead is already safe in the database.
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const to = (Deno.env.get("LEAD_NOTIFY_TO") ?? "").split(",").map((address) => address.trim()).filter(Boolean);
  const from = Deno.env.get("LEAD_FROM");
  if (!apiKey || !to.length || !from) {
    console.error("Lead saved but not emailed: RESEND_API_KEY, LEAD_NOTIFY_TO and LEAD_FROM must all be set.");
    return json(200, { ok: true });
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        reply_to: email,
        subject: "New Loopback request from the landing page",
        text: `From: ${email}\n\n${details}`,
        html: `<p><strong>From:</strong> ${escapeHtml(email)}</p><p style="white-space:pre-wrap">${escapeHtml(details)}</p>`,
      }),
    });
    if (response.ok) await db.from("board_leads").update({ emailed_at: new Date().toISOString() }).eq("id", lead.id);
    else console.error("Resend refused the email", response.status, await response.text());
  } catch (failure) {
    console.error("Email request failed", failure);
  }
  return json(200, { ok: true });
});
