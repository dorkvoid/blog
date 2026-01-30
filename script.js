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

// --- 3.5 AUDIO SYSTEM (CLEAN) ---
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
    logout: new Audio('sounds/turn-off.mp3') // NEW LOGOUT SOUND
};

// Config
sounds.hum.loop = true;
sounds.hum.volume = 0.1; 
sounds.confirm.volume = 0.2; 
sounds.hover.volume = 0.2;

// 1. Strict localStorage check
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
        playSound('click');
        sounds.hum.play();
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

// Global Button Sounds
document.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
        if (btn.id !== 'fmtBold' && btn.id !== 'fmtItalic' && btn.id !== 'fmtSpoiler') {
            playSound('hover');
        }
    });
    btn.addEventListener('click', () => {
        if (btn.id !== 'fmtBold' && btn.id !== 'fmtItalic' && btn.id !== 'fmtSpoiler') {
            playSound('click');
        }
    });
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

// --- 5. AUTH LOGIC & LOGOUT UI ---
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
    reloadFeed(); 
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

// Updated Logout Logic
if (logoutBtn) {
    // Hover Effects
    logoutBtn.addEventListener('mouseenter', () => {
        logoutBtn.src = 'images/logout-hover.png';
        playSound('hover');
    });
    logoutBtn.addEventListener('mouseleave', () => {
        logoutBtn.src = 'images/logout.png';
    });

    logoutBtn.addEventListener('click', async () => {
        playSound('logout'); // Plays turn-off.mp3
        await signOut(auth);
        showToast("LOGGED OUT");
    });
}

// --- 6. VIEW TOGGLE LOGIC (TILE VS LIST) ---
let currentView = localStorage.getItem('viewMode') || 'list';

function setView(mode) {
    currentView = mode;
    localStorage.setItem('viewMode', mode);
    
    if (mode === 'tile') {
        feed.classList.add('grid-view');
        container.style.maxWidth = '900px'; // Wider container for grid
        viewTileBtn.classList.add('active-view');
        viewListBtn.classList.remove('active-view');
    } else {
        feed.classList.remove('grid-view');
        container.style.maxWidth = '600px'; // Standard width
        viewListBtn.classList.add('active-view');
        viewTileBtn.classList.remove('active-view');
    }
}

// Initialize View
setView(currentView);

viewListBtn.addEventListener('click', () => {
    playSound('click');
    setView('list');
});
viewTileBtn.addEventListener('click', () => {
    playSound('click');
    setView('tile');
});


// --- 7. LOAD POSTS ---
let allPosts = []; 
const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));

onSnapshot(q, (snapshot) => {
    allPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    reloadFeed();
});

function reloadFeed() {
    feed.innerHTML = "";
    
    allPosts.sort((a, b) => {
        if (a.pinned === b.pinned) {
            return (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0);
        }
        return a.pinned ? -1 : 1;
    });

    const term = searchInput.value.toLowerCase();
    const visiblePosts = (term && !term.startsWith('/')) ? allPosts.filter(p => p.text.toLowerCase().includes(term)) : allPosts;

    visiblePosts.forEach(post => {
        addPostToDOM(post);
    });
}

// --- 8. POST & COMMAND LOGIC ---
// (Command & Search logic combined in reloadFeed and event listener below)

let isFeedHidden = false; 

function handleTypingSound(e) {
    if (e.repeat) return; 
    playSound('type');
}

searchInput.addEventListener('keydown', handleTypingSound);
textInput.addEventListener('keydown', handleTypingSound);
imageInput.addEventListener('keydown', handleTypingSound); 

searchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    
    if (val.startsWith('/')) {
        if (val === '/login') {
            if (adminLoginBar.classList.contains('hidden')) {
                adminLoginBar.classList.remove('hidden');
                passwordInput.focus();
                showToast("LOGIN TERMINAL OPEN");
            } else {
                adminLoginBar.classList.add('hidden');
                showToast("LOGIN TERMINAL CLOSED");
            }
            searchInput.value = ''; 
            
        } else if (val === '/help') {
            showToast("CMDS: /login, /clear");
            searchInput.value = '';
            
        } else if (val === '/clear') {
            if (isFeedHidden) {
                isFeedHidden = false;
                reloadFeed(); 
                showToast("FEED RESTORED");
            } else {
                isFeedHidden = true;
                feed.innerHTML = ''; 
                showToast("FEED CLEARED");
            }
            searchInput.value = '';
        }
        return; 
    }
    reloadFeed(); 
});

let editingPostId = null; 

function insertTag(tagStart, tagEnd) {
    const start = textInput.selectionStart;
    const end = textInput.selectionEnd;
    const text = textInput.value;
    const before = text.substring(0, start);
    const selected = text.substring(start, end);
    const after = text.substring(end);
    
    textInput.value = before + tagStart + selected + tagEnd + after;
    textInput.focus();
    textInput.selectionStart = start + tagStart.length;
    textInput.selectionEnd = end + tagStart.length;
    textInput.dispatchEvent(new Event('input')); 
}

fmtBold.onclick = () => insertTag("**", "**");
fmtItalic.onclick = () => insertTag("*", "*");
fmtSpoiler.onclick = () => insertTag("||", "||");

textInput.addEventListener('input', function() {
    this.style.height = 'auto'; 
    this.style.height = (this.scrollHeight) + 'px';
    if (!editingPostId) { 
        localStorage.setItem('postDraft', this.value);
    }
});

function restoreDraft() {
    const draft = localStorage.getItem('postDraft');
    if (draft && !textInput.value) {
        textInput.value = draft;
        textInput.style.height = 'auto';
        textInput.style.height = (textInput.scrollHeight) + 'px';
    }
}

textInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault(); 
        postBtn.click();
    }
});

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
                editedTimestamp: serverTimestamp(),
                editedDate: new Date().toLocaleString()
            });
            showToast("POST UPDATED");
            playSound('edit'); 
            resetForm();
        } else {
            await addDoc(collection(db, "posts"), {
                text: text,
                image: img,
                timestamp: serverTimestamp(),
                readableDate: new Date().toLocaleString(),
                pinned: false 
            });
            showToast("POST SUCCESSFUL");
            playSound('success'); 
            localStorage.removeItem('postDraft');
            resetForm();
        }
    } catch (e) {
        console.error("Error: ", e);
        showToast("ERROR: COULD NOT POST");
        playSound('error');
    } finally {
        postBtn.disabled = false;
        postBtn.innerText = "POST";
    }
});

if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
        resetForm();
    });
}

function resetForm() {
    textInput.value = ''; 
    imageInput.value = '';
    textInput.style.height = 'auto'; 
    editingPostId = null;
    postBtn.innerText = "POST";
    if(cancelBtn) cancelBtn.classList.add('hidden');
    localStorage.removeItem('postDraft');
}

// --- 9. HELPERS ---
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

confirmNo.addEventListener('click', () => {
    idToDelete = null;
    confirmModal.classList.add('hidden');
});

function showToast(message) {
    playSound('toast'); 
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = `[ SYSTEM: ${message} ]`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

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

// --- 10. DRAG AND DROP (ADMIN ONLY) ---
let draggedItem = null;

function handleDragStart(e) {
    draggedItem = this;
    e.dataTransfer.effectAllowed = 'move';
    this.classList.add('dragging');
}

function handleDragOver(e) {
    if (e.preventDefault) e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    this.classList.add('drag-over');
    return false;
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

async function handleDrop(e) {
    if (e.stopPropagation) e.stopPropagation();
    
    // Cleanup styles
    this.classList.remove('drag-over');
    draggedItem.classList.remove('dragging');

    if (draggedItem !== this) {
        const id1 = draggedItem.dataset.id; // Dragged Post
        const id2 = this.dataset.id;        // Target Post
        
        // Find the actual data objects
        const post1 = allPosts.find(p => p.id === id1);
        const post2 = allPosts.find(p => p.id === id2);

        if (post1 && post2) {
            showToast("SWAPPING ORDER...");
            
            // SWAP TIMESTAMP STRATEGY
            // This reorders them in the feed by tricking the "orderBy timestamp" query
            const ts1 = post1.timestamp;
            const ts2 = post2.timestamp;

            try {
                await updateDoc(doc(db, "posts", id1), { timestamp: ts2 });
                await updateDoc(doc(db, "posts", id2), { timestamp: ts1 });
                playSound('success');
            } catch (err) {
                console.error(err);
                playSound('error');
                showToast("ERROR SWAPPING");
            }
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

    // ENABLE DRAG FOR ADMINS
    if (isAdmin) {
        postDiv.setAttribute('draggable', 'true');
        postDiv.addEventListener('dragstart', handleDragStart);
        postDiv.addEventListener('dragover', handleDragOver);
        postDiv.addEventListener('dragleave', handleDragLeave);
        postDiv.addEventListener('drop', handleDrop);
    }

    let pinHTML = "";
    if (isAdmin || post.pinned) {
        const pinClass = post.pinned ? "pin-icon active" : "pin-icon";
        pinHTML = `<img src="images/pin.png" class="${pinClass}" data-id="${id}" title="Pin/Unpin">`;
    }

    let mediaHTML = "";
    if (post.image) {
        const url = post.image;
        const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
        const spMatch = url.match(/open\.spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/);
        if (ytMatch) {
            mediaHTML = `<iframe class="media-embed" src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
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
            if (editedDateObj && !isNaN(editedDateObj)) display += ` <span class="edited-timestamp">(edited ${editedDateObj.toLocaleString()})</span>`;
            timeSpan.innerHTML = display;
        } else {
            let display = timeAgo(postDate);
            if (editedDateObj && !isNaN(editedDateObj)) display += ` <span class="edited-timestamp">(edited ${timeAgo(editedDateObj)})</span>`;
            timeSpan.innerHTML = display;
        }
    }
    updateTimeDisplay();
    timeSpan.addEventListener('click', () => {
        showExact = !showExact;
        updateTimeDisplay();
    });

    let tempDiv = document.createElement("div");
    tempDiv.textContent = post.text;
    let safeText = tempDiv.innerHTML;

    safeText = safeText
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') 
        .replace(/\*(.*?)\*/g, '<i>$1</i>')   
        .replace(/\|\|(.*?)\|\|/g, '<span class="spoiler" onclick="this.classList.toggle(\'revealed\')">$1</span>'); 

    let processedText = safeText.replace(
        /(https?:\/\/[^\s]+)/g, 
        '<a href="$1" target="_blank">$1</a>'
    );

    postDiv.innerHTML = `
        ${pinHTML}
        <div class="post-content">
            <img src="images/plxeyes.png" class="avatar-icon">
            <div class="post-text-container">
                <p class="post-text">${processedText}</p>
            </div>
        </div>
        ${mediaHTML}
        <div class="admin-buttons"></div>
    `;

    postDiv.prepend(timeSpan);

    feed.appendChild(postDiv); 
    const textContainer = postDiv.querySelector('.post-text-container');
    
    if (textContainer.scrollHeight > 150) {
        textContainer.classList.add('truncated');
        
        const expandBtn = document.createElement('div');
        expandBtn.classList.add('expand-btn');
        expandBtn.innerText = "[ EXPAND ]";
        
        expandBtn.onclick = () => {
            playSound('click');
            const isNowTruncated = textContainer.classList.toggle('truncated');
            expandBtn.innerText = isNowTruncated ? "[ EXPAND ]" : "[ COLLAPSE ]";
        };
        
        textContainer.parentNode.insertBefore(expandBtn, textContainer.nextSibling);
    }

    const pinBtn = postDiv.querySelector('.pin-icon');
    if (pinBtn && isAdmin) {
        pinBtn.addEventListener('click', async () => {
            playSound('pin'); 
            const newStatus = !post.pinned;
            await updateDoc(doc(db, "posts", id), { pinned: newStatus });
            showToast(newStatus ? "POST PINNED" : "POST UNPINNED");
        });
        pinBtn.addEventListener('mouseenter', () => playSound('hover'));
    }

    const btnContainer = postDiv.querySelector('.admin-buttons');
    const editBtn = document.createElement('button');
    editBtn.innerText = "EDIT";
    editBtn.classList.add('btn-edit');
    editBtn.onclick = () => {
        startEdit(id, post.text, post.image);
    };
    editBtn.addEventListener('mouseenter', () => playSound('hover'));
    btnContainer.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.innerText = "DELETE";
    deleteBtn.classList.add('btn-delete');
    deleteBtn.onclick = () => triggerDelete(id);
    deleteBtn.addEventListener('mouseenter', () => playSound('hover'));
    btnContainer.appendChild(deleteBtn);
    
    const imgElement = postDiv.querySelector('.click-to-zoom');
    if(imgElement) {
        imgElement.addEventListener('click', () => {
            playSound('click');
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

// --- 11. LIGHTBOX & BACK TO TOP LOGIC ---

document.addEventListener('keydown', (e) => {
    if (e.key === "Escape" && !lightboxModal.classList.contains('hidden')) {
        lightboxModal.classList.add('hidden');
        playSound('click');
    }
});

lightboxClose.addEventListener('click', () => {
    playSound('click');
    lightboxModal.classList.add('hidden');
});
lightboxModal.addEventListener('click', (e) => {
    if (e.target === lightboxModal) {
        playSound('click');
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
    playSound('click');
    window.scrollTo({ top: 0, behavior: 'smooth' });
});