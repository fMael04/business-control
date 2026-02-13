import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
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
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let state = { payroll: [], items: [], stock: {}, workers: [] };
let currentUser = null;
let filter = 'all';

// AUTH
const loginScreen = document.getElementById('login-screen');
const appContent = document.getElementById('app-content');

document.getElementById('btnLogin').onclick = () => signInWithPopup(auth, provider);
document.getElementById('btnLogout').onclick = () => signOut(auth);

onAuthStateChanged(auth, user => {
    if (user) {
        currentUser = user;
        loginScreen.style.display = 'none';
        appContent.style.display = 'block';
        document.getElementById('userName').textContent = user.displayName.split(' ')[0].toUpperCase();
        initSync();
    } else {
        currentUser = null;
        loginScreen.style.display = 'flex';
        appContent.style.display = 'none';
    }
});

function initSync() {
    onSnapshot(doc(db, "users", currentUser.uid), snap => {
        if (snap.exists()) {
            const d = snap.data();
            state.payroll = d.payroll || [];
            state.items = d.itemsList || [];
            state.stock = d.inventoryState || {};
            state.workers = d.workerList || [];
            renderAll();
        } else {
            // Inicializar vacío
            setDoc(doc(db, "users", currentUser.uid), { payroll: [], itemsList: [], inventoryState: {}, workerList: [] });
        }
    });
}

function save() {
    updateDoc(doc(db, "users", currentUser.uid), {
        payroll: state.payroll,
        itemsList: state.items,
        inventoryState: state.stock,
        workerList: state.workers
    });
}

function renderAll() {
    renderPayroll();
    renderInventory();
    renderWorkers();
    updateSelect();
}

// --- PAYROLL ---
function renderPayroll() {
    const list = document.getElementById('payrollList');
    list.innerHTML = '';
    
    let data = state.payroll.map((it, idx) => ({...it, idx}));
    if (filter === 'pending') data = data.filter(x => !x.paid);
    if (filter === 'paid') data = data.filter(x => x.paid);
    data.sort((a,b) => new Date(b.date) - new Date(a.date));

    // Stats
    const p = state.payroll.filter(x=>!x.paid).reduce((a,b)=>a+(b.base-b.discount),0);
    const pd = state.payroll.filter(x=>x.paid).reduce((a,b)=>a+(b.base-b.discount),0);
    document.getElementById('stat-pending').innerText = `Q${p}`;
    document.getElementById('stat-paid').innerText = `Q${pd}`;

    data.forEach(item => {
        const total = item.base - item.discount;
        const d = new Date(item.date);
        const dateStr = `${d.getDate()}/${d.getMonth()+1}`;
        const moneyClass = total < 0 ? 'danger-text' : 'neon-text';
        const moneyTxt = total < 0 ? `-Q${Math.abs(total)}` : `Q${total}`;

        const div = document.createElement('div');
        div.className = `pay-card ${item.paid ? 'paid' : ''}`;
        div.innerHTML = `
            <div class="pay-info">
                <h4>${item.name}</h4>
                <span>${dateStr} • ${item.reason || 'Sueldo'}</span>
            </div>
            <div style="display:flex; align-items:center; gap:15px;">
                <div class="pay-amount ${moneyClass} mono">${moneyTxt}</div>
                <div class="pay-actions">
                    <button class="btn-icon-sq check" onclick="togglePay(${item.idx})">✓</button>
                    <button class="btn-icon-sq del" onclick="delEntry(${item.idx})">✕</button>
                </div>
            </div>
        `;
        list.appendChild(div);
    });
}

// --- INVENTORY ---
function renderInventory() {
    const list = document.getElementById('inventoryList');
    list.innerHTML = '';
    
    state.items.forEach((name, idx) => {
        const qty = state.stock[name] || 0;
        const div = document.createElement('div');
        div.className = 'inv-card';
        div.innerHTML = `
            <div class="inv-header">
                <div>
                    <div class="inv-title">${name}</div>
                    <div class="inv-sub">STOCK ITEM</div>
                </div>
                <span class="inv-id">REF-${idx+10}</span>
            </div>
            <div class="inv-controls">
                <button class="btn-icon-sq del" style="border:none;" onclick="delItem(${idx})">🗑</button>
                <div class="inv-stock mono">${qty}</div>
                <div class="stepper">
                    <button class="step-btn minus" onclick="updStock('${name}', -1)">−</button>
                    <button class="step-btn plus" onclick="updStock('${name}', 1)">+</button>
                </div>
            </div>
        `;
        list.appendChild(div);
    });
}

// GLOBALS
window.togglePay = i => { state.payroll[i].paid = !state.payroll[i].paid; save(); };
window.delEntry = i => { if(confirm('¿Borrar?')) { state.payroll.splice(i,1); save(); } };
window.updStock = (name, val) => {
    const n = (state.stock[name] || 0) + val;
    state.stock[name] = n < 0 ? 0 : n;
    save();
};
window.delItem = i => { if(confirm('¿Borrar?')) { const n = state.items[i]; state.items.splice(i,1); delete state.stock[n]; save(); }};

// UI Logic
window.navTo = (page) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById('page-'+page).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-'+page).classList.add('active');
};

document.getElementById('btnSettingsHeader').onclick = () => window.navTo('settings');

window.quickAction = () => {
    const isNomina = !document.getElementById('page-nomina').classList.contains('hidden');
    if(isNomina) {
        document.querySelector('details').open = true;
        document.getElementById('basePay').focus();
    } else {
        document.getElementById('newItemName').focus();
    }
};

document.querySelectorAll('.chip').forEach(c => {
    c.onclick = () => {
        document.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
        c.classList.add('active');
        filter = c.dataset.filter;
        renderPayroll();
    }
});

// ADD LOGIC
document.getElementById('btnAddEntry').onclick = () => {
    const name = document.getElementById('workerName').value;
    const base = parseFloat(document.getElementById('basePay').value);
    const disc = parseFloat(document.getElementById('discount').value) || 0;
    const reason = document.getElementById('discReason').value;
    const date = document.getElementById('payDate').value || new Date().toISOString();

    if(!name || !base) return alert('Faltan datos');

    if(name === 'Ambas' && state.workers.length >= 2) {
        state.payroll.push({name: state.workers[0], base, discount:0, reason, date, paid:false});
        state.payroll.push({name: state.workers[1], base, discount:0, reason, date, paid:false});
    } else {
        state.payroll.push({name, base, discount:disc, reason, date, paid:false});
    }
    save();
    document.getElementById('basePay').value = '';
};

document.getElementById('btnAddItem').onclick = () => {
    const n = document.getElementById('newItemName').value.trim();
    if(n && !state.items.includes(n)) { state.items.push(n); save(); }
    document.getElementById('newItemName').value = '';
};

// WORKERS
function updateSelect() {
    const s = document.getElementById('workerName');
    s.innerHTML = '<option disabled selected>Seleccionar...</option>';
    if(state.workers.length >= 2) s.innerHTML += '<option value="Ambas">👥 Ambas</option>';
    state.workers.forEach(w => s.innerHTML += `<option value="${w}">${w}</option>`);
}

function renderWorkers() {
    const c = document.getElementById('workerListSettings');
    c.innerHTML = state.workers.map((w,i) => `
        <div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid var(--border);">
            <span>${w}</span>
            <button class="danger-text" style="background:none; border:none;" onclick="delWorker(${i})">✕</button>
        </div>
    `).join('');
}

document.getElementById('btnAddWorker').onclick = () => {
    const n = document.getElementById('newWorkerName').value.trim();
    if(n) { state.workers.push(n); save(); }
};
window.delWorker = i => { if(confirm('¿Borrar?')) { state.workers.splice(i,1); save(); } };

// EXPORTS & SNAPS
window.exportData = () => {
    let t = 'REPORTE\n';
    state.payroll.forEach(p => t+=`${p.name} | Q${p.base-p.discount} | ${p.paid?'OK':'PEND'}\n`);
    const a = document.createElement('a'); a.href=URL.createObjectURL(new Blob([t])); a.download='Report.txt'; a.click();
};

window.openSnap = (isInv) => {
    const date = new Date().toLocaleDateString();
    document.getElementById('snapDate').innerText = date;
    let h = '<table class="snap-table">';
    if(isInv) {
        h += '<tr><th>ITEM</th><th>QTY</th></tr>';
        state.items.forEach(i => h+=`<tr><td>${i}</td><td style="text-align:right; color:var(--neon)">${state.stock[i]||0}</td></tr>`);
    } else {
        h += '<tr><th>FECHA</th><th>NOTA</th><th>MONTO</th></tr>';
        // Group by user logic (Simplified)
        const pend = state.payroll.filter(p=>!p.paid);
        // We sort by name for grouping
        pend.sort((a,b) => a.name.localeCompare(b.name));
        
        let lastUser = "";
        let userTotal = 0;
        let grandTotal = 0;

        pend.forEach((p, idx) => {
            const diff = p.base-p.discount;
            
            // New User Header
            if(p.name !== lastUser) {
                if(lastUser !== "") {
                     h+=`<tr><td colspan="2" style="text-align:right; font-size:10px; color:#aaa; border-top:1px dashed #333;">Total ${lastUser}:</td><td style="text-align:right; border-top:1px dashed #333;">Q${userTotal}</td></tr>`;
                }
                h+=`<tr><td colspan="3" style="padding-top:10px; color:var(--neon); font-weight:bold;">// ${p.name}</td></tr>`;
                lastUser = p.name;
                userTotal = 0;
            }
            
            userTotal += diff;
            grandTotal += diff;
            h+=`<tr><td>${new Date(p.date).getDate()}</td><td>${p.reason||'Sueldo'}</td><td style="color:${diff<0?'#ff3333':'#fff'}">Q${diff}</td></tr>`;
            
            // Last item close
            if(idx === pend.length - 1) {
                 h+=`<tr><td colspan="2" style="text-align:right; font-size:10px; color:#aaa; border-top:1px dashed #333;">Total ${lastUser}:</td><td style="text-align:right; border-top:1px dashed #333;">Q${userTotal}</td></tr>`;
            }
        });
        h+= `<tr><td colspan="3" style="text-align:center; padding-top:20px; font-weight:bold; font-size:16px; color:var(--neon);">TOTAL GLOBAL: Q${grandTotal}</td></tr>`;
    }
    document.getElementById('snapContent').innerHTML = h + '</table>';
    document.getElementById('snapModal').style.display = 'flex';
};

document.getElementById('btnDownloadSnap').onclick = () => {
    html2canvas(document.getElementById('captureTarget'), {backgroundColor:'#141d2b'}).then(c => {
        const a = document.createElement('a'); a.download = 'Snap.png'; a.href = c.toDataURL(); a.click();
    });
}

document.getElementById('payDate').valueAsDate = new Date();