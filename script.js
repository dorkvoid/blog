// --- 1. IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, updateDoc, doc, increment, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";

// --- 2. CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyCO3Kct2wiTpcrHtiMS31RlB5goRJ1Z4FI",
  authDomain: "scrumblogg.firebaseapp.com",
  projectId: "scrumblogg",
  storageBucket: "scrumblogg.firebasestorage.app",
  messagingSenderId: "786010760570",
  appId: "1:786010760570:web:6ccc2798124b9c1d44a2c3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- 3. ELEMENTS ---
const postBtn = document.getElementById('postBtn');
const cancelBtn = document.getElementById('cancelBtn'); // NEW: Grab the cancel button
const feed = document.getElementById('feed');
const textInput = document.getElementById('postText');
const imageInput = document.getElementById('imageUrl');
const passwordInput = document.getElementById('adminPassword');
const counterElement = document.getElementById('view-count');

// --- 4. VISITOR COUNTER ---
const statsRef = doc(db, "site_stats", "global");
onSnapshot(statsRef, (docSnapshot) => {
    if (docSnapshot.exists() && counterElement) {
        counterElement.innerText = "VISITS: " + String(docSnapshot.data().views).padStart(5, '0');
    }
});
async function trackVisit() {
    try { await updateDoc(statsRef, { views: increment(1) }); } 
    catch (e) { await setDoc(statsRef, { views: 1 }); }
}
trackVisit();

// --- 5. REAL SECURE LOGIN ---
const loginContainer = document.getElementById('login-input-container');
const adminMenu = document.getElementById('admin-menu');
const logoutBtn = document.getElementById('logoutBtn');
const errorMsg = document.getElementById('login-error');

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.body.classList.add('admin-mode');
        if (loginContainer) loginContainer.classList.add('hidden');
        if (adminMenu) adminMenu.classList.remove('hidden');
    } else {
        document.body.classList.remove('admin-mode');
        if (loginContainer) loginContainer.classList.remove('hidden');
        if (adminMenu) adminMenu.classList.add('hidden');
    }
});

if (passwordInput) {
    passwordInput.addEventListener('keyup', async (e) => {
        if (e.key === 'Enter') {
            try {
                await signInWithEmailAndPassword(auth, "kickside02@gmail.com", e.target.value);
            } catch (error) {
                console.error("Login Failed");
                if(errorMsg) {
                    errorMsg.style.display = 'block';
                    setTimeout(() => errorMsg.style.display = 'none', 2000);
                }
                e.target.value = "";
            }
        }
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await signOut(auth);
    });
}

// --- 6. LOAD POSTS ---
const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));
onSnapshot(q, (snapshot) => {
    feed.innerHTML = "";
    snapshot.forEach((doc) => {
        addPostToDOM(doc.data(), doc.id);
    });
});

// --- 7. CREATE / UPDATE POSTS (Refined Logic) ---
let editingPostId = null; 

// A. Post Button Logic
postBtn.addEventListener('click', async function() {
    if (!auth.currentUser) return alert("You are not logged in!");

    const text = textInput.value;
    const img = imageInput.value;
    if (text === "" && img === "") return;

    try {
        if (editingPostId) {
            // --- UPDATING ---
            await updateDoc(doc(db, "posts", editingPostId), { 
                text: text, 
                image: img,
                // NEW: Save the "Edited" timestamp
                editedDate: new Date().toLocaleString()
            });
            
            // NOTE: Alert removed as requested
            resetForm();
            
        } else {
            // --- CREATING ---
            await addDoc(collection(db, "posts"), {
                text: text,
                image: img,
                timestamp: serverTimestamp(),
                readableDate: new Date().toLocaleString()
            });
            resetForm();
        }
    } catch (e) {
        console.error("Error: ", e);
        alert("Error posting. Check console.");
    }
});

// B. Cancel Button Logic
if (cancelBtn) {
    cancelBtn.addEventListener('click', function() {
        resetForm(); // Just wipes everything and goes back to normal
    });
}

// C. Reset Helper
function resetForm() {
    textInput.value = ''; 
    imageInput.value = '';
    editingPostId = null;
    postBtn.innerText = "POST";
    
    // Hide the Cancel button when we are done
    if(cancelBtn) cancelBtn.classList.add('hidden');
}


// --- 8. DISPLAY FUNCTION ---
function addPostToDOM(post, id) {
    const postDiv = document.createElement('div');
    postDiv.classList.add('post');

    let mediaHTML = "";
    if (post.image) {
        const isVideo = post.image.match(/\.(mp4|webm|ogg|mov)/i);
        const isAudio = post.image.match(/\.(mp3|wav)/i);
        if (isVideo) mediaHTML = `<video src="${post.image}" controls loop playsinline class="post-media"></video>`;
        else if (isAudio) mediaHTML = `<audio src="${post.image}" controls class="post-media"></audio>`;
        else mediaHTML = `<img src="${post.image}" class="post-image">`;
    }

    // NEW: Handle Edited Date Display
    let timeDisplay = post.readableDate || "Just now";
    if (post.editedDate) {
        // Appends the grey text next to the original date
        timeDisplay += `<span class="edited-timestamp">(edited ${post.editedDate})</span>`;
    }

    postDiv.innerHTML = `
        <span class="timestamp">${timeDisplay}</span>
        <div class="post-content">
            <img src="plxeyes.png" class="avatar-icon">
            <p class="post-text"></p>
        </div>
        ${mediaHTML}
        <div class="admin-buttons"></div>
    `;

    postDiv.querySelector('.post-text').textContent = post.text;

    const btnContainer = postDiv.querySelector('.admin-buttons');
    const editBtn = document.createElement('button');
    editBtn.innerText = "EDIT";
    editBtn.classList.add('btn-edit');
    editBtn.onclick = () => startEdit(id, post.text, post.image);
    btnContainer.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.innerText = "DELETE";
    deleteBtn.classList.add('btn-delete');
    deleteBtn.onclick = () => deletePost(id);
    btnContainer.appendChild(deleteBtn);

    feed.appendChild(postDiv);
}

// --- 9. HELPERS ---
async function deletePost(id) {
    if (!auth.currentUser) return;
    await deleteDoc(doc(db, "posts", id));
}

function startEdit(id, text, image) {
    textInput.value = text;
    imageInput.value = image;
    editingPostId = id;
    
    // Switch to "Edit Mode"
    postBtn.innerText = "UPDATE POST";
    
    // Show the Cancel Button
    if(cancelBtn) cancelBtn.classList.remove('hidden');
    
    window.scrollTo(0, 0);
    textInput.focus();
}