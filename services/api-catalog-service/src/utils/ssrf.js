'use strict';

const net = require('net');
const config = require('../config/env');
const AppError = require('./AppError');

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'metadata.goog',
]);

function isPrivateOrReservedIpv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateOrReservedIpv6(ip) {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('::ffff:')) {
    const v4 = normalized.slice(7);
    if (net.isIPv4(v4)) return isPrivateOrReservedIpv4(v4);
  }
  if (/^(fc|fd)[0-9a-f]{2}:/.test(normalized)) return true; // Unique local fc00::/7
  if (/^fe[89ab][0-9a-f]:/.test(normalized)) return true; // Link-local fe80::/10
  return false;
}

/**
 * Validates an upstream target URL against SSRF and protocol policies.
 * @param {string} rawUrl
 * @param {{ requireHttpsInProd?: boolean }} [options]
 * @returns {string} Normalized URL string
 */
function validateTargetUrl(rawUrl, { requireHttpsInProd = true } = {}) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new AppError('URL must be a non-empty string', 400, 'INVALID_URL');
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new AppError('Invalid URL format', 400, 'INVALID_URL');
  }

  const allowedProtocols =
    requireHttpsInProd && config.nodeEnv === 'production'
      ? ['https:']
      : ['https:', 'http:'];

  if (!allowedProtocols.includes(parsed.protocol)) {
    throw new AppError(
      config.nodeEnv === 'production'
        ? 'Target URL must use https:// in production'
        : 'Target URL must use http:// or https://',
      400,
      'INVALID_URL_PROTOCOL'
    );
  }

  if (parsed.username || parsed.password) {
    throw new AppError('Target URL must not contain embedded credentials', 400, 'INVALID_URL');
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname || BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new AppError('Target URL hostname is not allowed', 400, 'SSRF_BLOCKED');
  }

  const ipType = net.isIP(hostname);
  if (ipType === 4 && isPrivateOrReservedIpv4(hostname)) {
    throw new AppError('Target URL points to a forbidden private or local IPv4 address', 400, 'SSRF_BLOCKED');
  }
  if (ipType === 6 && isPrivateOrReservedIpv6(hostname)) {
    throw new AppError('Target URL points to a forbidden private or local IPv6 address', 400, 'SSRF_BLOCKED');
  }

  return parsed.toString().replace(/\/$/, '');
}

module.exports = {
  validateTargetUrl,
  isPrivateOrReservedIpv4,
  isPrivateOrReservedIpv6,
};
