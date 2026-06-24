"""Seed realistic Yuen Long warehouse data for the Chainova WMS demo."""
import random, datetime as dt
from .db import init_db

random.seed(42)
TODAY = dt.date(2026, 6, 23)

CARRIERS = ["SF Express", "Lalamove", "HK Post", "DHL eCommerce", "Gogovan", "Kerry Logistics"]

CUSTOMERS = [
    # code, name, type, ingate_fee(HKD/lot), storage_rate(HKD/pallet/day)
    ("CW-LUX",  "Lux Trading (HK) Ltd",        "B2B", 480, 28),
    ("CW-MED",  "MediFast Distribution",        "B2B", 650, 35),
    ("CW-FMCG", "Pearl River FMCG Co.",         "B2B", 380, 22),
    ("CW-ELEC", "Kowloon Electronics Wholesale","B2B", 520, 30),
    ("CW-COSM", "Belle Cosmetics Import",       "B2B", 600, 33),
    ("HKTV",    "HKTV Mall Fulfilment",         "B2C", 0,   0),
    ("SHOPEE",  "Shopee Cross-border",          "B2C", 0,   0),
    ("SHOPIFY", "DTC Shopify Brands",           "B2C", 0,   0),
]

SKU_CATS = {
    "Health & Beauty": ["Collagen Serum 30ml", "Vitamin C Tablets 60s", "Sunscreen SPF50",
                         "Facial Mask Box", "Hand Cream 75ml"],
    "Electronics": ["Bluetooth Earbuds", "USB-C Charger 65W", "Power Bank 10000mAh",
                    "Smart Watch Band", "Phone Case Clear"],
    "FMCG / Grocery": ["Premium Oolong Tea 250g", "Manuka Honey 500g", "Olive Oil 1L",
                       "Instant Noodle Pack", "Mineral Water 24pk"],
    "Apparel": ["Cotton T-Shirt M", "Sports Socks 5pk", "Cap Adjustable",
                "Linen Scarf", "Canvas Tote Bag"],
    "Home": ["Ceramic Mug Set", "LED Desk Lamp", "Storage Box 20L",
             "Bamboo Cutlery Set", "Scented Candle"],
    "Pharma": ["Paracetamol 500mg 100s", "Vitamin D3 Drops", "First-Aid Kit",
               "Thermometer Digital", "Face Mask 50pk"],
}

def seed():
    con = init_db()
    cur = con.cursor()

    for c in CUSTOMERS:
        cur.execute("INSERT INTO customers(code,name,type,ingate_fee,storage_rate) VALUES(?,?,?,?,?)", c)

    # Zones: storage A-D, golden zone G (near packing), CFS shed
    zones = [("A","Zone A - Bulk Storage","storage"),
             ("B","Zone B - Bulk Storage","storage"),
             ("C","Zone C - Pick Face","storage"),
             ("D","Zone D - Pick Face","storage"),
             ("G","Golden Zone (near despatch)","golden"),
             ("CFS","CFS Transit Shed","cfs")]
    for z in zones:
        cur.execute("INSERT INTO zones(code,name,kind) VALUES(?,?,?)", z)
    con.commit()

    # Bins laid out on an 18-wide grid. Each storage zone = block of shelves.
    zrows = {r["code"]: r["id"] for r in cur.execute("SELECT id,code FROM zones")}
    bin_id = 0
    layout = [("A", 0, 0), ("B", 0, 5), ("C", 10, 0), ("D", 10, 5), ("G", 6, 9)]
    for zc, ox, oy in layout:
        shelves = 5 if zc != "G" else 4
        for s in range(shelves):
            for lvl in range(1, 4):  # 3 levels per shelf
                gx = ox + s
                gy = oy + (lvl - 1)
                cap = 12 if zc in ("A", "B") else 8
                code = f"{zc}-{s+1:02d}-{lvl}"
                cur.execute("""INSERT INTO bins(zone_id,code,shelf,level,gx,gy,capacity)
                               VALUES(?,?,?,?,?,?,?)""",
                            (zrows[zc], code, f"{zc}{s+1:02d}", lvl, gx, gy, cap))
    # CFS staging slots
    for i in range(6):
        cur.execute("""INSERT INTO bins(zone_id,code,shelf,level,gx,gy,capacity)
                       VALUES(?,?,?,?,?,?,?)""",
                    (zrows["CFS"], f"CFS-S{i+1}", f"CFS{i+1}", 1, i, 14, 100))
    con.commit()

    sid = 1
    for cat, names in SKU_CATS.items():
        for n in names:
            wt = round(random.uniform(0.1, 4.0), 2)
            cur.execute("""INSERT INTO skus(code,name,category,uom,weight_kg,velocity)
                           VALUES(?,?,?,?,?,?)""",
                        (f"SKU{sid:04d}", n, cat, "EA", wt, 0))
            sid += 1
    con.commit()
    con.close()
    print("seed part1 ok")

if __name__ == "__main__":
    seed()
