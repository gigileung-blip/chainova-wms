// ===== i18n engine (TC default, SC, EN) =====
window.LANG = localStorage.getItem('wms_lang') || 'tc';
window.DICT = {};
function t(key){ const e = window.DICT[key]; return e ? (e[window.LANG] || e.en || key) : key; }
function setLang(l){
  window.LANG = l; localStorage.setItem('wms_lang', l);
  document.querySelectorAll('[data-lang-btn]').forEach(b=>
    b.classList.toggle('lang-on', b.dataset.langBtn===l));
  applyStatic();
  if(window.onLangChange) window.onLangChange();
}
function applyStatic(){
  document.querySelectorAll('[data-i18n]').forEach(el=> el.textContent = t(el.dataset.i18n));
  document.documentElement.lang = window.LANG==='en'?'en':(window.LANG==='sc'?'zh-CN':'zh-HK');
}
// merge helper so dictionary can be split across files
function addDict(obj){ Object.assign(window.DICT, obj); }

addDict({
  // brand / nav
  'brand.sub':       {tc:'First Honor · 信海物流園區', sc:'First Honor · 信海物流园区', en:'First Honor · Yuen Long Logistics Park'},
  'nav.ops':         {tc:'營運', sc:'运营', en:'Operations'},
  'nav.ai':          {tc:'AI 智能引擎', sc:'AI 智能引擎', en:'AI Engine'},
  'nav.dashboard':   {tc:'📊 儀表板', sc:'📊 仪表板', en:'📊 Dashboard'},
  'nav.inventory':   {tc:'📦 庫存', sc:'📦 库存', en:'📦 Inventory'},
  'nav.warehouse':   {tc:'🗺️ 倉庫地圖', sc:'🗺️ 仓库地图', en:'🗺️ Warehouse Map'},
  'nav.orders-b2b':  {tc:'🏢 B2B 訂單', sc:'🏢 B2B 订单', en:'🏢 B2B Orders'},
  'nav.orders-b2c':  {tc:'🛒 B2C 訂單', sc:'🛒 B2C 订单', en:'🛒 B2C Orders'},
  'nav.cfs':         {tc:'🚢 CFS 集散轉運', sc:'🚢 CFS 集散转运', en:'🚢 CFS Transit'},
  'nav.billing':     {tc:'💰 閘口費及賬單', sc:'💰 闸口费及账单', en:'💰 Gate Fees & Billing'},
  'nav.ai-pickpath': {tc:'🤖 揀貨路徑優化', sc:'🤖 拣货路径优化', en:'🤖 Pick Path Optimisation'},
  'nav.ai-slotting': {tc:'🤖 動態貨位調整', sc:'🤖 动态货位调整', en:'🤖 Dynamic Slotting'},
  'nav.ai-forecast': {tc:'🤖 需求預測', sc:'🤖 需求预测', en:'🤖 Demand Forecast'},
  'foot.build':      {tc:'示範版本 · 2026年6月', sc:'演示版本 · 2026年6月', en:'Demo build · June 2026'},
  'foot.tag':        {tc:'統一 B2B + B2C + AI', sc:'统一 B2B + B2C + AI', en:'Unified B2B + B2C + AI'},
  'hdr.live':        {tc:'● 即時', sc:'● 实时', en:'● Live'},

  // page titles + subs
  'title.dashboard': {tc:'儀表板', sc:'仪表板', en:'Dashboard'},
  'sub.dashboard':   {tc:'統一 B2B + B2C 營運總覽', sc:'统一 B2B + B2C 运营总览', en:'Unified B2B + B2C operational overview'},
  'title.inventory': {tc:'庫存', sc:'库存', en:'Inventory'},
  'sub.inventory':   {tc:'單一庫存池 · 貨格 / 批次 / 有效期', sc:'单一库存池 · 货格 / 批次 / 有效期', en:'Single inventory pool · bin / lot / expiry'},
  'title.warehouse': {tc:'倉庫地圖', sc:'仓库地图', en:'Warehouse Map'},
  'sub.warehouse':   {tc:'即時貨架及貨格位置 · 元朗', sc:'实时货架及货格位置 · 元朗', en:'Live shelf & bin locations · Yuen Long'},
  'title.orders-b2b':{tc:'B2B 批發訂單', sc:'B2B 批发订单', en:'B2B Wholesale Orders'},
  'sub.orders-b2b':  {tc:'卡板/箱揀貨 · 波次揀貨 · EDI · 長 SLA', sc:'卡板/箱拣货 · 波次拣货 · EDI · 长 SLA', en:'Pallet / case pick · wave picking · EDI · long SLA'},
  'title.orders-b2c':{tc:'B2C 包裹訂單', sc:'B2C 包裹订单', en:'B2C Parcel Orders'},
  'sub.orders-b2c':  {tc:'單件揀貨 · 平台 API · 自動選承運商 · 短 SLA', sc:'单件拣货 · 平台 API · 自动选承运商 · 短 SLA', en:'Each-pick · marketplace API · carrier auto-select · short SLA'},
  'title.cfs':       {tc:'CFS 集散轉運', sc:'CFS 集散转运', en:'CFS Transit'},
  'sub.cfs':         {tc:'貨櫃集散站 · 整批進出 (1–2 日停留)', sc:'货柜集散站 · 整批进出 (1–2 日停留)', en:'Container Freight Station · whole-lot in/out (1–2 day dwell)'},
  'title.billing':   {tc:'閘口費及賬單', sc:'闸口费及账单', en:'Gate Fees & Billing'},
  'sub.billing':     {tc:'按客戶進閘費率 · 經理可調整', sc:'按客户进闸费率 · 经理可调整', en:'Per-customer in-gate rates · manager override'},
  'title.ai-pickpath':{tc:'AI · 揀貨路徑優化', sc:'AI · 拣货路径优化', en:'AI · Pick Path Optimisation'},
  'sub.ai-pickpath': {tc:'機器學習最短揀貨路線', sc:'机器学习最短拣货路线', en:'ML shortest-route picking'},
  'title.ai-slotting':{tc:'AI · 動態貨位調整', sc:'AI · 动态货位调整', en:'AI · Dynamic Slotting'},
  'sub.ai-slotting': {tc:'按流速調整黃金揀貨區', sc:'按流速调整黄金拣货区', en:'Velocity-based golden-zone rebalancing'},
  'title.ai-forecast':{tc:'AI · 需求預測', sc:'AI · 需求预测', en:'AI · Demand Forecast'},
  'sub.ai-forecast': {tc:'30 天預測 + 自動補貨', sc:'30 天预测 + 自动补货', en:'30-day forecast + auto-replenishment'},
});
