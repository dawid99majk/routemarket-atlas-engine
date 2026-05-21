export class SourceContentFetcher {
  constructor(private readonly userAgent: string = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36") {}

  async fetchText(url: string, timeoutMs = 15000, maxLength = 1024 * 1024): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers: { "User-Agent": this.userAgent, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      return this.cleanHtml(text).slice(0, maxLength);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private cleanHtml(html: string): string {
    // Very basic extraction: remove scripts, styles, head, tags, and excessive whitespace.
    let text = html;
    text = text.replace(new RegExp("<script\\\\b[^<]*(?:(?!<\\\\/script>)<[^<]*)*<\\\\/script>", "gi"), " ");
    text = text.replace(new RegExp("<style\\\\b[^<]*(?:(?!<\\\\/style>)<[^<]*)*<\\\\/style>", "gi"), " ");
    text = text.replace(new RegExp("<head\\\\b[^<]*(?:(?!<\\\\/head>)<[^<]*)*<\\\\/head>", "gi"), " ");
    text = text.replace(/<[^>]+>/g, " ");
    text = text.replace(/\\s{2,}/g, " ").trim();
    return text;
  }
}
