import { isAdmin, sameOrigin } from "./_auth.js";
import { getRedis } from "./_redis.js";

const stages = new Set(["R32", "R16", "QF", "SF", "FOURTH", "THIRD", "FINAL", "RUNNER_UP", "CHAMPION", "OUT"]);

export function validEntries(entries) {
  return Array.isArray(entries) && entries.length === 32 &&
    new Set(entries.map(({ number }) => number)).size === 32 &&
    entries.every(({ number, player, team, stage }) =>
      Number.isInteger(number) && number >= 1 && number <= 32 &&
      typeof player === "string" && player.length <= 100 &&
      typeof team === "string" && team.length <= 100 &&
      stages.has(stage)
    );
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  const redis = getRedis();
  if (request.method === "GET") {
    return response.json({ entries: await redis.get("wcbracket:entries") });
  }

  if (request.method !== "PUT") return response.status(405).json({ error: "Method not allowed" });
  if (!isAdmin(request)) return response.status(401).json({ error: "Admin login required" });
  if (!sameOrigin(request)) return response.status(403).json({ error: "Invalid request origin" });
  if (!validEntries(request.body?.entries)) return response.status(400).json({ error: "Invalid pool state" });

  await redis.set("wcbracket:entries", request.body.entries);
  return response.json({ saved: true });
}
