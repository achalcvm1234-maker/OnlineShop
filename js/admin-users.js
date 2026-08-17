window.pageInit = function () {
    refreshUsersList();
};

async function refreshUsersList() {
    const container = document.getElementById('admin-users-list');
    if (!container) return;
    container.innerHTML = `<div class="loading-state">Loading users…</div>`;

    const userSnap = await db.collection('users').get();
    const users = userSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (users.length === 0) {
        container.innerHTML = `<p class="empty-state">No users found.</p>`;
        return;
    }

    container.innerHTML =
        `<table><thead><tr>
            <th style="width:40px;"><input type="checkbox" onclick="toggleSelectAll(this, 'user-checkbox')"></th>
            <th>Email</th><th>Phone</th><th>Role</th><th>Action</th>
         </tr></thead><tbody>` +
        users.map(u => `<tr>
            <td data-label="Select">${u.role !== 'admin' ? `<input type="checkbox" class="user-checkbox" value="${u.id}">` : ''}</td>
            <td data-label="Email">${escapeHtml(u.email)}</td>
            <td data-label="Phone">${escapeHtml(u.phone) || '–'}</td>
            <td data-label="Role">${escapeHtml(u.role || 'user')}</td>
            <td data-label="Action">${u.role !== 'admin' ? `<button type="button" class="btn btn-danger btn-sm" onclick="deleteUserDoc('${u.id}')">Delete</button>` : '<span style="color:var(--ink-soft); font-size:12px;">Protected</span>'}</td>
        </tr>`).join('') + `</tbody></table>`;
}

async function deleteUserDoc(id) {
    if (!confirm('Delete this user profile record? (Does not delete their login account.)')) return;
    await db.collection('users').doc(id).delete();
    await refreshUsersList();
}

async function deleteSelectedUsers() {
    const checkboxes = document.querySelectorAll('.user-checkbox:checked');
    if (checkboxes.length === 0) { showCustomAlert('Please select at least one user to delete.'); return; }
    if (!confirm(`Delete ${checkboxes.length} selected user(s)?`)) return;

    for (const cb of checkboxes) {
        await db.collection('users').doc(cb.value).delete();
    }
    await refreshUsersList();
    showCustomAlert('Selected users deleted successfully!');
}
