import { state } from './state.js';

const stagingListEl = document.getElementById('staging-list');
const itemCountEl = document.getElementById('item-count');

function createStagingItemElement(item) {
    const isEditing = state.editingItemId === item.id;
    const itemDiv = document.createElement('div');
    itemDiv.className = 'staging-item';
    itemDiv.dataset.id = item.id;

    if (!isEditing) {
        itemDiv.draggable = true;
    }

    // Apply colors to the main container
    if (item.color) {
        itemDiv.style.backgroundColor = item.color.background;
        itemDiv.style.color = item.color.text;
    }

    // Add classes for view-specific styling
    if (item.image) {
        itemDiv.classList.add('has-image');
    } else {
        itemDiv.classList.add('text-only');
    }
    
    // --- SMART TOOLTIP ASSIGNMENT ---
    // For Grid view, the whole card gets a tooltip (useful for image-only items)
    if (stagingListEl.classList.contains('view-grid')) {
        itemDiv.title = item.text;
    }

    // --- Create a wrapper for the thumbnail and its preview ---
    const thumbnailWrapper = document.createElement('div');
    thumbnailWrapper.className = 'staging-item-thumbnail-wrapper';

    // --- Create the visible thumbnail (image or text placeholder) ---
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
    
    // --- Create the text or input element ---
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
        // --- SMART TOOLTIP ASSIGNMENT ---
        // For List view, only the text element gets a tooltip
        if (stagingListEl.classList.contains('view-list')) {
            textEl.title = item.text;
        }
    }
    
    // --- Create the actions element ---
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
    stagingListEl.innerHTML = ''; // Clear the list

    if (state.items.length === 0) {
        stagingListEl.innerHTML = `<p>No items yet.</p>`;
    } else {
        // --- SIMPLIFIED RENDER LOOP ---
        // This loop is now "dumb". It just creates and appends.
        // All styling logic is self-contained in createStagingItemElement.
        for (const item of state.items) {
            const itemEl = createStagingItemElement(item);
            stagingListEl.appendChild(itemEl);
        }
    }

    itemCountEl.textContent = state.items.length;
}