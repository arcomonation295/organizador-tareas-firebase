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

// --- AUTH ---
window.login = () => signInWithPopup(auth, provider).catch(err => alert("Error: Autoriza el dominio en Firebase Console."));
window.enterGuest = () => { isGuest = true; updateUI(); render(); };
window.logout = () => signOut(auth).then(() => location.reload());

onAuthStateChanged(auth, user => {
    if (user) { currentUser = user; isGuest = false; updateUI(); listenTasks(); }
});

function updateUI() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    document.getElementById('userNameDisplay').textContent = isGuest ? "Invitado" : `Hola, ${currentUser.displayName.split(' ')[0]}`;
}

// --- TAREAS ---
function listenTasks() {
    const q = query(collection(db, "tareas"), where("userId", "==", currentUser.uid), orderBy("createdAt", "desc"));
    onSnapshot(q, snap => {
        tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        render();
    });
}

window.addTask = async () => {
    const val = document.getElementById('taskInput').value;
    if (!val) return;
    const taskData = {
        text: val,
        priority: document.getElementById('priorityInput').value,
        category: document.getElementById('categoryInput').value,
        dueDate: document.getElementById('dateInput').value,
        completed: false,
        userId: isGuest ? 'guest' : currentUser.uid,
        createdAt: isGuest ? Date.now() : serverTimestamp()
    };
    if (isGuest) { tasks.unshift({id: Date.now().toString(), ...taskData}); render(); }
    else { await addDoc(collection(db, "tareas"), taskData); }
    document.getElementById('taskInput').value = '';
};

window.toggleTask = async (id, status) => {
    if (isGuest) { tasks.find(t => t.id === id).completed = !status; render(); }
    else { await updateDoc(doc(db, "tareas", id), { completed: !status }); }
};

window.deleteTask = async (id) => {
    if (!confirm("¿Borrar?")) return;
    if (isGuest) { tasks = tasks.filter(t => t.id !== id); render(); }
    else { await deleteDoc(doc(db, "tareas", id)); }
};

// --- RENDER & GRÁFICO ---
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
            <input type="checkbox" ${t.completed ? 'checked' : ''} onclick="toggleTask('${t.id}', ${t.completed})">
            <div style="flex:1">
                <strong>${t.text}</strong><br>
                <small>${t.category} | ${t.dueDate || 'Sin fecha'}</small>
            </div>
            <button onclick="deleteTask('${t.id}')">✕</button>
        `;
        taskList.appendChild(li);
    });
    updateProgress();
}

function updateProgress() {
    const total = tasks.length;
    const done = tasks.filter(t => t.completed).length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    
    const radius = 24;
    const circum = 2 * Math.PI * radius;
    progressCircle.style.strokeDasharray = circum;
    progressCircle.style.strokeDashoffset = circum - (percent / 100) * circum;
    progressText.textContent = `${percent}%`;
}

// --- EVENTOS ---
document.getElementById('googleLoginBtn').onclick = window.login;
document.getElementById('guestBtn').onclick = window.enterGuest;
document.getElementById('logoutBtn').onclick = window.logout;
document.getElementById('addBtn').onclick = window.addTask;

document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentFilter = e.target.dataset.filter;
        render();
    };
});
