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
    '*This check was performed automatically. If you believe this is a mistake, please contact the moderators via modmail.*'
  );

  return lines.join('\n');
}
