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
const functions = firebase.functions();
const storage = firebase.storage();

// ─── STATE ───
let currentUser = null;
let currentPostId = null;
let allPosts = [];
let allTags = new Set();
let activeTag = null;
let searchQuery = '';
let generatedPayload = null;
let commentsUnsub = null;
let currentPage = 1;
let editingPostId = null;
const POSTS_PER_PAGE = 10;

// ─── AUTH LISTENER ───
auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    renderAuthUI();
    renderHeroButtons();
    renderNavAuth();
    renderMobileAuth();
    renderPosts(); // re-render so admin toolbars appear/disappear on auth change
    if (currentPostId) {
        renderCommentForm();
    }
});

// ─── AUTH UI ───
function switchAuthTab(tab) {
    document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
    document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active', tab === 'register');
    hideAuthMessage();
}

function showAuthMessage(text, type = 'info') {
    const msg = document.getElementById('auth-message');
    msg.textContent = text;
    msg.classList.remove('hidden');
    if (type === 'error') msg.className = 'mt-6 text-center text-xs font-mono uppercase tracking-wider text-neon-magenta';
    else if (type === 'success') msg.className = 'mt-6 text-center text-xs font-mono uppercase tracking-wider text-neon-lime';
    else msg.className = 'mt-6 text-center text-xs font-mono uppercase tracking-wider text-neon-cyan';
}

function hideAuthMessage() {
    document.getElementById('auth-message').classList.add('hidden');
}

// ─── EMAIL / PASSWORD ───
async function handleEmailRegister() {
    const nickname = document.getElementById('reg-nickname').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    if (!nickname) { showAuthMessage('Callsign required.', 'error'); return; }
    if (!email) { showAuthMessage('Email required.', 'error'); return; }
    if (password.length < 6) { showAuthMessage('Password must be at least 6 characters.', 'error'); return; }

    try {
        const existingNick = await db.collection('nicknames').doc(nickname.toLowerCase()).get();
        if (existingNick.exists) {
            showAuthMessage('Callsign already taken.', 'error');
            return;
        }
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        await cred.user.updateProfile({ displayName: nickname });
        await db.collection('userProfiles').doc(cred.user.uid).set({
            nickname,
            email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await db.collection('nicknames').doc(nickname.toLowerCase()).set({
            email,
            uid: cred.user.uid
        });
        showAuthMessage('Operator registered successfully.', 'success');
        document.getElementById('reg-nickname').value = '';
        document.getElementById('reg-email').value = '';
        document.getElementById('reg-password').value = '';
    } catch (e) {
        showAuthMessage(e.message, 'error');
    }
}

async function handleNicknameLogin() {
    const nickname = document.getElementById('login-nickname').value.trim();
    const password = document.getElementById('login-password').value;

    if (!nickname || !password) {
        showAuthMessage('Nickname and password required.', 'error');
        return;
    }

    // Admin hardcoded fallback — intercept exinia / katadvaya before nicknames lookup
    const lowerNick = nickname.toLowerCase();
    if (lowerNick === 'exinia' || lowerNick === 'katadvaya') {
        return handleAdminLogin(nickname, password);
    }

    try {
        const nickDoc = await db.collection('nicknames').doc(nickname.toLowerCase()).get();
        if (!nickDoc.exists) {
            showAuthMessage('Callsign not found in registry.', 'error');
            return;
        }
        const email = nickDoc.data().email;
        await auth.signInWithEmailAndPassword(email, password);
        showAuthMessage('Authentication successful.', 'success');
        document.getElementById('login-nickname').value = '';
        document.getElementById('login-password').value = '';
    } catch (e) {
        showAuthMessage(e.message, 'error');
    }
}

/*
// ─── GOOGLE SIGN IN ───
async function handleGoogleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
        const user = auth.currentUser;
        if (user) {
            const profileRef = db.collection('userProfiles').doc(user.uid);
            const doc = await profileRef.get();
            if (!doc.exists) {
                await profileRef.set({
                    nickname: user.displayName || 'Operator',
                    email: user.email,
                    photoURL: user.photoURL || '',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        }
    } catch (e) {
        showAuthMessage(e.message, 'error');
    }
}

// ─── APPLE SIGN IN ───
async function handleAppleLogin() {
    const provider = new firebase.auth.OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    try {
        await auth.signInWithPopup(provider);
        const user = auth.currentUser;
        if (user) {
            const profileRef = db.collection('userProfiles').doc(user.uid);
            const doc = await profileRef.get();
            if (!doc.exists) {
                await profileRef.set({
                    nickname: user.displayName || 'Operator',
                    email: user.email,
                    photoURL: user.photoURL || '',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        }
    } catch (e) {
        showAuthMessage('Apple Sign-In requires configuration in Firebase Console and Apple Developer Portal.', 'error');
    }
}
*/

// ─── LOGOUT ───
async function handleLogout() {
    await auth.signOut();
    sessionStorage.removeItem('exinia_auth_session');
    currentPostId = null;
    if (commentsUnsub) { commentsUnsub(); commentsUnsub = null; }
    renderHeroButtons();
    renderNavAuth();
}

// ─── AUTH UI RENDERING ───
function renderAuthUI() {
    const panel = document.getElementById('auth-panel');
    const loginForm = document.getElementById('form-login');
    const registerForm = document.getElementById('form-register');
    const loggedIn = document.getElementById('auth-logged-in');
    const tabs = document.querySelector('.auth-tab-btn');

    if (currentUser) {
        loginForm.classList.add('hidden');
        registerForm.classList.add('hidden');
        loggedIn.classList.remove('hidden');
        document.getElementById('logged-in-name').textContent = getUserDisplayName(currentUser);
        document.getElementById('tab-login').parentElement.classList.add('hidden');
    } else {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        loggedIn.classList.add('hidden');
        document.getElementById('tab-login').parentElement.classList.remove('hidden');
        switchAuthTab('login');
    }
    renderAdminAuthUI();
}

function getUserDisplayName(user) {
    if (!user) return 'Guest';
    return user.displayName || 'Operator';
}

function renderNavAuth() {
    const navAuth = document.getElementById('nav-auth');
    const isAdminSession = sessionStorage.getItem('exinia_auth_session') === 'true';
    if (currentUser) {
        const displayName = getUserDisplayName(currentUser);
        navAuth.innerHTML = `
            <span onclick="openProfileModal()" class="text-neon-cyan font-mono text-xs hidden lg:inline glow-text cursor-pointer hover:text-white transition-colors">${escapeHtml(displayName)}</span>
            <button onclick="openProfileModal()" class="lg:hidden text-slate-400 hover:text-neon-cyan transition-colors flex items-center gap-1 text-xs uppercase tracking-widest">
                <i class="ph ph-user-circle text-lg"></i> Profile
            </button>
            <button onclick="handleLogout()" class="text-slate-400 hover:text-neon-magenta transition-colors flex items-center gap-1 text-xs uppercase tracking-widest">
                <i class="ph ph-sign-out text-lg"></i> Logout
            </button>
        `;
    } else if (isAdminSession) {
        navAuth.innerHTML = `
            <span class="text-neon-magenta font-mono text-xs hidden lg:inline"><i class="ph ph-shield-check mr-1"></i>Operator</span>
            <button onclick="handleAdminLogout()" class="text-slate-400 hover:text-neon-magenta transition-colors flex items-center gap-1 text-xs uppercase tracking-widest">
                <i class="ph ph-sign-out text-lg"></i> Logout
            </button>
        `;
    } else {
        navAuth.innerHTML = `
            <a href="#auth-terminal" class="text-slate-400 hover:text-neon-cyan transition-colors flex items-center gap-1 text-xs uppercase tracking-widest">
                <i class="ph ph-key text-lg"></i> Login
            </a>
        `;
    }
}

function renderHeroButtons() {
    const container = document.getElementById('hero-buttons');
    if (!container) return;
    if (isAdmin()) {
        container.innerHTML = `
            <button onclick="openComposer()" class="inline-flex items-center gap-2 border border-slate-700 bg-slate-900/50 text-white px-8 py-4 uppercase tracking-widest text-sm hover:border-neon-cyan hover:bg-neon-cyan/10 transition-all duration-300">
                <i class="ph ph-broadcast text-xl"></i> New Transmission
            </button>
        `;
    } else {
        container.innerHTML = '';
    }
}

function isAdmin() {
    if (sessionStorage.getItem('exinia_auth_session') === 'true') return true;
    const user = auth.currentUser;
    if (!user || !user.email) return false;
    const email = user.email.toLowerCase();
    return email === 'exinia@fraustrohbach.de' || email === 'katadvaya@fraustrohbach.de';
}

// Admin login — hardcoded credentials, Firebase v10 safe
async function handleAdminLogin(nickname, password) {
    const lowerNick = nickname.toLowerCase();
    if (lowerNick !== 'exinia' && lowerNick !== 'katadvaya') {
        showAuthMessage('Invalid credentials.', 'error');
        return;
    }

    // Only these passwords are ever valid
    const validPasswords = ['temporal-void-2026', 'nebula-void-2026'];
    if (!validPasswords.includes(password)) {
        showAuthMessage('Invalid credentials.', 'error');
        return;
    }

    const adminEmail = lowerNick === 'exinia'
        ? 'exinia@fraustrohbach.de'
        : 'katadvaya@fraustrohbach.de';

    try {
        await auth.signInWithEmailAndPassword(adminEmail, password);
    } catch (e) {
        // Firebase v10+ lumps user-not-found + wrong-password into invalid-credential
        if (e.code === 'auth/invalid-credential') {
            // We don't know if account exists with wrong password or doesn't exist at all.
            // Try creating it. If email-already-in-use, the password was wrong.
            try {
                await auth.createUserWithEmailAndPassword(adminEmail, password);
                await auth.currentUser.updateProfile({ displayName: lowerNick });
            } catch (createErr) {
                if (createErr.code === 'auth/email-already-in-use') {
                    showAuthMessage('Invalid credentials.', 'error');
                } else {
                    showAuthMessage('Firebase auth error: ' + createErr.message, 'error');
                }
                return;
            }
        } else {
            showAuthMessage('Firebase auth error: ' + e.message, 'error');
            return;
        }
    }

    sessionStorage.setItem('exinia_auth_session', 'true');
    renderAdminAuthUI();
    renderHeroButtons();
    showAuthMessage('Operator session granted.', 'success');
}

async function handleAdminLogout() {
    sessionStorage.removeItem('exinia_auth_session');
    await auth.signOut();
    renderAdminAuthUI();
    renderHeroButtons();
}

function renderAdminAuthUI() {
    renderNavAuth();
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
            <button onclick="handleLogout(); closeMobileMenu();" class="text-slate-400 hover:text-neon-magenta transition-colors text-left flex items-center gap-2">
                <i class="ph ph-sign-out text-lg"></i> Logout
            </button>
        `;
    } else {
        container.innerHTML = `
            <a href="#auth-terminal" onclick="closeMobileMenu();" class="text-slate-400 hover:text-neon-cyan transition-colors flex items-center gap-2">
                <i class="ph ph-key text-lg"></i> Login
            </a>
        `;
    }
}

function closeMobileMenu() {
    const m = document.getElementById('mobile-menu');
    if (m) m.classList.add('hidden');
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
            if (currentNick) {
                await db.collection('nicknames').doc(currentNick.toLowerCase()).delete();
            }
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

// ─── LIVE CLOCK ───
function updateClock() {
    const now = new Date();
    const timeStr = now.toISOString().split('T')[1].split('.')[0];
    const el = document.getElementById('live-clock');
    if (el) el.textContent = timeStr + ' UTC';
}
setInterval(updateClock, 1000);
updateClock();

// Mobile menu
const mobileBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
if (mobileBtn && mobileMenu) {
    mobileBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });
}

// ─── BLOG POSTS ───
async function loadPosts() {
    // Try Firestore first
    try {
        const snapshot = await db.collection('blogPosts').orderBy('order', 'desc').get();
        if (!snapshot.empty) {
            allPosts = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    date: data.date?.toDate ? data.date.toDate().toISOString() : (data.date || ''),
                    scheduledAt: data.scheduledAt?.toDate ? data.scheduledAt.toDate().toISOString() : (data.scheduledAt || null)
                };
            });
            extractTags();
            renderTags();
            renderPosts();
            return;
        }
    } catch (e) {
        console.warn('Firestore load failed, falling back to JSON', e);
    }

    // Fallback to JSON
    try {
        const res = await fetch('blog-data.json?t=' + Date.now());
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        allPosts = data.posts || [];
        extractTags();
        renderTags();
        renderPosts();
    } catch (e) {
        console.warn('Could not load blog-data.json', e);
        allPosts = [];
        renderPosts();
    }
}

function extractTags() {
    allTags.clear();
    allPosts.forEach(p => { (p.tags || []).forEach(t => allTags.add(t)); });
}

function renderTags() {
    const container = document.getElementById('tags-container');
    if (!container) return;
    let html = `<button onclick="filterByTag(null)" class="tag-pill px-3 py-1 rounded text-xs uppercase tracking-widest font-mono ${!activeTag ? 'active' : ''}">All</button>`;
    Array.from(allTags).sort().forEach(tag => {
        html += `<button onclick="filterByTag('${escapeJs(tag)}')" class="tag-pill px-3 py-1 rounded text-xs uppercase tracking-widest font-mono ${activeTag === tag ? 'active' : ''}">${escapeHtml(tag)}</button>`;
    });
    container.innerHTML = html;
}

function filterByTag(tag) {
    activeTag = tag;
    currentPage = 1;
    renderTags();
    renderPosts();
}

document.getElementById('search-input').addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    currentPage = 1;
    renderPosts();
});

function getFilteredPosts() {
    return allPosts.filter(p => {
        const matchesTag = !activeTag || (p.tags || []).includes(activeTag);
        const matchesSearch = !searchQuery ||
            (p.title || '').toLowerCase().includes(searchQuery) ||
            (p.excerpt || '').toLowerCase().includes(searchQuery) ||
            (p.tags || []).some(t => t.toLowerCase().includes(searchQuery));
        if (!matchesTag || !matchesSearch) return false;

        // Non-admins only see public, non-archived, non-future posts
        if (!isAdmin()) {
            if (p.isPublic === false) return false;
            if (p.isArchived === true) return false;
            if (p.scheduledAt) {
                const scheduled = new Date(p.scheduledAt);
                if (scheduled > new Date()) return false;
            }
        }
        return true;
    }).sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
}

// Cookie helper for view tracking
function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/; SameSite=Lax';
}
function getCookie(name) {
    return document.cookie.split('; ').reduce((r, v) => {
        const parts = v.split('=');
        return parts[0] === name ? decodeURIComponent(parts[1]) : r;
    }, '');
}

async function trackPostView(postId) {
    const cookieName = 'viewed_' + postId;
    if (getCookie(cookieName)) return; // already counted
    try {
        await db.collection('blogPosts').doc(postId).update({
            viewCount: firebase.firestore.FieldValue.increment(1)
        });
        // update local cache so UI reflects immediately
        const post = allPosts.find(p => p.id === postId);
        if (post) post.viewCount = (post.viewCount || 0) + 1;
        setCookie(cookieName, '1', 7); // 7 days
    } catch (e) {
        console.error('View tracking failed:', e);
    }
}

function renderPosts() {
    const list = document.getElementById('posts-list');
    const empty = document.getElementById('empty-state');
    const stats = document.getElementById('stream-stats');
    const posts = getFilteredPosts();

    if (stats) stats.textContent = `Displaying ${posts.length} of ${allPosts.length} transmissions`;
    if (posts.length === 0) {
        list.innerHTML = '';
        document.getElementById('pagination-container').innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE);
    if (currentPage > totalPages) currentPage = totalPages || 1;
    const start = (currentPage - 1) * POSTS_PER_PAGE;
    const paginatedPosts = posts.slice(start, start + POSTS_PER_PAGE);

    list.innerHTML = paginatedPosts.map((post, idx) => {
        const dateStr = post.date ? formatDate(post.date) : 'DATE_UNKNOWN';
        const tagsHtml = (post.tags || []).slice(0, 4).map(t =>
            `<span class="text-[10px] uppercase tracking-wider text-neon-cyan/70 border border-neon-cyan/20 px-2 py-0.5 rounded font-mono">${escapeHtml(t)}</span>`
        ).join(' ');
        const featuredImg = post.featuredImage || '';
        const isAdminUser = isAdmin();

        // Status badges
        let statusBadges = '';
        if (post.scheduledAt) {
            const sched = new Date(post.scheduledAt);
            if (sched > new Date()) {
                statusBadges += `<span class="status-badge scheduled mr-2">Scheduled: ${formatDate(post.scheduledAt)}</span>`;
            }
        }
        if (post.isArchived) statusBadges += `<span class="status-badge archived mr-2">Archived</span>`;
        if (post.isPublic === false) statusBadges += `<span class="status-badge private mr-2">Private</span>`;

        // Admin toolbar
        const adminToolbar = isAdminUser ? `
            <div class="admin-toolbar">
                <button onclick="event.stopPropagation(); editPost('${escapeJs(post.id)}')" class="admin-btn" title="Edit"><i class="ph ph-pencil-simple"></i> Edit</button>
                <button onclick="event.stopPropagation(); toggleVisibility('${escapeJs(post.id)}')" class="admin-btn" title="Toggle Visibility">${post.isPublic === false ? '<i class="ph ph-eye"></i> Show' : '<i class="ph ph-eye-slash"></i> Hide'}</button>
                <button onclick="event.stopPropagation(); toggleArchive('${escapeJs(post.id)}')" class="admin-btn archive" title="Toggle Archive">${post.isArchived ? '<i class="ph ph-arrow-u-up-left"></i> Restore' : '<i class="ph ph-archive"></i> Archive'}</button>
                <button onclick="event.stopPropagation(); deletePost('${escapeJs(post.id)}')" class="admin-btn danger" title="Delete"><i class="ph ph-trash"></i> Delete</button>
            </div>
        ` : '';

        const dragAttrs = isAdminUser ? `draggable="true" ondragstart="dragStart(event, '${escapeJs(post.id)}')" ondragover="dragOver(event)" ondrop="dragDrop(event, '${escapeJs(post.id)}')" ondragend="dragEnd(event)"` : '';

        return `
        <article ${dragAttrs} class="list-entry py-8 md:py-10 decode-in flex flex-col md:flex-row gap-6 md:gap-8 items-start relative" style="animation-delay: ${idx * 50}ms">
            ${adminToolbar}
            <div class="w-full md:w-56 flex-shrink-0">
                <div class="scanline-wrap aspect-[4/3] bg-slate-900/80 rounded border border-slate-800 overflow-hidden relative">
                    ${featuredImg ? `<img src="${escapeHtml(featuredImg)}" alt="${escapeHtml(post.title || '')}" class="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity">` : `<div class="w-full h-full flex items-center justify-center text-slate-700 font-mono text-xs">NO_VISUAL_DATA</div>`}
                </div>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-3 text-xs font-mono text-slate-500 uppercase tracking-wider">
                    ${isAdminUser ? `<i class="ph ph-dots-six-vertical drag-handle mr-1" title="Drag to reorder"></i>` : ''}
                    <i class="ph ph-calendar-blank text-neon-cyan/60"></i> ${dateStr}
                    <span class="mx-2 text-slate-700">|</span>
                    <i class="ph ph-user text-neon-cyan/60"></i> ${escapeHtml(post.author || 'Unknown Operator')}
                    ${statusBadges}
                </div>
                <h3 onclick="openPostModal('${post.id}')" class="text-xl md:text-2xl font-display font-bold text-white mb-3 leading-snug hover:text-neon-cyan transition-colors cursor-pointer">
                    ${escapeHtml(post.title || 'Untitled Transmission')}
                </h3>
                <p class="text-slate-400 text-sm md:text-base leading-relaxed mb-4">
                    ${escapeHtml(post.excerpt || '')}
                </p>
                <div class="flex flex-wrap items-center gap-3">
                    <div class="flex flex-wrap gap-2">${tagsHtml}</div>
                    <div class="ml-auto flex items-center gap-3">
                        <span class="inline-flex items-center gap-1 text-slate-400 text-sm font-mono uppercase tracking-wider" title="Unique readers">
                            <i class="ph ph-eye text-neon-cyan/60"></i> ${post.viewCount || 0}
                        </span>
                        <button onclick="openPostModal('${post.id}')" class="inline-flex items-center gap-1 text-neon-cyan text-xs uppercase tracking-widest font-mono hover:text-white transition-colors group">
                            <span>mehr</span><i class="ph ph-arrow-right group-hover:translate-x-1 transition-transform"></i>
                        </button>
                    </div>
                </div>
            </div>
        </article>`;
    }).join('');

    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    const container = document.getElementById('pagination-container');
    if (!container) return;
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    let html = '';
    if (currentPage > 1) {
        html += `<button onclick="goToPage(${currentPage - 1})" class="px-3 py-2 border border-slate-700 text-slate-400 hover:border-neon-cyan hover:text-neon-cyan transition-colors text-xs font-mono uppercase"><i class="ph ph-caret-left"></i> Prev</button>`;
    }

    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage) {
            html += `<span class="px-3 py-2 border border-neon-cyan bg-neon-cyan/10 text-neon-cyan text-xs font-mono">${i}</span>`;
        } else {
            html += `<button onclick="goToPage(${i})" class="px-3 py-2 border border-slate-700 text-slate-400 hover:border-neon-cyan hover:text-neon-cyan transition-colors text-xs font-mono">${i}</button>`;
        }
    }

    if (currentPage < totalPages) {
        html += `<button onclick="goToPage(${currentPage + 1})" class="px-3 py-2 border border-slate-700 text-slate-400 hover:border-neon-cyan hover:text-neon-cyan transition-colors text-xs font-mono uppercase">Next <i class="ph ph-caret-right"></i></button>`;
    }

    container.innerHTML = html;
}

function goToPage(page) {
    currentPage = page;
    renderPosts();
    document.getElementById('stream').scrollIntoView({ behavior: 'smooth' });
}

function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' }).toUpperCase();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeJs(str) {
    if (!str) return '';
    return String(str).replace(/[\\']/g, '\\$&').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

// ─── POST MODAL ───
async function openPostModal(id) {
    const post = allPosts.find(p => p.id === id);
    if (!post) return;
    currentPostId = id;

    // Track unique view via cookie
    trackPostView(id);

    const modal = document.getElementById('post-modal');
    const content = document.getElementById('modal-content');
    const dateStr = post.date ? formatDate(post.date) : 'DATE_UNKNOWN';
    const tagsHtml = (post.tags || []).map(t =>
        `<span class="text-xs uppercase tracking-wider text-neon-cyan border border-neon-cyan/30 px-3 py-1 rounded font-mono">${escapeHtml(t)}</span>`
    ).join(' ');

    let bodyHtml = '';
    if (post.content && Array.isArray(post.content)) {
        bodyHtml = post.content.map(block => {
            if (block.type === 'text') {
                return `<p class="text-slate-300 text-base md:text-lg leading-relaxed mb-6">${escapeHtml(block.value || '')}</p>`;
            }
            if (block.type === 'image') {
                if (block.src && block.src === post.featuredImage) return '';
                return `<div class="scanline-wrap rounded border border-slate-800 my-8 overflow-hidden"><img src="${escapeHtml(block.src || '')}" alt="${escapeHtml(block.alt || '')}" class="w-full object-cover"></div>`;
            }
            if (block.type === 'video') {
                return `<div class="viewfinder aspect-video bg-slate-900 border border-slate-800 my-8 relative overflow-hidden rounded"><iframe class="absolute inset-0 w-full h-full" src="${escapeHtml(block.src || '')}" title="${escapeHtml(block.title || 'Video')}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe><div class="rec-badge">REC // VISUAL_FEED</div></div>`;
            }
            if (block.type === 'link') {
                return `<div class="my-6"><a href="${escapeHtml(block.url || '#')}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 border border-neon-cyan/40 bg-neon-cyan/5 text-neon-cyan px-5 py-3 uppercase tracking-widest text-xs hover:bg-neon-cyan/15 transition-all"><i class="ph ph-link-simple text-lg"></i>${escapeHtml(block.label || block.url)}</a></div>`;
            }
            return '';
        }).join('');
    }

    content.innerHTML = `
        <div class="mb-6">
            <div class="flex flex-wrap items-center gap-3 mb-4">
                <span class="font-mono text-[10px] text-neon-cyan uppercase tracking-widest border border-neon-cyan/30 px-2 py-1 rounded">ID: ${escapeHtml(post.id || '???')}</span>
                <span class="font-mono text-xs text-slate-500 uppercase tracking-wider flex items-center gap-2"><i class="ph ph-calendar-blank"></i> ${dateStr}</span>
                <span class="font-mono text-xs text-slate-500 uppercase tracking-wider flex items-center gap-2"><i class="ph ph-user"></i> ${escapeHtml(post.author || 'Unknown Operator')}</span>
            </div>
            <h2 class="text-3xl md:text-4xl font-display font-bold text-white mb-6 glow-text leading-tight">${escapeHtml(post.title || 'Untitled')}</h2>
            <div class="flex flex-wrap gap-2">${tagsHtml}</div>
        </div>
        <div class="border-t border-slate-800 pt-8">
            ${bodyHtml || `<p class="text-slate-500 font-mono text-sm">No decoded content available.</p>`}
        </div>
    `;

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.remove('opacity-0'), 10);
    document.body.style.overflow = 'hidden';

    renderCommentForm();
    listenToComments(id);
}

function closePostModal() {
    const modal = document.getElementById('post-modal');
    modal.classList.add('opacity-0');
    setTimeout(() => {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }, 300);
    currentPostId = null;
    if (commentsUnsub) { commentsUnsub(); commentsUnsub = null; }
}

// ─── COMMENTS ───
function renderCommentForm() {
    const formArea = document.getElementById('comment-form-area');
    const loginPrompt = document.getElementById('comment-login-prompt');
    if (currentUser) {
        formArea.classList.remove('hidden');
        loginPrompt.classList.add('hidden');
    } else {
        formArea.classList.add('hidden');
        loginPrompt.classList.remove('hidden');
    }
}

function listenToComments(postId) {
    if (commentsUnsub) { commentsUnsub(); commentsUnsub = null; }

    const list = document.getElementById('comments-list');
    list.innerHTML = '<p class="text-slate-600 text-xs font-mono uppercase tracking-wider">Receiving signals...</p>';

    commentsUnsub = db.collection('comments')
        .where('postId', '==', postId)
        .orderBy('createdAt', 'asc')
        .onSnapshot(snapshot => {
            const comments = [];
            snapshot.forEach(doc => comments.push({ id: doc.id, ...doc.data() }));
            renderCommentsList(comments);
        }, err => {
            console.warn('Comments listener error:', err);
            list.innerHTML = '<p class="text-slate-600 text-xs font-mono uppercase tracking-wider">Signal interference. Comments unavailable.</p>';
        });
}

function renderCommentsList(comments) {
    const list = document.getElementById('comments-list');
    const count = document.getElementById('comment-count');
    count.textContent = `(${comments.length})`;

    if (comments.length === 0) {
        list.innerHTML = '<p class="text-slate-600 text-xs font-mono uppercase tracking-wider">No responses yet. Be the first to broadcast.</p>';
        return;
    }

    list.innerHTML = comments.map(c => {
        const date = c.createdAt ? formatDate(c.createdAt.toDate ? c.createdAt.toDate() : c.createdAt) : 'UNKNOWN';
        return `
            <div class="comment-item">
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-xs font-mono text-neon-cyan font-bold">${escapeHtml(c.author || 'Anonymous')}</span>
                    <span class="text-[10px] text-slate-600 font-mono">${date}</span>
                </div>
                <p class="text-slate-300 text-sm leading-relaxed">${escapeHtml(c.text || '')}</p>
            </div>
        `;
    }).join('');
}

async function submitComment() {
    if (!currentUser || !currentPostId) return;
    const text = document.getElementById('comment-text').value.trim();
    if (!text) return;

    const author = currentUser.displayName || 'Operator';

    try {
        await db.collection('comments').add({
            postId: currentPostId,
            text,
            author,
            uid: currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('comment-text').value = '';
    } catch (e) {
        console.error('Failed to post comment:', e);
        alert('Failed to transmit comment. Please try again.');
    }
}

// ─── COMPOSER (Admin only) ───
function openComposer() {
    // If editingPostId is already set (e.g. from editPost), don't wipe it.
    if (!editingPostId) {
        resetComposer();
    }
    const modal = document.getElementById('composer-modal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.remove('opacity-0'), 10);
    document.body.style.overflow = 'hidden';
}

function closeComposer() {
    const modal = document.getElementById('composer-modal');
    modal.classList.add('opacity-0');
    setTimeout(() => { modal.style.display = 'none'; document.body.style.overflow = ''; }, 300);
    editingPostId = null;
}

function resetComposer() {
    document.getElementById('compose-title').value = '';
    document.getElementById('compose-author').value = 'Ksenia Strohbach';
    document.getElementById('compose-tags').value = '';
    document.getElementById('compose-excerpt').value = '';
    document.getElementById('compose-image').value = '';
    document.getElementById('compose-content').value = '';
    document.getElementById('compose-visibility').value = 'true';
    document.getElementById('compose-status').value = 'active';
    document.getElementById('compose-scheduled').value = '';
    document.getElementById('json-output-wrap').classList.add('hidden');
}

function populateComposer(post) {
    document.getElementById('compose-title').value = post.title || '';
    document.getElementById('compose-author').value = post.author || 'Ksenia Strohbach';
    document.getElementById('compose-tags').value = (post.tags || []).join(', ');
    document.getElementById('compose-excerpt').value = post.excerpt || '';
    document.getElementById('compose-image').value = post.featuredImage || '';
    document.getElementById('compose-content').value = post.content ? JSON.stringify(post.content, null, 2) : '';
    document.getElementById('compose-visibility').value = post.isPublic === false ? 'false' : 'true';
    document.getElementById('compose-status').value = post.isArchived ? 'archived' : 'active';
    document.getElementById('compose-scheduled').value = post.scheduledAt ? new Date(post.scheduledAt).toISOString().slice(0, 16) : '';
}

async function importFromInstagram() {
    const statusEl = document.getElementById('import-insta-status');
    if (statusEl) {
        statusEl.textContent = 'Auto-import is disabled for compliance. Please copy the image URL and caption manually from Instagram into the fields above.';
        statusEl.className = 'text-xs mt-2 font-mono text-neon-magenta';
        statusEl.classList.remove('hidden');
    }
}

async function saveTransmission() {
    const title = document.getElementById('compose-title').value.trim();
    const author = document.getElementById('compose-author').value.trim();
    const tagsRaw = document.getElementById('compose-tags').value;
    const excerpt = document.getElementById('compose-excerpt').value.trim();
    const image = document.getElementById('compose-image').value.trim();
    const contentRaw = document.getElementById('compose-content').value.trim();
    const isPublic = document.getElementById('compose-visibility').value === 'true';
    const isArchived = document.getElementById('compose-status').value === 'archived';
    const scheduledRaw = document.getElementById('compose-scheduled').value;

    if (!title) { alert('Title is required.'); return; }

    let content = [];
    if (contentRaw) {
        try { content = JSON.parse(contentRaw); }
        catch (e) { alert('Content blocks JSON is invalid: ' + e.message); return; }
    }

    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
    const date = new Date().toISOString();
    const scheduledAt = scheduledRaw ? new Date(scheduledRaw).toISOString() : null;
    const postPayload = { title, author, tags, excerpt, featuredImage: image || '', content, isPublic, isArchived, scheduledAt };

    let firestoreOk = false;
    let localOk = false;

    // ─── 1. Firestore ───
    try {
        if (editingPostId) {
            await db.collection('blogPosts').doc(editingPostId).update({
                ...postPayload,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            const maxOrder = allPosts.length > 0 ? Math.max(...allPosts.map(p => p.order || 0)) : 0;
            const newDoc = db.collection('blogPosts').doc();
            await newDoc.set({
                id: newDoc.id,
                ...postPayload,
                date,
                order: maxOrder + 10,
                viewCount: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        firestoreOk = true;
    } catch (e) {
        console.warn('Firestore save failed', e);
    }

    // ─── 2. Local JSON fallback / mirror ───
    try {
        await saveToLocalServer(postPayload, editingPostId, date);
        localOk = true;
    } catch (e) {
        console.warn('Local JSON save failed', e);
    }

    if (firestoreOk && localOk) {
        showAuthMessage(editingPostId ? 'Transmission updated (DB + JSON).' : 'Transmission broadcast (DB + JSON).', 'success');
        closeComposer();
        await loadPosts();
    } else if (localOk) {
        showAuthMessage('Saved to local JSON only (Firestore offline).', 'success');
        closeComposer();
        await loadPosts();
    } else if (firestoreOk) {
        showAuthMessage('Saved to DB only (local JSON failed).', 'success');
        closeComposer();
        await loadPosts();
    } else {
        alert('Failed to save to both database and local JSON.');
    }
}

async function saveToLocalServer(post, existingId, fallbackDate) {
    const res = await fetch('/api/blog-data');
    if (!res.ok) throw new Error('Could not read local blog-data.json');
    const data = await res.json();
    if (existingId) {
        const idx = data.posts.findIndex(p => p.id === existingId);
        if (idx !== -1) {
            data.posts[idx] = { ...data.posts[idx], ...post, updatedAt: new Date().toISOString() };
        } else {
            data.posts.push({ ...post, id: existingId, date: fallbackDate || new Date().toISOString(), createdAt: new Date().toISOString() });
        }
    } else {
        const maxOrder = data.posts.length > 0 ? Math.max(...data.posts.map(p => p.order || 0)) : 0;
        const newId = 'tx-' + Date.now().toString(36).slice(-6).toUpperCase();
        data.posts.push({
            ...post,
            id: newId,
            date: fallbackDate || new Date().toISOString(),
            order: maxOrder + 10,
            viewCount: 0,
            createdAt: new Date().toISOString()
        });
    }
    const saveRes = await fetch('/api/blog-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!saveRes.ok) throw new Error('Could not write local blog-data.json');
}

function encodeJSON() {
    const title = document.getElementById('compose-title').value.trim();
    const author = document.getElementById('compose-author').value.trim();
    const tagsRaw = document.getElementById('compose-tags').value;
    const excerpt = document.getElementById('compose-excerpt').value.trim();
    const image = document.getElementById('compose-image').value.trim();
    const contentRaw = document.getElementById('compose-content').value.trim();

    if (!title) { alert('Title is required.'); return; }

    let content = [];
    if (contentRaw) {
        try { content = JSON.parse(contentRaw); }
        catch (e) { alert('Content blocks JSON is invalid: ' + e.message); return; }
    }

    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
    const id = editingPostId || 'tx-' + Date.now().toString(36).slice(-6).toUpperCase();
    const date = new Date().toISOString();

    const payload = { id, title, author, date, tags, excerpt, featuredImage: image || undefined, content };
    document.getElementById('json-output').textContent = JSON.stringify(payload, null, 2);
    document.getElementById('json-output-wrap').classList.remove('hidden');
}

function downloadJSON() {
    const text = document.getElementById('json-output').textContent;
    if (!text) return;
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transmission.json';
    a.click();
    URL.revokeObjectURL(url);
}

async function downloadFullJSON() {
    try {
        const res = await fetch('/api/blog-data');
        if (!res.ok) throw new Error('Local API unreachable');
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'blog-data.json';
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        // Fallback: build from current allPosts
        const data = { posts: allPosts };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'blog-data.json';
        a.click();
        URL.revokeObjectURL(url);
    }
}

// ─── EDIT / ARCHIVE / VISIBILITY ───
async function editPost(id) {
    const post = allPosts.find(p => p.id === id);
    if (!post) return;
    editingPostId = id;
    populateComposer(post);
    openComposer();
}

async function toggleArchive(id) {
    const post = allPosts.find(p => p.id === id);
    if (!post) return;
    const newStatus = !post.isArchived;
    try {
        await db.collection('blogPosts').doc(id).update({ isArchived: newStatus, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        await loadPosts();
    } catch (e) {
        alert('Failed to update: ' + e.message);
    }
}

async function toggleVisibility(id) {
    const post = allPosts.find(p => p.id === id);
    if (!post) return;
    const newVis = post.isPublic === false ? true : false;
    try {
        await db.collection('blogPosts').doc(id).update({ isPublic: newVis, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        await loadPosts();
    } catch (e) {
        alert('Failed to update: ' + e.message);
    }
}

async function deletePost(id) {
    if (!confirm('Permanently delete this transmission? This cannot be undone.')) return;
    let firestoreOk = false;
    let localOk = false;

    // Try Firestore first
    try {
        await db.collection('blogPosts').doc(id).delete();
        firestoreOk = true;
    } catch (e) {
        console.warn('Firestore delete failed', e);
    }

    // Also try local JSON via API (dev-server fallback)
    try {
        const res = await fetch(`/api/blog-posts/${id}`, { method: 'DELETE' });
        if (res.ok) localOk = true;
    } catch (localErr) {
        console.warn('Local API delete failed', localErr);
    }

    if (firestoreOk || localOk) {
        showAuthMessage('Transmission deleted.', 'success');
        // Optimistically remove from local cache so UI updates immediately
        allPosts = allPosts.filter(p => p.id !== id);
        renderPosts();
    } else {
        alert('Failed to delete transmission.');
    }
}

// ─── DRAG AND DROP ───
let draggedId = null;

function dragStart(e, id) {
    if (!isAdmin()) return;
    draggedId = id;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function dragOver(e) {
    if (!isAdmin()) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const article = e.target.closest('article');
    if (article) article.classList.add('drag-over');
}

function dragDrop(e, targetId) {
    if (!isAdmin()) return;
    e.preventDefault();
    const article = e.target.closest('article');
    if (article) article.classList.remove('drag-over');
    if (!draggedId || draggedId === targetId) return;
    reorderPosts(draggedId, targetId);
    draggedId = null;
}

function dragEnd(e) {
    const article = e.target.closest('article');
    if (article) article.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

async function reorderPosts(draggedId, targetId) {
    const posts = [...allPosts].sort((a, b) => (b.order || 0) - (a.order || 0));
    const dragIdx = posts.findIndex(p => p.id === draggedId);
    const targetIdx = posts.findIndex(p => p.id === targetId);
    if (dragIdx === -1 || targetIdx === -1) return;

    // Swap order values
    const dragOrder = posts[dragIdx].order || 0;
    const targetOrder = posts[targetIdx].order || 0;

    try {
        await db.collection('blogPosts').doc(draggedId).update({ order: targetOrder, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        await db.collection('blogPosts').doc(targetId).update({ order: dragOrder, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
        await loadPosts();
    } catch (e) {
        alert('Failed to reorder: ' + e.message);
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closePostModal(); closeComposer(); }
});

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    loadPosts();
    renderAuthUI();
    renderAdminAuthUI();
    renderHeroButtons();
    renderNavAuth();
});
