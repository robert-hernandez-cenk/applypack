-- The users table (ADR 0065). Row 1 is the default admin: it owns everything
-- that exists today and is the one user of an install without sign-in. Its
-- sign-in id stays empty until the first person signs in through OIDC.
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MEMBER');

CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "oidcSub" TEXT,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_oidcSub_key" ON "users"("oidcSub");

INSERT INTO "users" ("id", "name", "role") VALUES (1, 'Default user', 'ADMIN');
SELECT setval(pg_get_serial_sequence('users', 'id'), 1);
