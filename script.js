import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-analytics.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyASqU3PApoYekng-H7a9p9_vyuKDxy-brI",
    authDomain: "business-control-e6199.firebaseapp.com",
    projectId: "business-control-e6199",
    storageBucket: "business-control-e6199.firebasestorage.app",
    messagingSenderId: "1032323838717",
    appId: "1:1032323838717:web:878a9766c097fa604e4494",
    measurementId: "G-TLC3GPJFM1"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser, payrollData = [], itemsList = [], inventoryState = {}, workerList = [], currentFilter = 'all';

// === GESTIÓN DE SESIÓN ===
onAuthStateChanged(auth, user => {
    if (user) {
        currentUser = user;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        document.getElementById('userName').textContent = user.displayName.split(' ')[0].toUpperCase();
        document.getElementById('userPhoto').src = user.photoURL;
        initCloudSync();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('app-content').style.display = 'none';
    }
});

function initCloudSync() {
    onSnapshot(doc(db, "users", currentUser.uid), snap => {
        if (snap.exists()) {
            const d = snap.data();
            payrollData = d.payroll || [];
            itemsList = d.itemsList || [];
            inventoryState = d.inventoryState || {};
            workerList = d.workerList || [];
            updateUI();
        } else {
            // CAMBIO V17: Inicializar todo vacío, sin items por defecto
            setDoc(doc(db, "users", currentUser.uid), { payroll: [], itemsList: [], inventoryState: {}, workerList: [] });
        }
    });
}

function updateUI() {
    renderPayroll();
    renderInventory();
    renderWorkerSettings();
    updateWorkerSelect();
}

function save() {
    updateDoc(doc(db, "users", currentUser.uid), { payroll: payrollData, itemsList, inventoryState, workerList });
}

// === PERSONAL ===
function updateWorkerSelect() {
    const s = document.getElementById('workerName');
    s.innerHTML = '<option value="" disabled selected>Seleccionar empleado...</option>';
    if (workerList.length >= 2) s.innerHTML += '<option value="Ambas">👥 Ambas (Doble)</option>';
    workerList.forEach(w => s.innerHTML += `<option value="${w}">👤 ${w}</option>`);
}

document.getElementById('btnAddWorker').onclick = () => {
    const i = document.getElementById('newWorkerName'), n = i.value.trim();
    if (n && !workerList.includes(n)) { workerList.push(n); i.value = ''; save(); }
};

window.deleteWorker = idx => { if(confirm('¿Eliminar de la lista?')) { workerList.splice(idx, 1); save(); } };

function renderWorkerSettings() {
    const c = document.getElementById('workerListSettings');
    c.innerHTML = workerList.map((w, i) => `
        <div class="inv-item" style="padding:10px; margin-bottom:5px; border-radius:8px;">
            <div class="inv-left"><button class="btn-del-item" onclick="deleteWorker(${i})">×</button><span>${w}</span></div>
        </div>`).join('');
}

// === PAGOS ===
document.getElementById('btnAddEntry').onclick = () => {
    const name = document.getElementById('workerName').value;
    const base = parseFloat(document.getElementById('basePay').value);
    const disc = parseFloat(document.getElementById('discount').value) || 0;
    const reason = document.getElementById('discReason').value;
    const date = document.getElementById('payDate').value ? new Date(document.getElementById('payDate').value + 'T12:00:00').toISOString() : new Date().toISOString();
    
    if (!name || !base) return alert('Faltan datos');
    
    if (name === "Ambas") {
        if(workerList.length >= 2) {
            payrollData.push({ name: workerList[0], date, base, discount: 0, reason: "", paid: false });
            payrollData.push({ name: workerList[1], date, base, discount: 0, reason: "", paid: false });
        }
    } else {
        payrollData.push({ name, date, base, discount: disc, reason, paid: false });
    }
    save();
    // Limpiar campos opcionales
    document.getElementById('discount').value = '';
    document.getElementById('discReason').value = '';
};

window.togglePay = i => { payrollData[i].paid = !payrollData[i].paid; save(); };
window.deletePay = i => { if(confirm('¿Borrar registro?')) { payrollData.splice(i, 1); save(); } };

function renderPayroll() {
    const list = document.getElementById('payrollList');
    list.innerHTML = '';
    
    let filtered = payrollData.map((item, index) => ({ item, index }));
    if (currentFilter === 'pending') filtered = filtered.filter(x => !x.item.paid);
    else if (currentFilter === 'paid') filtered = filtered.filter(x => x.item.paid);
    
    filtered.sort((a,b) => new Date(b.item.date) - new Date(a.item.date));
    
    const grouped = {};
    filtered.forEach(obj => {
        const d = new Date(obj.item.date), key = `${d.toLocaleString('es', {month:'long'})} ${d.getFullYear()}`;
        if(!grouped[key]) grouped[key] = [];
        grouped[key].push(obj);
    });

    for (const [month, items] of Object.entries(grouped)) {
        const total = items.reduce((acc, curr) => acc + (curr.item.base - curr.item.discount), 0);
        const det = document.createElement('details'); det.open = true;
        det.innerHTML = `<summary>${month.toUpperCase()} (Q${total})</summary>`;
        const cont = document.createElement('div'); cont.className = 'month-content';
        items.forEach(obj => {
            const it = obj.item, diff = it.base - it.discount;
            const dObj = new Date(it.date);
            const dStr = `${dObj.getDate()}/${dObj.getMonth()+1}`;
            
            // Lógica visual de dinero
            let moneyTxt = `Q${diff}`;
            let moneyClass = '';
            if(diff < 0) { moneyTxt = `-Q${Math.abs(diff)}`; moneyClass = 'negative'; }
            else if(diff === 0) { moneyTxt = 'SALDADO'; moneyClass = 'zero'; }

            cont.innerHTML += `
                <div class="card ${it.paid ? 'pagado' : ''}">
                    <div class="card-info">
                        <h3>${it.name}</h3>
                        <p>${dStr} • F./Adel: Q${it.discount} <span class="reason-tag">${it.reason ? '('+it.reason+')' : ''}</span></p>
                    </div>
                    <div class="money-block"><div class="money-display ${moneyClass}">${moneyTxt}</div></div>
                    <div class="card-actions">
                        <button class="btn-icon btn-pay ${it.paid?'pagado':''}" onclick="togglePay(${obj.index})">✓</button>
                        <button class="btn-icon btn-del" onclick="deletePay(${obj.index})">🗑</button>
                    </div>
                </div>`;
        });
        det.appendChild(cont); list.appendChild(det);
    }
    
    // Stats Update
    const pendingSum = payrollData.filter(p => !p.paid).reduce((s, p) => s + (p.base - p.discount), 0);
    const paidSum = payrollData.filter(p => p.paid).reduce((s, p) => s + (p.base - p.discount), 0);
    document.getElementById('stat-pending').textContent = 'Q' + pendingSum;
    document.getElementById('stat-paid').textContent = 'Q' + paidSum;
}

// === INVENTARIO ===
document.getElementById('btnAddItem').onclick = () => {
    const i = document.getElementById('newItemName'), n = i.value.trim();
    if (n && !itemsList.includes(n)) { itemsList.push(n); i.value = ''; save(); }
};

window.updStock = (item, val) => { inventoryState[item] = Math.max(0, (inventoryState[item] || 0) + val); save(); };
window.delItem = idx => { if(confirm('¿Borrar producto?')) { delete inventoryState[itemsList[idx]]; itemsList.splice(idx,1); save(); }};
document.getElementById('btnResetInv').onclick = () => { if(confirm('¿Stock a CERO?')) { inventoryState = {}; save(); }};

function renderInventory() {
    const list = document.getElementById('inventoryList');
    if(itemsList.length === 0) {
        list.innerHTML = '<div class="empty-state">Inventario vacío. Agrega productos.</div>';
    } else {
        list.innerHTML = itemsList.map((it, i) => `
            <div class="inv-item" style="border-radius:8px; margin-bottom:5px;">
                <div class="inv-left"><button class="btn-del-item" onclick="delItem(${i})">×</button><span>${it}</span></div>
                <div class="stepper">
                    <button class="stepper-btn" onclick="updStock('${it}',-1)">-</button>
                    <div class="stepper-val">${inventoryState[it]||0}</div>
                    <button class="stepper-btn" onclick="updStock('${it}',1)">+</button>
                </div>
            </div>`).join('');
    }
    document.getElementById('inv-active').textContent = itemsList.length;
    document.getElementById('inv-total').textContent = Object.values(inventoryState).reduce((a,b)=>a+b,0);
}

// === SNAPSHOTS & EXPORT ===
window.exportData = () => {
    let txt = '=== REPORTE HTB ===\n';
    payrollData.forEach(p => {
        const estado = p.paid ? '[PAGADO]' : '[PENDIENTE]';
        txt += `${p.name} | Q${p.base - p.discount} | ${estado} | ${p.reason}\n`;
    });
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], {type:'text/plain'})); a.download = 'Reporte.txt'; a.click();
};

window.downloadBackup = () => {
    const d = { payroll: payrollData, items: itemsList, stock: inventoryState, workers: workerList };
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d)], {type:"application/json"})); a.download = 'Backup.json'; a.click();
};

window.restoreBackup = () => {
    const f = document.getElementById('backupFile').files[0];
    if(!f) return alert('Selecciona archivo');
    const r = new FileReader();
    r.onload = e => {
        try {
            const d = JSON.parse(e.target.result);
            if(confirm('¿Sobrescribir nube con este backup?')) {
                if(d.payroll) payrollData = d.payroll;
                if(d.items) itemsList = d.items;
                if(d.stock) inventoryState = d.stock;
                if(d.workers) workerList = d.workers;
                save();
                alert('Restaurado');
            }
        } catch(err) { alert('Archivo inválido'); }
    };
    r.readAsText(f);
};

// === LÓGICA DE FOTO (SNAP) ===
document.getElementById('btnSnapPayroll').onclick = () => openSnap(false);
document.getElementById('btnSnapInv').onclick = () => openSnap(true);
document.getElementById('btnCloseSnap').onclick = () => document.getElementById('snapModal').style.display = 'none';
document.getElementById('btnDownloadSnap').onclick = () => {
    html2canvas(document.getElementById('captureTarget'), {backgroundColor:'#141d2b'}).then(c => {
        const a = document.createElement('a'); a.download = 'Reporte.png'; a.href = c.toDataURL(); a.click();
    });
};

function openSnap(isInv) {
    const title = isInv ? "INVENTARIO" : "PENDIENTES";
    let html = '<table class="snap-table"><thead>';
    
    if(isInv) {
        html += '<tr><th>PRODUCTO</th><th style="text-align:right">CANT</th></tr></thead><tbody>';
        if(itemsList.length === 0) html += '<tr><td colspan="2" style="text-align:center; py-4">Vacío</td></tr>';
        else {
            itemsList.forEach(it => {
                const q = inventoryState[it]||0;
                html += `<tr><td>${it}</td><td style="text-align:right; color:${q===0?'#ff4b4b':'white'}">${q===0?'AGOTADO':q}</td></tr>`;
            });
        }
        html += '</tbody></table>';
    } else {
        // CAMBIO V17: AGRUPAR PENDIENTES POR PERSONA
        html += '<tr><th style="width:20%">FECHA</th><th style="width:50%">NOTA</th><th style="width:30%; text-align:right;">MONTO</th></tr></thead><tbody>';
        
        const pending = payrollData.filter(p => !p.paid).sort((a,b) => a.name.localeCompare(b.name));
        
        if(pending.length === 0) {
            html += '<tr><td colspan="3" style="text-align:center; padding:20px; color:#888;">Todo al día ✅</td></tr>';
        } else {
            // Agrupar manualmente
            const groups = {};
            pending.forEach(p => {
                if(!groups[p.name]) groups[p.name] = [];
                groups[p.name].push(p);
            });

            let grandTotal = 0;

            for (const [name, records] of Object.entries(groups)) {
                let subTotal = 0;
                // Header Nombre
                html += `<tr><td colspan="3" style="padding-top:15px; border-bottom:none; color:#9fef00; font-weight:bold; font-size:14px;">// ${name.toUpperCase()}</td></tr>`;
                
                records.forEach(p => {
                    const d = new Date(p.date);
                    const diff = p.base - p.discount;
                    subTotal += diff;
                    
                    let moneyTxt = `Q${diff}`;
                    let moneyClass = 'amount';
                    if(diff < 0) { moneyTxt = `-Q${Math.abs(diff)}`; moneyClass = 'debt'; }

                    html += `<tr>
                        <td>${d.getDate()}/${d.getMonth()+1}</td>
                        <td style="opacity:0.8;">${p.reason || 'Sueldo Base'}</td>
                        <td class="${moneyClass}">${moneyTxt}</td>
                    </tr>`;
                });
                
                // Subtotal
                html += `<tr><td colspan="2" style="text-align:right; font-size:11px; color:#3992d4; border-top:1px dashed #333;">TOTAL ${name.toUpperCase()}:</td><td style="text-align:right; font-weight:bold; border-top:1px dashed #333;">Q${subTotal}</td></tr>`;
                
                grandTotal += subTotal;
            }
            
            html += `</tbody></table>`;
            html += `<div class="snap-row-total">TOTAL GLOBAL: Q${grandTotal}</div>`;
        }
    }
    
    document.getElementById('snapTitle').textContent = title;
    document.getElementById('snapContent').innerHTML = html;
    document.getElementById('snapModal').style.display = 'flex';
}

// NAV
window.changePage = p => {
    document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active'));
    document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
    document.getElementById('page-'+p).classList.add('active');
    document.getElementById('btn-'+p).classList.add('active');
};

document.getElementById('btnLogin').onclick = () => signInWithPopup(auth, provider);
document.getElementById('btnLogout').onclick = () => signOut(auth);
document.querySelectorAll('.filter-btn').forEach(b => b.onclick = e => {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active'); currentFilter = e.target.dataset.filter; renderPayroll();
});

const di = document.getElementById('payDate'); if(di) di.valueAsDate = new Date();