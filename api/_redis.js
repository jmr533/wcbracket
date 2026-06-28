import { Redis } from "@upstash/redis";

let redis;

export function getRedis() {
  return redis ||= Redis.fromEnv();
}
