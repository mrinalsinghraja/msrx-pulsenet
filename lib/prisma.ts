import { PrismaClient } from "@prisma/client";
// Static imports — dynamic require() breaks Vercel's bundler
import { PrismaLibSQL } from "@prisma/adapter-libsql";

declare global {
  // eslint-disable-next-line no-var
  var _prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken && tursoUrl !== "undefined" && tursoToken !== "undefined") {
    // PrismaLibSQL v6 takes config object directly (not a pre-created client)
    const adapter = new PrismaLibSQL({ url: tursoUrl, authToken: tursoToken });
    return new PrismaClient({ adapter } as unknown as ConstructorParameters<typeof PrismaClient>[0]);
  }

  // Local dev: SQLite via DATABASE_URL
  return new PrismaClient();
}

export const prisma = global._prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") global._prisma = prisma;
