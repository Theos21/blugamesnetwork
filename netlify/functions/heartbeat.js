// netlify/functions/heartbeat.js
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405 });
  }

  try {
    // 🔑 Verify JWT from cookie
    const cookie = req.headers.get("cookie") || "";
    const match = cookie.match(/access_token=([^;]+)/);
    if (!match) return new Response(JSON.stringify({ ok: false, error: "No auth" }), { status: 401 });

    let payload;
    try {
      payload = jwt.verify(match[1], process.env.JWT_SECRET);
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "Bad token" }), { status: 401 });
    }

    const { clientId, inactive } = await req.json();
    if (!clientId) {
      return new Response(JSON.stringify({ ok: false, error: "Missing clientId" }), { status: 400 });
    }

    // 🔑 Check that the key still exists AND is active
    const { data: k } = await supabase
      .from("keys")
      .select("is_active")
      .eq("key", payload.key)
      .maybeSingle();

    if (!k || !k.is_active) {
      // Mark session inactive
      await supabase
        .from("sessions")
        .update({ is_active: false })
        .eq("key", payload.key)
        .eq("client_id", clientId);

      return new Response(JSON.stringify({ ok: false, error: "Key inactive" }), { status: 403 });
    }

    if (inactive) {
      await supabase
        .from("sessions")
        .update({ is_active: false })
        .eq("key", payload.key)
        .eq("client_id", clientId);

      return new Response(JSON.stringify({ ok: true }));
    }

    // Normal heartbeat — upsert session (insert if missing)
    await supabase
      .from("sessions")
      .upsert({
        key: payload.key,
        client_id: clientId,
        last_seen: new Date().toISOString(),
        is_active: true,
      }, { onConflict: ["key", "client_id"] });

    return new Response(JSON.stringify({ ok: true }));
  } catch (e) {
    console.error("Heartbeat error:", e);
    return new Response(JSON.stringify({ ok: false, error: "Server error" }), { status: 500 });
  }
};
