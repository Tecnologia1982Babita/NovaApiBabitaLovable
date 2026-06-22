import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcrypt';
import { createHash } from 'node:crypto';

@Injectable()
export class HashTools {
  async generate(password_hash: string): Promise<string> {
    const genHash = await hash(password_hash, 10);
    return genHash;
  }

  async compare(password: string, password_hash: string): Promise<boolean> {
    const result = await compare(password, password_hash);
    return result;
  }

  async encrypt(content: any) {
    const result = await createHash('sha256').update(content).digest('hex');
    return result;
  }
}

export const hashHelper = new HashTools();
