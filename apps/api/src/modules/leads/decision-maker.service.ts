import { Injectable, NotFoundException } from '@nestjs/common';
import { Lead } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type Candidate = {
  name?: string | null;
  title?: string | null;
  email?: string | null;
  emailType: string;
  confidence: number;
  sourceUrl: string;
  sourceText?: string | null;
};

type EnrichmentResult = {
  leadId: string;
  name: string | null;
  website: string | null;
  best: Candidate | null;
  candidates: Candidate[];
  note: string;
};

const TARGET_TITLE_PATTERNS = [
  /owner/i,
  /founder/i,
  /co[-\s]?founder/i,
  /director/i,
  /managing director/i,
  /clinic manager/i,
  /practice manager/i,
  /marketing manager/i,
  /practice administrator/i,
  /clinic administrator/i,
  /operations manager/i,
];

const PAGE_PATHS = [
  '/',
  '/about',
  '/about-us',
  '/team',
  '/our-team',
  '/meet-the-team',
  '/meet-the-staff',
  '/contact',
  '/contact-us',
  '/leadership',
  '/management',
];

const GENERIC_PREFIXES = new Set([
  'admin',
  'appointment',
  'appointments',
  'book',
  'booking',
  'bookings',
  'care',
  'clinic',
  'contact',
  'enquiries',
  'enquiry',
  'hello',
  'help',
  'info',
  'mail',
  'office',
  'patient',
  'patients',
  'reception',
  'sales',
  'support',
  'team',
]);

@Injectable()
export class DecisionMakerService {
  constructor(private readonly prisma: PrismaService) {}

  async enrichLeads(userId: string, leadIds: string[]) {
    const uniqueIds = [...new Set(leadIds.map((id) => id.trim()))].filter(Boolean);
    const leads = await this.prisma.lead.findMany({
      where: { userId, id: { in: uniqueIds }, isDeleted: false },
    });

    if (!leads.length) {
      throw new NotFoundException('No matching contacts were found.');
    }

    const results: EnrichmentResult[] = [];
    for (const lead of leads) {
      results.push(await this.enrichLead(userId, lead));
    }

    return {
      processed: results.length,
      found: results.filter((result) => result.best).length,
      results,
    };
  }

  async listForLead(userId: string, leadId: string) {
    return this.prisma.leadDecisionMaker.findMany({
      where: { userId, leadId },
      orderBy: [{ isBest: 'desc' }, { confidence: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  private async enrichLead(userId: string, lead: Lead): Promise<EnrichmentResult> {
    const baseUrl = this.normalizeUrl(lead.website);
    if (!baseUrl) {
      await this.clearBest(userId, lead.id);
      return {
        leadId: lead.id,
        name: lead.name,
        website: lead.website,
        best: null,
        candidates: [],
        note: 'No website available.',
      };
    }

    const pages = await this.fetchCandidatePages(baseUrl);
    const candidates = this.rankCandidates([
      ...this.extractCandidatesFromPages(pages),
      ...this.fallbackEmailCandidates(pages, lead),
    ]);

    await this.prisma.leadDecisionMaker.deleteMany({
      where: { userId, leadId: lead.id },
    });

    const best = candidates[0] ?? null;
    if (candidates.length) {
      await this.prisma.leadDecisionMaker.createMany({
        data: candidates.slice(0, 10).map((candidate, index) => ({
          userId,
          leadId: lead.id,
          name: candidate.name ?? null,
          title: candidate.title ?? null,
          email: candidate.email ?? null,
          emailType: candidate.emailType,
          confidence: candidate.confidence,
          sourceUrl: candidate.sourceUrl,
          sourceText: candidate.sourceText
            ? candidate.sourceText.slice(0, 500)
            : null,
          isBest: index === 0,
        })),
      });
    }

    await this.updateLeadQualityFromDecisionMaker(userId, lead, best);

    return {
      leadId: lead.id,
      name: lead.name,
      website: lead.website,
      best,
      candidates: candidates.slice(0, 5),
      note: best ? 'Decision-maker candidate found.' : 'No decision-maker found.',
    };
  }

  private async fetchCandidatePages(baseUrl: string) {
    const origin = new URL(baseUrl).origin;
    const seen = new Set<string>();
    const pages: Array<{ url: string; text: string; emails: string[] }> = [];

    for (const path of PAGE_PATHS) {
      const url = path === '/' ? origin : `${origin}${path}`;
      if (seen.has(url)) continue;
      seen.add(url);
      const html = await this.fetchHtml(url);
      if (!html) continue;
      const text = this.htmlToText(html);
      const emails = this.extractEmails(html);
      pages.push({ url, text, emails });

      if (pages.length >= 6) break;
    }

    return pages;
  }

  private async fetchHtml(url: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept: 'text/html,application/xhtml+xml,text/plain;q=0.8',
          'user-agent':
            'Mozilla/5.0 (compatible; LeadOutreachDecisionMakerFinder/1.0)',
        },
      });
      if (!response.ok) return '';
      const contentType = response.headers.get('content-type') ?? '';
      if (!/text\/html|text\/plain|application\/xhtml/i.test(contentType)) {
        return '';
      }
      return (await response.text()).slice(0, 500_000);
    } catch {
      return '';
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractCandidatesFromPages(
    pages: Array<{ url: string; text: string; emails: string[] }>,
  ) {
    const candidates: Candidate[] = [];

    for (const page of pages) {
      const titleMatches = this.findTitleSnippets(page.text);
      for (const match of titleMatches) {
        const name = this.extractNameNearTitle(match.snippet, match.title);
        const nearbyEmail = this.findNearestPersonalEmail(page.emails, name);
        candidates.push({
          name,
          title: match.title,
          email: nearbyEmail ?? null,
          emailType: nearbyEmail ? this.classifyEmail(nearbyEmail) : 'UNKNOWN',
          confidence: this.scoreCandidate({
            name,
            title: match.title,
            email: nearbyEmail,
            sourceUrl: page.url,
          }),
          sourceUrl: page.url,
          sourceText: match.snippet,
        });
      }
    }

    return candidates;
  }

  private fallbackEmailCandidates(
    pages: Array<{ url: string; text: string; emails: string[] }>,
    lead: Lead,
  ) {
    const candidates: Candidate[] = [];
    const allEmails = [
      ...pages.flatMap((page) =>
        page.emails.map((email) => ({ email, sourceUrl: page.url })),
      ),
      ...(lead.email ? [{ email: lead.email, sourceUrl: lead.website ?? '' }] : []),
    ];

    for (const row of allEmails) {
      candidates.push({
        email: row.email,
        emailType: this.classifyEmail(row.email),
        confidence: this.classifyEmail(row.email) === 'PERSONAL' ? 55 : 25,
        sourceUrl: row.sourceUrl,
        sourceText: 'Email found without a matching decision-maker title.',
      });
    }

    return candidates;
  }

  private rankCandidates(candidates: Candidate[]) {
    const byKey = new Map<string, Candidate>();

    for (const candidate of candidates) {
      const key =
        candidate.email?.toLowerCase() ||
        `${candidate.name ?? ''}:${candidate.title ?? ''}:${candidate.sourceUrl}`;
      const existing = byKey.get(key);
      if (!existing || candidate.confidence > existing.confidence) {
        byKey.set(key, candidate);
      }
    }

    return [...byKey.values()]
      .filter((candidate) => candidate.name || candidate.email)
      .sort((left, right) => right.confidence - left.confidence);
  }

  private findTitleSnippets(text: string) {
    const compact = text.replace(/\s+/g, ' ').trim();
    const results: Array<{ title: string; snippet: string }> = [];
    for (const pattern of TARGET_TITLE_PATTERNS) {
      for (const match of compact.matchAll(new RegExp(pattern.source, 'gi'))) {
        const index = match.index ?? 0;
        const snippet = compact.slice(Math.max(0, index - 120), index + 180);
        results.push({ title: match[0], snippet });
      }
    }
    return results.slice(0, 20);
  }

  private extractNameNearTitle(snippet: string, title: string) {
    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const before = new RegExp(
      `([A-Z][a-z]+(?:\\s+[A-Z][a-z]+){0,3})\\s*(?:-|–|—|,|:)\\s*${escapedTitle}`,
      'i',
    ).exec(snippet);
    if (before?.[1]) return before[1].trim();

    const after = new RegExp(
      `${escapedTitle}\\s*(?:-|–|—|,|:)\\s*([A-Z][a-z]+(?:\\s+[A-Z][a-z]+){0,3})`,
      'i',
    ).exec(snippet);
    if (after?.[1]) return after[1].trim();

    return null;
  }

  private findNearestPersonalEmail(emails: string[], name?: string | null) {
    const personal = emails.find((email) => this.classifyEmail(email) === 'PERSONAL');
    if (!name || !personal) return personal ?? null;

    const tokens = name.toLowerCase().split(/\s+/).filter(Boolean);
    return (
      emails.find((email) => {
        const local = email.toLowerCase().split('@')[0];
        return tokens.some((token) => token.length > 2 && local.includes(token));
      }) ?? personal
    );
  }

  private scoreCandidate(candidate: {
    name?: string | null;
    title?: string | null;
    email?: string | null;
    sourceUrl: string;
  }) {
    let score = 20;
    if (candidate.name) score += 20;
    if (candidate.title) score += 25;
    if (candidate.email) {
      score += this.classifyEmail(candidate.email) === 'PERSONAL' ? 30 : 10;
    }
    if (/team|about|leadership|management/i.test(candidate.sourceUrl)) score += 10;
    return Math.min(100, score);
  }

  private classifyEmail(email: string) {
    const local = email.toLowerCase().split('@')[0].replace(/[^a-z0-9._-]/g, '');
    if (GENERIC_PREFIXES.has(local) || GENERIC_PREFIXES.has(local.split(/[._-]/)[0])) {
      return 'GENERIC';
    }
    if (/manager|director|marketing|owner|founder|practice/.test(local)) {
      return 'ROLE_BASED';
    }
    if (/[._-]/.test(local) || /^[a-z]+$/.test(local)) {
      return 'PERSONAL';
    }
    return 'UNKNOWN';
  }

  private extractEmails(value: string) {
    return Array.from(
      new Set(
        [...value.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map(
          (match) => match[0].toLowerCase(),
        ),
      ),
    ).slice(0, 25);
  }

  private htmlToText(html: string) {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeUrl(value?: string | null) {
    if (!value?.trim()) return null;
    const candidate = /^https?:\/\//i.test(value.trim())
      ? value.trim()
      : `https://${value.trim()}`;
    try {
      return new URL(candidate).toString();
    } catch {
      return null;
    }
  }

  private async clearBest(userId: string, leadId: string) {
    await this.prisma.leadDecisionMaker.deleteMany({ where: { userId, leadId } });
  }

  private async updateLeadQualityFromDecisionMaker(
    userId: string,
    lead: Lead,
    best: Candidate | null,
  ) {
    const tags = new Set(lead.tags);
    tags.delete('generic-email-only');
    tags.delete('decision-maker-found');
    tags.add(best ? 'decision-maker-found' : 'generic-email-only');

    await this.prisma.lead.updateMany({
      where: { id: lead.id, userId },
      data: {
        tags: [...tags],
        qualityScore: Math.min(100, Math.max(lead.qualityScore, best?.confidence ?? 0)),
        qualityReasons: Array.from(
          new Set([
            ...lead.qualityReasons,
            best ? 'decision maker found' : 'generic email only',
          ]),
        ),
      },
    });
  }
}
