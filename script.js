// --- 1. IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, updateDoc, doc, increment, setDoc, limit } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
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
const toastContainer = document.getElementById('toast-container');
const adminLoginBar = document.getElementById('admin-login-bar'); 
const container = document.querySelector('.container');
const loadMoreBtn = document.getElementById('loadMoreBtn'); // NEW

// Tag Elements
const tagToggles = document.querySelectorAll('.tag-toggle');
let selectedTags = [];

// View Toggles
const viewListBtn = document.getElementById('viewListBtn');
const viewTileBtn = document.getElementById('viewTileBtn');

// Sound UI
const soundToggle = document.getElementById('sound-toggle');
const soundIcon = document.getElementById('sound-icon');

// Toolbar Elements
const fmtBold = document.getElementById('fmtBold');
const fmtItalic = document.getElementById('fmtItalic');
const fmtSpoiler = document.getElementById('fmtSpoiler');

// UI Elements
const confirmModal = document.getElementById('confirm-modal');
const confirmYes = document.getElementById('confirmYes');
const confirmNo = document.getElementById('confirmNo');
const lightboxModal = document.getElementById('lightbox-modal');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxClose = document.getElementById('lightbox-close');
const backToTopBtn = document.getElementById('back-to-top');

// --- 3.5 AUDIO SYSTEM ---
const sounds = {
    click: new Audio('sounds/buttonclick.mp3'),
    hum: new Audio('sounds/backgroundhum.mp3'),
    type1: 'sounds/type1.mp3',
    type2: 'sounds/type2.mp3',
    type3: 'sounds/type3.mp3',
    type4: 'sounds/type4.mp3',
    delete: new Audio('sounds/deletedpost.wav'),
    success: new Audio('sounds/successfulpost.mp3'),
    edit: new Audio('sounds/editedpost.wav'),
    toast: new Audio('sounds/toast.wav'),
    confirm: new Audio('sounds/yousure.wav'),
    pin: new Audio('sounds/pinbutton.wav'),
    hover: new Audio('sounds/hoverbutton.wav'),
    error: new Audio('sounds/loginerror.wav'),
    logout: new Audio('sounds/turn-off.mp3'),
    swap: new Audio('sounds/post-swapped.wav')
};

sounds.hum.loop = true;
sounds.hum.volume = 0.1; 
sounds.confirm.volume = 0.2; 
sounds.hover.volume = 0.2;

let isMuted = localStorage.getItem('siteMuted') !== 'false'; 

function updateSoundUI() {
    if (isMuted) {
        soundIcon.src = 'images/sound-off.png';
        sounds.hum.pause();
    } else {
        soundIcon.src = 'images/sound-on.png';
        sounds.hum.play().catch(() => {}); 
    }
}
updateSoundUI();

document.addEventListener('click', () => {
    if (!isMuted && sounds.hum.paused) {
        sounds.hum.play().catch(() => {});
    }
}, { once: true });

soundToggle.addEventListener('click', (e) => {
    e.stopPropagation(); 
    isMuted = !isMuted;
    localStorage.setItem('siteMuted', isMuted.toString());
    updateSoundUI();
    
    if(!isMuted) {
        sounds.click.currentTime = 0;
        sounds.click.play().catch(() => {});
        sounds.hum.play().catch(() => {});
    }
});

function playSound(name) {
    if (isMuted) return;

    if (name === 'type') {
        const rand = Math.floor(Math.random() * 4) + 1;
        const audio = new Audio(sounds[`type${rand}`]);
        audio.volume = 0.5;
        audio.play().catch(() => {});
    } else if (sounds[name]) {
        const audio = sounds[name].cloneNode();
        if (name === 'hum') audio.volume = 0.1;
        else if (name === 'confirm') audio.volume = 0.2;
        else if (name === 'hover') audio.volume = 0.2;
        else audio.volume = 1.0;

        audio.play().catch(() => {});
    }
}

document.querySelectorAll('button, .tag-toggle').forEach(btn => {
    btn.addEventListener('mouseenter', () => playSound('hover'));
    btn.addEventListener('click', () => playSound('click'));
});

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

let isAdmin = false;

onAuthStateChanged(auth, (user) => {
    if (user) {
        isAdmin = true;
        document.body.classList.add('admin-mode');
        adminLoginBar.classList.remove('hidden'); 
        if (loginContainer) loginContainer.classList.add('hidden');
        if (adminMenu) adminMenu.classList.remove('hidden');
        restoreDraft();
    } else {
        isAdmin = false;
        document.body.classList.remove('admin-mode');
        if (loginContainer) loginContainer.classList.remove('hidden');
        if (adminMenu) adminMenu.classList.add('hidden');
    }
    setupSubscription(); 
});

if (passwordInput) {
    passwordInput.addEventListener('keyup', async (e) => {
        if (e.key === 'Enter') {
            try {
                await signInWithEmailAndPassword(auth, "kickside02@gmail.com", e.target.value);
                showToast("ACCESS GRANTED");
            } catch (error) {
                playSound('error');
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
    logoutBtn.addEventListener('mouseenter', () => { logoutBtn.src = 'images/logout-hover.png'; });
    logoutBtn.addEventListener('mouseleave', () => { logoutBtn.src = 'images/logout.png'; });
    logoutBtn.addEventListener('click', async () => {
        playSound('logout'); 
        await signOut(auth);
        showToast("LOGGED OUT");
    });
}

// --- 6. VIEW TOGGLE LOGIC ---
let currentView = localStorage.getItem('viewMode') || 'list';

function setView(mode) {
    currentView = mode;
    localStorage.setItem('viewMode', mode);
    
    if (mode === 'tile') {
        feed.classList.add('grid-view');
        container.style.maxWidth = '900px'; 
        viewTileBtn.classList.add('active-view');
        viewListBtn.classList.remove('active-view');
    } else {
        feed.classList.remove('grid-view');
        container.style.maxWidth = '600px'; 
        viewListBtn.classList.add('active-view');
        viewTileBtn.classList.remove('active-view');
    }
}
setView(currentView);

viewListBtn.addEventListener('click', () => setView('list'));
viewTileBtn.addEventListener('click', () => setView('tile'));


// --- 7. LOAD POSTS (PAGINATION + TAGS) ---
let allPosts = []; 
let feedLimit = 10; // STARTING LIMIT
let unsubscribe = null;

function setupSubscription() {
    if (unsubscribe) unsubscribe();

    // Query with LIMIT
    const q = query(collection(db, "posts"), orderBy("timestamp", "desc"), limit(feedLimit));

    unsubscribe = onSnapshot(q, (snapshot) => {
        allPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        reloadFeed();
        
        // Show Load More only if we hit the limit
        if (allPosts.length >= feedLimit) {
            loadMoreBtn.classList.remove('hidden');
        } else {
            loadMoreBtn.classList.add('hidden');
        }
    });
}

loadMoreBtn.addEventListener('click', () => {
    feedLimit += 10; // INCREASE LIMIT
    playSound('click');
    loadMoreBtn.innerText = "LOADING...";
    setupSubscription(); // RELOAD WITH NEW LIMIT
    setTimeout(() => { loadMoreBtn.innerText = "[ LOAD MORE... ]"; }, 500);
});

function reloadFeed() {
    feed.innerHTML = "";
    
    // Sort logic (Pins first)
    allPosts.sort((a, b) => {
        if (a.pinned === b.pinned) {
            return (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0);
        }
        return a.pinned ? -1 : 1;
    });

    // FILTER LOGIC
    const term = searchInput.value.toLowerCase();
    
    const visiblePosts = allPosts.filter(p => {
        // 1. Tag Filter
        if (term.startsWith('#')) {
            const tagQuery = term.substring(1).toUpperCase();
            if (!p.tags) return false;
            return p.tags.includes(tagQuery);
        }
        // 2. Text Filter
        else if (term && !term.startsWith('/')) {
            return p.text.toLowerCase().includes(term);
        }
        return true;
    });

    visiblePosts.forEach(post => {
        addPostToDOM(post);
    });
}

// --- 8. POST & COMMAND LOGIC ---

// Tag Toggle Logic
tagToggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
        const tag = toggle.dataset.tag;
        if (selectedTags.includes(tag)) {
            selectedTags = selectedTags.filter(t => t !== tag);
            toggle.classList.remove('selected');
        } else {
            selectedTags.push(tag);
            toggle.classList.add('selected');
        }
    });
});

searchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    if (val.startsWith('/')) {
        // Command logic (unchanged)
        if (val === '/login') {
            adminLoginBar.classList.toggle('hidden');
            if(!adminLoginBar.classList.contains('hidden')) passwordInput.focus();
            searchInput.value = ''; 
        } else if (val === '/clear') {
            feed.innerHTML = ''; 
            searchInput.value = '';
        }
    } else {
        reloadFeed();
    }
});

let editingPostId = null; 

function insertTag(tagStart, tagEnd) {
    const start = textInput.selectionStart;
    const end = textInput.selectionEnd;
    const text = textInput.value;
    textInput.value = text.substring(0, start) + tagStart + text.substring(start, end) + tagEnd + text.substring(end);
    textInput.focus();
    textInput.selectionStart = start + tagStart.length;
    textInput.selectionEnd = end + tagStart.length;
}

fmtBold.onclick = () => insertTag("**", "**");
fmtItalic.onclick = () => insertTag("*", "*");
fmtSpoiler.onclick = () => insertTag("||", "||");

postBtn.addEventListener('click', async function() {
    if (!auth.currentUser) return showToast("LOGIN REQUIRED");

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
                tags: selectedTags, // SAVE TAGS
                editedTimestamp: serverTimestamp()
            });
            showToast("POST UPDATED");
            playSound('edit'); 
            resetForm();
        } else {
            await addDoc(collection(db, "posts"), {
                text: text,
                image: img,
                tags: selectedTags, // SAVE TAGS
                timestamp: serverTimestamp(),
                pinned: false 
            });
            showToast("POST SUCCESSFUL");
            playSound('success'); 
            resetForm();
        }
    } catch (e) {
        console.error(e);
        showToast("ERROR");
        playSound('error');
    } finally {
        postBtn.disabled = false;
        postBtn.innerText = "POST";
    }
});

if (cancelBtn) cancelBtn.addEventListener('click', resetForm);

function resetForm() {
    textInput.value = ''; 
    imageInput.value = '';
    editingPostId = null;
    postBtn.innerText = "POST";
    if(cancelBtn) cancelBtn.classList.add('hidden');
    
    // Reset Tags
    selectedTags = [];
    tagToggles.forEach(t => t.classList.remove('selected'));
}

// --- 9. HELPERS (Delete, Toast, TimeAgo) ---
let idToDelete = null;

function triggerDelete(id) {
    playSound('confirm'); 
    idToDelete = id;
    confirmModal.classList.remove('hidden');
}

confirmYes.addEventListener('click', async () => {
    if (idToDelete) {
        playSound('delete'); 
        await deleteDoc(doc(db, "posts", idToDelete));
        idToDelete = null;
        confirmModal.classList.add('hidden');
        showToast("ENTRY DELETED");
    }
});
confirmNo.addEventListener('click', () => { confirmModal.classList.add('hidden'); });

function showToast(message) {
    playSound('toast'); 
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = `[ SYSTEM: ${message} ]`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function timeAgo(date) {
    if (!date) return "";
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + " mins ago";
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + " hours ago";
    const days = Math.floor(hours / 24);
    if (days > 365) return Math.floor(days/365) + " years ago";
    if (days > 30) return Math.floor(days/30) + " months ago";
    return days + " days ago";
}

// --- 10. DRAG AND DROP (Geometry Locked) ---
let draggedItem = null;

function handleDragStart(e) {
    draggedItem = this.closest('.post'); 
    e.dataTransfer.effectAllowed = 'move';
    
    const rect = draggedItem.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (e.dataTransfer.setDragImage) {
        e.dataTransfer.setDragImage(draggedItem, x, y);
    }
    draggedItem.classList.add('dragging');
}

function handleDragOver(e) {
    if (e.preventDefault) e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    this.classList.add('drag-over');
    return false;
}
function handleDragLeave(e) { this.classList.remove('drag-over'); }

async function handleDrop(e) {
    if (e.stopPropagation) e.stopPropagation();
    this.classList.remove('drag-over');
    draggedItem.classList.remove('dragging');

    if (draggedItem !== this) {
        const id1 = draggedItem.dataset.id; 
        const id2 = this.dataset.id;        
        const post1 = allPosts.find(p => p.id === id1);
        const post2 = allPosts.find(p => p.id === id2);

        if (post1 && post2) {
            showToast("SWAPPING ORDER...");
            const ts1 = post1.timestamp;
            const ts2 = post2.timestamp;
            try {
                await updateDoc(doc(db, "posts", id1), { timestamp: ts2 });
                await updateDoc(doc(db, "posts", id2), { timestamp: ts1 });
                playSound('swap'); 
            } catch (err) { console.error(err); }
        }
    }
    return false;
}

// --- 11. DISPLAY FUNCTION ---
function addPostToDOM(post) {
    const id = post.id;
    const postDiv = document.createElement('div');
    postDiv.classList.add('post');
    postDiv.dataset.id = id;

    if (isAdmin) {
        postDiv.addEventListener('dragover', handleDragOver);
        postDiv.addEventListener('dragleave', handleDragLeave);
        postDiv.addEventListener('drop', handleDrop);
    }

    let pinHTML = "";
    if (isAdmin || post.pinned) {
        const pinClass = post.pinned ? "pin-icon active" : "pin-icon";
        pinHTML = `<img src="images/pin.png" class="${pinClass}" data-id="${id}" draggable="false">`;
    }

    let dragHTML = "";
    if (isAdmin) {
        dragHTML = `<img src="images/drag-handle.png" class="drag-handle" draggable="true">`;
    }

    // TAGS HTML
    let tagsHTML = "";
    if (post.tags && post.tags.length > 0) {
        tagsHTML = `<div class="post-tags">`;
        post.tags.forEach(tag => {
            tagsHTML += `<span class="post-tag" onclick="document.getElementById('searchBar').value='#${tag}'; document.getElementById('searchBar').dispatchEvent(new Event('input'));">${tag}</span>`;
        });
        tagsHTML += `</div>`;
    }

    // Media HTML (Youtube, Spotify, Images)
    let mediaHTML = "";
    if (post.image) {
        const url = post.image;
        const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
        const spMatch = url.match(/open\.spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/);
        
        if (ytMatch) {
            mediaHTML = `<iframe class="media-embed" src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen></iframe>`;
        } else if (spMatch) {
            mediaHTML = `<iframe class="media-embed" src="https://open.spotify.com/embed/${spMatch[1]}/${spMatch[2]}" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>`;
        } else {
            const isVideo = url.match(/\.(mp4|webm|ogg|mov)/i);
            const isAudio = url.match(/\.(mp3|wav)/i);
            if (isVideo) mediaHTML = `<video src="${url}" controls loop playsinline class="post-media"></video>`;
            else if (isAudio) mediaHTML = `<audio src="${url}" controls class="post-media"></audio>`;
            else mediaHTML = `<img src="${url}" class="post-image click-to-zoom">`;
        }
    }

    const postDate = post.timestamp ? post.timestamp.toDate() : new Date();
    
    // Text Formatting
    let safeText = post.text
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') 
        .replace(/\*(.*?)\*/g, '<i>$1</i>')   
        .replace(/\|\|(.*?)\|\|/g, '<span class="spoiler" onclick="this.classList.toggle(\'revealed\')">$1</span>'); 
    
    safeText = safeText.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');

    postDiv.innerHTML = `
        ${dragHTML}
        ${pinHTML}
        <span class="timestamp">${timeAgo(postDate)}</span>
        ${tagsHTML} 
        <div class="post-content">
            <img src="images/plxeyes.png" class="avatar-icon">
            <div class="post-text-container">
                <p class="post-text">${safeText}</p>
            </div>
        </div>
        ${mediaHTML}
        <div class="admin-buttons"></div>
    `;

    feed.appendChild(postDiv);

    // Attach Listeners
    const pinBtn = postDiv.querySelector('.pin-icon');
    if (pinBtn && isAdmin) {
        pinBtn.addEventListener('click', async () => {
            playSound('pin');
            await updateDoc(doc(db, "posts", id), { pinned: !post.pinned });
        });
    }

    if (isAdmin) {
        const handle = postDiv.querySelector('.drag-handle');
        if (handle) handle.addEventListener('dragstart', handleDragStart);
        
        const btnContainer = postDiv.querySelector('.admin-buttons');
        
        const editBtn = document.createElement('button');
        editBtn.innerText = "EDIT";
        editBtn.onclick = () => {
            startEdit(id, post.text, post.image, post.tags);
        };
        btnContainer.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.innerText = "DELETE";
        deleteBtn.onclick = () => triggerDelete(id);
        btnContainer.appendChild(deleteBtn);
    }
    
    // Lightbox
    const imgElement = postDiv.querySelector('.click-to-zoom');
    if(imgElement) {
        imgElement.addEventListener('click', () => {
            playSound('click');
            lightboxImg.src = post.image;
            lightboxModal.classList.remove('hidden');
        });
    }
}

function startEdit(id, text, image, tags) {
    textInput.value = text;
    imageInput.value = image;
    editingPostId = id;
    postBtn.innerText = "UPDATE POST";
    if(cancelBtn) cancelBtn.classList.remove('hidden');
    window.scrollTo(0, 0);
    
    // Load Tags
    selectedTags = tags || [];
    tagToggles.forEach(t => {
        if(selectedTags.includes(t.dataset.tag)) t.classList.add('selected');
        else t.classList.remove('selected');
    });
}

// Lightbox Logic
document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") lightboxModal.classList.add('hidden');
});
lightboxClose.addEventListener('click', () => lightboxModal.classList.add('hidden'));
lightboxModal.addEventListener('click', (e) => {
    if(e.target === lightboxModal) lightboxModal.classList.add('hidden');
});

// Back to Top
window.addEventListener('scroll', () => {
    if (window.scrollY > 300) backToTopBtn.classList.remove('hidden');
    else backToTopBtn.classList.add('hidden');
});
backToTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});