import { createLogger } from "../lib/logger.js";
import { config } from "../lib/config.js";

const log = createLogger("NewsFeed");

export interface NewsItem {
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  relevanceScore?: number;
}

export class NewsFeed {
  private cache = new Map<string, { items: NewsItem[]; fetchedAt: number }>();
  private readonly TTL_MS = 10 * 60 * 1000; // 10 minutes

  async search(query: string): Promise<NewsItem[]> {
    const cached = this.cache.get(query);
    if (cached && Date.now() - cached.fetchedAt < this.TTL_MS) {
      log.debug("News cache hit", { query });
      return cached.items;
    }

    if (!config.NEWSAPI_KEY) {
      log.debug("No NEWSAPI_KEY — returning empty news context");
      return [];
    }

    try {
      const url = new URL("https://newsapi.org/v2/everything");
      url.searchParams.set("q", query);
      url.searchParams.set("sortBy", "publishedAt");
      url.searchParams.set("pageSize", "5");
      url.searchParams.set("language", "en");

      const res = await fetch(url.toString(), {
        headers: { "X-Api-Key": config.NEWSAPI_KEY },
      });

      if (!res.ok) {
        log.warn("News API error", { status: res.status });
        return [];
      }

      const data = (await res.json()) as {
        articles: Array<{
          title?: string;
          description?: string;
          source?: { name?: string };
          publishedAt?: string;
        }>;
      };

      const items: NewsItem[] = (data.articles ?? []).map((a) => ({
        title: a.title ?? "",
        summary: a.description ?? "",
        source: a.source?.name ?? "Unknown",
        publishedAt: a.publishedAt ?? "",
      }));

      this.cache.set(query, { items, fetchedAt: Date.now() });
      log.debug("News fetched", { query, count: items.length });
      return items;
    } catch (err) {
      log.error("News fetch failed", { query, err });
      return [];
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}
