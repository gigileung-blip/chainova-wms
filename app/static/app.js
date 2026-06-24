// ===== Chainova WMS frontend =====
const $ = s => document.querySelector(s);
const view = $('#view');
const api = p => fetch('/api/' + p).then(r => r.json());
const fmt = n => (n ?? 0).toLocaleString();

// ----- business-line mode (CFS / B2B / B2C) -----
window.MODE = null;  // null = show launcher
const MENUS = {
  CFS: [
    {p:'cfs-dash',  i:'nav.cfs-dash'},
    {p:'cfs-board', i:'nav.cfs-board'},
    {p:'cfs-area',  i:'nav.cfs-area'},
    {p:'billing',   i:'nav.billing'},
  ],
  B2B: [
    {p:'dashboard', i:'nav.dashboard'},
    {p:'orders',    i:'nav.orders'},
    {p:'inventory', i:'nav.inventory'},
    {p:'warehouse', i:'nav.warehouse'},
    {p:'ai-pickpath', i:'nav.ai-pickpath'},
    {p:'ai-slotting', i:'nav.ai-slotting'},
    {p:'ai-forecast', i:'nav.ai-forecast'},
  ],
  B2C: [
    {p:'dashboard', i:'nav.dashboard'},
    {p:'orders',    i:'nav.orders'},
    {p:'inventory', i:'nav.inventory'},
    {p:'warehouse', i:'nav.warehouse'},
    {p:'ai-pickpath', i:'nav.ai-pickpath'},
    {p:'ai-slotting', i:'nav.ai-slotting'},
    {p:'ai-forecast', i:'nav.ai-forecast'},
  ],
};
const MODE_BADGE = {CFS:'bg-blue-500/20 text-blue-300', B2B:'bg-emerald-500/20 text-emerald-300', B2C:'bg-fuchsia-500/20 text-fuchsia-300'};

function showLogin(){
  $('#login').classList.remove('hidden');
  $('#home').classList.add('hidden');
  $('#workspace').classList.add('hidden');
}
function showHome(){
  window.MODE = null;
  localStorage.removeItem('wms_mode');
  $('#login').classList.add('hidden');
  $('#home').classList.remove('hidden');
  $('#workspace').classList.add('hidden');
  renderHome();
}
function enterMode(mode){
  window.MODE = mode;
  localStorage.setItem('wms_mode', mode);
  $('#login').classList.add('hidden');
  $('#home').classList.add('hidden');
  $('#workspace').classList.remove('hidden');
  $('#modeBadge').className = 'mt-2 inline-block px-2 py-0.5 rounded text-[11px] font-semibold ' + MODE_BADGE[mode];
  $('#modeBadge').textContent = t('mode.'+mode.toLowerCase());
  buildSidebar();
  if(!MENUS[mode].map(m=>m.p).includes(location.hash.slice(1)))
    location.hash = MENUS[mode][0].p;
  route();
}
function doLogin(){
  const u = $('#loginUser').value.trim();
  const p = $('#loginPass').value;
  if(u==='admin' && p==='admin'){
    localStorage.setItem('wms_auth','1');
    $('#loginErr').classList.add('hidden');
    afterAuth();
  } else {
    $('#loginErr').classList.remove('hidden');
  }
}
function logout(){
  localStorage.removeItem('wms_auth');
  localStorage.removeItem('wms_mode');
  window.MODE = null;
  showLogin();
}
// after a successful (or remembered) login: resume saved mode, else show launcher
function afterAuth(){
  const saved = localStorage.getItem('wms_mode');
  if(saved && MENUS[saved]) enterMode(saved);
  else showHome();
}
function buildSidebar(){
  const nav = $('#nav');
  nav.innerHTML = MENUS[window.MODE].map(m=>
    `<a data-page="${m.p}" class="nav-link" data-i18n="${m.i}">${t(m.i)}</a>`).join('');
  nav.querySelectorAll('.nav-link').forEach(a=>a.onclick=()=>{ location.hash=a.dataset.page; closeNav(); });
}
function openNav(){ $('#sidebar').classList.remove('-translate-x-full'); $('#navOverlay').classList.remove('hidden'); }
function closeNav(){ $('#sidebar').classList.add('-translate-x-full'); $('#navOverlay').classList.add('hidden'); }

function renderHome(){
  const tiles = [
    {mode:'CFS', icon:'🚢', key:'cfs', ring:'hover:ring-blue-400'},
    {mode:'B2B', icon:'🏢', key:'b2b', ring:'hover:ring-emerald-400'},
    {mode:'B2C', icon:'🛒', key:'b2c', ring:'hover:ring-fuchsia-400'},
  ];
  $('#bizButtons').innerHTML = tiles.map(t2=>`
    <button data-mode="${t2.mode}" class="biz-tile group ${t2.ring}">
      <div class="text-6xl mb-4">${t2.icon}</div>
      <div class="text-2xl font-bold text-white mb-2">${t('home.'+t2.key)}</div>
      <div class="text-sm text-slate-400 mb-5 px-3">${t('home.'+t2.key+'.d')}</div>
      <span class="biz-enter">${t('home.enter')}</span>
    </button>`).join('');
  $('#bizButtons').querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>enterMode(b.dataset.mode));
}

function route(){
  if(!window.MODE) return;
  const menu = MENUS[window.MODE].map(m=>m.p);
  let page = location.hash.slice(1);
  if(!menu.includes(page)) page = menu[0];
  document.querySelectorAll('.nav-link').forEach(a=>a.classList.toggle('active',a.dataset.page===page));
  // resolve mode-specific titles
  $('#pageTitle').textContent = t('title.'+page);
  let subKey = 'sub.'+page;
  if(page==='dashboard' || page==='orders') subKey = 'sub.'+page+'.'+window.MODE.toLowerCase();
  $('#pageSub').textContent = t(subKey);
  view.innerHTML = '<div class="text-slate-400 text-sm">…</div>';
  (RENDER[page]||(()=>{}))();
}
window.route = route;
window.addEventListener('hashchange', route);

// boot: called after setLang in template; also re-applied on lang switch
function boot(){
  const sb = $('#switchBiz'); if(sb) sb.onclick = showHome;
  const lo = $('#logoutBtn'); if(lo) lo.onclick = logout;
  const lb = $('#loginBtn'); if(lb) lb.onclick = doLogin;
  const lp = $('#loginPass'); if(lp) lp.onkeydown = e => { if(e.key==='Enter') doLogin(); };
  const nt = $('#navToggle'); if(nt) nt.onclick = openNav;
  const no = $('#navOverlay'); if(no) no.onclick = closeNav;
  setLang(window.LANG);
  if(localStorage.getItem('wms_auth')==='1') afterAuth();
  else showLogin();
}
window.boot = boot;
// when language changes, re-render whatever is showing
window.onLangChange = () => {
  if(window.MODE){ buildSidebar(); route(); }
  else if(!$('#home').classList.contains('hidden')) renderHome();
};

const card = (inner,cls='') => `<div class="card p-5 ${cls}">${inner}</div>`;
const badge = (txt,cls) => `<span class="badge ${cls}">${txt}</span>`;
function stBadge(s){const m={NEW:'b-new',ALLOCATED:'b-new',PICKING:'b-pick',PACKING:'b-pack',SHIPPED:'b-ship'};return badge(s,m[s]||'b-new');}

const RENDER = {};

// ---------- DASHBOARD (channel-scoped: B2B or B2C) ----------
RENDER.dashboard = async () => {
  const k = await api('kpis');
  const m = window.MODE;                 // 'B2B' or 'B2C'
  const isB2B = m === 'B2B';
  const openKey = isB2B ? 'k.open.b2b' : 'k.open.b2c';
  const openVal = isB2B ? k.b2b_orders : k.b2c_orders;
  const accent = isB2B ? 'text-emerald-600' : 'text-fuchsia-600';
  const kpi = (label,val,sub,acc='text-ink') =>
    card(`<div class="text-xs text-slate-500 mb-1">${label}</div>
          <div class="kpi-num ${acc}">${val}</div>
          <div class="text-xs text-slate-400 mt-1">${sub}</div>`);
  view.innerHTML = `
    <div class="grid grid-cols-4 gap-4 mb-5">
      ${kpi(t(openKey), openVal, m, accent)}
      ${kpi(t('k.invacc'), k.inventory_accuracy+'%', t('k.invacc.s'),'text-emerald-600')}
      ${kpi(t('k.pickacc'), k.pick_accuracy+'%', t('k.period'),'text-emerald-600')}
      ${kpi(t('k.sla'), k.sla_compliance+'%', t('k.sla.s'),'text-brand-700')}
    </div>
    <div class="grid grid-cols-4 gap-4 mb-5">
      ${kpi(t('k.skus'), fmt(k.skus), t('k.skus.s'))}
      ${kpi(t('k.units'), fmt(k.units), t('k.units.s'))}
      ${kpi(t('k.labour'), k.labour_util+'%', t('k.labour.s'))}
      ${kpi(t('wh.area.shared'), '✓', t('home.'+m.toLowerCase()+'.d'),'text-brand-700')}
    </div>
    <div class="grid grid-cols-3 gap-4">
      <div class="col-span-2">${card(`<div class="font-semibold mb-3 text-sm">${t('dash.thru')}</div><canvas id="thru" height="110"></canvas>`)}</div>
      ${card(`<div class="font-semibold mb-3 text-sm">${t('dash.split')}</div><canvas id="split" height="180"></canvas>
              <p class="text-xs text-slate-400 mt-3">${t('dash.pool')}</p>`)}
    </div>`;
  const tp = await api('throughput');
  const col = isB2B ? '#059669' : '#d946ef';
  new Chart($('#thru'),{type:'bar',data:{labels:tp.map(d=>d.day),
    datasets:[{label:m,data:tp.map(d=>isB2B?d.b2b:d.b2c),backgroundColor:col}]},
    options:{plugins:{legend:{position:'bottom'}}}});
  new Chart($('#split'),{type:'doughnut',data:{labels:['B2B','B2C'],
    datasets:[{data:[k.b2b_orders,k.b2c_orders],backgroundColor:['#059669','#d946ef']}]},
    options:{plugins:{legend:{position:'bottom'}}}});
};

// ---------- INVENTORY ----------
RENDER.inventory = async () => {
  const inv = await api('inventory');
  const rows = inv.map(r=>`<tr>
    <td class="font-mono text-xs">${r.sku}</td><td>${r.name}</td>
    <td class="text-slate-500">${r.category}</td>
    <td>${r.zkind==='golden'?badge('GOLDEN','b-pick'):''} <span class="font-mono text-xs">${r.bin}</span></td>
    <td class="font-mono text-xs">${r.lot}</td><td class="text-slate-500">${r.expiry}</td>
    <td class="text-right font-semibold">${fmt(r.qty)}</td>
    <td class="text-right">${r.velocity>=35?badge(r.velocity,'b-warn'):r.velocity}</td></tr>`).join('');
  view.innerHTML = card(`
    <div class="flex justify-between items-center mb-3">
      <input id="invSearch" placeholder="${t('inv.search')}" class="border rounded-lg px-3 py-2 w-64"/>
      <span class="text-xs text-slate-400">${inv.length} ${t('inv.records')}</span>
    </div>
    <div class="overflow-auto" style="max-height:70vh"><table class="tbl"><thead><tr>
    <th>${t('h.sku')}</th><th>${t('h.name')}</th><th>${t('h.category')}</th><th>${t('h.location')}</th><th>${t('h.lot')}</th><th>${t('h.expiry')}</th>
    <th class="text-right">${t('h.qty')}</th><th class="text-right">${t('h.velocity')}</th></tr></thead>
    <tbody id="invBody">${rows}</tbody></table></div>`);
  $('#invSearch').oninput = e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('#invBody tr').forEach(tr=>
      tr.style.display = tr.textContent.toLowerCase().includes(q)?'':'none');
  };
};
