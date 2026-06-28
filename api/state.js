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

export function sameDraw(current, proposed) {
  const assignments = new Map(current.map(({ number, player, team }) => [number, `${player}\0${team}`]));
  return proposed.every(({ number, player, team }) => assignments.get(number) === `${player}\0${team}`);
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

  const key = "wcbracket:entries";
  const proposed = request.body.entries;
  const current = await redis.get(key);
  if (!current) {
    if (proposed.some(({ team }) => !team) || new Set(proposed.map(({ team }) => team)).size !== 32) {
      return response.status(400).json({ error: "All 32 unique teams must be set before the draw" });
    }
    if (await redis.set(key, proposed, { nx: true })) return response.json({ saved: true });
    return response.status(409).json({ error: "The draw was already completed" });
  }

  if (!sameDraw(current, proposed)) {
    return response.status(409).json({ error: "The draw is locked and cannot be replaced" });
  }

  await redis.set(key, proposed);
  return response.json({ saved: true });
}
