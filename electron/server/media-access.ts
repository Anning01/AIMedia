import { createHmac, timingSafeEqual } from "node:crypto";
const signature = (key: string, path: string, expires: string) =>
  createHmac("sha256", key).update(`${path}\n${expires}`).digest("hex");
export function signMediaPath(
  path: string,
  key: string,
  expires = String(Math.floor(Date.now() / 1000) + 86400),
) {
  return `${path}?expires=${expires}&signature=${signature(key, path, expires)}`;
}
export function verifyMediaSignature(
  path: string,
  expires: unknown,
  provided: unknown,
  key: string,
) {
  if (
    typeof expires !== "string" ||
    typeof provided !== "string" ||
    !/^\d+$/.test(expires) ||
    !/^[a-f0-9]{64}$/.test(provided) ||
    Number(expires) < Date.now() / 1000
  )
    return false;
  return timingSafeEqual(
    Buffer.from(signature(key, path, expires)),
    Buffer.from(provided),
  );
}
