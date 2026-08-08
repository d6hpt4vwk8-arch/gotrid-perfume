import dns from "node:dns/promises";

/**
 * Blocks the admin XLSX import's image-URL fetch (src/lib/import/download-images.ts)
 * from reaching loopback/private/link-local/metadata addresses — without this,
 * a crafted "image" column value lets an admin-import request probe internal
 * services or cloud metadata endpoints (security audit finding: import SSRF).
 * Checked by resolved IP, not hostname, so "http://trusted.example" pointing
 * its DNS at 169.254.169.254 doesn't slip through.
 */

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isIpv4InCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(range) & mask);
}

// RFC 1918/5735/6598 private, loopback, link-local, reserved, and multicast ranges.
const PRIVATE_V4_CIDRS = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16", // includes the 169.254.169.254 cloud metadata endpoint
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "240.0.0.0/4",
];

function isPrivateIpv4(ip: string): boolean {
  return PRIVATE_V4_CIDRS.some((cidr) => isIpv4InCidr(ip, cidr));
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80:")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local fc00::/7
  const v4Mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (v4Mapped) return isPrivateIpv4(v4Mapped[1]);
  return false;
}

export class UnsafeUrlError extends Error {}

/** Throws UnsafeUrlError if `hostname` resolves to any non-public address. */
export async function assertPublicHost(hostname: string): Promise<void> {
  let addresses: { address: string; family: number }[];
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new UnsafeUrlError("DNS lookup selhal.");
  }
  if (addresses.length === 0) throw new UnsafeUrlError("DNS lookup nevrátil žádnou adresu.");

  for (const { address, family } of addresses) {
    if (family === 4 && isPrivateIpv4(address)) {
      throw new UnsafeUrlError("Cílová adresa není povolena.");
    }
    if (family === 6 && isPrivateIpv6(address)) {
      throw new UnsafeUrlError("Cílová adresa není povolena.");
    }
  }
}
