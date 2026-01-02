export interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid?: string;
  author?: string;
  content?: string;
}

/**
 * 解析 RSS 2.0 或 Atom feed
 */
export function parseRSS(xml: string, maxItems = 50): RSSItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  // 检查是否是 Atom
  const isAtom = doc.querySelector('feed') !== null;

  if (isAtom) {
    return parseAtom(doc, maxItems);
  }

  return parseRSS2(doc, maxItems);
}

function parseRSS2(doc: Document, maxItems: number): RSSItem[] {
  const items: RSSItem[] = [];
  const itemElements = doc.querySelectorAll('item');

  for (let i = 0; i < Math.min(itemElements.length, maxItems); i++) {
    const item = itemElements[i];
    items.push({
      title: getTextContent(item, 'title'),
      link: getTextContent(item, 'link'),
      description: getTextContent(item, 'description'),
      pubDate: getTextContent(item, 'pubDate'),
      guid: getTextContent(item, 'guid') || undefined,
      author: getTextContent(item, 'author') || getTextContent(item, 'dc\\:creator') || undefined,
      content: getTextContent(item, 'content\\:encoded') || undefined,
    });
  }

  return items;
}

function parseAtom(doc: Document, maxItems: number): RSSItem[] {
  const items: RSSItem[] = [];
  const entries = doc.querySelectorAll('entry');

  for (let i = 0; i < Math.min(entries.length, maxItems); i++) {
    const entry = entries[i];
    const linkEl = entry.querySelector('link');

    items.push({
      title: getTextContent(entry, 'title'),
      link: linkEl?.getAttribute('href') || '',
      description: getTextContent(entry, 'summary') || getTextContent(entry, 'content'),
      pubDate: getTextContent(entry, 'published') || getTextContent(entry, 'updated'),
      guid: getTextContent(entry, 'id') || undefined,
      author: getTextContent(entry, 'author name') || undefined,
      content: getTextContent(entry, 'content') || undefined,
    });
  }

  return items;
}

function getTextContent(parent: Element, selector: string): string {
  return parent.querySelector(selector)?.textContent?.trim() || '';
}
