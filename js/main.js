// ==================== APP BOOTSTRAP (storefront) ====================
// All product-card, cart-row and wishlist-row interactions are wired
// through ONE delegated listener per container instead of per-item
// inline handlers. This is what actually fixes the "tapping Add to
// Cart / Buy Now opens the whole card" bug: there is exactly one
// click target resolved per click (the nearest [data-action]
// ancestor), so a tap on a button can never also register as a tap
// on the card behind it — there is no bubbling race to guard against.

document.addEventListener('DOMContentLoaded', () => {
    wireProductGrid();
    wireCartModal();
    wireWishlistModal();
    wireOrdersModal();
    wireCategoryChips();
    wireSearch();
    wireMobileNav();
});

function wireProductGrid() {
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    grid.addEventListener('click', (e) => {
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl || !grid.contains(actionEl)) return;

        const action = actionEl.dataset.action;
        const productId = actionEl.dataset.product;

        switch (action) {
            case 'open-detail':
                openProductDetail(productId);
                break;
            case 'add-to-cart':
                addToCart(productId, true);
                break;
            case 'buy-now':
                buyNow(productId);
                break;
            case 'toggle-wishlist':
                toggleWishlist(productId);
                break;
            case 'swap-image':
                switchCardImage(productId, actionEl.dataset.imgIndex);
                break;
            case 'stop':
                // Size dropdown — swallow the click so it never opens the card.
                break;
        }
    });
}

function wireCartModal() {
    const container = document.getElementById('cart-items-container');
    if (!container) return;

    container.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el) return;
        const idx = Number(el.dataset.idx);
        switch (el.dataset.action) {
            case 'cart-remove-selected': removeSelectedCartItems(); break;
            case 'cart-qty': changeCartItemQty(idx, Number(el.dataset.change)); break;
            case 'cart-remove': removeCartItem(idx); break;
        }
    });

    container.addEventListener('change', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el) return;
        const idx = Number(el.dataset.idx);
        switch (el.dataset.action) {
            case 'cart-select-all': toggleCartSelectAll(e.target.checked); break;
            case 'cart-toggle-item': toggleCartItemSelection(idx, e.target.checked); break;
        }
    });
}

function wireWishlistModal() {
    const container = document.getElementById('wishlist-items-container');
    if (!container) return;
    container.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el) return;
        const productId = el.dataset.product;
        switch (el.dataset.action) {
            case 'wishlist-add-to-cart': addToCart(productId, true); break;
            case 'wishlist-remove': toggleWishlist(productId); break;
        }
    });
}

function wireOrdersModal() {
    const container = document.getElementById('orders-list-container');
    if (!container) return;
    container.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action="cancel-order"]');
        if (el) cancelOrder(el.dataset.order);
    });
}

function wireCategoryChips() {
    const container = document.getElementById('category-chips');
    if (!container) return;
    container.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-category]');
        if (chip) filterCategory(chip.dataset.category);
    });
}

function wireSearch() {
    const input = document.getElementById('product-search');
    if (!input) return;
    input.addEventListener('input', debounce((e) => handleSearchInput(e.target.value), 200));
}

function wireMobileNav() {
    const toggle = document.getElementById('navbar-toggle');
    const nav = document.getElementById('main-nav');
    const backdrop = document.getElementById('nav-backdrop');
    if (!toggle || !nav) return;

    function close() {
        nav.classList.remove('open');
        if (backdrop) backdrop.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
    }
    function open() {
        nav.classList.add('open');
        if (backdrop) backdrop.classList.add('open');
        toggle.setAttribute('aria-expanded', 'true');
    }

    toggle.addEventListener('click', () => {
        nav.classList.contains('open') ? close() : open();
    });
    if (backdrop) backdrop.addEventListener('click', close);
    nav.addEventListener('click', (e) => {
        if (e.target.tagName === 'A' || e.target.closest('a')) close();
    });
}
