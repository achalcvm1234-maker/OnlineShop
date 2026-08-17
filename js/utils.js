// ==================== SHARED UTILITIES ====================

// Prevents any product/category/user text from ever being interpreted
// as HTML — closes off a whole class of rendering bugs & XSS.
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// All prices in the app are Indian Rupees. formatPrice always returns
// the symbol + Indian-style digit grouping (e.g. ₹12,499.00) — every
// call site should use this directly instead of prefixing its own
// currency symbol, so there is exactly one place that defines "how a
// price looks" across the whole site.
const CURRENCY_SYMBOL = '₹';

function formatPrice(value) {
    const num = parseFloat(value);
    const safe = isNaN(num) ? 0 : num;
    return CURRENCY_SYMBOL + safe.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// A tiny inline placeholder — no network round trip, so a missing
// product image never slows the page down or shows a broken icon.
const PLACEHOLDER_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
        <rect width="300" height="300" fill="#FDEEF2"/>
        <text x="50%" y="50%" font-family="sans-serif" font-size="16" fill="#C4184F" text-anchor="middle" dy=".3em">No Image</text>
    </svg>`
);

function debounce(fn, delay = 250) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// ==================== MODERN CENTERED CUSTOM ALERT MODAL ====================
function showCustomAlert(message) {
    let modal = document.getElementById('custom-alert-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'custom-alert-modal';
        modal.className = 'modal';
        modal.style.zIndex = '9999';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:380px; text-align:center;">
                <div style="font-size: 38px; margin-bottom: 8px;">✨</div>
                <p id="custom-alert-msg" style="margin-bottom: 22px; font-size: 15.5px; color: #333; line-height: 1.6; font-weight: 500;"></p>
                <button class="btn" data-action="close-alert">Got It</button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.closest('[data-action="close-alert"]')) {
                closeCustomAlert();
            }
        });
    }
    document.getElementById('custom-alert-msg').innerText = message;
    modal.style.display = 'flex';
}

function closeCustomAlert() {
    const modal = document.getElementById('custom-alert-modal');
    if (modal) modal.style.display = 'none';
}

// Close any open modal on outside-click and on Escape — small polish,
// no functional regression risk since each modal already toggles via ids.
document.addEventListener('click', (e) => {
    if (e.target.classList && e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(m => {
            if (m.style.display === 'flex') m.style.display = 'none';
        });
    }
});
