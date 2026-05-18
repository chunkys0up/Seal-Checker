async function getContent(url: string): Promise<string | null> {
  const response = await fetch(url);

  if (!response.ok) return null;

  const html = await response.text();
  const text = html
    .replace(/<[^>]*>/g, ' ') // strip HTML tags
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim();

  const truncated = text.split(/\s+/).slice(0, 300).join(' ');
  return truncated;
}
