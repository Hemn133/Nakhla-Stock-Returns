-- =====================================================================
-- 003 - USD only + customers, credit sales and payments
--
-- For a database created with the earlier Nakhla schema (dinar + dollar).
-- Run with:  npm run db:migrate      (make a backup first - see README)
--
-- What it does
--   1. Stops if a product price exists only in dinar and no conversion rate
--      was chosen (it never guesses an exchange rate).
--   2. Copies every original dinar figure into legacy_iqd_* tables.
--   3. Converts products, wasls and wasl items to USD.
--   4. Removes the dinar columns, the currencies table and the exchange rate.
--   5. Adds customers, credit sales (wasls.sale_type) and customer_payments.
--
-- It runs inside ONE transaction: if anything fails, nothing is changed.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Never guess an exchange rate
-- ---------------------------------------------------------------------
DO $$
DECLARE
    iqd_only_units INTEGER;
    rate_text TEXT;
BEGIN
    SELECT COUNT(*) INTO iqd_only_units
    FROM product_units
    WHERE price_usd IS NULL;

    SELECT value INTO rate_text
    FROM settings
    WHERE key = 'usd_migration_rate';

    IF iqd_only_units > 0 AND (
        rate_text IS NULL
        OR rate_text !~ '^[0-9]+(\.[0-9]+)?$'
        OR CASE WHEN rate_text ~ '^[0-9]+(\.[0-9]+)?$'
                THEN rate_text::NUMERIC ELSE 0 END <= 0
    ) THEN
        RAISE EXCEPTION E'MIGRATION STOPPED - nothing was changed.\n% product price(s) exist only in dinar, so they need a conversion rate.\nDecide the rate (dinar for 1 USD) and run this once:\n  INSERT INTO settings (key, value) VALUES (''usd_migration_rate'', ''1500'') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;\nThen run the migration again.', iqd_only_units;
    END IF;
END $$;


-- ---------------------------------------------------------------------
-- 1. Keep the original dinar figures (read-only history)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS legacy_iqd_product_units AS
    SELECT unit_id, product_id, unit_name, price_iqd, price_usd
    FROM product_units;

CREATE TABLE IF NOT EXISTS legacy_iqd_wasls AS
    SELECT wasl_id, currency, exchange_rate, subtotal, discount, total,
           other_total, total_iqd, total_usd
    FROM wasls;

CREATE TABLE IF NOT EXISTS legacy_iqd_wasl_items AS
    SELECT wasl_item_id, wasl_id, unit_price, price_iqd, price_usd, subtotal
    FROM wasl_items;

COMMENT ON TABLE legacy_iqd_product_units IS 'Original product prices before the USD-only migration (003).';
COMMENT ON TABLE legacy_iqd_wasls IS 'Original wasl amounts (in each wasl currency) before the USD-only migration (003).';
COMMENT ON TABLE legacy_iqd_wasl_items IS 'Original wasl item amounts before the USD-only migration (003).';


-- ---------------------------------------------------------------------
-- 2. Customers and payments
-- ---------------------------------------------------------------------
CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL CHECK (btrim(name) <> ''),
    phone       VARCHAR(30),
    address     VARCHAR(255),
    notes       TEXT,
    search_text TEXT GENERATED ALWAYS AS
                    (normalize_text(name || ' ' || COALESCE(phone, ''))) STORED,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_search_text ON customers(search_text);

CREATE TABLE customer_payments (
    payment_id  SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL
                REFERENCES customers(customer_id) ON DELETE RESTRICT,
    amount      NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    paid_on     DATE NOT NULL DEFAULT CURRENT_DATE,
    note        VARCHAR(255),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customer_payments_customer
    ON customer_payments(customer_id, paid_on);


-- ---------------------------------------------------------------------
-- 3. Products: one price, in USD
-- ---------------------------------------------------------------------
UPDATE product_units
SET price_usd = ROUND(
        price_iqd / (SELECT value::NUMERIC FROM settings WHERE key = 'usd_migration_rate'),
        2
    )
WHERE price_usd IS NULL
  AND price_iqd IS NOT NULL;

ALTER TABLE product_units DROP CONSTRAINT IF EXISTS unit_has_a_price;
ALTER TABLE product_units ALTER COLUMN price_usd SET NOT NULL;
ALTER TABLE product_units DROP COLUMN price_iqd;


-- ---------------------------------------------------------------------
-- 4. Wasls: every amount becomes USD
--    A dinar wasl is converted with ITS OWN saved exchange rate
--    (the rate that was used on the day), never with today's rate.
--    Its total is the USD total that was already saved with it.
-- ---------------------------------------------------------------------
UPDATE wasls
SET subtotal = ROUND(subtotal / exchange_rate, 2),
    discount = ROUND(discount / exchange_rate, 2),
    total    = total_usd
WHERE currency = 'IQD';

UPDATE wasl_items i
SET unit_price = i.price_usd,
    subtotal   = ROUND(i.price_usd * i.quantity, 2)
FROM wasls w
WHERE w.wasl_id = i.wasl_id
  AND w.currency = 'IQD';


-- ---------------------------------------------------------------------
-- 5. Remove dinar and the exchange rate
-- ---------------------------------------------------------------------
ALTER TABLE wasl_items
    DROP COLUMN price_iqd,
    DROP COLUMN price_usd;

ALTER TABLE wasls
    DROP COLUMN currency,
    DROP COLUMN exchange_rate,
    DROP COLUMN other_total,
    DROP COLUMN total_iqd,
    DROP COLUMN total_usd;

DROP FUNCTION IF EXISTS format_money(NUMERIC, TEXT);
DROP FUNCTION IF EXISTS arabic_digits(TEXT);
DROP TABLE IF EXISTS currencies;
DELETE FROM settings WHERE key = 'exchange_rate';


-- ---------------------------------------------------------------------
-- 6. Credit sales: a wasl can be cash or credit
-- ---------------------------------------------------------------------
ALTER TABLE wasls
    ADD COLUMN customer_id INTEGER
        REFERENCES customers(customer_id) ON DELETE RESTRICT,
    ADD COLUMN sale_type VARCHAR(10) NOT NULL DEFAULT 'cash'
        CHECK (sale_type IN ('cash', 'credit'));

ALTER TABLE wasls
    ADD CONSTRAINT wasls_credit_has_customer
        CHECK (sale_type = 'cash' OR customer_id IS NOT NULL),
    ADD CONSTRAINT wasls_credit_has_no_discount
        CHECK (sale_type = 'cash' OR discount = 0);

CREATE INDEX idx_wasls_customer
    ON wasls(customer_id, created_at)
    WHERE customer_id IS NOT NULL;
