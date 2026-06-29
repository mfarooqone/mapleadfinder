import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  UserRole,
} from '@prisma/client';
import { randomBytes, scryptSync } from 'crypto';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString:
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5432/postgres?schema=public',
  }),
});

const users = [
  {
    id: 'user-farooq',
    username: 'farooq',
    name: 'Farooq',
    email: 'farooq@leadoutreach.local',
    password: process.env.FAROOQ_PASSWORD ?? 'farooq123',
    role: UserRole.ADMIN,
  },
  {
    id: 'user-khalil',
    username: 'khalil',
    name: 'Khalil',
    email: 'khalil@leadoutreach.local',
    password: process.env.KHALIL_PASSWORD ?? 'khalil123',
    role: UserRole.USER,
  },
  {
    id: 'user-rehman',
    username: 'rehman',
    name: 'Rehman',
    email: 'rehman@leadoutreach.local',
    password: process.env.REHMAN_PASSWORD ?? 'rehman123',
    role: UserRole.USER,
  },
  {
    id: 'user-saud',
    username: 'saud',
    name: 'Saud',
    email: 'saud@leadoutreach.local',
    password: process.env.SAUD_PASSWORD ?? 'saud123',
    role: UserRole.USER,
  },
] as const;

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  for (const user of users) {
    await prisma.user.upsert({
      where: {
        id: user.id,
      },
      update: {
        username: user.username,
        name: user.name,
        email: user.email,
        passwordHash: hashPassword(user.password),
        role: user.role,
        isActive: true,
        emailVerifiedAt: new Date(),
        licenseExpiresAt: null,
      },
      create: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        passwordHash: hashPassword(user.password),
        role: user.role,
        isActive: true,
        emailVerifiedAt: new Date(),
        licenseExpiresAt: null,
      },
    });
  }

  console.log('Seeded fixed login accounts: farooq, khalil, rehman, saud.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
