import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-analytics.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// =============================================================================
// ⚠️ TU CONFIGURACIÓN DE FIREBASE (YA INCLUIDA)
// =============================================================================
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

// ESTADO GLOBAL
let currentUser = null;
let payrollData = [];
let itemsList = []; // INVENTARIO VACÍO POR DEFECTO
let inventoryState = {};
let workerList = []; // TRABAJADORES VACÍOS POR DEFECTO
let currentFilter = 'all';

// === AUTH ===
const btnLogin = document.getElementById('btnLogin');
const btnLogout = document.getElementById('btnLogout');
const loginScreen = document.getElementById('login-screen');
const appContent = document.getElementById('app-content');
const userName = document.getElementById('userName');
const userPhoto = document.getElementById('userPhoto');

if(btnLogin) {
    btnLogin.addEventListener('click', () => {
        signInWithPopup(auth, provider).catch((error) => showToast(error.message, true));
    });
}

if(btnLogout) {
    btnLogout.addEventListener('click', () => {
        if(confirm("¿Cerrar sesión?")) signOut(auth);
    });
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loginScreen.style.display = 'none';
        appContent.style.display = 'block';
        if(userName) userName.textContent = user.displayName.split(' ')[0].toUpperCase();
        if(userPhoto) userPhoto.src = user.photoURL;
        initDataListener();
    } else {
        currentUser = null;
        loginScreen.style.display = 'flex';
        appContent.style.display = 'none';
    }
});

// === DATA SYNC ===
function initDataListener() {
    const userDocRef = doc(db, "users", currentUser.uid);
    onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            payrollData = data.payroll || [];
            itemsList = data.itemsList || [];
            inventoryState = data.inventoryState || {};
            workerList = data.workerList || []; // Cargar trabajadores
            
            updateWorkerSelect(); // Llenar dropdown
            renderWorkerSettingsList(); // Llenar lista en ajustes
            renderPayroll();
            renderInventory();
        } else {
            // Documento nuevo: todo vacío
            setDoc(userDocRef, { payroll: [], itemsList: [], inventoryState: {}, workerList: [] });
        }
    });
}

function saveDataToCloud() {
    if (!currentUser) return;
    const userDocRef = doc(db, "users", currentUser.uid);
    updateDoc(userDocRef, {
        payroll: payrollData,
        itemsList: itemsList,
        inventoryState: inventoryState,
        workerList: workerList
    }).catch(err => console.error(err));
}

// === GESTIÓN DE TRABAJADORES (NUEVO) ===
function updateWorkerSelect() {
    const select = document.getElementById('workerName');
    if(!select) return;
    select.innerHTML = '<option value="" disabled selected>Selecciona personal...</option>';
    
    // Opción especial
    const optAmbas = document.createElement('option');
    optAmbas.value = "Ambas";
    optAmbas.textContent = "👥 Ambas (Registro Doble)";
    select.appendChild(optAmbas);

    workerList.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = `👤 ${name}`;
        select.appendChild(opt);
    });
}

function renderWorkerSettingsList() {
    const container = document.getElementById('workerListSettings');
    if(!container) return;
    container.innerHTML = '';
    
    if (workerList.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:10px; opacity:0.5; font-size:12px;">No hay empleados registrados.</div>';
        return;
    }

    workerList.forEach((name, index) => {
        container.innerHTML += `
            <div class="inv-item">
                <div class="inv-left">
                    <button class="btn-del-item" onclick="window.deleteWorker(${index})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    <span class="inv-name">${name}</span>
                </div>
            </div>`;
    });
}

// Evento Agregar Trabajador
document.getElementById('btnAddWorker').addEventListener('click', () => {
    const input = document.getElementById('newWorkerName');
    const name = input.value.trim();
    if(name && !workerList.includes(name)) {
        workerList.push(name);
        saveDataToCloud();
        input.value = '';
        showToast('Empleado registrado');
    }
});

window.deleteWorker = (index) => {
    if(confirm('¿Eliminar empleado de la lista?')) {
        workerList.splice(index, 1);
        saveDataToCloud();
    }
};

// === NÓMINA ===
document.getElementById('btnAddEntry').addEventListener('click', addEntry);

function renderPayroll() {
    const list = document.getElementById('payrollList');
    if(!list) return;
    list.innerHTML = '';
    
    let filtered = payrollData.map((item, index) => ({ item, originalIndex: index }));
    if (currentFilter === 'pending') filtered = filtered.filter(x => !x.item.paid);
    else if (currentFilter === 'paid') filtered = filtered.filter(x => x.item.paid);

    filtered.sort((a, b) => new Date(b.item.date) - new Date(a.item.date));

    if (filtered.length === 0) { list.innerHTML = '<div class="empty-state">Sin movimientos</div>'; updateStats(); return; }

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
        details.innerHTML = `<summary>${monthKey} <span style="font-weight:normal; color:#fff;">(Q${monthTotal})</span></summary>`;
        const contentDiv = document.createElement('div');
        contentDiv.className = 'month-content';

        items.forEach((wrapper) => {
            const item = wrapper.item;
            const index = wrapper.originalIndex;
            const total = item.base - item.discount;
            const dateObj = new Date(item.date);
            const dateStr = `${dateObj.getDate()}/${dateObj.getMonth()+1}`;
            const reasonText = item.reason ? item.reason : '';
            const smallText = `${dateStr} • F./Adel: Q${item.discount} <span class="reason-tag">(${reasonText})</span>`;

            let displayMoney = `Q${total}`;
            let moneyClass = '';
            if (total < 0) { displayMoney = `-Q${Math.abs(total)}`; moneyClass = 'negative'; } 
            else if (total === 0) { displayMoney = `SALDADO`; moneyClass = 'zero'; }

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
                        <button class="btn-icon btn-pay ${item.paid ? 'pagado' : ''}" onclick="window.togglePay(${index})">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </button>
                        <button class="btn-icon btn-del" onclick="window.deleteEntry(${index})">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
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
    const nameInput = document.getElementById('workerName');
    const baseInput = document.getElementById('basePay');
    const discInput = document.getElementById('discount');
    const reasonInput = document.getElementById('discReason');
    const dateInput = document.getElementById('payDate');

    const name = nameInput.value;
    const base = parseFloat(baseInput.value);
    const disc = parseFloat(discInput.value) || 0;
    const reason = reasonInput.value;
    const date = dateInput.value ? new Date(dateInput.value + 'T12:00:00').toISOString() : new Date().toISOString();

    if (!name || name === "") { showToast('⚠️ Selecciona personal', true); return; }
    if (!base && base !== 0) { showToast('⚠️ Ingresa Sueldo Base', true); return; }

    if (name === "Ambas") {
        // Lógica para "Ambas": Busca los dos primeros trabajadores de la lista
        if (workerList.length < 2) {
            showToast('⚠️ Necesitas al menos 2 empleados en Datos', true);
            return;
        }
        payrollData.push({ name: workerList[0], date, base, discount: 0, reason: "", paid: false });
        payrollData.push({ name: workerList[1], date, base, discount: 0, reason: "", paid: false });
        showToast('✓ Registro Doble Creado');
    } else {
        payrollData.push({ name, date, base, discount: disc, reason: reason, paid: false });
        showToast('✓ Registrado');
    }
    
    saveDataToCloud();
    // Reset inputs parcial
    discInput.value = '';
    reasonInput.value = '';
}

// Funciones globales (window)
window.togglePay = (i) => { payrollData[i].paid = !payrollData[i].paid; saveDataToCloud(); };
window.deleteEntry = (i) => { if(confirm('¿Borrar registro?')) { payrollData.splice(i, 1); saveDataToCloud(); showToast('Eliminado', true); } };

// Filtros
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentFilter = e.target.dataset.filter;
        renderPayroll();
    });
});

window.exportData = () => {
    let txt = '=== REPORTE HTB ===\n';
    payrollData.forEach(p => {
        const estado = p.paid ? '[PAGADO]' : '[PENDIENTE]';
        txt += `${p.name} | Q${p.base - p.discount} | ${estado} | ${p.reason}\n`;
    });
    const a = document.createElement('a'); 
    a.href = URL.createObjectURL(new Blob([txt], {type:'text/plain'})); 
    a.download = `Reporte_${new Date().toISOString().slice(0,10)}.txt`; 
    a.click();
};

// =============================================================================
// 7. INVENTARIO
// =============================================================================
document.getElementById('btnAddItem').addEventListener('click', addItemToList);
document.getElementById('btnResetInv').addEventListener('click', resetInventory);

function renderInventory() {
    const list = document.getElementById('inventoryList');
    if(!list) return;
    list.innerHTML = '';
    
    if(itemsList.length === 0) { list.innerHTML = '<div class="empty-state">Inventario vacío</div>'; return; }

    itemsList.forEach((item, index) => {
        const qty = inventoryState[item] || 0;
        list.innerHTML += `
            <div class="inv-item">
                <div class="inv-left">
                    <button class="btn-del-item" onclick="window.deleteItemFromList(${index})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    <span class="inv-name">${item}</span>
                </div>
                <div class="stepper">
                    <button class="stepper-btn" onclick="window.updStock('${item}', -1)">−</button>
                    <div class="stepper-val">${qty}</div>
                    <button class="stepper-btn" onclick="window.updStock('${item}', 1)">+</button>
                </div>
            </div>`;
    });
    updateInvStats();
}

function updateInvStats() {
    const active = Object.values(inventoryState).filter(v => v > 0).length;
    const total = Object.values(inventoryState).reduce((sum, v) => sum + v, 0);
    const elActive = document.getElementById('inv-active');
    const elTotal = document.getElementById('inv-total');
    if(elActive) elActive.textContent = active;
    if(elTotal) elTotal.textContent = total;
}

function addItemToList() {
    const input = document.getElementById('newItemName'); const name = input.value.trim();
    if (name && !itemsList.includes(name)) { 
        itemsList.push(name); saveDataToCloud(); input.value = ''; showToast(`Agregado`); 
    } else if (itemsList.includes(name)) { showToast('Ya existe', true); }
}

window.deleteItemFromList = (index) => {
    if(confirm(`¿Eliminar producto?`)) { 
        const item = itemsList[index]; itemsList.splice(index, 1); delete inventoryState[item]; 
        saveDataToCloud(); 
    }
};

window.updStock = (item, change) => {
    let n = (inventoryState[item] || 0) + change; if(n < 0) n = 0; inventoryState[item] = n; saveDataToCloud();
};

function resetInventory() {
    if (confirm('¿Poner todo el stock a CERO?')) { inventoryState = {}; saveDataToCloud(); showToast('Reiniciado'); }
}

// =============================================================================
// 9. SNAPSHOT (FOTO DE REPORTE)
// =============================================================================
const btnSnapP = document.getElementById('btnSnapPayroll');
const btnSnapI = document.getElementById('btnSnapInv');
if(btnSnapP) btnSnapP.addEventListener('click', openSnapModal);
if(btnSnapI) btnSnapI.addEventListener('click', openSnapModal);
document.getElementById('btnCloseSnap').addEventListener('click', closeSnap);
document.getElementById('btnDownloadSnap').addEventListener('click', downloadSnap);

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
                    displayMonto = `-Q${Math.abs(monto)}`; 
                    tdClass = 'debt'; // Rojo
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
        link.download = `Reporte_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL();
        link.click();
    });
}

// === HELPERS UI ===
function showToast(msg, isError = false) {
    const toast = document.createElement('div');
    toast.className = 'toast' + (isError ? ' error' : '');
    toast.innerHTML = `<div class="toast-text">${msg}</div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

window.changePage = (page) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    document.getElementById('btn-' + page).classList.add('active');
};

const dateInput = document.getElementById('payDate');
if(dateInput) dateInput.valueAsDate = new Date();