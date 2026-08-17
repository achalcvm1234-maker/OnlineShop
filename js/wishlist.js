// ==================== WISHLIST (NEW FEATURE) ====================
let wishlistCache = [];

async function loadWishlist() {
    if (!currentUser) { wishlistCache = []; return; }
    const doc = await db.collection('wishlists').doc(currentUser.uid).get();
    wishlistCache = doc.exists ? (doc.data().productIds || []) : [];
    updateWishlistUI(wishlistCache);
}

function updateWishlistUI(ids) {
    const badge = document.getElementById('wishlist-count');
    if (badge) badge.innerText = ids.length;
}

async function toggleWishlist(productId) {
    if (!currentUser) {
        showCustomAlert('Please login to save items to your wishlist.');
        openAuthModal();
        return;
    }

    const idx = wishlistCache.indexOf(productId);
    if (idx > -1) {
        wishlistCache.splice(idx, 1);
    } else {
        wishlistCache.push(productId);
    }

    await db.collection('wishlists').doc(currentUser.uid).set({ productIds: wishlistCache });
    updateWishlistUI(wishlistCache);

    // Reflect the change on the visible card immediately without a full re-render.
    const heartBtn = document.querySelector(`.wishlist-heart[data-product="${productId}"]`);
    if (heartBtn) {
        const active = wishlistCache.includes(productId);
        heartBtn.classList.toggle('active', active);
        heartBtn.innerText = active ? '♥' : '♡';
    }

    const modal = document.getElementById('wishlist-modal');
    if (modal && modal.style.display === 'flex') renderWishlistModal();
}

function openWishlistModal() {
    if (!currentUser) {
        showCustomAlert('Please login to view your wishlist.');
        openAuthModal();
        return;
    }
    renderWishlistModal();
    document.getElementById('wishlist-modal').style.display = 'flex';
}
function closeWishlistModal() { document.getElementById('wishlist-modal').style.display = 'none'; }

function renderWishlistModal() {
    const container = document.getElementById('wishlist-items-container');
    if (!container) return;

    const items = productsCache.filter(p => wishlistCache.includes(p.id));
    if (items.length === 0) {
        container.innerHTML = `<p class="empty-state">Your wishlist is empty. Tap the ♡ on any product to save it here.</p>`;
        return;
    }

    container.innerHTML = items.map(p => `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--blush); padding-bottom:12px;">
            <div style="display:flex; align-items:center; gap:10px;">
                <img src="${(p.images && p.images[0]) || PLACEHOLDER_IMG}" style="width:55px; height:55px; object-fit:cover; border-radius:8px; border:1px solid var(--blush-deep);">
                <div>
                    <strong style="font-size:15px; color:#333;">${escapeHtml(p.title)}</strong><br>
                    <small style="color:var(--rose); font-weight:700;">${formatPrice(p.price)}</small>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-end;">
                <button type="button" class="btn btn-sm" data-action="wishlist-add-to-cart" data-product="${p.id}">Add to Cart</button>
                <button type="button" class="btn btn-danger btn-sm" data-action="wishlist-remove" data-product="${p.id}">Remove</button>
            </div>
        </div>
    `).join('');
}
