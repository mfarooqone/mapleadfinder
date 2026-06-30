const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString:
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5432/postgres?schema=public',
  }),
});

const legacyUserIds = [
  'user-farooq',
  'user-khalil',
  'user-rehman',
  'user-saud',
];

const legacyEmails = [
  'farooq@leadoutreach.local',
  'khalil@leadoutreach.local',
  'rehman@leadoutreach.local',
  'saud@leadoutreach.local',
];

async function main() {
  const [
    signupVerifications,
    passwordResetVerifications,
    jobs,
    conversations,
    templates,
    scrapeBatches,
    decisionMakers,
    leads,
    emailMessages,
    emailCampaigns,
    smtpSettings,
    aiSettings,
    mailboxSettings,
    outreachStats,
    whatsAppAccounts,
    users,
  ] = await prisma.$transaction([
    prisma.signupVerification.deleteMany({
      where: { email: { in: legacyEmails } },
    }),
    prisma.passwordResetVerification.deleteMany({
      where: { email: { in: legacyEmails } },
    }),
    prisma.job.deleteMany({ where: { userId: { in: legacyUserIds } } }),
    prisma.conversation.deleteMany({ where: { userId: { in: legacyUserIds } } }),
    prisma.template.deleteMany({ where: { userId: { in: legacyUserIds } } }),
    prisma.scrapeBatch.deleteMany({ where: { userId: { in: legacyUserIds } } }),
    prisma.leadDecisionMaker.deleteMany({
      where: { userId: { in: legacyUserIds } },
    }),
    prisma.lead.deleteMany({ where: { userId: { in: legacyUserIds } } }),
    prisma.emailMessage.deleteMany({ where: { userId: { in: legacyUserIds } } }),
    prisma.emailCampaign.deleteMany({ where: { userId: { in: legacyUserIds } } }),
    prisma.emailSmtpSettings.deleteMany({
      where: { userId: { in: legacyUserIds } },
    }),
    prisma.emailAiSettings.deleteMany({
      where: { userId: { in: legacyUserIds } },
    }),
    prisma.emailMailboxSettings.deleteMany({
      where: { userId: { in: legacyUserIds } },
    }),
    prisma.outreachDailyStats.deleteMany({
      where: { userId: { in: legacyUserIds } },
    }),
    prisma.whatsAppAccount.deleteMany({
      where: { userId: { in: legacyUserIds } },
    }),
    prisma.user.deleteMany({ where: { id: { in: legacyUserIds } } }),
  ]);

  console.log(
    [
      `Removed ${users.count} legacy fixed login account(s).`,
      `Cleaned account data: ${leads.count} lead(s), ${conversations.count} conversation(s), ${jobs.count} job(s), ${whatsAppAccounts.count} WhatsApp account(s).`,
      `Email signup is the only account creation path. Pending legacy verifications removed: signup=${signupVerifications.count}, passwordReset=${passwordResetVerifications.count}.`,
      `Other removed records: templates=${templates.count}, scrapeBatches=${scrapeBatches.count}, decisionMakers=${decisionMakers.count}, emailMessages=${emailMessages.count}, emailCampaigns=${emailCampaigns.count}, smtpSettings=${smtpSettings.count}, aiSettings=${aiSettings.count}, mailboxSettings=${mailboxSettings.count}, outreachStats=${outreachStats.count}.`,
    ].join(' '),
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    prisma.$disconnect().finally(() => process.exit(1));
  });
