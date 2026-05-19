import defaultAllowlist from './verifiedDomains.json';
import { settings } from '@devvit/web/server';

export async function getEffectiveAllowlist(): Promise<string[]> {
  const customDomains = (await settings.get<string>('customDomains'))
    ?.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean) ?? [];
  const overwriteDefaults = await settings.get<boolean>('overwriteDefaultDomains') ?? false;
  return overwriteDefaults ? customDomains : [...defaultAllowlist, ...customDomains];
}

export function findUrls(text: string): string[] {
  const urls = new Set<string>();

  // extract hrefs from markdown links [text](url) first
  for (const match of text.matchAll(/\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)) {
    if (match[1]) urls.add(match[1].replace(/\/$/, ''));
  }

  // strip markdown links then find remaining bare URLs
  const stripped = text.replace(/\[[^\]]*\]\(https?:\/\/[^)\s]+\)/g, '');
  for (const url of stripped.match(/https?:\/\/[^\s)]+/g) ?? []) {
    urls.add(url.replace(/\/$/, ''));
  }

  return Array.from(urls);
}

export function categorizeDomains(urls: string[], effectiveAllowlist: string[] = defaultAllowlist): { verified: string[]; unverified: string[] } {
  const verified: string[] = [];
  const unverified: string[] = [];

  for (const url of urls) {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '');
      const matched = effectiveAllowlist.find((d: string) => hostname === d || hostname.endsWith('.' + d));
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
