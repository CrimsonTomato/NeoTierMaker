import { state } from './state.js';
import * as dom from './dom.js';

let previewTimeoutId = null;
let isDragging = false;

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

    if (item.image) {
        itemDiv.classList.add('has-image');
    } else {
        itemDiv.classList.add('text-only');
    }

    if (dom.stagingListEl.classList.contains('view-grid')) {
        itemDiv.title = item.text;
    }

    const thumbnailWrapper = document.createElement('div');
    thumbnailWrapper.className = 'staging-item-thumbnail-wrapper';

    let imageEl;
    if (item.image) {
        imageEl = document.createElement('img');
        imageEl.className = 'staging-item-img';
        imageEl.src = item.image;
        imageEl.alt = item.text;
    } else {
        imageEl = document.createElement('div');
        imageEl.className = 'staging-item-img';
        imageEl.style.backgroundColor = 'transparent';
        imageEl.textContent = '';
    }

    thumbnailWrapper.appendChild(imageEl);

    let textEl;
    if (isEditing) {
        textEl = document.createElement('input');
        textEl.type = 'text';
        textEl.className = 'staging-item-edit-input';
        textEl.value = item.text;
        setTimeout(() => textEl.focus(), 0);
    } else {
        textEl = document.createElement('span');
        textEl.className = 'staging-item-text';
        textEl.textContent = item.text;
        if (dom.stagingListEl.classList.contains('view-list')) {
            textEl.title = item.text;
        }
    }

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'staging-item-actions';
    if (isEditing) {
        actionsDiv.innerHTML = `
            <button title="Save" data-action="save">✔️</button>
            <button title="Cancel" data-action="cancel">❌</button>
        `;
    } else {
        actionsDiv.innerHTML = `
            <button title="Edit" data-action="edit">✏️</button>
            <button title="Delete" data-action="delete">🗑️</button>
        `;
    }

    itemDiv.append(thumbnailWrapper, textEl, actionsDiv);
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
    if (imgEl) {
        const hoverDelay = 500;
        previewTimeoutId = setTimeout(() => {
            dom.globalPreviewEl.style.backgroundImage = `url(${imgEl.src})`;
            const rect = wrapper.getBoundingClientRect();
            const previewHeight = 200;
            const gap = 12;
            let top = (rect.top > previewHeight + gap) ? rect.top - previewHeight - gap : rect.bottom + gap;
            const left = rect.left + rect.width / 2 - 100;
            dom.globalPreviewEl.style.top = `${top}px`;
            dom.globalPreviewEl.style.left = `${left}px`;
            dom.globalPreviewEl.classList.add('visible');
        }, hoverDelay);
    }
}