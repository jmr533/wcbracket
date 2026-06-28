import { isAdmin, sameOrigin, sessionCookie, validPassword } from "./_auth.js";
import { getRedis } from "./_redis.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method === "GET") return response.json({ admin: isAdmin(request) });

  if (request.method === "DELETE") {
    response.setHeader("Set-Cookie", sessionCookie(true));
    return response.status(204).end();
  }

  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  if (!sameOrigin(request)) return response.status(403).json({ error: "Invalid request origin" });

  const redis = getRedis();
  const ip = String(request.headers["x-forwarded-for"] || request.socket.remoteAddress || "unknown").split(",")[0];
  const key = `wcbracket:login:${ip}`;
  const attempts = await redis.incr(key);
  if (attempts === 1) await redis.expire(key, 600);
  if (attempts > 5) return response.status(429).json({ error: "Too many attempts. Try again later." });

  if (!validPassword(request.body?.password)) {
    return response.status(401).json({ error: "Incorrect password" });
  }

  await redis.del(key);
  response.setHeader("Set-Cookie", sessionCookie());
  return response.json({ admin: true });
}
