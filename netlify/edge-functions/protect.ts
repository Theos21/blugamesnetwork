import { Context } from "https://edge.netlify.com";
import * as jose from "https://esm.sh/jose@5.2.4";

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
  if (PUBLIC.some(p => url.pathname === p || url.pathname.startsWith(p))) return ctx.next();

  const cookie = req.headers.get("cookie") || "";
  const token = (cookie.match(/access_token=([^;]+)/) || [])[1];
  if (!token) return Response.redirect(new URL("/gate.html", url), 302);

  try {
    await jose.jwtVerify(token, new TextEncoder().encode(Deno.env.get("JWT_SECRET")));
    return ctx.next();
  } catch {
    return Response.redirect(new URL("/gate.html", url), 302);
  }
};

export const config = { path: "/*" };
