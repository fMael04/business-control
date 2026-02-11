// =============================================================================
// 1. IMPORTAR LIBRERÍAS DE FIREBASE (Versión Compatible v10)
// =============================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-analytics.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    onSnapshot, 
    updateDoc 
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// =============================================================================
// 2. TU CONFIGURACIÓN (Tus Credenciales Reales)
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

// =============================================================================
// 3. INICIALIZAR APP Y SERVICIOS
// =============================================================================
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app); // Iniciamos analytics aunque no lo usemos visualmente
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Variables Globales
let currentUser = null;
let payrollData = [];
const defaultItems = ["Vasos 8 oz", "Platos", "Tenedores", "Cucharas", "Vasos 16 oz", "Bolsas Basura", "Servilletas", "Platos Cuadrados"];
let itemsList = [...defaultItems]; 
let inventoryState = {};
let currentFilter = 'all';

// =============================================================================
// 4. SISTEMA DE LOGIN (AUTH)
// =============================================================================
const btnLogin = document.getElementById('btnLogin');
const btnLogout = document.getElementById('btnLogout');
const loginScreen = document.getElementById('login-screen');
const appContent = document.getElementById('app-content');
const userPhoto = document.getElementById('userPhoto');
const userName = document.getElementById('userName');

// Botón: Iniciar con Google
if(btnLogin) {
    btnLogin.addEventListener('click', () => {
        signInWithPopup(auth, provider)
            .then((result) => {
                showToast(`Hola, ${result.user.displayName.split(' ')[0]} 👋`);
            })
            .catch((error) => {
                console.error(error);
                showToast("Error de acceso: " + error.code, true);
            });
    });
}

// Botón: Cerrar Sesión
if(btnLogout) {
    btnLogout.addEventListener('click', () => {
        if(confirm("¿Cerrar sesión?")) signOut(auth);
    });
}

// Escuchador de Estado (Se dispara al cargar la página)
onAuthStateChanged(auth, (user) => {
    if (user) {
        // USUARIO LOGUEADO
        currentUser = user;
        loginScreen.style.display = 'none';
        appContent.style.display = 'block';
        
        // Poner foto y nombre
        if(userPhoto) userPhoto.src = user.photoURL;
        if(userName) userName.textContent = user.displayName.split(' ')[0];
        
        // ¡CONECTAR A LA BASE DE DATOS!
        initDataListener();
    } else {
        // USUARIO NO LOGUEADO
        currentUser = null;
        loginScreen.style.display = 'flex';
        appContent.style.display = 'none';
    }
});

// =============================================================================
// 5. BASE DE DATOS EN TIEMPO REAL (FIRESTORE)
// =============================================================================
function initDataListener() {
    // Referencia: users / {ID_DEL_USUARIO}
    const userDocRef = doc(db, "users", currentUser.uid);
    
    // Escuchar cambios: Si cambias algo en la PC, se actualiza en el celular solito
    onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            // Cargar datos si existen, si no, usar vacíos
            payrollData = data.payroll || [];
            itemsList = data.itemsList || defaultItems;
            inventoryState = data.inventoryState || {};
            
            // Refrescar UI
            renderPayroll();
            renderInventory();
        } else {
            // Si es usuario nuevo, crear documento vacío
            setDoc(userDocRef, { 
                payroll: [], 
                itemsList: defaultItems, 
                inventoryState: {} 
            });
        }
    });
}

// Función para guardar cambios (Sube a la nube)
function saveDataToCloud() {
    if (!currentUser) return;
    const userDocRef = doc(db, "users", currentUser.uid);
    
    updateDoc(userDocRef, {
        payroll: payrollData,
        itemsList: itemsList,
        inventoryState: inventoryState
    }).catch(err => {
        console.error("Error al guardar:", err);
        showToast("Error de conexión ⚠️", true);
    });
}

// =============================================================================
// 6. UI HELPERS & NOTIFICACIONES
// =============================================================================
function showToast(msg, isError = false) {
    const toast = document.createElement('div');
    toast.className = 'toast' + (isError ? ' error' : '');
    toast.innerHTML = `<div class="toast-text">${msg}</div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// =============================================================================
// 7. LÓGICA DE NÓMINA (PAYROLL)
// =============================================================================
document.getElementById('btnAddEntry').addEventListener('click', addEntry);

function renderPayroll() {
    const list = document.getElementById('payrollList');
    if(!list) return;
    list.innerHTML = '';
    
    // 1. Filtrar
    let filtered = payrollData.map((item, index) => ({ item, originalIndex: index }));
    if (currentFilter === 'pending') filtered = filtered.filter(x => !x.item.paid);
    else if (currentFilter === 'paid') filtered = filtered.filter(x => x.item.paid);

    // 2. Ordenar (Más reciente primero)
    filtered.sort((a, b) => new Date(b.item.date) - new Date(a.item.date));

    if (filtered.length === 0) { 
        list.innerHTML = '<div class="empty-state">No hay registros</div>'; 
        updateStats(); 
        return; 
    }

    // 3. Agrupar por Mes
    const grouped = {};
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    filtered.forEach(obj => {
        const d = new Date(obj.item.date);
        const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        if(!grouped[key]) grouped[key] = [];
        grouped[key].push(obj);
    });

    // 4. Pintar HTML
    for (const [monthKey, items] of Object.entries(grouped)) {
        const details = document.createElement('details');
        details.open = true; // Meses abiertos por defecto
        
        // Total del mes (suma algebraica)
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
            
            const reasonText = item.reason ? item.reason : '';
            const smallText = `${dateStr} • F./Adel: Q${item.discount} <span class="reason-tag">(${reasonText})</span>`;

            let displayMoney = `Q${total}`;
            let moneyClass = '';
            
            // Lógica de colores y texto negativo
            if (total < 0) {
                displayMoney = `-Q${Math.abs(total)}`;
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
                        <button class="btn-icon btn-pay ${item.paid ? 'pagado' : ''}" onclick="window.togglePay(${index})">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </button>
                        <button class="btn-icon btn-del" onclick="window.deleteEntry(${index})">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
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
    // Fix zona horaria para fecha
    const date = dateInput.value ? new Date(dateInput.value + 'T12:00:00').toISOString() : new Date().toISOString();

    if (!base) { showToast('⚠️ Ingresa el Sueldo Base', true); return; }

    if (name === "Ambas") {
        payrollData.push({ name: "Sara", date, base, discount: 0, reason: "", paid: false });
        payrollData.push({ name: "Seca", date, base, discount: 0, reason: "", paid: false });
        showToast('✓ Agregadas Sara y Seca');
    } else {
        payrollData.push({ name, date, base, discount: disc, reason: reason, paid: false });
        showToast('✓ Registro agregado');
    }
    
    saveDataToCloud(); // Guardar en Firebase
    
    // Limpiar campos
    discInput.value = '';
    reasonInput.value = '';
}

// Funciones globales para onclick en HTML
window.togglePay = (i) => { 
    payrollData[i].paid = !payrollData[i].paid; 
    saveDataToCloud(); 
};

window.deleteEntry = (i) => { 
    if(confirm('¿Borrar registro permanentemente?')) { 
        payrollData.splice(i, 1); 
        saveDataToCloud(); 
        showToast('Eliminado', true); 
    } 
};

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
    let txt = '=== HTB EXPORT ===\n';
    payrollData.forEach(p => txt += `${p.name} | Q${p.base - p.discount} | ${p.paid ? 'OK':'PEND'} | ${p.reason}\n`);
    const a = document.createElement('a'); 
    a.href = URL.createObjectURL(new Blob([txt], {type:'text/plain'})); 
    a.download = 'htb_export.txt'; 
    a.click();
};

// =============================================================================
// 8. LÓGICA DE INVENTARIO
// =============================================================================
document.getElementById('btnAddItem').addEventListener('click', addItemToList);
document.getElementById('btnResetInv').addEventListener('click', resetInventory);

function renderInventory() {
    const list = document.getElementById('inventoryList');
    if(!list) return;
    list.innerHTML = '';
    
    if(itemsList.length === 0) {
        list.innerHTML = '<div class="empty-state">Inventario vacío</div>';
        return;
    }

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
    const input = document.getElementById('newItemName'); 
    const name = input.value.trim();
    if (name && !itemsList.includes(name)) { 
        itemsList.push(name); 
        saveDataToCloud(); 
        input.value = ''; 
        showToast(`Agregado: ${name}`); 
    } else if (itemsList.includes(name)) {
        showToast('⚠️ Ya existe', true);
    }
}

window.deleteItemFromList = (index) => {
    if(confirm(`¿Eliminar producto?`)) { 
        const item = itemsList[index]; 
        itemsList.splice(index, 1); 
        delete inventoryState[item]; 
        saveDataToCloud(); 
    }
};

window.updStock = (item, change) => {
    let n = (inventoryState[item] || 0) + change; 
    if(n < 0) n = 0; // No permitir negativos
    inventoryState[item] = n; 
    saveDataToCloud();
};

function resetInventory() {
    if (confirm('¿Poner todo el stock a CERO?')) { 
        inventoryState = {}; 
        saveDataToCloud(); 
        showToast('Stock reiniciado'); 
    }
}

// =============================================================================
// 9. BACKUP MANUAL (Json)
// =============================================================================
window.downloadBackup = () => {
    const data = { payroll: payrollData, items: itemsList, stock: inventoryState, v: "15" };
    const blob = new Blob([JSON.stringify(data)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `HTB_Backup_${new Date().toISOString().slice(0,10)}.json`; a.click();
    showToast('Descargando...');
};

window.restoreBackup = () => {
    const file = document.getElementById('backupFile').files[0];
    if (!file) { showToast('Selecciona un archivo .json', true); return; }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if(data.payroll) {
                if(confirm('ATENCIÓN: Esto sobrescribirá los datos en la NUBE. ¿Seguro?')) {
                    payrollData = data.payroll;
                    itemsList = data.items || defaultItems;
                    inventoryState = data.stock || {};
                    saveDataToCloud(); // Sube el backup a Firebase
                    alert("¡Datos restaurados en la nube!");
                }
            } else { showToast('JSON inválido', true); }
        } catch(err) { showToast('Error de lectura', true); }
    };
    reader.readAsText(file);
};

// =============================================================================
// 10. SNAPSHOT (FOTO DE REPORTE)
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
            content = `<div style="text-align:center; color:#888; margin-top:20px;">Todo al día. Excelente.</div>`;
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
                
            