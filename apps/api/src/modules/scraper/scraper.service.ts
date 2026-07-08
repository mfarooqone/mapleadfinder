import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { chromium, Locator, Page } from 'playwright';
import { DecisionMakerService } from '../leads/decision-maker.service';
import { LeadsService } from '../leads/leads.service';

export interface ScrapedLead {
  name: string;
  category?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  rating?: number | null;
  reviewsCount?: number | null;
}

export interface ScrapeResult {
  batchId: string;
  keyword: string;
  discovered: number;
  saved: number;
  leads: ScrapedLead[];
  decisionMakers?: {
    processed: number;
    found: number;
  };
}

export interface ScrapeProgress {
  percent: number;
  phase: string;
  totalListings?: number;
  processedListings?: number;
  discoveredLeads?: number;
  savedLeads?: number;
}

export type ScrapeProgressCallback = (
  progress: number | ScrapeProgress,
) => Promise<void>;

export type ScrapeStopCallback = () => Promise<boolean>;

type ListingTarget = {
  url: string;
  name?: string | null;
};

const EMAIL_PAGE_KEYWORDS = [
  'contact',
  'about',
  'team',
  'staff',
  'people',
  'leadership',
  'management',
  'clinic',
  'support',
  'enquir',
  'privacy',
];

const PLACEHOLDER_EMAIL_DOMAINS = new Set([
  'domain.com',
  'example.com',
  'example.org',
  'example.net',
  'invalid.com',
  'test.com',
]);

const PLACEHOLDER_EMAIL_PREFIXES = new Set([
  'example',
  'test',
  'testing',
  'sample',
  'demo',
  'user',
  'username',
  'name',
  'email',
  'yourname',
  'you',
]);

const GENERIC_EMAIL_PREFIXES = new Set([
  'admin',
  'appointment',
  'appointments',
  'bookings',
  'contact',
  'enquiries',
  'enquiry',
  'hello',
  'help',
  'info',
  'mail',
  'office',
  'reception',
  'support',
]);

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly leadsService: LeadsService,
    private readonly decisionMakerService: DecisionMakerService,
  ) {}

  createScrapeBatch(userId: string, keyword: string, maxRecords?: number) {
    return this.leadsService.createScrapeBatch(userId, keyword, maxRecords);
  }

  async enrichDecisionMakersForBatch(
    userId: string,
    batchId: string,
    onProgress?: ScrapeProgressCallback,
  ) {
    const leadIds = await this.leadsService.listLeadIdsForScrapeBatch(
      userId,
      batchId,
    );

    if (!leadIds.length) {
      await onProgress?.({
        percent: 100,
        phase: 'No saved leads to enrich',
        discoveredLeads: 0,
        savedLeads: 0,
      });
      return {
        processed: 0,
        found: 0,
      };
    }

    await onProgress?.({
      percent: 96,
      phase: 'Finding decision makers',
      totalListings: leadIds.length,
      processedListings: 0,
    });

    const result = await this.decisionMakerService.enrichLeads(userId, leadIds);

    await onProgress?.({
      percent: 99,
      phase: `Found ${result.found} decision-maker candidates`,
      totalListings: leadIds.length,
      processedListings: result.processed,
      discoveredLeads: result.processed,
      savedLeads: result.found,
    });

    return {
      processed: result.processed,
      found: result.found,
    };
  }

  async scrapeGoogleMaps(
    userId: string,
    keyword: string,
    maxRecords = 120,
    onProgress?: ScrapeProgressCallback,
    batchId?: string,
    shouldStop?: ScrapeStopCallback,
  ): Promise<ScrapeResult> {
    const recordLimit = Math.min(Math.max(Math.floor(maxRecords), 1), 500);
    const scrapeBatch =
      batchId ??
      (await this.leadsService.createScrapeBatch(userId, keyword, recordLimit))
        .id;
    const browser = await chromium.launch({
      headless: this.getHeadlessMode(),
      slowMo: this.getSlowMo(),
    });

    const leads: ScrapedLead[] = [];
    let savedCount = 0;

    try {
      const page = await browser.newPage();

      await onProgress?.({
        percent: 10,
        phase: 'Opening Google Maps',
        discoveredLeads: 0,
        processedListings: 0,
      });
      await this.openGoogleMapsSearch(page, keyword);
      await onProgress?.({
        percent: 20,
        phase: 'Loading search results',
        discoveredLeads: 0,
        processedListings: 0,
      });

      const feed = page.locator('div[role="feed"]').first();
      const hasFeed = await this.waitForVisible(feed, 30000);

      if (!hasFeed) {
        const lead = await this.extractLead(page);

        if (lead) {
          leads.push(lead);
          const saved = await this.leadsService.saveScrapedLeadsToBatch(
            userId,
            scrapeBatch,
            [this.toPrismaLead(lead)],
            keyword,
          );
          savedCount = saved.savedTotal;
        } else {
          throw new Error(
            'Google Maps results did not render business details',
          );
        }

        await onProgress?.({
          percent: 95,
          phase: 'Saved leads',
          totalListings: 1,
          processedListings: 1,
          discoveredLeads: leads.length,
          savedLeads: savedCount,
        });

        return {
          batchId: scrapeBatch,
          keyword,
          discovered: leads.length,
          saved: savedCount,
          leads,
        };
      }

      await onProgress?.({
        percent: 25,
        phase: 'Scrolling through results',
        totalListings: recordLimit,
        discoveredLeads: 0,
        processedListings: 0,
      });
      const listingTargets = await this.collectListingTargets(
        page,
        feed,
        recordLimit,
      );
      const listings = page.locator('div[role="article"]');
      const listingCount = await listings.count();
      const listingsToProcess = Math.min(
        listingTargets.length || listingCount,
        recordLimit,
      );
      await onProgress?.({
        percent: 35,
        phase: 'Processing listings',
        totalListings: listingsToProcess,
        processedListings: 0,
        discoveredLeads: 0,
      });

      for (let index = 0; index < listingsToProcess; index += 1) {
        if (await shouldStop?.()) {
          await onProgress?.({
            percent: Math.min(
              90,
              35 + Math.round((index / listingsToProcess) * 55),
            ),
            phase: 'Stopped - saved scraped records',
            totalListings: listingsToProcess,
            processedListings: index,
            discoveredLeads: leads.length,
            savedLeads: savedCount,
          });
          const partialLeads = this.uniqueLeads(leads);
          return {
            batchId: scrapeBatch,
            keyword,
            discovered: partialLeads.length,
            saved: savedCount,
            leads: partialLeads,
          };
        }

        try {
          const target = listingTargets[index];
          let listingName = target?.name;

          if (target?.url) {
            await page.goto(target.url, {
              waitUntil: 'domcontentloaded',
              timeout: 60000,
            });
            await this.waitForVisible(page.locator('h1').first(), 15000);
          } else {
            const listing = listings.nth(index);
            listingName = await this.extractListingName(listing);
            await this.openListingDetails(page, listing);
          }

          const lead = await this.extractLead(page, listingName);

          if (lead) {
            leads.push(lead);
            const saved = await this.leadsService.saveScrapedLeadsToBatch(
              userId,
              scrapeBatch,
              [this.toPrismaLead(lead)],
              keyword,
            );
            savedCount = saved.savedTotal;
          }
        } catch (error) {
          this.logger.warn(
            `Skipping listing ${index + 1}/${listingCount}: ${this.errorMessage(error)}`,
          );
        }

        if (listingsToProcess > 0) {
          await onProgress?.({
            percent: Math.min(
              90,
              35 + Math.round(((index + 1) / listingsToProcess) * 55),
            ),
            phase: 'Processing listings',
            totalListings: listingsToProcess,
            processedListings: index + 1,
            discoveredLeads: leads.length,
            savedLeads: savedCount,
          });
        }
      }

      const uniqueLeads = this.uniqueLeads(leads);
      await onProgress?.({
        percent: 95,
        phase: 'Saved leads',
        totalListings: listingsToProcess,
        processedListings: listingsToProcess,
        discoveredLeads: uniqueLeads.length,
        savedLeads: savedCount,
      });

      return {
        batchId: scrapeBatch,
        keyword,
        discovered: uniqueLeads.length,
        saved: savedCount,
        leads: uniqueLeads,
      };
    } finally {
      if (!this.shouldKeepBrowserOpen()) {
        await browser.close();
      }
    }
  }

  private async collectListingTargets(
    page: Page,
    feed: Locator,
    maxRecords: number,
  ) {
    const targets = new Map<string, ListingTarget>();
    let previousCount = 0;
    let stableRounds = 0;
    const maxScrollAttempts = Math.max(12, Math.ceil(maxRecords / 12));

    for (
      let attempt = 0;
      attempt < maxScrollAttempts && stableRounds < 8;
      attempt += 1
    ) {
      await this.rememberVisibleListingTargets(page, targets, maxRecords);
      if (targets.size >= maxRecords) {
        break;
      }

      await feed.evaluate((el) =>
        el.scrollBy(0, Math.max(3000, el.clientHeight * 3)),
      );
      await page.waitForTimeout(2000);
      await this.rememberVisibleListingTargets(page, targets, maxRecords);

      const currentCount = await page.locator('div[role="article"]').count();
      const progressCount = Math.max(currentCount, targets.size);

      if (progressCount === previousCount) {
        stableRounds++;
      } else {
        stableRounds = 0;
        previousCount = progressCount;
      }
    }

    return [...targets.values()].slice(0, maxRecords);
  }

  private async rememberVisibleListingTargets(
    page: Page,
    targets: Map<string, ListingTarget>,
    maxRecords: number,
  ) {
    const visibleTargets = await page
      .locator('div[role="article"]')
      .evaluateAll((articles) =>
        articles
          .map((article) => {
            const anchor = article.querySelector<HTMLAnchorElement>(
              'a[href*="/maps/place/"], a[href*="google.com/maps/place/"]',
            );
            const href = anchor?.href;
            if (!href) return null;

            const ariaLabel =
              anchor.getAttribute('aria-label') ||
              article.getAttribute('aria-label') ||
              '';
            const text =
              ariaLabel ||
              article.querySelector('[aria-label]')?.getAttribute('aria-label') ||
              article.textContent ||
              '';

            return {
              url: href,
              name: text.split('\n')[0]?.trim() || null,
            };
          })
          .filter(
            (target): target is { url: string; name: string | null } =>
              Boolean(target?.url),
          ),
      )
      .catch(() => [] as ListingTarget[]);

    for (const target of visibleTargets) {
      if (targets.size >= maxRecords) {
        return;
      }

      try {
        const normalizedUrl = new URL(target.url, page.url());
        normalizedUrl.search = '';
        targets.set(normalizedUrl.toString(), {
          url: normalizedUrl.toString(),
          name: target.name,
        });
      } catch {
        // Ignore malformed listing links and continue collecting.
      }
    }
  }

  private async openGoogleMapsSearch(page: Page, keyword: string) {
    await page.goto(
      `https://www.google.com/maps/search/${encodeURIComponent(keyword)}`,
      {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      },
    );

    await this.acceptGoogleConsent(page);

    if (
      (await this.waitForVisible(
        page.locator('div[role="feed"]').first(),
        15000,
      )) ||
      (await this.waitForVisible(page.locator('h1').first(), 5000))
    ) {
      return;
    }

    const searchBox = page.locator('input#searchboxinput').first();

    if (!(await this.waitForVisible(searchBox, 10000))) {
      throw new Error('Google Maps search box did not load');
    }

    await searchBox.fill(keyword);
    await page.keyboard.press('Enter');
  }

  private async acceptGoogleConsent(page: Page) {
    const consentButtons = [
      page.getByRole('button', { name: /accept all/i }).first(),
      page.getByRole('button', { name: /i agree/i }).first(),
      page.getByRole('button', { name: /reject all/i }).first(),
    ];

    for (const button of consentButtons) {
      if (await this.waitForVisible(button, 3000)) {
        await button.click();
        await page.waitForLoadState('domcontentloaded').catch(() => undefined);
        return;
      }
    }
  }

  private async extractLead(
    page: Page,
    listingName?: string | null,
  ): Promise<ScrapedLead | null> {
    const headingName = await this.safeText(page.locator('h1').first(), 5000);
    const name = this.isGenericHeading(headingName) ? listingName : headingName;

    if (!name) {
      return null;
    }

    const ratingLabel = await this.safeAttribute(
      page.locator('div[role="img"][aria-label*="stars"]').first(),
      'aria-label',
    );
    const reviewsText = await this.firstText([
      page.locator('button[jsaction*="pane.rating.moreReviews"]').first(),
      page.locator('span[aria-label*="reviews"]').first(),
    ]);
    const categoryText = await this.firstText([
      page.locator('button[jsaction*="pane.rating.category"]').first(),
      page.locator('button[aria-label^="Category:"]').first(),
      page.locator('.DkEaL').first(),
    ]);
    const addressText =
      (await this.firstAttribute(
        [
          page.locator('button[data-item-id="address"]').first(),
          page.locator('button[aria-label^="Address:"]').first(),
        ],
        'aria-label',
      )) ??
      (await this.firstText([
        page.locator('button[data-item-id="address"]').first(),
      ]));
    const phoneText =
      (await this.firstAttribute(
        [
          page.locator('button[data-item-id^="phone:tel:"]').first(),
          page.locator('button[aria-label^="Phone:"]').first(),
        ],
        'aria-label',
      )) ??
      (await this.firstText([
        page.locator('button[data-item-id^="phone:tel:"]').first(),
      ]));
    const website =
      (await this.firstAttribute(
        [
          page.locator('a[data-item-id="authority"]').first(),
          page.locator('a[aria-label^="Website:"]').first(),
        ],
        'href',
      )) ??
      this.stripKnownLabel(
        await this.firstAttribute(
          [page.locator('a[aria-label^="Website:"]').first()],
          'aria-label',
        ),
        ['Website:'],
      );
    const normalizedWebsite = this.cleanWebsiteUrl(
      this.normalizeNullable(website),
    );
    const email = await this.extractEmailFromWebsite(page, normalizedWebsite);

    return {
      name,
      category: this.stripKnownLabel(categoryText, ['Category:']),
      address: this.stripKnownLabel(addressText, ['Address:']),
      phone: this.stripKnownLabel(phoneText, ['Phone:']),
      email,
      website: normalizedWebsite,
      rating: this.parseRating(ratingLabel),
      reviewsCount: this.parseReviewsCount(reviewsText ?? ratingLabel),
    };
  }

  private toPrismaLead(
    lead: ScrapedLead,
  ): Omit<Prisma.LeadCreateManyInput, 'userId'> {
    return {
      name: lead.name,
      category: lead.category,
      address: lead.address,
      phone: lead.phone,
      email: lead.email,
      website: lead.website,
      rating: lead.rating,
      reviewsCount: lead.reviewsCount,
    };
  }

  private uniqueLeads(leads: ScrapedLead[]) {
    const byIdentity = new Map<string, ScrapedLead>();

    for (const lead of leads) {
      const normalizedWebsite = this.cleanWebsiteUrl(lead.website ?? null);
      const key =
        lead.phone ??
        normalizedWebsite ??
        [lead.name.toLowerCase(), lead.address?.toLowerCase() ?? ''].join('|');

      const existing = byIdentity.get(key);
      byIdentity.set(key, existing ? this.mergeLead(existing, lead) : lead);
    }

    return [...byIdentity.values()];
  }

  private mergeLead(existing: ScrapedLead, incoming: ScrapedLead): ScrapedLead {
    return {
      ...existing,
      ...Object.fromEntries(
        Object.entries(incoming).filter(
          ([, value]) => value !== null && value !== undefined && value !== '',
        ),
      ),
    };
  }

  private async firstText(locators: Locator[]) {
    for (const locator of locators) {
      const value = await this.safeText(locator);

      if (value) {
        return value;
      }
    }

    return null;
  }

  private async firstAttribute(locators: Locator[], attribute: string) {
    for (const locator of locators) {
      const value = await this.safeAttribute(locator, attribute);

      if (value) {
        return value;
      }
    }

    return null;
  }

  private async extractEmailFromWebsite(page: Page, website: string | null) {
    const websiteUrl = this.toWebsiteUrl(website);

    if (!websiteUrl) {
      return null;
    }

    const visited = new Set<string>();
    const pending = [websiteUrl];
    const discoveredEmails = new Set<string>();

    while (pending.length > 0 && visited.size < 8) {
      const url = pending.shift();

      if (!url || visited.has(url)) {
        continue;
      }

      visited.add(url);

      try {
        const response = await page.context().request.get(url, {
          timeout: 10000,
          headers: {
            Accept: 'text/html,application/xhtml+xml',
          },
        });

        if (!response.ok()) {
          continue;
        }

        const contentType = response.headers()['content-type'] ?? '';

        if (!contentType.toLowerCase().includes('text/html')) {
          continue;
        }

        const html = await response.text();
        this.extractEmailsFromText(html).forEach((email) =>
          discoveredEmails.add(email),
        );

        const bestEmail = this.pickBestEmail([...discoveredEmails], websiteUrl);
        if (bestEmail && this.emailScore(bestEmail, websiteUrl) >= 70) {
          return bestEmail;
        }

        pending.push(...this.extractContactUrls(html, url, websiteUrl));
      } catch (error) {
        this.logger.debug(
          `Could not extract email from ${url}: ${this.errorMessage(error)}`,
        );
      }
    }

    return this.pickBestEmail([...discoveredEmails], websiteUrl);
  }

  private extractEmailsFromText(value: string) {
    const normalizedValue = value
      .replace(/\s*(?:\[at\]|\(at\)|\sat\s)\s*/gi, '@')
      .replace(/\s*(?:\[dot\]|\(dot\)|\sdot\s)\s*/gi, '.')
      .replace(/&#64;|&commat;/gi, '@')
      .replace(/&#46;|&period;/gi, '.');
    const emails = normalizedValue.match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    );

    if (!emails) {
      return [];
    }

    return [
      ...new Set(
        emails
          .map((candidate) =>
            candidate
              .replace(/^mailto:/i, '')
              .split('?')[0]
              .trim()
              .toLowerCase(),
          )
          .filter((candidate) => {
            const lower = candidate.toLowerCase();

            return (
              this.isUsableEmail(lower) &&
              !lower.endsWith('.png') &&
              !lower.endsWith('.jpg') &&
              !lower.endsWith('.jpeg') &&
              !lower.endsWith('.gif') &&
              !lower.endsWith('.webp') &&
              !lower.includes('@2x.')
            );
          }),
      ),
    ];
  }

  private pickBestEmail(emails: string[], websiteUrl: string) {
    return (
      emails
        .filter((email) => this.isUsableEmail(email))
        .sort(
          (first, second) =>
            this.emailScore(second, websiteUrl) -
            this.emailScore(first, websiteUrl),
        )[0] ?? null
    );
  }

  private isUsableEmail(email: string) {
    const match = email.match(/^([^@\s]+)@([^@\s]+\.[^@\s]+)$/);
    if (!match) return false;

    const local = match[1].toLowerCase();
    const domain = match[2].toLowerCase();

    return (
      !PLACEHOLDER_EMAIL_DOMAINS.has(domain) &&
      !PLACEHOLDER_EMAIL_PREFIXES.has(local) &&
      !domain.endsWith('.example') &&
      !domain.includes('yourdomain') &&
      !local.includes('example') &&
      !local.includes('yourname')
    );
  }

  private emailScore(email: string, websiteUrl: string) {
    const [, local, domain] =
      email.match(/^([^@\s]+)@([^@\s]+\.[^@\s]+)$/) ?? [];

    if (!local || !domain) return 0;

    let score = 50;
    const websiteHost = new URL(websiteUrl).hostname.replace(/^www\./i, '');

    if (domain === websiteHost || websiteHost.endsWith(`.${domain}`)) {
      score += 30;
    }

    if (GENERIC_EMAIL_PREFIXES.has(local.toLowerCase())) {
      score -= 15;
    } else {
      score += 20;
    }

    if (/(owner|founder|director|manager|clinic|practice)/i.test(local)) {
      score += 15;
    }

    return score;
  }

  private extractContactUrls(
    html: string,
    currentUrl: string,
    websiteUrl: string,
  ) {
    const urls = new Set<string>();
    const websiteOrigin = new URL(websiteUrl).origin;
    const linkPattern = /href=["']([^"']+)["']/gi;
    let match: RegExpExecArray | null;

    while ((match = linkPattern.exec(html)) !== null && urls.size < 8) {
      const href = match[1];

      if (
        !EMAIL_PAGE_KEYWORDS.some((keyword) =>
          href.toLowerCase().includes(keyword),
        )
      ) {
        continue;
      }

      try {
        const url = new URL(href, currentUrl);

        if (
          url.origin === websiteOrigin &&
          ['http:', 'https:'].includes(url.protocol)
        ) {
          urls.add(url.toString());
        }
      } catch {
        continue;
      }
    }

    return [...urls];
  }

  private async openListingDetails(page: Page, listing: Locator) {
    await listing
      .scrollIntoViewIfNeeded({ timeout: 5000 })
      .catch(() => undefined);
    await listing.click({ timeout: 7000 });
    await page.waitForTimeout(1200);
    await page
      .locator('h1')
      .first()
      .waitFor({ state: 'visible', timeout: 7000 })
      .catch(() => undefined);
  }

  private cleanWebsiteUrl(website: string | null) {
    const url = this.toWebsiteUrl(website);
    if (!url) return null;

    try {
      const parsed = new URL(url);
      [
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_term',
        'utm_content',
        'gclid',
        'fbclid',
      ].forEach((param) => parsed.searchParams.delete(param));
      parsed.hash = '';

      return parsed.toString();
    } catch {
      return url;
    }
  }

  private toWebsiteUrl(website: string | null) {
    if (!website) {
      return null;
    }

    try {
      const url = new URL(
        /^https?:\/\//i.test(website) ? website : `https://${website}`,
      );

      return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
    } catch {
      return null;
    }
  }

  private async extractListingName(listing: Locator) {
    const ariaLabel = await this.safeAttribute(listing, 'aria-label');

    if (ariaLabel && !this.isGenericHeading(ariaLabel)) {
      return ariaLabel;
    }

    const text = await this.safeText(listing);

    if (!text) {
      return null;
    }

    const firstLine = text
      .split(/\r?\n/)
      .map((line) => this.normalizeNullable(line))
      .find((line): line is string => Boolean(line));

    return firstLine && !this.isGenericHeading(firstLine) ? firstLine : null;
  }

  private async waitForVisible(locator: Locator, timeout: number) {
    try {
      await locator.waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }

  private async safeText(locator: Locator, timeout = 1500) {
    try {
      const value = await locator.textContent({ timeout });

      return this.normalizeNullable(value);
    } catch {
      return null;
    }
  }

  private async safeAttribute(
    locator: Locator,
    attribute: string,
    timeout = 1500,
  ) {
    try {
      const value = await locator.getAttribute(attribute, { timeout });

      return this.normalizeNullable(value);
    } catch {
      return null;
    }
  }

  private stripKnownLabel(value: string | null, labels: string[]) {
    const normalized = this.normalizeNullable(value);

    if (!normalized) {
      return null;
    }

    for (const label of labels) {
      if (normalized.toLowerCase().startsWith(label.toLowerCase())) {
        return this.normalizeNullable(normalized.slice(label.length));
      }
    }

    return normalized;
  }

  private parseRating(label: string | null) {
    const match = label?.match(/(\d+(?:\.\d+)?)\s*stars?/i);
    const rating = match ? Number(match[1]) : null;

    return rating !== null && Number.isFinite(rating) ? rating : null;
  }

  private parseReviewsCount(label: string | null) {
    const match = label?.match(/([\d,]+)\s*reviews?/i);
    const reviewsCount = match ? Number(match[1].replace(/,/g, '')) : null;

    return reviewsCount !== null && Number.isFinite(reviewsCount)
      ? reviewsCount
      : null;
  }

  private normalizeNullable(value?: string | null) {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = value.replace(/\s+/g, ' ').trim();

    return normalized.length > 0 ? normalized : null;
  }

  private isGenericHeading(value?: string | null) {
    const normalized = this.normalizeNullable(value)?.toLowerCase();

    return !normalized || ['results', 'google maps'].includes(normalized);
  }

  private getHeadlessMode() {
    return (
      this.configService.get<string>('SCRAPER_HEADLESS', 'false') === 'true'
    );
  }

  private getSlowMo() {
    const slowMo = Number(
      this.configService.get<string>('SCRAPER_SLOW_MO', '0'),
    );

    return Number.isFinite(slowMo) && slowMo > 0 ? slowMo : undefined;
  }

  private shouldKeepBrowserOpen() {
    return (
      this.configService.get<string>('SCRAPER_KEEP_BROWSER_OPEN', 'false') ===
      'true'
    );
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
