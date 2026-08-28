-- Concede permisos al rol service_role sobre el esquema porra.
-- (Necesario para el importador / edge function. Ejecutar UNA vez.)
grant usage on schema porra to service_role;
grant all privileges on all tables in schema porra to service_role;
grant all privileges on all sequences in schema porra to service_role;
grant all privileges on all functions in schema porra to service_role;
