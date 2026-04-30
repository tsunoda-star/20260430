import net from 'node:net';

/**
 * SSRF: spec.md §7.2 ブロック対象 (private/reserved IP + 内部ホスト名)。
 *
 * IPv4: RFC1918 + loopback + link-local + multicast + reserved + cloud metadata
 * IPv6: loopback (::1) + link-local (fe80::/10) + ULA (fc00::/7) + IPv4-mapped
 */

/** ホスト名 deny list (DNS解決前にブロック) */
export const BLOCK_HOSTS: ReadonlySet<string> = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata.azure.com',
  '169.254.169.254',
  // *.local / *.internal はワイルドカードなので isInternalHostname で別途判定
]);

/** *.local / *.internal / 末尾ドット trim 後の判定 */
export function isInternalHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/\.+$/, '');
  if (BLOCK_HOSTS.has(h)) return true;
  if (h.endsWith('.local') || h.endsWith('.internal')) return true;
  return false;
}

/** IPv4 アドレスをビッグエンディアン uint32 に変換 */
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255 || /^0\d/.test(p)) return null;
    n = (n * 256 + v) >>> 0;
  }
  return n >>> 0;
}

/** IPv4 が CIDR レンジ内か */
function inV4Cidr(ipInt: number, cidrBase: string, prefix: number): boolean {
  const base = ipv4ToInt(cidrBase);
  if (base === null) return false;
  if (prefix === 0) return true;
  const mask = (~0 << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (base & mask);
}

/**
 * IPv4 がプライベート/予約レンジか判定。
 * spec.md §7.2 + 一般的な禁止帯。
 */
export function isPrivateOrReservedIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true; // 不正な形 → 安全側で block
  return (
    inV4Cidr(n, '0.0.0.0', 8) || // "this" network
    inV4Cidr(n, '10.0.0.0', 8) || // private
    inV4Cidr(n, '127.0.0.0', 8) || // loopback
    inV4Cidr(n, '169.254.0.0', 16) || // link-local (incl AWS IMDS)
    inV4Cidr(n, '172.16.0.0', 12) || // private
    inV4Cidr(n, '192.0.0.0', 24) || // protocol assignments
    inV4Cidr(n, '192.0.2.0', 24) || // documentation
    inV4Cidr(n, '192.168.0.0', 16) || // private
    inV4Cidr(n, '198.18.0.0', 15) || // benchmark
    inV4Cidr(n, '198.51.100.0', 24) || // documentation
    inV4Cidr(n, '203.0.113.0', 24) || // documentation
    inV4Cidr(n, '224.0.0.0', 4) || // multicast
    inV4Cidr(n, '240.0.0.0', 4) || // reserved
    n === 0xffffffff || // broadcast
    inV4Cidr(n, '100.64.0.0', 10) || // CGN (Alibaba metadata 100.100.100.200)
    inV4Cidr(n, '100.100.100.0', 24) // Alibaba metadata range
  );
}

/** IPv6 がプライベート/予約レンジか判定 (簡易: prefix 文字列マッチ) */
export function isPrivateOrReservedIPv6(ip: string): boolean {
  const lower = ip.toLowerCase().split('%')[0] ?? ''; // remove zone-id
  if (lower === '::1' || lower === '::') return true;
  // IPv4-mapped IPv6: ::ffff:a.b.c.d → IPv4 として再判定
  const v4Mapped = lower.match(/^::ffff:([0-9.]+)$/);
  if (v4Mapped && v4Mapped[1]) return isPrivateOrReservedIPv4(v4Mapped[1]);
  // link-local fe80::/10
  if (/^fe[89ab][0-9a-f]?:/.test(lower)) return true;
  // ULA fc00::/7 (fc00::~fdff::)
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true;
  // multicast ff00::/8
  if (/^ff[0-9a-f]{2}:/.test(lower)) return true;
  // EC2 IMDSv2 IPv6: fd00:ec2::254 — ULA でカバー済み
  return false;
}

/** IPv4/IPv6 を判別して private/reserved 判定 */
export function isPrivateOrReservedIP(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateOrReservedIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateOrReservedIPv6(ip);
  return true; // 不明形式は block
}
