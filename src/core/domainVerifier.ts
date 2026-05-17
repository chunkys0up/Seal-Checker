import data from '../../devvit.json';

const allowlist = data.permissions.http.domains;

export function findUrls(text: string): string[] {
  return text.match(/https?:\/\/[^\s]+/g) ?? [];
}

export function categorizeDomains(urls: string[]): { verified: string[]; unverified: string[] } {
  const verified: string[] = [];
  const unverified: string[] = [];

  for (const url of urls) {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '');
      const matched = allowlist.find((d) => hostname === d || hostname.endsWith('.' + d));
      if (matched) {
        if (!verified.includes(matched)) verified.push(matched);
      } else {
        if (!unverified.includes(hostname)) unverified.push(hostname);
      }
    } catch {
      // skip malformed URLs
    }
  }

  return { verified, unverified };
}
