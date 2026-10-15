-- CreateTable
CREATE TABLE "reactive_resume_connection" (
    "userId" INTEGER NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reactive_resume_connection_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "reactive_resume_connection" ADD CONSTRAINT "reactive_resume_connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
