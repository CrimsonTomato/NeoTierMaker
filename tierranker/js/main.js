import '../style.css';
import { handleTextInput, handleFileInput } from './inputController.js';
import { state, clearItems, removeItem, setEditingItemId, updateItemText, addTier, removeLastTier, updateTierLabel, updateTierThreshold, updateTitle, setComparisonMode  } from './state.js';
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
const btnExportSession = document.getElementById('btn-export-session');
const btnImportSession = document.getElementById('btn-import-session');
const sessionFileInput = document.getElementById('session-file-input');
const resultsListTitle = document.getElementById('results-list-title');
const viewSeeding = document.getElementById('view-seeding');
const seedingCardEl = document.getElementById('seeding-card');
const seedTierButtonsEl = document.getElementById('seed-tier-buttons');
const seedingProgressTextEl = document.getElementById('seeding-progress-text');
const seedingProgressBarInnerEl = document.getElementById('seeding-progress-bar-inner');
const comparisonModeRadios = document.querySelectorAll('input[name="comparison-mode"]');
const comparisonAreaEl = document.getElementById('comparison-area');
const comparisonTitleEl = document.getElementById('comparison-title');
const triLayoutControls = document.getElementById('tri-layout-controls');
const btnTriLayoutVertical = document.getElementById('btn-tri-layout-vertical');
const btnTriLayoutHorizontal = document.getElementById('btn-tri-layout-horizontal');

// --- HELPER & UTILITY FUNCTIONS ---
function showView(viewElement) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    viewElement.classList.add('active');
}

// --- INITIALIZATION ---
renderStagingList();

// === EVENT LISTENERS =======================================================

comparisonModeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        setComparisonMode(e.target.value);
    });
});
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

btnTriLayoutVertical.addEventListener('click', () => {
    const list = document.getElementById('triwise-ranking-list');
    if (list) {
        list.classList.remove('layout-horizontal');
        btnTriLayoutVertical.classList.add('active');
        btnTriLayoutHorizontal.classList.remove('active');
    }
});

btnTriLayoutHorizontal.addEventListener('click', () => {
    const list = document.getElementById('triwise-ranking-list');
    if (list) {
        list.classList.add('layout-horizontal');
        btnTriLayoutHorizontal.classList.add('active');
        btnTriLayoutVertical.classList.remove('active');
    }
});

// === SORTING LOGIC ========================================

let currentlySeedingItem = null;

function displayNextSeedItem() {
    currentlySeedingItem = state.items.find(item => state.itemSeedValues[item.id] === undefined);

    if (currentlySeedingItem) {
        state.seedingProgress.current++;
        seedingCardEl.querySelector('.card-text').textContent = currentlySeedingItem.text;
        const img = seedingCardEl.querySelector('img');
        img.src = currentlySeedingItem.image || 'https://via.placeholder.com/200/f0f2f5/050505?text=TXT';
        img.alt = currentlySeedingItem.text;

        seedingProgressTextEl.textContent = `Rating Item ${state.seedingProgress.current} of ${state.seedingProgress.total}`;
        seedingProgressBarInnerEl.style.width = `${(state.seedingProgress.current / state.seedingProgress.total) * 100}%`;
    } else {
        onSeedingComplete();
    }
}

function startSeeding() {
    state.isSeeding = true;
    state.itemSeedValues = {};
    state.seedingProgress = { current: 0, total: state.items.length };

    seedTierButtonsEl.innerHTML = '';
    state.seedTiers.forEach(tier => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary';
        btn.textContent = tier.label;
        btn.dataset.value = tier.value;
        btn.style.setProperty('--accent-primary', tier.color);
        seedTierButtonsEl.appendChild(btn);
    });
    
    showView(viewSeeding);
    displayNextSeedItem();
}

seedTierButtonsEl.addEventListener('click', (e) => {
    const value = e.target.closest('[data-value]')?.dataset.value;
    if (!value || !state.isSeeding || !currentlySeedingItem) return;

    state.itemSeedValues[currentlySeedingItem.id] = parseInt(value, 10);
    displayNextSeedItem();
});

async function onSeedingComplete() {
    state.isSeeding = false;

    const itemGroups = state.items.reduce((groups, item) => {
        const seedValue = state.itemSeedValues[item.id];
        if (!groups[seedValue]) {
            groups[seedValue] = [];
        }
        groups[seedValue].push(item);
        return groups;
    }, {});

    const sortedGroups = [];
    const seedValues = Object.keys(itemGroups).map(Number).sort((a, b) => b - a);

    const totalComparisons = seedValues.reduce((total, key) => {
        const group = itemGroups[key];
        const n = group.length;
        if (n > 1) {
            total += Math.ceil(n * Math.log2(n));
        }
        return total;
    }, 0);
    state.progress = { current: 0, total: totalComparisons };

    state.isSorting = true;
    showView(viewComparison);
    
    // FIX: This cache will store results to prevent redundant comparisons like A-B and B-A.
    const comparisonCache = new Map();
    const generateKey = (id1, id2) => [id1, id2].sort().join('-');

    for (const seedValue of seedValues) {
        const group = itemGroups[seedValue];
        if (group.length > 1) {
            const sortedGroup = await new Promise((resolve) => {
                createSorter(
                    group,
                    state.comparisonMode,
                    // This is a "decorated" onCompare function that adds caching
                    (itemsToCompare, onResult) => {
                        // Caching only applies to pairwise mode
                        if (itemsToCompare.length === 2) {
                            const [itemA, itemB] = itemsToCompare;
                            const key = generateKey(itemA.id, itemB.id);

                            if (comparisonCache.has(key)) {
                                let cachedResult = comparisonCache.get(key);
                                // If the query order is reversed from the canonical key order, invert the result
                                if (itemA.id > itemB.id) {
                                    cachedResult = -cachedResult;
                                }
                                // Resolve immediately without showing the user anything
                                onResult(cachedResult);
                                return;
                            }
                        }

                        // This is the callback the user's action will trigger.
                        // We wrap it to store the result in our cache before passing it on.
                        const onResultWithCache = (result) => {
                            if (itemsToCompare.length === 2) {
                                const [itemA, itemB] = itemsToCompare;
                                const key = generateKey(itemA.id, itemB.id);
                                
                                let resultToCache = result;
                                // Store the result relative to the canonical key order
                                if (itemA.id > itemB.id) {
                                    resultToCache = -result;
                                }
                                comparisonCache.set(key, resultToCache);
                            }
                            // Now call the original callback from the sorter
                            onResult(result);
                        };
                        
                        // If we're here, it's a new comparison. Show the UI.
                        state.progress.current++;
                        state.comparison = { items: itemsToCompare, callback: onResultWithCache };
                        updateComparisonView();
                    },
                    (finalSortedGroup) => {
                        resolve(finalSortedGroup);
                    }
                );
            });
            sortedGroups.push(...sortedGroup);
        } else if (group.length === 1) {
            sortedGroups.push(group[0]);
        }
    }
    
    onSortDone(sortedGroups);
}

function updateComparisonView() {
    const { items, callback } = state.comparison;
    if (!items || items.length === 0) return;

    if (state.comparisonMode === 3) {
        triLayoutControls.style.display = 'flex'; // Show controls
        const ranks = ['1st', '2nd', '3rd'];
        comparisonTitleEl.textContent = `Drag to rank the items (1st is best), then confirm.`;
        
        comparisonAreaEl.innerHTML = `
            <div id="triwise-ranking-list">
                ${items.map((item, index) => `
                    <div class="triwise-rank-item" data-id="${item.id}">
                        <div class="triwise-rank-label rank-${index + 1}">${ranks[index]}</div>
                        <div class="comparison-card-draggable">
                             <div class="card-image-container triwise-image-wrapper">
                                 <img class="triwise-image" src="${item.image || 'https://via.placeholder.com/150'}" alt="${item.text}">
                             </div>
                             <h3 class="card-text">${item.text}</h3>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="tie-button-container">
                <button id="confirm-ranking-btn" class="btn btn-primary">Confirm Ranking</button>
            </div>
        `;
        
        const rankingListEl = document.getElementById('triwise-ranking-list');
        const confirmBtn = document.getElementById('confirm-ranking-btn');

        // Apply the correct layout class based on the active button
        if (btnTriLayoutHorizontal.classList.contains('active')) {
            rankingListEl.classList.add('layout-horizontal');
        }

        new Sortable(rankingListEl, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            // --- FIX: Add onEnd event handler to update ranks ---
            onEnd: () => {
                const rankLabels = rankingListEl.querySelectorAll('.triwise-rank-label');
                rankLabels.forEach((label, index) => {
                    label.textContent = ranks[index];
                    // Remove old rank classes and add the new one for correct coloring
                    label.classList.remove('rank-1', 'rank-2', 'rank-3');
                    label.classList.add(`rank-${index + 1}`);
                });
            }
        });
        
        rankingListEl.addEventListener('mouseover', (e) => showPreview(e, '.triwise-image-wrapper'));
        rankingListEl.addEventListener('mouseout', () => hidePreview());
        
        confirmBtn.onclick = () => {
            hidePreview();
            const rankedItemElements = rankingListEl.querySelectorAll('.triwise-rank-item');
            const rankedIds = Array.from(rankedItemElements).map(el => el.dataset.id);
            const rankedItems = rankedIds.map(id => items.find(item => item.id === id));
            callback(rankedItems);
        };
        comparisonAreaEl.onclick = null;

    } else { // Pairwise mode
        triLayoutControls.style.display = 'none'; // Hide controls
        comparisonTitleEl.textContent = "Which do you rank higher?";
        comparisonAreaEl.innerHTML = `
            <div class="pairwise-container">
                <div class="comparison-card" data-choice="a">
                    <div class="card-image-container"><img src="${items[0].image || 'https://via.placeholder.com/200'}" alt="${items[0].text}"></div>
                    <h3 class="card-text">${items[0].text}</h3>
                </div>
                <div class="comparison-card" data-choice="b">
                    <div class="card-image-container"><img src="${items[1].image || 'https://via.placeholder.com/200'}" alt="${items[1].text}"></div>
                    <h3 class="card-text">${items[1].text}</h3>
                </div>
            </div>
            <div class="tie-button-container"><button class="btn btn-secondary" data-choice="tie">It's a Tie</button></div>
        `;
        comparisonAreaEl.onclick = (e) => {
            const choice = e.target.closest('[data-choice]')?.dataset.choice;
            if (!choice) return;
            if (choice === 'a') callback(1);
            else if (choice === 'b') callback(-1);
            else if (choice === 'tie') callback(0);
        };
    }
    
    progressTextEl.textContent = `Comparison ${state.progress.current} of ~${state.progress.total}`;
    progressBarInnerEl.style.width = `${state.progress.total > 0 ? (state.progress.current / state.progress.total) * 100 : 0}%`;
}


function startSort() {
    if (state.items.length < 2) {
        alert("Please add at least two items to sort.");
        return;
    }
    startSeeding();
}

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
    resultsListTitle.textContent = state.title;

    tierTagContainer.innerHTML = '';
    state.tiers.forEach(tier => {
        const tagEl = document.createElement('div');
        tagEl.className = 'tier-tag';
        tagEl.innerText = tier.label;
        tagEl.style.backgroundColor = tier.color;
        tagEl.style.color = tier.textColor;
        tagEl.dataset.tierId = tier.id;
        if (tier.id === selectedTierToAssign) tagEl.classList.add('selected');
        tierTagContainer.appendChild(tagEl);
    });

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
            tagEl.innerText = entity.tier.label;

            const lineEl = document.createElement('div');
            lineEl.className = 'tier-boundary-line';

            boundaryEl.append(lineEl, tagEl);
            rankedListWrapper.appendChild(boundaryEl);
        }
    });

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
        labelEl.innerText = tier.label;

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
        renderResultsView();
    };

    editInput.addEventListener('blur', saveChanges);
    editInput.addEventListener('keydown', (evt) => {
        if (evt.key === 'Enter' && !evt.shiftKey) {
            evt.preventDefault();
            saveChanges();
        } else if (evt.key === 'Escape') {
            renderResultsView();
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

let previewTimeoutId = null;
let isDragging = false;
stagingListEl.addEventListener('dragstart', () => { isDragging = true; hidePreview(); });
stagingListEl.addEventListener('dragend', () => { isDragging = false; });
stagingListEl.addEventListener('mouseover', (e) => showPreview(e, '.staging-item-thumbnail-wrapper'));
stagingListEl.addEventListener('mouseout', () => hidePreview());

function hidePreview() {
    if (previewTimeoutId) clearTimeout(previewTimeoutId);
    globalPreviewEl.classList.remove('visible');
}

// Updated showPreview to be more generic
function showPreview(e, wrapperSelector) {
    if (isDragging) return;
    const wrapper = e.target.closest(wrapperSelector);
    // Find an image with a src attribute inside the wrapper
    const imgEl = wrapper?.querySelector('img[src]'); 
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

const ITEM_SIZE_STEP = 8;
const MIN_ITEM_SIZE = 32;
const MAX_ITEM_SIZE = 128;

function getCurrentItemSize() {
    const currentSizeStr = getComputedStyle(tierListGridEl).getPropertyValue('--tier-item-size');
    return parseInt(currentSizeStr, 10) || 64;
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
    sessionFileInput.click();
});

sessionFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm("Importing a session file will overwrite your current progress. Are you sure?")) {
        e.target.value = null;
        return;
    }
    
    try {
        const loadedState = await importSessionFromFile(file);
        
        state.items = loadedState.items || [];
        state.tiers = loadedState.tiers || [];
        state.title = loadedState.title || 'Tier List';
        
        state.editingItemId = null;
        state.isSorting = false;
        
        alert("Session imported successfully!");
        
        if (state.items.length > 0) {
            if (state.items.some(item => item.score !== undefined)) {
                showView(viewResults);
                renderResultsView();
            } else {
                showView(viewInput);
                renderStagingList();
            }
        } else {
            showView(viewInput);
            renderStagingList();
        }

    } catch (error) {
        console.error("Failed to import session:", error);
        alert(`Error importing session: ${error.message}`);
    } finally {
        e.target.value = null;
    }
});

resultsListTitle.addEventListener('click', () => {
    if (resultsListTitle.querySelector('input')) return;

    const originalTitle = state.title;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'title-edit-input';
    input.value = originalTitle;

    const saveChanges = () => {
        const newTitle = input.value.trim();
        updateTitle(newTitle || "Tier List");
        renderResultsView();
    };

    input.addEventListener('blur', saveChanges);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveChanges();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            renderResultsView();
        }
    });

    resultsListTitle.innerHTML = '';
    resultsListTitle.appendChild(input);
    input.focus();
    input.select();
});