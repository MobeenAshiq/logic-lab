-- AlterEnum (own migration: a new enum value can't be used in the transaction that adds it)
ALTER TYPE "UserStatus" ADD VALUE 'pending';
