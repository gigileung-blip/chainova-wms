// ---------- BILLING / GATE FEES ----------
RENDER.billing = async () => {
  const [custs, lots, audit] = await Promise.all([api('customers'), api('cfs'), api('fee-audit')]);
  const crows = custs.map(c=>`<tr>
    <td class="font-mono text-xs">${c.code}</td><td>${c.name}</td>
    <td>${badge(c.type,c.type==='B2B'?'b-b2b':'b-b2c')}</td>
    <td class="text-right">${c.type==='B2B'?'HK$'+c.ingate_fee:'—'}</td>
    <td class="text-right">${c.type==='B2B'?'HK$'+c.storage_rate+'/plt/day':'—'}</td></tr>`).join('');
  const lrows = lots.map(l=>`<tr>
    <td class="font-mono text-xs">${l.lot_ref}</td><td>${l.customer}</td>
    <td class="text-right">HK$<span id="fee-${l.id}">${l.ingate_fee}</span> ${l.fee_overridden?badge(t('bill.overridden'),'b-pick'):''}</td>
    <td class="text-right"><button class="btn btn-ghost" onclick="overrideFee(${l.id},${l.ingate_fee},'${l.lot_ref}')">${t('bill.adjust')}</button></td></tr>`).join('');
  const arows = audit.map(a=>`<tr>
    <td class="font-mono text-xs">${a.lot_ref}</td>
    <td class="text-right text-slate-400 line-through">HK$${a.old_fee}</td>
    <td class="text-right font-semibold">HK$${a.new_fee}</td>
    <td>${a.manager}</td><td class="text-xs text-slate-400">${a.ts}</td><td class="text-xs">${a.note||''}</td></tr>`).join('')
    || `<tr><td colspan="6" class="text-slate-400 text-center py-3">${t('bill.noaudit')}</td></tr>`;
  view.innerHTML = `
    <div class="grid grid-cols-2 gap-4 mb-4">
      ${card(`<div class="font-semibold text-sm mb-3">${t('bill.ratecard')} <span class="text-xs text-slate-400 font-normal">${t('bill.ratecard.s')}</span></div>
        <table class="tbl"><thead><tr><th>${t('bill.code')}</th><th>${t('h.customer')}</th><th>${t('bill.type')}</th><th class="text-right">${t('bill.ingatefee')}</th><th class="text-right">${t('bill.storage')}</th></tr></thead><tbody>${crows}</tbody></table>`)}
      ${card(`<div class="font-semibold text-sm mb-3">${t('bill.lotcharges')} <span class="text-xs text-slate-400 font-normal">${t('bill.lotcharges.s')}</span></div>
        <table class="tbl"><thead><tr><th>${t('h.lot')}</th><th>${t('h.customer')}</th><th class="text-right">${t('bill.ingatefee')}</th><th></th></tr></thead><tbody>${lrows}</tbody></table>`)}
    </div>
    ${card(`<div class="font-semibold text-sm mb-3">${t('bill.audit')}</div>
      <table class="tbl"><thead><tr><th>${t('h.lot')}</th><th class="text-right">${t('bill.was')}</th><th class="text-right">${t('bill.now')}</th><th>${t('bill.mgr')}</th><th>${t('bill.when')}</th><th>${t('bill.note')}</th></tr></thead><tbody>${arows}</tbody></table>`)}`;
};

window.overrideFee = (id, cur, ref) => {
  const v = prompt(`${t('bill.prompt.fee')} ${ref}\n${t('bill.prompt.cur')}: HK$${cur}\n\n${t('bill.prompt.new')}`, cur);
  if(v===null) return;
  const note = prompt(t('bill.prompt.note'), t('bill.prompt.def')) || '';
  fetch(`/api/cfs/${id}/fee`,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({fee:parseFloat(v),manager:'K. Wong (Mgr)',note})})
    .then(r=>r.json()).then(()=>RENDER.billing());
};

// ---------- AI: PICK PATH ----------
RENDER['ai-pickpath'] = async () => {
  const ords = await api('ai/pickpath-orders');
  view.innerHTML = `
    <div class="flex gap-3 items-center mb-4">
      <label class="text-sm">${t('pp.order')}</label>
      <select id="ppSel" class="border rounded-lg px-3 py-2">${ords.map(o=>`<option value="${o.id}">${o.ref} (${o.channel})</option>`).join('')}</select>
      <button class="btn btn-pri" onclick="runPickPath()">${t('pp.run')}</button>
    </div>
    <div class="grid grid-cols-3 gap-4">
      <div class="col-span-2" id="ppMap">${card(`<div class="text-sm text-slate-400">${t('pp.select')}</div>`)}</div>
      <div id="ppStats"></div>
    </div>`;
  $('#ppSel').onchange = runPickPath;
  runPickPath();
};
window.runPickPath = async () => {
  const id = $('#ppSel').value;
  const r = await api('ai/pickpath/'+id);
  const w = await api('warehouse');
  const maxX = Math.max(...w.bins.map(b=>b.gx), w.despatch[0])+1;
  const maxY = Math.max(...w.bins.map(b=>b.gy), w.despatch[1])+1;
  const stopByXY = {}; r.optimised.forEach((s,i)=>stopByXY[s.xy.join(',')]=i+1);
  const grid={}; w.bins.forEach(b=>grid[`${b.gx},${b.gy}`]=b);
  let cells='';
  for(let y=0;y<maxY;y++)for(let x=0;x<maxX;x++){
    const key=`${x},${y}`;
    if(x===w.despatch[0]&&y===w.despatch[1]){cells+=`<div class="wh-bin wh-despatch" style="grid-column:${x+1};grid-row:${y+1}">📦</div>`;continue;}
    const seq=stopByXY[key];
    if(seq){cells+=`<div class="wh-bin route-stop" style="grid-column:${x+1};grid-row:${y+1}">${seq}</div>`;continue;}
    const b=grid[key];
    cells+=b?`<div class="wh-bin z-${b.kind}" style="grid-column:${x+1};grid-row:${y+1}">${b.zone}</div>`
            :`<div class="wh-bin z-empty" style="grid-column:${x+1};grid-row:${y+1}"></div>`;
  }
  $('#ppMap').innerHTML = card(`<div class="text-xs text-slate-500 mb-2">${t('pp.legend')}</div>
    <div class="wh-grid" style="grid-template-columns:repeat(${maxX},1fr)">${cells}</div>`);
  $('#ppStats').innerHTML = card(`
    <div class="text-sm font-semibold mb-3">${t('pp.result')}</div>
    <div class="space-y-3">
      <div><div class="text-xs text-slate-500">${t('pp.naive')}</div><div class="text-lg font-bold text-slate-400">${r.naive_dist} ${t('pp.units')}</div></div>
      <div><div class="text-xs text-slate-500">${t('pp.opt')}</div><div class="text-lg font-bold text-emerald-600">${r.opt_dist} ${t('pp.units')}</div></div>
      <div class="pt-2 border-t"><div class="text-xs text-slate-500">${t('pp.saved')}</div><div class="kpi-num text-emerald-600">${r.saving_pct}%</div></div>
    </div>
    <div class="mt-4 text-xs text-slate-500">${r.optimised.length} ${t('pp.stops')}</div>
    <ol class="mt-2 text-xs space-y-1 list-decimal pl-4">${r.optimised.map(s=>`<li><span class="font-mono">${s.bin}</span> ${s.name} ×${s.qty}</li>`).join('')}</ol>`);
};
