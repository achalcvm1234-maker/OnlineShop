// ==================== ADMIN APP STATE ====================
let currentUser = null;
let currentRole = 'user';
let productsCache = [];
let categoriesCache = [];

// ==================== AUTH GUARD ====================
// Every protected admin page loads this file. It decides, once, whether
// the visitor is allowed to be here — no page-specific duplication.
auth.onAuthStateChanged(async (user) => {
    currentUser = user;

    if (!user) {
        window.location.href = 'admin.html';
        return;
    }

    let userDoc;
    try {
        userDoc = await db.collection('users').doc(user.uid).get();
    } catch (err) {
        console.error('Failed to verify admin role:', err);
    }
    currentRole = (userDoc && userDoc.exists) ? (userDoc.data().role || 'user') : 'user';

    if (currentRole !== 'admin') {
        await auth.signOut();
        window.location.href = 'admin.html';
        return;
    }

    document.body.classList.add('admin-ready');
    const emailElem = document.getElementById('sidebar-user-email');
    if (emailElem) emailElem.innerText = user.email;

    // Each page defines window.pageInit() for its own data loading.
    if (typeof window.pageInit === 'function') window.pageInit();
});

function logoutUser() {
    auth.signOut().then(() => {
        window.location.href = 'admin.html';
    });
}

// ==================== MOBILE VERTICAL NAVBAR (off-canvas) ====================
document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const openBtn = document.getElementById('sidebar-toggle');
    const closeBtn = document.getElementById('sidebar-close');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar) return;

    function openSidebar() { sidebar.classList.add('open'); if (backdrop) backdrop.classList.add('open'); }
    function closeSidebar() { sidebar.classList.remove('open'); if (backdrop) backdrop.classList.remove('open'); }

    if (openBtn) openBtn.addEventListener('click', openSidebar);
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
    if (backdrop) backdrop.addEventListener('click', closeSidebar);
});

// ==================== SHARED TABLE HELPERS ====================
function toggleSelectAll(masterCheckbox, className) {
    document.querySelectorAll('.' + className).forEach(cb => cb.checked = masterCheckbox.checked);
}

async function loadDashboardStats() {
    try {
        const [prodSnap, catSnap, userSnap, orderSnap] = await Promise.all([
            db.collection('products').get(),
            db.collection('categories').get(),
            db.collection('users').get(),
            db.collection('orders').get()
        ]);
        const statProd = document.getElementById('stat-total-products');
        const statCat = document.getElementById('stat-total-categories');
        const statUser = document.getElementById('stat-total-users');
        const statOrder = document.getElementById('stat-total-orders');
        if (statProd) statProd.innerText = prodSnap.size;
        if (statCat) statCat.innerText = catSnap.size;
        if (statUser) statUser.innerText = userSnap.size;
        if (statOrder) statOrder.innerText = orderSnap.size;
    } catch (err) {
        console.error('Error loading dashboard stats:', err);
    }
}
