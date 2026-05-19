export function buildURLVerifiedComment(
  verifiedDomains: string[],
  unverifiedDomains: string[]
): string {
  const lines: string[] = [];

  if (verifiedDomains.length > 0) {
    lines.push('**Verified sources:**');
    verifiedDomains.forEach((d) => lines.push(`- ${d}`));
    lines.push('');
  }

  if (unverifiedDomains.length > 0) {
    lines.push('**Unverified sources:**');
    unverifiedDomains.forEach((d) => lines.push(`- ${d}`));
    lines.push('');
  }

  lines.push('---');
  lines.push(
    '*This check was performed automatically. If any of your unverified sources are from a reputable domain, please contact the moderators via modmail to have it added to the verified domains list.*'
  );

  return lines.join('\n');
}
