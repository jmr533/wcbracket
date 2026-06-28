import crypto from "node:crypto";

const cookieName = "wcbracket_admin";

function secret() {
  if (!process.env.ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD is not configured");
  return process.env.ADMIN_PASSWORD;
}

function token() {
  return crypto.createHmac("sha256", secret()).update("wcbracket-admin").digest("hex");
}

function equal(left, right) {
  const a = Buffer.from(left || "");
  const b = Buffer.from(right || "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function validPassword(password) {
  return equal(password, secret());
}

export function isAdmin(request) {
  const cookies = Object.fromEntries((request.headers.cookie || "").split(";").map((part) => {
    const [key, ...value] = part.trim().split("=");
    return [key, value.join("=")];
  }));
  return equal(cookies[cookieName], token());
}

export function sameOrigin(request) {
  try {
    return new URL(request.headers.origin).host === request.headers.host;
  } catch {
    return false;
  }
}

export function sessionCookie(clear = false) {
  return `${cookieName}=${clear ? "" : token()}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${clear ? 0 : 43200}`;
}
