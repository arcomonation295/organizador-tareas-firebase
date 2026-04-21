import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCllPCm9HW4nS14YvjHeJPIMLnmGKhy3XY",
    authDomain: "miorganizadortareas.firebaseapp.com",
    projectId: "miorganizadortareas",
    storageBucket: "miorganizadortareas.firebasestorage.app",
    messagingSenderId: "884795326153",
    appId: "1:884795326153:web:439aace16855a79fee1718",
    measurementId: "G-6LD1JLYD5V"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let isGuest = false;
let tasks = [];
let currentFilter = 'all';

// --- ELEMENTOS ---
const taskListEl = document.getElementById('taskList');
const progressCircle = document.getElementById('progressCircle');

// --- DRAG & DROP ---
Sortable.create(taskListEl, {
    animation: 150,
    ghostClass: 'blue-background-class'
});

// --- AUTENTICACIÓN ---
window.login = () => signInWithPopup(auth, provider);
window.enterGuest = () => { isGuest = true; currentUser = {uid:'guest'}; setupApp(); render(); };
window.logout = () => signOut(auth).then(() => location.reload());

onAuthStateChanged(auth, user => {
    if (user) { currentUser = user; isGuest = false; setupApp(); listenTasks(); }
});

function setupApp() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    document.getElementById('userNameDisplay').textContent = isGuest ? "Invitado" : `Hola, ${currentUser.displayName.split(' ')[0]}`;
    document.getElementById('dateDisplay').textContent = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
}

// --- FIRESTORE ---
function listenTasks() {
    // Usamos una query simple para evitar errores de índice al principio
    const q = query(collection(db, "tareas"), where("userId", "==", currentUser.uid));
    onSnapshot(q, snap => {
        tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        tasks.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        render();
    });
}

// --- RENDERIZADO ---
function render() {
    taskListEl.innerHTML = '';
    const today = new Date().toISOString().split('T')[0];
    
    // Filtrar para la lista principal (Ocultamos las que ya deberían ir al historial)
    const activeTasks = tasks.filter(t => !t.completed && (!t.dueDate || t.dueDate >= today));
    
    // Si queremos ver las completadas en la lista principal por el filtro:
    const toShow = tasks.filter(t => {
        if (currentFilter === 'pending') return !t.completed;
        if (currentFilter === 'completed') return t.completed;
        return true;
    });

    toShow.forEach(t => {
        const li = document.createElement('li');
        li.className = `task-item ${t.completed ? 'is-completed' : ''}`;
        li.dataset.priority = t.priority;
        li.innerHTML = `
            <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="window.toggleTask('${t.id}', ${t.completed})">
            <div style="flex:1">
                <strong>${t.text}</strong><br>
                <small>${t.category} | ${t.dueDate || 'Sin fecha'}</small>
            </div>
            <button onclick="window.openFocus('${t.text}')" style="background:none; border:none; cursor:pointer;">⏱️</button>
            <button onclick="window.deleteTask('${t.id}')" style="background:none; border:none; color:red; cursor:pointer;">✕</button>
        `;
        taskListEl.appendChild(li);
    });

    updateProgress();
    document.getElementById('emptyState').style.display = toShow.length === 0 ? 'block' : 'none';
}

// --- ACCIONES ---
window.addTask = async () => {
    const val = document.getElementById('taskInput').value;
    if (!val) return;
    const data = {
        text: val,
        priority: document.getElementById('priorityInput').value,
        category: document.getElementById('categoryInput').value,
        dueDate: document.getElementById('dateInput').value,
        completed: false,
        userId: currentUser.uid,
        createdAt: isGuest ? Date.now() : serverTimestamp()
    };
    if (isGuest) { tasks.unshift({id: Date.now().toString(), ...data}); render(); }
    else { await addDoc(collection(db, "tareas"), data); }
    document.getElementById('taskInput').value = '';
};

window.toggleTask = async (id, status) => {
    if (isGuest) { tasks.find(x => x.id === id).completed = !status; render(); }
    else { await updateDoc(doc(db, "tareas", id), { completed: !status }); }
};

window.deleteTask = async (id) => {
    if (confirm("¿Borrar?")) {
        if (isGuest) { tasks = tasks.filter(t => t.id !== id); render(); }
        else { await deleteDoc(doc(db, "tareas", id)); }
    }
};

// --- HISTORIAL ---
window.openHistory = () => {
    const cont = document.getElementById('historyContent');
    cont.innerHTML = '';
    const today = new Date().toISOString().split('T')[0];
    
    // Tareas terminadas o vencidas
    const hist = tasks.filter(t => t.completed || (t.dueDate && t.dueDate < today));
    
    hist.forEach(t => {
        const isExpired = t.dueDate < today && !t.completed;
        const div = document.createElement('div');
        div.className = 'hist-item';
        div.innerHTML = `
            <span>${t.text}</span>
            <small class="${isExpired ? 'hist-expired' : ''}">${isExpired ? 'VENCIDA' : 'HECHA'}</small>
        `;
        cont.appendChild(div);
    });
    document.getElementById('historyModal').style.display = 'flex';
};

// --- MODO ENFOQUE (POMODORO) ---
let focusInterval;
let timeLeft = 25 * 60;

window.openFocus = (name) => {
    document.getElementById('focusTaskName').textContent = name;
    document.getElementById('focusModal').style.display = 'flex';
};

document.getElementById('toggleFocusBtn').onclick = function() {
    if (focusInterval) {
        clearInterval(focusInterval); focusInterval = null;
        this.textContent = "Reanudar";
    } else {
        this.textContent = "Pausar";
        focusInterval = setInterval(() => {
            timeLeft--;
            const m = Math.floor(timeLeft / 60), s = timeLeft % 60;
            document.getElementById('focusTimer').textContent = `${m}:${s < 10 ? '0'+s : s}`;
            if (timeLeft <= 0) { clearInterval(focusInterval); alert("¡Tiempo fuera!"); }
        }, 1000);
    }
};

document.getElementById('exitFocusBtn').onclick = () => {
    clearInterval(focusInterval); focusInterval = null; timeLeft = 25 * 60;
    document.getElementById('focusModal').style.display = 'none';
    document.getElementById('focusTimer').textContent = "25:00";
};

// --- UTILIDADES ---
function updateProgress() {
    const total = tasks.length, done = tasks.filter(t => t.completed).length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    const circum = 2 * Math.PI * 24;
    progressCircle.style.strokeDasharray = circum;
    progressCircle.style.strokeDashoffset = circum - (percent / 100) * circum;
    document.getElementById('progressText').textContent = `${percent}%`;
}

// Botones y Filtros
document.getElementById('googleLoginBtn').onclick = window.login;
document.getElementById('guestBtn').onclick = window.enterGuest;
document.getElementById('logoutBtn').onclick = window.logout;
document.getElementById('historyBtn').onclick = window.openHistory;
document.getElementById('closeHistory').onclick = () => document.getElementById('historyModal').style.display = 'none';
document.getElementById('addBtn').onclick = window.addTask;
document.getElementById('themeToggle').onclick = () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('app_theme', next);
};

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        render();
    };
});
