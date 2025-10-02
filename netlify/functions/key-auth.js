import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const { key, clientId } = await req.json();
    if (!key || !clientId) return new Response("Missing key or clientId", { status: 400 });

    // Lookup key
    const { data: k, error } = await supabase.from("keys").select("*").eq("key", key).single();
    if (error || !k || !k.is_active) return new Response("Invalid or inactive key", { status: 401 });

    // "ONE USER EVER": first device claims; others forever blocked
    const nowIso = new Date().toISOString();
    if (!k.claimed_by) {
      await supabase.from("keys").update({
        claimed_by: clientId,
        first_claimed_at: nowIso
      }).eq("key", key);
    } else if (k.claimed_by !== clientId) {
      return new Response("This key is already in use by another user.", { status: 403 });
    }

    // Usage stats
    await supabase.from("keys").update({
      last_used_at: nowIso,
      total_uses: (k.total_uses || 0) + 1
    }).eq("key", key);

    // Presence (UPSERT using the unique (key,client_id) constraint)
    const ua = req.headers.get("user-agent") || "unknown";
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("client-ip") || "unknown";

    await supabase
      .from("sessions")
      .upsert({
        key, client_id: clientId, user_agent: ua, ip,
        is_active: true, last_seen: nowIso
      }, { onConflict: "key,client_id" });

    // JWT cookie
    const token = jwt.sign(
      { key: k.key, is_admin: !!k.is_admin, iat: Math.floor(Date.now() / 1000) },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    return new Response("OK", { headers: { "Set-Cookie": cookieStr(token) } });
  } catch (e) {
    return new Response("Server error", { status: 500 });
  }
};

function cookieStr(token) {
  return [
    `access_token=${token}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=43200" // 12h
  ].join("; ");
}
