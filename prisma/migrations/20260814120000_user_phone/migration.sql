-- Better Auth / Prisma : User.phone (WhatsApp, création membre)
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "phone" TEXT;
