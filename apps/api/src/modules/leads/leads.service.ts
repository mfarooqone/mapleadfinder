import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Lead,
  LeadSource,
  LeadStatus,
  MessageDirection,
  MessageStatus,
  Prisma,
} from '@prisma/client';
import { coerceBoolean, parseCsvRecords } from '../../common/utils/csv.util';
import { normalizePhoneNumber } from '../../common/utils/phone.util';
import { buildWaMeLink } from '../../common/utils/wa-me.util';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ListLeadsQueryDto } from './dto/list-leads-query.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { UploadLeadsDto } from './dto/upload-leads.dto';

type LeadContactState = 'NEW' | 'CONTACTED';

type LeadContactInsight = {
  contactState: LeadContactState;
  contactedAt: Date | null;
  latestOutgoingStatus: MessageStatus | null;
  hasIncoming: boolean;
  lastIncomingAt: Date | null;
};

type BestDecisionMaker = {
  id: string;
  name: string | null;
  title: string | null;
  email: string | null;
  emailType: string;
  confidence: number;
  sourceUrl: string | null;
};

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLeadDto & { userId: string }) {
    const phone = normalizePhoneNumber(dto.phone);

    const lead = await this.prisma.lead.upsert({
      where: {
        userId_phone: {
          userId: dto.userId,
          phone,
        },
      },
      update: {
        name: dto.name,
        email: dto.email,
        website: this.normalizeOptionalText(dto.website),
        ...this.buildLeadQualityData({
          name: dto.name,
          email: dto.email,
          website: dto.website,
          phone,
        }),
        optIn: dto.optIn,
        status: dto.status ?? LeadStatus.NEW,
        tags: dto.tags ?? [],
        metadata: dto.metadata,
        isDeleted: false,
        deletedAt: null,
      },
      create: {
        userId: dto.userId,
        name: dto.name,
        phone,
        email: dto.email,
        website: this.normalizeOptionalText(dto.website),
        ...this.buildLeadQualityData({
          name: dto.name,
          email: dto.email,
          website: dto.website,
          phone,
        }),
        optIn: dto.optIn,
        status: dto.status ?? LeadStatus.NEW,
        tags: dto.tags ?? [],
        metadata: dto.metadata,
        isDeleted: false,
        deletedAt: null,
      },
    });

    return this.attachContactInsight(dto.userId, lead);
  }

  async uploadCsv(dto: UploadLeadsDto & { userId: string }) {
    const records = parseCsvRecords(dto.csv);
    const normalizedRecords = records
      .map((record) => ({
        name:
          record.name || record.firstname || record['first_name'] || undefined,
        phone: record.phone || record.number || '',
        email: record.email || undefined,
        website: this.normalizeOptionalText(
          record.website || record.url || record.site || record.domain,
        ),
        optIn: coerceBoolean(
          record.optin ?? record['opt-in'] ?? record.consent ?? true,
        ),
      }))
      .filter((record) => record.phone.trim().length > 0);

    const operations = normalizedRecords.map((record) =>
      this.prisma.lead.upsert({
        where: {
          userId_phone: {
            userId: dto.userId,
            phone: normalizePhoneNumber(record.phone),
          },
        },
        update: {
          name: record.name,
          email: record.email,
          website: record.website,
          ...this.buildLeadQualityData(record),
          optIn: record.optIn,
          status: LeadStatus.NEW,
          isDeleted: false,
          deletedAt: null,
        },
        create: {
          userId: dto.userId,
          name: record.name,
          phone: normalizePhoneNumber(record.phone),
          email: record.email,
          website: record.website,
          ...this.buildLeadQualityData(record),
          optIn: record.optIn,
          status: LeadStatus.NEW,
          isDeleted: false,
          deletedAt: null,
        },
      }),
    );

    await this.prisma.$transaction(operations);

    return {
      imported: operations.length,
      skipped: records.length - operations.length,
    };
  }

  async createScrapedMany(
    userId: string,
    leads: Omit<Prisma.LeadCreateManyInput, 'userId'>[],
    keyword?: string,
    maxRecords?: number,
  ) {
    let count = 0;
    const savedLeadIds: string[] = [];
    const normalizedKeyword = this.normalizeNullableText(keyword) ?? 'Scrape';
    const batch = await this.prisma.scrapeBatch.create({
      data: {
        userId,
        keyword: normalizedKeyword,
        maxRecords: maxRecords ?? null,
        discovered: leads.length,
        saved: 0,
      },
    });

    for (const leadInput of leads) {
      const name = this.normalizeOptionalText(leadInput.name);
      if (!name) {
        continue;
      }

      const phone =
        typeof leadInput.phone === 'string'
          ? normalizePhoneNumber(leadInput.phone)
          : null;
      const data = {
        name,
        category: this.normalizeNullableText(leadInput.category),
        address: this.normalizeNullableText(leadInput.address),
        phone,
        email: this.normalizeNullableText(leadInput.email),
        website: this.normalizeNullableText(leadInput.website),
        rating: leadInput.rating ?? null,
        reviewsCount: leadInput.reviewsCount ?? null,
        source: LeadSource.GOOGLE_MAPS,
        sourceKeyword: keyword ?? null,
        isDeleted: false,
        deletedAt: null,
      };

      if (phone) {
        const savedLead = await this.prisma.lead.upsert({
          where: {
            userId_phone: {
              userId,
              phone,
            },
          },
          update: data,
          create: {
            userId,
            ...data,
          },
        });
        savedLeadIds.push(savedLead.id);
        count++;
        continue;
      }

      const existing = await this.prisma.lead.findFirst({
        where: {
          userId,
          name,
          address: data.address,
          isDeleted: false,
        },
      });

      if (existing) {
        const savedLead = await this.prisma.lead.update({
          where: { id: existing.id },
          data,
        });
        savedLeadIds.push(savedLead.id);
      } else {
        const savedLead = await this.prisma.lead.create({
          data: {
            userId,
            ...data,
          },
        });
        savedLeadIds.push(savedLead.id);
      }

      count++;
    }

    const uniqueSavedLeadIds = [...new Set(savedLeadIds)];

    if (uniqueSavedLeadIds.length > 0) {
      await this.prisma.scrapeBatchLead.createMany({
        data: uniqueSavedLeadIds.map((leadId, position) => ({
          scrapeBatchId: batch.id,
          leadId,
          position,
        })),
        skipDuplicates: true,
      });
    }

    await this.prisma.scrapeBatch.update({
      where: { id: batch.id },
      data: {
        saved: uniqueSavedLeadIds.length,
      },
    });

    return { count: uniqueSavedLeadIds.length, batchId: batch.id };
  }

  async createScrapeBatch(
    userId: string,
    keyword: string,
    maxRecords?: number,
  ) {
    return this.prisma.scrapeBatch.create({
      data: {
        userId,
        keyword: this.normalizeNullableText(keyword) ?? 'Scrape',
        maxRecords: maxRecords ?? null,
        discovered: 0,
        saved: 0,
      },
    });
  }

  async saveScrapedLeadsToBatch(
    userId: string,
    batchId: string,
    leads: Omit<Prisma.LeadCreateManyInput, 'userId'>[],
    keyword?: string,
  ) {
    const batch = await this.prisma.scrapeBatch.findFirst({
      where: {
        id: batchId,
        userId,
        isDeleted: false,
      },
    });

    if (!batch) {
      throw new NotFoundException('Scrape group not found.');
    }

    const savedLeadIds: string[] = [];

    for (const leadInput of leads) {
      const name = this.normalizeOptionalText(leadInput.name);
      if (!name) {
        continue;
      }

      const phone =
        typeof leadInput.phone === 'string'
          ? normalizePhoneNumber(leadInput.phone)
          : null;
      const data = {
        name,
        category: this.normalizeNullableText(leadInput.category),
        address: this.normalizeNullableText(leadInput.address),
        phone,
        email: this.normalizeNullableText(leadInput.email),
        website: this.normalizeNullableText(leadInput.website),
        rating: leadInput.rating ?? null,
        reviewsCount: leadInput.reviewsCount ?? null,
        source: LeadSource.GOOGLE_MAPS,
        sourceKeyword: keyword ?? batch.keyword,
        isDeleted: false,
        deletedAt: null,
      };
      const qualityData = this.buildLeadQualityData(data);

      if (phone) {
        const savedLead = await this.prisma.lead.upsert({
          where: {
            userId_phone: {
              userId,
              phone,
            },
          },
          update: { ...data, ...qualityData },
          create: {
            userId,
            ...data,
            ...qualityData,
          },
        });
        savedLeadIds.push(savedLead.id);
        continue;
      }

      const existing = await this.prisma.lead.findFirst({
        where: {
          userId,
          name,
          address: data.address,
          isDeleted: false,
        },
      });

      if (existing) {
        const savedLead = await this.prisma.lead.update({
          where: { id: existing.id },
          data: { ...data, ...qualityData },
        });
        savedLeadIds.push(savedLead.id);
      } else {
        const savedLead = await this.prisma.lead.create({
          data: {
            userId,
            ...data,
            ...qualityData,
          },
        });
        savedLeadIds.push(savedLead.id);
      }
    }

    const uniqueSavedLeadIds = [...new Set(savedLeadIds)];

    if (uniqueSavedLeadIds.length > 0) {
      const nextPosition = await this.prisma.scrapeBatchLead.count({
        where: {
          scrapeBatchId: batch.id,
        },
      });

      await this.prisma.scrapeBatchLead.createMany({
        data: uniqueSavedLeadIds.map((leadId, offset) => ({
          scrapeBatchId: batch.id,
          leadId,
          position: nextPosition + offset,
        })),
        skipDuplicates: true,
      });
    }

    const linkedCount = await this.prisma.scrapeBatchLead.count({
      where: {
        scrapeBatchId: batch.id,
      },
    });

    await this.prisma.scrapeBatch.update({
      where: { id: batch.id },
      data: {
        discovered: { increment: leads.length },
        saved: linkedCount,
      },
    });

    return {
      count: uniqueSavedLeadIds.length,
      batchId: batch.id,
      savedTotal: linkedCount,
    };
  }

  async listScrapeBatches(userId: string) {
    const batches = await this.prisma.scrapeBatch.findMany({
      where: {
        userId,
        isDeleted: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        _count: {
          select: {
            leads: true,
          },
        },
      },
    });

    return batches.map(({ _count, ...batch }) => ({
      ...batch,
      leadCount: _count.leads,
    }));
  }

  async listLeadIdsForScrapeBatch(userId: string, batchId: string) {
    const batch = await this.prisma.scrapeBatch.findFirst({
      where: {
        id: batchId,
        userId,
        isDeleted: false,
      },
      select: {
        id: true,
      },
    });

    if (!batch) {
      throw new NotFoundException('Scrape group not found.');
    }

    const links = await this.prisma.scrapeBatchLead.findMany({
      where: {
        scrapeBatchId: batch.id,
        lead: {
          userId,
          isDeleted: false,
          website: {
            not: null,
          },
        },
      },
      select: {
        leadId: true,
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });

    return links.map((link) => link.leadId);
  }

  async findByScrapeBatch(
    userId: string,
    batchId: string,
    query: ListLeadsQueryDto = {},
  ) {
    const batch = await this.prisma.scrapeBatch.findFirst({
      where: {
        id: batchId,
        userId,
        isDeleted: false,
      },
    });

    if (!batch) {
      throw new NotFoundException('Scrape group not found.');
    }

    const leadFilters: Prisma.LeadWhereInput[] = [
      {
        userId,
        isDeleted: false,
      },
    ];

    if (query.ratingLt !== undefined) {
      leadFilters.push({
        rating: {
          lt: query.ratingLt,
        },
      });
    }

    if (query.hasWebsite !== undefined) {
      leadFilters.push(
        query.hasWebsite
          ? {
              AND: [{ website: { not: null } }, { website: { not: '' } }],
            }
          : {
              OR: [{ website: null }, { website: '' }],
            },
      );
    }

    if (query.search?.trim()) {
      const search = query.search.trim();
      leadFilters.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { website: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    const links = await this.prisma.scrapeBatchLead.findMany({
      where: {
        scrapeBatchId: batch.id,
        lead: {
          AND: leadFilters,
        },
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: {
        lead: true,
      },
    });

    return this.attachContactInsights(
      userId,
      links.map((link) => link.lead),
    );
  }

  async removeScrapeBatch(
    userId: string,
    batchId: string,
    deleteContacts = false,
  ) {
    const batch = await this.prisma.scrapeBatch.findFirst({
      where: {
        id: batchId,
        userId,
        isDeleted: false,
      },
      include: {
        leads: {
          select: {
            leadId: true,
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('Scrape group not found.');
    }

    const leadIds = batch.leads.map((link) => link.leadId);

    if (deleteContacts && leadIds.length > 0) {
      await this.prisma.lead.updateMany({
        where: {
          userId,
          id: {
            in: leadIds,
          },
          isDeleted: false,
        },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });
    }

    await this.prisma.scrapeBatch.update({
      where: { id: batch.id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    return {
      deleted: true,
      batchId,
      contactsDeleted: deleteContacts ? leadIds.length : 0,
      contactsPreserved: deleteContacts ? 0 : leadIds.length,
    };
  }

  async removeLeadFromScrapeBatch(
    userId: string,
    batchId: string,
    leadId: string,
  ) {
    const batch = await this.prisma.scrapeBatch.findFirst({
      where: {
        id: batchId,
        userId,
        isDeleted: false,
      },
    });

    if (!batch) {
      throw new NotFoundException('Scrape group not found.');
    }

    await this.prisma.scrapeBatchLead.deleteMany({
      where: {
        scrapeBatchId: batch.id,
        leadId,
        lead: {
          userId,
        },
      },
    });

    return {
      removed: true,
      batchId,
      leadId,
    };
  }

  async findAll(userId: string, query: ListLeadsQueryDto = {}) {
    const filters: Prisma.LeadWhereInput[] = [
      {
        userId,
        isDeleted: false,
      },
    ];

    if (query.ratingLt !== undefined) {
      filters.push({
        rating: {
          lt: query.ratingLt,
        },
      });
    }

    if (query.hasWebsite !== undefined) {
      filters.push(
        query.hasWebsite
          ? {
              AND: [{ website: { not: null } }, { website: { not: '' } }],
            }
          : {
              OR: [{ website: null }, { website: '' }],
            },
      );
    }

    if (query.source) {
      filters.push({
        source: query.source,
      });
    }

    if (query.sourceKeyword?.trim()) {
      filters.push({
        sourceKeyword: query.sourceKeyword.trim(),
      });
    }

    if (query.search?.trim()) {
      const search = query.search.trim();
      filters.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { website: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    const leads = await this.prisma.lead.findMany({
      where: { AND: filters },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return this.attachContactInsights(userId, leads);
  }

  async findByPhone(userId: string, phone: string) {
    const lead = await this.prisma.lead.findFirst({
      where: {
        userId,
        phone: normalizePhoneNumber(phone),
        isDeleted: false,
      },
    });

    if (!lead) {
      return null;
    }

    return this.attachContactInsight(userId, lead);
  }

  async findContactInsightByPhone(userId: string, phone: string) {
    const normalizedPhone = normalizePhoneNumber(phone);
    const insights = await this.findContactInsightsByPhones(userId, [
      normalizedPhone,
    ]);

    return insights.get(normalizedPhone) ?? this.buildNewContactInsight();
  }

  async findContactInsightsByPhones(userId: string, phones: string[]) {
    const normalizedPhones = [...new Set(phones.map(normalizePhoneNumber))];

    if (normalizedPhones.length === 0) {
      return new Map<string, LeadContactInsight>();
    }

    const conversations = await this.prisma.conversation.findMany({
      where: {
        userId,
        phone: {
          in: normalizedPhones,
        },
      },
      select: {
        phone: true,
        lastIncomingAt: true,
        lastOutgoingAt: true,
        messages: {
          where: {
            direction: MessageDirection.OUTGOING,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          select: {
            createdAt: true,
            status: true,
          },
        },
      },
    });

    const insightByPhone = new Map<string, LeadContactInsight>(
      normalizedPhones.map((phone) => [phone, this.buildNewContactInsight()]),
    );

    for (const conversation of conversations) {
      const latestOutgoingMessage = conversation.messages[0];
      const wasContacted = Boolean(
        latestOutgoingMessage || conversation.lastOutgoingAt,
      );

      insightByPhone.set(conversation.phone, {
        contactState: wasContacted ? 'CONTACTED' : 'NEW',
        contactedAt:
          conversation.lastOutgoingAt ??
          latestOutgoingMessage?.createdAt ??
          null,
        latestOutgoingStatus: latestOutgoingMessage?.status ?? null,
        hasIncoming: Boolean(conversation.lastIncomingAt),
        lastIncomingAt: conversation.lastIncomingAt,
      });
    }

    return insightByPhone;
  }

  async updateStatus(userId: string, id: string, dto: UpdateLeadStatusDto) {
    const result = await this.prisma.lead.updateMany({
      where: {
        id,
        userId,
        isDeleted: false,
      },
      data: {
        status: dto.status,
        optIn: dto.optIn,
        tags: dto.tags,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Contact not found.');
    }

    return this.prisma.lead.findFirstOrThrow({
      where: {
        id,
        userId,
        isDeleted: false,
      },
    });
  }

  async updateOptInByPhone(userId: string, phone: string, optIn: boolean) {
    return this.prisma.lead.updateMany({
      where: {
        userId,
        phone: normalizePhoneNumber(phone),
        isDeleted: false,
      },
      data: {
        optIn,
      },
    });
  }

  async remove(id: string, userId: string) {
    if (!userId?.trim()) {
      throw new BadRequestException('userId is required to delete a contact.');
    }

    const result = await this.prisma.lead.updateMany({
      where: {
        id,
        userId,
        isDeleted: false,
      },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Contact not found.');
    }

    return {
      deleted: true,
      id,
    };
  }

  async getWaMeLink(userId: string, leadId: string, prefilledText = 'Hi') {
    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        userId,
        isDeleted: false,
      },
    });

    if (!lead) {
      throw new NotFoundException('Contact not found.');
    }

    const account = await this.prisma.whatsAppAccount.findFirst({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!account) {
      throw new BadRequestException(
        'Link a WhatsApp number first before generating invite links.',
      );
    }

    const text = prefilledText.trim() || 'Hi';

    return {
      leadId: lead.id,
      phone: lead.phone ?? '',
      warmUpStatus: lead.warmUpStatus,
      businessPhone: account.phoneNumber,
      prefilledText: text,
      link: buildWaMeLink(account.phoneNumber, text),
    };
  }

  async markLinkSent(userId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        userId,
        isDeleted: false,
      },
    });

    if (!lead) {
      throw new NotFoundException('Contact not found.');
    }

    if (lead.warmUpStatus === 'ENGAGED' || lead.warmUpStatus === 'BLOCKED') {
      return lead;
    }

    return this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        warmUpStatus: 'LINK_SENT',
      },
    });
  }

  async markEngagedOnIncoming(userId: string, phone: string, timestamp: Date) {
    const normalizedPhone = normalizePhoneNumber(phone);
    const lead = await this.prisma.lead.findFirst({
      where: {
        userId,
        phone: normalizedPhone,
        isDeleted: false,
      },
    });

    if (!lead) {
      return null;
    }

    return this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        warmUpStatus: 'ENGAGED',
        ...(lead.firstIncomingAt ? {} : { firstIncomingAt: timestamp }),
      },
    });
  }

  async touchOutgoing(userId: string, leadId: string, timestamp = new Date()) {
    return this.prisma.lead.updateMany({
      where: {
        id: leadId,
        userId,
        isDeleted: false,
      },
      data: {
        lastOutgoingAt: timestamp,
      },
    });
  }

  async removeMany(ids: string[], userId: string) {
    if (!userId?.trim()) {
      throw new BadRequestException('userId is required to delete contacts.');
    }

    const uniqueIds = [...new Set(ids.map((id) => id.trim()))].filter(Boolean);

    if (uniqueIds.length === 0) {
      throw new BadRequestException('At least one contact id is required.');
    }

    const result = await this.prisma.lead.updateMany({
      where: {
        userId,
        id: {
          in: uniqueIds,
        },
        isDeleted: false,
      },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('No contacts found to delete.');
    }

    return {
      deleted: true,
      count: result.count,
      ids: uniqueIds,
    };
  }

  async updateManyOptIn(ids: string[], userId: string, optIn: boolean) {
    if (!userId?.trim()) {
      throw new BadRequestException('userId is required to update contacts.');
    }

    const uniqueIds = [...new Set(ids.map((id) => id.trim()))].filter(Boolean);

    if (uniqueIds.length === 0) {
      throw new BadRequestException('At least one contact id is required.');
    }

    const result = await this.prisma.lead.updateMany({
      where: {
        userId,
        id: {
          in: uniqueIds,
        },
        isDeleted: false,
      },
      data: {
        optIn,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('No contacts found to update.');
    }

    return {
      updated: true,
      count: result.count,
      optIn,
      ids: uniqueIds,
    };
  }

  async removeAll(userId: string) {
    if (!userId?.trim()) {
      throw new BadRequestException('userId is required to delete contacts.');
    }

    const result = await this.prisma.lead.updateMany({
      where: {
        userId,
        isDeleted: false,
      },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    return {
      deleted: true,
      count: result.count,
    };
  }

  private async attachContactInsights(userId: string, records: Lead[]) {
    const phones = records
      .map((record) => record.phone)
      .filter((phone): phone is string => Boolean(phone));
    const insightByPhone = await this.findContactInsightsByPhones(
      userId,
      phones,
    );
    const decisionMakerByLeadId = await this.findBestDecisionMakers(
      userId,
      records.map((record) => record.id),
    );

    return records.map((record) =>
      this.mergeLeadWithContactInsight(
        record,
        record.phone
          ? (insightByPhone.get(record.phone) ?? this.buildNewContactInsight())
          : this.buildNewContactInsight(),
        decisionMakerByLeadId.get(record.id) ?? null,
      ),
    );
  }

  private async attachContactInsight(userId: string, lead: Lead) {
    const decisionMakerByLeadId = await this.findBestDecisionMakers(userId, [
      lead.id,
    ]);
    if (!lead.phone) {
      return this.mergeLeadWithContactInsight(
        lead,
        this.buildNewContactInsight(),
        decisionMakerByLeadId.get(lead.id) ?? null,
      );
    }

    const insight = await this.findContactInsightByPhone(userId, lead.phone);
    return this.mergeLeadWithContactInsight(
      lead,
      insight,
      decisionMakerByLeadId.get(lead.id) ?? null,
    );
  }

  private mergeLeadWithContactInsight(
    lead: Lead,
    insight: LeadContactInsight,
    bestDecisionMaker: BestDecisionMaker | null,
  ) {
    const quality = this.calculateLeadQuality(lead);
    return {
      ...lead,
      qualityScore: quality.score,
      qualityReasons: quality.reasons,
      bestDecisionMaker,
      preferredEmail: bestDecisionMaker?.email ?? lead.email ?? null,
      preferredEmailType:
        bestDecisionMaker?.emailType ?? (lead.email ? 'LEAD' : 'NONE'),
      phone: lead.phone ?? '',
      leadStatus: lead.status,
      status:
        lead.status === LeadStatus.NEW && insight.contactState === 'CONTACTED'
          ? 'CONTACTED'
          : lead.status,
      ...insight,
    };
  }

  private async findBestDecisionMakers(userId: string, leadIds: string[]) {
    const rows = await this.prisma.leadDecisionMaker.findMany({
      where: {
        userId,
        leadId: { in: [...new Set(leadIds)] },
        isBest: true,
      },
      select: {
        id: true,
        leadId: true,
        name: true,
        title: true,
        email: true,
        emailType: true,
        confidence: true,
        sourceUrl: true,
      },
    });

    return new Map(
      rows.map((row) => [
        row.leadId,
        {
          id: row.id,
          name: row.name,
          title: row.title,
          email: row.email,
          emailType: row.emailType,
          confidence: row.confidence,
          sourceUrl: row.sourceUrl,
        },
      ]),
    );
  }

  private buildLeadQualityData(
    lead: Partial<
      Pick<
        Lead,
        | 'name'
        | 'email'
        | 'website'
        | 'phone'
        | 'rating'
        | 'reviewsCount'
        | 'emailDeliveryStatus'
      >
    >,
  ) {
    const quality = this.calculateLeadQuality(lead);
    return {
      qualityScore: quality.score,
      qualityReasons: quality.reasons,
    };
  }

  private calculateLeadQuality(
    lead: Partial<
      Pick<
        Lead,
        | 'name'
        | 'email'
        | 'website'
        | 'phone'
        | 'rating'
        | 'reviewsCount'
        | 'emailDeliveryStatus'
      >
    >,
  ) {
    let score = 20;
    const reasons: string[] = [];

    if (lead.name?.trim()) {
      score += 10;
      reasons.push('business name');
    }

    if (lead.email?.trim()) {
      score += 20;
      reasons.push('has email');
    } else {
      reasons.push('missing email');
    }

    if (lead.website?.trim()) {
      score += 15;
      reasons.push('has website');
    }

    if (lead.phone?.trim()) {
      score += 10;
      reasons.push('has phone');
    }

    if (typeof lead.rating === 'number' && lead.rating >= 4) {
      score += 10;
      reasons.push('good rating');
    }

    if (typeof lead.reviewsCount === 'number' && lead.reviewsCount >= 20) {
      score += 10;
      reasons.push('review volume');
    }

    if (lead.emailDeliveryStatus === 'REPLIED') {
      score += 15;
      reasons.push('replied');
    }

    if (lead.emailDeliveryStatus === 'BOUNCED') {
      score -= 40;
      reasons.push('email bounced');
    }

    return {
      score: Math.min(100, Math.max(0, score)),
      reasons: Array.from(new Set(reasons)),
    };
  }

  private buildNewContactInsight(): LeadContactInsight {
    return {
      contactState: 'NEW',
      contactedAt: null,
      latestOutgoingStatus: null,
      hasIncoming: false,
      lastIncomingAt: null,
    };
  }

  private normalizeOptionalText(value?: string | null) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private normalizeNullableText(value?: string | null) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }
}
