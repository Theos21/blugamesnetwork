// netlify/functions/heartbeat.js
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const cookie = req.headers.get("cookie") || "";
    const match = cookie.match(/access_token=([^;]+)/);
    if (!match) return new Response("No auth", { status: 401 });

    let payload;
    try {
      payload = jwt.verify(match[1], process.env.JWT_SECRET);
    } catch {
      return new Response("Bad token", { status: 401 });
    }

    const { clientId, inactive } = await req.json();
    if (!clientId) return new Response("Missing clientId", { status: 400 });

    // 🔑 Check that the key still exists AND is active
    const { data: k } = await supabase
      .from("keys")
      .select("is_active")
      .eq("key", payload.key)
      .maybeSingle();

    if (!k || !k.is_active) {
      // Mark this session inactive and fail fast
      await supabase
        .from("sessions")
        .update({ is_active: false })
        .eq("key", payload.key)
        .eq("client_id", clientId);
      return new Response("Key inactive", { status: 403 });
    }

    if (inactive) {
      await supabase
        .from("sessions")
        .update({ is_active: false })
        .eq("key", payload.key)
        .eq("client_id", clientId);
      return new Response("OK");
    }

    // Normal heartbeat
    await supabase
      .from("sessions")
      .update({ last_seen: new Date().toISOString(), is_active: true })
      .eq("key", payload.key)
      .eq("client_id", clientId);

    return new Response("OK");
  } catch {
    return new Response("Server error", { status: 500 });
  }
};
