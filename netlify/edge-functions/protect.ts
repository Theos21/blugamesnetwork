import { Context } from "https://edge.netlify.com";
import * as jose from "https://esm.sh/jose@5.2.4";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Supabase client with service role key
const supabase = createClient(
  Deno.env.get("SUPABASE_URL"),
  Deno.env.get("SUPABASE_SERVICE_ROLE")
);

const PUBLIC = [
  "/gate.html",
  "/admin.html",
  "/assets/",
  "/favicon.ico",
  "/robots.txt",
  "/.netlify/functions/key-auth",
  "/.netlify/functions/heartbeat",
  "/.netlify/functions/admin"
];

export default async (req: Request, ctx: Context) => {
  const url = new URL(req.url);

  // Let public files/functions through
  if (PUBLIC.some(p => url.pathname === p || url.pathname.startsWith(p))) {
    return ctx.next();
  }

  const cookie = req.headers.get("cookie") || "";
  const token = (cookie.match(/access_token=([^;]+)/) || [])[1];
  if (!token) {
    return Response.redirect(new URL("/gate.html", url), 302);
  }

  try {
    // Verify JWT
    const { payload } = await jose.jwtVerify(
      token,
      new TextEncoder().encode(Deno.env.get("JWT_SECRET"))
    );

    // Check Supabase: does this key still exist and is it active?
    const { data: k, error } = await supabase
      .from("keys")
      .select("is_active")
      .eq("key", payload.key)
      .maybeSingle();

    if (error || !k || !k.is_active) {
      return Response.redirect(new URL("/gate.html", url), 302);
    }

    return ctx.next();
  } catch (err) {
    return Response.redirect(new URL("/gate.html", url), 302);
  }
};

export const config = { path: "/*" };
