-- This script is run by the PostgreSQL bootstrap superuser during deployment.
-- Passwords are supplied as psql variables and quoted by psql, never interpolated by a shell.

SELECT format('CREATE ROLE stagetrack_migrator LOGIN PASSWORD %L', :'migrator_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'stagetrack_migrator')
\gexec
ALTER ROLE stagetrack_migrator WITH LOGIN PASSWORD :'migrator_password';

SELECT format('CREATE ROLE stagetrack_app LOGIN PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'stagetrack_app')
\gexec
ALTER ROLE stagetrack_app WITH LOGIN PASSWORD :'app_password';

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Transfer application objects from the previous bootstrap-owned deployment, without
-- changing ownership of the database or other databases in the PostgreSQL cluster.
DO $$
DECLARE
  object_name record;
  bootstrap_oid oid := (SELECT oid FROM pg_roles WHERE rolname = current_user);
BEGIN
  FOR object_name IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tableowner = current_user
  LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO stagetrack_migrator', object_name.tablename);
  END LOOP;

  FOR object_name IN
    SELECT c.relname AS sequence_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'S' AND c.relowner = bootstrap_oid
  LOOP
    EXECUTE format('ALTER SEQUENCE public.%I OWNER TO stagetrack_migrator', object_name.sequence_name);
  END LOOP;

  FOR object_name IN
    SELECT typname FROM pg_type
    WHERE typnamespace = 'public'::regnamespace AND typtype = 'e' AND typowner = bootstrap_oid
  LOOP
    EXECUTE format('ALTER TYPE public.%I OWNER TO stagetrack_migrator', object_name.typname);
  END LOOP;

  FOR object_name IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS arguments
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proowner = bootstrap_oid
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid
          AND d.refclassid = 'pg_extension'::regclass AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION public.%I(%s) OWNER TO stagetrack_migrator', object_name.proname, object_name.arguments);
  END LOOP;
END $$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE :"database_name" TO stagetrack_migrator, stagetrack_app;
GRANT CREATE ON DATABASE :"database_name" TO stagetrack_migrator;
GRANT USAGE, CREATE ON SCHEMA public TO stagetrack_migrator;
GRANT USAGE ON SCHEMA public TO stagetrack_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO stagetrack_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO stagetrack_app;

ALTER DEFAULT PRIVILEGES FOR ROLE stagetrack_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO stagetrack_app;
ALTER DEFAULT PRIVILEGES FOR ROLE stagetrack_migrator IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO stagetrack_app;
