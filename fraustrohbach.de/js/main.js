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
let allAlbums = [];
let currentAlbumId = null;
let albumsLoaded = false;

// ─── AUTH LISTENER ───
auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    renderAdminUI();
    renderNavAuth();
    renderMobileAuth();
    if (allAlbums.length > 0) renderAlbumGrid(); // re-render so admin visibility changes apply
    const adminModal = document.getElementById('gallery-admin-modal');
    if (adminModal && adminModal.style.display === 'flex') renderAdminAlbumsList();
});

// ─── ADMIN AUTH ───
function isAdmin() {
    if (sessionStorage.getItem('exinia_auth_session') === 'true') return true;
    // Fallback: check Firebase user email in case sessionStorage was wiped
    const user = auth.currentUser;
    if (!user || !user.email) return false;
    const email = user.email.toLowerCase();
    return email === 'exinia@fraustrohbach.de' || email === 'katadvaya@fraustrohbach.de';
}

function renderAdminUI() {
    const btn = document.getElementById('gallery-admin-btn');
    if (btn) btn.classList.toggle('hidden', !isAdmin());
}

// Admin login — hardcoded credentials, Firebase v10 safe
async function handleAdminLogin(nickname, password) {
    const lowerNick = nickname.toLowerCase();
    if (lowerNick !== 'exinia' && lowerNick !== 'katadvaya') {
        return { success: false, message: 'Invalid credentials.' };
    }
    const validPasswords = ['temporal-void-2026', 'nebula-void-2026'];
    if (!validPasswords.includes(password)) {
        return { success: false, message: 'Invalid credentials.' };
    }
    const adminEmail = lowerNick === 'exinia'
        ? 'exinia@fraustrohbach.de'
        : 'katadvaya@fraustrohbach.de';
    try {
        await auth.signInWithEmailAndPassword(adminEmail, password);
    } catch (e) {
        if (e.code === 'auth/invalid-credential') {
            try {
                await auth.createUserWithEmailAndPassword(adminEmail, password);
                await auth.currentUser.updateProfile({ displayName: lowerNick });
            } catch (createErr) {
                if (createErr.code === 'auth/email-already-in-use') {
                    return { success: false, message: 'Invalid credentials.' };
                }
                return { success: false, message: 'Firebase auth error: ' + createErr.message };
            }
        } else {
            return { success: false, message: 'Firebase auth error: ' + e.message };
        }
    }
    sessionStorage.setItem('exinia_auth_session', 'true');
    renderAdminUI();
    return { success: true, message: 'Operator session granted.' };
}

async function handleAdminLogout() {
    sessionStorage.removeItem('exinia_auth_session');
    await auth.signOut();
    renderAdminUI();
    renderNavAuth();
    renderMobileAuth();
}

// ─── NAV & MOBILE AUTH RENDERING ───
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

// Mobile menu toggle
const mobileBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
if (mobileBtn && mobileMenu) {
    mobileBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });
}

// ─── PROFILE MODAL ───
let currentProfileData = null;

async function openProfileModal() {
    const m = document.getElementById('profile-modal');
    if (!m || !currentUser) return;
    m.classList.remove('hidden');
    setTimeout(() => m.classList.remove('opacity-0'), 10);
    await loadProfileData();
}

function closeProfileModal() {
    const m = document.getElementById('profile-modal');
    if (!m) return;
    m.classList.add('opacity-0');
    setTimeout(() => m.classList.add('hidden'), 300);
}

async function loadProfileData() {
    if (!currentUser) return;
    document.getElementById('profile-display-name').textContent = getUserDisplayName(currentUser);
    document.getElementById('profile-email').textContent = currentUser.email || '';
    document.getElementById('profile-name-input').value = currentUser.displayName || '';
    document.getElementById('profile-avatar-preview').src = currentUser.photoURL || '';

    try {
        const doc = await db.collection('userProfiles').doc(currentUser.uid).get();
        if (doc.exists) {
            currentProfileData = doc.data();
            document.getElementById('profile-bio-input').value = currentProfileData.bio || '';
            document.getElementById('profile-nickname-input').value = currentProfileData.nickname || '';
            if (currentProfileData.avatarURL) {
                document.getElementById('profile-avatar-preview').src = currentProfileData.avatarURL;
            }
        } else {
            currentProfileData = {};
            document.getElementById('profile-bio-input').value = '';
            document.getElementById('profile-nickname-input').value = '';
        }
    } catch (e) {
        console.error('Failed to load profile', e);
        currentProfileData = {};
    }
}

async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file || !currentUser) { console.warn('Avatar upload: no file or not logged in'); return; }
    if (!file.type.startsWith('image/')) { alert('Please upload an image.'); return; }
    const safeName = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const ref = storage.ref(`avatars/${currentUser.uid}/${safeName}`);
    try {
        await ref.put(file);
        const url = await ref.getDownloadURL();
        await db.collection('userProfiles').doc(currentUser.uid).set({ avatarURL: url }, { merge: true });
        await currentUser.updateProfile({ photoURL: url });
        document.getElementById('profile-avatar-preview').src = url;
        console.log('Avatar uploaded:', url);
    } catch (e) {
        console.error('Avatar upload failed:', e);
        alert('Avatar upload failed: ' + e.message);
    }
}

async function saveProfileInfo() {
    if (!currentUser) return;
    const displayName = document.getElementById('profile-name-input').value.trim();
    const bio = document.getElementById('profile-bio-input').value.trim();
    const nickname = document.getElementById('profile-nickname-input').value.trim();
    const updates = {};
    if (displayName) updates.displayName = displayName;
    if (bio) updates.bio = bio;

    // Nickname change handling
    const currentNick = currentProfileData && currentProfileData.nickname;
    if (nickname && nickname !== currentNick) {
        const nickStatus = document.getElementById('nickname-status');
        try {
            const existing = await db.collection('nicknames').doc(nickname.toLowerCase()).get();
            if (existing.exists && existing.data().uid !== currentUser.uid) {
                nickStatus.textContent = 'Callsign already taken.';
                nickStatus.className = 'text-xs font-mono mt-1 text-neon-magenta';
                nickStatus.classList.remove('hidden');
                return;
            }
            // Delete old nickname mapping if exists
            if (currentNick) {
                await db.collection('nicknames').doc(currentNick.toLowerCase()).delete();
            }
            // Create new mapping
            await db.collection('nicknames').doc(nickname.toLowerCase()).set({
                email: currentUser.email,
                uid: currentUser.uid
            });
            updates.nickname = nickname;
        } catch (e) {
            nickStatus.textContent = 'Nickname update failed: ' + e.message;
            nickStatus.className = 'text-xs font-mono mt-1 text-neon-magenta';
            nickStatus.classList.remove('hidden');
            return;
        }
    }

    try {
        await db.collection('userProfiles').doc(currentUser.uid).set(updates, { merge: true });
        if (displayName) await currentUser.updateProfile({ displayName });
        currentProfileData = { ...currentProfileData, ...updates };
        document.getElementById('profile-display-name').textContent = displayName || getUserDisplayName(currentUser);
        const status = document.getElementById('nickname-status');
        status.textContent = 'Profile saved.';
        status.className = 'text-xs font-mono mt-1 text-neon-lime';
        status.classList.remove('hidden');
        renderNavAuth();
        renderMobileAuth();
    } catch (e) {
        alert('Failed to save profile: ' + e.message);
    }
}

async function checkNicknameAvailability() {
    const input = document.getElementById('profile-nickname-input');
    const status = document.getElementById('nickname-status');
    const nick = input.value.trim().toLowerCase();
    if (!nick) { status.classList.add('hidden'); return; }
    try {
        const doc = await db.collection('nicknames').doc(nick).get();
        if (doc.exists && doc.data().uid !== currentUser.uid) {
            status.textContent = 'Unavailable';
            status.className = 'text-xs font-mono mt-1 text-neon-magenta';
        } else {
            status.textContent = 'Available';
            status.className = 'text-xs font-mono mt-1 text-neon-lime';
        }
        status.classList.remove('hidden');
    } catch (e) {
        status.textContent = 'Error checking';
        status.className = 'text-xs font-mono mt-1 text-neon-magenta';
        status.classList.remove('hidden');
    }
}

async function changePassword() {
    const oldPw = document.getElementById('profile-old-password').value;
    const newPw = document.getElementById('profile-new-password').value;
    const confirmPw = document.getElementById('profile-confirm-password').value;
    const status = document.getElementById('password-status');

    if (!oldPw || !newPw || !confirmPw) {
        status.textContent = 'All password fields are required.';
        status.className = 'text-xs font-mono mt-2 text-center text-neon-magenta';
        status.classList.remove('hidden');
        return;
    }
    if (newPw.length < 6) {
        status.textContent = 'New password must be at least 6 characters.';
        status.className = 'text-xs font-mono mt-2 text-center text-neon-magenta';
        status.classList.remove('hidden');
        return;
    }
    if (newPw !== confirmPw) {
        status.textContent = 'New passwords do not match.';
        status.className = 'text-xs font-mono mt-2 text-center text-neon-magenta';
        status.classList.remove('hidden');
        return;
    }

    try {
        const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, oldPw);
        await currentUser.reauthenticateWithCredential(credential);
        await currentUser.updatePassword(newPw);
        status.textContent = 'Password updated successfully.';
        status.className = 'text-xs font-mono mt-2 text-center text-neon-lime';
        status.classList.remove('hidden');
        document.getElementById('profile-old-password').value = '';
        document.getElementById('profile-new-password').value = '';
        document.getElementById('profile-confirm-password').value = '';
    } catch (e) {
        status.textContent = e.code === 'auth/wrong-password' ? 'Current password is incorrect.' : 'Failed: ' + e.message;
        status.className = 'text-xs font-mono mt-2 text-center text-neon-magenta';
        status.classList.remove('hidden');
    }
}

// ─── GALLERY PREVIEW (homepage teaser) ───
const imageExtensions = ['.JPG', '.jpeg', '.jpg', '.JPEG'];
const imageFolder = 'imagesTimeMashine/';
const totalImages = 87;
let previewInterval;

function getRandomImageIndex() {
    return Math.floor(Math.random() * totalImages) + 1;
}

function findImageSrc(index, callback, failure) {
    const tryExtension = (extIndex) => {
        if (extIndex >= imageExtensions.length) { failure(); return; }
        const ext = imageExtensions[extIndex];
        const candidate = `${imageFolder}image${index}${ext}`;
        const testImg = new Image();
        testImg.onload = () => callback(candidate);
        testImg.onerror = () => tryExtension(extIndex + 1);
        testImg.src = candidate;
    };
    tryExtension(0);
}

let galleryImagesCache = null;
loadLegacyImagesFromJson().then(data => { if (data) galleryImagesCache = data; });

function updateGalleryPreviews() {
    const preview1 = document.getElementById('gallery-preview-1');
    const preview2 = document.getElementById('gallery-preview-2');
    if (!preview1 || !preview2) return;
    if (galleryImagesCache && galleryImagesCache.images.length > 0) {
        const imgs = galleryImagesCache.images;
        const r1 = imgs[Math.floor(Math.random() * imgs.length)].src;
        const r2 = imgs[Math.floor(Math.random() * imgs.length)].src;
        preview1.src = r1;
        preview2.src = r2;
        return;
    }
    // fallback while cache loads
    findImageSrc(getRandomImageIndex(), (src) => { preview1.src = src; }, () => updateGalleryPreviews());
    findImageSrc(getRandomImageIndex(), (src) => { preview2.src = src; }, () => updateGalleryPreviews());
}

// ─── ALBUM LOGIC ───
async function loadLegacyImagesFromJson() {
    try {
        const res = await fetch('gallery-images.json');
        if (!res.ok) return null;
        const data = await res.json();
        if (data && Array.isArray(data.images) && data.images.length > 0) return data;
    } catch (e) {
        console.warn('gallery-images.json not available, falling back to image probe', e);
    }
    return null;
}

async function loadAlbums() {
    try {
        const snapshot = await db.collection('galleryAlbums').orderBy('order', 'asc').get();
        if (!snapshot.empty) {
            allAlbums = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const legacyIdx = allAlbums.findIndex(a => a.id === 'legacy-archive');
            if (legacyIdx === -1) {
                // legacy-archive missing from Firestore — create it
                const jsonData = await loadLegacyImagesFromJson();
                const legacyImages = jsonData ? jsonData.images : [];
                if (!jsonData) {
                    for (let i = 1; i <= totalImages; i++) {
                        const src = await new Promise(resolve => findImageSrc(i, resolve, () => resolve(null)));
                        if (src) legacyImages.push({ src, filename: `image${i}`, order: i });
                    }
                }
                const cover = legacyImages.length > 0 ? legacyImages[0].src : '';
                const legacyPayload = {
                    name: 'Legacy Archive',
                    coverImage: cover,
                    images: legacyImages,
                    order: 0,
                    isPublic: true,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    createdBy: 'system'
                };
                try {
                    await db.collection('galleryAlbums').doc('legacy-archive').set(legacyPayload);
                    allAlbums.push({ id: 'legacy-archive', ...legacyPayload, createdAt: new Date().toISOString() });
                } catch (err) {
                    allAlbums.push({ id: 'legacy-archive', ...legacyPayload, createdAt: new Date().toISOString() });
                }
            } else if (!allAlbums[legacyIdx].images || allAlbums[legacyIdx].images.length === 0) {
                // Repair existing empty legacy-archive
                const jsonData = await loadLegacyImagesFromJson();
                const legacyImages = jsonData ? jsonData.images : [];
                if (!jsonData) {
                    for (let i = 1; i <= totalImages; i++) {
                        const src = await new Promise(resolve => findImageSrc(i, resolve, () => resolve(null)));
                        if (src) legacyImages.push({ src, filename: `image${i}`, order: i });
                    }
                }
                if (legacyImages.length > 0) {
                    const cover = legacyImages[0].src;
                    const update = { images: legacyImages, coverImage: cover };
                    try {
                        await db.collection('galleryAlbums').doc('legacy-archive').update(update);
                        allAlbums[legacyIdx] = { ...allAlbums[legacyIdx], ...update };
                    } catch (err) {
                        console.warn('Failed to persist repaired legacy-archive', err);
                        allAlbums[legacyIdx] = { ...allAlbums[legacyIdx], ...update };
                    }
                }
            }
            renderAlbumGrid();
            return;
        }
    } catch (e) {
        console.warn('Firestore albums load failed, using legacy', e);
    }
    // No albums in Firestore yet — create Legacy Archive as a real document
    const jsonData = await loadLegacyImagesFromJson();
    const legacyImages = jsonData ? jsonData.images : [];
    if (!jsonData) {
        // fallback: slow probe
        for (let i = 1; i <= totalImages; i++) {
            const src = await new Promise(resolve => findImageSrc(i, resolve, () => resolve(null)));
            if (src) legacyImages.push({ src, filename: `image${i}`, order: i });
        }
    }
    const cover = legacyImages.length > 0 ? legacyImages[0].src : '';
    const legacyPayload = {
        name: 'Legacy Archive',
        coverImage: cover,
        images: legacyImages,
        order: 0,
        isPublic: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: 'system'
    };
    try {
        const ref = db.collection('galleryAlbums').doc('legacy-archive');
        await ref.set(legacyPayload);
        allAlbums = [{ id: 'legacy-archive', ...legacyPayload, createdAt: new Date().toISOString() }];
    } catch (e) {
        // Firestore unreachable — keep in-memory only (uploads won't persist)
        allAlbums = [{
            id: 'legacy-archive',
            name: 'Legacy Archive',
            coverImage: cover,
            images: legacyImages,
            order: 0,
            isPublic: true,
            createdAt: new Date().toISOString()
        }];
    }
    renderAlbumGrid();
}

function renderAlbumGrid() {
    const grid = document.getElementById('albums-grid');
    if (!grid) return;
    const visibleAlbums = isAdmin() ? allAlbums : allAlbums.filter(a => a.isPublic !== false);
    if (visibleAlbums.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-24"><i class="ph ph-aperture text-5xl text-slate-700 mb-4"></i><p class="text-slate-500 font-mono text-sm uppercase tracking-widest">No albums found.</p></div>`;
        return;
    }
    grid.innerHTML = visibleAlbums.map(album => {
        const cover = album.coverImage || (album.images && album.images[0] ? album.images[0].src : '');
        const count = album.images ? album.images.length : 0;
        const isPublic = album.isPublic !== false;
        const privacyBadge = isAdmin() && !isPublic
            ? `<span class="absolute top-2 left-2 bg-red-500/80 text-white text-[9px] font-mono uppercase px-1.5 py-0.5 rounded">Private</span>`
            : '';
        return `
        <div onclick="openAlbum('${album.id}')" class="group cursor-pointer bg-slate-900 border border-slate-800 hover:border-neon-cyan/50 transition-colors overflow-hidden rounded-sm">
            <div class="aspect-[4/3] overflow-hidden relative">
                ${privacyBadge}
                ${cover ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(album.name)}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105">` : `<div class="w-full h-full flex items-center justify-center text-slate-700 font-mono text-xs">NO_VISUAL_DATA</div>`}
                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <span class="text-white text-xs font-mono uppercase tracking-widest border border-white/30 px-3 py-1 rounded">Open</span>
                </div>
            </div>
            <div class="p-4">
                <h3 class="text-white font-display font-bold text-lg mb-1 truncate">${escapeHtml(album.name || 'Untitled')}</h3>
                <p class="text-slate-500 text-xs font-mono uppercase tracking-wider">${count} capture${count !== 1 ? 's' : ''}</p>
            </div>
        </div>`;
    }).join('');
}

function openAlbum(albumId) {
    currentAlbumId = albumId;
    const album = allAlbums.find(a => a.id === albumId);
    if (!album) return;

    document.getElementById('gallery-header-title').textContent = album.name || 'Album';
    document.getElementById('album-grid-view').classList.add('hidden');
    document.getElementById('album-detail-view').classList.remove('hidden');

    const backBtn = document.getElementById('gallery-back-btn');
    backBtn.classList.remove('hidden');
    document.getElementById('gallery-back-icon').className = 'ph ph-arrow-left text-xl';
    document.getElementById('gallery-back-label').textContent = 'Back';
    renderAdminUI();

    const meta = document.getElementById('album-detail-meta');
    meta.innerHTML = `
        <div class="flex items-center gap-3 mb-4">
            <h2 class="text-2xl md:text-3xl font-display font-bold text-white glow-text">${escapeHtml(album.name || 'Untitled')}</h2>
            <span class="text-slate-500 text-xs font-mono uppercase tracking-wider">${album.images ? album.images.length : 0} captures</span>
        </div>
    `;

    const grid = document.getElementById('album-images-grid');
    const images = (album.images || []).sort((a, b) => (a.order || 0) - (b.order || 0));
    if (images.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-16 text-slate-600 font-mono text-sm">No images in this album.</div>`;
    } else {
        grid.innerHTML = images.map((img, idx) => `
            <div onclick="openImageViewer(${idx})" class="group relative aspect-video bg-slate-900 overflow-hidden border border-slate-800 hover:border-neon-cyan/50 transition-colors cursor-pointer">
                <img src="${escapeHtml(img.src)}" alt="" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" onerror="this.parentElement.innerHTML='<div class=\\'absolute inset-0 flex items-center justify-center text-slate-600 italic text-xs\\'>Not found</div>'">
            </div>
        `).join('');
    }
}

function showAlbumGrid() {
    currentAlbumId = null;
    document.getElementById('gallery-header-title').textContent = 'VISUAL ARCHIVE';
    document.getElementById('album-grid-view').classList.remove('hidden');
    document.getElementById('album-detail-view').classList.add('hidden');
    const backBtn = document.getElementById('gallery-back-btn');
    backBtn.classList.add('hidden');
    renderAdminUI();
}

function showLegacyView() {
    currentAlbumId = 'legacy-archive';
    const album = allAlbums.find(a => a.id === 'legacy-archive');
    if (!album) {
        // fallback: show album grid until albums load
        showAlbumGrid();
        return;
    }

    document.getElementById('gallery-header-title').textContent = 'VISUAL ARCHIVE';
    document.getElementById('album-grid-view').classList.add('hidden');
    document.getElementById('album-detail-view').classList.remove('hidden');

    const backBtn = document.getElementById('gallery-back-btn');
    backBtn.classList.remove('hidden');
    document.getElementById('gallery-back-icon').className = 'ph ph-squares-four text-xl';
    document.getElementById('gallery-back-label').textContent = 'Albums';
    renderAdminUI();

    // Hide album meta block for legacy flat view
    const meta = document.getElementById('album-detail-meta');
    meta.innerHTML = '';

    const grid = document.getElementById('album-images-grid');
    const images = (album.images || []).sort((a, b) => (a.order || 0) - (b.order || 0));

    // Admin upload strip in legacy flat view
    const adminUpload = isAdmin() ? `
        <div class="col-span-full mb-4">
            <div id="legacy-dropzone" class="border-2 border-dashed border-slate-700 bg-slate-900/20 rounded-lg p-6 text-center transition-colors hover:border-neon-cyan/50 hover:bg-slate-900/40"
                 ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleLegacyDrop(event)">
                <i class="ph ph-upload-simple text-3xl text-slate-600 mb-2 block"></i>
                <p class="text-slate-400 text-sm font-mono uppercase tracking-widest">Drop photos here to add to gallery</p>
                <input type="file" id="legacy-file-input" multiple accept="image/*" class="hidden" onchange="handleLegacyFileSelect(event)">
                <div class="flex items-center justify-center gap-4 mt-3">
                    <button onclick="document.getElementById('legacy-file-input').click()" class="text-neon-cyan text-xs uppercase tracking-widest hover:underline">browse files</button>
                    <span class="text-slate-600 text-xs">|</span>
                    <button onclick="openAlbumEdit('legacy-archive')" class="text-neon-magenta text-xs uppercase tracking-widest hover:underline">open manager</button>
                </div>
            </div>
        </div>
    ` : '';

    if (images.length === 0) {
        grid.innerHTML = adminUpload + `<div class="col-span-full text-center py-16 text-slate-600 font-mono text-sm">No captures found.</div>`;
    } else {
        grid.innerHTML = adminUpload + images.map((img, idx) => `
            <div onclick="openImageViewer(${idx})" class="group relative aspect-video bg-slate-900 overflow-hidden border border-slate-800 hover:border-neon-cyan/50 transition-colors cursor-pointer">
                <img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.filename || '')}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" onerror="this.parentElement.innerHTML='<div class=\'absolute inset-0 flex items-center justify-center text-slate-600 italic text-xs\'>Not found</div>'">
            </div>
        `).join('');
    }
}

// ─── LEGACY DIRECT UPLOAD HELPERS ───
function handleLegacyDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('border-neon-cyan', 'bg-slate-900/60');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length) uploadToLegacy(files);
}

function handleLegacyFileSelect(e) {
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
    if (files.length) uploadToLegacy(files);
    e.target.value = '';
}

async function uploadToLegacy(files) {
    editingAlbumId = 'legacy-archive';
    const album = allAlbums.find(a => a.id === 'legacy-archive');
    if (!album) { editingAlbumId = null; return; }

    const uploaded = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const safeName = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const ref = storage.ref(`gallery/legacy-archive/${safeName}`);
        try {
            await ref.put(file);
            const url = await ref.getDownloadURL();
            uploaded.push({
                src: url,
                filename: file.name,
                order: (album.images ? album.images.length : 0) + i,
                createdBy: currentUser ? currentUser.uid : 'admin',
                createdByName: currentUser ? getUserDisplayName(currentUser) : 'Admin',
                createdByAvatar: currentUser ? (currentUser.photoURL || '') : ''
            });
        } catch (err) {
            console.error('Upload failed', err);
        }
    }

    if (uploaded.length) {
        const newImages = [...(album.images || []), ...uploaded];
        try {
            await db.collection('galleryAlbums').doc('legacy-archive').update({ images: newImages });
            album.images = newImages;
            if (!album.coverImage && uploaded[0]) {
                album.coverImage = uploaded[0].src;
                await db.collection('galleryAlbums').doc('legacy-archive').update({ coverImage: uploaded[0].src });
            }
            showLegacyView();
            renderAlbumGrid();
        } catch (e) {
            alert('Failed to save uploaded images: ' + e.message);
        }
    }
    editingAlbumId = null;
}

// ─── GALLERY MODAL ───
const modal = document.getElementById('gallery-modal');
let galleryKeyboardActive = false;
let scrollListenerAttached = false;

function openGallery() {
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.remove('opacity-0'), 10);
    document.body.style.overflow = 'hidden';

    const scrollContainers = [document.getElementById('album-grid-view'), document.getElementById('album-detail-view')];
    scrollContainers.forEach(c => {
        if (c && !c.dataset.scrollAttached) {
            c.addEventListener('scroll', handleGalleryScroll);
            c.dataset.scrollAttached = 'true';
        }
    });
    if (!galleryKeyboardActive) {
        galleryKeyboardActive = true;
        document.addEventListener('keydown', handleGalleryKeyboard);
    }
    if (!albumsLoaded) {
        loadAlbums().then(() => {
            albumsLoaded = true;
            showLegacyView();
            // Refresh admin panel if it was opened before albums finished loading
            const adminModal = document.getElementById('gallery-admin-modal');
            if (adminModal && adminModal.style.display === 'flex') {
                renderAdminAlbumsList();
            }
        });
    } else {
        showLegacyView();
    }
}

function handleGalleryKeyboard(e) {
    if (modal.style.display === 'none') {
        document.removeEventListener('keydown', handleGalleryKeyboard);
        galleryKeyboardActive = false;
        return;
    }
    if (isImageViewerOpen()) {
        if (e.key === 'Escape') { e.preventDefault(); closeImageViewer(); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); viewerNavigate(-1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); viewerNavigate(1); }
        if (e.key.toLowerCase() === 'i') { e.preventDefault(); toggleViewerMeta(); }
        return;
    }
    if (e.key === 'Escape') {
        if (currentAlbumId && currentAlbumId !== 'legacy-archive') showAlbumGrid();
        else closeGallery();
    }
}

function closeGallery() {
    modal.classList.add('opacity-0');
    document.removeEventListener('keydown', handleGalleryKeyboard);
    galleryKeyboardActive = false;
    setTimeout(() => {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        const scrollBtn = document.getElementById('scroll-to-top-btn');
        if (scrollBtn) { scrollBtn.style.display = 'none'; scrollBtn.classList.add('opacity-0'); }
    }, 500);
}

function scrollGalleryToTop() {
    const c = [document.getElementById('album-grid-view'), document.getElementById('album-detail-view')]
        .find(el => el && !el.classList.contains('hidden'));
    if (c) c.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleGalleryScroll() {
    const containers = [document.getElementById('album-grid-view'), document.getElementById('album-detail-view')];
    const scrollBtn = document.getElementById('scroll-to-top-btn');
    if (!scrollBtn) return;
    const scrollTop = containers.find(c => c && !c.classList.contains('hidden'))?.scrollTop || 0;
    if (scrollTop > 300) {
        scrollBtn.style.display = 'block';
        setTimeout(() => scrollBtn.classList.remove('opacity-0'), 10);
        scrollBtn.classList.remove('pointer-events-none');
    } else {
        scrollBtn.classList.add('opacity-0');
        setTimeout(() => {
            if ((containers.find(c => c && !c.classList.contains('hidden'))?.scrollTop || 0) <= 300) {
                scrollBtn.classList.add('pointer-events-none');
                scrollBtn.style.display = 'none';
            }
        }, 300);
    }
}

// Fullscreen image viewer (index-based, with metadata + navigation)
let viewerCurrentIdx = 0;
let viewerImages = [];

function openImageViewer(idx) {
    const album = allAlbums.find(a => a.id === currentAlbumId);
    if (!album) return;
    viewerImages = (album.images || []).sort((a, b) => (a.order || 0) - (b.order || 0));
    if (!viewerImages.length) return;
    viewerCurrentIdx = Math.max(0, Math.min(idx, viewerImages.length - 1));
    _applyViewerImage();
    const viewer = document.getElementById('image-viewer');
    viewer.style.display = 'flex';
    setTimeout(() => viewer.classList.remove('opacity-0'), 10);
}

function _applyViewerImage() {
    const img = document.getElementById('image-viewer-img');
    const meta = document.getElementById('viewer-meta');
    const prevBtn = document.getElementById('viewer-prev');
    const nextBtn = document.getElementById('viewer-next');
    const imgData = viewerImages[viewerCurrentIdx];
    if (!imgData) return;
    img.src = imgData.src;
    const album = allAlbums.find(a => a.id === currentAlbumId);
    document.getElementById('viewer-description').textContent = imgData.description || '';
    document.getElementById('viewer-index').textContent = `${viewerCurrentIdx + 1} / ${viewerImages.length}`;

    // Author info
    const authorNameEl = document.getElementById('viewer-author-name');
    const authorAvatarEl = document.getElementById('viewer-author-avatar');
    const authorContainer = document.getElementById('viewer-author');
    const authorName = imgData.createdByName || (album && album.createdByName) || 'Exinia';
    const authorAvatar = imgData.createdByAvatar || (album && album.createdByAvatar) || '';
    if (authorNameEl) authorNameEl.textContent = authorName;
    if (authorAvatarEl) {
        if (authorAvatar) {
            authorAvatarEl.src = authorAvatar;
            authorAvatarEl.classList.remove('hidden');
        } else {
            authorAvatarEl.classList.add('hidden');
        }
    }

    if (prevBtn) prevBtn.style.display = viewerImages.length > 1 ? 'block' : 'none';
    if (nextBtn) nextBtn.style.display = viewerImages.length > 1 ? 'block' : 'none';
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
    setTimeout(() => { viewer.style.display = 'none'; }, 300);
}

function handleViewerBackdropClick(e) {
    if (e.target.id === 'image-viewer') closeImageViewer();
}

function isImageViewerOpen() {
    const viewer = document.getElementById('image-viewer');
    return viewer && viewer.style.display !== 'none';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ─── ADMIN PANEL ───
function openGalleryAdmin() {
    const m = document.getElementById('gallery-admin-modal');
    m.style.display = 'flex';
    setTimeout(() => m.classList.remove('opacity-0'), 10);
    renderAdminAlbumsList();
}

function closeGalleryAdmin() {
    const m = document.getElementById('gallery-admin-modal');
    m.classList.add('opacity-0');
    setTimeout(() => m.style.display = 'none', 300);
}

function renderAdminAlbumsList() {
    const container = document.getElementById('admin-albums-list');
    if (!container) return;
    if (allAlbums.length === 0) {
        if (!albumsLoaded) {
            container.innerHTML = '<p class="text-slate-500 text-sm font-mono animate-pulse">Loading albums...</p>';
        } else {
            container.innerHTML = '<p class="text-slate-600 text-sm font-mono">No albums yet.</p>';
        }
        return;
    }
    container.innerHTML = allAlbums.map(album => {
        const isPublic = album.isPublic !== false;
        return `
        <div class="border border-slate-800 bg-slate-900/40 p-5 rounded flex items-center justify-between">
            <div class="flex items-center gap-4">
                <div class="w-16 h-12 bg-slate-800 overflow-hidden rounded">
                    ${album.coverImage ? `<img src="${escapeHtml(album.coverImage)}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center text-slate-600 text-xs">—</div>`}
                </div>
                <div>
                    <h4 class="text-white font-display font-bold text-sm">${escapeHtml(album.name || 'Untitled')}</h4>
                    <p class="text-slate-500 text-xs font-mono">${album.images ? album.images.length : 0} images</p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="toggleAlbumPrivacy('${album.id}')" class="admin-btn ${isPublic ? '' : 'danger'}">
                    <i class="ph ${isPublic ? 'ph-eye' : 'ph-eye-slash'}"></i> ${isPublic ? 'Public' : 'Private'}
                </button>
                <button onclick="openAlbumEdit('${album.id}')" class="admin-btn">
                    <i class="ph ph-pencil-simple"></i> Edit
                </button>
            </div>
        </div>`;
    }).join('');
}

async function createAlbum() {
    const nameInput = document.getElementById('new-album-name');
    const name = nameInput.value.trim();
    if (!name) { alert('Album name required.'); return; }
    const maxOrder = allAlbums.length > 0 ? Math.max(...allAlbums.map(a => a.order || 0)) : -1;
    const newDoc = db.collection('galleryAlbums').doc();
    const albumData = {
        id: newDoc.id,
        name,
        coverImage: '',
        images: [],
        order: maxOrder + 1,
        isPublic: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: auth.currentUser ? auth.currentUser.uid : 'admin'
    };
    try {
        await newDoc.set(albumData);
        allAlbums.push({ ...albumData, id: newDoc.id });
        nameInput.value = '';
        renderAdminAlbumsList();
        renderAlbumGrid();
    } catch (e) {
        alert('Failed to create album: ' + e.message);
    }
}

async function toggleAlbumPrivacy(albumId) {
    const album = allAlbums.find(a => a.id === albumId);
    if (!album) return;
    const newValue = album.isPublic === false ? true : false;
    try {
        await db.collection('galleryAlbums').doc(albumId).update({ isPublic: newValue });
        album.isPublic = newValue;
        renderAdminAlbumsList();
        renderAlbumGrid();
    } catch (e) {
        alert('Failed to update privacy: ' + e.message);
    }
}

// ─── ALBUM EDIT (upload, cover, rename, delete) ───
let editingAlbumId = null;

function openAlbumEdit(albumId) {
    editingAlbumId = albumId;
    const album = allAlbums.find(a => a.id === albumId);
    if (!album) return;
    document.getElementById('edit-album-title').textContent = album.name || 'Edit Album';
    document.getElementById('edit-album-name').value = album.name || '';
    renderEditAlbumImages(album);
    const m = document.getElementById('album-edit-modal');
    m.style.display = 'flex';
    setTimeout(() => m.classList.remove('opacity-0'), 10);
}

function closeAlbumEdit() {
    const m = document.getElementById('album-edit-modal');
    m.classList.add('opacity-0');
    setTimeout(() => m.style.display = 'none', 300);
    editingAlbumId = null;
    document.getElementById('upload-progress-area').classList.add('hidden');
}

async function saveAlbumName() {
    if (!editingAlbumId) return;
    const name = document.getElementById('edit-album-name').value.trim();
    if (!name) return;
    try {
        await db.collection('galleryAlbums').doc(editingAlbumId).update({ name });
        const album = allAlbums.find(a => a.id === editingAlbumId);
        if (album) album.name = name;
        document.getElementById('edit-album-title').textContent = name;
        renderAdminAlbumsList();
        renderAlbumGrid();
    } catch (e) {
        alert('Failed to rename: ' + e.message);
    }
}

async function setAlbumCover(imageIdx) {
    if (!editingAlbumId) return;
    const album = allAlbums.find(a => a.id === editingAlbumId);
    if (!album || !album.images || imageIdx < 0 || imageIdx >= album.images.length) return;
    const imageSrc = album.images[imageIdx].src;
    try {
        await db.collection('galleryAlbums').doc(editingAlbumId).update({ coverImage: imageSrc });
        album.coverImage = imageSrc;
        renderAdminAlbumsList();
        renderAlbumGrid();
        renderEditAlbumImages(album);
    } catch (e) {
        alert('Failed to set cover: ' + e.message);
    }
}

async function deleteAlbumImage(imageIdx) {
    console.log('deleteAlbumImage called', { imageIdx, editingAlbumId });
    if (!editingAlbumId) { console.warn('No editingAlbumId'); return; }
    if (!confirm('Remove this image from the album?')) return;
    const album = allAlbums.find(a => a.id === editingAlbumId);
    if (!album) { console.warn('Album not found'); return; }
    const newImages = [...(album.images || [])];
    console.log('Before splice:', newImages.length, 'images');
    if (imageIdx >= 0 && imageIdx < newImages.length) {
        newImages.splice(imageIdx, 1);
        console.log('Spliced at index', imageIdx, 'remaining:', newImages.length);
    } else {
        console.warn('Invalid imageIdx', imageIdx, 'length', newImages.length);
    }
    try {
        await db.collection('galleryAlbums').doc(editingAlbumId).update({ images: newImages });
        album.images = newImages;
        renderEditAlbumImages(album);
        renderAdminAlbumsList();
        renderAlbumGrid();
        console.log('Image deleted successfully');
    } catch (e) {
        console.error('Failed to remove image:', e);
        alert('Failed to remove image: ' + e.message);
    }
}

async function deleteCurrentAlbum() {
    if (!editingAlbumId) return;
    const album = allAlbums.find(a => a.id === editingAlbumId);
    if (!confirm(`Permanently delete album "${album?.name || ''}"? This cannot be undone.`)) return;
    try {
        await db.collection('galleryAlbums').doc(editingAlbumId).delete();
        allAlbums = allAlbums.filter(a => a.id !== editingAlbumId);
        closeAlbumEdit();
        renderAdminAlbumsList();
        renderAlbumGrid();
    } catch (e) {
        alert('Failed to delete album: ' + e.message);
    }
}

function renderEditAlbumImages(album) {
    const container = document.getElementById('edit-album-images');
    const images = (album.images || []).sort((a, b) => (a.order || 0) - (b.order || 0));
    if (images.length === 0) {
        container.innerHTML = '<p class="text-slate-600 text-sm font-mono col-span-full">No images yet. Drop files above to upload.</p>';
        return;
    }
    container.innerHTML = images.map((img, idx) => {
        const isCover = album.coverImage === img.src;
        return `
        <div class="relative group bg-slate-900 border ${isCover ? 'border-neon-cyan' : 'border-slate-800'} overflow-hidden rounded">
            <div onclick="setAlbumCover(${idx})" class="cursor-pointer">
                <img src="${escapeHtml(img.src)}" class="w-full aspect-video object-cover" onerror="this.parentElement.innerHTML='<div class=\\'aspect-video flex items-center justify-center text-slate-600 text-xs\\'>Error</div>'">
                <div class="absolute bottom-0 inset-x-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-center">
                    <span class="text-white text-[10px] font-mono">Set cover</span>
                </div>
            </div>
            <div class="absolute top-2 right-2 flex gap-1">
                ${isCover ? '<span class="bg-neon-cyan text-black text-[9px] font-mono uppercase px-1.5 py-0.5 rounded">Cover</span>' : ''}
                <button onclick="event.stopPropagation(); openMoveImageModal(${idx})" class="bg-neon-cyan/80 text-black text-[9px] font-mono uppercase px-1.5 py-0.5 rounded hover:bg-neon-cyan">MV</button>
                <button onclick="event.stopPropagation(); deleteAlbumImage(${idx})" class="bg-red-500/80 text-white text-[9px] font-mono uppercase px-1.5 py-0.5 rounded hover:bg-red-500">DEL</button>
            </div>
            <div class="p-2 border-t border-slate-800">
                <input type="text"
                       value="${escapeHtml(img.description || '')}"
                       placeholder="Add description..."
                       onclick="event.stopPropagation()"
                       onkeydown="if(event.key==='Enter'){event.preventDefault();saveImageDescription(${idx},this.value)}"
                       onblur="saveImageDescription(${idx},this.value)"
                       class="w-full bg-transparent text-slate-300 text-[10px] font-mono border border-slate-700 rounded px-2 py-1 focus:border-neon-cyan focus:outline-none">
            </div>
        </div>`;
    }).join('');
}

// ─── IMAGE DESCRIPTION ───
async function saveImageDescription(imageIdx, description) {
    if (!editingAlbumId) return;
    const album = allAlbums.find(a => a.id === editingAlbumId);
    if (!album || !album.images) return;
    const newImages = [...album.images];
    if (imageIdx >= 0 && imageIdx < newImages.length) {
        newImages[imageIdx] = { ...newImages[imageIdx], description: description.trim() };
    }
    try {
        await db.collection('galleryAlbums').doc(editingAlbumId).update({ images: newImages });
        album.images = newImages;
    } catch (e) {
        console.error('Failed to save description:', e);
    }
}

// ─── MOVE IMAGE BETWEEN ALBUMS ───
let moveImageIdx = null;

function openMoveImageModal(imageIdx) {
    if (!editingAlbumId) return;
    moveImageIdx = imageIdx;
    const album = allAlbums.find(a => a.id === editingAlbumId);
    const list = document.getElementById('move-album-list');
    const otherAlbums = allAlbums.filter(a => a.id !== editingAlbumId);
    if (otherAlbums.length === 0) {
        list.innerHTML = '<p class="text-slate-500 text-sm font-mono">No other albums available.</p>';
    } else {
        list.innerHTML = otherAlbums.map(a => `
            <button onclick="moveImageToAlbum('${a.id}')" class="w-full text-left px-4 py-3 border border-slate-800 bg-slate-900/40 hover:border-neon-cyan hover:bg-slate-900/80 transition-all rounded flex items-center gap-3">
                <div class="w-10 h-8 bg-slate-800 overflow-hidden rounded flex-shrink-0">
                    ${a.coverImage ? `<img src="${escapeHtml(a.coverImage)}" class="w-full h-full object-cover">` : '<div class="w-full h-full flex items-center justify-center text-slate-600 text-[9px]">—</div>'}
                </div>
                <div>
                    <p class="text-white text-sm font-display">${escapeHtml(a.name || 'Untitled')}</p>
                    <p class="text-slate-500 text-[10px] font-mono">${a.images ? a.images.length : 0} images</p>
                </div>
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
    setTimeout(() => { m.classList.add('hidden'); moveImageIdx = null; }, 300);
}

async function moveImageToAlbum(targetAlbumId) {
    if (moveImageIdx == null || !editingAlbumId || !targetAlbumId) return;
    if (!confirm('Move this image to the selected album?')) { closeMoveImageModal(); return; }

    const sourceAlbum = allAlbums.find(a => a.id === editingAlbumId);
    const targetAlbum = allAlbums.find(a => a.id === targetAlbumId);
    if (!sourceAlbum || !targetAlbum || !sourceAlbum.images) { closeMoveImageModal(); return; }

    const imageToMove = sourceAlbum.images[moveImageIdx];
    if (!imageToMove) { closeMoveImageModal(); return; }

    const newSourceImages = [...sourceAlbum.images];
    newSourceImages.splice(moveImageIdx, 1);

    const newTargetImages = [...(targetAlbum.images || [])];
    newTargetImages.push({ ...imageToMove, order: newTargetImages.length });

    try {
        await db.collection('galleryAlbums').doc(editingAlbumId).update({ images: newSourceImages });
        await db.collection('galleryAlbums').doc(targetAlbumId).update({ images: newTargetImages });
        sourceAlbum.images = newSourceImages;
        targetAlbum.images = newTargetImages;
        if (sourceAlbum.coverImage === imageToMove.src) {
            const newCover = newSourceImages.length > 0 ? newSourceImages[0].src : '';
            await db.collection('galleryAlbums').doc(editingAlbumId).update({ coverImage: newCover });
            sourceAlbum.coverImage = newCover;
        }
        renderEditAlbumImages(sourceAlbum);
        renderAdminAlbumsList();
        renderAlbumGrid();
    } catch (e) {
        alert('Failed to move image: ' + e.message);
    }
    closeMoveImageModal();
}

// ─── DRAG & DROP UPLOAD ───
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('border-neon-cyan', 'bg-slate-900/60');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('border-neon-cyan', 'bg-slate-900/60');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('border-neon-cyan', 'bg-slate-900/60');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length) uploadImages(files);
}

function handleFileSelect(e) {
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
    if (files.length) uploadImages(files);
    e.target.value = '';
}

async function uploadImages(files) {
    if (!editingAlbumId) return;
    const album = allAlbums.find(a => a.id === editingAlbumId);
    if (!album) return;

    const progressArea = document.getElementById('upload-progress-area');
    progressArea.classList.remove('hidden');
    progressArea.innerHTML = files.map((f, i) => `
        <div id="upload-row-${i}" class="flex items-center gap-3 text-xs font-mono text-slate-400">
            <span class="text-neon-cyan">◈</span> ${escapeHtml(f.name)} <span id="upload-status-${i}" class="text-slate-500">uploading...</span>
        </div>
    `).join('');

    const uploaded = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const safeName = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const ref = storage.ref(`gallery/${editingAlbumId}/${safeName}`);
        try {
            await ref.put(file);
            const url = await ref.getDownloadURL();
            uploaded.push({
                src: url,
                filename: file.name,
                order: (album.images ? album.images.length : 0) + i,
                createdBy: currentUser ? currentUser.uid : 'admin',
                createdByName: currentUser ? getUserDisplayName(currentUser) : 'Admin',
                createdByAvatar: currentUser ? (currentUser.photoURL || '') : ''
            });
            document.getElementById(`upload-status-${i}`).textContent = 'done';
            document.getElementById(`upload-status-${i}`).classList.add('text-neon-lime');
        } catch (err) {
            console.error('Upload failed', err);
            document.getElementById(`upload-status-${i}`).textContent = 'failed';
            document.getElementById(`upload-status-${i}`).classList.add('text-red-400');
        }
    }

    if (uploaded.length) {
        const newImages = [...(album.images || []), ...uploaded];
        try {
            await db.collection('galleryAlbums').doc(editingAlbumId).update({ images: newImages });
            album.images = newImages;
            if (!album.coverImage && uploaded[0]) {
                album.coverImage = uploaded[0].src;
                await db.collection('galleryAlbums').doc(editingAlbumId).update({ coverImage: uploaded[0].src });
            }
            renderEditAlbumImages(album);
            renderAdminAlbumsList();
            renderAlbumGrid();
        } catch (e) {
            alert('Failed to save uploaded images: ' + e.message);
        }
    }
}

// ─── INIT ───
window.addEventListener('DOMContentLoaded', () => {
    updateGalleryPreviews();
    previewInterval = setInterval(updateGalleryPreviews, 2000);
    renderAdminUI();
});

window.addEventListener('beforeunload', () => {
    if (previewInterval) clearInterval(previewInterval);
});
