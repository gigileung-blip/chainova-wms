// ---------- WAREHOUSE MAP ----------
// B2B/B2C share the same storage area; CFS has its own dedicated area.
async function renderWarehouseArea(area){
  const w = await api('warehouse?area='+area);
  const areaLabel = area==='cfs' ? t('wh.area.cfs') : t('wh.area.shared');
  const minX = Math.min(...w.bins.map(b=>b.gx));
  const minY = Math.min(...w.bins.map(b=>b.gy));
  const maxX = Math.max(...w.bins.map(b=>b.gx));
  const maxY = Math.max(...w.bins.map(b=>b.gy));
  const cols = maxX-minX+1, rowsN = maxY-minY+1;
  let cells = '';
  const grid = {};
  w.bins.forEach(b => grid[`${b.gx},${b.gy}`] = b);
  for(let y=minY;y<=maxY;y++) for(let x=minX;x<=maxX;x++){
    const b = grid[`${x},${y}`];
    const cx = x-minX+1, cy = y-minY+1;
    if(!b){ cells += `<div class="wh-bin z-empty" style="grid-column:${cx};grid-row:${cy}"></div>`; continue; }
    const pct = Math.min(100, Math.round(b.occupied/(b.capacity*10)*100));
    cells += `<div class="wh-bin z-${b.kind}" style="grid-column:${cx};grid-row:${cy}"
      data-bin='${JSON.stringify(b).replace(/'/g,"&#39;")}' title="${b.code} · ${pct}%">${b.zone}</div>`;
  }
  const legend = area==='cfs'
    ? `<span><span class="inline-block w-3 h-3 rounded" style="background:#bfdbfe"></span> ${t('wh.cfs')}</span>`
    : `<span><span class="inline-block w-3 h-3 rounded bg-slate-300"></span> ${t('wh.storage')}</span>
       <span><span class="inline-block w-3 h-3 rounded" style="background:#fde68a"></span> ${t('wh.golden')}</span>`;
  view.innerHTML = `
    <div class="mb-3 inline-block px-3 py-1.5 rounded-lg ${area==='cfs'?'bg-blue-50 text-blue-700':'bg-slate-200 text-slate-700'} text-sm font-semibold">${areaLabel}</div>
    <div class="grid grid-cols-3 gap-4">
      <div class="col-span-2">${card(`
        <div class="flex gap-3 text-xs mb-3 flex-wrap">${legend}</div>
        <div class="wh-grid" style="grid-template-columns:repeat(${cols},1fr)">${cells}</div>`)}</div>
      <div id="binInfo">${card(`<div class="text-sm text-slate-400">${t('wh.click')}</div>`)}</div>
    </div>`;
  document.querySelectorAll('.wh-bin[data-bin]').forEach(el=>el.onclick=()=>{
    const b = JSON.parse(el.dataset.bin);
    const contents = b.contents.length ? b.contents.map(c=>
      `<tr><td class="font-mono text-xs">${c.sku}</td><td>${c.name}</td>
       <td class="font-mono text-xs">${c.lot}</td><td class="text-right">${fmt(c.qty)}</td></tr>`).join('')
      : `<tr><td colspan="4" class="text-slate-400">${t('wh.empty')}</td></tr>`;
    $('#binInfo').innerHTML = card(`
      <div class="font-semibold text-lg">${b.code}</div>
      <div class="text-xs text-slate-500 mb-3">${t('wh.shelf')} ${b.shelf} · ${t('wh.level')} ${b.level} · ${b.kind.toUpperCase()} · ${t('wh.cap')} ${b.capacity}</div>
      <table class="tbl"><thead><tr><th>${t('h.sku')}</th><th>${t('h.name')}</th><th>${t('h.lot')}</th><th class="text-right">${t('h.qty')}</th></tr></thead>
      <tbody>${contents}</tbody></table>`);
  });
}
RENDER.warehouse = () => renderWarehouseArea('shared');
RENDER['cfs-area'] = () => renderWarehouseArea('cfs');

// ---------- ORDERS (scoped to current business mode) ----------
function ordersTable(list, head){
  const mkRows = list.map(o=>`<tr class="cursor-pointer" onclick="this.nextElementSibling.classList.toggle('hidden')">
    <td class="font-mono text-xs">${o.ref}</td>
    <td>${o.customer}</td><td>${stBadge(o.status)}</td>
    <td class="text-xs">${o.carrier}</td>
    <td class="text-right text-xs">${o.sla_hours}h</td>
    <td class="text-right">HK$${fmt(Math.round(o.value))}</td>
    <td class="text-xs text-slate-400">${o.lines.length} ${t('ord.lines')}</td></tr>
    <tr class="hidden"><td colspan="7" class="bg-slate-50">
      <div class="text-xs text-slate-500 pl-2 py-1">${o.lines.map(l=>`${l.sku} ${l.name} ×${l.qty}`).join(' &nbsp;·&nbsp; ')}</div></td></tr>`).join('');
  return `<table class="tbl"><thead><tr><th>${head}</th><th>${t('h.customer')}</th><th>${t('h.status')}</th>
    <th>${t('h.carrier')}</th><th class="text-right">SLA</th><th class="text-right">${t('h.value')}</th><th></th></tr></thead>
    <tbody>${mkRows || `<tr><td colspan="7" class="text-slate-400 text-center py-3">${t('ord.none')}</td></tr>`}</tbody></table>`;
}

RENDER.orders = async () => {
  const channel = window.MODE;  // 'B2B' or 'B2C'
  const os = (await api('orders')).filter(o=>o.channel===channel);
  const total = fmt(Math.round(os.reduce((s,o)=>s+o.value,0)));
  const accent = channel==='B2B' ? 'text-emerald-600' : 'text-fuchsia-600';
  const head = channel==='B2B' ? t('h.doref') : t('h.pclref');
  view.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <span class="text-xs text-slate-400">${t('ord.expand')}</span>
      <span class="text-sm font-semibold ${accent}">${os.length} ${t('ord.count')} · HK$${total}</span>
    </div>
    ${card(ordersTable(os, head))}`;
};

// ---------- CFS LOT BOARD ----------
RENDER['cfs-board'] = async () => {
  const lots = await api('cfs');
  const cols = {INGATE:t('cfs.ingate'),STAGING:t('cfs.staging'),OUTGATE:t('cfs.outgate'),CLEARED:t('cfs.cleared')};
  const board = Object.keys(cols).map(st=>{
    const items = lots.filter(l=>l.status===st).map(l=>`
      <div class="card p-3 mb-2 ${l.aging_flag?'border-red-300':''}">
        <div class="flex justify-between"><span class="font-mono text-xs font-bold">${l.lot_ref}</span>
        ${l.aging_flag?badge(t('cfs.aging'),'b-warn'):`<span class="text-xs text-slate-400">${l.dwell_hours}h</span>`}</div>
        <div class="text-xs text-slate-600 mt-1">${l.customer}</div>
        <div class="text-xs text-slate-400">→ ${l.consignee}</div>
        <div class="flex justify-between mt-2 text-xs">
          <span>${fmt(l.cartons)} ${t('cfs.ctns')}</span>
          <span class="text-slate-400">${l.bin||'—'}</span></div>
        <div class="text-xs text-slate-400 mt-1">${t('cfs.fee')}: HK$${l.ingate_fee}${l.fee_overridden?' ✏️':''}</div>
      </div>`).join('') || '<div class="text-xs text-slate-300 py-4 text-center">—</div>';
    return `<div><div class="text-sm font-semibold mb-2">${cols[st]} <span class="text-slate-400 font-normal">(${lots.filter(l=>l.status===st).length})</span></div>${items}</div>`;
  }).join('');
  view.innerHTML = `
    <p class="text-xs text-slate-500 mb-3">${t('cfs.intro')}</p>
    <div class="grid grid-cols-4 gap-4">${board}</div>`;
};

// ---------- CFS DASHBOARD ----------
RENDER['cfs-dash'] = async () => {
  const c = await api('cfs-kpis');
  const kpi = (label,val,sub,acc='text-ink') =>
    card(`<div class="text-xs text-slate-500 mb-1">${label}</div>
          <div class="kpi-num ${acc}">${val}</div>
          <div class="text-xs text-slate-400 mt-1">${sub}</div>`);
  view.innerHTML = `
    <div class="mb-4 inline-block px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-sm font-semibold">${t('wh.area.cfs')}</div>
    <div class="grid grid-cols-4 gap-4">
      ${kpi(t('kpi.cfs.active'), c.active, t('cfs.intro').slice(0,0)||'', 'text-blue-600')}
      ${kpi(t('kpi.cfs.ctns'), fmt(c.cartons), t('cfs.ctns'))}
      ${kpi(t('kpi.cfs.aging'), c.aging, '>48h', c.aging>0?'text-red-600':'text-emerald-600')}
      ${kpi(t('kpi.cfs.dwell'), c.avg_dwell, 'hrs')}
    </div>`;
};

