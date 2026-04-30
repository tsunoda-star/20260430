import * as cheerio from 'cheerio';

/**
 * HTML からの軽量抽出 (公開情報のみ)。
 * spec.md §4.1 + §8.2 で LLM estimation の入力に使う。
 */

export interface CrawlExtraction {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  h1: string[];
  /** body innerText (タグ除去 + 連続空白圧縮) を 4000 文字で trim */
  textSnippet: string;
}

const TEXT_SNIPPET_LIMIT = 4000;

export function extract(html: string): CrawlExtraction {
  const $ = cheerio.load(html);
  // script/style/noscript はテキスト抽出から除外
  $('script, style, noscript, template').remove();

  const title = $('title').first().text().trim();
  const description = $('meta[name="description"]').attr('content')?.trim() ?? '';
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() ?? '';
  const ogDescription = $('meta[property="og:description"]').attr('content')?.trim() ?? '';

  const h1: string[] = [];
  $('h1').each((_, el) => {
    const t = $(el).text().trim();
    if (t.length > 0) h1.push(t);
  });

  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const textSnippet =
    bodyText.length > TEXT_SNIPPET_LIMIT ? bodyText.slice(0, TEXT_SNIPPET_LIMIT) : bodyText;

  return { title, description, ogTitle, ogDescription, h1, textSnippet };
}
