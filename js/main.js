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
const taskList = document.getElementById('taskList');
const progressCircle = document.getElementById('progressCircle');
const progressText = document.getElementById('progressText');
const themeToggle = document.getElementById('themeToggle');

// --- LÓGICA DE ACCESO ---
window.login = () => signInWithPopup(auth, provider).catch(err => alert("Error: " + err.message));
window.enterGuest = () => {
    isGuest = true;
    currentUser = { uid: 'guest' };
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    document.getElementById('userNameDisplay').textContent = "Invitado";
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
        listenTasks(); // ¡AQUÍ SE ACTIVA!
    }
});

// --- EL "ESCUCHADOR" DE TAREAS CORREGIDO ---
function listenTasks() {
    console.log("Escuchando tareas para:", currentUser.uid);
    // QUITAMOS el orderBy temporalmente para que NO pida índice y funcione YA
    const q = query(collection(db, "tareas"), where("userId", "==", currentUser.uid));

    onSnapshot(q, (snap) => {
        tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Ordenamos en el cliente para que no falle la base de datos
        tasks.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        render();
    }, (error) => {
        console.error("Error en Firestore:", error);
        alert("Falla de conexión: Mira la consola con F12");
    });
}

// --- CRUD ---
window.addTask = async () => {
    const input = document.getElementById('taskInput');
    const val = input.value.trim();
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
    if (!confirm("¿Borrar?")) return;
    if (isGuest) { tasks = tasks.filter(t => t.id !== id); render(); }
    else { await deleteDoc(doc(db, "tareas", id)); }
};

// --- RENDER Y PROGRESO ---
function render() {
    taskList.innerHTML = '';
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
            <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTask('${t.id}', ${t.completed})">
            <div style="flex:1; margin-left:10px;">
                <strong>${t.text}</strong><br>
                <small>${t.category} | ${t.dueDate || 'Hoy'}</small>
            </div>
            <button onclick="deleteTask('${t.id}')" style="background:none; border:none; color:red; cursor:pointer;">✕</button>
        `;
        taskList.appendChild(li);
    });
    updateProgress();
}

function updateProgress() {
    const total = tasks.length;
    const done = tasks.filter(t => t.completed).length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    
    if(progressCircle) {
        const radius = 24;
        const circum = $2 \times \pi \times radius$; // Circunferencia del SVG
        progressCircle.style.strokeDasharray = 150.8; // Valor fijo para r=24
        progressCircle.style.strokeDashoffset = 150.8 - (percent / 100) * 150.8;
    }
    if(progressText) progressText.textContent = `${percent}%`;
}

// --- TEMA Y FILTROS ---
themeToggle.onclick = () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('app_theme', next);
    themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
};

// Cargar tema guardado
const savedTheme = localStorage.getItem('app_theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

// Asignación de botones (Asegúrate de que los IDs coincidan en el HTML)
document.getElementById('googleLoginBtn').onclick = window.login;
document.getElementById('guestBtn').onclick = window.enterGuest;
document.getElementById('logoutBtn').onclick = window.logout;
document.getElementById('addBtn').onclick = window.addTask;

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        render();
    };
});
