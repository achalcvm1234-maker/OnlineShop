window.pageInit = function () {
    refreshOrdersList();
};

const ORDER_STATUSES = ['Processing', 'Shipped', 'Delivered', 'Cancelled'];

async function refreshOrdersList() {
    const container = document.getElementById('admin-orders-list');
    if (!container) return;
    container.innerHTML = `<div class="loading-state">Loading orders…</div>`;

    try {
        const snap = await db.collection('orders').get();
        let orders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        orders.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

        if (orders.length === 0) {
            container.innerHTML = `<p class="empty-state">No customer orders found.</p>`;
            return;
        }

        let html = `<table><thead><tr>
            <th style="width:40px;"><input type="checkbox" onclick="toggleSelectAll(this, 'order-checkbox')"></th>
            <th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th><th>Action</th>
        </tr></thead><tbody>`;

        orders.forEach(ord => {
            const dateStr = ord.createdAt ? ord.createdAt.toDate().toLocaleString() : 'Just now';
            const userEmail = ord.userEmail || 'Unknown User';
            const status = ord.status || 'Processing';

            let itemsHtml = '';
            (ord.items || []).forEach(item => {
                itemsHtml += `
                    <div class="order-items-mini">
                        <img src="${item.image || PLACEHOLDER_IMG}">
                        <div>
                            <div><b>${escapeHtml(item.title)}</b></div>
                            <div style="color:#666;">Size: ${escapeHtml(item.size)} | Qty: ${item.qty} | ${formatPrice(item.price)}</div>
                        </div>
                    </div>
                `;
            });

            html += `<tr>
                <td data-label="Select"><input type="checkbox" class="order-checkbox" value="${ord.id}"></td>
                <td data-label="Order"><b>${ord.id}</b><div style="margin-top:6px;">${itemsHtml}</div></td>
                <td data-label="Customer">${escapeHtml(userEmail)}</td>
                <td data-label="Date">${dateStr}</td>
                <td data-label="Total"><strong style="color:var(--rose);">${formatPrice(ord.totalAmount || 0)}</strong></td>
                <td data-label="Status">
                    <select class="status-select" onchange="updateOrderStatus('${ord.id}', this.value)">
                        ${ORDER_STATUSES.map(s => `<option value="${s}" ${s === status ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </td>
                <td data-label="Action"><button type="button" class="btn btn-danger btn-sm" onclick="deleteSingleOrder('${ord.id}')">Delete</button></td>
            </tr>`;
        });
        html += `</tbody></table>`;
        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = `<p class="empty-state" style="color:var(--danger);">Error loading orders: ${escapeHtml(err.message)}</p>`;
    }
}

async function updateOrderStatus(orderId, status) {
    try {
        await db.collection('orders').doc(orderId).update({ status });
    } catch (err) {
        showCustomAlert('Could not update status: ' + err.message);
    }
}

async function deleteSingleOrder(id) {
    if (!confirm('Delete this order?')) return;
    await db.collection('orders').doc(id).delete();
    await refreshOrdersList();
}

async function deleteSelectedOrders() {
    const checkboxes = document.querySelectorAll('.order-checkbox:checked');
    if (checkboxes.length === 0) { showCustomAlert('Please select at least one order to delete.'); return; }
    if (!confirm(`Delete ${checkboxes.length} selected order(s)?`)) return;

    for (const cb of checkboxes) {
        await db.collection('orders').doc(cb.value).delete();
    }
    await refreshOrdersList();
    showCustomAlert('Selected orders deleted successfully!');
}
