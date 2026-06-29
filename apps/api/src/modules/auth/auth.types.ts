import { UserRole } from '@prisma/client';

export type LicenseStatus = 'ACTIVE' | 'EXPIRED' | 'UNLIMITED';

export type AuthenticatedUser = {
  id: string;
  username: string | null;
  email: string;
  name: string | null;
  role: UserRole;
  isActive: boolean;
  emailVerifiedAt: Date | null;
  licenseExpiresAt: Date | null;
  licenseStatus: LicenseStatus;
  licenseExpired: boolean;
  createdAt: Date;
  updatedAt: Date;
};
