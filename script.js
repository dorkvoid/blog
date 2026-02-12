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
const counterElement = document.getElementById('view-number');
const searchInput = document.getElementById('searchBar');
const toastContainer = document.getElementById('toast-container');
const adminLoginBar = document.getElementById('admin-login-bar'); 
const container = document.querySelector('.container');
const loadMoreBtn = document.getElementById('loadMoreBtn'); 

// New Tool Elements
const toggleToolsBtn = document.getElementById('toggleTools');
const extraToolsDiv = document.getElementById('extraTools');
const addMediaBtn = document.getElementById('addMediaBtn');
const mediaStackDiv = document.getElementById('media-stack-display');

// Tag Elements
const tagToggles = document.querySelectorAll('.tag-toggle');
let selectedTags = [];
let mediaStack = []; // Stores queued images

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

// UPDATED: Add hover sounds to the View Toggle buttons specifically
[viewListBtn, viewTileBtn].forEach(btn => {
    btn.addEventListener('mouseenter', () => playSound('hover'));
});

// --- 4. VISITOR COUNTER ---
const statsRef = doc(db, "site_stats", "global");
onSnapshot(statsRef, (docSnapshot) => {
    if (docSnapshot.exists() && counterElement) {
        // UPDATED: Just the number, padded with zeros
        counterElement.innerText = String(docSnapshot.data().views).padStart(5, '0');
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

viewListBtn.addEventListener('click', () => {
    playSound('click');
    setView('list');
});
viewTileBtn.addEventListener('click', () => {
    playSound('click');
    setView('tile');
});

// --- 6.5 RENDER FEED (The Missing Engine) ---
function reloadFeed() {
    feed.innerHTML = "";
    
    // 1. SORT LOGIC
    allPosts.sort((a, b) => {
        // Pinned posts always first
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        // Then sort by timestamp (newest first)
        return (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0);
    });

    // 2. FILTER LOGIC
    const term = searchInput.value.toLowerCase();
    
    const visiblePosts = allPosts.filter(p => {
        // Tag Filter (e.g. #ART)
        if (term.startsWith('#')) {
            const tagQuery = term.substring(1).toUpperCase();
            if (!p.tags) return false;
            return p.tags.includes(tagQuery);
        }
        // Text Filter (standard search)
        else if (term && !term.startsWith('/')) {
            return p.text.toLowerCase().includes(term);
        }
        return true; // Show everything if no search term
    });

    // 3. EMPTY STATE CHECK
    if (visiblePosts.length === 0) {
        if (allPosts.length > 0) {
            // We have posts, but the search hid them all
            feed.innerHTML = `
                <div class="no-signal">
                    [ NO DATA FOUND ]
                    <span>TRY A DIFFERENT SEARCH TERM...</span>
                </div>`;
        } else {
            // The database is actually empty
            feed.innerHTML = `<div class="no-signal">[ BLOG IS EMPTY ]</div>`;
        }
        
        // Hide/Show "Load More" based on search state
        if(term) loadMoreBtn.classList.add('hidden');
        else loadMoreBtn.classList.remove('hidden');
        
        return; 
    }

    // 4. RENDER LOOP
    visiblePosts.forEach(post => {
        addPostToDOM(post);
    });
}

// --- 7. LOAD POSTS (PAGINATION + PERMALINKS) ---
let allPosts = []; 
let feedLimit = 10; 
let unsubscribe = null;
let isFeedHidden = false; 

function setupSubscription() {
    if (unsubscribe) unsubscribe();

    // 1. CHECK FOR DIRECT LINK (?id=...)
    const urlParams = new URLSearchParams(window.location.search);
    const permalinkId = urlParams.get('id');

    if (permalinkId) {
        // --- SINGLE POST MODE ---
        
        // Hide pagination since we only have one post
        loadMoreBtn.classList.add('hidden'); 
        
        // Create the "Return" button
        // Check if it already exists to avoid duplicates
        if (!document.querySelector('.return-btn')) {
            const returnBtn = document.createElement('button');
            returnBtn.innerText = "< RETURN TO FEED";
            returnBtn.className = "return-btn"; // Uses the new CSS class
            
            returnBtn.onclick = () => {
                playSound('click');
                // Remove the ID from the URL without reloading yet
                window.history.pushState({}, document.title, window.location.pathname); 
                // Reload the page to reset to the main feed
                location.reload(); 
            };
            
            // Insert it right before the feed container
            feed.parentNode.insertBefore(returnBtn, feed);
        }

        // Fetch just the one post
        const docRef = doc(db, "posts", permalinkId);
        onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                allPosts = [{ id: docSnap.id, ...docSnap.data() }];
                reloadFeed(); // Renders just this one post
            } else {
                showToast("POST NOT FOUND");
                // If post doesn't exist, auto-redirect back to feed after 2 seconds
                setTimeout(() => { 
                    window.history.pushState({}, document.title, window.location.pathname);
                    location.reload(); 
                }, 2000);
            }
        });

    } else {
        // --- NORMAL FEED MODE ---
        
        // Remove return button if it exists (cleanup)
        const existingBtn = document.querySelector('.return-btn');
        if (existingBtn) existingBtn.remove();

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
}

// --- 8. POST & COMMAND LOGIC ---

function handleTypingSound(e) {
    if (e.repeat) return; 
    playSound('type');
}

// Auto-Expand Text Area
textInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

searchInput.addEventListener('keydown', handleTypingSound);
textInput.addEventListener('keydown', handleTypingSound);
imageInput.addEventListener('keydown', handleTypingSound);
if (passwordInput) passwordInput.addEventListener('keydown', handleTypingSound);

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
    
    // 1. COMMAND MODE
    if (val.startsWith('/')) {
        if (val === '/login') {
            // Toggle Login Bar
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
            // Show Help
            showToast("CMDS: /login, /clear");
            searchInput.value = '';
            
        } else if (val === '/clear') {
            // Toggle Feed Visibility
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
        return; // Stop here so we don't trigger a search
    }
    
    // 2. SEARCH MODE
    // If we start typing normally, we assume the user wants to see results,
    // so we disable the "Hidden" state and reload.
    if (isFeedHidden) isFeedHidden = false;
    reloadFeed(); 
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

// --- NEW TOOLBAR LOGIC ---
const fmtHeader = document.getElementById('fmtHeader');
const fmtQuote = document.getElementById('fmtQuote');
const fmtLink = document.getElementById('fmtLink');
const fmtCode = document.getElementById('fmtCode');
const fmtList = document.getElementById('fmtList');

// Existing logic
fmtBold.onclick = () => insertTag("**", "**");
fmtItalic.onclick = () => insertTag("*", "*");
fmtSpoiler.onclick = () => insertTag("||", "||");

// Drawer Toggle
toggleToolsBtn.addEventListener('click', () => {
    playSound('click');
    extraToolsDiv.classList.toggle('hidden');
    // Change button text based on state
    toggleToolsBtn.innerText = extraToolsDiv.classList.contains('hidden') ? "..." : "<";
});

// New Markdown Logic
fmtHeader.onclick = () => insertTag("### ", ""); 
fmtQuote.onclick = () => insertTag("> ", "");     
fmtCode.onclick = () => insertTag("`", "`");      
fmtList.onclick = () => insertTag("- ", "");      
fmtLink.onclick = () => {
    const url = prompt("Enter URL:");
    if (url) insertTag("[", `](${url})`);
};

// --- MEDIA STACK LOGIC ---
function updateMediaStackUI() {
    mediaStackDiv.innerHTML = "";
    mediaStack.forEach((url, index) => {
        const chip = document.createElement('div');
        chip.className = 'media-chip';
        chip.innerHTML = `
            <span class="chip-text">${url}</span>
            <span class="chip-remove" onclick="window.removeMedia(${index})">X</span>
        `;
        mediaStackDiv.appendChild(chip);
    });
}

// Make global for onclick access
window.removeMedia = function(index) {
    playSound('delete');
    mediaStack.splice(index, 1);
    updateMediaStackUI();
};

addMediaBtn.addEventListener('click', () => {
    const url = imageInput.value.trim();
    if (!url) return;
    
    playSound('confirm');
    mediaStack.push(url);
    imageInput.value = ""; 
    updateMediaStackUI();
});


postBtn.addEventListener('click', async function() {
    if (!auth.currentUser) return showToast("LOGIN REQUIRED");

    const text = textInput.value;
    
    // 1. Check if there's a URL sitting in the input box that user forgot to "Add"
    const currentInput = imageInput.value.trim();
    if (currentInput) {
        mediaStack.push(currentInput);
    }

    // 2. Use the stack as our image source
    const finalImages = [...mediaStack]; 

    if (text === "" && finalImages.length === 0) return;

    postBtn.disabled = true;
    postBtn.innerText = "SENDING...";

    try {
        if (editingPostId) {
            await updateDoc(doc(db, "posts", editingPostId), { 
                text: text, 
                images: finalImages, 
                tags: selectedTags, 
                editedTimestamp: serverTimestamp()
            });
            showToast("POST UPDATED");
            playSound('edit'); 
            resetForm();
        } else {
            await addDoc(collection(db, "posts"), {
                text: text,
                images: finalImages,
                tags: selectedTags, 
                timestamp: serverTimestamp(),
                actualTimestamp: serverTimestamp(),
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
    textInput.style.height = 'auto';
    
    // CLEAR STACK
    mediaStack = [];
    updateMediaStackUI();
    
    editingPostId = null;
    postBtn.innerText = "POST";
    if(cancelBtn) cancelBtn.classList.add('hidden');
    
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

        // Safety Lock for Pinned Posts
        if (post1.pinned || post2.pinned) {
            showToast("PINNED POSTS LOCKED");
            return false;
        }

        if (post1 && post2) {
            showToast("SWAPPING ORDER...");
            
            // 1. Get the Sort Orders (Timestamps)
            const sortTs1 = post1.timestamp;
            const sortTs2 = post2.timestamp;

            // 2. Preserve History (Handle Migration for Old Posts)
            // If actualTimestamp doesn't exist yet, we lock the current timestamp as the "Real Time"
            const realTs1 = post1.actualTimestamp || post1.timestamp;
            const realTs2 = post2.actualTimestamp || post2.timestamp;

            try {
                // UPDATE POST 1:
                // Take Post 2's Sort Order, but Keep Post 1's History
                await updateDoc(doc(db, "posts", id1), { 
                    timestamp: sortTs2,
                    actualTimestamp: realTs1 
                });

                // UPDATE POST 2:
                // Take Post 1's Sort Order, but Keep Post 2's History
                await updateDoc(doc(db, "posts", id2), { 
                    timestamp: sortTs1, 
                    actualTimestamp: realTs2
                });

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
    if (isAdmin && !post.pinned) {
        dragHTML = `<img src="images/drag-handle.png" class="drag-handle" draggable="true">`;
    }

    // TAGS HTML
    let tagsHTML = "";
    if (post.tags && post.tags.length > 0) {
        tagsHTML = `<div class="post-tags">`;
        post.tags.forEach(tag => {
            tagsHTML += `<span class="post-tag" onclick="window.toggleSearchTag('${tag}')">${tag}</span>`;
        });
        tagsHTML += `</div>`;
    }

    // --- MULTI-MEDIA LOGIC ---
    let mediaHTML = "";
    
    // COMBINE OLD 'image' STRING AND NEW 'images' ARRAY
    let contentList = [];
    if (post.images && Array.isArray(post.images)) {
        contentList = post.images;
    } else if (post.image) {
        contentList = [post.image];
    }

    if (contentList.length > 0) {
        // If more than 1 image, use a grid layout, otherwise single view
        const gridClass = contentList.length > 1 ? "media-gallery" : "media-single";
        
        mediaHTML = `<div class="${gridClass}">`;
        
        contentList.forEach(url => {
            const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
            const spMatch = url.match(/open\.spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/);
            
            if (ytMatch) {
                mediaHTML += `<div class="media-item"><iframe class="media-embed" src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen></iframe></div>`;
            } else if (spMatch) {
                // FIXED: USES ${} AND CORRECT URL
                mediaHTML += `<div class="media-item"><iframe class="media-embed" src="https://open.spotify.com/embed/${spMatch[1]}/${spMatch[2]}" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe></div>`;
            } else {
                const isVideo = url.match(/\.(mp4|webm|ogg|mov)/i);
                const isAudio = url.match(/\.(mp3|wav)/i);
                
                if (isVideo) mediaHTML += `<div class="media-item"><video src="${url}" controls loop playsinline class="post-media"></video></div>`;
                else if (isAudio) mediaHTML += `<div class="media-item"><audio src="${url}" controls class="post-media"></audio></div>`;
                else mediaHTML += `<div class="media-item"><img src="${url}" class="post-image click-to-zoom"></div>`;
            }
        });
        
        mediaHTML += `</div>`;
    }

    // --- DATE LOGIC ---
    const rawDate = post.actualTimestamp || post.timestamp;
    const postDate = rawDate ? rawDate.toDate() : new Date();
    const editDate = post.editedTimestamp ? post.editedTimestamp.toDate() : null;

    let metaContent = `<span class="main-ts">${timeAgo(postDate)}</span>`;
    if (editDate) {
        metaContent += `<span class="edited-ts">(edited ${timeAgo(editDate)})</span>`;
    }

  // --- MARKDOWN & TEXT PROCESSING ---
    
    // FIXED: We pass { breaks: true } directly here to force newlines to work
    let rawHTML = marked.parse(post.text, { breaks: true, gfm: true });

    // 3. Sanitize (Security)
    let safeHTML = DOMPurify.sanitize(rawHTML);

    // 4. Custom Spoiler Tag Logic (Markdown doesn't usually support ||spoiler||)
    // We run this regex AFTER markdown conversion on the HTML.
    safeHTML = safeHTML.replace(/\|\|(.*?)\|\|/g, '<span class="spoiler" onclick="this.classList.toggle(\'revealed\')">$1</span>');

    postDiv.innerHTML = `
        ${dragHTML}
        ${pinHTML}
        
        <div class="timestamp-wrapper" title="Toggle precise time">
            ${metaContent}
        </div>

        ${tagsHTML} 
        <div class="post-content">
            <img src="images/plxeyes.png" class="avatar-icon">
            <div class="post-text-container">
                <div class="post-text markdown-body">${safeHTML}</div>
            </div>
        </div>
        ${mediaHTML}

        <div class="post-footer">
            <span class="permalink-btn" title="Copy Link">[ LINK ]</span>
        </div>

        <div class="admin-buttons"></div>
    `;

    feed.appendChild(postDiv);

    // --- RE-ATTACH LISTENERS ---
    
    // Timestamp Toggle
    const tsWrapper = postDiv.querySelector('.timestamp-wrapper');
    if (tsWrapper) {
        tsWrapper.addEventListener('click', () => {
            playSound('click');
            const currentText = tsWrapper.innerText;
            const isRelative = currentText.includes("ago") || currentText.includes("Just now");
            if (isRelative) {
                let exactHTML = `<span class="main-ts">${postDate.toLocaleString()}</span>`;
                if (editDate) exactHTML += `<span class="edited-ts">(edited ${editDate.toLocaleString()})</span>`;
                tsWrapper.innerHTML = exactHTML;
            } else {
                let relHTML = `<span class="main-ts">${timeAgo(postDate)}</span>`;
                if (editDate) relHTML += `<span class="edited-ts">(edited ${timeAgo(editDate)})</span>`;
                tsWrapper.innerHTML = relHTML;
            }
        });
    }

    // Permalink
    const linkBtn = postDiv.querySelector('.permalink-btn');
    if (linkBtn) {
        linkBtn.addEventListener('click', () => {
            playSound('click');
            const url = `${window.location.origin}${window.location.pathname}?id=${id}`;
            navigator.clipboard.writeText(url).then(() => showToast("LINK COPIED"));
        });
    }

    // Truncate logic needs to check the markdown container
    const textContainer = postDiv.querySelector('.post-text-container');
    if (textContainer.scrollHeight > 150) {
        textContainer.classList.add('truncated');
        const expandBtn = document.createElement('button');
        expandBtn.className = 'expand-btn';
        expandBtn.innerText = "[ EXPAND ]";
        expandBtn.onmouseenter = () => playSound('hover');
        expandBtn.onclick = () => {
            playSound('click');
            textContainer.classList.toggle('truncated');
            expandBtn.innerText = textContainer.classList.contains('truncated') ? "[ EXPAND ]" : "[ COLLAPSE ]";
        };
        postDiv.insertBefore(expandBtn, postDiv.querySelector('.post-content').nextSibling);
    }

    // Pin logic
    const pinBtn = postDiv.querySelector('.pin-icon');
    if (pinBtn && isAdmin) {
        pinBtn.addEventListener('click', async () => {
            playSound('pin');
            const newStatus = !post.pinned;
            if (newStatus) {
                const existingPin = allPosts.find(p => p.pinned && p.id !== id);
                if (existingPin) await updateDoc(doc(db, "posts", existingPin.id), { pinned: false });
            }
            await updateDoc(doc(db, "posts", id), { pinned: newStatus });
            showToast(newStatus ? "POST PINNED" : "POST UNPINNED");
        });
    }

    // Edit/Delete
    if (isAdmin) {
        const handle = postDiv.querySelector('.drag-handle');
        if (handle) handle.addEventListener('dragstart', handleDragStart);
        
        const btnContainer = postDiv.querySelector('.admin-buttons');
        const editBtn = document.createElement('button');
        editBtn.innerText = "EDIT";
        // NOTE: We pass the NEW images array to startEdit here
        editBtn.onclick = () => startEdit(id, post.text, post.image, post.tags, post.images);
        btnContainer.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.innerText = "DELETE";
        deleteBtn.onclick = () => triggerDelete(id);
        btnContainer.appendChild(deleteBtn);
    }
    
    // Lightbox (Loop through all images in the gallery)
    const imgElements = postDiv.querySelectorAll('.click-to-zoom');
    imgElements.forEach(img => {
        img.addEventListener('click', () => {
            playSound('click');
            lightboxImg.src = img.src;
            lightboxModal.classList.remove('hidden');
        });
    });
}

function startEdit(id, text, image, tags, images) {
    textInput.value = text;
    
    // LOAD EXISTING IMAGES INTO STACK
    if (images && images.length > 0) {
        mediaStack = images;
    } else if (image) {
        mediaStack = [image];
    } else {
        mediaStack = [];
    }
    updateMediaStackUI();
    imageInput.value = ""; // Keep the input clean
    
    textInput.style.height = 'auto'; 
    textInput.style.height = (textInput.scrollHeight) + 'px';
    
    editingPostId = id;
    postBtn.innerText = "UPDATE POST";
    if(cancelBtn) cancelBtn.classList.remove('hidden');
    window.scrollTo(0, 0);
    
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

// Close Button
lightboxClose.addEventListener('click', () => {
    playSound('click');
    lightboxModal.classList.add('hidden');
});

lightboxModal.addEventListener('click', (e) => {
    if(e.target === lightboxModal) lightboxModal.classList.add('hidden');
});

// Back to Top
window.addEventListener('scroll', () => {
    if (window.scrollY > 300) backToTopBtn.classList.remove('hidden');
    else backToTopBtn.classList.add('hidden');
});

// RESTORED: Back to Top Click Sound
backToTopBtn.addEventListener('click', () => {
    playSound('click'); // Added Sound
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// --- 12. GLOBAL HELPERS ---
window.toggleSearchTag = function(tag) {
    playSound('click');
    const currentVal = searchInput.value;
    const targetVal = '#' + tag;

    if (currentVal === targetVal) {
        searchInput.value = ''; // Toggle Off
        showToast("FILTER CLEARED");
    } else {
        searchInput.value = targetVal; // Toggle On
    }
    // Trigger the search logic immediately
    searchInput.dispatchEvent(new Event('input'));
};