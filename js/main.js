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

// Inicialización
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let isGuest = false;
let tasks = [];
let currentFilter = 'all';

// --- LOGICA DE UI ---
function showApp() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    document.getElementById('userNameDisplay').textContent = isGuest ? "Invitado" : `Hola, ${currentUser.displayName.split(' ')[0]}`;
    document.getElementById('dateDisplay').textContent = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric' });
}

// --- LOGICA DE DATOS ---
function listenTasks() {
    // Consulta sin orderBy para evitar errores de índices mientras pruebas
    const q = query(collection(db, "tareas"), where("userId", "==", currentUser.uid));
    
    onSnapshot(q, snap => {
        tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        tasks.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        render();
    });
}

const render = () => {
    const list = document.getElementById('taskList');
    list.innerHTML = '';
    
    const filtered = tasks.filter(t => {
        if (currentFilter === 'pending') return !t.completed;
        if (currentFilter === 'completed') return t.completed;
        return true;
    });

    filtered.forEach(t => {
        const li = document.createElement('li');
        li.className = `task-item ${t.completed ? 'is-completed' : ''}`;
        li.dataset.priority = t.priority;
        li.innerHTML = `
            <input type="checkbox" ${t.completed ? 'checked' : ''}>
            <div style="flex:1; margin-left:10px;">
                <strong>${t.text}</strong><br>
                <small>${t.category} | ${t.dueDate || 'Sin fecha'}</small>
            </div>
            <button class="btn-del">✕</button>
        `;
        
        // Eventos internos
        li.querySelector('input').onchange = () => toggleTask(t.id, t.completed);
        li.querySelector('.btn-del').onclick = () => deleteTask(t.id);
        
        list.appendChild(li);
    });

    updateProgress();
    document.getElementById('emptyState').style.display = filtered.length === 0 ? 'block' : 'none';
};

const toggleTask = async (id, status) => {
    if (isGuest) { tasks.find(x => x.id === id).completed = !status; render(); }
    else { await updateDoc(doc(db, "tareas", id), { completed: !status }); }
};

const deleteTask = async (id) => {
    if (!confirm("¿Borrar?")) return;
    if (isGuest) { tasks = tasks.filter(t => t.id !== id); render(); }
    else { await deleteDoc(doc(db, "tareas", id)); }
};

const updateProgress = () => {
    const total = tasks.length;
    const done = tasks.filter(t => t.completed).length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    const circ = document.getElementById('progressCircle');
    const circum = 2 * Math.PI * 24;
    
    circ.style.strokeDasharray = circum;
    circ.style.strokeDashoffset = circum - (percent / 100) * circum;
    document.getElementById('progressText').textContent = `${percent}%`;
};

// --- CONFIGURACIÓN DE EVENTOS (AL FINAL) ---

document.getElementById('googleLoginBtn').onclick = () => {
    signInWithPopup(auth, provider).catch(err => alert("Error de Login. Revisa si autorizaste el dominio en Firebase."));
};

document.getElementById('guestBtn').onclick = () => {
    isGuest = true;
    currentUser = { uid: 'guest' };
    showApp();
    render();
};

document.getElementById('logoutBtn').onclick = () => signOut(auth).then(() => location.reload());

document.getElementById('addBtn').onclick = async () => {
    const val = document.getElementById('taskInput').value.trim();
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

document.getElementById('themeToggle').onclick = () => {
    const html = document.documentElement;
    const theme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', theme);
    localStorage.setItem('app_theme', theme);
    document.getElementById('themeToggle').textContent = theme === 'dark' ? '☀️' : '🌙';
};

// Filtros
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        render();
    };
});

// Auth Guard
onAuthStateChanged(auth, user => {
    if (user) {
        currentUser = user;
        isGuest = false;
        showApp();
        listenTasks();
    }
});

// Cargar Tema
const savedTheme = localStorage.getItem('app_theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
document.getElementById('themeToggle').textContent = savedTheme === 'dark' ? '☀️' : '🌙';
