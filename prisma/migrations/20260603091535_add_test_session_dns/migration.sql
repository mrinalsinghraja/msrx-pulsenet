-- CreateTable
CREATE TABLE "TestSession" (
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
);

-- CreateTable
CREATE TABLE "DnsLookup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domain" TEXT NOT NULL,
    "ip" TEXT,
    "country" TEXT,
    "flag" TEXT,
    "category" TEXT,
    "dnsMs" REAL,
    "org" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
