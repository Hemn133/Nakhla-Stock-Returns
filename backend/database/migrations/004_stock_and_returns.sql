-- =====================================================================
-- 004 - Product returns (گەڕاندنەوەی کاڵا) and optional stock
--
-- For a database that already has migration 003 applied.
-- Run with:  npm run db:migrate      (make a backup first - see README)
--
-- What it does
--   1. product_units.stock_quantity : optional stock of a unit.
--        NULL = stock is not tracked (every existing unit starts like this,
--        so nothing changes until you type a stock number for a unit).
--   2. wasl_items.unit_id            : which unit was sold (needed to give the
--        stock back). Old lines are matched by product + unit name when that
--        is unambiguous.
--   3. wasl_items.returned_quantity  : how much of the line was returned.
--        A CHECK keeps it between 0 and the quantity sold, so the same
--        quantity can never be returned twice, whatever the code does.
--   4. wasl_returns / wasl_return_items : the permanent record of every return.
--        The original wasl is never edited.
--
-- It runs inside ONE transaction: if anything fails, nothing is changed.
-- Existing wasls, items, customers, payments and balances are not modified.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Optional stock per unit
-- ---------------------------------------------------------------------
ALTER TABLE product_units
    ADD COLUMN stock_quantity NUMERIC(12, 3)
        CHECK (stock_quantity IS NULL OR stock_quantity >= 0);


-- ---------------------------------------------------------------------
-- 2. Wasl lines: the unit that was sold + how much was returned
-- ---------------------------------------------------------------------
ALTER TABLE wasl_items
    ADD COLUMN unit_id INTEGER
        REFERENCES product_units(unit_id) ON DELETE SET NULL;

-- Old lines: link them to their unit when product + unit name match exactly one unit
UPDATE wasl_items i
SET unit_id = m.unit_id
FROM (
    SELECT product_id, unit_name, MIN(unit_id) AS unit_id
    FROM product_units
    GROUP BY product_id, unit_name
    HAVING COUNT(*) = 1
) m
WHERE m.product_id = i.product_id
  AND m.unit_name = i.unit_name
  AND i.unit_id IS NULL;

ALTER TABLE wasl_items
    ADD COLUMN returned_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0;

ALTER TABLE wasl_items
    ADD CONSTRAINT wasl_items_returned_within_quantity
        CHECK (returned_quantity >= 0 AND returned_quantity <= quantity);

CREATE INDEX idx_wasl_items_unit_id ON wasl_items(unit_id);


-- ---------------------------------------------------------------------
-- 3. Returns
-- ---------------------------------------------------------------------

-- One row for every return (one or more products of one wasl).
--   goods_amount   : value of the returned goods at the prices on the wasl
--   net_amount     : the same after the wasl discount. This is what leaves net sales.
--   debt_reduction : the part that lowers the debt of a credit customer
--   refund_amount  : the part that is paid back in cash
-- A return is always: net_amount = debt_reduction + refund_amount.
-- request_id is made by the screen for every return, so a double click or a
-- repeated request can never be applied twice.
CREATE TABLE wasl_returns (
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

CREATE INDEX idx_wasl_returns_wasl_id ON wasl_returns(wasl_id);
CREATE INDEX idx_wasl_returns_created_at ON wasl_returns(created_at DESC);

-- The products of a return (price and amount are copied, they never change)
CREATE TABLE wasl_return_items (
    return_item_id SERIAL PRIMARY KEY,
    return_id      INTEGER NOT NULL
                   REFERENCES wasl_returns(return_id) ON DELETE CASCADE,
    wasl_item_id   INTEGER NOT NULL
                   REFERENCES wasl_items(wasl_item_id) ON DELETE RESTRICT,
    quantity       NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
    unit_price     NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0),
    amount         NUMERIC(14, 2) NOT NULL CHECK (amount >= 0)
);

CREATE INDEX idx_wasl_return_items_return_id ON wasl_return_items(return_id);
CREATE INDEX idx_wasl_return_items_wasl_item_id ON wasl_return_items(wasl_item_id);
