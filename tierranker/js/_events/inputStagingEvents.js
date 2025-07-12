import * as dom from '../dom.js';
import {
    state,
    clearItems,
    removeItem,
    setEditingItemId,
    updateItemText,
} from '../state.js';
import { handleTextInput, handleFileInput } from '../_controllers/inputController.js';
import {
    renderStagingList,
    showPreview,
    hidePreview,
    setDragging,
} from '../ui.js';
import { startSort, handleSimulateSort } from '../_controllers/sortController.js';
import { colorInfoFromImage } from '../color.js';
import Sortable from 'sortablejs';

export function initializeInputStagingEvents() {
    // --- Input View Events ---
    dom.addFromTextBtn.addEventListener('click', async () => {
        await handleTextInput(dom.textInputArea.value);
        dom.textInputArea.value = '';
    });

    dom.clearStagingBtn.addEventListener('click', () => {
        if (
            state.items.length > 0 &&
            confirm('Are you sure you want to clear all items?')
        ) {
            clearItems();
            renderStagingList();
        }
    });

    dom.uploadImagesBtn.addEventListener('click', () => dom.imageInput.click());
    dom.imageInput.addEventListener('change', async e => {
        if (e.target.files.length > 0) {
            await handleFileInput(e.target.files);
        }
        e.target.value = null; // Clear the input so same file can be selected again
    });

    // --- Listener for changing/adding an image to a specific item ---
    dom.itemImageInput.addEventListener('change', async e => {
        const file = e.target.files[0];
        const itemId = e.target.dataset.editingItemId;
        if (!file || !itemId) return;

        const item = state.items.find(i => i.id === itemId);
        if (!item) return;

        try {
            const reader = new FileReader();
            reader.onload = async () => {
                const imageDataUrl = reader.result;
                const colorInfo = await colorInfoFromImage(imageDataUrl);
                item.image = imageDataUrl;
                item.color = colorInfo;
                renderStagingList();
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Error updating item image:', error);
            alert('Could not update the image.');
        } finally {
            e.target.value = null;
            delete e.target.dataset.editingItemId;
        }
    });

    dom.imageDropZone.addEventListener('dragenter', e => {
        e.preventDefault();
        dom.imageDropZone.classList.add('drag-over');
    });
    dom.imageDropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dom.imageDropZone.classList.add('drag-over');
    });
    dom.imageDropZone.addEventListener('dragleave', e => {
        e.preventDefault();
        dom.imageDropZone.classList.remove('drag-over');
    });
    dom.imageDropZone.addEventListener('drop', async e => {
        e.preventDefault();
        dom.imageDropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            await handleFileInput(e.dataTransfer.files);
        }
    });

    dom.startSortBtn.addEventListener('click', startSort);
    dom.simulateSortBtn.addEventListener('click', handleSimulateSort);

    // --- Staging List Events ---
    dom.stagingListEl.addEventListener('click', e => {
        hidePreview(); // Immediately hide preview on any click.
        const button = e.target.closest('button');
        const action = button?.dataset.action;
        if (!action) return;
        const itemId = e.target.closest('.staging-item')?.dataset.id;
        if (!itemId) return;

        if (action === 'delete') {
            if (
                confirm(
                    `Are you sure you want to delete "${state.items.find(i => i.id === itemId).text}"?`,
                )
            ) {
                removeItem(itemId);
                renderStagingList();
            }
        } else if (action === 'edit') {
            setEditingItemId(itemId);
            renderStagingList();
        } else if (action === 'save') {
            const inputEl = e.target
                .closest('.staging-item')
                .querySelector('.staging-item-edit-input');
            updateItemText(itemId, inputEl.value.trim());
            setEditingItemId(null);
            renderStagingList();
        } else if (action === 'cancel') {
            setEditingItemId(null);
            renderStagingList();
        } else if (action === 'change-image') {
            dom.itemImageInput.dataset.editingItemId = itemId;
            dom.itemImageInput.click();
        }
    });

    dom.stagingListEl.addEventListener('dragstart', () => setDragging(true));
    dom.stagingListEl.addEventListener('dragend', () => setDragging(false));
    dom.stagingListEl.addEventListener('mouseover', e =>
        showPreview(e, '.staging-item-thumbnail-wrapper'),
    );
    dom.stagingListEl.addEventListener('mouseout', () => hidePreview());

    new Sortable(dom.stagingListEl, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        onEnd: function (evt) {
            const { oldIndex, newIndex } = evt;
            const itemsCopy = [...state.items];
            const [draggedItem] = itemsCopy.splice(oldIndex, 1);
            itemsCopy.splice(newIndex, 0, draggedItem);
            state.items = itemsCopy;
        },
    });

    // --- Staging View Toggles ---
    dom.viewListBtn.addEventListener('click', () => {
        dom.stagingListEl.classList.remove('view-grid');
        dom.stagingListEl.classList.add('view-list');
        dom.viewListBtn.classList.add('active');
        dom.viewGridBtn.classList.remove('active');
        renderStagingList();
    });

    dom.viewGridBtn.addEventListener('click', () => {
        dom.stagingListEl.classList.remove('view-list');
        dom.stagingListEl.classList.add('view-grid');
        dom.viewGridBtn.classList.add('active');
        dom.viewListBtn.classList.remove('active');
        renderStagingList();
    });
}
