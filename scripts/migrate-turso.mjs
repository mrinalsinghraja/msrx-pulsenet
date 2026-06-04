import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const statements = [
  `CREATE TABLE IF NOT EXISTS "Monitor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Check" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monitorId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "responseMs" INTEGER,
    "statusCode" INTEGER,
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Check_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "Check_monitorId_checkedAt_idx" ON "Check"("monitorId", "checkedAt")`,
  `CREATE TABLE IF NOT EXISTS "TestSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "download" REAL,
    "upload" REAL,
    "latency" REAL,
    "jitter" REAL,
    "packetLoss" REAL,
    "score" INTEGER,
    "isp" TEXT,
    "ip" TEXT,
    "location" TEXT,
    "connectionType" TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS "DnsLookup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domain" TEXT NOT NULL,
    "ip" TEXT,
    "country" TEXT,
    "flag" TEXT,
    "category" TEXT,
    "dnsMs" REAL,
    "org" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
];

for (const sql of statements) {
  try {
    await db.execute(sql);
    const name = sql.match(/CREATE (?:TABLE|INDEX) IF NOT EXISTS "?(\w+)"?/)?.[1];
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ Error:`, e.message);
  }
}

// Verify
const tables = await db.execute(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
console.log("\nTables in Turso:", tables.rows.map(r => r[0]).join(", "));
