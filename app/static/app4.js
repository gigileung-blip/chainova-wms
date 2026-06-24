// ---------- AI: DYNAMIC SLOTTING ----------
RENDER['ai-slotting'] = async () => {
  const s = await api('ai/slotting');
  const rows = s.recommendations.map((r,i)=>`<tr>
    <td class="text-slate-400">${i+1}</td>
    <td class="font-mono text-xs">${r.sku}</td><td>${r.name}</td>
    <td class="text-right">${badge(r.velocity+'/wk','b-warn')}</td>
    <td class="font-mono text-xs">${r.current_bin}</td>
    <td>${badge(t('sl.move'),'b-ship')}</td>
    <td class="text-xs text-slate-500">${r.reason}</td></tr>`).join('')
    || `<tr><td colspan="7" class="text-center text-slate-400 py-4">${t('sl.alldone')}</td></tr>`;
  view.innerHTML = `
    <div class="grid grid-cols-4 gap-4 mb-4">
      ${card(`<div class="text-xs text-slate-500">${t('sl.recs')}</div><div class="kpi-num text-brand-700">${s.recommendations.length}</div>`)}
      ${card(`<div class="text-xs text-slate-500">${t('sl.goldenslots')}</div><div class="kpi-num">${s.golden_slots}</div>`)}
      ${card(`<div class="text-xs text-slate-500">${t('sl.estsave')}</div><div class="kpi-num text-emerald-600">${s.est_pick_travel_saving_pct}%</div>`)}
      ${card(`<div class="text-xs text-slate-500">${t('sl.engine')}</div><div class="text-sm font-semibold mt-2">${t('sl.engine.v')}</div>`)}
    </div>
    ${card(`<div class="flex justify-between mb-3"><div class="font-semibold text-sm">${t('sl.title')}</div>
      <button class="btn btn-pri" onclick="alert(t('sl.applied'))">${t('sl.applyall')}</button></div>
      <table class="tbl"><thead><tr><th>#</th><th>${t('h.sku')}</th><th>${t('h.name')}</th><th class="text-right">${t('h.velocity')}</th><th>${t('sl.curbin')}</th><th>${t('sl.action')}</th><th>${t('sl.reason')}</th></tr></thead>
      <tbody>${rows}</tbody></table>`)}`;
};

// ---------- AI: DEMAND FORECAST ----------
let fcChart;
RENDER['ai-forecast'] = async () => {
  const [skus, alerts] = await Promise.all([api('ai/forecast-skus'), api('ai/replenish')]);
  const arows = alerts.map(a=>`<tr>
    <td class="font-mono text-xs">${a.sku}</td><td>${a.name}</td>
    <td class="text-right">${fmt(a.onhand)}</td>
    <td class="text-right">${a.daily_avg}${t('fc.perday')}</td>
    <td>${badge(a.reorder_by,'b-warn')}</td></tr>`).join('')
    || `<tr><td colspan="5" class="text-center text-slate-400 py-3">${t('fc.noneed')}</td></tr>`;
  view.innerHTML = `
    <div class="flex gap-3 items-center mb-4">
      <label class="text-sm">${t('fc.sku')}</label>
      <select id="fcSel" class="border rounded-lg px-3 py-2">${skus.map(s=>`<option value="${s.id}">${s.code} — ${s.name}</option>`).join('')}</select>
      <span class="text-xs text-slate-400">${t('fc.method')}</span>
    </div>
    <div class="grid grid-cols-3 gap-4">
      <div class="col-span-2">${card(`<div class="font-semibold text-sm mb-3">${t('fc.title')}</div><canvas id="fcChart" height="120"></canvas>`)}</div>
      <div id="fcInfo"></div>
    </div>
    <div class="mt-4">${card(`<div class="font-semibold text-sm mb-3">${t('fc.alerts')} <span class="text-xs text-slate-400 font-normal">${t('fc.alerts.s')}</span></div>
      <table class="tbl"><thead><tr><th>${t('h.sku')}</th><th>${t('h.name')}</th><th class="text-right">${t('fc.onhand')}</th><th class="text-right">${t('fc.avgdemand')}</th><th>${t('fc.reorder')}</th></tr></thead><tbody>${arows}</tbody></table>`)}</div>`;
  $('#fcSel').onchange = drawForecast;
  drawForecast();
};
window.drawForecast = async () => {
  const id = $('#fcSel').value;
  const f = await api('ai/forecast/'+id);
  const labels = [...f.history.map(h=>h.day), ...f.forecast.map(h=>h.day)].map(d=>d.slice(5));
  const hist = f.history.map(h=>h.qty).concat(f.forecast.map(()=>null));
  const fore = f.history.map(()=>null); fore[fore.length-1]=f.history.at(-1).qty;
  f.forecast.forEach(h=>fore.push(h.qty));
  if(fcChart) fcChart.destroy();
  fcChart = new Chart($('#fcChart'),{type:'line',data:{labels,datasets:[
    {label:t('fc.hist'),data:hist,borderColor:'#94a3b8',backgroundColor:'#94a3b8',tension:.3,pointRadius:0},
    {label:t('fc.fore'),data:fore,borderColor:'#1d4ed8',backgroundColor:'rgba(29,78,216,.1)',borderDash:[5,4],fill:true,tension:.3,pointRadius:0}]},
    options:{plugins:{legend:{position:'bottom'}}}});
  $('#fcInfo').innerHTML = card(`
    <div class="text-sm font-semibold mb-3">${f.sku} · ${f.name}</div>
    <div class="space-y-3">
      <div><div class="text-xs text-slate-500">${t('fc.onhand2')}</div><div class="text-lg font-bold">${fmt(f.onhand)}</div></div>
      <div><div class="text-xs text-slate-500">${t('fc.avgdaily')}</div><div class="text-lg font-bold">${f.daily_avg}${t('fc.perday')}</div></div>
      <div class="pt-2 border-t"><div class="text-xs text-slate-500">${t('fc.reorderpt')}</div>
        <div class="text-lg font-bold ${f.needs_replenish?'text-red-600':'text-emerald-600'}">${f.reorder_point||t('fc.over30')}</div></div>
    </div>
    ${f.needs_replenish?`<div class="mt-3 p-2 rounded bg-red-50 text-red-700 text-xs">${t('fc.warn')}</div>`:`<div class="mt-3 p-2 rounded bg-emerald-50 text-emerald-700 text-xs">${t('fc.ok')}</div>`}`);
};
