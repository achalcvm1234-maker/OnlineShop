// ==================== PERSISTENT CART LOGIC ====================
async function loadUserCart() {
    if (!currentUser) return;
    const cartDoc = await db.collection('carts').doc(currentUser.uid).get();
    updateCartUI(cartDoc.exists ? (cartDoc.data().items || []) : []);
}

async function saveUserCart(items) {
    if (!currentUser) return;
    await db.collection('carts').doc(currentUser.uid).set({ items });
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

    const cartDoc = await db.collection('carts').doc(currentUser.uid).get();
    let items = cartDoc.exists ? (cartDoc.data().items || []) : [];

    const existingIndex = items.findIndex(item => item.productId === productId && item.size === selectedSize);
    if (existingIndex > -1) {
        items[existingIndex].qty += 1;
    } else {
        items.push({
            productId: product.id,
            title: product.title,
            price: product.price,
            image: (product.images && product.images[0]) || '',
            size: selectedSize,
            qty: 1,
            selected: true
        });
    }

    await saveUserCart(items);
    updateCartUI(items);
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

async function toggleCartSelectAll(checked) {
    if (!currentUser) return;
    const cartDoc = await db.collection('carts').doc(currentUser.uid).get();
    if (!cartDoc.exists) return;
    let items = cartDoc.data().items || [];
    items.forEach(item => { item.selected = checked; });
    await saveUserCart(items);
    updateCartUI(items);
}

async function removeSelectedCartItems() {
    if (!currentUser) return;
    const cartDoc = await db.collection('carts').doc(currentUser.uid).get();
    if (!cartDoc.exists) return;
    let items = cartDoc.data().items || [];
    const remainingItems = items.filter(item => item.selected === false);

    if (remainingItems.length === items.length) {
        showCustomAlert('Please select at least one item to remove.');
        return;
    }

    await saveUserCart(remainingItems);
    updateCartUI(remainingItems);
    showCustomAlert('Selected items removed successfully!');
}

async function toggleCartItemSelection(index, isChecked) {
    if (!currentUser) return;
    const cartDoc = await db.collection('carts').doc(currentUser.uid).get();
    if (!cartDoc.exists) return;
    let items = cartDoc.data().items || [];
    if (items[index]) {
        items[index].selected = isChecked;
        await saveUserCart(items);
        updateCartUI(items);
    }
}

async function changeCartItemQty(index, change) {
    if (!currentUser) return;
    const cartDoc = await db.collection('carts').doc(currentUser.uid).get();
    if (!cartDoc.exists) return;
    let items = cartDoc.data().items || [];
    if (items[index]) {
        items[index].qty += change;
        if (items[index].qty <= 0) items.splice(index, 1);
        await saveUserCart(items);
        updateCartUI(items);
    }
}

async function removeCartItem(index) {
    if (!currentUser) return;
    const cartDoc = await db.collection('carts').doc(currentUser.uid).get();
    if (!cartDoc.exists) return;
    let items = cartDoc.data().items || [];
    items.splice(index, 1);
    await saveUserCart(items);
    updateCartUI(items);
}

function openCartModal() {
    if (!currentUser) {
        showCustomAlert('Please login to view your cart.');
        openAuthModal();
        return;
    }
    loadUserCart();
    document.getElementById('cart-modal').style.display = 'flex';
}
function closeCartModal() { document.getElementById('cart-modal').style.display = 'none'; }
