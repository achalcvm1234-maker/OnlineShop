window.pageInit = function () {
    loadProductsPageData();
    setupImageDropzone('prod-images-dropzone', 'prod-images', 'prod-images-preview');
    setupImageDropzone('edit-prod-images-dropzone', 'edit-prod-images', 'edit-prod-images-preview');
};

const MAX_PRODUCT_IMAGES = 4;
const MIN_PRODUCT_IMAGES = 1;

// Wires a dropzone (click-to-browse + drag & drop) to a hidden file
// input, and keeps a thumbnail preview in sync. Reusable for both the
// "Add Product" form and the "Edit Product" modal.
function setupImageDropzone(dropzoneId, inputId, previewId) {
    const dropzone = document.getElementById(dropzoneId);
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!dropzone || !input || !preview) return;

    function setFiles(files) {
        const limited = Array.from(files).slice(0, MAX_PRODUCT_IMAGES);
        const dt = new DataTransfer();
        limited.forEach(f => dt.items.add(f));
        input.files = dt.files;
        renderPreview();
    }

    function renderPreview() {
        preview.querySelectorAll('img').forEach(img => URL.revokeObjectURL(img.src));
        preview.innerHTML = '';
        Array.from(input.files).forEach((file, idx) => {
            const url = URL.createObjectURL(file);
            const thumb = document.createElement('div');
            thumb.className = 'dropzone-thumb';
            thumb.innerHTML = `<img src="${url}" alt="${escapeHtml(file.name)}"><button type="button" class="dropzone-thumb-remove" data-idx="${idx}" aria-label="Remove image">&times;</button>`;
            preview.appendChild(thumb);
        });
        dropzone.classList.toggle('has-files', input.files.length > 0);
    }

    dropzone.addEventListener('click', () => input.click());
    dropzone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
    });

    ['dragenter', 'dragover'].forEach(evt => {
        dropzone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('dragover');
        });
    });
    ['dragleave', 'dragend', 'drop'].forEach(evt => {
        dropzone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragover');
        });
    });
    dropzone.addEventListener('drop', (e) => {
        const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
        if (files.length === 0) return;
        setFiles(files);
    });

    preview.addEventListener('click', (e) => {
        const btn = e.target.closest('.dropzone-thumb-remove');
        if (!btn) return;
        const idx = Number(btn.dataset.idx);
        const remaining = Array.from(input.files).filter((_, i) => i !== idx);
        setFiles(remaining);
    });

    input.addEventListener('change', renderPreview);

    // Expose a reset hook so form-reset code can clear the preview too.
    dropzone._resetPreview = () => {
        input.value = '';
        renderPreview();
    };
}

async function loadProductsPageData() {
    const catSnap = await db.collection('categories').get();
    categoriesCache = catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const selectElem = document.getElementById('prod-category');
    if (selectElem) {
        selectElem.innerHTML = categoriesCache.length > 0 ?
            categoriesCache.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('') :
            `<option value="">No categories available — add one first</option>`;
    }

    await refreshProductsList();
}

async function refreshProductsList() {
    const list = document.getElementById('admin-products-list');
    if (list) list.innerHTML = `<div class="loading-state">Loading products…</div>`;

    const prodSnap = await db.collection('products').get();
    productsCache = prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (!list) return;
    list.innerHTML = productsCache.length > 0 ?
        `<table><thead><tr>
            <th style="width:40px;"><input type="checkbox" onclick="toggleSelectAll(this, 'prod-checkbox')"></th>
            <th>Title</th><th>Category</th><th>Price</th><th>Action</th>
         </tr></thead><tbody>` +
        productsCache.map(p => `<tr>
            <td data-label="Select"><input type="checkbox" class="prod-checkbox" value="${p.id}"></td>
            <td data-label="Title"><div class="row-thumb"><img src="${(p.images && p.images[0]) || PLACEHOLDER_IMG}"><span>${escapeHtml(p.title)}</span></div></td>
            <td data-label="Category">${escapeHtml(p.category)}</td>
            <td data-label="Price">${formatPrice(p.price)}</td>
            <td data-label="Action">
                <button type="button" class="btn btn-sm" onclick="openEditProductModal('${p.id}')">Edit</button>
                <button type="button" class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}')">Delete</button>
            </td>
        </tr>`).join('') + `</tbody></table>` :
        `<p class="empty-state">No products added yet.</p>`;
}

function toggleSizeInputs() {
    const type = document.getElementById('size-type-select').value;
    document.getElementById('manual-size-group').style.display = type === 'manual' ? 'block' : 'none';
}

function toggleEditSizeInputs() {
    const type = document.getElementById('edit-size-type-select').value;
    document.getElementById('edit-manual-size-group').style.display = type === 'manual' ? 'block' : 'none';
}

// Resizes + compresses on the client so uploads stay fast and Firestore
// documents stay small (each image capped near 1MB).
function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX = 1024;

                if (width > height) {
                    if (width > MAX) { height = Math.round((height * MAX) / width); width = MAX; }
                } else {
                    if (height > MAX) { width = Math.round((width * MAX) / height); height = MAX; }
                }

                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);

                let quality = 0.9;
                let dataUrl = canvas.toDataURL('image/jpeg', quality);
                while (dataUrl.length > 1048576 * 1.33 && quality > 0.1) {
                    quality -= 0.1;
                    dataUrl = canvas.toDataURL('image/jpeg', quality);
                }
                resolve(dataUrl);
            };
            img.onerror = reject;
            img.src = event.target.result;
        };
        reader.onerror = reject;
    });
}

async function handleAddProduct() {
    const category = document.getElementById('prod-category').value;
    const title = document.getElementById('prod-title').value.trim();
    const price = parseFloat(document.getElementById('prod-price').value);
    const description = document.getElementById('prod-desc').value.trim();
    const sizeType = document.getElementById('size-type-select').value;
    const sizes = document.getElementById('prod-manual-sizes').value.trim();
    const fileInput = document.getElementById('prod-images');
    const btn = document.getElementById('add-product-btn');

    if (!category) { showCustomAlert('Please select or add a category first.'); return; }
    if (!title || isNaN(price)) { showCustomAlert('Please fill required product details.'); return; }
    if (fileInput.files.length < MIN_PRODUCT_IMAGES || fileInput.files.length > MAX_PRODUCT_IMAGES) {
        showCustomAlert(`Please upload between ${MIN_PRODUCT_IMAGES} and ${MAX_PRODUCT_IMAGES} images.`);
        return;
    }

    btn.disabled = true;
    btn.innerText = 'Saving…';
    try {
        const base64Images = [];
        for (let i = 0; i < fileInput.files.length; i++) {
            base64Images.push(await convertFileToBase64(fileInput.files[i]));
        }

        await db.collection('products').add({
            category, title, price, description, sizeType, sizes,
            images: base64Images,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showCustomAlert('Product added successfully!');
        document.getElementById('prod-title').value = '';
        document.getElementById('prod-price').value = '';
        document.getElementById('prod-desc').value = '';
        document.getElementById('prod-manual-sizes').value = '';
        const dz = document.getElementById('prod-images-dropzone');
        if (dz && dz._resetPreview) dz._resetPreview(); else fileInput.value = '';
        await refreshProductsList();
    } catch (err) {
        showCustomAlert('Error adding product: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = 'Save Product';
    }
}

function openEditProductModal(id) {
    const product = productsCache.find(p => p.id === id);
    if (!product) return;

    const catSelect = document.getElementById('edit-prod-category');
    catSelect.innerHTML = categoriesCache.length > 0 ?
        categoriesCache.map(c => `<option value="${escapeHtml(c.name)}" ${c.name === product.category ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('') :
        `<option value="">No categories available</option>`;

    document.getElementById('edit-prod-id').value = product.id;
    document.getElementById('edit-prod-title').value = product.title || '';
    document.getElementById('edit-prod-price').value = product.price || '';
    document.getElementById('edit-prod-desc').value = product.description || '';
    document.getElementById('edit-size-type-select').value = product.sizeType || 'none';
    document.getElementById('edit-prod-manual-sizes').value = product.sizes || '';
    const dz = document.getElementById('edit-prod-images-dropzone');
    if (dz && dz._resetPreview) dz._resetPreview(); else document.getElementById('edit-prod-images').value = '';
    toggleEditSizeInputs();

    document.getElementById('edit-product-modal').style.display = 'flex';
}

function closeEditProductModal() {
    document.getElementById('edit-product-modal').style.display = 'none';
}

async function saveEditedProduct() {
    const id = document.getElementById('edit-prod-id').value;
    const category = document.getElementById('edit-prod-category').value;
    const title = document.getElementById('edit-prod-title').value.trim();
    const price = parseFloat(document.getElementById('edit-prod-price').value);
    const description = document.getElementById('edit-prod-desc').value.trim();
    const sizeType = document.getElementById('edit-size-type-select').value;
    const sizes = document.getElementById('edit-prod-manual-sizes').value.trim();
    const fileInput = document.getElementById('edit-prod-images');
    const btn = document.getElementById('save-edit-btn');

    if (!category) { showCustomAlert('Please select a category.'); return; }
    if (!title || isNaN(price)) { showCustomAlert('Please fill required product details.'); return; }

    const updateData = { category, title, price, description, sizeType, sizes };

    if (fileInput.files.length > 0) {
        if (fileInput.files.length > MAX_PRODUCT_IMAGES) {
            showCustomAlert(`Please upload up to ${MAX_PRODUCT_IMAGES} images, or leave empty to keep existing images.`);
            return;
        }
        btn.disabled = true;
        btn.innerText = 'Uploading…';
        const base64Images = [];
        for (let i = 0; i < fileInput.files.length; i++) {
            base64Images.push(await convertFileToBase64(fileInput.files[i]));
        }
        updateData.images = base64Images;
    }

    try {
        await db.collection('products').doc(id).update(updateData);
        showCustomAlert('Product updated successfully!');
        closeEditProductModal();
        await refreshProductsList();
    } catch (err) {
        showCustomAlert('Error updating product: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = 'Update Product';
    }
}

async function deleteProduct(id) {
    if (!confirm('Delete this product?')) return;
    await db.collection('products').doc(id).delete();
    await refreshProductsList();
}

async function deleteSelectedProducts() {
    const checkboxes = document.querySelectorAll('.prod-checkbox:checked');
    if (checkboxes.length === 0) { showCustomAlert('Please select at least one product to delete.'); return; }
    if (!confirm(`Delete ${checkboxes.length} selected product(s)?`)) return;

    for (const cb of checkboxes) {
        await db.collection('products').doc(cb.value).delete();
    }
    await refreshProductsList();
    showCustomAlert('Selected products deleted successfully!');
}
