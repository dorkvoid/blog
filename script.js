// --- 1. IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, updateDoc, doc, increment, setDoc } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
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
const cancelBtn = document.getElementById('cancelBtn');
const feed = document.getElementById('feed');
const textInput = document.getElementById('postText');
const imageInput = document.getElementById('imageUrl');
const passwordInput = document.getElementById('adminPassword');
const counterElement = document.getElementById('view-count');
const searchInput = document.getElementById('searchBar');

// UI Elements
const confirmModal = document.getElementById('confirm-modal');
const confirmYes = document.getElementById('confirmYes');
const confirmNo = document.getElementById('confirmNo');
const lightboxModal = document.getElementById('lightbox-modal');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxClose = document.getElementById('lightbox-close');
const backToTopBtn = document.getElementById('back-to-top');

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

// --- 5. AUTH LOGIC ---
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
    // Re-run search filter if text exists in bar (handles live updates)
    if(searchInput.value) filterPosts(searchInput.value);
});

// --- 7. POST LOGIC ---
let editingPostId = null; 

textInput.addEventListener('input', function() {
    this.style.height = 'auto'; 
    this.style.height = (this.scrollHeight) + 'px';
});

// Power Send (Ctrl + Enter)
textInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault(); 
        postBtn.click();
    }
});

postBtn.addEventListener('click', async function() {
    if (!auth.currentUser) return alert("You are not logged in!");

    const text = textInput.value;
    const img = imageInput.value;
    if (text === "" && img === "") return;

    postBtn.disabled = true;
    postBtn.innerText = "SENDING...";

    try {
        if (editingPostId) {
            await updateDoc(doc(db, "posts", editingPostId), { 
                text: text, 
                image: img,
                editedTimestamp: serverTimestamp(),
                editedDate: new Date().toLocaleString()
            });
            resetForm();
        } else {
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
        alert("Error posting.");
    } finally {
        postBtn.disabled = false;
        postBtn.innerText = "POST";
    }
});

if (cancelBtn) {
    cancelBtn.addEventListener('click', resetForm);
}

function resetForm() {
    textInput.value = ''; 
    imageInput.value = '';
    textInput.style.height = 'auto'; 
    editingPostId = null;
    postBtn.innerText = "POST";
    if(cancelBtn) cancelBtn.classList.add('hidden');
}

// --- 8. DELETE MODAL LOGIC ---
let idToDelete = null;

function triggerDelete(id) {
    idToDelete = id;
    confirmModal.classList.remove('hidden');
}

confirmYes.addEventListener('click', async () => {
    if (idToDelete) {
        await deleteDoc(doc(db, "posts", idToDelete));
        idToDelete = null;
        confirmModal.classList.add('hidden');
    }
});

confirmNo.addEventListener('click', () => {
    idToDelete = null;
    confirmModal.classList.add('hidden');
});

// --- 9. DISPLAY FUNCTION (Media Embeds + Search) ---

function timeAgo(date) {
    if (!date) return "";
    const seconds = Math.floor((new Date() - date) / 1000);
    
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " mins ago";
    return "Just now";
}

// A. NEW: Search Filter Logic
searchInput.addEventListener('input', (e) => {
    filterPosts(e.target.value);
});

function filterPosts(searchTerm) {
    const term = searchTerm.toLowerCase();
    const posts = document.querySelectorAll('.post');
    
    posts.forEach(post => {
        const text = post.innerText.toLowerCase();
        if (text.includes(term)) {
            post.style.display = "block";
        } else {
            post.style.display = "none";
        }
    });
}

function addPostToDOM(post, id) {
    const postDiv = document.createElement('div');
    postDiv.classList.add('post');

    // B. NEW: Media Embed Logic
    let mediaHTML = "";
    if (post.image) {
        const url = post.image;
        
        // 1. YouTube Detection
        // Matches standard links and short links (youtu.be)
        const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
        
        // 2. Spotify Detection
        const spMatch = url.match(/open\.spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/);
        
        if (ytMatch) {
            // YouTube Embed
            mediaHTML = `<iframe class="media-embed" src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
        } else if (spMatch) {
            // Spotify Embed
            mediaHTML = `<iframe class="media-embed" src="https://open.spotify.com/embed/${spMatch[1]}/${spMatch[2]}" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>`;
        } else {
            // Standard File Detection
            const isVideo = url.match(/\.(mp4|webm|ogg|mov)/i);
            const isAudio = url.match(/\.(mp3|wav)/i);
            
            if (isVideo) mediaHTML = `<video src="${url}" controls loop playsinline class="post-media"></video>`;
            else if (isAudio) mediaHTML = `<audio src="${url}" controls class="post-media"></audio>`;
            else mediaHTML = `<img src="${url}" class="post-image click-to-zoom">`;
        }
    }

    // Relative Time Logic
    const postDate = post.timestamp ? post.timestamp.toDate() : new Date();
    let editedDateObj = null;
    if (post.editedTimestamp) editedDateObj = post.editedTimestamp.toDate();
    else if (post.editedDate) editedDateObj = new Date(post.editedDate);

    const timeSpan = document.createElement('span');
    timeSpan.classList.add('timestamp');
    timeSpan.title = "Click to toggle exact time"; 
    
    let showExact = false;
    function updateTimeDisplay() {
        if (showExact) {
            let display = postDate.toLocaleString();
            if (editedDateObj && !isNaN(editedDateObj)) {
                display += ` <span class="edited-timestamp">(edited ${editedDateObj.toLocaleString()})</span>`;
            }
            timeSpan.innerHTML = display;
        } else {
            let display = timeAgo(postDate);
            if (editedDateObj && !isNaN(editedDateObj)) {
                display += ` <span class="edited-timestamp">(edited ${timeAgo(editedDateObj)})</span>`;
            }
            timeSpan.innerHTML = display;
        }
    }
    updateTimeDisplay();
    timeSpan.addEventListener('click', () => {
        showExact = !showExact;
        updateTimeDisplay();
    });

    let processedText = post.text.replace(
        /(https?:\/\/[^\s]+)/g, 
        '<a href="$1" target="_blank">$1</a>'
    );

    const contentWrapper = document.createElement('div');
    contentWrapper.innerHTML = `
        <div class="post-content">
            <img src="plxeyes.png" class="avatar-icon">
            <p class="post-text">${processedText}</p>
        </div>
        ${mediaHTML}
        <div class="admin-buttons"></div>
    `;

    postDiv.appendChild(timeSpan);
    postDiv.appendChild(contentWrapper);

    const btnContainer = postDiv.querySelector('.admin-buttons');
    const editBtn = document.createElement('button');
    editBtn.innerText = "EDIT";
    editBtn.classList.add('btn-edit');
    editBtn.onclick = () => startEdit(id, post.text, post.image);
    btnContainer.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.innerText = "DELETE";
    deleteBtn.classList.add('btn-delete');
    deleteBtn.onclick = () => triggerDelete(id); 
    btnContainer.appendChild(deleteBtn);

    feed.appendChild(postDiv);
    
    const imgElement = postDiv.querySelector('.click-to-zoom');
    if(imgElement) {
        imgElement.addEventListener('click', () => {
            lightboxImg.src = post.image;
            lightboxModal.classList.remove('hidden');
        });
    }
}

function startEdit(id, text, image) {
    textInput.value = text;
    imageInput.value = image;
    editingPostId = id;
    postBtn.innerText = "UPDATE POST";
    if(cancelBtn) cancelBtn.classList.remove('hidden');
    window.scrollTo(0, 0);
    textInput.focus();
    textInput.style.height = 'auto';
    textInput.style.height = (textInput.scrollHeight) + 'px';
}

// --- 10. LIGHTBOX & BACK TO TOP LOGIC ---
lightboxClose.addEventListener('click', () => {
    lightboxModal.classList.add('hidden');
});
lightboxModal.addEventListener('click', (e) => {
    if (e.target === lightboxModal) lightboxModal.classList.add('hidden');
});
lightboxImg.addEventListener('click', () => {
    lightboxModal.classList.add('hidden');
});
document.addEventListener('keydown', (e) => {
    if (e.key === "Escape" && !lightboxModal.classList.contains('hidden')) {
        lightboxModal.classList.add('hidden');
    }
});

window.addEventListener('scroll', () => {
    if (window.scrollY > 300) {
        backToTopBtn.classList.remove('hidden');
    } else {
        backToTopBtn.classList.add('hidden');
    }
});

backToTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});