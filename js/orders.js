// ==================== CHECKOUT & ORDERS ====================
const ORDER_CANCEL_WINDOW_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

async function checkoutOrder() {
    if (!currentUser) {
        showCustomAlert('Please login to checkout.');
        openAuthModal();
        return;
    }

    // Checkout reads from cartItemsCache (the in-memory source of truth),
    // not a fresh Firestore fetch — a qty/select change can still be
    // sitting in the debounced save queue, so re-fetching here could
    // read stale data and checkout the wrong quantities.
    if (cartItemsCache.length === 0) {
        showCustomAlert('Your cart is empty.');
        return;
    }

    const selectedItems = cartItemsCache.filter(item => item.selected !== false);

    if (selectedItems.length === 0) {
        showCustomAlert('Please select at least one item to checkout.');
        return;
    }

    const total = selectedItems.reduce((sum, item) => sum + (item.price * item.qty), 0);

    try {
        await db.collection('orders').add({
            userId: currentUser.uid,
            userEmail: currentUser.email,
            items: selectedItems,
            totalAmount: total,
            status: 'Processing',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Cancel any pending debounced cart save — we're about to write
        // the authoritative post-checkout cart state ourselves.
        if (cartSaveTimer) clearTimeout(cartSaveTimer);

        cartItemsCache = cartItemsCache.filter(item => item.selected === false);
        await db.collection('carts').doc(currentUser.uid).set({ items: cartItemsCache });

        updateCartUI(cartItemsCache);
        closeCartModal();
        showCustomAlert('Selected order(s) successfully placed!');
    } catch (err) {
        showCustomAlert('Checkout error: ' + err.message);
    }
}

function openOrdersModal() {
    if (!currentUser) return;
    loadUserOrders();
    document.getElementById('orders-modal').style.display = 'flex';
}
function closeOrdersModal() { document.getElementById('orders-modal').style.display = 'none'; }

async function loadUserOrders() {
    const container = document.getElementById('orders-list-container');
    if (!container) return;
    container.innerHTML = `<div class="loading-state">Loading your orders…</div>`;

    const snap = await db.collection('orders').where('userId', '==', currentUser.uid).get();
    let orders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    orders.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

    if (orders.length === 0) {
        container.innerHTML = `<p class="empty-state">No order history found.</p>`;
        return;
    }

    let html = '';
    orders.forEach(ord => {
        const dateStr = ord.createdAt ? ord.createdAt.toDate().toLocaleString() : 'Just now';
        const status = ord.status || 'Processing';
        const createdMs = ord.createdAt ? ord.createdAt.toMillis() : 0;
        const withinWindow = createdMs > 0 && (Date.now() - createdMs) < ORDER_CANCEL_WINDOW_MS;
        const isFinal = status === 'Cancelled' || status === 'Delivered';
        const canCancel = withinWindow && !isFinal;
        const badgeStyle = status === 'Cancelled'
            ? 'background:#FBE2E2; color:var(--danger);'
            : status === 'Delivered'
                ? 'background:#E4F5EA; color:var(--success);'
                : 'background:var(--blush); color:var(--rose);';

        let itemsHtml = '';
        (ord.items || []).forEach(item => {
            itemsHtml += `
                <div class="order-items-mini">
                    <img src="${item.image || PLACEHOLDER_IMG}">
                    <div style="line-height:1.4;">
                        <div style="font-weight:bold; font-size:14px; color:#333;">${escapeHtml(item.title)}</div>
                        <div style="font-size:13px; color:#666;">Size: ${escapeHtml(item.size)} &nbsp;|&nbsp; Qty: ${item.qty}</div>
                    </div>
                </div>
            `;
        });

        let footerHtml = '';
        if (canCancel) {
            footerHtml = `<div style="text-align:right; margin-top:10px;"><button type="button" class="btn btn-danger btn-sm" data-action="cancel-order" data-order="${ord.id}">Cancel Order</button></div>`;
        } else if (!isFinal && createdMs > 0) {
            footerHtml = `<div style="text-align:right; margin-top:10px;"><small style="color:var(--ink-soft);">Cancellation window (2 days) has passed.</small></div>`;
        }

        html += `
            <div style="background:var(--cream); padding:15px; border-radius:12px; margin-bottom:15px; border:1px solid var(--blush-deep);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; gap:10px;">
                    <div>
                        <strong style="color:#222; font-size:15px;">Order ID: ${ord.id}</strong><br>
                        <small style="color:#777;">Date: ${dateStr}</small>
                    </div>
                    <span class="status-badge" style="${badgeStyle}">${escapeHtml(status)}</span>
                </div>
                <div style="margin:12px 0;">${itemsHtml}</div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding-top:12px; border-top:1px dashed var(--blush-deep);">
                    <span></span>
                    <span>
                        <span style="font-size:15px; color:#555;">Total Amount:</span>
                        <span style="color:var(--rose); font-weight:bold; font-size:18px; margin-left:8px;">${formatPrice(ord.totalAmount || 0)}</span>
                    </span>
                </div>
                ${footerHtml}
            </div>
        `;
    });
    container.innerHTML = html;
}

// A user can cancel their own order only within 2 days of placing it, and
// only while it hasn't already been Delivered/Cancelled. The same rule is
// enforced server-side in firestore.rules, so this check is a UX
// convenience, not the actual security boundary.
async function cancelOrder(orderId) {
    if (!currentUser) return;
    if (!confirm('Cancel this order? This cannot be undone.')) return;

    try {
        await db.collection('orders').doc(orderId).update({ status: 'Cancelled' });
        showCustomAlert('Your order has been cancelled.');
        await loadUserOrders();
    } catch (err) {
        showCustomAlert('Could not cancel this order: ' + err.message);
    }
}
