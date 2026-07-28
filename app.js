/* ---------- Constants ---------- */
const CATEGORIES = ["Serum & Treatment","Lotions","Face Moisturizers & Cream","Facial Wash, Toner & Cleanser","Shower Gel & Soap","Scrub, Mask & Exfoliate","Sunscreen","Belgium Goods","Bundles","Other"];
const PLATFORMS = ["TikTok","Instagram","Facebook","WhatsApp","eBay","Website","Other"];
const EXPENSE_CATEGORIES = ["Stock Purchase","Shipping & Packaging","Subscriptions","Business Registration","Marketing","Other"];

/* ---------- State ---------- */
const S = {
  tab: 'home',
  products: [],
  sales: [],
  expenses: [],
  settings: { currency: '£', businessName: 'My Skincare Books', lowStock: 3 },
  salesFilter: 'all',
  salesSearch: '',
  salesPlatformFilter: 'All',
  salesDateFrom: '',
  salesDateTo: '',
  invCategory: 'All',
  invSearch: '',
  expSearch: '',
  expCategoryFilter: 'All',
  expFrequencyFilter: 'All',
  reportRange: 'month'
};

/* ---------- Utilities ---------- */
function uid() { return DB.uid(); }
function money(n) { const v = Number(n) || 0; return S.settings.currency + v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmtDate(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; }
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function monthBounds(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
function yearBounds() {
  const now = new Date();
  return { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` };
}
function inRange(dateStr, start, end) { return dateStr >= start && dateStr <= end; }

/* ---------- Data load ---------- */
async function loadAll() {
  const [products, sales, expenses, metaRows] = await Promise.all([
    DB.getAll('products'), DB.getAll('sales'), DB.getAll('expenses'), DB.getAll('meta')
  ]);
  S.products = products.sort((a, b) => a.name.localeCompare(b.name));
  S.sales = sales.sort((a, b) => (b.date + (b.createdAt||'')).localeCompare(a.date + (a.createdAt||'')));
  S.expenses = expenses.sort((a, b) => b.date.localeCompare(a.date));
  const meta = {}; metaRows.forEach((m) => meta[m.key] = m.value);
  if (meta.currency) S.settings.currency = meta.currency;
  if (meta.businessName) S.settings.businessName = meta.businessName;
  if (meta.lowStock != null) S.settings.lowStock = meta.lowStock;
  document.getElementById('business-name').textContent = S.settings.businessName;
}
async function saveMeta(key, value) { await DB.put('meta', { key, value }); }

/* ---------- Navigation ---------- */
function setTab(tab) {
  S.tab = tab;
  document.querySelectorAll('.bottomnav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  const fab = document.getElementById('fab-btn');
  if (tab === 'sales') { fab.style.display = 'flex'; fab.onclick = () => openSaleForm(); }
  else if (tab === 'inventory') { fab.style.display = 'flex'; fab.onclick = () => openProductForm(); }
  else if (tab === 'expenses') { fab.style.display = 'flex'; fab.onclick = () => openExpenseForm(); }
  else { fab.style.display = 'none'; }
  render();
}
document.querySelectorAll('.bottomnav button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
document.getElementById('settings-btn').addEventListener('click', openSettings);

function render() {
  const main = document.getElementById('main-content');
  if (S.tab === 'home') main.innerHTML = renderHome();
  else if (S.tab === 'sales') main.innerHTML = renderSales();
  else if (S.tab === 'inventory') main.innerHTML = renderInventory();
  else if (S.tab === 'expenses') main.innerHTML = renderExpenses();
  else if (S.tab === 'reports') main.innerHTML = renderReports();
  bindTabEvents();
}

/* ---------- HOME ---------- */
function renderHome() {
  const m = monthBounds(0);
  const monthSales = S.sales.filter((s) => inRange(s.date, m.start, m.end));
  const monthExpenses = S.expenses.filter((e) => inRange(e.date, m.start, m.end));
  const revenue = monthSales.reduce((a, s) => a + s.earned, 0);
  const profit = monthSales.reduce((a, s) => a + s.profit, 0);
  const expTotal = monthExpenses.reduce((a, e) => a + Number(e.amount || 0), 0);
  const net = profit - expTotal;
  const pending = S.sales.filter((s) => s.paymentStatus === 'Pending');
  const pendingTotal = pending.reduce((a, s) => a + s.earned, 0);
  const lowStock = S.products.filter((p) => Number(p.stock) <= Number(p.lowStockThreshold != null ? p.lowStockThreshold : S.settings.lowStock));
  const todaySales = S.sales.filter((s) => s.date === todayISO());

  return `
    <div class="section-title">This Month</div>
    <div class="stat-grid">
      <div class="stat-box"><div class="label">Revenue</div><div class="value">${money(revenue)}</div></div>
      <div class="stat-box"><div class="label">Profit</div><div class="value green">${money(profit)}</div></div>
      <div class="stat-box"><div class="label">Expenses</div><div class="value red">${money(expTotal)}</div></div>
      <div class="stat-box"><div class="label">Net Profit</div><div class="value ${net >= 0 ? 'green' : 'red'}">${money(net)}</div></div>
    </div>

    <div class="section-title">Today</div>
    <div class="card">
      <div class="row"><div class="row-main"><div class="row-title">${todaySales.length} sale${todaySales.length===1?'':'s'} logged today</div></div>
      <div class="row-end"><div class="row-amount pink">${money(todaySales.reduce((a,s)=>a+s.earned,0))}</div></div></div>
    </div>

    <div class="section-title">Needs Attention</div>
    <div class="card">
      <div class="row"><div class="row-main"><div class="row-title">Pending payments</div><div class="row-sub">${pending.length} sale(s) awaiting payment</div></div>
      <div class="row-end"><div class="row-amount" style="color:var(--amber)">${money(pendingTotal)}</div></div></div>
      <div class="row"><div class="row-main"><div class="row-title">Low stock items</div><div class="row-sub">${lowStock.length} product(s) running low</div></div>
      <div class="row-end"><span class="badge ${lowStock.length ? 'low' : 'ok'}">${lowStock.length ? 'Check stock' : 'All good'}</span></div></div>
    </div>

    ${lowStock.length ? `<div class="card"><h3>Low Stock</h3>${lowStock.map((p) => `
      <div class="row"><div class="row-main"><div class="row-title">${esc(p.name)}</div><div class="row-sub">${esc(p.category)}</div></div>
      <div class="row-end"><span class="badge low">${p.stock} left</span></div></div>`).join('')}</div>` : ''}

    <div class="section-title">All Time</div>
    <div class="stat-grid">
      <div class="stat-box"><div class="label">Total Revenue</div><div class="value">${money(S.sales.reduce((a,s)=>a+s.earned,0))}</div></div>
      <div class="stat-box"><div class="label">Total Profit</div><div class="value green">${money(S.sales.reduce((a,s)=>a+s.profit,0))}</div></div>
    </div>
  `;
}

/* ---------- SALES ---------- */
function getFilteredSales() {
  let list = S.sales;
  if (S.salesFilter === 'paid') list = list.filter((s) => s.paymentStatus === 'Paid');
  if (S.salesFilter === 'pending') list = list.filter((s) => s.paymentStatus === 'Pending');
  if (S.salesPlatformFilter !== 'All') list = list.filter((s) => s.platform === S.salesPlatformFilter);
  if (S.salesDateFrom) list = list.filter((s) => s.date && s.date >= S.salesDateFrom);
  if (S.salesDateTo) list = list.filter((s) => s.date && s.date <= S.salesDateTo);
  const q = S.salesSearch.trim().toLowerCase();
  if (q) list = list.filter((s) => (s.productName || '').toLowerCase().includes(q) || (s.customer || '').toLowerCase().includes(q) || (s.orderNo || '').toLowerCase().includes(q));
  return list;
}
function salesRowsHtml(list) {
  const rows = list.map((s) => `
    <div class="row" data-sale="${s.id}" style="cursor:pointer">
      <div class="row-main">
        <div class="row-title">${esc(s.productName)}</div>
        <div class="row-sub">${fmtDate(s.date)} &middot; ${esc(s.customer || 'No name')} &middot; Qty ${s.qty}</div>
        <span class="badge platform">${esc(s.platform)}</span> <span class="badge ${s.paymentStatus === 'Paid' ? 'paid' : 'pending'}">${s.paymentStatus}</span>
      </div>
      <div class="row-end">
        <div class="row-amount">${money(s.earned)}</div>
        <div class="row-sub" style="color:${s.profit >= 0 ? 'var(--green)' : 'var(--red)'}">profit ${money(s.profit)}</div>
      </div>
    </div>`).join('');
  return rows || emptyState('No sales match', 'Try a different search or clear your filters');
}
function refreshSalesList() {
  const list = getFilteredSales();
  document.getElementById('sales-list').innerHTML = salesRowsHtml(list);
  bindSalesRowClicks();
}
function bindSalesRowClicks() {
  document.querySelectorAll('[data-sale]').forEach((el) => el.addEventListener('click', () => openSaleForm(el.dataset.sale)));
}
function salesFilterCount() {
  return (S.salesPlatformFilter !== 'All' ? 1 : 0) + (S.salesDateFrom ? 1 : 0) + (S.salesDateTo ? 1 : 0);
}
function renderSales() {
  const fCount = salesFilterCount();
  return `
    <div class="search-row">
      <input type="text" id="sales-search" placeholder="Search product, customer, order no..." value="${esc(S.salesSearch)}">
      <button class="filter-btn ${fCount ? 'active-filter' : ''}" id="sales-filter-btn">Filter${fCount ? `<span class="filter-badge">${fCount}</span>` : ''}</button>
    </div>
    <div class="pill-tabs">
      <button data-sfilter="all" class="${S.salesFilter==='all'?'active':''}">All (${S.sales.length})</button>
      <button data-sfilter="paid" class="${S.salesFilter==='paid'?'active':''}">Paid</button>
      <button data-sfilter="pending" class="${S.salesFilter==='pending'?'active':''}">Pending</button>
    </div>
    <div class="card" id="sales-list">${salesRowsHtml(getFilteredSales())}</div>
  `;
}
function openSalesFilterSheet() {
  openSheet('Filter Sales', `
    <label>Platform</label>
    <div class="chips">${['All', ...PLATFORMS].map((p) => `<div class="chip ${S.salesPlatformFilter===p?'active':''}" data-pf="${esc(p)}">${esc(p)}</div>`).join('')}</div>
    <div class="field-row">
      <div><label>From date</label><input type="date" id="filter-date-from" value="${S.salesDateFrom}"></div>
      <div><label>To date</label><input type="date" id="filter-date-to" value="${S.salesDateTo}"></div>
    </div>
    <button class="btn primary" id="apply-sales-filter">Apply Filters</button>
    <button class="btn ghost" id="clear-sales-filter">Clear Filters</button>
  `);
  let pf = S.salesPlatformFilter;
  document.querySelectorAll('[data-pf]').forEach((el) => el.addEventListener('click', () => {
    pf = el.dataset.pf;
    document.querySelectorAll('[data-pf]').forEach((x) => x.classList.toggle('active', x.dataset.pf === pf));
  }));
  document.getElementById('apply-sales-filter').addEventListener('click', () => {
    S.salesPlatformFilter = pf;
    S.salesDateFrom = document.getElementById('filter-date-from').value;
    S.salesDateTo = document.getElementById('filter-date-to').value;
    closeSheet();
    render();
  });
  document.getElementById('clear-sales-filter').addEventListener('click', () => {
    S.salesPlatformFilter = 'All'; S.salesDateFrom = ''; S.salesDateTo = '';
    closeSheet();
    render();
  });
}

/* ---------- INVENTORY ---------- */
function getFilteredProducts() {
  let list = S.products.filter((p) => S.invCategory === 'All' || p.category === S.invCategory);
  const q = S.invSearch.trim().toLowerCase();
  if (q) list = list.filter((p) => (p.name || '').toLowerCase().includes(q));
  return list;
}
function productRowsHtml(list) {
  const rows = list.map((p) => {
    const low = Number(p.stock) <= Number(p.lowStockThreshold != null ? p.lowStockThreshold : S.settings.lowStock);
    return `
    <div class="row" data-product="${p.id}" style="cursor:pointer">
      <div class="row-main">
        <div class="row-title">${esc(p.name)}</div>
        <div class="row-sub">${esc(p.category)} &middot; cost ${money(p.costPrice)} &middot; sells ${money(p.sellingPrice)}</div>
      </div>
      <div class="row-end"><span class="badge ${low ? 'low' : 'ok'}">${p.stock} in stock</span></div>
    </div>`;
  }).join('');
  return rows || emptyState('No products match', 'Try a different search or category');
}
function refreshInventoryList() {
  const list = getFilteredProducts();
  document.getElementById('inventory-list').innerHTML = productRowsHtml(list);
  bindInventoryRowClicks();
}
function bindInventoryRowClicks() {
  document.querySelectorAll('[data-product]').forEach((el) => el.addEventListener('click', () => openProductForm(el.dataset.product)));
}
function renderInventory() {
  const cats = ['All', ...CATEGORIES];
  return `
    <div class="search-row">
      <input type="text" id="inventory-search" placeholder="Search products..." value="${esc(S.invSearch)}">
    </div>
    <div class="chips">${cats.map((c) => `<div class="chip ${S.invCategory===c?'active':''}" data-cat="${esc(c)}">${esc(c)}</div>`).join('')}</div>
    <div class="card" id="inventory-list">${productRowsHtml(getFilteredProducts())}</div>
  `;
}

/* ---------- EXPENSES ---------- */
function getFilteredExpenses() {
  let list = S.expenses;
  if (S.expCategoryFilter !== 'All') list = list.filter((e) => e.category === S.expCategoryFilter);
  if (S.expFrequencyFilter !== 'All') list = list.filter((e) => e.frequency === S.expFrequencyFilter);
  const q = S.expSearch.trim().toLowerCase();
  if (q) list = list.filter((e) => (e.name || '').toLowerCase().includes(q));
  return list;
}
function expenseRowsHtml(list) {
  const rows = list.map((e) => `
    <div class="row" data-expense="${e.id}" style="cursor:pointer">
      <div class="row-main">
        <div class="row-title">${esc(e.name)}</div>
        <div class="row-sub">${fmtDate(e.date)} &middot; ${esc(e.category)} &middot; ${esc(e.frequency)}</div>
      </div>
      <div class="row-end"><div class="row-amount red">${money(e.amount)}</div></div>
    </div>`).join('');
  return rows || emptyState('No expenses match', 'Try a different search or filter');
}
function refreshExpensesList() {
  const list = getFilteredExpenses();
  document.getElementById('expenses-list').innerHTML = expenseRowsHtml(list);
  bindExpenseRowClicks();
}
function bindExpenseRowClicks() {
  document.querySelectorAll('[data-expense]').forEach((el) => el.addEventListener('click', () => openExpenseForm(el.dataset.expense)));
}
function expensesFilterCount() {
  return (S.expCategoryFilter !== 'All' ? 1 : 0) + (S.expFrequencyFilter !== 'All' ? 1 : 0);
}
function renderExpenses() {
  const total = S.expenses.reduce((a, e) => a + Number(e.amount || 0), 0);
  const fCount = expensesFilterCount();
  return `
    <div class="stat-grid" style="margin-bottom:12px">
      <div class="stat-box wide"><div class="label">Total Expenses Logged</div><div class="value red">${money(total)}</div></div>
    </div>
    <div class="search-row">
      <input type="text" id="expenses-search" placeholder="Search expenses..." value="${esc(S.expSearch)}">
      <button class="filter-btn ${fCount ? 'active-filter' : ''}" id="expenses-filter-btn">Filter${fCount ? `<span class="filter-badge">${fCount}</span>` : ''}</button>
    </div>
    <div class="card" id="expenses-list">${expenseRowsHtml(getFilteredExpenses())}</div>
  `;
}
function openExpensesFilterSheet() {
  openSheet('Filter Expenses', `
    <label>Category</label>
    <div class="chips">${['All', ...EXPENSE_CATEGORIES].map((c) => `<div class="chip ${S.expCategoryFilter===c?'active':''}" data-ecf="${esc(c)}">${esc(c)}</div>`).join('')}</div>
    <label>Frequency</label>
    <div class="chips">${['All','One-time','Monthly','Yearly'].map((f) => `<div class="chip ${S.expFrequencyFilter===f?'active':''}" data-eff="${esc(f)}">${esc(f)}</div>`).join('')}</div>
    <button class="btn primary" id="apply-expenses-filter">Apply Filters</button>
    <button class="btn ghost" id="clear-expenses-filter">Clear Filters</button>
  `);
  let ecf = S.expCategoryFilter, eff = S.expFrequencyFilter;
  document.querySelectorAll('[data-ecf]').forEach((el) => el.addEventListener('click', () => {
    ecf = el.dataset.ecf;
    document.querySelectorAll('[data-ecf]').forEach((x) => x.classList.toggle('active', x.dataset.ecf === ecf));
  }));
  document.querySelectorAll('[data-eff]').forEach((el) => el.addEventListener('click', () => {
    eff = el.dataset.eff;
    document.querySelectorAll('[data-eff]').forEach((x) => x.classList.toggle('active', x.dataset.eff === eff));
  }));
  document.getElementById('apply-expenses-filter').addEventListener('click', () => {
    S.expCategoryFilter = ecf; S.expFrequencyFilter = eff;
    closeSheet();
    render();
  });
  document.getElementById('clear-expenses-filter').addEventListener('click', () => {
    S.expCategoryFilter = 'All'; S.expFrequencyFilter = 'All';
    closeSheet();
    render();
  });
}

/* ---------- REPORTS ---------- */
function reportRangeBounds() {
  if (S.reportRange === 'month') return monthBounds(0);
  if (S.reportRange === 'lastmonth') return monthBounds(-1);
  if (S.reportRange === 'year') return yearBounds();
  return { start: '0000-01-01', end: '9999-12-31' };
}
function renderReports() {
  const { start, end } = reportRangeBounds();
  const sales = S.sales.filter((s) => inRange(s.date, start, end));
  const expenses = S.expenses.filter((e) => inRange(e.date, start, end));
  const revenue = sales.reduce((a, s) => a + s.earned, 0);
  const productCost = sales.reduce((a, s) => a + (Number(s.productCost) * Number(s.qty)), 0);
  const fees = sales.reduce((a, s) => a + Number(s.platformFee || 0), 0);
  const shipCost = sales.reduce((a, s) => a + Number(s.shippingCost || 0), 0);
  const profit = sales.reduce((a, s) => a + s.profit, 0);
  const expTotal = expenses.reduce((a, e) => a + Number(e.amount || 0), 0);
  const net = profit - expTotal;

  const byPlatform = {};
  sales.forEach((s) => { byPlatform[s.platform] = byPlatform[s.platform] || { revenue: 0, profit: 0, count: 0 }; byPlatform[s.platform].revenue += s.earned; byPlatform[s.platform].profit += s.profit; byPlatform[s.platform].count += 1; });

  const byProduct = {};
  sales.forEach((s) => { byProduct[s.productName] = byProduct[s.productName] || { qty: 0, profit: 0 }; byProduct[s.productName].qty += Number(s.qty); byProduct[s.productName].profit += s.profit; });
  const topProducts = Object.entries(byProduct).sort((a, b) => b[1].profit - a[1].profit).slice(0, 8);

  return `
    <div class="pill-tabs">
      <button data-range="month" class="${S.reportRange==='month'?'active':''}">This Month</button>
      <button data-range="lastmonth" class="${S.reportRange==='lastmonth'?'active':''}">Last Month</button>
      <button data-range="year" class="${S.reportRange==='year'?'active':''}">This Year</button>
      <button data-range="all" class="${S.reportRange==='all'?'active':''}">All Time</button>
    </div>
    <div class="stat-grid">
      <div class="stat-box"><div class="label">Revenue</div><div class="value">${money(revenue)}</div></div>
      <div class="stat-box"><div class="label">Product + Ship Cost</div><div class="value">${money(productCost + shipCost)}</div></div>
      <div class="stat-box"><div class="label">Platform Fees</div><div class="value">${money(fees)}</div></div>
      <div class="stat-box"><div class="label">Sales Profit</div><div class="value green">${money(profit)}</div></div>
      <div class="stat-box"><div class="label">Expenses</div><div class="value red">${money(expTotal)}</div></div>
      <div class="stat-box"><div class="label">Net Profit</div><div class="value ${net>=0?'green':'red'}">${money(net)}</div></div>
    </div>

    <div class="section-title">By Platform</div>
    <div class="card">${Object.keys(byPlatform).length ? Object.entries(byPlatform).map(([k, v]) => `
      <div class="row"><div class="row-main"><div class="row-title">${esc(k)}</div><div class="row-sub">${v.count} sale(s)</div></div>
      <div class="row-end"><div class="row-amount">${money(v.revenue)}</div><div class="row-sub" style="color:var(--green)">profit ${money(v.profit)}</div></div></div>`).join('') : emptyState('No sales in this range', '')}</div>

    <div class="section-title">Top Products (by profit)</div>
    <div class="card">${topProducts.length ? topProducts.map(([name, v]) => `
      <div class="row"><div class="row-main"><div class="row-title">${esc(name)}</div><div class="row-sub">${v.qty} sold</div></div>
      <div class="row-end"><div class="row-amount green">${money(v.profit)}</div></div></div>`).join('') : emptyState('No sales in this range', '')}</div>

    <button class="btn secondary" id="export-csv-btn">Export sales (CSV for Excel)</button>
  `;
}

function emptyState(title, sub) {
  return `<div class="empty-state"><div class="big">&#127800;</div><div style="font-weight:700">${esc(title)}</div><div style="font-size:12.5px;margin-top:4px">${esc(sub)}</div></div>`;
}

/* ---------- Event binding per tab ---------- */
function bindTabEvents() {
  bindSalesRowClicks();
  bindInventoryRowClicks();
  bindExpenseRowClicks();
  document.querySelectorAll('[data-sfilter]').forEach((el) => el.addEventListener('click', () => { S.salesFilter = el.dataset.sfilter; render(); }));
  document.querySelectorAll('[data-cat]').forEach((el) => el.addEventListener('click', () => { S.invCategory = el.dataset.cat; render(); }));
  document.querySelectorAll('[data-range]').forEach((el) => el.addEventListener('click', () => { S.reportRange = el.dataset.range; render(); }));
  const exportBtn = document.getElementById('export-csv-btn');
  if (exportBtn) exportBtn.addEventListener('click', exportSalesCSV);

  const salesSearch = document.getElementById('sales-search');
  if (salesSearch) salesSearch.addEventListener('input', () => { S.salesSearch = salesSearch.value; refreshSalesList(); });
  const salesFilterBtn = document.getElementById('sales-filter-btn');
  if (salesFilterBtn) salesFilterBtn.addEventListener('click', openSalesFilterSheet);

  const invSearch = document.getElementById('inventory-search');
  if (invSearch) invSearch.addEventListener('input', () => { S.invSearch = invSearch.value; refreshInventoryList(); });

  const expSearch = document.getElementById('expenses-search');
  if (expSearch) expSearch.addEventListener('input', () => { S.expSearch = expSearch.value; refreshExpensesList(); });
  const expFilterBtn = document.getElementById('expenses-filter-btn');
  if (expFilterBtn) expFilterBtn.addEventListener('click', openExpensesFilterSheet);
}

/* ---------- Modal sheet helper ---------- */
function openSheet(title, bodyHtml) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="sheet-overlay" id="sheet-overlay">
      <div class="sheet" id="sheet-body">
        <div class="sheet-header"><h2>${esc(title)}</h2><button class="sheet-close" id="sheet-close">&times;</button></div>
        ${bodyHtml}
      </div>
    </div>`;
  document.getElementById('sheet-overlay').addEventListener('click', (e) => { if (e.target.id === 'sheet-overlay') closeSheet(); });
  document.getElementById('sheet-close').addEventListener('click', closeSheet);
}
function closeSheet() { document.getElementById('modal-root').innerHTML = ''; }

/* ---------- Sale form ---------- */
function openSaleForm(saleId) {
  const editing = saleId ? S.sales.find((s) => s.id === saleId) : null;
  const productOptions = S.products.map((p) => `<option value="${p.id}" ${editing && editing.productId === p.id ? 'selected' : ''}>${esc(p.name)} (${p.stock} in stock)</option>`).join('');
  const platformOptions = PLATFORMS.map((p) => `<option value="${p}" ${editing && editing.platform === p ? 'selected' : ''}>${p}</option>`).join('');

  openSheet(editing ? 'Edit Sale' : 'Log a Sale', `
    <label>Date</label><input type="date" id="f-date" value="${editing ? editing.date : todayISO()}">
    <label>Platform</label><select id="f-platform">${platformOptions}</select>
    <div class="field-row">
      <div><label>Customer name</label><input type="text" id="f-customer" placeholder="e.g. Sue" value="${editing ? esc(editing.customer) : ''}"></div>
      <div><label>Order No (optional)</label><input type="text" id="f-orderno" value="${editing ? esc(editing.orderNo || '') : ''}"></div>
    </div>
    <label>Product</label>
    <select id="f-product"><option value="">-- Custom / not in inventory --</option>${productOptions}</select>
    <label>Product name (if custom)</label><input type="text" id="f-customname" value="${editing && !editing.productId ? esc(editing.productName) : ''}" placeholder="Type product name">
    <div class="field-row">
      <div><label>Qty</label><input type="number" id="f-qty" min="1" value="${editing ? editing.qty : 1}"></div>
      <div><label>Selling price / unit</label><input type="number" step="0.01" id="f-sellingprice" value="${editing ? editing.sellingPrice : ''}"></div>
    </div>
    <div class="field-row">
      <div><label>Shipping charged to customer</label><input type="number" step="0.01" id="f-shipcharged" value="${editing ? editing.shippingCharged : 0}"></div>
      <div><label>Platform / payment fee</label><input type="number" step="0.01" id="f-fee" value="${editing ? editing.platformFee : 0}"></div>
    </div>
    <div class="field-row">
      <div><label>Product cost / unit</label><input type="number" step="0.01" id="f-cost" value="${editing ? editing.productCost : ''}"></div>
      <div><label>Shipping cost (what you paid)</label><input type="number" step="0.01" id="f-shipcost" value="${editing ? editing.shippingCost : 0}"></div>
    </div>
    <div class="field-row">
      <div><label>Payment status</label><select id="f-status"><option ${editing && editing.paymentStatus==='Paid'?'selected':''}>Paid</option><option ${editing && editing.paymentStatus==='Pending'?'selected':''}>Pending</option></select></div>
      <div><label>Payment date</label><input type="date" id="f-paydate" value="${editing ? editing.paymentDate || '' : ''}"></div>
    </div>
    <label>Notes</label><textarea id="f-notes">${editing ? esc(editing.notes || '') : ''}</textarea>

    <div class="computed-box">
      <div class="item"><div class="lab">EARNED</div><div class="val" id="calc-earned">${S.settings.currency}0.00</div></div>
      <div class="item"><div class="lab">PROFIT</div><div class="val" id="calc-profit">${S.settings.currency}0.00</div></div>
    </div>

    <button class="btn primary" id="save-sale-btn">${editing ? 'Save Changes' : 'Save Sale'}</button>
    ${editing ? '<button class="btn danger" id="delete-sale-btn">Delete Sale</button>' : ''}
  `);

  const productSelect = document.getElementById('f-product');
  productSelect.addEventListener('change', () => {
    const p = S.products.find((x) => x.id === productSelect.value);
    if (p) { document.getElementById('f-sellingprice').value = p.sellingPrice; document.getElementById('f-cost').value = p.costPrice; }
    recalcSaleForm();
  });
  ['f-qty', 'f-sellingprice', 'f-shipcharged', 'f-fee', 'f-cost', 'f-shipcost'].forEach((id) => document.getElementById(id).addEventListener('input', recalcSaleForm));
  recalcSaleForm();

  document.getElementById('save-sale-btn').addEventListener('click', () => saveSale(editing));
  if (editing) document.getElementById('delete-sale-btn').addEventListener('click', () => deleteSale(editing));
}

function recalcSaleForm() {
  const qty = Number(document.getElementById('f-qty').value) || 0;
  const sp = Number(document.getElementById('f-sellingprice').value) || 0;
  const ship = Number(document.getElementById('f-shipcharged').value) || 0;
  const fee = Number(document.getElementById('f-fee').value) || 0;
  const cost = Number(document.getElementById('f-cost').value) || 0;
  const shipCost = Number(document.getElementById('f-shipcost').value) || 0;
  const earned = (sp * qty) + ship - fee - shipCost;
  const profit = earned - (cost * qty);
  document.getElementById('calc-earned').textContent = money(earned);
  document.getElementById('calc-profit').textContent = money(profit);
}

async function saveSale(editing) {
  const productId = document.getElementById('f-product').value || null;
  const product = productId ? S.products.find((p) => p.id === productId) : null;
  const customName = document.getElementById('f-customname').value.trim();
  const productName = product ? product.name : customName;
  if (!productName) { toast('Please select or type a product name'); return; }
  const qty = Number(document.getElementById('f-qty').value) || 0;
  if (qty <= 0) { toast('Quantity must be at least 1'); return; }
  const sellingPrice = Number(document.getElementById('f-sellingprice').value) || 0;
  const shippingCharged = Number(document.getElementById('f-shipcharged').value) || 0;
  const platformFee = Number(document.getElementById('f-fee').value) || 0;
  const productCost = Number(document.getElementById('f-cost').value) || 0;
  const shippingCost = Number(document.getElementById('f-shipcost').value) || 0;
  const earned = (sellingPrice * qty) + shippingCharged - platformFee - shippingCost;
  const profit = earned - (productCost * qty);

  const sale = {
    id: editing ? editing.id : uid(),
    date: document.getElementById('f-date').value || todayISO(),
    platform: document.getElementById('f-platform').value,
    customer: document.getElementById('f-customer').value.trim(),
    orderNo: document.getElementById('f-orderno').value.trim(),
    productId, productName, qty, sellingPrice, shippingCharged, platformFee, productCost, shippingCost, earned, profit,
    paymentStatus: document.getElementById('f-status').value,
    paymentDate: document.getElementById('f-paydate').value || '',
    notes: document.getElementById('f-notes').value.trim(),
    createdAt: editing ? editing.createdAt : new Date().toISOString()
  };

  // Adjust stock: restore old product's stock (if editing), then deduct from new selection
  if (editing && editing.productId) {
    const oldProduct = S.products.find((p) => p.id === editing.productId);
    if (oldProduct) { oldProduct.stock = Number(oldProduct.stock) + Number(editing.qty); await DB.put('products', oldProduct); }
  }
  if (productId) {
    const p = S.products.find((x) => x.id === productId);
    if (p) { p.stock = Number(p.stock) - qty; await DB.put('products', p); }
  }

  await DB.put('sales', sale);
  closeSheet();
  toast(editing ? 'Sale updated' : 'Sale logged');
  await loadAll();
  render();
}

async function deleteSale(sale) {
  if (!confirm('Delete this sale? This cannot be undone.')) return;
  if (sale.productId) {
    const p = S.products.find((x) => x.id === sale.productId);
    if (p) { p.stock = Number(p.stock) + Number(sale.qty); await DB.put('products', p); }
  }
  await DB.delete('sales', sale.id);
  closeSheet();
  toast('Sale deleted');
  await loadAll();
  render();
}

/* ---------- Product form ---------- */
function openProductForm(productId) {
  const editing = productId ? S.products.find((p) => p.id === productId) : null;
  const catOptions = CATEGORIES.map((c) => `<option ${editing && editing.category === c ? 'selected' : ''}>${c}</option>`).join('');
  openSheet(editing ? 'Edit Product' : 'Add Product', `
    <label>Product name</label><input type="text" id="p-name" value="${editing ? esc(editing.name) : ''}">
    <label>Category</label><select id="p-category">${catOptions}</select>
    <div class="field-row">
      <div><label>Cost price / unit</label><input type="number" step="0.01" id="p-cost" value="${editing ? editing.costPrice : ''}"></div>
      <div><label>Selling price / unit</label><input type="number" step="0.01" id="p-price" value="${editing ? editing.sellingPrice : ''}"></div>
    </div>
    <div class="field-row">
      <div><label>Current stock</label><input type="number" id="p-stock" value="${editing ? editing.stock : 0}"></div>
      <div><label>Low stock alert below</label><input type="number" id="p-lowstock" value="${editing ? (editing.lowStockThreshold != null ? editing.lowStockThreshold : S.settings.lowStock) : S.settings.lowStock}"></div>
    </div>
    <button class="btn primary" id="save-product-btn">${editing ? 'Save Changes' : 'Add Product'}</button>
    ${editing ? '<button class="btn secondary" id="restock-btn">+ Add Stock (restock)</button><button class="btn danger" id="delete-product-btn">Delete Product</button>' : ''}
  `);
  document.getElementById('save-product-btn').addEventListener('click', () => saveProduct(editing));
  if (editing) {
    document.getElementById('delete-product-btn').addEventListener('click', () => deleteProduct(editing));
    document.getElementById('restock-btn').addEventListener('click', () => restockProduct(editing));
  }
}

async function saveProduct(editing) {
  const name = document.getElementById('p-name').value.trim();
  if (!name) { toast('Please enter a product name'); return; }
  const product = {
    id: editing ? editing.id : uid(),
    name,
    category: document.getElementById('p-category').value,
    costPrice: Number(document.getElementById('p-cost').value) || 0,
    sellingPrice: Number(document.getElementById('p-price').value) || 0,
    stock: Number(document.getElementById('p-stock').value) || 0,
    lowStockThreshold: Number(document.getElementById('p-lowstock').value) || 0,
    createdAt: editing ? editing.createdAt : new Date().toISOString()
  };
  await DB.put('products', product);
  closeSheet();
  toast(editing ? 'Product updated' : 'Product added');
  await loadAll();
  render();
}

async function restockProduct(product) {
  const qty = prompt(`How many units of "${product.name}" are you adding to stock?`, '10');
  if (qty === null) return;
  const n = Number(qty);
  if (!n || n <= 0) { toast('Enter a valid quantity'); return; }
  product.stock = Number(product.stock) + n;
  await DB.put('products', product);
  closeSheet();
  toast(`Added ${n} to stock`);
  await loadAll();
  render();
}

async function deleteProduct(product) {
  if (!confirm(`Delete "${product.name}"? Past sales records will keep the product name but no longer link to it.`)) return;
  await DB.delete('products', product.id);
  closeSheet();
  toast('Product deleted');
  await loadAll();
  render();
}

/* ---------- Expense form ---------- */
function openExpenseForm(expenseId) {
  const editing = expenseId ? S.expenses.find((e) => e.id === expenseId) : null;
  const catOptions = EXPENSE_CATEGORIES.map((c) => `<option ${editing && editing.category === c ? 'selected' : ''}>${c}</option>`).join('');
  openSheet(editing ? 'Edit Expense' : 'Log an Expense', `
    <label>Expense name</label><input type="text" id="e-name" value="${editing ? esc(editing.name) : ''}" placeholder="e.g. Squarespace subscription">
    <label>Category</label><select id="e-category">${catOptions}</select>
    <div class="field-row">
      <div><label>Amount</label><input type="number" step="0.01" id="e-amount" value="${editing ? editing.amount : ''}"></div>
      <div><label>Date</label><input type="date" id="e-date" value="${editing ? editing.date : todayISO()}"></div>
    </div>
    <label>Frequency</label>
    <select id="e-frequency">
      <option ${editing && editing.frequency==='One-time'?'selected':''}>One-time</option>
      <option ${editing && editing.frequency==='Monthly'?'selected':''}>Monthly</option>
      <option ${editing && editing.frequency==='Yearly'?'selected':''}>Yearly</option>
    </select>
    <label>Notes</label><textarea id="e-notes">${editing ? esc(editing.notes || '') : ''}</textarea>
    <button class="btn primary" id="save-expense-btn">${editing ? 'Save Changes' : 'Save Expense'}</button>
    ${editing ? '<button class="btn secondary" id="dup-expense-btn">Duplicate for today</button><button class="btn danger" id="delete-expense-btn">Delete Expense</button>' : ''}
  `);
  document.getElementById('save-expense-btn').addEventListener('click', () => saveExpense(editing));
  if (editing) {
    document.getElementById('delete-expense-btn').addEventListener('click', () => deleteExpense(editing));
    document.getElementById('dup-expense-btn').addEventListener('click', () => duplicateExpense(editing));
  }
}

async function saveExpense(editing) {
  const name = document.getElementById('e-name').value.trim();
  if (!name) { toast('Please enter an expense name'); return; }
  const expense = {
    id: editing ? editing.id : uid(),
    name,
    category: document.getElementById('e-category').value,
    amount: Number(document.getElementById('e-amount').value) || 0,
    date: document.getElementById('e-date').value || todayISO(),
    frequency: document.getElementById('e-frequency').value,
    notes: document.getElementById('e-notes').value.trim(),
    createdAt: editing ? editing.createdAt : new Date().toISOString()
  };
  await DB.put('expenses', expense);
  closeSheet();
  toast(editing ? 'Expense updated' : 'Expense saved');
  await loadAll();
  render();
}
async function duplicateExpense(expense) {
  const copy = { ...expense, id: uid(), date: todayISO(), createdAt: new Date().toISOString() };
  await DB.put('expenses', copy);
  closeSheet();
  toast('Expense duplicated for today');
  await loadAll();
  render();
}
async function deleteExpense(expense) {
  if (!confirm('Delete this expense?')) return;
  await DB.delete('expenses', expense.id);
  closeSheet();
  toast('Expense deleted');
  await loadAll();
  render();
}

/* ---------- Settings ---------- */
function openSettings() {
  openSheet('Settings', `
    <label>Business name</label><input type="text" id="s-bizname" value="${esc(S.settings.businessName)}">
    <label>Currency symbol</label>
    <select id="s-currency">
      <option value="£" ${S.settings.currency==='£'?'selected':''}>&#163; British Pound</option>
      <option value="$" ${S.settings.currency==='$'?'selected':''}>$ US Dollar</option>
      <option value="€" ${S.settings.currency==='€'?'selected':''}>&#8364; Euro</option>
      <option value="₦" ${S.settings.currency==='₦'?'selected':''}>&#8358; Naira</option>
    </select>
    <label>Default low stock alert level</label><input type="number" id="s-lowstock" value="${S.settings.lowStock}">
    <button class="btn primary" id="save-settings-btn">Save Settings</button>

    <div class="section-title">Restore My Data</div>
    <div class="card">
      <p style="font-size:12.5px;color:var(--muted);margin-top:0">Restore your products, sales and expenses from your latest saved backup. Useful if you reinstall the app or set it up on a new phone.</p>
      <button class="btn primary" id="import-excel-btn">Restore My Data</button>
    </div>

    <div class="section-title">Update Stock From Excel</div>
    <div class="card">
      <p style="font-size:12.5px;color:var(--muted);margin-top:0">Refresh stock levels, cost prices and selling prices for your products from your latest Excel sheet. Existing products are matched by name and updated; anything new is added. Sales and expenses are not touched.</p>
      <button class="btn primary" id="update-stock-btn">Update Stock From Excel</button>
    </div>

    <div class="section-title">Backup &amp; Data</div>
    <div class="card">
      <p style="font-size:12.5px;color:var(--muted);margin-top:0">Your data lives only on this device/browser. Back up regularly and save the file to email, Google Drive or WhatsApp yourself so you never lose it.</p>
      <button class="btn secondary" id="backup-btn">Download Full Backup</button>
      <label>Restore from backup file</label><input type="file" id="restore-file" accept=".json">
      <button class="btn secondary" id="export-sales-btn">Export Sales as CSV (Excel)</button>
    </div>

    <div class="section-title">Danger Zone</div>
    <div class="card">
      <button class="btn danger" id="clear-data-btn">Erase All Data</button>
    </div>

    <div class="section-title">Install App</div>
    <div class="card">
      <p style="font-size:12.5px;color:var(--muted);margin-top:0"><b>iPhone:</b> open this page in Safari &rarr; tap Share &rarr; "Add to Home Screen".<br><br><b>Android:</b> open this page in Chrome &rarr; tap the menu (&#8942;) &rarr; "Add to Home screen" / "Install app".</p>
    </div>
  `);
  document.getElementById('save-settings-btn').addEventListener('click', saveSettings);
  document.getElementById('import-excel-btn').addEventListener('click', importExcelData);
  document.getElementById('update-stock-btn').addEventListener('click', updateStockFromExcel);
  document.getElementById('backup-btn').addEventListener('click', downloadBackup);
  document.getElementById('export-sales-btn').addEventListener('click', exportSalesCSV);
  document.getElementById('restore-file').addEventListener('change', restoreBackup);
  document.getElementById('clear-data-btn').addEventListener('click', clearAllData);
}

async function saveSettings() {
  S.settings.businessName = document.getElementById('s-bizname').value.trim() || 'My Skincare Books';
  S.settings.currency = document.getElementById('s-currency').value;
  S.settings.lowStock = Number(document.getElementById('s-lowstock').value) || 0;
  await saveMeta('businessName', S.settings.businessName);
  await saveMeta('currency', S.settings.currency);
  await saveMeta('lowStock', S.settings.lowStock);
  document.getElementById('business-name').textContent = S.settings.businessName;
  closeSheet();
  toast('Settings saved');
  render();
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function downloadBackup() {
  const data = await DB.exportAll();
  downloadFile(`skincare-books-backup-${todayISO()}.json`, JSON.stringify(data, null, 2), 'application/json');
  toast('Backup downloaded');
}

async function importExcelData() {
  if (!confirm('Import your products, sales and expenses from your old Excel sheet into the app now?')) return;
  try {
    const res = await fetch('excel-import-backup.json');
    if (!res.ok) throw new Error('not found');
    const data = await res.json();
    await DB.importAll(data);
    toast('Excel data imported');
    closeSheet();
    await loadAll();
    render();
  } catch (err) {
    toast('Could not find the Excel import file');
  }
}

async function updateStockFromExcel() {
  if (!confirm('Update stock levels and prices from your latest Excel sheet now?')) return;
  try {
    const res = await fetch('stock-update.json?t=' + Date.now());
    if (!res.ok) throw new Error('not found');
    const entries = await res.json();
    let updated = 0, added = 0;
    for (const e of entries) {
      const existing = S.products.find((p) => p.name.trim().toLowerCase() === e.name.trim().toLowerCase());
      if (existing) {
        existing.stock = e.stock;
        existing.costPrice = e.costPrice;
        existing.sellingPrice = e.sellingPrice;
        await DB.put('products', existing);
        updated++;
      } else {
        const product = { id: uid(), name: e.name, category: e.category, costPrice: e.costPrice, sellingPrice: e.sellingPrice, stock: e.stock, lowStockThreshold: S.settings.lowStock, createdAt: new Date().toISOString() };
        await DB.put('products', product);
        S.products.push(product);
        added++;
      }
    }
    toast(`Updated ${updated}, added ${added} new products`);
    closeSheet();
    await loadAll();
    render();
  } catch (err) {
    toast('Could not find the stock update file');
  }
}

function restoreBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!confirm('This will add/overwrite records from the backup file. Continue?')) { e.target.value = ''; return; }
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      await DB.importAll(data);
      toast('Backup restored');
      closeSheet();
      await loadAll();
      render();
    } catch (err) { toast('Could not read that file'); }
  };
  reader.readAsText(file);
}

function exportSalesCSV() {
  const headers = ['Date','Platform','Customer','Order No','Product','Qty','Selling Price','Shipping Charged','Platform Fee','Product Cost','Shipping Cost','Earned','Profit','Payment Status','Payment Date','Notes'];
  const rows = S.sales.map((s) => [s.date, s.platform, s.customer, s.orderNo, s.productName, s.qty, s.sellingPrice, s.shippingCharged, s.platformFee, s.productCost, s.shippingCost, s.earned.toFixed(2), s.profit.toFixed(2), s.paymentStatus, s.paymentDate, s.notes]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  downloadFile(`sales-export-${todayISO()}.csv`, csv, 'text/csv');
  toast('Sales exported');
}

async function clearAllData() {
  if (!confirm('This will permanently erase ALL products, sales and expenses from this device. This cannot be undone. Are you sure?')) return;
  if (!confirm('Really sure? Consider downloading a backup first.')) return;
  await DB.clearAll();
  closeSheet();
  toast('All data erased');
  await loadAll();
  render();
}

/* ---------- Init ---------- */
async function init() {
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('sw.js'); } catch (e) { /* ignore */ }
  }
  await loadAll();
  setTab('home');
}
init();
