import { describe, it, expect } from 'vitest';
import {
  isPrivateOrReservedIP,
  isPrivateOrReservedIPv4,
  isPrivateOrReservedIPv6,
  isInternalHostname,
  BLOCK_HOSTS,
} from '../ip-blocklist';

describe('isPrivateOrReservedIPv4', () => {
  it('blocks RFC1918 ranges', () => {
    expect(isPrivateOrReservedIPv4('10.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIPv4('172.16.0.1')).toBe(true);
    expect(isPrivateOrReservedIPv4('172.31.255.254')).toBe(true);
    expect(isPrivateOrReservedIPv4('192.168.1.1')).toBe(true);
  });

  it('blocks loopback', () => {
    expect(isPrivateOrReservedIPv4('127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIPv4('127.255.255.255')).toBe(true);
  });

  it('blocks AWS IMDS link-local', () => {
    expect(isPrivateOrReservedIPv4('169.254.169.254')).toBe(true);
    expect(isPrivateOrReservedIPv4('169.254.0.1')).toBe(true);
  });

  it('blocks Alibaba metadata range', () => {
    expect(isPrivateOrReservedIPv4('100.100.100.200')).toBe(true);
  });

  it('blocks documentation / multicast / reserved ranges', () => {
    expect(isPrivateOrReservedIPv4('192.0.2.1')).toBe(true); // TEST-NET-1
    expect(isPrivateOrReservedIPv4('198.51.100.1')).toBe(true); // TEST-NET-2
    expect(isPrivateOrReservedIPv4('203.0.113.1')).toBe(true); // TEST-NET-3
    expect(isPrivateOrReservedIPv4('224.0.0.1')).toBe(true); // multicast
    expect(isPrivateOrReservedIPv4('255.255.255.255')).toBe(true); // broadcast
    expect(isPrivateOrReservedIPv4('0.0.0.0')).toBe(true);
  });

  it('allows public IPs', () => {
    expect(isPrivateOrReservedIPv4('8.8.8.8')).toBe(false);
    expect(isPrivateOrReservedIPv4('1.1.1.1')).toBe(false);
    expect(isPrivateOrReservedIPv4('142.250.196.110')).toBe(false);
  });

  it('treats malformed IPv4 as blocked (safe default)', () => {
    expect(isPrivateOrReservedIPv4('999.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIPv4('not-an-ip')).toBe(true);
    expect(isPrivateOrReservedIPv4('010.0.0.1')).toBe(true); // octal-style
  });
});

describe('isPrivateOrReservedIPv6', () => {
  it('blocks IPv6 loopback / unspecified', () => {
    expect(isPrivateOrReservedIPv6('::1')).toBe(true);
    expect(isPrivateOrReservedIPv6('::')).toBe(true);
  });

  it('blocks link-local fe80::/10', () => {
    expect(isPrivateOrReservedIPv6('fe80::1')).toBe(true);
    expect(isPrivateOrReservedIPv6('FE80::abcd')).toBe(true);
  });

  it('blocks ULA fc00::/7 (incl EC2 IMDSv2 fd00:ec2::254)', () => {
    expect(isPrivateOrReservedIPv6('fd00:ec2::254')).toBe(true);
    expect(isPrivateOrReservedIPv6('fc00::1')).toBe(true);
  });

  it('blocks IPv4-mapped IPv6 to private IPv4', () => {
    expect(isPrivateOrReservedIPv6('::ffff:10.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIPv6('::ffff:127.0.0.1')).toBe(true);
  });

  it('allows public IPv6 (Google DNS)', () => {
    expect(isPrivateOrReservedIPv6('2001:4860:4860::8888')).toBe(false);
  });
});

describe('isPrivateOrReservedIP', () => {
  it('dispatches by IP family', () => {
    expect(isPrivateOrReservedIP('10.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIP('::1')).toBe(true);
    expect(isPrivateOrReservedIP('8.8.8.8')).toBe(false);
  });

  it('blocks unparseable as safe default', () => {
    expect(isPrivateOrReservedIP('garbage')).toBe(true);
  });
});

describe('isInternalHostname / BLOCK_HOSTS', () => {
  it('blocks localhost variants', () => {
    expect(isInternalHostname('localhost')).toBe(true);
    expect(isInternalHostname('LOCALHOST')).toBe(true);
    expect(isInternalHostname('localhost.localdomain')).toBe(true);
    expect(BLOCK_HOSTS.has('localhost')).toBe(true);
  });

  it('blocks *.local / *.internal suffixes', () => {
    expect(isInternalHostname('printer.local')).toBe(true);
    expect(isInternalHostname('foo.bar.internal')).toBe(true);
  });

  it('blocks well-known cloud metadata hostnames', () => {
    expect(isInternalHostname('metadata.google.internal')).toBe(true);
    expect(isInternalHostname('169.254.169.254')).toBe(true);
  });

  it('allows normal public domains', () => {
    expect(isInternalHostname('example.com')).toBe(false);
    expect(isInternalHostname('www.google.co.jp')).toBe(false);
  });
});
