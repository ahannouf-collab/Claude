export function detectSite(rawUrl) {
  let hostname;
  try {
    hostname = new URL(rawUrl).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
  if (hostname === 'scribd.com') return 'scribd';
  if (hostname === 'calameo.com') return 'calameo';
  return null;
}
