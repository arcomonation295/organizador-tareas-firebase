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

// --- ELEMENTOS DEL DOM ---
const taskList = document.getElementById('taskList');
const progressCircle = document.getElementById('progressCircle');
const progressText = document.getElementById('progressText');
const themeToggle = document.getElementById('themeToggle');

// --- FECHA Y RELOJ ---
const dateDisplay = document.getElementById('dateDisplay');
if(dateDisplay) {
    dateDisplay.textContent = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
}

// --- LOGICA DE ACCESO (AUTH) ---
window.login = () => signInWithPopup(auth, provider).catch(err => {
    console.error("Error de login:", err);
    alert("Error al conectar con Google. Revisa la consola (F12).");
});

window.enterGuest = () => {
    isGuest = true;
    currentUser = { uid: 'guest', displayName: 'Invitado' };
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    document.getElementById('userNameDisplay').textContent = "Modo Invitado";
    render();
};

window.logout = () => signOut(auth).then(() => location.reload());

onAuthStateChanged(auth, user => {
    if (user) {
        currentUser = user;
        isGuest = false;
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('appContainer').style.display = 'block';
        document.getElementById('userNameDisplay').textContent = `Hola, ${user.displayName.split(' ')[0]}`;
        listenTasks();
    }
});

// --- ESCUCHAR TAREAS (FIREBASE) ---
function listenTasks() {
    // Si sale error aquí, haz clic en el link que saldrá en la consola de F12
    const q = query(
        collection(db, "tareas"), 
        where("userId", "==", currentUser.uid), 
        orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snap) => {
        tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        render();
    }, (error) => {
        console.error("Error en Firestore:", error);
        if(error.code === 'failed-precondition') {
            console.warn("⚠️ FALTA CREAR EL ÍNDICE. Mira el link arriba.");
        }
    });
}

// --- CRUD DE TAREAS ---
window.addTask = async () => {
    const input = document.getElementById('taskInput');
    const val = input.value.trim();
    if (!val) return;

    const taskData = {
        text: val,
        priority: document.getElementById('priorityInput').value,
        category: document.getElementById('categoryInput').value,
        dueDate: document.getElementById('dateInput').value,
        completed: false,
        userId: currentUser.uid,
        createdAt: isGuest ? Date.now() : serverTimestamp()
    };

    if (isGuest) {
        tasks.unshift({ id: Date.now().toString(), ...taskData });
        render();
    } else {
        await addDoc(collection(db, "tareas"), taskData);
    }
    input.value = '';
};

window.toggleTask = async (id, status) => {
    if (isGuest) {
        const t = tasks.find(x => x.id === id);
        if(t) t.completed = !status;
        render();
    } else {
        await updateDoc(doc(db, "tareas", id), { completed: !status });
    }
};

window.deleteTask = async (id) => {
    if (!confirm("¿Borrar esta tarea?")) return;
    if (isGuest) {
        tasks = tasks.filter(t => t.id !== id);
        render();
    } else {
        await deleteDoc(doc(db, "tareas", id));
    }
};

// --- RENDERIZADO Y PROGRESO ---
function render() {
    taskList.innerHTML = '';
    const filtered = tasks.filter(t => {
        if (currentFilter === 'pending') return t.completed === false;
        if (currentFilter === 'completed') return t.completed === true;
        return true;
    });

    filtered.forEach(t => {
        const li = document.createElement('li');
        li.className = `task-item ${t.completed ? 'is-completed' : ''}`;
        li.dataset.priority = t.priority;
        li.innerHTML = `
            <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTask('${t.id}', ${t.completed})">
            <div style="flex:1; margin-left:10px;">
                <strong>${t.text}</strong><br>
                <small>${t.category} | ${t.dueDate || 'Sin fecha'}</small>
            </div>
            <button onclick="deleteTask('${t.id}')" style="background:none; border:none; color:red; cursor:pointer;">✕</button>
        `;
        taskList.appendChild(li);
    });
    
    updateProgress();
    document.getElementById('emptyState').style.display = filtered.length === 0 ? 'block' : 'none';
}

function updateProgress() {
    const total = tasks.length;
    const done = tasks.filter(t => t.completed).length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    
    if(progressCircle) {
        const radius = 24;
        const circum = 2 * Math.PI * radius;
        progressCircle.style.strokeDasharray = circum;
        progressCircle.style.strokeDashoffset = circum - (percent / 100) * circum;
    }
    if(progressText) progressText.textContent = `${percent}%`;
}

// --- MODAL Y TEMAS ---
window.setFilter = (filter, btn) => {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    render();
};

themeToggle.onclick = () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('app_theme', next);
    themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
};

// Inicializar Tema al cargar
const savedTheme = localStorage.getItem('app_theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

// Asignar eventos de botones
document.getElementById('googleLoginBtn').onclick = window.login;
document.getElementById('guestBtn').onclick = window.enterGuest;
document.getElementById('logoutBtn').onclick = window.logout;
document.getElementById('addBtn').onclick = window.addTask;

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => window.setFilter(btn.dataset.filter, btn);
});
