import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(__file__), "wms.db")

SCHEMA = """
CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  code TEXT, name TEXT, type TEXT,          -- B2B / B2C
  ingate_fee REAL,                          -- per-customer agreed in-gate fee (HKD/lot)
  storage_rate REAL                         -- HKD per pallet/day
);
CREATE TABLE zones (
  id INTEGER PRIMARY KEY, code TEXT, name TEXT, kind TEXT  -- storage / golden / cfs
);
CREATE TABLE bins (
  id INTEGER PRIMARY KEY, zone_id INTEGER, code TEXT,
  shelf TEXT, level INTEGER, gx INTEGER, gy INTEGER,        -- grid coords for map
  capacity INTEGER
);
CREATE TABLE skus (
  id INTEGER PRIMARY KEY, code TEXT, name TEXT, category TEXT,
  uom TEXT, weight_kg REAL, velocity REAL                   -- computed order velocity
);
CREATE TABLE inventory (
  id INTEGER PRIMARY KEY, sku_id INTEGER, bin_id INTEGER,
  lot TEXT, expiry TEXT, qty INTEGER
);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY, ref TEXT, channel TEXT,           -- B2B / B2C
  customer_id INTEGER, carrier TEXT, status TEXT,
  sla_hours INTEGER, created TEXT, value REAL
);
CREATE TABLE order_lines (
  id INTEGER PRIMARY KEY, order_id INTEGER, sku_id INTEGER, qty INTEGER
);
CREATE TABLE cfs_lots (
  id INTEGER PRIMARY KEY, lot_ref TEXT, customer_id INTEGER,
  consignee TEXT, cartons INTEGER, status TEXT,             -- INGATE/STAGING/OUTGATE/CLEARED
  ingate_time TEXT, outgate_time TEXT,
  ingate_fee REAL, fee_overridden INTEGER DEFAULT 0,
  bin_id INTEGER
);
CREATE TABLE cfs_lot_skus (
  id INTEGER PRIMARY KEY, lot_id INTEGER, sku_id INTEGER, cartons INTEGER
);
CREATE TABLE order_history (                                -- 90 day daily demand per sku
  id INTEGER PRIMARY KEY, sku_id INTEGER, day TEXT, qty INTEGER
);
CREATE TABLE fee_audit (
  id INTEGER PRIMARY KEY, lot_id INTEGER, old_fee REAL, new_fee REAL,
  manager TEXT, ts TEXT, note TEXT
);
"""

def get_db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys=ON")
    return con

def init_db():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    con = get_db()
    con.executescript(SCHEMA)
    con.commit()
    return con
