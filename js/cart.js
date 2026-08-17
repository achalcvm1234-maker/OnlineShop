// ==================== PERSISTENT CART LOGIC ====================
// cartItemsCache is the in-memory source of truth for the cart while the
// app is open. Every mutation (qty, select, remove) updates this array
// and re-renders instantly — Firestore is only touched afterwards, in
// the background, so the person never waits on a network round trip
// just to see a + or - register.
let cartItemsCache = [];
let cartSaveTimer = null;

async function loadUserCart() {
    if (!currentUser) {
        cartItemsCache = [];
        updateCartUI(cartItemsCache);
        return;
    }
    const cartDoc = await db.collection('carts').doc(currentUser.uid).get();
    cartItemsCache = cartDoc.exists ? (cartDoc.data().items || []) : [];
    updateCartUI(cartItemsCache);
}

// Debounced background save: rapid-fire +/- clicks coalesce into a
// single Firestore write ~350ms after the last change, instead of one
// write per click.
function persistCartSoon() {
    if (!currentUser) return;
    if (cartSaveTimer) clearTimeout(cartSaveTimer);
    const uid = currentUser.uid;
    const snapshot = cartItemsCache.slice(); // capture current state for this save
    cartSaveTimer = setTimeout(() => {
        db.collection('carts').doc(uid).set({ items: snapshot }).catch(err => {
            console.error('Cart save failed:', err);
        });
    }, 350);
}

async function addToCart(productId, showAlert = true) {
    if (!currentUser) {
        showCustomAlert('Please login first to add items to your cart.');
        openAuthModal();
        return false;
    }

    const product = productsCache.find(p => p.id === productId);
    if (!product) return false;

    let selectedSize = 'Standard';
    if (product.sizeType === 'manual') {
        // The same product can have a size <select> both on its grid card
        // and inside the open detail modal at the same time. Prefer the
        // modal's select when the detail modal is actually open — that's
        // the one the person is looking at and just chose a size in.
        const detailModal = document.getElementById('product-detail-modal');
        const modalOpen = detailModal && detailModal.style.display === 'flex';
        const selectElem = modalOpen
            ? document.getElementById(`detail-size-select-${productId}`)
            : document.getElementById(`size-select-${productId}`);
        if (selectElem) selectedSize = selectElem.value;
    }

    const existingIndex = cartItemsCache.findIndex(item => item.productId === productId && item.size === selectedSize);
    if (existingIndex > -1) {
        cartItemsCache[existingIndex].qty += 1;
    } else {
        cartItemsCache.push({
            productId: product.id,
            title: product.title,
            price: product.price,
            image: (product.images && product.images[0]) || '',
            size: selectedSize,
            qty: 1,
            selected: true
        });
    }

    updateCartUI(cartItemsCache);
    persistCartSoon();
    if (showAlert) showCustomAlert('Product added to cart successfully!');
    return true;
}

async function buyNow(productId) {
    if (!currentUser) {
        showCustomAlert('Please login to purchase items.');
        openAuthModal();
        return;
    }
    const success = await addToCart(productId, false);
    if (success) openCartModal();
}

function updateCartUI(items) {
    const countElem = document.getElementById('cart-count');
    if (countElem) countElem.innerText = items.length;

    const container = document.getElementById('cart-items-container');
    const totalElem = document.getElementById('cart-total');
    if (!container || !totalElem) return;

    if (items.length === 0) {
        container.innerHTML = `<p class="empty-state">Your cart is empty.</p>`;
        totalElem.innerText = formatPrice(0);
        return;
    }

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid var(--blush);">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; font-weight: 600;">
                <input type="checkbox" id="cart-select-all" data-action="cart-select-all" style="width: 18px; height: 18px; cursor: pointer;"> Select All
            </label>
            <button type="button" class="btn btn-danger" data-action="cart-remove-selected">Remove Selected</button>
        </div>
    `;

    let total = 0;
    items.forEach((item, idx) => {
        const isChecked = item.selected !== false;
        const subtotal = item.price * item.qty;
        if (isChecked) total += subtotal;

        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--blush); padding-bottom:12px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" class="cart-item-checkbox" ${isChecked ? 'checked' : ''} data-action="cart-toggle-item" data-idx="${idx}" style="width:18px; height:18px; cursor:pointer;">
                    <img src="${item.image || PLACEHOLDER_IMG}" style="width:55px; height:55px; object-fit:cover; border-radius:8px; border:1px solid var(--blush-deep);">
                    <div>
                        <strong style="font-size:15px; color:#333;">${escapeHtml(item.title)}</strong><br>
                        <small style="color:#666;">Size: ${escapeHtml(item.size)} | Unit: ${formatPrice(item.price)}</small>
                        <div style="display:flex; align-items:center; gap:8px; margin-top:6px;">
                            <button type="button" data-action="cart-qty" data-idx="${idx}" data-change="-1" style="width:24px; height:24px; background:var(--blush); border:1px solid var(--blush-deep); border-radius:4px; cursor:pointer; font-weight:bold;">-</button>
                            <span style="font-weight:bold; font-size:14px; min-width:20px; text-align:center;">${item.qty}</span>
                            <button type="button" data-action="cart-qty" data-idx="${idx}" data-change="1" style="width:24px; height:24px; background:var(--blush); border:1px solid var(--blush-deep); border-radius:4px; cursor:pointer; font-weight:bold;">+</button>
                        </div>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
                    <span style="font-weight:bold; font-size:15px; color:var(--rose);">${formatPrice(subtotal)}</span>
                    <button type="button" class="btn btn-danger" style="padding:5px 10px; font-size:11px;" data-action="cart-remove" data-idx="${idx}">Remove</button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
    totalElem.innerText = formatPrice(total);
}

function toggleCartSelectAll(checked) {
    if (!currentUser) return;
    cartItemsCache.forEach(item => { item.selected = checked; });
    updateCartUI(cartItemsCache);
    persistCartSoon();
}

function removeSelectedCartItems() {
    if (!currentUser) return;
    const remaining = cartItemsCache.filter(item => item.selected === false);

    if (remaining.length === cartItemsCache.length) {
        showCustomAlert('Please select at least one item to remove.');
        return;
    }

    cartItemsCache = remaining;
    updateCartUI(cartItemsCache);
    persistCartSoon();
    showCustomAlert('Selected items removed successfully!');
}

function toggleCartItemSelection(index, isChecked) {
    if (!currentUser || !cartItemsCache[index]) return;
    cartItemsCache[index].selected = isChecked;
    updateCartUI(cartItemsCache);
    persistCartSoon();
}

function changeCartItemQty(index, change) {
    if (!currentUser || !cartItemsCache[index]) return;
    cartItemsCache[index].qty += change;
    if (cartItemsCache[index].qty <= 0) cartItemsCache.splice(index, 1);
    updateCartUI(cartItemsCache);
    persistCartSoon();
}

function removeCartItem(index) {
    if (!currentUser) return;
    cartItemsCache.splice(index, 1);
    updateCartUI(cartItemsCache);
    persistCartSoon();
}

function openCartModal() {
    if (!currentUser) {
        showCustomAlert('Please login to view your cart.');
        openAuthModal();
        return;
    }
    // Render instantly from the local cache — no network wait to open —
    // then quietly re-sync with Firestore in case another device/tab
    // changed the cart since it was last loaded.
    updateCartUI(cartItemsCache);
    document.getElementById('cart-modal').style.display = 'flex';
    loadUserCart();
}
function closeCartModal() { document.getElementById('cart-modal').style.display = 'none'; }
