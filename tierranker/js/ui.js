import { state } from './state.js';
import * as dom from './dom.js';

let previewTimeoutId = null;
let isDragging = false;

// Global listener to hide the preview if the mouse leaves the window.
document.addEventListener('mouseleave', () => {
    hidePreview();
});

/**
 * Creates an SVG data URL as a placeholder for a text-only item.
 * @param {object} item The item object.
 * @returns {string} A base64 encoded SVG data URL.
 */
export function createItemImagePlaceholder(item) {
    if (!item || !item.text || !item.color) {
        return 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='; // Transparent pixel
    }
    const firstLetter = item.text.charAt(0).toUpperCase();
    const bgColor = item.color.background;
    const textColor = item.color.text;

    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
            <rect width="100" height="100" fill="${bgColor}" />
            <text x="50%" y="52%" font-family="sans-serif" font-size="50" fill="${textColor}" text-anchor="middle" dominant-baseline="middle">${firstLetter}</text>
        </svg>`;

    return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function createStagingItemElement(item) {
    const isEditing = state.editingItemId === item.id;
    const itemDiv = document.createElement('div');
    itemDiv.className = 'staging-item';
    itemDiv.dataset.id = item.id;

    if (!isEditing) {
        itemDiv.draggable = true;
    }

    if (item.color) {
        itemDiv.style.backgroundColor = item.color.background;
        itemDiv.style.color = item.color.text;
    }

    const isGridView = dom.stagingListEl.classList.contains('view-grid');
    if (item.image) {
        itemDiv.classList.add('has-image');
    } else {
        itemDiv.classList.add('text-only');
    }

    if (isGridView) {
        itemDiv.title = item.text;
    }

    // --- Build HTML for the item ---
    const imgSrc = item.image || createItemImagePlaceholder(item);
    const thumbnailHTML = `
        <div class="staging-item-thumbnail-wrapper">
            <img class="staging-item-img" src="${imgSrc}" alt="${item.text}">
        </div>
    `;

    let textHTML = '';
    if (!isGridView) {
        if (isEditing) {
            textHTML = `<input type="text" class="staging-item-edit-input" value="${item.text}" />`;
        } else {
            textHTML = `<span class="staging-item-text" title="${item.text}">${item.text}</span>`;
        }
    }

    const cameraIcon = `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M4,4H7L9,2H15L17,4H20A2,2 0 0,1 22,6V18A2,2 0 0,1 20,20H4A2,2 0 0,1 2,18V6A2,2 0 0,1 4,4M12,7A5,5 0 0,0 7,12A5,5 0 0,0 12,17A5,5 0 0,0 17,12A5,5 0 0,0 12,7M12,9A3,3 0 0,1 15,12A3,3 0 0,1 12,15A3,3 0 0,1 9,12A3,3 0 0,1 12,9Z" /></svg>`;
    let actionsHTML = '';
    if (isGridView) {
        actionsHTML = `
            <div class="staging-item-actions">
                <button title="Change/Add Image" data-action="change-image">${cameraIcon}</button>
                <button title="Delete" data-action="delete">🗑️</button>
            </div>`;
    } else {
        if (isEditing) {
            actionsHTML = `
                <div class="staging-item-actions">
                    <button title="Save" data-action="save">✔️</button>
                    <button title="Cancel" data-action="cancel">❌</button>
                </div>`;
        } else {
            actionsHTML = `
                <div class="staging-item-actions">
                    <button title="Change/Add Image" data-action="change-image">${cameraIcon}</button>
                    <button title="Edit Text" data-action="edit">✏️</button>
                    <button title="Delete" data-action="delete">🗑️</button>
                </div>`;
        }
    }

    itemDiv.innerHTML = thumbnailHTML + textHTML + actionsHTML;
    if (isEditing && !isGridView) {
        setTimeout(() => itemDiv.querySelector('input')?.focus(), 0);
    }
    return itemDiv;
}

export function renderStagingList() {
    dom.stagingListEl.innerHTML = '';
    const itemCountEl = document.getElementById('item-count');

    if (state.items.length === 0) {
        dom.stagingListEl.innerHTML = `<p>No items yet.</p>`;
    } else {
        for (const item of state.items) {
            const itemEl = createStagingItemElement(item);
            dom.stagingListEl.appendChild(itemEl);
        }
    }

    itemCountEl.textContent = state.items.length;
}

// --- Preview Logic ---

export function setDragging(status) {
    isDragging = status;
    if (status) hidePreview();
}

export function hidePreview() {
    if (previewTimeoutId) clearTimeout(previewTimeoutId);
    dom.globalPreviewEl.classList.remove('visible');
}

export function showPreview(e, wrapperSelector) {
    if (isDragging) return;
    const wrapper = e.target.closest(wrapperSelector);
    const imgEl = wrapper?.querySelector('img[src]');
    if (imgEl && !imgEl.src.startsWith('data:image/svg+xml')) {
        const hoverDelay = 500;
        previewTimeoutId = setTimeout(() => {
            if (!wrapper || !document.body.contains(wrapper)) {
                return;
            }
            const rect = wrapper.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) {
                return;
            }
            dom.globalPreviewEl.style.backgroundImage = `url(${imgEl.src})`;
            const previewHeight = 200;
            const gap = 12;
            let top =
                rect.top > previewHeight + gap
                    ? rect.top - previewHeight - gap
                    : rect.bottom + gap;
            const left = rect.left + rect.width / 2 - 100;
            dom.globalPreviewEl.style.top = `${top}px`;
            dom.globalPreviewEl.style.left = `${left}px`;
            dom.globalPreviewEl.classList.add('visible');
        }, hoverDelay);
    }
}
