"""Part 2: populate inventory, orders, 90-day history, CFS lots. Run after seed.seed()."""
import random, datetime as dt
from .db import get_db

random.seed(7)
TODAY = dt.date(2026, 6, 23)
CARRIERS = ["SF Express", "Lalamove", "HK Post", "DHL eCommerce", "Gogovan", "Kerry Logistics"]

def seed2():
    con = get_db(); cur = con.cursor()
    skus = [dict(r) for r in cur.execute("SELECT * FROM skus")]
    # storage bins only (exclude CFS + golden initially)
    store_bins = [dict(r) for r in cur.execute(
        "SELECT b.* FROM bins b JOIN zones z ON b.zone_id=z.id WHERE z.kind='storage'")]
    golden = [dict(r) for r in cur.execute(
        "SELECT b.* FROM bins b JOIN zones z ON b.zone_id=z.id WHERE z.kind='golden'")]
    cfs_bins = [dict(r) for r in cur.execute(
        "SELECT b.* FROM bins b JOIN zones z ON b.zone_id=z.id WHERE z.kind='cfs'")]

    # assign each SKU a "true" velocity (some fast, some slow)
    for s in skus:
        s["v"] = round(random.uniform(2, 60), 1)

    # 90-day demand history (Poisson-ish around velocity, weekly seasonality)
    for s in skus:
        for d in range(90):
            day = TODAY - dt.timedelta(days=90 - d)
            base = s["v"] / 7.0
            wk = 1.4 if day.weekday() in (0, 4) else 1.0  # Mon/Fri spikes
            qty = max(0, int(random.gauss(base * wk, base * 0.4)))
            cur.execute("INSERT INTO order_history(sku_id,day,qty) VALUES(?,?,?)",
                        (s["id"], day.isoformat(), qty))
        cur.execute("UPDATE skus SET velocity=? WHERE id=?", (s["v"], s["id"]))
    con.commit()

    # place inventory: fast movers NOT yet in golden zone (so AI slotting has work to do)
    bins_pool = store_bins[:]
    random.shuffle(bins_pool)
    bi = 0
    for s in skus:
        fast = s["v"] >= 40
        n_bins = 1 if (s["v"] < 20 or fast) else 2
        for _ in range(n_bins):
            b = bins_pool[bi % len(bins_pool)]; bi += 1
            if fast:                   # fast movers kept lean -> trigger replenishment alerts
                qty = random.randint(20, 45)
            else:
                qty = random.randint(60, b["capacity"] * 10)
            lot = f"L{random.randint(1000,9999)}"
            exp = (TODAY + dt.timedelta(days=random.randint(60, 720))).isoformat()
            cur.execute("""INSERT INTO inventory(sku_id,bin_id,lot,expiry,qty)
                           VALUES(?,?,?,?,?)""", (s["id"], b["id"], lot, exp, qty))
    con.commit()

    # B2B + B2C orders (open + recent)
    custs = [dict(r) for r in cur.execute("SELECT * FROM customers")]
    b2b = [c for c in custs if c["type"] == "B2B"]
    b2c = [c for c in custs if c["type"] == "B2C"]
    statuses = ["NEW", "ALLOCATED", "PICKING", "PACKING", "SHIPPED"]
    oid = 0
    for i in range(40):
        oid += 1
        is_b2b = i % 3 == 0
        cust = random.choice(b2b if is_b2b else b2c)
        ch = "B2B" if is_b2b else "B2C"
        sla = random.choice([72, 120]) if is_b2b else random.choice([12, 24])
        st = random.choice(statuses)
        created = TODAY - dt.timedelta(hours=random.randint(1, 60))
        ref = f"{'DO' if is_b2b else 'PCL'}-{26000+oid}"
        carrier = random.choice(CARRIERS)
        cur.execute("""INSERT INTO orders(ref,channel,customer_id,carrier,status,sla_hours,created,value)
                       VALUES(?,?,?,?,?,?,?,?)""",
                    (ref, ch, cust["id"], carrier, st, sla, created.isoformat(), 0))
        nlines = random.randint(2, 6) if is_b2b else random.randint(1, 3)
        val = 0
        for _ in range(nlines):
            s = random.choice(skus)
            q = random.randint(5, 40) if is_b2b else random.randint(1, 4)
            cur.execute("INSERT INTO order_lines(order_id,sku_id,qty) VALUES(?,?,?)", (oid, s["id"], q))
            val += q * random.uniform(15, 120)
        cur.execute("UPDATE orders SET value=? WHERE id=?", (round(val, 1), oid))
    con.commit()

    # CFS lots: whole-lot in/out, 1-2 day dwell
    consignees = ["Shenzhen Bay Imports", "Guangzhou Retail Grp", "Macau Duty Free",
                  "Zhuhai Trading", "Dongguan Mfg Co", "HK Airport Logistics"]
    lid = 0
    for i in range(8):
        lid += 1
        cust = random.choice(b2b)
        ingate = TODAY - dt.timedelta(days=random.randint(0, 3),
                                      hours=random.randint(0, 20))
        age_days = (dt.datetime.combine(TODAY, dt.time()) -
                    dt.datetime.combine(ingate, dt.time())).days
        if age_days >= 2:
            status = random.choice(["OUTGATE", "CLEARED"])
        elif age_days == 1:
            status = random.choice(["STAGING", "OUTGATE"])
        else:
            status = random.choice(["INGATE", "STAGING"])
        outgate = None
        if status in ("OUTGATE", "CLEARED"):
            outgate = (ingate + dt.timedelta(days=random.randint(1, 2))).isoformat()
        cartons = random.randint(40, 600)
        bin_id = random.choice(cfs_bins)["id"] if status in ("STAGING","OUTGATE") else None
        cur.execute("""INSERT INTO cfs_lots(lot_ref,customer_id,consignee,cartons,status,
                       ingate_time,outgate_time,ingate_fee,fee_overridden,bin_id)
                       VALUES(?,?,?,?,?,?,?,?,?,?)""",
                    (f"CFS-{260000+lid}", cust["id"], random.choice(consignees), cartons,
                     status, ingate.isoformat(), outgate, cust["ingate_fee"], 0, bin_id))
        # SKU detail inside the lot
        for _ in range(random.randint(2, 4)):
            s = random.choice(skus)
            cur.execute("INSERT INTO cfs_lot_skus(lot_id,sku_id,cartons) VALUES(?,?,?)",
                        (lid, s["id"], random.randint(5, cartons // 2)))
    con.commit()
    con.close()
    print("seed part2 ok")

if __name__ == "__main__":
    seed2()
