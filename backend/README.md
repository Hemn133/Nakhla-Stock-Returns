# Nakhla Backend

Node.js + Express + PostgreSQL. All money is **USD**. Customers can buy on credit
and pay in installments.

    backend/
    ├── config/db.js                      PostgreSQL connection pool
    ├── controllers/
    │   ├── productController.js
    │   ├── waslController.js             cash + credit wasls, reports, stock on sale
    │   ├── waslReturnController.js       product returns (one transaction)
    │   ├── customerController.js         customers, credit history, statement
    │   └── customerPaymentController.js  installments
    ├── models/                           SQL queries only
    │   ├── productModel.js, productUnitModel.js
    │   ├── waslModel.js, waslItemModel.js, waslReturnModel.js
    │   ├── customerModel.js, customerPaymentModel.js, customerStatementModel.js
    ├── routes/                           productRoutes, waslRoutes, customerRoutes
    ├── utils/numbers.js                  Arabic digits -> 0-9, money in cents
    ├── utils/returns.js                  the money rules of a return (no database)
    ├── database/
    │   ├── schema.sql                    a NEW database
    │   ├── migrations/003_usd_only_and_customers.sql   dinar -> USD, customers, credit
    │   ├── migrations/004_stock_and_returns.sql        returns + optional stock
    │   ├── rollback/004_stock_and_returns_rollback.sql emergency undo (deletes returns)
    │   ├── setup.js  migrate.js  audit.js  check.js  reset.js
    └── server.js

## A. New database (nothing to keep)

1. Create it as UTF8 (pgAdmin Query Tool on the `postgres` database):

       CREATE DATABASE nakhla_db
           WITH ENCODING 'UTF8'
           LC_COLLATE 'C' LC_CTYPE 'C'
           TEMPLATE template0;

2. In this folder: `npm install`, copy `.env.example` to `.env` and put your
   password in `DB_PASSWORD`, then:

       npm run db:setup
       npm run db:check
       npm run dev

## B. Existing database (you already have products and wasls)

The old tables have dinar columns. **Do not run `db:setup` on it** (it refuses).
Upgrade it with the migration. Nothing is deleted before the original dinar
figures are copied into `legacy_iqd_*` tables, and the whole migration is one
transaction: if it fails, nothing changes.

### 1. Stop the backend, then make a backup

pgAdmin: right-click `nakhla_db` -> **Backup...** -> Format `Custom`, choose a file.
Or in a terminal (adjust the PostgreSQL version in the path):

    "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" -U postgres -F c -f nakhla_backup.dump nakhla_db

To go back to the backup later: pgAdmin -> right-click the database -> **Restore...**

### 2. See what will be converted (read-only)

    npm run db:audit

It prints how many product prices exist **only in dinar**, and for every dinar
wasl the exchange rate that was saved on it.

### 3. Decide the rate for dinar-only product prices

A product price that was saved only in dinar has no dollar price, so it needs a
conversion rate. The migration **never guesses it** and stops until you choose one
(in pgAdmin Query Tool on `nakhla_db`):

    INSERT INTO settings (key, value) VALUES ('usd_migration_rate', '1500')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

(Put your own number: dinar for 1 dollar. If the audit says 0 dinar-only prices,
skip this step.) Review those prices afterwards: a small dinar price becomes a
rounded dollar price (for example 250 / 1500 = 0.17).

How the rest is converted:

| Data | Conversion |
|---|---|
| Product price saved in dollars | kept as it is |
| Product price saved only in dinar | dinar / the rate you chose, 2 decimals |
| A wasl made in dollars | kept as it is |
| A wasl made in dinar | each amount / **the rate saved on that wasl** (the rate of that day, not today's rate); its total is the dollar total that was already saved with it |

Old dinar wasls can differ by a few cents between "sum of the lines" and the
total, because the dinar amounts were rounded to whole dinar.

### 4. Try it on a copy first (recommended)

Stop the backend (a database must have no connections to be copied), then in pgAdmin:

    CREATE DATABASE nakhla_test TEMPLATE nakhla_db;

PowerShell, in this folder:

    $env:DB_NAME="nakhla_test"
    npm run db:migrate
    npm run db:check

macOS / Linux:  `DB_NAME=nakhla_test npm run db:migrate` and `DB_NAME=nakhla_test npm run db:check`.
Open the test database in pgAdmin and look at the products and wasls. Delete it when done:
`DROP DATABASE nakhla_test;`

### 5. Migrate the real database

    Remove-Item Env:DB_NAME     (PowerShell, only if you set it above)
    npm run db:migrate
    npm run db:check
    npm run dev

`db:check` tests the new SQL inside a transaction that is rolled back, so it
leaves no test data in your database.

## C. Adding product returns + stock (migration 004)

Use this when your database already has migration 003 (USD only + customers).
Migration 004 only **adds** things: it does not change a single existing sale,
customer, payment or balance. It runs in one transaction (all or nothing).

What it adds: `product_units.stock_quantity` (optional), `wasl_items.unit_id`,
`wasl_items.returned_quantity` (a CHECK keeps it between 0 and the quantity sold),
and the tables `wasl_returns` and `wasl_return_items`.

### In the VS Code terminal (Terminal -> New Terminal), folder `backend`

1. Stop the backend (Ctrl+C in its terminal).
2. Make a backup: pgAdmin -> right-click `nakhla_db` -> **Backup...** (Format: Custom).
3. Apply it:

       npm run db:migrate

   You should see `Already applied: 003_usd_only_and_customers.sql` and then
   `Applied 004_stock_and_returns.sql`. If it says 003 is not applied yet, follow
   section B first.
4. Test it (leaves no test data behind):

       npm run db:check

5. `npm run dev` again, and refresh the browser with Ctrl+F5.

### Or in pgAdmin only (without npm)

Open `database/migrations/004_stock_and_returns.sql` in pgAdmin -> Query Tool on
`nakhla_db` -> run it (F5). Then run this one line, so `db:migrate` knows it is done:

    INSERT INTO schema_migrations (name) VALUES ('004_stock_and_returns.sql') ON CONFLICT (name) DO NOTHING;

Check it worked:

    SELECT to_regclass('wasl_returns'), to_regclass('wasl_return_items');
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'wasl_items' AND column_name IN ('unit_id', 'returned_quantity');

Emergency undo: `database/rollback/004_stock_and_returns_rollback.sql` (it deletes
all returns and stock numbers; restoring the backup is safer).

### Stock

Stock is **optional per unit**. Nothing changes for a product until you type a
number in the "stock" box of one of its units (Products -> Edit). An empty box
means "stock is not tracked" for that unit.
For a tracked unit: a sale takes quantity off (a sale above the stock is refused),
a return puts it back, deleting a wasl puts it back. Editing a product keeps its
units (and their stock) because units are updated in place.
Old wasl lines are linked to their unit when product + unit name match exactly one
unit, so returns of old sales can restore stock too.

## D. How returns work (the money rules)

A return is recorded in `wasl_returns` (+ `wasl_return_items`). **The original wasl
is never edited.** One request can return one product, several, or the whole wasl.

* **Quantity:** a line can never return more than `quantity - returned_quantity`.
  The server checks it, and the database CHECK refuses it even if the code did not.
* **Duplicates:** every return has a `request_id` (UNIQUE). A double click or a
  repeated request is recognised and answers `duplicate: true` without adding
  stock or money again.
* **Cash wasl:** the amount is refunded in cash (`refund_amount`).
* **Credit wasl:** the amount first lowers the customer's debt (`debt_reduction`,
  never below 0). Only what the debt cannot take (the customer already paid it) is
  refunded in cash. A return is never recorded as a payment.
  `debt = credit wasls - payments - debt_reduction of returns`, always calculated.
* **Discount:** the discount of a cash wasl is shared in proportion, so a refund is
  never more than was paid, and all returns of a wasl add up to exactly its total.
* **Receipt status:** `return_status` is worked out from the real returned
  quantities: `none`, `partial`, or `full` (every line fully returned).
* **A wasl that has returns cannot be deleted** (it is financial history).
* Payments are account-level (not tied to one sale), so a return of a credit
  wasl lowers the customer's total debt, and cash is refunded only when the
  total debt is already 0.

Reports: `net_usd = total_usd - returns_usd`; `cash_usd = cash sales + installments
- cash refunds`. Best-sellers use the quantity and value that were kept.

## E. API

All amounts are USD. Numbers can be sent as numbers or as text with Arabic digits.

### Products
`GET /api/products`, `GET/PUT/DELETE /api/products/:id`, `POST /api/products`

    { "name": "Coal", "units": [ { "unit_id": 7, "unit_name": "Box", "price_usd": 12.5, "stock_quantity": 10 } ] }

`stock_quantity` is optional (empty/null = not tracked). Send `unit_id` for an
existing unit so it keeps its id and its stock.

### Wasl (receipts)
`POST /api/wasls`, `GET /api/wasls?limit=300`, `GET/DELETE /api/wasls/:id`

    cash:   { "customer_name": "Ali", "discount": 0.5, "items": [ ... ] }
    credit: { "sale_type": "credit", "customer_id": 3, "items": [ ... ] }
    items:  { "unit_id": 7, "quantity": 2 }   or   { "name": "x", "price": 1.25, "quantity": 3 }

A credit wasl needs a customer and cannot have a discount. A credit wasl can only
be deleted while the customer has not paid more than what would remain, and no wasl
with returns can be deleted. `GET /api/wasls/:id` also returns the lines with their
`returned_quantity`, the `returns` and the `return_status`.

### Returns
| Method | Path | |
|---|---|---|
| POST | `/api/wasls/:id/returns` | make a return |
| GET | `/api/wasls/:id/returns` | the returns of a wasl |
| GET | `/api/customers/:id/returns` | returns of the customer's credit wasls |

    { "request_id": "any-unique-text", "note": "", "items": [ { "wasl_item_id": 12, "quantity": 1 } ] }

Answers: `201 { return, return_status, balance_after }`, `200 { duplicate: true, ... }`,
`409 { code: "EXCEEDS_ELIGIBLE" }` when more than what is left is asked.

### Customers
| Method | Path | |
|---|---|---|
| GET / POST | `/api/customers` | list with totals / create |
| GET | `/api/customers/summary` | number of debtors, total outstanding |
| GET / PUT / DELETE | `/api/customers/:id` | a customer cannot be deleted if it has sales or payments |
| GET | `/api/customers/:id/sales` | credit sales |
| GET / POST | `/api/customers/:id/payments` | installments `{ "amount": 10, "paid_on": "2026-10-14", "note": "" }` |
| DELETE | `/api/customers/:id/payments/:paymentId` | |
| GET | `/api/customers/:id/statement` | complete statement |
| GET | `/api/customers/:id/statement?from=2026-10-01&to=2026-10-31` | period statement |

The debt is never stored, it is always `credit wasls - payments`. A payment cannot
be larger than the debt. Payments never touch products.

The statement returns `opening_balance` (debt before `from`), `total_owed`
(opening + credit sold in the period), `total_paid`, `total_returned` (what returns
took off the debt) and `remaining = total_owed - total_paid - total_returned`.
Rows are `sale`, `payment`, `return` (a returned product) and `refund` (the part
of a return that was paid back in cash).

### Reports
`GET /api/wasls/reports/summary | today | by-date | top-products`
(`total_usd`, `credit_usd`, `payments_usd`, `returns_usd`, `refunds_usd`,
`net_usd` and `cash_usd`, see section D).
