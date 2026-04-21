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

// Variables de Estado
let currentUser = null;
let isGuestMode = false;
let allTasks = [];
let guestTasks = []; // Para el modo invitado
let currentFilter = 'all';
let unsubscribeTasks = null;

// DOM
const authScreen = document.getElementById('authScreen');
const appContainer = document.getElementById('appContainer');
const taskList = document.getElementById('taskList');
const taskInput = document.getElementById('taskInput');

// --- LÓGICA DE AUTENTICACIÓN ---
document.getElementById('googleLoginBtn').onclick = () => signInWithPopup(auth, provider);
document.getElementById('logoutBtn').onclick = () => {
    signOut(auth);
    location.reload(); // Reiniciar para limpiar todo
};
document.getElementById('guestBtn').onclick = () => {
    isGuestMode = true;
    authScreen.style.display = 'none';
    appContainer.style.display = 'block';
    document.getElementById('userNameDisplay').textContent = "Modo Invitado";
    render();
};

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

// --- LÓGICA DE TAREAS (DUAL) ---
document.getElementById('addBtn').onclick = async () => {
    const text = taskInput.value.trim();
    const priority = document.getElementById('priorityInput').value;
    const category = document.getElementById('categoryInput').value;
    const dueDate = document.getElementById('dateInput').value;

    if (!text) return;

    if (isGuestMode) {
        guestTasks.unshift({ id: Date.now().toString(), text, priority, category, dueDate, completed: false });
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

window.toggleTask = async (id, status) => {
    if (isGuestMode) {
        const t = guestTasks.find(x => x.id === id);
        t.completed = !status;
        render();
    } else {
        await updateDoc(doc(db, "tareas", id), { completed: !status });
    }
};

window.deleteTask = async (id) => {
    if (!confirm("¿Eliminar?")) return;
    if (isGuestMode) {
        guestTasks = guestTasks.filter(x => x.id !== id);
        render();
    } else {
        await deleteDoc(doc(db, "tareas", id));
    }
};

// --- RENDERIZADO ---
function render() {
    taskList.innerHTML = '';
    const source = isGuestMode ? guestTasks : allTasks;
    const filtered = source.filter(t => {
        if (currentFilter === 'pending') return !t.completed;
        if (currentFilter === 'completed') return t.completed;
        return true;
    });

    filtered.forEach(task => {
        const item = document.createElement('li');
        item.dataset.priority = task.priority;
        if (task.completed) item.classList.add('is-completed');

        item.innerHTML = `
            <div style="margin-right: 15px; cursor:pointer;" onclick="toggleTask('${task.id}', ${task.completed})">${task.completed ? '☑' : '☐'}</div>
            <div style="flex:1">
                <small style="text-transform:uppercase; font-size:0.6rem; font-weight:bold; color:var(--accent-color)">${task.category}</small>
                <div style="font-weight:500">${task.text}</div>
                ${task.dueDate ? `<small>📅 ${task.dueDate}</small>` : ''}
            </div>
            <button onclick="openPomodoro('${task.text}')" style="background:none; border:none; cursor:pointer; margin-right:10px;">⏱️</button>
            <button onclick="deleteTask('${task.id}')" style="background:none; border:none; color:var(--danger); cursor:pointer;">✕</button>
        `;
        taskList.appendChild(item);
    });
    updateProgress(source);
}

function updateProgress(tasks) {
    const total = tasks.length;
    const comp = tasks.filter(t => t.completed).length;
    const per = total === 0 ? 0 : Math.round((comp / total) * 100);
    const circ = document.querySelector('.progress-ring__circle');
    const circum = 24 * 2 * Math.PI;
    circ.style.strokeDashoffset = circum - (per / 100) * circum;
    document.getElementById('progressText').textContent = `${per}%`;
}

// Pomodoro y filtros se mantienen igual que tu versión anterior...
// (Solo asegúrate de que el código del pomodoro use las funciones window.openPomodoro)