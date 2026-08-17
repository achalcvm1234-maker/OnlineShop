// ==================== APP STATE (storefront) ====================
let currentUser = null;
let currentRole = 'user';
let isRegisterMode = false;

// ==================== AUTH & SESSION LISTENER ====================
auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    const welcomeElem = document.getElementById('user-welcome-msg');
    const authBtn = document.getElementById('nav-auth-btn');
    const logoutBtn = document.getElementById('nav-logout-btn');
    const ordersNav = document.getElementById('nav-orders');
    const wishlistNav = document.getElementById('nav-wishlist');
    const adminLink = document.getElementById('nav-admin-link');

    if (user) {
        let userDoc;
        try {
            userDoc = await db.collection('users').doc(user.uid).get();
        } catch (err) {
            console.error('Failed to load user profile:', err);
        }

        if (userDoc && userDoc.exists) {
            currentRole = userDoc.data().role || 'user';
        } else {
            currentRole = 'user';
            await db.collection('users').doc(user.uid).set({
                email: user.email,
                role: 'user',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        if (welcomeElem) {
            welcomeElem.innerText = `Hi, ${user.email.split('@')[0]}`;
            welcomeElem.style.display = 'inline-flex';
        }
        if (authBtn) authBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'inline-flex';
        if (ordersNav) ordersNav.style.display = 'inline-flex';
        if (wishlistNav) wishlistNav.style.display = 'inline-flex';
        if (currentRole === 'admin' && adminLink) adminLink.style.display = 'inline-flex';

        if (typeof loadUserCart === 'function') loadUserCart();
        if (typeof loadWishlist === 'function') loadWishlist();
    } else {
        currentRole = 'user';
        if (welcomeElem) welcomeElem.style.display = 'none';
        if (authBtn) authBtn.style.display = 'inline-flex';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (ordersNav) ordersNav.style.display = 'none';
        if (wishlistNav) wishlistNav.style.display = 'none';
        if (adminLink) adminLink.style.display = 'none';

        if (typeof updateCartUI === 'function') updateCartUI([]);
        if (typeof updateWishlistUI === 'function') updateWishlistUI([]);
    }

    if (typeof loadStorefrontData === 'function') loadStorefrontData();
});

function logoutUser() {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    });
}

// ==================== AUTH MODAL LOGIC ====================
function openAuthModal() { document.getElementById('auth-modal').style.display = 'flex'; }
function closeAuthModal() { document.getElementById('auth-modal').style.display = 'none'; }

function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    document.getElementById('auth-title').innerText = isRegisterMode ? 'Create Account' : 'Login to Your Account';
    document.getElementById('auth-submit-btn').innerText = isRegisterMode ? 'Register' : 'Login';
    document.getElementById('auth-switch-text').innerText = isRegisterMode ? 'Already have an account?' : "Don't have an account?";
    const phoneGroup = document.getElementById('auth-phone-group');
    if (phoneGroup) phoneGroup.style.display = isRegisterMode ? 'block' : 'none';
}

async function handleAuthSubmit() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const phoneInput = document.getElementById('auth-phone');
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const submitBtn = document.getElementById('auth-submit-btn');

    if (!email || !password) {
        showCustomAlert('Please enter email and password.');
        return;
    }
    if (isRegisterMode && !phone) {
        showCustomAlert('Please enter your phone number.');
        return;
    }

    submitBtn.disabled = true;
    try {
        if (isRegisterMode) {
            const cred = await auth.createUserWithEmailAndPassword(email, password);
            await db.collection('users').doc(cred.user.uid).set({
                email: email,
                phone: phone,
                role: 'user',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showCustomAlert('Account registered successfully!');
        } else {
            await auth.signInWithEmailAndPassword(email, password);
            showCustomAlert('Logged in successfully!');
        }
        closeAuthModal();
    } catch (error) {
        showCustomAlert(error.message);
    } finally {
        submitBtn.disabled = false;
    }
}

// ==================== CONTACT US MODAL ====================
function openContactModal() { document.getElementById('contact-modal').style.display = 'flex'; }
function closeContactModal() { document.getElementById('contact-modal').style.display = 'none'; }

async function submitContactForm() {
    const name = document.getElementById('contact-name').value.trim();
    const email = document.getElementById('contact-email').value.trim();
    const message = document.getElementById('contact-msg').value.trim();

    if (!name || !email || !message) {
        showCustomAlert('Please fill all fields.');
        return;
    }

    try {
        await db.collection('contacts').add({
            name, email, message,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showCustomAlert('Your message has been sent successfully!');
        document.getElementById('contact-name').value = '';
        document.getElementById('contact-email').value = '';
        document.getElementById('contact-msg').value = '';
        closeContactModal();
    } catch (err) {
        showCustomAlert('Error: ' + err.message);
    }
}
