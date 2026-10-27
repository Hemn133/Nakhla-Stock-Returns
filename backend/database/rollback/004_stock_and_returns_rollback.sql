-- =====================================================================
-- EMERGENCY ROLLBACK of migration 004 (returns + stock)
--
-- !!! THIS DELETES EVERY RETURN RECORD AND EVERY STOCK NUMBER !!!
-- Customer debts would go back to "credit sales - payments" and the
-- refunds / returns would disappear from the reports.
-- Use it only if you have not started using returns, or you have a backup.
-- It is never run automatically.
--
-- Run it in pgAdmin (Query Tool on nakhla_db), then also restore the
-- previous backend / client code (the new code needs these tables).
-- =====================================================================
BEGIN;

DROP TABLE IF EXISTS wasl_return_items;
DROP TABLE IF EXISTS wasl_returns;

ALTER TABLE wasl_items DROP CONSTRAINT IF EXISTS wasl_items_returned_within_quantity;
ALTER TABLE wasl_items DROP COLUMN IF EXISTS returned_quantity;
ALTER TABLE wasl_items DROP COLUMN IF EXISTS unit_id;

ALTER TABLE product_units DROP COLUMN IF EXISTS stock_quantity;

DELETE FROM schema_migrations WHERE name = '004_stock_and_returns.sql';

COMMIT;
