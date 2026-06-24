import datetime as dt
from fastapi import FastAPI, Request, Body
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import os

from .db import get_db
from . import ai

BASE = os.path.dirname(__file__)
app = FastAPI(title="Chainova WMS")
app.mount("/static", StaticFiles(directory=os.path.join(BASE, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(BASE, "templates"))
TODAY = dt.date(2026, 6, 23)


def rows(q, args=()):
    con = get_db(); r = [dict(x) for x in con.execute(q, args)]; con.close(); return r


@app.get("/", response_class=HTMLResponse)
@app.get("/{page}", response_class=HTMLResponse)
def index(request: Request, page: str = "dashboard"):
    valid = {"home","dashboard","inventory","warehouse","orders","orders-b2b","orders-b2c",
             "cfs","cfs-dash","cfs-board","cfs-area","billing",
             "ai-pickpath","ai-slotting","ai-forecast"}
    if page not in valid:
        page = "home"
    return templates.TemplateResponse("index.html", {"request": request, "page": page})


# ---------- DASHBOARD ----------
@app.get("/api/kpis")
def kpis():
    con = get_db()
    def one(q, a=()):
        return con.execute(q, a).fetchone()[0]
    b2b = one("SELECT COUNT(*) FROM orders WHERE channel='B2B'")
    b2c = one("SELECT COUNT(*) FROM orders WHERE channel='B2C'")
    open_o = one("SELECT COUNT(*) FROM orders WHERE status NOT IN ('SHIPPED')")
    skus = one("SELECT COUNT(*) FROM skus")
    units = one("SELECT COALESCE(SUM(qty),0) FROM inventory")
    cfs_active = one("SELECT COUNT(*) FROM cfs_lots WHERE status IN ('INGATE','STAGING','OUTGATE')")
    con.close()
    return {"b2b_orders": b2b, "b2c_orders": b2c, "open_orders": open_o,
            "skus": skus, "units": units, "cfs_active": cfs_active,
            "pick_accuracy": 99.2, "inventory_accuracy": 99.4,
            "sla_compliance": 97.6, "labour_util": 88}


@app.get("/api/cfs-kpis")
def cfs_kpis():
    con = get_db()
    lots = [dict(r) for r in con.execute("SELECT * FROM cfs_lots")]
    con.close()
    active = [l for l in lots if l["status"] in ("INGATE", "STAGING", "OUTGATE")]
    ctns = sum(l["cartons"] for l in active)
    # dwell calc
    now = dt.datetime.combine(TODAY, dt.time(18, 0))
    dwell = []
    aging = 0
    for l in active:
        ing = dt.datetime.fromisoformat(l["ingate_time"])
        hrs = (now - ing).total_seconds() / 3600
        dwell.append(hrs)
        if hrs > 48:
            aging += 1
    avg_dwell = round(sum(dwell) / len(dwell), 1) if dwell else 0
    return {"active": len(active), "cartons": ctns, "aging": aging, "avg_dwell": avg_dwell}


@app.get("/api/throughput")
def throughput():
    con = get_db()
    data = []
    for d in range(13, -1, -1):
        day = TODAY - dt.timedelta(days=d)
        q = con.execute("SELECT COALESCE(SUM(qty),0) q FROM order_history WHERE day=?",
                        (day.isoformat(),)).fetchone()["q"]
        data.append({"day": day.strftime("%d/%m"), "b2b": int(q*0.6), "b2c": int(q*0.4)})
    con.close()
    return data


# ---------- INVENTORY ----------
@app.get("/api/inventory")
def inventory():
    return rows("""SELECT s.code sku, s.name, s.category, s.velocity, b.code bin,
                   z.name zone, z.kind zkind, inv.lot, inv.expiry, inv.qty
                   FROM inventory inv JOIN skus s ON s.id=inv.sku_id
                   JOIN bins b ON b.id=inv.bin_id JOIN zones z ON z.id=b.zone_id
                   ORDER BY s.velocity DESC""")


# ---------- WAREHOUSE MAP ----------
@app.get("/api/warehouse")
def warehouse(area: str = "shared"):
    # area='cfs' -> CFS dedicated transit zone only;
    # area='shared' -> B2B+B2C shared storage (everything except CFS).
    if area == "cfs":
        where = "z.kind = 'cfs'"
    else:
        where = "z.kind != 'cfs'"
    bins = rows(f"""SELECT b.id,b.code,b.gx,b.gy,b.shelf,b.level,b.capacity,
                   z.code zone,z.kind FROM bins b JOIN zones z ON z.id=b.zone_id
                   WHERE {where}""")
    for b in bins:
        inv = rows("""SELECT s.code sku,s.name,inv.qty,inv.lot FROM inventory inv
                      JOIN skus s ON s.id=inv.sku_id WHERE inv.bin_id=?""", (b["id"],))
        b["contents"] = inv
        b["occupied"] = sum(i["qty"] for i in inv)
    return {"despatch": ai.DESPATCH, "bins": bins, "area": area}


# ---------- ORDERS ----------
@app.get("/api/orders")
def orders():
    os_ = rows("""SELECT o.id,o.ref,o.channel,o.carrier,o.status,o.sla_hours,
                  o.created,o.value,c.name customer FROM orders o
                  JOIN customers c ON c.id=o.customer_id ORDER BY o.created DESC""")
    for o in os_:
        o["lines"] = rows("""SELECT s.code sku,s.name,ol.qty FROM order_lines ol
                             JOIN skus s ON s.id=ol.sku_id WHERE ol.order_id=?""", (o["id"],))
    return os_


# ---------- CFS ----------
@app.get("/api/cfs")
def cfs():
    lots = rows("""SELECT l.*, c.name customer, b.code bin FROM cfs_lots l
                   JOIN customers c ON c.id=l.customer_id
                   LEFT JOIN bins b ON b.id=l.bin_id ORDER BY l.ingate_time DESC""")
    now = dt.datetime.combine(TODAY, dt.time(18, 0))
    for l in lots:
        ing = dt.datetime.fromisoformat(l["ingate_time"])
        end = dt.datetime.fromisoformat(l["outgate_time"]) if l["outgate_time"] else now
        hrs = round((end - ing).total_seconds() / 3600, 1)
        l["dwell_hours"] = hrs
        l["aging_flag"] = (l["status"] in ("INGATE","STAGING")) and hrs > 48
        l["skus"] = rows("""SELECT s.code sku,s.name,ls.cartons FROM cfs_lot_skus ls
                            JOIN skus s ON s.id=ls.sku_id WHERE ls.lot_id=?""", (l["id"],))
    return lots


# ---------- BILLING / GATE FEE ----------
@app.get("/api/customers")
def customers():
    return rows("SELECT * FROM customers ORDER BY type, name")


@app.post("/api/cfs/{lot_id}/fee")
def override_fee(lot_id: int, payload: dict = Body(...)):
    new_fee = float(payload.get("fee"))
    manager = payload.get("manager", "Manager")
    note = payload.get("note", "")
    con = get_db()
    old = con.execute("SELECT ingate_fee FROM cfs_lots WHERE id=?", (lot_id,)).fetchone()["ingate_fee"]
    con.execute("UPDATE cfs_lots SET ingate_fee=?, fee_overridden=1 WHERE id=?", (new_fee, lot_id))
    con.execute("""INSERT INTO fee_audit(lot_id,old_fee,new_fee,manager,ts,note)
                   VALUES(?,?,?,?,?,?)""",
                (lot_id, old, new_fee, manager, dt.datetime.now().isoformat(timespec="minutes"), note))
    con.commit(); con.close()
    return {"ok": True, "old": old, "new": new_fee}


@app.get("/api/fee-audit")
def fee_audit():
    return rows("""SELECT fa.*, l.lot_ref FROM fee_audit fa
                   JOIN cfs_lots l ON l.id=fa.lot_id ORDER BY fa.ts DESC""")


# ---------- AI ----------
@app.get("/api/ai/pickpath/{order_id}")
def ai_pickpath(order_id: int):
    return ai.pick_path(order_id)


@app.get("/api/ai/pickpath-orders")
def pickpath_orders():
    # Offer orders with >=4 distinct pick bins, sorted by actual optimisation saving
    # so the default (first) selection always demos a strong result.
    cand = rows("""
        SELECT o.id, o.ref, o.channel, o.status,
               COUNT(DISTINCT inv.bin_id) nbins
        FROM orders o
        JOIN order_lines ol ON ol.order_id = o.id
        JOIN inventory inv ON inv.sku_id = ol.sku_id
        GROUP BY o.id HAVING nbins >= 4""")
    for o in cand:
        o["saving"] = ai.pick_path(o["id"])["saving_pct"]
    cand.sort(key=lambda o: o["saving"], reverse=True)
    return cand


@app.get("/api/ai/slotting")
def ai_slotting():
    return ai.slotting_recommendations()


@app.get("/api/ai/forecast/{sku_id}")
def ai_forecast(sku_id: int):
    return ai.forecast(sku_id)


@app.get("/api/ai/forecast-skus")
def forecast_skus():
    return rows("SELECT id,code,name,velocity FROM skus ORDER BY velocity DESC")


@app.get("/api/ai/replenish")
def ai_replenish():
    return ai.replenish_alerts()
