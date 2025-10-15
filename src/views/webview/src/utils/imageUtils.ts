/**
 * Convert various image URL formats to ordfs.network URLs
 * Handles: txid_vout, /txid_vout, b://txid_vout, ord://txid, data URIs, https URLs
 */

const ORDFS_URL = 'https://ordfs.network';

export function normalizeImageUrl(url: string | undefined | null): string | null {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return null;
  }

  const trimmedUrl = url.trim();

  console.log('[normalizeImageUrl] Input:', trimmedUrl);

  // 1. Data URI - return as-is
  if (trimmedUrl.startsWith('data:')) {
    console.log('[normalizeImageUrl] Data URI detected, returning as-is');
    return trimmedUrl;
  }

  // 2. Full HTTPS URL - return as-is
  if (trimmedUrl.startsWith('https://') || trimmedUrl.startsWith('http://')) {
    console.log('[normalizeImageUrl] HTTP(S) URL detected, returning as-is');
    return trimmedUrl;
  }

  // 3. b:// protocol (b://txid_vout or b://txid.vout)
  if (trimmedUrl.startsWith('b://')) {
    const path = trimmedUrl.slice(4); // Remove 'b://'
    const result = path && path.length > 0 ? `${ORDFS_URL}/${path}` : null;
    console.log('[normalizeImageUrl] b:// protocol, result:', result);
    return result;
  }

  // 4. ord:// protocol (ord://txid or ord://txid_vout or ord://txid.vout or ord://txido<vout>)
  if (trimmedUrl.startsWith('ord://')) {
    const path = trimmedUrl.slice(6); // Remove 'ord://'
    const result = path && path.length > 0 ? `${ORDFS_URL}/${path}` : null;
    console.log('[normalizeImageUrl] ord:// protocol, result:', result);
    return result;
  }

  // 5. Relative path starting with / (/txid_vout or /txid)
  if (trimmedUrl.startsWith('/')) {
    const path = trimmedUrl.slice(1);
    const result = path && path.length > 0 ? `${ORDFS_URL}/${path}` : null;
    console.log('[normalizeImageUrl] Relative path with /, result:', result);
    return result;
  }

  // 6. Just a txid or txid_vout (no protocol or slash)
  // Assume it's a valid txid format and prepend ordfs
  if (trimmedUrl.match(/^[a-f0-9]{64}(_\d+)?$/i)) {
    const result = `${ORDFS_URL}/${trimmedUrl}`;
    console.log('[normalizeImageUrl] Bare txid detected, result:', result);
    return result;
  }

  // 7. Fallback - try prepending ordfs anyway
  const result = `${ORDFS_URL}/${trimmedUrl}`;
  console.log('[normalizeImageUrl] Fallback, prepending ordfs, result:', result);
  return result;
}

/**
 * Get a display-ready image URL with proper fallback
 */
export function getDisplayImageUrl(url: string | undefined | null): string | null {
  return normalizeImageUrl(url);
}
