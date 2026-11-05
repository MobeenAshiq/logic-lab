-- Sign-up no longer verifies the email with a code. New accounts start as
-- `pending` and an admin approves them (pending -> active).

-- 1. New users are `active` unless the creating transaction asks for `pending`
--    (SELECT set_config('app.new_user_status', 'pending', true)), as signup does.
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO profiles (id, role, status, created_at, updated_at)
  VALUES (
    NEW.id,
    'student',
    CASE WHEN current_setting('app.new_user_status', true) = 'pending'
         THEN 'pending' ELSE 'active' END::"UserStatus",
    now(),
    now()
  );
  RETURN NEW;
END;
$$;

-- 2. Non-admins may insert a profile as `pending` (it has fewer rights than
--    `active`); every other role/status change still needs an admin.
CREATE OR REPLACE FUNCTION protect_profile_privileged_columns() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  actor_role text := current_setting('app.actor_role', true);
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.role <> 'student' OR NEW.status NOT IN ('active', 'pending') THEN
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

-- 3. Accounts that signed up but never entered their email code: send them to
--    the admin for approval instead of leaving them stuck.
SELECT set_config('app.actor_role', 'super_admin', false);
UPDATE profiles p SET status = 'pending'
FROM users u
WHERE u.id = p.id AND u.email_verified_at IS NULL AND p.status = 'active';
UPDATE users SET email_verified_at = now() WHERE email_verified_at IS NULL;
SELECT set_config('app.actor_role', '', false);
