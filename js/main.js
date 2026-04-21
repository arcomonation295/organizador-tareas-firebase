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

// Variables de Estado
let currentUser = null;
let isGuestMode = false;
let allTasks = [];
let guestTasks = JSON.parse(localStorage.getItem('guest_tasks')) || []; // Para que no se borren al refrescar en modo invitado
let currentFilter = 'all';
let unsubscribeTasks = null;

// Elementos DOM
const authScreen = document.getElementById('authScreen');
const appContainer = document.getElementById('appContainer');
const taskList = document.getElementById('taskList');
const taskInput = document.getElementById('taskInput');

// --- 1. LÓGICA DE ACCESO ---

window.loginWithGoogle = async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Error en login:", error);
        alert("Asegúrate de haber autorizado el dominio en Firebase Console.");
    }
};

window.enterAsGuest = () => {
    isGuestMode = true;
    authScreen.style.display = 'none';
    appContainer.style.display = 'block';
    document.getElementById('userNameDisplay').textContent = "Modo Invitado";
    render();
};

window.logout = () => {
    signOut(auth).then(() => location.reload());
};

// Vincular botones de la pantalla de inicio
document.getElementById('googleLoginBtn').onclick = window.loginWithGoogle;
document.getElementById('guestBtn').onclick = window.enterAsGuest;
document.getElementById('logoutBtn').onclick = window.logout;

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        isGuestMode = false;
        authScreen.style.display = 'none';
        appContainer.style.display = 'block';
        document.getElementById('userNameDisplay').textContent = `Hola, ${user.displayName.split(' ')[0]}`;
        startListeningTasks(user.uid);
    }
});

function startListeningTasks(uid) {
    const q = query(collection(db, "tareas"), where("userId", "==", uid), orderBy("createdAt", "desc"));
    unsubscribeTasks = onSnapshot(q, (snapshot) => {
        allTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        render();
    });
}

// --- 2. GESTIÓN DE TAREAS ---

window.addTask = async () => {
    const text = taskInput.value.trim();
    if (!text) return;

    const priority = document.getElementById('priorityInput').value;
    const category = document.getElementById('categoryInput').value;
    const dueDate = document.getElementById('dateInput').value;

    if (isGuestMode) {
        const newTask = { id: Date.now().toString(), text, priority, category, dueDate, completed: false };
        guestTasks.unshift(newTask);
        localStorage.setItem('guest_tasks', JSON.stringify(guestTasks));
        taskInput.value = '';
        render();
    } else {
        await addDoc(collection(db, "tareas"), {
            text, userId: currentUser.uid, priority, category, dueDate,
            completed: false, createdAt: serverTimestamp()
        });
        taskInput.value = '';
    }
};

document.getElementById('addBtn').onclick = window.addTask;

window.toggleTask = async (id, status) => {
    if (isGuestMode) {
        const task = guestTasks.find(t => t.id === id);
        if (task) task.completed = !status;
        localStorage.setItem('guest_tasks', JSON.stringify(guestTasks));
        render();
    } else {
        await updateDoc(doc(db, "tareas", id), { completed: !status });
    }
};

window.deleteTask = async (id) => {
    if (!confirm("¿Eliminar tarea?")) return;
    if (isGuestMode) {
        guestTasks = guestTasks.filter(t => t.id !== id);
        localStorage.setItem('guest_tasks', JSON.stringify(guestTasks));
        render();
    } else {
        await deleteDoc(doc(db, "tareas", id));
    }
};

// --- 3. RENDERIZADO Y FILTROS ---

function render() {
    taskList.innerHTML = '';
    const source = isGuestMode ? guestTasks : allTasks;
    
    const filtered = source.filter(t => {
        if (currentFilter === 'pending') return t.completed === false;
        if (currentFilter === 'completed') return t.completed === true;
        return true;
    });

    filtered.forEach(task => {
        const item = document.createElement('li');
        item.dataset.priority = task.priority;
        if (task.completed) item.classList.add('is-completed');

        item.innerHTML = `
            <div style="margin-right: 15px; cursor:pointer; font-size:1.2rem;" onclick="toggleTask('${task.id}', ${task.completed})">
                ${task.completed ? '✅' : '⭕'}
            </div>
            <div style="flex:1">
                <small style="text-transform:uppercase; font-size:0.6rem; font-weight:bold; color:var(--accent-color)">${task.category}</small>
                <div style="font-weight:500">${task.text}</div>
                ${task.dueDate ? `<small>📅 ${task.dueDate}</small>` : ''}
            </div>
            <button onclick="openPomodoro('${task.text.replace(/'/g, "\\'")}')" style="background:none; border:none; cursor:pointer; margin-right:10px;">⏱️</button>
            <button onclick="deleteTask('${task.id}')" style="background:none; border:none; color:var(--danger); cursor:pointer;">✕</button>
        `;
        taskList.appendChild(item);
    });
    
    updateProgress(source);
    
    // Mostrar estado vacío
    document.getElementById('emptyState').style.display = filtered.length === 0 ? 'block' : 'none';
}

// Configurar los botones de filtro
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentFilter = e.target.dataset.filter;
        render();
    };
});

function updateProgress(tasks) {
    const total = tasks.length;
    const comp = tasks.filter(t => t.completed).length;
    const per = total === 0 ? 0 : Math.round((comp / total) * 100);
    const circ = document.querySelector('.progress-ring__circle');
    const circum = 24 * 2 * Math.PI;
    circ.style.strokeDashoffset = circum - (per / 100) * circum;
    document.getElementById('progressText').textContent = `${per}%`;
}

// --- POMODORO ---
let timeLeft = 25 * 60, timerId = null;
window.openPomodoro = (name) => {
    document.getElementById('pomodoroTaskName').textContent = name;
    document.getElementById('pomodoroModal').style.display = 'flex';
};

document.getElementById('startTimerBtn').onclick = function() {
    if (timerId) {
        clearInterval(timerId); timerId = null; this.textContent = "Reanudar";
    } else {
        this.textContent = "Pausar";
        timerId = setInterval(() => {
            timeLeft--;
            const m = Math.floor(timeLeft / 60), s = timeLeft % 60;
            document.getElementById('timerDisplay').textContent = `${m}:${s < 10 ? '0'+s : s}`;
            if (timeLeft <= 0) { clearInterval(timerId); alert("¡Tiempo terminado!"); }
        }, 1000);
    }
};

document.getElementById('closePomodoroBtn').onclick = () => {
    document.getElementById('pomodoroModal').style.display = 'none';
    clearInterval(timerId); timerId = null; timeLeft = 25 * 60;
    document.getElementById('timerDisplay').textContent = "25:00";
};

// Inicializar Tema
const themeToggle = document.getElementById('themeToggle');
themeToggle.onclick = () => {
    const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app_theme', theme);
    themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
};
const savedTheme = localStorage.getItem('app_theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
