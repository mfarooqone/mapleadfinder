import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

@Injectable()
export class SecretVaultService {
  private readonly key = createHash('sha256')
    .update(process.env.APP_ENCRYPTION_KEY ?? 'dev-only-change-me')
    .digest();

  encrypt(value?: string | null): string | null {
    if (!value) {
      return null;
    }

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(
      ':',
    );
  }

  decrypt(value?: string | null): string | null {
    if (!value) {
      return null;
    }

    const [ivHex, tagHex, encryptedHex] = value.split(':');
    if (!ivHex || !tagHex || !encryptedHex) {
      return value;
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}
