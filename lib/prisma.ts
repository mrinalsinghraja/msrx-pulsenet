import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient(): PrismaClient {
  // Production (Vercel): use Turso/LibSQL
  if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
    const { createClient } = require("@libsql/client");
    const { PrismaLibSQL } = require("@prisma/adapter-libsql");
    const libsql = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    const adapter = new PrismaLibSQL(libsql);
    return new PrismaClient({ adapter } as unknown as ConstructorParameters<typeof PrismaClient>[0]);
  }
  // Local dev: use SQLite via DATABASE_URL
  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
