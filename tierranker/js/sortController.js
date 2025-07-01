import * as dom from './dom.js';
import { state } from './state.js';
import { showView } from './view.js';
import { createSorter } from './sorter.js';
import { onSortDone } from './resultsController.js';
import { hidePreview, showPreview } from './ui.js';
import Sortable from 'sortablejs';

let currentlySeedingItem = null;
const comparisonCache = new Map();

function handleKeyboardSorting(e) {
    if (!state.isSorting || state.comparisonMode !== 2 || !state.comparison.callback) {
        return;
    }
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
            total += Math.ceil(n * Math.log2(n));
        }
        return total;
    }, 0);
    state.progress = { current: 0, total: totalComparisons };

    state.isSorting = true;
    showView(dom.viewComparison);

    const generateKey = (id1, id2) => [id1, id2].sort().join('-');

    for (const seedValue of seedValues) {
        const group = itemGroups[seedValue];
        if (group.length > 1) {
            const sortedGroup = await new Promise((resolve) => {
                createSorter(
                    group,
                    state.comparisonMode,
                    (itemsToCompare, onResult) => {
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

                        const onResultWithCache = (result) => {
                            if (itemsToCompare.length === 2) {
                                const [itemA, itemB] = itemsToCompare;
                                const key = generateKey(itemA.id, itemB.id);
                                let resultToCache = result;
                                if (itemA.id > itemB.id) resultToCache = -result;
                                comparisonCache.set(key, resultToCache);
                            }
                            onResult(result);
                        };

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

    cleanupSortListeners();
    onSortDone(sortedGroups);
}

function updateComparisonView() {
    const { items, callback } = state.comparison;
    if (!items || items.length === 0) return;

    if (state.comparisonMode === 3) { // Tri-wise Mode
        dom.triLayoutControls.style.display = 'flex';
        const ranks = ['1st', '2nd', '3rd'];
        dom.comparisonTitleEl.textContent = `Drag to rank the items (1st is best), then confirm.`;

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

        if (dom.btnTriLayoutHorizontal.classList.contains('active')) {
            rankingListEl.classList.add('layout-horizontal');
        }

        new Sortable(rankingListEl, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            onEnd: () => {
                const rankLabels = rankingListEl.querySelectorAll('.triwise-rank-label');
                rankLabels.forEach((label, index) => {
                    label.textContent = ranks[index];
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
        dom.comparisonAreaEl.onclick = null;

    } else { // Pairwise Mode
        dom.triLayoutControls.style.display = 'none';
        dom.comparisonTitleEl.textContent = "Which do you rank higher?";
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
    state.sortStartTime = performance.now();

    document.addEventListener('keydown', handleKeyboardSorting);
    startSeeding();
}