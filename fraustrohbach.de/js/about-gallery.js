// ─── FIREBASE INIT ───
const firebaseConfig = {
    apiKey: "AIzaSyCzS5TxVpbnxOruWWIVpxnz9SPQ1uZ0B2w",
    authDomain: "website-7c871.firebaseapp.com",
    projectId: "website-7c871",
    storageBucket: "website-7c871.firebasestorage.app",
    messagingSenderId: "371207772629",
    appId: "1:371207772629:web:b1b7782d37df9b72a3055c",
    measurementId: "G-STDL59VZFS"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// ─── STATE ───
let currentUser = null;
let albums = [];
let images = [];
let currentAlbumId = null;
let viewerImages = [];
let viewerCurrentIdx = 0;
let imageToMoveId = null;
let dragCounter = 0;

// ─── AUTH LISTENER ───
auth.onAuthStateChanged((user) => {
    currentUser = user;
    renderNavAuth();
    renderMobileAuth();
    renderAdminToolbar();
    loadGallery();
});

// ─── ADMIN AUTH ───
function isAdmin() {
    if (sessionStorage.getItem('exinia_auth_session') === 'true') return true;
    const user = auth.currentUser;
    if (!user || !user.email) return false;
    const email = user.email.toLowerCase();
    return email === 'exinia@fraustrohbach.de' || email === 'katadvaya@fraustrohbach.de';
}

// ─── NAV & MOBILE AUTH ───
function getUserDisplayName(user) {
    if (!user) return 'Guest';
    return user.displayName || 'Operator';
}

function renderNavAuth() {
    const navAuth = document.getElementById('nav-auth');
    if (!navAuth) return;
    if (currentUser) {
        const displayName = getUserDisplayName(currentUser);
        navAuth.innerHTML = `
            <span onclick="openProfileModal()" class="text-neon-cyan font-mono text-xs hidden lg:inline glow-text cursor-pointer hover:text-white transition-colors">${escapeHtml(displayName)}</span>
            <button onclick="openProfileModal()" class="lg:hidden text-slate-400 hover:text-neon-cyan transition-colors flex items-center gap-1 text-xs uppercase tracking-widest">
                <i class="ph ph-user-circle text-lg"></i> Profile
            </button>
            <button onclick="handleAdminLogout()" class="text-slate-400 hover:text-neon-magenta transition-colors flex items-center gap-1 text-xs uppercase tracking-widest">
                <i class="ph ph-sign-out text-lg"></i> Logout
            </button>
        `;
    } else {
        navAuth.innerHTML = `
            <a href="blog.html#auth-terminal" class="text-slate-400 hover:text-neon-cyan transition-colors flex items-center gap-1 text-xs uppercase tracking-widest">
                <i class="ph ph-key text-lg"></i> Login
            </a>
        `;
    }
}

function renderMobileAuth() {
    const container = document.getElementById('mobile-auth-links');
    if (!container) return;
    if (currentUser) {
        const displayName = getUserDisplayName(currentUser);
        container.innerHTML = `
            <button onclick="openProfileModal(); closeMobileMenu();" class="text-neon-cyan glow-text hover:text-white transition-colors text-left flex items-center gap-2 font-mono text-xs uppercase tracking-widest">
                <i class="ph ph-user-circle text-lg"></i> ${escapeHtml(displayName)}
            </button>
            <button onclick="handleAdminLogout(); closeMobileMenu();" class="text-slate-400 hover:text-neon-magenta transition-colors text-left flex items-center gap-2">
                <i class="ph ph-sign-out text-lg"></i> Logout
            </button>
        `;
    } else {
        container.innerHTML = `
            <a href="blog.html#auth-terminal" class="text-slate-400 hover:text-neon-cyan transition-colors flex items-center gap-2">
                <i class="ph ph-key text-lg"></i> Login
            </a>
        `;
    }
}

function closeMobileMenu() {
    const m = document.getElementById('mobile-menu');
    if (m) m.classList.add('hidden');
}

const mobileBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
if (mobileBtn && mobileMenu) {
    mobileBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });
}

async function handleAdminLogout() {
    sessionStorage.removeItem('exinia_auth_session');
    await auth.signOut();
    renderNavAuth();
    renderMobileAuth();
    renderAdminToolbar();
}

// ─── ADMIN TOOLBAR ───
function renderAdminToolbar() {
    const toolbar = document.getElementById('admin-toolbar');
    if (!toolbar) return;
    toolbar.classList.toggle('hidden', !isAdmin());
}

// ─── DRAG & DROP ───
const dragOverlay = document.getElementById('drag-overlay');

window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (isAdmin() && e.dataTransfer.types.includes('Files')) {
        dragOverlay.classList.add('active');
    }
});

window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) dragOverlay.classList.remove('active');
});

window.addEventListener('dragover', (e) => {
    e.preventDefault();
});

window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    dragOverlay.classList.remove('active');
    if (!isAdmin()) return;
    // Falls Drop auf Album-Card oder "+ New Folder"-Card, NICHT erneut uploaden —
    // albumDrop/newFolderDrop haben das Event bereits bearbeitet.
    const target = e.target;
    if (target.closest('.folder-card') || target.closest('#new-folder-card')) return;
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length) uploadFiles(files, currentAlbumId);
});

// ─── FILE INPUT UPLOAD ───
document.getElementById('admin-file-input').addEventListener('change', (e) => {
    if (!isAdmin()) return;
    const files = Array.from(e.target.files);
    if (files.length) uploadFiles(files, currentAlbumId);
    e.target.value = '';
});

async function uploadFiles(files, albumId) {
    const status = document.getElementById('upload-status');
    status.classList.remove('hidden');
    status.textContent = `Uploading 0 / ${files.length}...`;
    status.className = 'text-xs font-mono text-neon-cyan ml-auto';

    let uploaded = 0;
    for (const file of files) {
        const safeName = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const folder = albumId || 'uncategorized';
        const path = `artist-gallery/${folder}/${safeName}`;
        const ref = storage.ref(path);
        try {
            await ref.put(file);
            const url = await ref.getDownloadURL();
            await db.collection('artistGalleryImages').add({
                src: url,
                albumId: albumId || null,
                storagePath: path,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: currentUser ? currentUser.uid : '',
                order: 0
            });
            uploaded++;
            status.textContent = `Uploading ${uploaded} / ${files.length}...`;
        } catch (err) {
            console.error('Upload failed:', err);
            status.textContent = `Error: ${err.message}`;
            status.className = 'text-xs font-mono text-neon-magenta ml-auto';
            return;
        }
    }
    status.textContent = `Done: ${uploaded} uploaded.`;
    status.className = 'text-xs font-mono text-neon-lime ml-auto';
    setTimeout(() => status.classList.add('hidden'), 3000);
    await loadGallery();
}

// ─── DRAG & DROP: ALBUM-CARDS ───
function albumDropHover(albumId, e) {
    if (!isAdmin()) return;
    const card = document.querySelector(`.folder-card[data-album-id="${albumId}"]`);
    if (card) {
        card.classList.add('ring-2', 'ring-neon-cyan', 'ring-offset-2', 'ring-offset-black');
    }
    e.dataTransfer.dropEffect = 'copy';
}

function albumDropLeave(albumId, e) {
    const card = document.querySelector(`.folder-card[data-album-id="${albumId}"]`);
    if (card) {
        card.classList.remove('ring-2', 'ring-neon-cyan', 'ring-offset-2', 'ring-offset-black');
    }
}

async function albumDrop(albumId, e) {
    albumDropLeave(albumId, e);
    if (!isAdmin()) return;
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    const imageIds = e.dataTransfer.getData('text/plain'); // existing image IDs (comma-separated)
    if (files.length > 0) {
        await uploadFiles(files, albumId);
    } else if (imageIds) {
        // Move existing images into this album
        const ids = imageIds.split(',').filter(Boolean);
        const batch = db.batch();
        ids.forEach(id => {
            const ref = db.collection('artistGalleryImages').doc(id);
            batch.update(ref, { albumId });
        });
        try {
            await batch.commit();
            await loadGallery();
            showToast(`Moved ${ids.length} image${ids.length !== 1 ? 's' : ''} to album`);
        } catch (err) {
            alert('Move failed: ' + err.message);
        }
    }
}

// ─── DRAG & DROP: "+ NEW FOLDER" CARD ───
function newFolderDropHover(e) {
    if (!isAdmin()) return;
    e.dataTransfer.dropEffect = 'copy';
    const card = document.getElementById('new-folder-card');
    if (card) {
        card.classList.add('ring-2', 'ring-neon-amber', 'ring-offset-2', 'ring-offset-black');
    }
}

function newFolderDropLeave(e) {
    const card = document.getElementById('new-folder-card');
    if (card) {
        card.classList.remove('ring-2', 'ring-neon-amber', 'ring-offset-2', 'ring-offset-black');
    }
}

async function newFolderDrop(e) {
    newFolderDropLeave(e);
    if (!isAdmin()) return;
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;
    // Auto-generate album name based on first file or current date
    const baseName = files[0].name.replace(/\.[^.]+$/, '').slice(0, 40);
    const albumName = `${baseName} (${new Date().toLocaleDateString()})`;
    try {
        const docRef = await db.collection('artistGalleryAlbums').add({
            name: albumName,
            coverImageId: null,
            isPublic: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            order: 0
        });
        showToast(`Created album "${albumName}" with ${files.length} image${files.length !== 1 ? 's' : ''}...`);
        await uploadFiles(files, docRef.id);
    } catch (err) {
        alert('Failed to create album: ' + err.message);
    }
}

// ─── TOAST NOTIFICATION ───
function showToast(message, duration = 3000) {
    let toast = document.getElementById('gallery-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'gallery-toast';
        toast.className = 'fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-slate-900/95 border border-neon-cyan/40 text-neon-cyan font-mono text-sm backdrop-blur-sm shadow-2xl opacity-0 transition-opacity duration-300 pointer-events-none';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.remove('opacity-0');
    toast.classList.add('opacity-100');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.classList.add('opacity-0');
        toast.classList.remove('opacity-100');
    }, duration);
}

// ─── LOAD GALLERY ───
async function loadGallery() {
    const isUserAdmin = isAdmin();
    // Note: Vermeide orderBy('order').orderBy('createdAt') — das benötigt
    // einen Composite-Index. Wir sortieren clientseitig.
    try {
        const albumsSnap = await db.collection('artistGalleryAlbums').get();
        let rawAlbums = albumsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Clientseitige Sortierung: zuerst nach order, dann nach createdAt desc
        rawAlbums.sort((a, b) => {
            const oa = (a.order != null) ? a.order : 0;
            const ob = (b.order != null) ? b.order : 0;
            if (oa !== ob) return oa - ob;
            const ta = a.createdAt ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });
        albums = rawAlbums;
        if (!isUserAdmin) {
            albums = albums.filter(a => a.isPublic !== false);
        }
    } catch (e) {
        console.error('loadGallery albums error:', e);
        albums = [];
    }
    try {
        const imagesSnap = await db.collection('artistGalleryImages').get();
        let rawImages = imagesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        rawImages.sort((a, b) => {
            const oa = (a.order != null) ? a.order : 0;
            const ob = (b.order != null) ? b.order : 0;
            if (oa !== ob) return oa - ob;
            const ta = a.createdAt ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });
        images = rawImages;
    } catch (e) {
        console.error('loadGallery images error:', e);
        images = [];
    }
    if (!isUserAdmin) {
        const visibleAlbumIds = new Set(albums.map(a => a.id));
        images = images.filter(img => !img.albumId || visibleAlbumIds.has(img.albumId));
    }
    renderGallery();
}

// ─── RENDER GALLERY ───
function renderGallery() {
    const uncategorizedGrid = document.getElementById('uncategorized-grid');
    const albumsGrid = document.getElementById('albums-grid');
    const uncategorizedSection = document.getElementById('uncategorized-section');
    const albumsSection = document.getElementById('albums-section');
    const uncategorizedCount = document.getElementById('uncategorized-count');
    const albumsCount = document.getElementById('albums-count');
    const galleryContent = document.getElementById('gallery-content');
    const albumDetailView = document.getElementById('album-detail-view');
    const breadcrumb = document.getElementById('gallery-breadcrumb');

    galleryContent.classList.remove('hidden');
    albumDetailView.classList.add('hidden');
    breadcrumb.classList.add('hidden');
    currentAlbumId = null;

    const uncategorized = images.filter(img => !img.albumId);
    uncategorizedCount.textContent = `${uncategorized.length} item${uncategorized.length !== 1 ? 's' : ''}`;

    if (uncategorized.length === 0 && !isAdmin()) {
        uncategorizedSection.classList.add('hidden');
    } else {
        uncategorizedSection.classList.remove('hidden');
        if (uncategorized.length === 0) {
            uncategorizedGrid.innerHTML = `
                <div class="col-span-full text-center py-12 text-slate-600 font-mono text-sm">No uncategorized images.</div>
            `;
        } else {
            uncategorizedGrid.innerHTML = uncategorized.map(img => renderImageCard(img)).join('');
        }
    }

    albumsCount.textContent = `${albums.length} folder${albums.length !== 1 ? 's' : ''}`;

    // Alben-Container: "+ New Folder"-Card (statisch) bleibt IMMER als erstes
    // erhalten. Wir ersetzen nur den Platzhalter, falls keine Alben da sind.
    const newFolderCard = document.getElementById('new-folder-card');
    const newFolderHTML = newFolderCard ? newFolderCard.outerHTML : '';

    // Entferne alte Folder-Cards (alles außer dem new-folder-placeholder)
    albumsGrid.querySelectorAll('.folder-card').forEach(el => el.remove());
    // Entferne "No albums yet" message
    albumsGrid.querySelectorAll('.no-albums-msg').forEach(el => el.remove());

    if (albums.length === 0 && !isAdmin()) {
        albumsSection.classList.add('hidden');
    } else {
        albumsSection.classList.remove('hidden');
        if (albums.length === 0) {
            // "No albums yet" als 2. Element anhängen
            const noAlbums = document.createElement('div');
            noAlbums.className = 'col-span-full text-center py-12 text-slate-600 font-mono text-sm no-albums-msg';
            noAlbums.textContent = 'No albums yet.';
            albumsGrid.appendChild(noAlbums);
        } else {
            // Alben anhängen
            const tmp = document.createElement('div');
            tmp.innerHTML = albums.map(album => renderAlbumCard(album)).join('');
            while (tmp.firstChild) albumsGrid.appendChild(tmp.firstChild);
        }
    }

    // "+ New Folder"-Card Sichtbarkeit
    if (newFolderCard) {
        if (isAdmin()) {
            newFolderCard.classList.remove('hidden');
            newFolderCard.setAttribute('ondragover', "event.preventDefault(); newFolderDropHover(event);");
            newFolderCard.setAttribute('ondragleave', "newFolderDropLeave(event);");
            newFolderCard.setAttribute('ondrop', "event.preventDefault(); newFolderDrop(event);");
        } else {
            newFolderCard.classList.add('hidden');
        }
    }
}

function renderImageCard(img, opts = {}) {
    const showAlbumName = opts.showAlbumName;
    const admin = isAdmin();
    const albumInfo = showAlbumName && img.albumId
        ? `<div class="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-neon-cyan text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded">
            ${escapeHtml(getAlbumName(img.albumId))}
           </div>`
        : '';
    const actions = admin ? `
        <div class="image-actions absolute top-2 right-2 flex gap-1 z-10">
            <button onclick="event.stopPropagation(); promptMoveImage('${img.id}')" class="admin-btn p-1" title="Move">
                <i class="ph ph-arrows-left-right"></i>
            </button>
            <button onclick="event.stopPropagation(); deleteImage('${img.id}')" class="admin-btn danger p-1" title="Delete">
                <i class="ph ph-trash"></i>
            </button>
        </div>
    ` : '';
    // Draggable für Admins (Move zwischen Alben)
    const draggable = admin ? 'draggable="true"' : '';
    const dragHandlers = admin ? `
        ondragstart="imageDragStart(event, '${img.id}')"
        ondragend="imageDragEnd(event)"
    ` : '';
    return `
        <div class="image-card group relative aspect-square bg-slate-900 overflow-hidden border border-slate-800 cursor-pointer"
             ${draggable} ${dragHandlers}
             data-image-id="${img.id}">
            <img src="${escapeHtml(img.src)}" alt="" loading="lazy"
                 class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                 onclick="openImageViewer('${img.id}')"
                 onerror="this.parentElement.innerHTML='<div class=\'absolute inset-0 flex items-center justify-center text-slate-600 italic text-xs\'>Not found</div>'">
            ${albumInfo}
            ${actions}
        </div>
    `;
}

// ─── DRAG: IMAGE CARDS ───
let draggedImageIds = [];

function imageDragStart(e, imageId) {
    if (!isAdmin()) { e.preventDefault(); return; }
    draggedImageIds = [imageId];
    e.dataTransfer.setData('text/plain', imageId);
    e.dataTransfer.effectAllowed = 'move';
    const card = document.querySelector(`.image-card[data-image-id="${imageId}"]`);
    if (card) card.classList.add('opacity-40');
}

function imageDragEnd(e) {
    draggedImageIds = [];
    document.querySelectorAll('.image-card.opacity-40').forEach(c => c.classList.remove('opacity-40'));
}

function renderAlbumCard(album) {
    const admin = isAdmin();
    const albumImages = images.filter(img => img.albumId === album.id);
    const coverImg = albumImages.find(img => img.id === album.coverImageId)
        || albumImages[0];
    const coverSrc = coverImg ? coverImg.src : '';
    const badgeClass = album.isPublic !== false ? 'public' : 'private';
    const badgeText = album.isPublic !== false ? 'Public' : 'Private';

    const adminActions = admin ? `
        <div class="flex gap-1 mt-2">
            <button onclick="event.stopPropagation(); promptSetCover('${album.id}')" class="admin-btn flex-1 text-[10px] py-1">Set Cover</button>
            <button onclick="event.stopPropagation(); toggleAlbumPublic('${album.id}')" class="admin-btn flex-1 text-[10px] py-1">${album.isPublic !== false ? 'Make Private' : 'Make Public'}</button>
            <button onclick="event.stopPropagation(); deleteAlbum('${album.id}')" class="admin-btn danger flex-1 text-[10px] py-1">Delete</button>
        </div>
    ` : '';

    // Drag-and-drop: Album-Card akzeptiert Files (Upload in Album)
    // UND existing Images (Move zwischen Alben)
    const dropAttrs = admin ? `
        ondragover="event.preventDefault(); albumDropHover('${album.id}', event);"
        ondragleave="albumDropLeave('${album.id}', event);"
        ondrop="event.preventDefault(); albumDrop('${album.id}', event);"
    ` : '';

    return `
        <div class="folder-card group relative bg-slate-900 overflow-hidden border border-slate-800 cursor-pointer"
             data-album-id="${album.id}"
             ${dropAttrs}
             onclick="openAlbum('${album.id}')">
            <div class="aspect-square relative overflow-hidden">
                ${coverSrc ? `
                    <img src="${escapeHtml(coverSrc)}" alt="${escapeHtml(album.name)}" loading="lazy"
                         class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="hidden absolute inset-0 items-center justify-center text-slate-600">
                        <i class="ph ph-folder text-4xl"></i>
                    </div>
                ` : `
                    <div class="absolute inset-0 flex items-center justify-center text-slate-600">
                        <i class="ph ph-folder text-4xl"></i>
                    </div>
                `}
                <div class="absolute top-2 right-2">
                    <span class="album-badge ${badgeClass}">${badgeText}</span>
                </div>
            </div>
            <div class="p-3 border-t border-slate-800">
                <p class="text-sm font-display text-white truncate">${escapeHtml(album.name || 'Untitled')}</p>
                <p class="text-[10px] font-mono text-slate-500 mt-1">${albumImages.length} image${albumImages.length !== 1 ? 's' : ''}</p>
                ${adminActions}
            </div>
        </div>
    `;
}

function getAlbumName(id) {
    const a = albums.find(x => x.id === id);
    return a ? a.name : 'Unknown';
}

// ─── ALBUM DETAIL ───
function openAlbum(albumId) {
    const album = albums.find(a => a.id === albumId);
    if (!album) return;
    const albumImages = images.filter(img => img.albumId === albumId);

    document.getElementById('gallery-content').classList.add('hidden');
    document.getElementById('album-detail-view').classList.remove('hidden');
    document.getElementById('gallery-breadcrumb').classList.remove('hidden');
    document.getElementById('breadcrumb-album-name').textContent = album.name || 'Untitled';
    currentAlbumId = albumId;

    document.getElementById('album-detail-title').textContent = album.name || 'Untitled';
    document.getElementById('album-detail-meta').textContent = `${albumImages.length} image${albumImages.length !== 1 ? 's' : ''}`;

    const actions = document.getElementById('album-detail-actions');
    if (isAdmin()) {
        actions.innerHTML = `
            <label class="admin-btn cursor-pointer inline-flex items-center gap-2">
                <i class="ph ph-upload-simple"></i> Upload to Folder
                <input type="file" multiple accept="image/*" class="hidden" onchange="handleAlbumUpload(event, '${albumId}')">
            </label>
        `;
    } else {
        actions.innerHTML = '';
    }

    const grid = document.getElementById('album-detail-grid');
    if (albumImages.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-16 text-slate-600 font-mono text-sm">
                This folder is empty.
            </div>
        `;
    } else {
        grid.innerHTML = albumImages.map(img => renderImageCard(img)).join('');
    }
}

function showMainGallery() {
    document.getElementById('gallery-content').classList.remove('hidden');
    document.getElementById('album-detail-view').classList.add('hidden');
    document.getElementById('gallery-breadcrumb').classList.add('hidden');
    currentAlbumId = null;
    loadGallery();
}

async function handleAlbumUpload(event, albumId) {
    if (!isAdmin()) return;
    const files = Array.from(event.target.files);
    if (files.length) uploadFiles(files, albumId);
    event.target.value = '';
}

// ─── CREATE ALBUM ───
function openCreateAlbumModal() {
    const m = document.getElementById('create-album-modal');
    m.classList.remove('hidden');
    setTimeout(() => m.classList.remove('opacity-0'), 10);
    document.getElementById('new-album-name').value = '';
    document.getElementById('new-album-public').checked = true;
}

function closeCreateAlbumModal() {
    const m = document.getElementById('create-album-modal');
    m.classList.add('opacity-0');
    setTimeout(() => m.classList.add('hidden'), 300);
}

async function createAlbum() {
    const name = document.getElementById('new-album-name').value.trim();
    const isPublic = document.getElementById('new-album-public').checked;
    if (!name) { alert('Please enter a folder name.'); return; }
    try {
        await db.collection('artistGalleryAlbums').add({
            name,
            coverImageId: null,
            isPublic,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            order: 0
        });
        closeCreateAlbumModal();
        await loadGallery();
        showToast(`Folder "${name}" created`);
    } catch (e) {
        alert('Failed to create folder: ' + e.message);
    }
}

// ─── DELETE IMAGE ───
async function deleteImage(id) {
    if (!isAdmin()) return;
    if (!confirm('Delete this image permanently?')) return;
    try {
        const img = images.find(i => i.id === id);
        if (img && img.storagePath) {
            try { await storage.ref(img.storagePath).delete(); } catch (serr) { console.warn('Storage delete failed', serr); }
        }
        await db.collection('artistGalleryImages').doc(id).delete();
        await loadGallery();
        if (currentAlbumId) openAlbum(currentAlbumId);
    } catch (e) {
        alert('Delete failed: ' + e.message);
    }
}

// ─── MOVE IMAGE ───
function promptMoveImage(id) {
    if (!isAdmin()) return;
    imageToMoveId = id;
    const list = document.getElementById('move-album-list');
    if (albums.length === 0) {
        list.innerHTML = `<div class="text-center py-4 text-slate-600 font-mono text-xs">No folders available.</div>
        `;
    } else {
        list.innerHTML = albums.map(a => `
            <button onclick="moveImageToAlbum('${a.id}')" class="w-full text-left px-4 py-3 border border-slate-800 hover:border-neon-cyan hover:bg-slate-900/50 transition-all flex items-center gap-3">
                <i class="ph ph-folder text-neon-cyan"></i>
                <span class="text-sm text-slate-300">${escapeHtml(a.name)}</span>
            </button>
        `).join('');
    }
    const m = document.getElementById('move-image-modal');
    m.classList.remove('hidden');
    setTimeout(() => m.classList.remove('opacity-0'), 10);
}

function closeMoveImageModal() {
    const m = document.getElementById('move-image-modal');
    m.classList.add('opacity-0');
    setTimeout(() => m.classList.add('hidden'), 300);
    imageToMoveId = null;
}

async function moveImageToAlbum(albumId) {
    if (!imageToMoveId || !isAdmin()) return;
    try {
        await db.collection('artistGalleryImages').doc(imageToMoveId).update({
            albumId: albumId || null
        });
        closeMoveImageModal();
        await loadGallery();
        if (currentAlbumId) openAlbum(currentAlbumId);
    } catch (e) {
        alert('Move failed: ' + e.message);
    }
}

let coverPickerAlbumId = null;

function openSetCoverModal(albumId) {
    coverPickerAlbumId = albumId;
    const albumImages = images.filter(img => img.albumId === albumId);
    const grid = document.getElementById('set-cover-grid');
    if (albumImages.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-4 text-slate-600 font-mono text-xs">No images in this folder.</div>`;
    } else {
        grid.innerHTML = albumImages.map(img => `
            <button onclick="setAlbumCover('${albumId}', '${img.id}'); closeSetCoverModal();" class="group relative aspect-square bg-slate-900 border border-slate-800 hover:border-neon-cyan overflow-hidden">
                <img src="${escapeHtml(img.src)}" alt="" loading="lazy" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105">
            </button>
        `).join('');
    }
    const m = document.getElementById('set-cover-modal');
    m.classList.remove('hidden');
    setTimeout(() => m.classList.remove('opacity-0'), 10);
}

function closeSetCoverModal() {
    const m = document.getElementById('set-cover-modal');
    m.classList.add('opacity-0');
    setTimeout(() => m.classList.add('hidden'), 300);
    coverPickerAlbumId = null;
}

// ─── ALBUM ACTIONS ───
function promptSetCover(albumId) {
    if (!isAdmin()) return;
    const albumImages = images.filter(img => img.albumId === albumId);
    if (albumImages.length === 0) { alert('Folder is empty. Add images first.'); return; }
    openSetCoverModal(albumId);
}

async function setAlbumCover(albumId, imageId) {
    if (!isAdmin()) return;
    try {
        await db.collection('artistGalleryAlbums').doc(albumId).update({ coverImageId: imageId });
        await loadGallery();
    } catch (e) {
        alert('Failed to set cover: ' + e.message);
    }
}

async function toggleAlbumPublic(albumId) {
    if (!isAdmin()) return;
    const album = albums.find(a => a.id === albumId);
    if (!album) return;
    try {
        await db.collection('artistGalleryAlbums').doc(albumId).update({ isPublic: album.isPublic === false ? true : false });
        await loadGallery();
    } catch (e) {
        alert('Failed to toggle privacy: ' + e.message);
    }
}

async function deleteAlbum(albumId) {
    if (!isAdmin()) return;
    if (!confirm('Delete this folder? Images inside will be moved to uncategorized.')) return;
    try {
        const batch = db.batch();
        const albumImages = images.filter(img => img.albumId === albumId);
        albumImages.forEach(img => {
            const ref = db.collection('artistGalleryImages').doc(img.id);
            batch.update(ref, { albumId: null });
        });
        await batch.commit();
        await db.collection('artistGalleryAlbums').doc(albumId).delete();
        await loadGallery();
        if (currentAlbumId === albumId) showMainGallery();
    } catch (e) {
        alert('Delete failed: ' + e.message);
    }
}

// ─── IMAGE VIEWER ───
function openImageViewer(imageId) {
    const allVisible = currentAlbumId
        ? images.filter(img => img.albumId === currentAlbumId)
        : images.filter(img => !img.albumId);
    const idx = allVisible.findIndex(img => img.id === imageId);
    if (idx === -1) return;
    viewerImages = allVisible;
    viewerCurrentIdx = idx;
    _applyViewerImage();
    const viewer = document.getElementById('image-viewer');
    viewer.style.display = 'flex';
    setTimeout(() => viewer.classList.remove('opacity-0'), 10);
    document.addEventListener('keydown', handleViewerKeyboard);
}

function _applyViewerImage() {
    const img = document.getElementById('image-viewer-img');
    const filenameEl = document.getElementById('viewer-filename');
    const descEl = document.getElementById('viewer-description');
    const idxEl = document.getElementById('viewer-index');
    const prevBtn = document.getElementById('viewer-prev');
    const nextBtn = document.getElementById('viewer-next');
    const imgData = viewerImages[viewerCurrentIdx];
    if (!imgData) return;
    img.src = imgData.src;
    filenameEl.textContent = '';
    filenameEl.style.display = 'none';
    descEl.textContent = imgData.description || '';
    idxEl.textContent = `${viewerCurrentIdx + 1} / ${viewerImages.length}`;
    if (prevBtn) prevBtn.style.display = viewerImages.length > 1 ? 'block' : 'none';
    if (nextBtn) nextBtn.style.display = viewerImages.length > 1 ? 'block' : 'none';
    const meta = document.getElementById('viewer-meta');
    if (meta) meta.classList.add('translate-y-full');
}

function viewerNavigate(delta) {
    if (!viewerImages.length) return;
    viewerCurrentIdx = (viewerCurrentIdx + delta + viewerImages.length) % viewerImages.length;
    _applyViewerImage();
}

function toggleViewerMeta() {
    const meta = document.getElementById('viewer-meta');
    if (!meta) return;
    meta.classList.toggle('translate-y-full');
}

function closeImageViewer() {
    const viewer = document.getElementById('image-viewer');
    if (!viewer) return;
    viewer.classList.add('opacity-0');
    const meta = document.getElementById('viewer-meta');
    if (meta) meta.classList.add('translate-y-full');
    document.removeEventListener('keydown', handleViewerKeyboard);
    setTimeout(() => { viewer.style.display = 'none'; }, 300);
}

function handleViewerBackdropClick(e) {
    if (e.target.id === 'image-viewer') closeImageViewer();
}

function handleViewerKeyboard(e) {
    if (e.key === 'Escape') { e.preventDefault(); closeImageViewer(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); viewerNavigate(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); viewerNavigate(1); }
    if (e.key.toLowerCase() === 'i') { e.preventDefault(); toggleViewerMeta(); }
}

// ─── PROFILE MODAL (simplified) ───
let currentProfileData = null;

async function openProfileModal() {
    const m = document.getElementById('profile-modal');
    if (!m || !currentUser) return;
    m.classList.remove('hidden');
    setTimeout(() => m.classList.remove('opacity-0'), 10);
    document.getElementById('profile-display-name').textContent = getUserDisplayName(currentUser);
    document.getElementById('profile-email').textContent = currentUser.email || '';
    document.getElementById('profile-name-input').value = currentUser.displayName || '';
    document.getElementById('profile-avatar-preview').src = currentUser.photoURL || '';
    try {
        const doc = await db.collection('userProfiles').doc(currentUser.uid).get();
        if (doc.exists) {
            currentProfileData = doc.data();
            document.getElementById('profile-bio-input').value = currentProfileData.bio || '';
            if (currentProfileData.avatarURL) {
                document.getElementById('profile-avatar-preview').src = currentProfileData.avatarURL;
            }
        } else {
            currentProfileData = {};
            document.getElementById('profile-bio-input').value = '';
        }
    } catch (e) {
        currentProfileData = {};
    }
}

function closeProfileModal() {
    const m = document.getElementById('profile-modal');
    if (!m) return;
    m.classList.add('opacity-0');
    setTimeout(() => m.classList.add('hidden'), 300);
}

async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file || !currentUser) return;
    if (!file.type.startsWith('image/')) { alert('Please upload an image.'); return; }
    const safeName = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const ref = storage.ref(`avatars/${currentUser.uid}/${safeName}`);
    try {
        await ref.put(file);
        const url = await ref.getDownloadURL();
        await db.collection('userProfiles').doc(currentUser.uid).set({ avatarURL: url }, { merge: true });
        await currentUser.updateProfile({ photoURL: url });
        document.getElementById('profile-avatar-preview').src = url;
    } catch (e) {
        alert('Avatar upload failed: ' + e.message);
    }
}

async function saveProfileInfo() {
    if (!currentUser) return;
    const displayName = document.getElementById('profile-name-input').value.trim();
    const bio = document.getElementById('profile-bio-input').value.trim();
    const updates = {};
    if (displayName) updates.displayName = displayName;
    if (bio) updates.bio = bio;
    try {
        await db.collection('userProfiles').doc(currentUser.uid).set(updates, { merge: true });
        if (displayName) await currentUser.updateProfile({ displayName });
        currentProfileData = { ...currentProfileData, ...updates };
        document.getElementById('profile-display-name').textContent = displayName || getUserDisplayName(currentUser);
        renderNavAuth();
        renderMobileAuth();
    } catch (e) {
        alert('Failed to save profile: ' + e.message);
    }
}

// ─── UTILS ───
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ─── INIT ───
window.addEventListener('DOMContentLoaded', () => {
    renderNavAuth();
    renderMobileAuth();
    renderAdminToolbar();
    loadGallery();
});
