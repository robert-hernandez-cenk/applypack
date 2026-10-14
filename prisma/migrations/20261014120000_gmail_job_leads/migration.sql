-- ADR 0071: a person's Gmail connection (one account, one label, read-only) and the
-- ledger of mails already read. GMAIL is the hidden source row of their job leads.

-- AlterEnum
ALTER TYPE "AtsType" ADD VALUE 'GMAIL';

-- CreateTable
CREATE TABLE "gmail_connection" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "accountEmail" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "labelName" TEXT NOT NULL DEFAULT 'Job Leads',
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "checkRequestedAt" TIMESTAMP(3),
    "lastCheckAt" TIMESTAMP(3),
    "lastMails" INTEGER,
    "lastListings" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gmail_connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gmail_message" (
    "id" SERIAL NOT NULL,
    "connectionId" INTEGER NOT NULL,
    "messageId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "outcome" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gmail_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gmail_connection_userId_key" ON "gmail_connection"("userId");

-- CreateIndex
CREATE INDEX "gmail_message_connectionId_receivedAt_idx" ON "gmail_message"("connectionId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "gmail_message_connectionId_messageId_key" ON "gmail_message"("connectionId", "messageId");

-- AddForeignKey
ALTER TABLE "gmail_connection" ADD CONSTRAINT "gmail_connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gmail_message" ADD CONSTRAINT "gmail_message_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "gmail_connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

