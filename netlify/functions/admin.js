import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

export default async (req) => {
  const cookie = req.headers.get("cookie") || "";
  const token = (cookie.match(/access_token=([^;]+)/) || [])[1];
  if (!token) return json({ ok:false, error:"No auth" }, 401);

  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET); }
  catch { return json({ ok:false, error:"Bad token" }, 401); }

  if (!payload.is_admin) return json({ ok:false, error:"Not admin" }, 403);

  if (req.method === "POST") {
    const body = await req.json();
    switch (body.action) {
      case "add_key":
        await supabase.from("keys").insert({
          key: body.key, label: body.label || null, is_active: true, is_admin: false, claimed_by: null
        });
        return json({ ok:true });

      case "remove_key":
        await supabase.from("keys").delete().eq("key", body.key);
        return json({ ok:true });

      case "toggle_active":
        await supabase.from("keys").update({ is_active: !!body.is_active }).eq("key", body.key);
        return json({ ok:true });

      case "unclaim_key":
        await supabase.from("keys").update({ claimed_by: null, first_claimed_at: null }).eq("key", body.key);
        return json({ ok:true });

      case "kick_session":
        await supabase.from("sessions").update({ is_active:false }).eq("id", body.session_id);
        return json({ ok:true });

      case "ban_key":  // deactivate AND kick all sessions for the key
        await supabase.from("keys").update({ is_active:false }).eq("key", body.key);
        await supabase.from("sessions").update({ is_active:false }).eq("key", body.key);
        return json({ ok:true });

      default:
        return json({ ok:false, error:"Unknown action" }, 400);
    }
  }

  // GET: return keys + sessions
  const { data: keys } = await supabase.from("keys")
    .select("key,label,is_active,is_admin,claimed_by,created_at,first_claimed_at,last_used_at,total_uses")
    .order("created_at", { ascending:false });

  const { data: online } = await supabase.from("online_sessions").select("*").order("last_seen",{ascending:false});

  return json({ ok:true, keys: keys || [], online: online || [] });
};

function json(obj, status=200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type":"application/json" } });
}
