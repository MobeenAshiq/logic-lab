-- Payment slips are optional: admins can verify by transaction ID alone.
ALTER TABLE "payments" ALTER COLUMN "slip_key" DROP NOT NULL;
