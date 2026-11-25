# MediFind Connect — Database & SQL Migration Framework

## 1. Core Philosophy: SQL as the Source of Truth
* **Database Decision:** Supabase PostgreSQL + Pure SQL migrations.
* **No Heavy ORM:** Object-Relational Mappers (ORMs) obscure fine-grained transaction control, PostGIS spatial queries, and PostgreSQL-native Row Level Security (RLS) policies.
* **Deterministic Versioning:** All schema changes are committed as sequential, timestamped SQL migration files.

## 2. Migration Directory Structure
```
database/
  migrations/
    20261125000000_initial_schema_template.sql
  seed/
    00_reference_data.sql
  README.md
```

## 3. Migration Naming Standard
Every migration file must adhere to:
```
<YYYYMMDDHHMMSS>_<descriptive_snake_case_action>.sql
```
Examples:
* `20261125120000_create_profiles_and_pharmacies.sql`
* `20261125130000_create_inventory_and_audit_history.sql`
* `20261125140000_create_transfers_and_state_machine.sql`
* `20261125150000_setup_rls_policies.sql`

## 4. Migration Lifecycle & Governance
1. **Drafting:** Person B creates a local `.sql` migration file in `database/migrations/`.
2. **Review:** Migrations must contain idempotent statements (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
3. **Execution:** Applied to Supabase using Supabase CLI (`supabase db push` or `supabase migration up`) or via the Supabase Dashboard SQL Editor during manual phases.
4. **Verification:** Query `supabase_migrations.schema_migrations` or verify table metadata.
5. **Rollbacks:** Destructive rollbacks (`DROP TABLE`) are strictly prohibited in production; corrective forward migrations must be authored instead.

## 5. Seed Data Protocol
* Test records, simulated Bhopal pharmacy coordinates, and drug formulary mock entries belong strictly in `database/seed/`.
* Seed files must never be applied to production databases.
