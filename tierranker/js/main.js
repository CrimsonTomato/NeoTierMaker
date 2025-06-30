import '../style.css';
import { handleTextInput, handleFileInput } from './inputController.js';
import { state, clearItems, removeItem, setEditingItemId, updateItemText, addTier, removeLastTier, updateTierLabel, updateTierThreshold } from './state.js';
import { renderStagingList } from './ui.js';
import { createSorter } from './sorter.js';
import Sortable from 'sortablejs';
import { exportElementAsImage, copyElementAsImage } from './export.js';
import { exportSessionToFile, importSessionFromFile } from './fileSession.js';
import { isColorDark } from './color.js';


// === DOM ELEMENTS (Complete List) =========================================
const viewInput = document.getElementById('view-input');
const textInputArea = document.getElementById('text-input-area');
const addFromTextBtn = document.getElementById('btn-add-from-text');
const clearStagingBtn = document.getElementById('btn-clear-staging');
const uploadImagesBtn = document.getElementById('btn-upload-images');
const imageInput = document.getElementById('image-input');
const imageDropZone = document.getElementById('image-drop-zone');
const startSortBtn = document.getElementById('btn-start-sort');
const stagingListEl = document.getElementById('staging-list');
const viewListBtn = document.getElementById('view-list-btn');
const viewGridBtn = document.getElementById('view-grid-btn');
const globalPreviewEl = document.getElementById('global-image-preview');
const viewComparison = document.getElementById('view-comparison');
const choiceAEl = document.getElementById('choice-a');
const choiceBEl = document.getElementById('choice-b');
const choiceTieEl = document.getElementById('choice-tie');
const progressTextEl = document.getElementById('progress-text');
const progressBarInnerEl = document.getElementById('progress-bar-inner');
const viewResults = document.getElementById('view-results');
const tierTagContainer = document.getElementById('tier-tag-container');
const rankedListWrapper = document.getElementById('ranked-list-wrapper');
const tierListGridEl = document.getElementById('tier-list-grid');
const btnAddTier = document.getElementById('btn-add-tier');
const btnRemoveTier = document.getElementById('btn-remove-tier');
const btnRestart = document.getElementById('btn-restart');
const tierColorInput = document.getElementById('tier-color-input');
const btnExportImage = document.getElementById('btn-export-image');
const btnSizeIncrease = document.getElementById('btn-size-increase');
const btnSizeDecrease = document.getElementById('btn-size-decrease');
const btnCopyImage = document.getElementById('btn-copy-image');
const btnExportSession = document.getElementById('btn-export-session'); // New
const btnImportSession = document.getElementById('btn-import-session'); // New
const sessionFileInput = document.getElementById('session-file-input'); // New

// --- CONSTANTS ---
const SESSION_KEY = 'tierRankerSession';

// --- HELPER & UTILITY FUNCTIONS ---
function showView(viewElement) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    viewElement.classList.add('active');
}

// --- INITIALIZATION ---
renderStagingList();

// === EVENT LISTENERS =======================================================

// --- Input and Staging Buttons ---
addFromTextBtn.addEventListener('click', async () => {
    await handleTextInput(textInputArea.value);
    textInputArea.value = "";
});
clearStagingBtn.addEventListener('click', () => {
    if (state.items.length > 0 && confirm("Are you sure you want to clear all items?")) {
        clearItems();
        renderStagingList();
    }
});
uploadImagesBtn.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
        await handleFileInput(e.target.files);
    }
    e.target.value = null;
});
imageDropZone.addEventListener('dragenter', (e) => { e.preventDefault(); imageDropZone.classList.add('drag-over'); });
imageDropZone.addEventListener('dragover', (e) => { e.preventDefault(); imageDropZone.classList.add('drag-over'); });
imageDropZone.addEventListener('dragleave', (e) => { e.preventDefault(); imageDropZone.classList.remove('drag-over'); });
imageDropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    imageDropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
        await handleFileInput(e.dataTransfer.files);
    }
});
stagingListEl.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (!action) return;
    const itemId = e.target.closest('.staging-item')?.dataset.id;
    if (!itemId) return;

    if (action === 'delete') {
        if (confirm(`Are you sure you want to delete "${state.items.find(i => i.id === itemId).text}"?`)) {
            removeItem(itemId);
            renderStagingList();
        }
    } else if (action === 'edit') {
        setEditingItemId(itemId);
        renderStagingList();
    } else if (action === 'save') {
        const inputEl = e.target.closest('.staging-item').querySelector('.staging-item-edit-input');
        updateItemText(itemId, inputEl.value.trim());
        setEditingItemId(null);
        renderStagingList();
    } else if (action === 'cancel') {
        setEditingItemId(null);
        renderStagingList();
    }
});
viewListBtn.addEventListener('click', () => {
    stagingListEl.classList.remove('view-grid');
    stagingListEl.classList.add('view-list');
    viewListBtn.classList.add('active');
    viewGridBtn.classList.remove('active');
    renderStagingList();
});
viewGridBtn.addEventListener('click', () => {
    stagingListEl.classList.remove('view-list');
    stagingListEl.classList.add('view-grid');
    viewGridBtn.classList.add('active');
    viewListBtn.classList.remove('active');
    renderStagingList();
});
startSortBtn.addEventListener('click', startSort);

// === SORTING LOGIC =========================================================
function updateComparisonView() {
    const { a, b } = state.comparison;
    if (!a || !b) return;
    choiceAEl.querySelector('.card-text').textContent = a.text;
    const imgA = choiceAEl.querySelector('img');
    imgA.src = a.image || 'https://via.placeholder.com/200/f0f2f5/050505?text=TXT';
    imgA.alt = a.text;
    choiceBEl.querySelector('.card-text').textContent = b.text;
    const imgB = choiceBEl.querySelector('img');
    imgB.src = b.image || 'https://via.placeholder.com/200/f0f2f5/050505?text=TXT';
    imgB.alt = b.text;
    progressTextEl.textContent = `Comparison ${state.progress.current} of ~${state.progress.total}`;
    progressBarInnerEl.style.width = `${state.progress.total > 0 ? (state.progress.current / state.progress.total) * 100 : 0}%`;
}

function startSort() {
    if (state.items.length < 2) {
        alert("Please add at least two items to sort.");
        return;
    }
    state.isSorting = true;
    showView(viewComparison);
    const n = state.items.length;
    state.progress = { current: 0, total: Math.ceil(n * Math.log2(n)) };
    createSorter(
        state.items,
        (itemA, itemB, onResult) => {
            state.progress.current++;
            state.comparison = { a: itemA, b: itemB, callback: onResult };
            updateComparisonView();
        },
        (sortedItems) => onSortDone(sortedItems)
    );
}

viewComparison.addEventListener('click', (e) => {
    const choice = e.target.closest('[data-choice]')?.dataset.choice;
    if (!choice || !state.isSorting) return;
    if (choice === 'a') state.comparison.callback(1);
    else if (choice === 'b') state.comparison.callback(-1);
    else if (choice === 'tie') state.comparison.callback(0);
});

// === RESULTS VIEW LOGIC =======================================================
let selectedTierToAssign = null;
let editingTierIdForColor = null;

function calculateScores() {
    const n = state.items.length;
    if (n === 0) return;
    state.items.forEach((item, index) => {
        item.score = n > 1 ? 100 - (index * (100 / (n - 1))) : 100;
    });
}

function setInitialTierThresholds() {
    const numTiers = state.tiers.length;
    if (numTiers < 1) return;
    state.tiers.sort((a, b) => b.threshold - a.threshold);
    const step = 100 / numTiers;
    state.tiers.forEach((tier, index) => {
        tier.threshold = 100 - (index + 1) * step;
    });
    if (numTiers > 1) state.tiers[state.tiers.length - 1].threshold = 0;
}

function assignItemsToTiers() {
    state.tiers.sort((a, b) => b.threshold - a.threshold);
    state.tiers.forEach(tier => tier.itemIds = []);
    state.items.forEach(item => {
        for (const tier of state.tiers) {
            if (item.score >= tier.threshold) {
                item.tierId = tier.id;
                tier.itemIds.push(item.id);
                return;
            }
        }
    });
}

function updateTierColor(tierId, newHexColor) {
    const tier = state.tiers.find(t => t.id === tierId);
    if (!tier) return;
    tier.color = newHexColor;
    const r = parseInt(newHexColor.slice(1, 3), 16);
    const g = parseInt(newHexColor.slice(3, 5), 16);
    const b = parseInt(newHexColor.slice(5, 7), 16);
    tier.textColor = isColorDark([r, g, b]) ? '#FFFFFF' : '#000000';
    renderResultsView();
}

function renderResultsView() {
    // Render tier selection palette
    tierTagContainer.innerHTML = '';
    state.tiers.forEach(tier => {
        const tagEl = document.createElement('div');
        tagEl.className = 'tier-tag';
        tagEl.innerText = tier.label; // Use innerText to respect newlines
        tagEl.style.backgroundColor = tier.color;
        tagEl.style.color = tier.textColor;
        tagEl.dataset.tierId = tier.id;
        if (tier.id === selectedTierToAssign) tagEl.classList.add('selected');
        tierTagContainer.appendChild(tagEl);
    });

    // Render ranked list
    rankedListWrapper.innerHTML = '';
    const renderQueue = [
        ...state.items.map(i => ({ ...i, type: 'item' })),
        ...state.tiers.map(t => ({ type: 'tier', score: t.threshold, tier: t, id: t.id }))
    ];
    renderQueue.sort((a, b) => (a.score !== b.score) ? b.score - a.score : (a.type === 'item' ? -1 : 1));

    let lastItemScore = 101;
    renderQueue.forEach(entity => {
        if (entity.type === 'item') {
            const itemEl = document.createElement('div');
            itemEl.className = 'ranked-item';
            const itemTier = state.tiers.find(t => t.id === entity.tierId);
            if (itemTier) {
                const rgb = itemTier.color.match(/\d+/g);
                if (rgb) itemEl.style.backgroundColor = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.1)`;

                const gradientStyle = `
                    background-image: linear-gradient(to right, ${itemTier.textColor} ${entity.score}%, var(--text-primary) ${entity.score}%);
                    -webkit-background-clip: text;
                    background-clip: text;
                `;

                itemEl.innerHTML = `
                    <img class="ranked-item-img" src="${entity.image || 'https://via.placeholder.com/30'}" alt="${entity.text}">
                    <div class="ranked-item-info">
                        <div class="ranked-item-bar" style="background-color: ${itemTier.color}; width: ${entity.score || 0}%" title="${entity.text}"></div>
                        <span class="bar-label-gradient" style="${gradientStyle}">${entity.text}</span>
                        <div class="ranked-item-score">${(entity.score || 0).toFixed(1)}%</div>
                    </div>
                `;
                rankedListWrapper.appendChild(itemEl);
            }
            lastItemScore = entity.score;
        } else if (entity.type === 'tier') {
            const boundaryEl = document.createElement('div');
            boundaryEl.className = 'tier-boundary';
            boundaryEl.dataset.threshold = (lastItemScore + entity.score) / 2;
            const tagEl = document.createElement('div');
            tagEl.className = 'tier-tag assigned-tag';
            tagEl.dataset.tierId = entity.tier.id;
            tagEl.style.backgroundColor = entity.tier.color;
            tagEl.style.color = entity.tier.textColor;
            tagEl.innerText = entity.tier.label; // Use innerText

            const lineEl = document.createElement('div');
            lineEl.className = 'tier-boundary-line';

            boundaryEl.append(lineEl, tagEl);
            rankedListWrapper.appendChild(boundaryEl);
        }
    });

    // Render tier list grid
    tierListGridEl.innerHTML = '';
    state.tiers.forEach(tier => {
        const tierRowEl = document.createElement('div');
        tierRowEl.className = 'tier-row';
        const labelEl = document.createElement('div');
        labelEl.className = 'tier-label';
        labelEl.dataset.tierId = tier.id;
        labelEl.style.backgroundColor = tier.color;
        labelEl.style.color = tier.textColor;
        labelEl.title = "Left-click to change color, Right-click to rename";
        labelEl.innerText = tier.label; // Use innerText

        const itemsEl = document.createElement('div');
        itemsEl.className = 'tier-items';
        itemsEl.innerHTML = tier.itemIds.map(id => state.items.find(i => i.id === id)).map(item => `
            <img class="tier-item" src="${item.image || 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='}" alt="${item.text}" title="${item.text}">
        `).join('');

        tierRowEl.append(labelEl, itemsEl);
        tierListGridEl.appendChild(tierRowEl);
    });
}

function onSortDone(sortedItems) {
    state.isSorting = false;
    state.items = sortedItems;
    calculateScores();
    setInitialTierThresholds();
    assignItemsToTiers();
    showView(viewResults);
    renderResultsView();
}

// Results View Event Listeners
tierTagContainer.addEventListener('click', (e) => {
    const tierId = e.target.closest('.tier-tag')?.dataset.tierId;
    if (!tierId) return;
    selectedTierToAssign = (selectedTierToAssign === tierId) ? null : tierId;
    document.body.classList.toggle('assign-mode', !!selectedTierToAssign);
    renderResultsView();
});
rankedListWrapper.addEventListener('click', (e) => {
    const assignedTag = e.target.closest('.assigned-tag');
    if (assignedTag) {
        const tierId = assignedTag.dataset.tierId;
        selectedTierToAssign = (selectedTierToAssign === tierId) ? null : tierId;
        document.body.classList.toggle('assign-mode', !!selectedTierToAssign);
        renderResultsView();
        return;
    }
    const boundary = e.target.closest('.tier-boundary');
    if (selectedTierToAssign && boundary) {
        updateTierThreshold(selectedTierToAssign, parseFloat(boundary.dataset.threshold));
        selectedTierToAssign = null;
        document.body.classList.remove('assign-mode');
        assignItemsToTiers();
        renderResultsView();
    }
});
btnAddTier.addEventListener('click', () => { addTier(); assignItemsToTiers(); renderResultsView(); });
btnRemoveTier.addEventListener('click', () => { removeLastTier(); assignItemsToTiers(); renderResultsView(); });
btnRestart.addEventListener('click', () => {
    if (confirm("Are you sure you want to start over? This will clear all items and reset the page.")) {
        window.location.reload();
    }
});
tierListGridEl.addEventListener('click', (e) => {
    const tierLabel = e.target.closest('.tier-label');
    if (!tierLabel || tierLabel.querySelector('textarea')) return;
    editingTierIdForColor = tierLabel.dataset.tierId;
    tierColorInput.click();
});
tierListGridEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const tierLabel = e.target.closest('.tier-label');
    if (!tierLabel || tierLabel.querySelector('textarea')) return;

    const tierId = tierLabel.dataset.tierId;
    const originalText = state.tiers.find(t => t.id === tierId).label;

    const editInput = document.createElement('textarea');
    editInput.className = 'tier-label-edit';
    editInput.value = originalText;

    const saveChanges = () => {
        const newLabel = editInput.value;
        updateTierLabel(tierId, newLabel);
        renderResultsView(); // Re-renders the whole view, removing the textarea
    };

    editInput.addEventListener('blur', saveChanges);
    editInput.addEventListener('keydown', (evt) => {
        if (evt.key === 'Enter' && !evt.shiftKey) {
            evt.preventDefault();
            saveChanges();
        } else if (evt.key === 'Escape') {
            renderResultsView(); // Cancel editing by re-rendering
        }
    });

    tierLabel.innerHTML = '';
    tierLabel.appendChild(editInput);
    editInput.focus();
    editInput.select();
});
tierColorInput.addEventListener('input', (e) => {
    if (editingTierIdForColor) {
        updateTierColor(editingTierIdForColor, e.target.value);
    }
});

// === DYNAMIC IMAGE PREVIEW LOGIC ===========================================
let previewTimeoutId = null;
let isDragging = false;
stagingListEl.addEventListener('dragstart', () => { isDragging = true; hidePreview(); });
stagingListEl.addEventListener('dragend', () => { isDragging = false; });
stagingListEl.addEventListener('mouseover', (e) => showPreview(e));
stagingListEl.addEventListener('mouseout', () => hidePreview());
function hidePreview() {
    if (previewTimeoutId) clearTimeout(previewTimeoutId);
    globalPreviewEl.classList.remove('visible');
}
function showPreview(e) {
    if (isDragging) return;
    const wrapper = e.target.closest('.staging-item-thumbnail-wrapper');
    const imgEl = wrapper?.querySelector('.staging-item-img[src]');
    if (imgEl) {
        const hoverDelay = 500;
        previewTimeoutId = setTimeout(() => {
            globalPreviewEl.style.backgroundImage = `url(${imgEl.src})`;
            const rect = wrapper.getBoundingClientRect();
            const previewHeight = 200;
            const gap = 12;
            let top = (rect.top > previewHeight + gap) ? rect.top - previewHeight - gap : rect.bottom + gap;
            const left = rect.left + rect.width / 2 - 100;
            globalPreviewEl.style.top = `${top}px`;
            globalPreviewEl.style.left = `${left}px`;
            globalPreviewEl.classList.add('visible');
        }, hoverDelay);
    }
}

// === SORTABLEJS for Staging List ==========================================
new Sortable(stagingListEl, {
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

// === EXPORT ==========================================

btnExportImage.addEventListener('click', async () => {
    const elementToCapture = document.getElementById('tier-list-export-area');

    const originalButtonText = btnExportImage.textContent;
    btnExportImage.textContent = 'Generating...';
    btnExportImage.disabled = true;

    document.body.classList.add('is-exporting');

    setTimeout(async () => {
        try {
            await exportElementAsImage(elementToCapture, 'my-tier-list.png');
        } finally {
            document.body.classList.remove('is-exporting');
            btnExportImage.textContent = originalButtonText;
            btnExportImage.disabled = false;
        }
    }, 100);
});

// === TIER ITEM SIZE ADJUSTMENT LOGIC ===
const ITEM_SIZE_STEP = 8; // Adjust size by 8px at a time
const MIN_ITEM_SIZE = 32;
const MAX_ITEM_SIZE = 128;

function getCurrentItemSize() {
    const currentSizeStr = getComputedStyle(tierListGridEl).getPropertyValue('--tier-item-size');
    return parseInt(currentSizeStr, 10) || 64; // Default to 64 if not found
}

function setItemSize(newSize) {
    const clampedSize = Math.max(MIN_ITEM_SIZE, Math.min(newSize, MAX_ITEM_SIZE));
    tierListGridEl.style.setProperty('--tier-item-size', `${clampedSize}px`);
}

btnSizeIncrease.addEventListener('click', () => {
    setItemSize(getCurrentItemSize() + ITEM_SIZE_STEP);
});

btnSizeDecrease.addEventListener('click', () => {
    setItemSize(getCurrentItemSize() - ITEM_SIZE_STEP);
});

btnCopyImage.addEventListener('click', async () => {
    const elementToCapture = document.getElementById('tier-list-export-area');

    const originalButtonText = btnCopyImage.textContent;
    btnCopyImage.textContent = 'Copying...';
    btnCopyImage.disabled = true;
    document.body.classList.add('is-exporting');

    setTimeout(async () => {
        try {
            const success = await copyElementAsImage(elementToCapture);
            if (success) {
                btnCopyImage.textContent = 'Copied!';
                setTimeout(() => {
                    btnCopyImage.textContent = originalButtonText;
                }, 2000);
            } else {
                btnCopyImage.textContent = originalButtonText;
            }
        } finally {
            document.body.classList.remove('is-exporting');
            btnCopyImage.disabled = false;
        }
    }, 100);
});

// === NEW SESSION IMPORT/EXPORT ===

btnExportSession.addEventListener('click', async () => {
    if (state.items.length === 0) {
        alert("There is nothing to export.");
        return;
    }
    
    const originalText = btnExportSession.textContent;
    btnExportSession.textContent = "Exporting...";
    btnExportSession.disabled = true;

    try {
        await exportSessionToFile();
    } catch (error) {
        console.error("Export failed:", error);
        alert("An error occurred during export.");
    } finally {
        btnExportSession.textContent = originalText;
        btnExportSession.disabled = false;
    }
});

btnImportSession.addEventListener('click', () => {
    // Trigger the hidden file input
    sessionFileInput.click();
});

sessionFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm("Importing a session file will overwrite your current progress. Are you sure?")) {
        // Clear the file input so the same file can be selected again
        e.target.value = null;
        return;
    }
    
    try {
        const loadedState = await importSessionFromFile(file);
        
        // Restore the loaded state into our main state object
        state.items = loadedState.items || [];
        state.tiers = loadedState.tiers || [];
        
        // Reset any transient state
        state.editingItemId = null;
        state.isSorting = false;
        
        alert("Session imported successfully!");
        
        // Determine which view to show based on loaded data
        if (state.items.length > 0) {
            if (state.items[0].score !== undefined) {
                assignItemsToTiers();
                showView(viewResults);
                renderResultsView();
            } else {
                showView(viewInput);
                renderStagingList();
            }
        } else {
            // Default to input view if no items
            showView(viewInput);
            renderStagingList();
        }

    } catch (error) {
        console.error("Failed to import session:", error);
        alert(`Error importing session: ${error.message}`);
    } finally {
        // Clear the file input so the same file can be selected again
        e.target.value = null;
    }
});