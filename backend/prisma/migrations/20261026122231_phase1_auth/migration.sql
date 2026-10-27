-- CreateEnum
CREATE TYPE "Role" AS ENUM ('student', 'mentor', 'admin', 'super_admin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'banned');

-- CreateEnum
CREATE TYPE "AuthTokenPurpose" AS ENUM ('verify_email', 'reset_password');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "google_id" TEXT,
    "email_verified_at" TIMESTAMPTZ,
    "totp_secret" TEXT,
    "totp_enabled_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL DEFAULT '',
    "avatar_url" TEXT,
    "role" "Role" NOT NULL DEFAULT 'student',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "banned_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip" TEXT,
    "mfa_verified_at" TIMESTAMPTZ,
    "last_used_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "revoked_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" "AuthTokenPurpose" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "consumed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE INDEX "profiles_role_idx" ON "profiles"("role");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_revoked_at_idx" ON "user_sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "auth_tokens_user_id_purpose_idx" ON "auth_tokens"("user_id", "purpose");

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_idx" ON "audit_logs"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Phase 1: database-level rules (hand-written, keep below the generated DDL)
-- ---------------------------------------------------------------------------

-- 1. Every new user gets a profile row with role = student.
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO profiles (id, role, status, created_at, updated_at)
  VALUES (NEW.id, 'student', 'active', now(), now());
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_user_created
AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. role / status / banned_reason can only be changed by an admin.
-- The API sets `app.actor_role` (transaction-local) only inside admin-guarded code paths,
-- so even a direct API call or a bug in a user-facing endpoint cannot escalate a role.
CREATE OR REPLACE FUNCTION protect_profile_privileged_columns() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  actor_role text := current_setting('app.actor_role', true);
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.role <> 'student' OR NEW.status <> 'active' THEN
      IF actor_role IS NULL OR actor_role NOT IN ('admin', 'super_admin') THEN
        RAISE EXCEPTION 'only admins can set role or status' USING ERRCODE = '42501';
      END IF;
    END IF;
  ELSIF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.banned_reason IS DISTINCT FROM OLD.banned_reason THEN
    IF actor_role IS NULL OR actor_role NOT IN ('admin', 'super_admin') THEN
      RAISE EXCEPTION 'only admins can change role or status' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_protect_privileged_columns
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION protect_profile_privileged_columns();

-- 3. audit_logs is insert-only.
CREATE OR REPLACE FUNCTION audit_logs_insert_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is insert-only' USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER audit_logs_no_update_delete
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION audit_logs_insert_only();

CREATE TRIGGER audit_logs_no_truncate
BEFORE TRUNCATE ON audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_insert_only();
