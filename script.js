// === HELPERS ===
function showToast(msg, isError = false) {
    const toast = document.createElement('div');
    toast.className = 'toast' + (isError ? ' error' : '');
    toast.innerHTML = `<div class="toast-text">${msg}</div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// === DATA ===
let payrollData = JSON.parse(localStorage.getItem('htb_payroll')) || [];
const defaultItems = [ "Vasos 8 oz", "Platos", "Tenedores", "Cucharas", "Vasos 16 oz", "Bolsas Basura", "Servilletas", "Platos Cuadrados" ];
let itemsList = JSON.parse(localStorage.getItem('htb_items_list')) || defaultItems;
let inventoryState = JSON.parse(localStorage.getItem('htb_inventory')) || {};
let currentFilter = 'all';

// === NÓMINA ===
function renderPayroll() {
    const list = document.getElementById('payrollList');
    list.innerHTML = '';
    
    let filtered = payrollData.map((item, index) => ({ item, originalIndex: index }));
    if (currentFilter === 'pending') filtered = filtered.filter(x => !x.item.paid);
    else if (currentFilter === 'paid') filtered = filtered.filter(x => x.item.paid);

    filtered.sort((a, b) => new Date(b.item.date) - new Date(a.item.date));

    if (filtered.length === 0) { list.innerHTML = '<div class="empty-state">No hay registros</div>'; updateStats(); return; }

    const grouped = {};
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    filtered.forEach(obj => {
        const d = new Date(obj.item.date);
        const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        if(!grouped[key]) grouped[key] = [];
        grouped[key].push(obj);
    });

    for (const [monthKey, items] of Object.entries(grouped)) {
        const details = document.createElement('details');
        details.open = true;
        const monthTotal = items.reduce((acc, curr) => acc + (curr.item.base - curr.item.discount), 0);
        details.innerHTML = `<summary>${monthKey} <span style="font-weight:normal; color:#fff;">(Total: Q${monthTotal})</span></summary>`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'month-content';

        items.forEach((wrapper) => {
            const item = wrapper.item;
            const index = wrapper.originalIndex;
            const total = item.base - item.discount;
            const dateObj = new Date(item.date);
            const dateStr = `${dateObj.getDate()}/${dateObj.getMonth()+1}`;
            
            // Texto chiquito (F./Adel)
            const reasonText = item.reason ? item.reason : '';
            const smallText = `${dateStr} • F./Adel: Q${item.discount} <span class="reason-tag">(${reasonText})</span>`;

            // Texto grande (Limpio)
            let displayMoney = `Q${total}`;
            let moneyClass = '';
            
            if (total < 0) {
                displayMoney = `-Q${Math.abs(total)}`; // LIMPIO: Sin texto "ADELANTO"
                moneyClass = 'negative';
            } else if (total === 0) {
                displayMoney = `SALDADO`;
                moneyClass = 'zero';
            }

            contentDiv.innerHTML += `
                <div class="card ${item.paid ? 'pagado' : ''}">
                    <div class="card-info">
                        <h3>${item.name}</h3>
                        <p>${smallText}</p>
                    </div>
                    <div class="money-block">
                        <div class="money-display ${moneyClass}">${displayMoney}</div>
                    </div>
                    <div class="card-actions">
                        <button class="btn-icon btn-pay ${item.paid ? 'pagado' : ''}" onclick="togglePay(${index})">✔</button>
                        <button class="btn-icon btn-del" onclick="deleteEntry(${index})">🗑️</button>
                    </div>
                </div>`;
        });
        details.appendChild(contentDiv);
        list.appendChild(details);
    }
    updateStats();
}

function updateStats() {
    const pending = payrollData.filter(p => !p.paid).reduce((sum, p) => sum + (p.base - p.discount), 0);
    const paid = payrollData.filter(p => p.paid).reduce((sum, p) => sum + (p.base - p.discount), 0);
    document.getElementById('stat-pending').textContent = 'Q' + pending.toFixed(0);
    document.getElementById('stat-paid').textContent = 'Q' + paid.toFixed(0);
}

function addEntry() {
    const name = document.getElementById('workerName').value;
    const base = parseFloat(document.getElementById('basePay').value);
    const disc = parseFloat(document.getElementById('discount').value) || 0;
    const reason = document.getElementById('discReason').value;
    const dateInput = document.getElementById('payDate').value;
    const date = dateInput ? new Date(dateInput + 'T12:00:00').toISOString() : new Date().toISOString();

    if (!base || base <= 0) { showToast('⚠️ Falta Base', true); return; }

    if (name === "Ambas") {
        payrollData.push({ name: "Sara", date, base, discount: 0, reason: "", paid: false });
        payrollData.push({ name: "Seca", date, base, discount: 0, reason: "", paid: false });
        showToast('✓ Agregadas ambas');
    } else {
        payrollData.push({ name, date, base, discount: disc, reason: reason, paid: false });
        showToast('✓ Agregado');
    }
    savePayroll();
    document.getElementById('discount').value = '';
    document.getElementById('discReason').value = '';
}

function togglePay(i) { payrollData[i].paid = !payrollData[i].paid; savePayroll(); }
function deleteEntry(i) { if(confirm('¿Borrar registro?')) { payrollData.splice(i, 1); savePayroll(); showToast('Eliminado', true); } }
function savePayroll() { localStorage.setItem('htb_payroll', JSON.stringify(payrollData)); renderPayroll(); }
function setFilter(f) { currentFilter = f; document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active')); event.target.classList.add('active'); renderPayroll(); }

function exportData() {
    let txt = '=== HTB EXPORT ===\n';
    payrollData.forEach(p => txt += `${p.name} | Q${p.base - p.discount} | ${p.paid ? 'OK':'PEND'} | ${p.reason}\n`);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], {type:'text/plain'})); a.download = 'htb_export.txt'; a.click();
}

// === INVENTARIO ===
function renderInventory() {
    const list = document.getElementById('inventoryList');
    list.innerHTML = '';
    if(itemsList.length === 0) list.innerHTML = '<div class="empty-state">Sin productos</div>';
    itemsList.forEach((item, index) => {
        const qty = inventoryState[item] || 0;
        list.innerHTML += `
            <div class="inv-item">
                <div class="inv-left">
                    <button class="btn-del-item" onclick="deleteItemFromList(${index})">×</button>
                    <span class="inv-name">${item}</span>
                </div>
                <div class="stepper">
                    <button class="stepper-btn" onclick="updStock('${item}', -1)">−</button>
                    <div class="stepper-val">${qty}</div>
                    <button class="stepper-btn" onclick="updStock('${item}', 1)">+</button>
                </div>
            </div>`;
    });
    updateInvStats();
}
function updateInvStats() {
    const active = Object.values(inventoryState).filter(v => v > 0).length;
    const total = Object.values(inventoryState).reduce((sum, v) => sum + v, 0);
    document.getElementById('inv-active').textContent = active;
    document.getElementById('inv-total').textContent = total;
}
function addItemToList() {
    const input = document.getElementById('newItemName'); const name = input.value.trim();
    if (name && !itemsList.includes(name)) { itemsList.push(name); localStorage.setItem('htb_items_list', JSON.stringify(itemsList)); renderInventory(); input.value = ''; showToast(`Agregado`); }
}
function deleteItemFromList(index) {
    if(confirm(`¿Eliminar item?`)) { const item = itemsList[index]; itemsList.splice(index, 1); delete inventoryState[item]; localStorage.setItem('htb_items_list', JSON.stringify(itemsList)); localStorage.setItem('htb_inventory', JSON.stringify(inventoryState)); renderInventory(); }
}
function updStock(item, change) {
    let n = (inventoryState[item] || 0) + change; inventoryState[item] = n < 0 ? 0 : n; localStorage.setItem('htb_inventory', JSON.stringify(inventoryState)); renderInventory();
}
function resetInventory() {
    if (confirm('¿Stock a CERO?')) { inventoryState = {}; localStorage.setItem('htb_inventory', JSON.stringify(inventoryState)); renderInventory(); showToast('Reset OK'); }
}

// === BACKUP ===
function downloadBackup() {
    const data = { payroll: payrollData, items: itemsList, stock: inventoryState, v: "13" };
    const blob = new Blob([JSON.stringify(data)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `HTB_Backup_${new Date().toISOString().slice(0,10)}.json`; a.click();
    showToast('Backup descargado');
}
function restoreBackup() {
    const file = document.getElementById('backupFile').files[0];
    if (!file) { showToast('Selecciona archivo', true); return; }
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if(data.payroll) {
                if(confirm('¿Sobrescribir datos?')) {
                    localStorage.setItem('htb_payroll', JSON.stringify(data.payroll));
                    localStorage.setItem('htb_items_list', JSON.stringify(data.items));
                    localStorage.setItem('htb_inventory', JSON.stringify(data.stock));
                    location.reload();
                }
            } else { showToast('Archivo inválido', true); }
        } catch(err) { showToast('Error al leer', true); }
    };
    reader.readAsText(file);
}

// === SNAPSHOT LOGIC ===
function openSnapModal() {
    const isInventory = document.getElementById('page-inventario').classList.contains('active');
    let content = '';

    if (isInventory) {
        document.getElementById('snapTitle').innerText = "INVENTARIO";
        if (itemsList.length === 0) content = '<div style="text-align:center">Vacío</div>';
        else {
            content += `<table class="snap-table"><thead><tr><th>PRODUCTO</th><th style="text-align:right">CANT</th></tr></thead><tbody>`;
            itemsList.forEach(item => {
                const qty = inventoryState[item] || 0;
                const qtyStyle = qty === 0 ? 'color:#ff4b4b;' : '';
                const qtyText = qty === 0 ? 'AGOTADO' : qty;
                content += `<tr><td>${item}</td><td style="text-align:right; ${qtyStyle}">${qtyText}</td></tr>`;
            });
            content += `</tbody></table>`;
            const total = Object.values(inventoryState).reduce((a,b)=>a+b,0);
            content += `<div class="snap-row-total">TOTAL UNIDADES: ${total}</div>`;
        }
    } else {
        document.getElementById('snapTitle').innerText = "PENDIENTES";
        const pendientes = payrollData.filter(p => !p.paid);
        let totalDeuda = 0;

        if (pendientes.length === 0) {
            content = `<div style="text-align:center; color:#888; margin-top:20px;">Todo al día.</div>`;
        } else {
            pendientes.sort((a,b) => a.name.localeCompare(b.name) || new Date(a.date) - new Date(b.date));
            content += `<table class="snap-table"><thead><tr><th style="width:20%">FECHA</th><th style="width:50%">CONCEPTO</th><th style="width:30%; text-align:right;">SALDO</th></tr></thead><tbody>`;
            
            let lastUser = "";
            pendientes.forEach(p => {
                const d = new Date(p.date);
                const fecha = `${d.getDate()}/${d.getMonth()+1}`;
                const monto = p.base - p.discount;
                let concepto = p.reason ? p.reason : "Salario Base";
                
                let displayMonto = `Q${monto}`;
                let tdClass = 'amount'; 
                if (monto < 0) {
                    displayMonto = `ADELANTO Q${Math.abs(monto)}`; 
                    tdClass = 'debt';
                }

                if (p.name !== lastUser) {
                        content += `<tr><td colspan="3" style="padding-top:10px; color:#9fef00; font-weight:bold; border-bottom:none;">// ${p.name.toUpperCase()}</td></tr>`;
                        lastUser = p.name;
                }
                content += `<tr><td>${fecha}</td><td>${concepto}</td><td class="${tdClass}">${displayMonto}</td></tr>`;
                totalDeuda += monto;
            });
            content += `</tbody></table>`;
            content += `<div class="snap-row-total">TOTAL GLOBAL: Q${totalDeuda}</div>`;
        }
    }
    document.getElementById('snapContent').innerHTML = content;
    document.getElementById('snapModal').style.display = 'flex';
}

function closeSnap() { document.getElementById('snapModal').style.display = 'none'; }
function downloadSnap() {
    const element = document.getElementById('captureTarget');
    html2canvas(element, { backgroundColor: null, scale: 2 }).then(canvas => {
        const link = document.createElement('a');
        link.download = `HTB_Report_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL();
        link.click();
    });
}

function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    document.getElementById('btn-' + page).classList.add('active');
}

renderPayroll(); renderInventory(); document.getElementById('payDate').valueAsDate = new Date();