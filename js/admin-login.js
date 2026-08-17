// ==================== ADMIN LOGIN GATE ====================
// This page is intentionally NOT guarded by admin-common.js — it IS
// the gate. If a signed-in admin lands here, bounce them straight to
// the dashboard instead of showing the form.
auth.onAuthStateChanged(async (user) => {
    const wrap = document.getElementById('admin-login-wrap');
    if (!user) {
        if (wrap) wrap.style.display = 'block';
        return;
    }

    let userDoc;
    try {
        userDoc = await db.collection('users').doc(user.uid).get();
    } catch (err) {
        console.error(err);
    }

    if (userDoc && userDoc.exists && userDoc.data().role === 'admin') {
        window.location.href = 'admin-dashboard.html';
    } else {
        if (wrap) wrap.style.display = 'block';
    }
});

async function handleAdminDirectLogin() {
    const email = document.getElementById('admin-login-email').value.trim();
    const password = document.getElementById('admin-login-password').value;
    const btn = document.getElementById('admin-login-btn');

    if (!email || !password) {
        showCustomAlert('Please enter email and password.');
        return;
    }

    btn.disabled = true;
    try {
        const cred = await auth.signInWithEmailAndPassword(email, password);
        const userDoc = await db.collection('users').doc(cred.user.uid).get();
        if (userDoc.exists && userDoc.data().role === 'admin') {
            window.location.href = 'admin-dashboard.html';
        } else {
            await auth.signOut();
            showCustomAlert('Access Denied: You are not authorized as an admin.');
        }
    } catch (err) {
        showCustomAlert(err.message);
    } finally {
        btn.disabled = false;
    }
}
