import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LOCALES } from '@agrobridge/shared';

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const INDEXNOW_TIMEOUT_MS = 10_000;
const PUBLIC_RECORD_ID = /^[a-zA-Z0-9_-]{8,128}$/;

type PublicPath = 'products' | 'farms' | 'requests';

/**
 * Tells Bing about one public URL in every locale. Disabled unless production
 * is explicitly opted in. Failures are logged and never thrown to callers.
 */
@Injectable()
export class IndexNowService {
  private readonly logger = new Logger(IndexNowService.name);
  private fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis);

  constructor(private readonly config: ConfigService) {}

  /** Tests replace the HTTP client so api.indexnow.org is never contacted. */
  setFetchForTests(fetchImpl: typeof fetch): void {
    this.fetchImpl = fetchImpl;
  }

  submitProduct(id: string): Promise<void> {
    return this.submit('products', id);
  }

  submitFarm(id: string): Promise<void> {
    return this.submit('farms', id);
  }

  submitPurchaseRequest(id: string): Promise<void> {
    return this.submit('requests', id);
  }

  private async submit(path: PublicPath, id: string): Promise<void> {
    try {
      if (!this.isEnabled()) return;
      const recordId = id.trim();
      if (!PUBLIC_RECORD_ID.test(recordId)) return;

      const key = this.config.get<string>('INDEXNOW_KEY')?.trim() ?? '';
      const origin = this.webOrigin();
      if (!key || !origin) return;

      const urlList = LOCALES.map((locale) => `${origin}/${locale}/${path}/${recordId}`);
      const host = new URL(origin).host;
      const response = await this.fetchImpl(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          host,
          key,
          keyLocation: `${origin}/${key}.txt`,
          urlList,
        }),
        signal: AbortSignal.timeout(INDEXNOW_TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logFailure(`${path} ${recordId} status ${response.status}`);
      }
    } catch (error) {
      this.logFailure(`${path} ${id.trim()} ${error instanceof Error ? error.name : 'Error'}`);
    }
  }

  private isEnabled(): boolean {
    const key = this.config.get<string>('INDEXNOW_KEY')?.trim() ?? '';
    return (
      process.env.NODE_ENV === 'production' &&
      this.config.get<string>('INDEXNOW_ENABLED') === 'true' &&
      key.length > 0 &&
      this.webOrigin() !== null
    );
  }

  private webOrigin(): string | null {
    const raw = this.config.get<string>('WEB_PUBLIC_URL')?.trim() ?? '';
    if (!raw) return null;
    try {
      const url = new URL(raw);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      return url.origin;
    } catch {
      return null;
    }
  }

  private logFailure(detail: string): void {
    const key = this.config.get<string>('INDEXNOW_KEY')?.trim() ?? '';
    const safe = key ? detail.split(key).join('[redacted]') : detail;
    this.logger.warn(`IndexNow notification failed: ${safe}`);
  }
}
