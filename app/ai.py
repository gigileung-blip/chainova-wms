"""AI modules: pick-path optimisation, dynamic slotting, demand forecast + auto-replenish."""
import datetime as dt
from .db import get_db

TODAY = dt.date(2026, 6, 23)
DESPATCH = (8, 13)  # grid coords of packing/despatch door


def _dist(a, b):
    return abs(a[0] - b[0]) + abs(a[1] - b[1])  # Manhattan distance


def pick_path(order_id):
    """Nearest-neighbour TSP from despatch door through all pick bins and back."""
    con = get_db()
    rows = con.execute("""
        SELECT b.id bin_id, b.code, b.gx, b.gy, s.code sku, s.name, ol.qty
        FROM order_lines ol
        JOIN skus s ON s.id = ol.sku_id
        JOIN inventory inv ON inv.sku_id = ol.sku_id
        JOIN bins b ON b.id = inv.bin_id
        WHERE ol.order_id = ? GROUP BY ol.sku_id""", (order_id,)).fetchall()
    con.close()
    stops = [{"bin": r["code"], "sku": r["sku"], "name": r["name"],
              "qty": r["qty"], "xy": (r["gx"], r["gy"])} for r in rows]
    if not stops:
        return {"optimised": [], "naive_dist": 0, "opt_dist": 0, "saving_pct": 0}

    # naive = visit in SKU order
    naive = DESPATCH
    nd = 0
    for s in stops:
        nd += _dist(naive, s["xy"]); naive = s["xy"]
    nd += _dist(naive, DESPATCH)

    # optimised nearest-neighbour
    remaining = stops[:]
    cur = DESPATCH
    route = []
    od = 0
    while remaining:
        nxt = min(remaining, key=lambda s: _dist(cur, s["xy"]))
        od += _dist(cur, nxt["xy"])
        route.append(nxt)
        cur = nxt["xy"]
        remaining.remove(nxt)
    od += _dist(cur, DESPATCH)

    saving = round((nd - od) / nd * 100, 1) if nd else 0
    return {"despatch": DESPATCH, "optimised": route,
            "naive_dist": nd, "opt_dist": od, "saving_pct": saving}


def slotting_recommendations():
    """Recommend moving high-velocity SKUs into the golden zone."""
    con = get_db()
    golden_ids = [r["id"] for r in con.execute(
        "SELECT b.id FROM bins b JOIN zones z ON b.zone_id=z.id WHERE z.kind='golden'")]
    rows = con.execute("""
        SELECT s.id, s.code, s.name, s.velocity,
               b.code bin, z.kind zkind, inv.id inv_id
        FROM skus s
        JOIN inventory inv ON inv.sku_id = s.id
        JOIN bins b ON b.id = inv.bin_id
        JOIN zones z ON z.id = b.zone_id
        ORDER BY s.velocity DESC""").fetchall()
    con.close()
    recs = []
    seen = set()
    for r in rows:
        if r["id"] in seen:
            continue
        seen.add(r["id"])
        in_golden = r["zkind"] == "golden"
        if r["velocity"] >= 35 and not in_golden:
            recs.append({"sku": r["code"], "name": r["name"],
                         "velocity": r["velocity"], "current_bin": r["bin"],
                         "action": "MOVE → Golden Zone",
                         "reason": f"High velocity ({r['velocity']}/wk) in far bin {r['bin']}"})
    est_saving = min(25, 8 + len(recs) * 2)
    return {"recommendations": recs[:8], "golden_slots": len(golden_ids),
            "est_pick_travel_saving_pct": est_saving}


def forecast(sku_id, horizon=30):
    """Simple moving-average + weekly seasonality forecast with reorder alert."""
    con = get_db()
    hist = con.execute("SELECT day, qty FROM order_history WHERE sku_id=? ORDER BY day",
                       (sku_id,)).fetchall()
    sku = con.execute("SELECT * FROM skus WHERE id=?", (sku_id,)).fetchone()
    onhand = con.execute("SELECT COALESCE(SUM(qty),0) q FROM inventory WHERE sku_id=?",
                         (sku_id,)).fetchone()["q"]
    con.close()
    qtys = [h["qty"] for h in hist]
    if not qtys:
        return {}
    n = len(qtys)
    ma = sum(qtys[-14:]) / min(14, n)
    # weekday seasonality factors
    dow = {i: [] for i in range(7)}
    for h in hist:
        d = dt.date.fromisoformat(h["day"])
        dow[d.weekday()].append(h["qty"])
    overall = sum(qtys) / n
    factors = {k: (sum(v) / len(v) / overall if v and overall else 1) for k, v in dow.items()}

    fc = []
    cum = 0
    reorder_day = None
    daily_avg = ma
    for d in range(1, horizon + 1):
        day = TODAY + dt.timedelta(days=d)
        val = round(ma * factors.get(day.weekday(), 1), 1)
        cum += val
        if reorder_day is None and cum >= onhand:
            reorder_day = day.isoformat()
        fc.append({"day": day.isoformat(), "qty": val})
    hist_tail = [{"day": h["day"], "qty": h["qty"]} for h in hist[-30:]]
    return {"sku": sku["code"], "name": sku["name"], "onhand": onhand,
            "history": hist_tail, "forecast": fc,
            "daily_avg": round(daily_avg, 1),
            "reorder_point": reorder_day,
            "needs_replenish": reorder_day is not None and
                               dt.date.fromisoformat(reorder_day) <= TODAY + dt.timedelta(days=7)}


def replenish_alerts():
    con = get_db()
    ids = [r["id"] for r in con.execute("SELECT id FROM skus")]
    con.close()
    alerts = []
    for sid in ids:
        f = forecast(sid, 30)
        if f.get("needs_replenish"):
            alerts.append({"sku": f["sku"], "name": f["name"], "onhand": f["onhand"],
                           "daily_avg": f["daily_avg"], "reorder_by": f["reorder_point"]})
    alerts.sort(key=lambda a: a["reorder_by"])
    return alerts
