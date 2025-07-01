import * as dom from './dom.js';
import { state, abortSort, setComparisonMode } from './state.js';
import { showView } from './view.js';
import { createSorter } from './sorter.js';
import { onSortDone } from './resultsController.js';
import { hidePreview, showPreview } from './ui.js';
import Sortable from 'sortablejs';

let currentlySeedingItem = null;
const comparisonCache = new Map();
let replayLogIndex = 0;

function handleKeyboardSorting(e) {
    if (!state.isSorting || !state.comparison.callback) return;

    // Global shortcuts during sorting
    if (e.key.toLowerCase() === 'u') {
        e.preventDefault();
        handleUndoComparison();
        return;
    }
    if (e.key.toLowerCase() === 's' && !state.isResolvingSkips) {
        e.preventDefault();
        handleSkipComparison();
        return;
    }

    // Pairwise-specific shortcuts
    if (state.comparisonMode !== 2) return;

    const { callback } = state.comparison;
    let choiceMade = false;
    switch (e.key) {
        case 'ArrowLeft': case '1':
            callback(1);
            choiceMade = true;
            break;
        case 'ArrowRight': case '2':
            callback(-1);
            choiceMade = true;
            break;
        case ' ': case '0':
            callback(0);
            choiceMade = true;
            break;
    }
    if (choiceMade) {
        e.preventDefault();
    }
}

export function cleanupSortListeners() {
    document.removeEventListener('keydown', handleKeyboardSorting);
}

function displayNextSeedItem() {
    currentlySeedingItem = state.items.find(item => state.itemSeedValues[item.id] === undefined);

    if (currentlySeedingItem) {
        state.seedingProgress.current++;
        dom.seedingCardEl.querySelector('.card-text').textContent = currentlySeedingItem.text;
        const img = dom.seedingCardEl.querySelector('img');
        img.src = currentlySeedingItem.image || 'https://via.placeholder.com/200/f0f2f5/050505?text=TXT';
        img.alt = currentlySeedingItem.text;

        dom.seedingProgressTextEl.textContent = `Rating Item ${state.seedingProgress.current} of ${state.seedingProgress.total}`;
        dom.seedingProgressBarInnerEl.style.width = `${(state.seedingProgress.current / state.seedingProgress.total) * 100}%`;
    } else {
        onSeedingComplete();
    }
}

function startSeeding() {
    state.isSeeding = true;
    state.itemSeedValues = {};
    state.seedingProgress = { current: 0, total: state.items.length };
    comparisonCache.clear();
    replayLogIndex = 0; // Reset replay index for a fresh sort

    dom.seedTierButtonsEl.innerHTML = '';
    state.seedTiers.forEach(tier => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary';
        btn.textContent = tier.label;
        btn.dataset.value = tier.value;
        btn.style.setProperty('--accent-primary', tier.color);
        dom.seedTierButtonsEl.appendChild(btn);
    });

    showView(dom.viewSeeding);
    displayNextSeedItem();
}

export function handleSeedButtonClick(value) {
    if (!value || !state.isSeeding || !currentlySeedingItem) return;
    state.itemSeedValues[currentlySeedingItem.id] = parseInt(value, 10);
    displayNextSeedItem();
}

function finalizeSort(sortedItems) {
    cleanupSortListeners();
    onSortDone(sortedItems);
}

function resolveSkippedComparisons(partiallySortedItems) {
    state.isSorting = true;
    state.isResolvingSkips = true;

    if (state.skippedComparisons.length === 0) {
        finalizeSort(partiallySortedItems);
        return;
    }

    const itemsToResolve = state.skippedComparisons[0];
    state.progress.current++;

    const onResolveChoice = (result) => {
        // A tie (0) is not a valid choice during resolution.
        // The user MUST rank the items.
        if (result !== 0) {
            const [itemA, itemB] = itemsToResolve;
            const indexA = partiallySortedItems.findIndex(i => i.id === itemA.id);
            const indexB = partiallySortedItems.findIndex(i => i.id === itemB.id);

            const userWantsAGreater = result > 0;
            const isAActuallyGreater = indexA < indexB; // Lower index means higher rank

            if (userWantsAGreater !== isAActuallyGreater) {
                [partiallySortedItems[indexA], partiallySortedItems[indexB]] = [partiallySortedItems[indexB], partiallySortedItems[indexA]];
            }
        }
        state.skippedComparisons.shift();
        resolveSkippedComparisons(partiallySortedItems);
    };

    state.comparison = { items: itemsToResolve, callback: onResolveChoice };
    updateComparisonView();
}


async function onSeedingComplete() {
    state.isSeeding = false;
    const itemGroups = state.items.reduce((groups, item) => {
        const seedValue = state.itemSeedValues[item.id] || 0;
        if (!groups[seedValue]) groups[seedValue] = [];
        groups[seedValue].push(item);
        return groups;
    }, {});

    const sortedGroups = [];
    const seedValues = Object.keys(itemGroups).map(Number).sort((a, b) => b - a);

    const totalComparisons = seedValues.reduce((total, key) => {
        const group = itemGroups[key];
        const n = group.length;
        if (n > 1) {
            // Ternary sort is more efficient, adjust the estimate
            if (state.comparisonMode === 3) {
                total += Math.ceil(n * Math.log2(n) / Math.log2(3));
            } else {
                total += Math.ceil(n * Math.log2(n));
            }
        }
        return total;
    }, 0);
    state.progress = { current: state.decisionLog.length, total: totalComparisons };

    state.isSorting = true;
    showView(dom.viewComparison);

    dom.btnUndoComparison.style.visibility = 'hidden';

    const generateKey = (id1, id2) => [id1, id2].sort().join('-');
    const getIds = (items) => items.map(i => i.id).sort().join(',');

    for (const seedValue of seedValues) {
        const group = itemGroups[seedValue];
        if (group.length > 1) {
            const sortedGroup = await new Promise((resolve) => {
                createSorter(group, state.comparisonMode,
                    (itemsToCompare, onResult) => {
                        // --- REPLAY LOGIC ---
                        if (replayLogIndex < state.decisionLog.length) {
                            const decision = state.decisionLog[replayLogIndex];
                            // Sanity check to ensure the sorter is asking for the same items we logged
                            if (getIds(decision.items) === getIds(itemsToCompare)) {
                                replayLogIndex++;
                                onResult(decision.result);
                                return;
                            }
                        }

                        // --- LIVE COMPARISON LOGIC ---
                        if (itemsToCompare.length === 2) {
                            const [itemA, itemB] = itemsToCompare;
                            const key = generateKey(itemA.id, itemB.id);
                            if (comparisonCache.has(key)) {
                                let cachedResult = comparisonCache.get(key);
                                if (itemA.id > itemB.id) cachedResult = -cachedResult;
                                onResult(cachedResult);
                                return;
                            }
                        }

                        const onResultWithCacheAndLog = (result) => {
                            if (itemsToCompare.length === 2) {
                                const [itemA, itemB] = itemsToCompare;
                                const key = generateKey(itemA.id, itemB.id);
                                let resultToCache = result;
                                if (itemA.id > itemB.id) resultToCache = -result;
                                comparisonCache.set(key, resultToCache);
                            }
                            state.decisionLog.push({ items: itemsToCompare, result });
                            onResult(result);
                        };

                        state.progress.current++;
                        state.comparison = { items: itemsToCompare, callback: onResultWithCacheAndLog };
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

    if (state.skippedComparisons.length > 0) {
        state.progress.total += state.skippedComparisons.length;
        resolveSkippedComparisons(sortedGroups);
    } else {
        finalizeSort(sortedGroups);
    }
}


function updateComparisonView() {
    const { items, callback } = state.comparison;
    if (!items || items.length === 0) return;

    // --- Control button visibility based on state ---
    // MODIFIED: Show Undo button if there are decisions, otherwise keep hidden.
    dom.btnUndoComparison.style.visibility = (state.decisionLog.length > 0 && !state.isResolvingSkips) ? 'visible' : 'hidden';

    // MODIFIED: Disable Skip button for tri-wise mode.
    dom.btnSkipComparison.style.display = (state.isResolvingSkips || state.comparisonMode === 3) ? 'none' : 'inline-block';

    // --- Update titles ---
    if (state.isResolvingSkips) {
        dom.comparisonTitleEl.textContent = `Resolving Skipped Comparison (${state.progress.current} of ${state.progress.total})`;
    } else {
        dom.comparisonTitleEl.textContent = state.comparisonMode === 3 ? `Drag to rank the items (1st is best), then confirm.` : "Which do you rank higher?";
    }

    // MODIFIED: Update instructions based on comparison mode
    if (state.comparisonMode === 3) {
        dom.comparisonInstructionsEl.innerHTML = `Drag and drop the items to reflect your ranking. The highest ranked item should be at the top (or left). Click <b>Confirm Ranking</b> to proceed.`;
    } else {
        dom.comparisonInstructionsEl.innerHTML = `Click the item you rank higher. You can also use keyboard keys: <b>1/Left Arrow</b> for left, <b>2/Right Arrow</b> for right, and <b>Space/0</b> for a tie.`;
    }

    // --- Render comparison UI ---
    if (state.comparisonMode === 3) { // Tri-wise Mode
        dom.triLayoutControls.style.display = 'flex';
        const ranks = ['1st', '2nd', '3rd'];
        dom.comparisonAreaEl.innerHTML = `
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
        if (dom.btnTriLayoutHorizontal.classList.contains('active')) rankingListEl.classList.add('layout-horizontal');

        new Sortable(rankingListEl, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            onEnd: function (evt) {
                // Update the rank labels visually after dragging
                const items = rankingListEl.querySelectorAll('.triwise-rank-item');
                const ranks = ['1st', '2nd', '3rd'];
                const rankClasses = ['rank-1', 'rank-2', 'rank-3'];
                items.forEach((item, index) => {
                    const label = item.querySelector('.triwise-rank-label');
                    if (label) {
                        label.textContent = ranks[index];
                        label.classList.remove(...rankClasses);
                        label.classList.add(`rank-${index + 1}`);
                    }
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
        dom.comparisonAreaEl.onclick = null;

    } else { // Pairwise Mode
        dom.triLayoutControls.style.display = 'none';
        dom.comparisonAreaEl.innerHTML = `
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
        dom.comparisonAreaEl.onclick = (e) => {
            const choice = e.target.closest('[data-choice]')?.dataset.choice;
            if (!choice) return;
            if (state.isResolvingSkips && choice === 'tie') return; // Disallow tie in resolution phase
            if (choice === 'a') callback(1);
            else if (choice === 'b') callback(-1);
            else if (choice === 'tie') callback(0);
        };
    }

    dom.progressTextEl.textContent = `Comparison ${state.progress.current} of ~${state.progress.total}`;
    dom.progressBarInnerEl.style.width = `${state.progress.total > 0 ? (state.progress.current / state.progress.total) * 100 : 0}%`;
}


export function startSort() {
    if (state.items.length < 2) {
        alert("Please add at least two items to sort.");
        return;
    }

    if (state.comparisonMode === 'ask') {
        dom.modeChoiceModal.style.display = 'flex';

        const makeChoice = (mode) => {
            setComparisonMode(mode);
            dom.modeChoiceModal.style.display = 'none';
            _startSortInternal();
            // Clean up listeners to prevent multiple triggers
            dom.modalBtnPairwise.onclick = null;
            dom.modalBtnTriwise.onclick = null;
        };

        dom.modalBtnPairwise.onclick = () => makeChoice(2);
        dom.modalBtnTriwise.onclick = () => makeChoice(3);

    } else {
        _startSortInternal();
    }
}

export function handleUndoComparison() {
    if (!state.isSorting || state.isResolvingSkips || state.decisionLog.length === 0) return;

    // MODIFIED: Clear the comparison cache to force the sorter to re-ask.
    comparisonCache.clear();

    state.decisionLog.pop();
    cleanupSortListeners();

    // Reset sort-in-progress state, but keep seeding results and logs
    state.isSorting = false;
    state.comparison = { items: [], callback: null };
    state.progress = { current: 0, total: 0 };
    replayLogIndex = 0; // Ensure replay starts from the beginning

    // Re-attach listener and restart the sorting process from after seeding
    document.addEventListener('keydown', handleKeyboardSorting);
    onSeedingComplete();
}

export function handleSkipComparison() {
    // MODIFIED: Added check for comparison mode
    if (!state.isSorting || state.isResolvingSkips || state.comparisonMode === 3) return;

    const { items, callback } = state.comparison;
    if (items && callback) {
        state.skippedComparisons.push(items);
        callback(0); // Treat as a tie to allow the sort to continue
    }
}

export function handleSkipSeeding() {
    if (!state.isSeeding) return;

    // Assign a default middle-tier seed value to all un-seeded items.
    const defaultSeedValue = state.seedTiers.find(t => t.label.toLowerCase().includes('mid'))?.value || 3;
    state.items.forEach(item => {
        if (state.itemSeedValues[item.id] === undefined) {
            state.itemSeedValues[item.id] = defaultSeedValue;
        }
    });

    // Proceed directly to the main sort.
    onSeedingComplete();
}

function _startSortInternal() {
    // Fully reset state for a new sort process initiated by the user
    abortSort();
    state.sortStartTime = performance.now();

    document.addEventListener('keydown', handleKeyboardSorting);
    startSeeding();
}