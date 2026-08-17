window.pageInit = function () {
    refreshCategoriesList();
};

async function refreshCategoriesList() {
    const list = document.getElementById('admin-categories-list');
    if (list) list.innerHTML = `<div class="loading-state">Loading categories…</div>`;

    const catSnap = await db.collection('categories').get();
    categoriesCache = catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (!list) return;
    list.innerHTML = categoriesCache.length > 0 ?
        `<table><thead><tr>
            <th style="width:40px;"><input type="checkbox" onclick="toggleSelectAll(this, 'cat-checkbox')"></th>
            <th>Category Name</th><th>Action</th>
         </tr></thead><tbody>` +
        categoriesCache.map(c => `<tr>
            <td data-label="Select"><input type="checkbox" class="cat-checkbox" value="${c.id}"></td>
            <td data-label="Name">${escapeHtml(c.name)}</td>
            <td data-label="Action"><button type="button" class="btn btn-danger btn-sm" onclick="deleteCategory('${c.id}')">Delete</button></td>
        </tr>`).join('') + `</tbody></table>` :
        `<p class="empty-state">No categories added yet.</p>`;
}

async function handleAddCategory() {
    const input = document.getElementById('cat-name');
    const name = input.value.trim();
    if (!name) { showCustomAlert('Enter category name.'); return; }

    try {
        await db.collection('categories').add({ name });
        input.value = '';
        await refreshCategoriesList();
        showCustomAlert('Category added successfully!');
    } catch (err) {
        showCustomAlert('Error adding category: ' + err.message);
    }
}

async function deleteCategory(id) {
    if (!confirm('Delete this category?')) return;
    await db.collection('categories').doc(id).delete();
    await refreshCategoriesList();
}

async function deleteSelectedCategories() {
    const checkboxes = document.querySelectorAll('.cat-checkbox:checked');
    if (checkboxes.length === 0) { showCustomAlert('Please select at least one category to delete.'); return; }
    if (!confirm(`Delete ${checkboxes.length} selected category(ies)?`)) return;

    for (const cb of checkboxes) {
        await db.collection('categories').doc(cb.value).delete();
    }
    await refreshCategoriesList();
    showCustomAlert('Selected categories deleted successfully!');
}
