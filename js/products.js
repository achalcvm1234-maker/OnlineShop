// ==================== STOREFRONT PRODUCT STATE ====================
let productsCache = [];
let categoriesCache = [];
let activeCategory = 'All';
let searchTerm = '';

async function loadStorefrontData() {
    const grid = document.getElementById('product-grid');
    if (grid && productsCache.length === 0) {
        grid.innerHTML = `<div class="loading-state" style="grid-column:1/-1;">Loading products…</div>`;
    }

    try {
        const [catSnap, prodSnap] = await Promise.all([
            db.collection('categories').get(),
            db.collection('products').get()
        ]);
        categoriesCache = catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        productsCache = prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
        if (grid) grid.innerHTML = `<p class="empty-state" style="grid-column:1/-1;">Could not load products: ${escapeHtml(err.message)}</p>`;
        return;
    }

    renderCategoryChips();
    renderProductGrid();
}

function renderCategoryChips() {
    const container = document.getElementById('category-chips');
    if (!container) return;

    let html = `<button type="button" class="chip ${activeCategory === 'All' ? 'active' : ''}" data-category="All">All Products</button>`;
    categoriesCache.forEach(cat => {
        html += `<button type="button" class="chip ${activeCategory === cat.name ? 'active' : ''}" data-category="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</button>`;
    });
    container.innerHTML = html;
}

function filterCategory(catName) {
    activeCategory = catName;
    renderCategoryChips();
    renderProductGrid();
}

function handleSearchInput(value) {
    searchTerm = value.trim().toLowerCase();
    renderProductGrid();
}

function getFilteredProducts() {
    let filtered = productsCache;
    if (activeCategory !== 'All') {
        filtered = filtered.filter(p => p.category === activeCategory);
    }
    if (searchTerm) {
        filtered = filtered.filter(p =>
            (p.title || '').toLowerCase().includes(searchTerm) ||
            (p.category || '').toLowerCase().includes(searchTerm)
        );
    }
    return filtered;
}

function renderProductGrid() {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    const filtered = getFilteredProducts();

    if (filtered.length === 0) {
        grid.innerHTML = `<p class="empty-state" style="grid-column: 1/-1;">No products found${searchTerm ? ' for "' + escapeHtml(searchTerm) + '"' : ' in this category'}.</p>`;
        return;
    }

    const wishlistIds = typeof wishlistCache !== 'undefined' ? wishlistCache : [];

    let html = '';
    filtered.forEach(p => {
        const images = p.images || [];
        const primaryImg = images.length > 0 ? images[0] : PLACEHOLDER_IMG;
        const isWishlisted = wishlistIds.includes(p.id);

        let thumbDotsHtml = '';
        if (images.length > 1) {
            images.forEach((img, idx) => {
                thumbDotsHtml += `<button type="button" class="swap-dot ${idx === 0 ? 'active' : ''}" data-action="swap-image" data-product="${p.id}" data-img-index="${idx}" style="background:${idx === 0 ? 'var(--gold)' : 'rgba(255,255,255,0.75)'};" aria-label="Show image ${idx + 1}"></button>`;
            });
        }

        let sizeHtml = '';
        if (p.sizeType === 'checkbox') {
            sizeHtml = `<div style="font-size:12.5px; color:var(--success); margin-bottom:8px;">✓ Standard Sizes Available</div>`;
        } else if (p.sizeType === 'manual' && p.sizes) {
            const sizeOpts = p.sizes.split(',').map(s => s.trim()).filter(Boolean);
            sizeHtml = `<select class="product-sizes-select" id="size-select-${p.id}" data-action="stop">`;
            sizeOpts.forEach(s => sizeHtml += `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`);
            sizeHtml += `</select>`;
        }

        html += `
            <div class="product-card" data-action="open-detail" data-product="${p.id}">
                <div class="image-swapper" id="swapper-${p.id}">
                    <button type="button" class="wishlist-heart ${isWishlisted ? 'active' : ''}" data-action="toggle-wishlist" data-product="${p.id}" aria-label="Toggle wishlist">${isWishlisted ? '♥' : '♡'}</button>
                    ${images.map((img, idx) => `<img src="${img}" data-idx="${idx}" class="${idx === 0 ? 'active' : ''}" alt="${escapeHtml(p.title || '')}">`).join('') || `<img src="${PLACEHOLDER_IMG}" class="active" alt="No image">`}
                    <div class="swap-dots">${thumbDotsHtml}</div>
                </div>
                <div class="product-info">
                    <div class="product-title">${escapeHtml(p.title)}</div>
                    <div class="product-price">${formatPrice(p.price)}</div>
                    <div class="product-desc">${escapeHtml(p.description)}</div>
                    ${sizeHtml}
                </div>
                <div class="card-actions">
                    <button type="button" class="btn btn-secondary" data-action="add-to-cart" data-product="${p.id}">Add to Cart</button>
                    <button type="button" class="btn" data-action="buy-now" data-product="${p.id}">Buy Now</button>
                </div>
            </div>
        `;
    });
    grid.innerHTML = html;
}

function switchCardImage(productId, imgIndex) {
    const swapper = document.getElementById(`swapper-${productId}`);
    if (!swapper) return;
    swapper.querySelectorAll('.image-swapper > img').forEach(img => {
        img.classList.toggle('active', Number(img.dataset.idx) === Number(imgIndex));
    });
    swapper.querySelectorAll('.swap-dot').forEach((dot, idx) => {
        const active = idx === Number(imgIndex);
        dot.classList.toggle('active', active);
        dot.style.background = active ? 'var(--gold)' : 'rgba(255,255,255,0.75)';
    });
}

// ==================== PRODUCT DETAIL MODAL ====================
function openProductDetail(productId) {
    const product = productsCache.find(p => p.id === productId);
    if (!product) return;

    let modal = document.getElementById('product-detail-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'product-detail-modal';
        modal.className = 'modal';
        modal.style.zIndex = '2100';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:600px;">
                <button type="button" class="close-modal" data-action="close-detail" aria-label="Close">&times;</button>
                <div id="detail-modal-body"></div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.closest('[data-action="close-detail"]')) closeProductDetail();

            const thumb = e.target.closest('[data-action="detail-thumb"]');
            if (thumb) changeDetailMainImage(thumb.dataset.img, thumb);

            const actionEl = e.target.closest('[data-action="add-to-cart"], [data-action="buy-now"]');
            if (actionEl) {
                const productId = actionEl.dataset.product;
                if (actionEl.dataset.action === 'add-to-cart') {
                    addToCart(productId, true);
                } else {
                    closeProductDetail();
                    buyNow(productId);
                }
            }
        });
    }

    const images = product.images || [];
    let galleryHtml = '';
    images.forEach((img, idx) => {
        galleryHtml += `<img src="${img}" data-action="detail-thumb" data-img="${img}" style="width:68px; height:68px; object-fit:cover; border-radius:8px; cursor:pointer; border:2px solid ${idx === 0 ? 'var(--rose)' : '#ddd'};" alt="View ${idx + 1}">`;
    });

    let sizeHtml = '';
    if (product.sizeType === 'checkbox') {
        sizeHtml = `<div style="font-size:12.5px; color:var(--success); margin:10px 0;">✓ Standard Sizes Available</div>`;
    } else if (product.sizeType === 'manual' && product.sizes) {
        const sizeOpts = product.sizes.split(',').map(s => s.trim()).filter(Boolean);
        sizeHtml = `<select class="product-sizes-select" id="detail-size-select-${product.id}" style="margin:10px 0;">`;
        sizeOpts.forEach(s => sizeHtml += `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`);
        sizeHtml += `</select>`;
    }

    const body = document.getElementById('detail-modal-body');
    body.innerHTML = `
        <div style="text-align:center; margin-bottom:14px; background:var(--blush); border-radius:10px; padding:10px;">
            <img id="detail-main-img" src="${images[0] || PLACEHOLDER_IMG}" style="width:100%; max-height:300px; object-fit:contain; border-radius:8px;">
        </div>
        <div style="display:flex; gap:10px; margin-bottom:14px; justify-content:center; overflow-x:auto; padding-bottom:5px;">
            ${galleryHtml}
        </div>
        <h2 style="margin-bottom:4px;">${escapeHtml(product.title)}</h2>
        <h3 style="color:var(--rose); margin:5px 0; font-size:20px;">${formatPrice(product.price)}</h3>
        <p style="color:#555; margin:10px 0; line-height:1.5;">${escapeHtml(product.description)}</p>
        ${sizeHtml}
        ${images.length > 1 ? `<p style="font-size:12px; color:#888; background:var(--cream); padding:8px; border-radius:6px; margin-top:10px;">💡 Tap the thumbnails above to see more views.</p>` : ''}
        <div class="card-actions" style="padding:16px 0 0 0;">
            <button type="button" class="btn btn-secondary" data-action="add-to-cart" data-product="${product.id}">Add to Cart</button>
            <button type="button" class="btn" data-action="buy-now" data-product="${product.id}">Buy Now</button>
        </div>
    `;

    modal.style.display = 'flex';
}

function changeDetailMainImage(imgUrl, thumbElem) {
    document.getElementById('detail-main-img').src = imgUrl;
    thumbElem.parentElement.querySelectorAll('img').forEach(img => img.style.borderColor = '#ddd');
    thumbElem.style.borderColor = 'var(--rose)';
}

function closeProductDetail() {
    const modal = document.getElementById('product-detail-modal');
    if (modal) modal.style.display = 'none';
}
