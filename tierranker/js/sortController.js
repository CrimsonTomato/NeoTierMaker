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
let isSimulating = false;

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


async function onSeedingComplete(isSimulation = false) {
    state.isSeeding = false;
    const itemGroups = state.items.reduce((groups, item) => {
        let seedValue = state.itemSeedValues[item.id];
        // Handle items skipped during seeding (they get a default middle value)
        if (seedValue === undefined) {
            const defaultSeedValue = state.seedTiers.find(t => t.label.toLowerCase().includes('mid'))?.value || 3;
            seedValue = defaultSeedValue;
        }
        if (!groups[seedValue]) groups[seedValue] = [];
        groups[seedValue].push(item);
        return groups;
    }, {});

    const sortedGroups = [];
    const seedValues = Object.keys(itemGroups).map(Number).sort((a, b) => b - a);

    // No need to calculate progress for a simulation
    if (!isSimulation) {
        const totalComparisons = seedValues.reduce((total, key) => {
            const group = itemGroups[key];
            const n = group.length;
            if (n > 1) {
                if (state.comparisonMode === 3) {
                    total += Math.ceil(n * Math.log2(n) / Math.log2(3));
                } else {
                    total += Math.ceil(n * Math.log2(n));
                }
            }
            return total;
        }, 0);
        state.progress = { current: state.decisionLog.length, total: totalComparisons };
    }


    state.isSorting = true;
    // MODIFIED: Don't show the view or buttons during simulation
    if (!isSimulation) {
        showView(dom.viewComparison);
        dom.btnUndoComparison.style.visibility = 'hidden';
    }

    const generateKey = (id1, id2) => [id1, id2].sort().join('-');
    const getIds = (items) => items.map(i => i.id).sort().join(',');

    // NEW: Map to hold the current sorted state of each group. Initialize with original groups.
    const liveSortedGroups = new Map();
    seedValues.forEach(val => liveSortedGroups.set(val, [...(itemGroups[val] || [])]));

    // --- MODIFICATION: Create a dedicated counter for simulation mode ---
    let simulationComparisonCount = 0;

    const onProgressCallback = (partiallySortedGroup, context) => {
        // --- MODIFICATION: REMOVED the `if (isSimulation) return;` check ---

        // Update the map with the latest sorted version of the current group
        liveSortedGroups.set(context.seedValue, partiallySortedGroup);

        // Construct the full, global list by concatenating all groups in order
        let globalSnapshot = [];
        seedValues.forEach(val => {
            const groupItems = liveSortedGroups.get(val) || [];
            globalSnapshot.push(...groupItems);
        });

        // Now we have a full list with a global ranking. Record it.
        const ranks = globalSnapshot.map((item, index) => ({
            id: item.id,
            rank: index + 1, // 1-based rank
        }));

        state.rankHistory.push({
            // --- MODIFICATION: Use the correct counter based on mode ---
            comparisonCount: isSimulation ? simulationComparisonCount : state.progress.current,
            ranks: ranks,
        });
    };


    // --- NEW: Define the automated comparison callback for simulation ---
    const simulationCompareCallback = (itemsToCompare, onResult) => {
        // --- MODIFICATION: Increment the simulation counter on each decision ---
        simulationComparisonCount++;
        if (itemsToCompare.length === 2) {
            // For pairwise, randomly return 1 (A > B), -1 (B > A), or 0 (tie)
            const result = Math.floor(Math.random() * 3) - 1;
            onResult(result);
        } else if (itemsToCompare.length === 3) {
            // For tri-wise, shuffle the array to get a random ranking
            const shuffled = [...itemsToCompare].sort(() => Math.random() - 0.5);
            onResult(shuffled);
        }
    };

    // --- Define the standard interactive comparison callback ---
    const interactiveCompareCallback = (itemsToCompare, onResult) => {
        // --- REPLAY LOGIC ---
        if (replayLogIndex < state.decisionLog.length) {
            const decision = state.decisionLog[replayLogIndex];
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
    };


    for (const seedValue of seedValues) {
        const group = itemGroups[seedValue];
        if (group.length > 1) {
            const sortedGroup = await new Promise((resolve) => {
                createSorter(
                    group,
                    state.comparisonMode,
                    isSimulation ? simulationCompareCallback : interactiveCompareCallback,
                    (finalSortedGroup) => {
                        // Also update the map with the final sorted group before resolving
                        liveSortedGroups.set(seedValue, finalSortedGroup);
                        resolve(finalSortedGroup);
                    },
                    onProgressCallback,
                    { seedValue } // Pass context for the callback
                );
            });
            sortedGroups.push(...sortedGroup);
        } else if (group.length === 1) {
            sortedGroups.push(group[0]);
        }
    }

    // --- MODIFICATION: Set the final comparison count for the simulation stats ---
    if (isSimulation) {
        state.sortStats.comparisons = simulationComparisonCount;
    }

    // Skips are not possible in simulation, so this only runs for interactive sorts.
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
    isSimulating = false; // Ensure simulation flag is off for normal sort

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
    state.rankHistory = []; // Also clear rank history on undo

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
    abortSort();
    state.sortStartTime = performance.now();

    if (isSimulating) {
        // --- Simulation Path ---
        // 1. Randomly "seed" all items
        state.items.forEach(item => {
            state.itemSeedValues[item.id] = Math.floor(Math.random() * state.seedTiers.length) + 1;
        });
        // 2. Run the non-interactive sort
        onSeedingComplete(true); // Pass true to indicate simulation
    } else {
        // --- Interactive Path ---
        document.addEventListener('keydown', handleKeyboardSorting);
        startSeeding();
    }
}

export async function handleSimulateSort() {
    if (state.items.length < 2) {
        alert("Please add at least two items to start a simulation.");
        return;
    }

    isSimulating = true;

    // The user needs to pick a mode for the simulation to run with.
    // If they haven't picked one, we default to pairwise (2).
    const modeForSimulation = (state.comparisonMode === 'ask') ? 2 : state.comparisonMode;
    setComparisonMode(modeForSimulation);

    // Show a loading indicator on the button
    const originalText = dom.simulateSortBtn.textContent;
    dom.simulateSortBtn.textContent = "Simulating...";
    dom.simulateSortBtn.disabled = true;

    // Use a short timeout to allow the UI to update before the sync-heavy sort starts
    setTimeout(() => {
        try {
            _startSortInternal();
        } catch (error) {
            console.error("Simulation failed:", error);
            alert("An error occurred during the simulation.");
        } finally {
            // Reset button state and flag
            dom.simulateSortBtn.textContent = originalText;
            dom.simulateSortBtn.disabled = false;
            isSimulating = false;
        }
    }, 10);
}