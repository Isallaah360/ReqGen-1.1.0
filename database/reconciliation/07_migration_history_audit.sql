-- Read-only migration history inspection
select * from supabase_migrations.schema_migrations order by version;
