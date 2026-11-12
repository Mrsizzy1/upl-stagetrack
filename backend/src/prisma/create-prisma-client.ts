import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

export function createPrismaAdapter(connectionString: string): PrismaPg {
  return new PrismaPg({
    connectionString,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 300_000,
  });
}

export function createPrismaClient(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (!connectionString) throw new Error('DATABASE_URL est obligatoire pour le client Prisma');
  return new PrismaClient({ adapter: createPrismaAdapter(connectionString) });
}
