-- CreateTable
CREATE TABLE "Monitor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Check" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monitorId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "responseMs" INTEGER,
    "statusCode" INTEGER,
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Check_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Check_monitorId_checkedAt_idx" ON "Check"("monitorId", "checkedAt");
