import { headers } from "next/headers";
import { clientIp } from "./throttle";

/** Klientens IP for endringsloggen, samme gjetning som PIN-bremsen bruker (Cloudflare → SWAG).
 *  Kan forfalskes av den som når appen utenom proxyen, så den er et hint, ikke et bevis. */
export async function requestIp(): Promise<string> {
  return clientIp(await headers());
}
