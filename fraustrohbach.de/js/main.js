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
let galleryImages = [];
let galleryLoaded = false;

// ─── AUTH LISTENER ───
auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    renderNavAuth();
    renderMobileAuth();
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
    // No gallery admin UI in simplified version
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
const totalImages = 86;
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
loadGalleryImages().then(images => { if (images) galleryImagesCache = images; });

function updateGalleryPreviews() {
    const preview1 = document.getElementById('gallery-preview-1');
    const preview2 = document.getElementById('gallery-preview-2');
    if (!preview1 || !preview2) return;
    if (galleryImagesCache && galleryImagesCache.length > 0) {
        const imgs = galleryImagesCache;
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

// ─── GALLERY DATA ───
async function loadGalleryImages() {
    try {
        const res = await fetch('gallery-images.json');
        if (!res.ok) return [];
        const data = await res.json();
        if (data && Array.isArray(data.images)) return data.images;
    } catch (e) {
        console.warn('gallery-images.json not available', e);
    }
    return [];
}

async function renderGallery() {
    const grid = document.getElementById('album-images-grid');
    if (!grid) return;

    if (!galleryLoaded || galleryImages.length === 0) {
        galleryImages = await loadGalleryImages();
        galleryLoaded = true;
    }

    const images = galleryImages.sort((a, b) => (a.order || 0) - (b.order || 0));
    if (images.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-16 text-slate-600 font-mono text-sm">No captures found.</div>`;
        return;
    }

    grid.innerHTML = images.map((img, idx) => `
        <div onclick="openImageViewer(${idx})" class="group relative aspect-video bg-slate-900 overflow-hidden border border-slate-800 hover:border-neon-cyan/50 transition-colors cursor-pointer">
            <img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.filename || '')}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" onerror="this.parentElement.innerHTML='<div class=\'absolute inset-0 flex items-center justify-center text-slate-600 italic text-xs\'>Not found</div>'">
        </div>
    `).join('');
}

// ─── GALLERY MODAL ───
const modal = document.getElementById('gallery-modal');
let galleryKeyboardActive = false;
let scrollListenerAttached = false;

function openGallery() {
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.remove('opacity-0'), 10);
    document.body.style.overflow = 'hidden';

    const scrollContainer = document.getElementById('album-detail-view');
    if (scrollContainer && !scrollContainer.dataset.scrollAttached) {
        scrollContainer.addEventListener('scroll', handleGalleryScroll);
        scrollContainer.dataset.scrollAttached = 'true';
    }
    if (!galleryKeyboardActive) {
        galleryKeyboardActive = true;
        document.addEventListener('keydown', handleGalleryKeyboard);
    }
    if (!galleryLoaded) {
        renderGallery().then(() => { galleryLoaded = true; });
    } else {
        renderGallery();
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
        closeGallery();
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
    const c = document.getElementById('album-detail-view');
    if (c) c.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleGalleryScroll() {
    const container = document.getElementById('album-detail-view');
    const scrollBtn = document.getElementById('scroll-to-top-btn');
    if (!scrollBtn || !container) return;
    const scrollTop = container.scrollTop || 0;
    if (scrollTop > 300) {
        scrollBtn.style.display = 'block';
        setTimeout(() => scrollBtn.classList.remove('opacity-0'), 10);
        scrollBtn.classList.remove('pointer-events-none');
    } else {
        scrollBtn.classList.add('opacity-0');
        setTimeout(() => {
            if (container.scrollTop <= 300) {
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
    viewerImages = galleryImages.sort((a, b) => (a.order || 0) - (b.order || 0));
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
    document.getElementById('viewer-description').textContent = imgData.description || '';
    document.getElementById('viewer-index').textContent = `${viewerCurrentIdx + 1} / ${viewerImages.length}`;

    // Author info
    const authorNameEl = document.getElementById('viewer-author-name');
    const authorAvatarEl = document.getElementById('viewer-author-avatar');
    const authorName = imgData.createdByName || 'Exinia';
    const authorAvatar = imgData.createdByAvatar || '';
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

// ─── INIT ───
window.addEventListener('DOMContentLoaded', () => {
    updateGalleryPreviews();
    previewInterval = setInterval(updateGalleryPreviews, 2000);
    renderAdminUI();
});

window.addEventListener('beforeunload', () => {
    if (previewInterval) clearInterval(previewInterval);
});
