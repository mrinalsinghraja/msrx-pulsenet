import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

declare global {
  // eslint-disable-next-line no-var
  var _prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  console.log("[prisma] init — tursoUrl:", tursoUrl ? tursoUrl.slice(0, 20) + "…" : "MISSING", "| node_env:", process.env.NODE_ENV);

  if (tursoUrl && tursoToken) {
    try {
      const adapter = new PrismaLibSQL({ url: tursoUrl, authToken: tursoToken });
      return new PrismaClient({ adapter } as unknown as ConstructorParameters<typeof PrismaClient>[0]);
    } catch (e) {
      console.error("[prisma] Turso adapter init failed:", e);
    }
  }

  console.warn("[prisma] Falling back to SQLite (DATABASE_URL):", process.env.DATABASE_URL);
  return new PrismaClient();
}

export const prisma = global._prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") global._prisma = prisma;
