-- =====================================================================
-- Nakhla shop database  (PostgreSQL 12 or newer, database encoding UTF8)
--
--  * Money      : USD only
--  * Languages  : Central Kurdish (Sorani), Arabic and English text
--  * Customers  : credit sales (wasls with sale_type = 'credit') and payments
--  * Returns    : wasl_returns (the wasl itself is never edited), optional stock
--
-- This file is for a NEW database. A database created with the earlier
-- dinar + dollar schema is upgraded with:  npm run db:migrate
-- Safe to run more than once on a new database.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Database settings
-- ---------------------------------------------------------------------

-- "Today" in reports should start at midnight in Iraq.
-- (Applies to every new connection to this database.)
DO $$
BEGIN
    EXECUTE format(
        'ALTER DATABASE %I SET timezone TO %L',
        current_database(),
        'Asia/Baghdad'
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not set the database time zone: %', SQLERRM;
END $$;

-- Central Kurdish sorting (ئ ا ب پ ت ج چ ح خ د ر ڕ ز ژ ...).
-- Uses ICU when PostgreSQL has it, otherwise falls back to plain ordering.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_collation WHERE collname = 'kurdish') THEN
        BEGIN
            CREATE COLLATION kurdish (provider = icu, locale = 'ckb');
        EXCEPTION WHEN OTHERS THEN
            CREATE COLLATION kurdish FROM "C";
            RAISE NOTICE 'ICU is not available, Kurdish sorting uses plain ordering.';
        END;
    END IF;
END $$;


-- ---------------------------------------------------------------------
-- 2. Text and number helper functions
-- ---------------------------------------------------------------------

-- Arabic-Indic (٠-٩) and Persian (۰-۹) digits  ->  0-9
CREATE OR REPLACE FUNCTION normalize_digits(input TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
    SELECT translate(
        input,
        U&'\0660\0661\0662\0663\0664\0665\0666\0667\0668\0669\06F0\06F1\06F2\06F3\06F4\06F5\06F6\06F7\06F8\06F9',
        '01234567890123456789'
    )
$$;

-- Read a number written with any kind of digits and separators:
--   parse_number('١٬٢٣٤٫٥')  ->  1234.5
--   parse_number('1,500')     ->  1500
-- Returns NULL when the text is not a number.
CREATE OR REPLACE FUNCTION parse_number(input TEXT)
RETURNS NUMERIC
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
    SELECT CASE
        WHEN t.cleaned ~ '^-?[0-9]+(\.[0-9]+)?$' THEN t.cleaned::NUMERIC
        ELSE NULL
    END
    FROM (
        SELECT regexp_replace(
            replace(
                replace(normalize_digits(input), U&'\066B', '.'),
                U&'\066C',
                ''
            ),
            '[,\s]',
            '',
            'g'
        ) AS cleaned
    ) t
$$;

-- Text used for searching. Makes these the same word:
--   Arabic yeh ي / Kurdish yeh ی        Arabic kaf ك / Kurdish kaf ک
--   alef with hamza أ إ آ -> ا          teh marbuta ة -> ه
--   Arabic-Indic digits -> 0-9          diacritics, tatweel and ZWNJ removed
--   extra spaces removed, Latin letters lower-cased
CREATE OR REPLACE FUNCTION normalize_text(input TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
    SELECT lower(
        btrim(
            regexp_replace(
                regexp_replace(
                    translate(
                        normalize_digits(input),
                        U&'\064A\0649\0643\06BE\0623\0625\0622\0671\0629',
                        U&'\06CC\06CC\06A9\0647\0627\0627\0627\0627\0647'
                    ),
                    '[\u064B-\u065F\u0670\u0640\u200B-\u200F\u202A-\u202E]',
                    '',
                    'g'
                ),
                '\s+',
                ' ',
                'g'
            )
        )
    )
$$;


-- ---------------------------------------------------------------------
-- 3. Products (all prices are USD)
-- ---------------------------------------------------------------------

-- Product names can be Kurdish, Arabic or English.
-- search_text is filled automatically and is what searches should use.
CREATE TABLE IF NOT EXISTS products (
    product_id  SERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL CHECK (btrim(name) <> ''),
    search_text TEXT GENERATED ALWAYS AS (normalize_text(name)) STORED,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_search_text
    ON products(search_text);

-- Units of a product (دانە، بۆکس، کارتۆن / قطعة، علبة، كرتون ...)
CREATE TABLE IF NOT EXISTS product_units (
    unit_id    SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL
               REFERENCES products(product_id) ON DELETE CASCADE,
    unit_name  VARCHAR(50) NOT NULL CHECK (btrim(unit_name) <> ''),
    price_usd  NUMERIC(12, 2) NOT NULL CHECK (price_usd >= 0),
    position   INTEGER NOT NULL DEFAULT 0,
    -- stock of this unit. NULL = stock is not tracked for this unit.
    stock_quantity NUMERIC(12, 3)
               CHECK (stock_quantity IS NULL OR stock_quantity >= 0)
);

CREATE INDEX IF NOT EXISTS idx_product_units_product_id
    ON product_units(product_id);


-- ---------------------------------------------------------------------
-- 4. Customers and their payments
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS customers (
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

CREATE INDEX IF NOT EXISTS idx_customers_search_text
    ON customers(search_text);

-- Money received from a customer (an installment). It lowers the customer's
-- debt and never touches products. The debt is always calculated:
--   debt = credit wasls of the customer - payments of the customer
CREATE TABLE IF NOT EXISTS customer_payments (
    payment_id  SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL
                REFERENCES customers(customer_id) ON DELETE RESTRICT,
    amount      NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    paid_on     DATE NOT NULL DEFAULT CURRENT_DATE,
    note        VARCHAR(255),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_payments_customer
    ON customer_payments(customer_id, paid_on);


-- ---------------------------------------------------------------------
-- 5. Wasl (receipts)
-- ---------------------------------------------------------------------

-- wasl_id is also the receipt number shown to the customer.
-- sale_type 'cash'   : paid at once
-- sale_type 'credit' : added to the debt of customer_id (no discount allowed)
CREATE TABLE IF NOT EXISTS wasls (
    wasl_id       SERIAL PRIMARY KEY,
    customer_name VARCHAR(150),
    customer_id   INTEGER
                  REFERENCES customers(customer_id) ON DELETE RESTRICT,
    sale_type     VARCHAR(10) NOT NULL DEFAULT 'cash'
                  CHECK (sale_type IN ('cash', 'credit')),
    subtotal      NUMERIC(14, 2) NOT NULL CHECK (subtotal >= 0),
    discount      NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
    total         NUMERIC(14, 2) NOT NULL CHECK (total >= 0),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT wasls_credit_has_customer
        CHECK (sale_type = 'cash' OR customer_id IS NOT NULL),
    CONSTRAINT wasls_credit_has_no_discount
        CHECK (sale_type = 'cash' OR discount = 0)
);

CREATE INDEX IF NOT EXISTS idx_wasls_created_at
    ON wasls(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wasls_customer
    ON wasls(customer_id, created_at)
    WHERE customer_id IS NOT NULL;

-- Lines of a wasl. Name and price are copied from the product at the time of
-- the sale, so editing or deleting a product never changes old receipts.
CREATE TABLE IF NOT EXISTS wasl_items (
    wasl_item_id SERIAL PRIMARY KEY,
    wasl_id      INTEGER NOT NULL
                 REFERENCES wasls(wasl_id) ON DELETE CASCADE,
    product_id   INTEGER
                 REFERENCES products(product_id) ON DELETE SET NULL,
    unit_id      INTEGER
                 REFERENCES product_units(unit_id) ON DELETE SET NULL,
    product_name VARCHAR(150) NOT NULL CHECK (btrim(product_name) <> ''),
    unit_name    VARCHAR(50),
    quantity     NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
    unit_price   NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0),
    subtotal     NUMERIC(14, 2) NOT NULL CHECK (subtotal >= 0),
    -- how much of this line was returned. It can never go above quantity,
    -- so the same quantity can never be returned twice.
    returned_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0,
    CONSTRAINT wasl_items_returned_within_quantity
        CHECK (returned_quantity >= 0 AND returned_quantity <= quantity)
);

CREATE INDEX IF NOT EXISTS idx_wasl_items_wasl_id
    ON wasl_items(wasl_id);

CREATE INDEX IF NOT EXISTS idx_wasl_items_unit_id
    ON wasl_items(unit_id);


-- ---------------------------------------------------------------------
-- 6. Returns (گەڕاندنەوەی کاڵا)
-- ---------------------------------------------------------------------

-- One row for every return (one or more products of one wasl). The original
-- wasl is never edited.
--   goods_amount   : value of the returned goods at the prices on the wasl
--   net_amount     : the same after the wasl discount (what leaves net sales)
--   debt_reduction : the part that lowers the debt of a credit customer
--   refund_amount  : the part that is paid back in cash
-- request_id is made by the screen for every return, so a double click or a
-- repeated request can never be applied twice.
CREATE TABLE IF NOT EXISTS wasl_returns (
    return_id      SERIAL PRIMARY KEY,
    wasl_id        INTEGER NOT NULL
                   REFERENCES wasls(wasl_id) ON DELETE RESTRICT,
    request_id     VARCHAR(100) NOT NULL UNIQUE,
    goods_amount   NUMERIC(14, 2) NOT NULL CHECK (goods_amount >= 0),
    net_amount     NUMERIC(14, 2) NOT NULL CHECK (net_amount >= 0),
    debt_reduction NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (debt_reduction >= 0),
    refund_amount  NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (refund_amount >= 0),
    note           VARCHAR(255),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT wasl_returns_net_is_debt_plus_refund
        CHECK (net_amount = debt_reduction + refund_amount)
);

CREATE INDEX IF NOT EXISTS idx_wasl_returns_wasl_id
    ON wasl_returns(wasl_id);

CREATE INDEX IF NOT EXISTS idx_wasl_returns_created_at
    ON wasl_returns(created_at DESC);

-- The products of a return (price and amount are copied, they never change)
CREATE TABLE IF NOT EXISTS wasl_return_items (
    return_item_id SERIAL PRIMARY KEY,
    return_id      INTEGER NOT NULL
                   REFERENCES wasl_returns(return_id) ON DELETE CASCADE,
    wasl_item_id   INTEGER NOT NULL
                   REFERENCES wasl_items(wasl_item_id) ON DELETE RESTRICT,
    quantity       NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
    unit_price     NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0),
    amount         NUMERIC(14, 2) NOT NULL CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_wasl_return_items_return_id
    ON wasl_return_items(return_id);

CREATE INDEX IF NOT EXISTS idx_wasl_return_items_wasl_item_id
    ON wasl_return_items(wasl_item_id);
