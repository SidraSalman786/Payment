// Payment Tracker • app.js
/* Core storage keys */
const KEY_CUSTOMERS = 'pt_customers';
const KEY_PAYMENTS = 'pt_payments';
const KEY_SETTINGS = 'pt_settings';

/* Helpers */
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const nowY = () => new Date().getFullYear();
const formatMoney = (v) => (getSettings().currency || '') + parseFloat(v || 0).toFixed(2);
const uid = (pref='ID')=> (pref + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6)).toUpperCase();

function getSettings(){
  return JSON.parse(localStorage.getItem(KEY_SETTINGS) || '{}');
}
function saveSettings(s){ localStorage.setItem(KEY_SETTINGS, JSON.stringify(s)); }

function getCustomers(){ return JSON.parse(localStorage.getItem(KEY_CUSTOMERS) || '[]'); }
function saveCustomers(list){ localStorage.setItem(KEY_CUSTOMERS, JSON.stringify(list)); }

function getPayments(){ return JSON.parse(localStorage.getItem(KEY_PAYMENTS) || '[]'); }
function savePayments(list){ localStorage.setItem(KEY_PAYMENTS, JSON.stringify(list)); }

/* Business logic functions */
function calculatePending(total, received){ return Math.max(0, parseFloat(total||0) - parseFloat(received||0)); }

function addCustomer(data){
  const customers = getCustomers();
  if (parseFloat(data.receivedAmount) > parseFloat(data.totalAmount)) throw new Error('Received cannot exceed total');
  const customer = {
    id: uid('CUST'),
    name: data.name,
    phone: data.phone||'', whatsapp: data.whatsapp||'', email: data.email||'', address: data.address||'',
    totalAmount: Number(data.totalAmount)||0,
    receivedAmount: Number(data.receivedAmount)||0,
    pendingAmount: calculatePending(data.totalAmount, data.receivedAmount),
    notes: data.notes||'', createdAt: new Date().toISOString()
  };
  customers.unshift(customer);
  saveCustomers(customers);
  renderCustomers(); renderDashboard();
  return customer;
}

function editCustomer(id, patch){
  const customers = getCustomers();
  const idx = customers.findIndex(c=>c.id===id); if(idx<0) return;
  const cust = customers[idx];
  const newTotal = patch.totalAmount!==undefined ? Number(patch.totalAmount) : cust.totalAmount;
  const newReceived = patch.receivedAmount!==undefined ? Number(patch.receivedAmount) : cust.receivedAmount;
  if (newReceived > newTotal) throw new Error('Received cannot exceed total');
  customers[idx] = {...cust,...patch, totalAmount: newTotal, receivedAmount: newReceived, pendingAmount: calculatePending(newTotal, newReceived)};
  saveCustomers(customers); renderCustomers(); renderDashboard();
}

function deleteCustomer(id){
  if(!confirm('Delete customer and all payments?')) return;
  let customers = getCustomers(); customers = customers.filter(c=>c.id!==id); saveCustomers(customers);
  // remove payments
  let payments = getPayments(); payments = payments.filter(p=>p.customerId!==id); savePayments(payments);
  renderCustomers(); renderPayments(); renderDashboard();
}

function addPayment(payment){
  const payments = getPayments();
  const customers = getCustomers();
  const customer = customers.find(c=>c.id===payment.customerId);
  if(!customer) throw new Error('Customer not found');
  if (Number(payment.amount) <= 0) throw new Error('Invalid amount');
  if (Number(payment.amount) > customer.pendingAmount) throw new Error('Payment exceeds pending amount');
  const pay = {...payment, id: uid('PAY'), date: payment.date || new Date().toISOString(), amount: Number(payment.amount)};
  payments.unshift(pay); savePayments(payments);
  // update customer
  customer.receivedAmount = Number((Number(customer.receivedAmount) + Number(pay.amount)).toFixed(2));
  customer.pendingAmount = calculatePending(customer.totalAmount, customer.receivedAmount);
  saveCustomers(customers);
  renderPayments(); renderCustomers(); renderDashboard();
  return pay;
}

function deletePayment(id){
  if(!confirm('Delete this payment?')) return;
  let payments = getPayments(); const p = payments.find(x=>x.id===id); if(!p) return;
  payments = payments.filter(x=>x.id!==id); savePayments(payments);
  // rollback customer amounts
  const customers = getCustomers(); const c = customers.find(x=>x.id===p.customerId);
  if(c){ c.receivedAmount = Number((Number(c.receivedAmount) - Number(p.amount)).toFixed(2)); if(c.receivedAmount<0) c.receivedAmount=0; c.pendingAmount = calculatePending(c.totalAmount, c.receivedAmount); saveCustomers(customers);} 
  renderPayments(); renderCustomers(); renderDashboard();
}

/* Rendering */
function renderDashboard(){
  const customers = getCustomers(); const payments = getPayments();
  const totalCustomers = customers.length;
  const totalReceivable = customers.reduce((s,c)=>s+Number(c.totalAmount),0);
  const totalReceived = customers.reduce((s,c)=>s+Number(c.receivedAmount),0);
  const totalPending = customers.reduce((s,c)=>s+Number(c.pendingAmount),0);
  const paid = customers.filter(c=>Number(c.pendingAmount)===0).length;
  const partial = customers.filter(c=>Number(c.receivedAmount)>0 && Number(c.pendingAmount)>0).length;
  const pending = customers.filter(c=>Number(c.receivedAmount)===0).length;
  const cards = [
    {title:'Total Customers', value: totalCustomers},
    {title:'Total Receivable', value: formatMoney(totalReceivable)},
    {title:'Total Received', value: formatMoney(totalReceived)},
    {title:'Total Pending', value: formatMoney(totalPending)},
    {title:'Paid Customers', value: paid},
    {title:'Partial Customers', value: partial},
    {title:'Pending Customers', value: pending}
  ];
  const container = $('#dashboardCards'); container.innerHTML = '';
  cards.forEach(c=>{ const el = document.createElement('div'); el.className='card'; el.innerHTML=`<div class="title">${c.title}</div><div class="value">${c.value}</div>`; container.appendChild(el); });

  // recent payments
  const recentTbody = $('#recentPaymentsTable tbody'); recentTbody.innerHTML='';
  payments.slice(0,8).forEach(p=>{
    const cust = customers.find(c=>c.id===p.customerId) || {name:'Unknown', pendingAmount:0};
    const tr = document.createElement('tr');
    const tdDate = document.createElement('td'); tdDate.setAttribute('data-label','Date'); tdDate.textContent = new Date(p.date).toLocaleDateString();
    const tdCustomer = document.createElement('td'); tdCustomer.setAttribute('data-label','Customer'); tdCustomer.textContent = cust.name;
    const tdAmount = document.createElement('td'); tdAmount.setAttribute('data-label','Amount'); tdAmount.textContent = formatMoney(p.amount);
    const tdMethod = document.createElement('td'); tdMethod.setAttribute('data-label','Method'); tdMethod.textContent = p.method;
    const tdRemaining = document.createElement('td'); tdRemaining.setAttribute('data-label','Remaining'); tdRemaining.textContent = formatMoney(cust.pendingAmount);
    const tdStatus = document.createElement('td'); tdStatus.setAttribute('data-label','Status'); tdStatus.innerHTML = statusBadge(cust);
    tr.append(tdDate, tdCustomer, tdAmount, tdMethod, tdRemaining, tdStatus);
    recentTbody.appendChild(tr);
  });
}

function statusBadge(c){
  const p = Number(c.pendingAmount)||0; const r = Number(c.receivedAmount)||0;
  if (p===0) return `<span class="status-badge status-paid">PAID</span>`;
  if (r>0 && p>0) return `<span class="status-badge status-partial">PARTIAL</span>`;
  return `<span class="status-badge status-pending">PENDING</span>`;
}

function renderCustomers(){
  const tbody = $('#customersTable tbody'); tbody.innerHTML='';
  const customers = getCustomers();
  const filter = $('#customerStatusFilter').value || 'all';
  const q = ($('#globalSearch').value||'').toLowerCase();
  customers.filter(c=>{
    if(filter==='paid' && Number(c.pendingAmount)!==0) return false;
    if(filter==='partial' && !(Number(c.receivedAmount)>0 && Number(c.pendingAmount)>0)) return false;
    if(filter==='pending' && Number(c.receivedAmount)!==0) return false;
    if(!q) return true;
    return [c.name,c.id,c.phone,(c.whatsapp||'')].join(' ').toLowerCase().includes(q);
  }).forEach(c=>{
    const tr = document.createElement('tr');
    const tId = document.createElement('td'); tId.setAttribute('data-label','ID'); tId.textContent = c.id;
    const tName = document.createElement('td'); tName.setAttribute('data-label','Name'); tName.textContent = c.name;
    const tPhone = document.createElement('td'); tPhone.setAttribute('data-label','Phone'); tPhone.textContent = c.phone||'';
    const tTotal = document.createElement('td'); tTotal.setAttribute('data-label','Total'); tTotal.textContent = formatMoney(c.totalAmount);
    const tReceived = document.createElement('td'); tReceived.setAttribute('data-label','Received'); tReceived.textContent = formatMoney(c.receivedAmount);
    const tPending = document.createElement('td'); tPending.setAttribute('data-label','Pending'); tPending.textContent = formatMoney(c.pendingAmount);
    const tStatus = document.createElement('td'); tStatus.setAttribute('data-label','Status'); tStatus.innerHTML = statusBadge(c);
    const tActions = document.createElement('td'); tActions.className='actions'; tActions.setAttribute('data-label','Actions');
    tActions.innerHTML = `<button data-id="${c.id}" class="btn-view">View</button><button data-id="${c.id}" class="btn-pay">Add Payment</button><button data-id="${c.id}" class="btn-edit">Edit</button><button data-id="${c.id}" class="btn-delete">Delete</button>`;
    tr.append(tId,tName,tPhone,tTotal,tReceived,tPending,tStatus,tActions);
    tbody.appendChild(tr);
  });
}

function renderPayments(){

  const tbody = $('#paymentsTable tbody'); tbody.innerHTML='';
  const payments = getPayments(); const customers = getCustomers();
  payments.forEach(p=>{
    const c = customers.find(x=>x.id===p.customerId) || {name:'Unknown', pendingAmount:0};
    const tr = document.createElement('tr');
    const tdId = document.createElement('td'); tdId.setAttribute('data-label','Payment ID'); tdId.textContent = p.id;
    const tdDate = document.createElement('td'); tdDate.setAttribute('data-label','Date'); tdDate.textContent = new Date(p.date).toLocaleDateString();
    const tdCust = document.createElement('td'); tdCust.setAttribute('data-label','Customer'); tdCust.textContent = c.name;
    const tdAmt = document.createElement('td'); tdAmt.setAttribute('data-label','Amount'); tdAmt.textContent = formatMoney(p.amount);
    const tdMethod = document.createElement('td'); tdMethod.setAttribute('data-label','Method'); tdMethod.textContent = p.method;
    const tdRef = document.createElement('td'); tdRef.setAttribute('data-label','Reference'); tdRef.textContent = p.reference||'';
    const tdRem = document.createElement('td'); tdRem.setAttribute('data-label','Remaining'); tdRem.textContent = formatMoney(c.pendingAmount);
    const tdActions = document.createElement('td'); tdActions.className='actions'; tdActions.setAttribute('data-label','Actions'); tdActions.innerHTML = `<button data-id="${p.id}" class="btn-view-pay">View</button><button data-id="${p.id}" class="btn-print-pay">Print</button><button data-id="${p.id}" class="btn-delete-pay">Delete</button>`;
    tr.append(tdId,tdDate,tdCust,tdAmt,tdMethod,tdRef,tdRem,tdActions);
    tbody.appendChild(tr);
  });
}

/* Reports (top-level) */
function parseDateOnly(d){ const dt = new Date(d); dt.setHours(0,0,0,0); return dt; }
function filterPaymentsByRange(range){
  const payments = getPayments();
  const now = new Date();
  return payments.filter(p=>{
    const pd = new Date(p.date);
    if(range==='all') return true;
    if(range==='today'){
      const a = parseDateOnly(pd).getTime(); const b = parseDateOnly(now).getTime(); return a===b;
    }
    if(range==='week'){
      const diff = (now - pd)/(1000*60*60*24); return diff<=7;
    }
    if(range==='month'){
      return pd.getMonth()===now.getMonth() && pd.getFullYear()===now.getFullYear();
    }
    return true;
  });
}

function renderReports(){
  const range = ($('#reportRange').value||'all');
  const payments = filterPaymentsByRange(range);
  const customers = getCustomers();
  const totalReceived = payments.reduce((s,p)=>s+Number(p.amount),0);
  const totalCount = payments.length;
  const totalPendingOverall = customers.reduce((s,c)=>s+Number(c.pendingAmount),0);
  const paidCustomers = customers.filter(c=>Number(c.pendingAmount)===0).length;
  const partialCustomers = customers.filter(c=>Number(c.receivedAmount)>0 && Number(c.pendingAmount)>0).length;
  const pendingCustomers = customers.filter(c=>Number(c.receivedAmount)===0).length;
  const cardData = [
    {title:`Payments (${range})`, value: totalCount},
    {title:'Total Received (range)', value: formatMoney(totalReceived)},
    {title:'Total Pending (overall)', value: formatMoney(totalPendingOverall)},
    {title:'Total Customers', value: customers.length},
    {title:'Paid Customers', value: paidCustomers},
    {title:'Partial Customers', value: partialCustomers},
    {title:'Pending Customers', value: pendingCustomers}
  ];
  const container = $('#reportCards'); container.innerHTML='';
  cardData.forEach(c=>{ const el = document.createElement('div'); el.className='card'; el.innerHTML=`<div class="title">${c.title}</div><div class="value">${c.value}</div>`; container.appendChild(el); });

  // remove previous report list if present
  const parent = container.parentElement; const prev = parent.querySelector('.table-wrap.report-list'); if(prev) prev.remove();
  let wrap = document.createElement('div'); wrap.className='table-wrap report-list';
  const table = document.createElement('table'); table.style.minWidth = '720px';
  // thead
  const thead = document.createElement('thead'); const htr = document.createElement('tr'); ['Date/Time','Customer','Amount','Remaining','Status','Method','Reference'].forEach(h=>{ const th=document.createElement('th'); th.textContent=h; htr.appendChild(th); }); thead.appendChild(htr);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  if(payments.length===0){ const tr = document.createElement('tr'); const td = document.createElement('td'); td.colSpan=7; td.textContent='No payments for selected range'; tr.appendChild(td); tbody.appendChild(tr); }
  payments.forEach(p=>{
    const c = customers.find(x=>x.id===p.customerId)||{};
    const tr = document.createElement('tr');
    const tdDate = document.createElement('td'); tdDate.setAttribute('data-label','Date/Time'); tdDate.textContent = new Date(p.date).toLocaleString();
    const tdCust = document.createElement('td'); tdCust.setAttribute('data-label','Customer'); tdCust.textContent = c.name||'';
    const tdAmt = document.createElement('td'); tdAmt.setAttribute('data-label','Amount'); tdAmt.textContent = formatMoney(p.amount);
    const tdRem = document.createElement('td'); tdRem.setAttribute('data-label','Remaining'); tdRem.textContent = formatMoney(c.pendingAmount || 0);
    const tdStatus = document.createElement('td'); tdStatus.setAttribute('data-label','Status'); tdStatus.innerHTML = statusBadge(c);
    const tdMethod = document.createElement('td'); tdMethod.setAttribute('data-label','Method'); tdMethod.textContent = p.method||'';
    const tdRef = document.createElement('td'); tdRef.setAttribute('data-label','Reference'); tdRef.textContent = p.reference||'';
    tr.append(tdDate, tdCust, tdAmt, tdRem, tdStatus, tdMethod, tdRef);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  parent.appendChild(wrap);
}

/* Print helpers */
function printReceipt(paymentId){
  const payments = getPayments(); const p = payments.find(x=>x.id===paymentId); if(!p) return alert('Payment not found');
  const customers = getCustomers(); const c = customers.find(x=>x.id===p.customerId)||{};
  const s = getSettings();
  const html = `
    <div style="font-family:Arial;padding:20px;"> 
      <h2>${s.businessName||'Business Name'}</h2>
      <div>${s.businessAddress||''}</div>
      <hr>
      <div><strong>Receipt:</strong> ${p.id}</div>
      <div><strong>Date:</strong> ${new Date(p.date).toLocaleString()}</div>
      <div><strong>Customer:</strong> ${c.name||''} (${c.phone||''})</div>
      <table style="width:100%;margin-top:10px;border-collapse:collapse"><tr><td>Previous Balance</td><td>${formatMoney((Number(c.pendingAmount)+Number(p.amount)).toFixed(2))}</td></tr><tr><td>Payment Received</td><td>${formatMoney(p.amount)}</td></tr><tr><td>Remaining</td><td>${formatMoney(c.pendingAmount)}</td></tr></table>
      <div style="margin-top:20px">Method: ${p.method} • Ref: ${p.reference||''}</div>
      <div style="margin-top:30px;opacity:0.8">${s.receiptFooter||'Thank you'}</div>
    </div>
  `;
  const w = window.open('','_blank'); w.document.write(html); w.document.close(); w.print();
}

function printStatement(customerId){
  const customers = getCustomers(); const c = customers.find(x=>x.id===customerId); if(!c) return alert('Customer not found');
  const payments = getPayments().filter(p=>p.customerId===customerId);
  const s = getSettings();
  const rows = payments.map(p=>`<tr><td>${new Date(p.date).toLocaleDateString()}</td><td>${p.method}</td><td>${formatMoney(p.amount)}</td><td>${p.reference||''}</td></tr>`).join('');
  const html = `<div style="font-family:Arial;padding:20px;"><h2>${s.businessName||'Business'}</h2><div>${s.businessAddress||''}</div><hr><h3>Statement for ${c.name}</h3><div>ID: ${c.id} • Phone: ${c.phone||''}</div><div style="margin-top:12px">Total: ${formatMoney(c.totalAmount)} • Received: ${formatMoney(c.receivedAmount)} • Pending: ${formatMoney(c.pendingAmount)}</div><table style="width:100%;margin-top:12px;border-collapse:collapse"><thead><tr><th>Date</th><th>Method</th><th>Amount</th><th>Reference</th></tr></thead><tbody>${rows}</tbody></table><div style="margin-top:20px">${s.receiptFooter||'Thank you'}</div></div>`;
  const w = window.open('','_blank'); w.document.write(html); w.document.close(); w.print();
}

/* UI wiring */
function showView(name){
  $$('.view').forEach(v=>v.classList.add('hidden'));
  $(`#${name}Section`).classList.remove('hidden');
  $$('.sidebar a').forEach(a=>a.classList.toggle('active', a.dataset.view===name));
  if(name==='reports') renderReports();
  if(name==='dashboard') renderDashboard();
}

function bindUI(){
  $('#year').textContent = nowY();
  $$('.sidebar a').forEach(a=>a.addEventListener('click', e=>{ e.preventDefault(); showView(a.dataset.view); }));
  // mobile sidebar toggle (show overlay when open)
  const btnToggle = $('#btnToggleSidebar'); if(btnToggle){ btnToggle.addEventListener('click', ()=>{
    const appEl = document.querySelector('.app'); const overlay = $('#modalOverlay'); const open = !appEl.classList.contains('sidebar-open');
    appEl.classList.toggle('sidebar-open', open);
    if(overlay) overlay.classList.toggle('hidden', !open);
  }); }
  // close sidebar after navigation on small screens
  $$('.sidebar a').forEach(a=>a.addEventListener('click', ()=>{ if(window.innerWidth<=900){ document.querySelector('.app').classList.remove('sidebar-open'); const overlay=$('#modalOverlay'); if(overlay) overlay.classList.add('hidden'); } }));
  $('#btnAddCustomer').addEventListener('click', ()=> openModal('addCustomerModal'));
  $('#modalOverlay').addEventListener('click', closeModal);
  $$('.btn-cancel').forEach(b=>b.addEventListener('click', closeModal));

  $('#addCustomerForm').addEventListener('submit', e=>{ e.preventDefault(); const f = e.target; const fd = Object.fromEntries(new FormData(f)); try{ addCustomer(fd); closeModal(); f.reset(); }catch(err){ alert(err.message);} });

  $('#customerStatusFilter').addEventListener('change', renderCustomers);
  $('#globalSearch').addEventListener('input', ()=>{ renderCustomers(); renderPayments(); });

  $('#customersTable').addEventListener('click', e=>{
    const id = e.target.dataset.id; if(!id) return;
    const cls = e.target.className;
    if (cls.includes('btn-pay')){ openPaymentModal(id); }
    if (cls.includes('btn-delete')){ deleteCustomer(id); }
    if (cls.includes('btn-edit')){ openEditCustomer(id); }
    if (cls.includes('btn-view')){ printStatement(id); }
  });

  $('#paymentsTable').addEventListener('click', e=>{
    const id = e.target.dataset.id; if(!id) return; const cls = e.target.className;
    if(cls.includes('btn-delete-pay')) deletePayment(id);
    if(cls.includes('btn-print-pay')) printReceipt(id);
    if(cls.includes('btn-view-pay')){ const p = getPayments().find(x=>x.id===id); if(p) alert(JSON.stringify(p,null,2)); }
  });

  $('#addPaymentForm').addEventListener('submit', e=>{ e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target)); try{ addPayment(fd); closeModal(); e.target.reset(); }catch(err){ alert(err.message);} });

  $('#settingsForm').addEventListener('submit', e=>{ e.preventDefault(); const s = Object.fromEntries(new FormData(e.target)); saveSettings(s); alert('Settings saved'); });

  $('#printReport').addEventListener('click', ()=>{ window.print(); });
  $('#reportRange').addEventListener('change', renderReports);
}

function openModal(id){ $('#modalOverlay').classList.remove('hidden'); $(`#${id}`).classList.remove('hidden'); }
function closeModal(){ const overlay = $('#modalOverlay'); if(overlay) overlay.classList.add('hidden'); $$('.modal').forEach(m=>m.classList.add('hidden')); const appEl = document.querySelector('.app'); if(appEl && appEl.classList.contains('sidebar-open')) appEl.classList.remove('sidebar-open'); }

function openPaymentModal(customerId){
  const f = $('#addPaymentForm'); f.customerId.value = customerId; f.date.value = new Date().toISOString().slice(0,10); openModal('addPaymentModal');
}

function openEditCustomer(id){
  const cust = getCustomers().find(c=>c.id===id); if(!cust) return;
  // reuse add modal for simplicity
  openModal('addCustomerModal'); const f = $('#addCustomerForm'); f.name.value=cust.name; f.phone.value=cust.phone; f.whatsapp.value=cust.whatsapp; f.email.value=cust.email; f.address.value=cust.address; f.totalAmount.value=cust.totalAmount; f.receivedAmount.value=cust.receivedAmount; f.notes.value=cust.notes;
  // on submit override
  const onsubmit = function(e){ e.preventDefault(); const fd = Object.fromEntries(new FormData(f)); try{ editCustomer(id, fd); closeModal(); f.removeEventListener('submit', onsubmit); f.reset(); }catch(err){ alert(err.message); } };
  f.addEventListener('submit', onsubmit);
}

/* Init */
function loadSettingsToForm(){ const s = getSettings(); if(!s) return; const form = $('#settingsForm'); Object.entries(s).forEach(([k,v])=>{ const el = form.elements[k]; if(el) el.value = v; }); }

function init(){ bindUI(); loadSettingsToForm(); // default report range to All
  const rr = $('#reportRange'); if(rr) rr.value='all';
  // seed demo data if empty (helps testing/responsive checks)
  if(getCustomers().length===0) seedDemoData();
  renderDashboard(); renderCustomers(); renderPayments(); renderReports(); showView('dashboard'); }

/* Demo data seeder */
function seedDemoData(){
  try{
    const s = getSettings(); if(!s.businessName) saveSettings({businessName:'Demo Business', businessPhone:'0300-0000000', businessAddress:'Demo Address', currency:'PKR ', receiptFooter:'Thank you'});
    // sample customers
    const c1 = addCustomer({name:'Ali Khan', phone:'03001234567', totalAmount:50000, receivedAmount:10000, notes:'Project A'});
    const c2 = addCustomer({name:'Sara Ahmed', phone:'03007654321', totalAmount:20000, receivedAmount:0, notes:'Invoice 002'});
    const c3 = addCustomer({name:'Imran R', phone:'03009998877', totalAmount:15000, receivedAmount:5000, notes:'Partial pay'});
    // sample payments
    addPayment({customerId:c1.id, date:new Date().toISOString(), amount:10000, method:'Cash', reference:'CASH001'});
    addPayment({customerId:c3.id, date:new Date().toISOString(), amount:5000, method:'Bank', reference:'BNK123'});
  }catch(err){ console.error('Seed error', err); }
}

init();
