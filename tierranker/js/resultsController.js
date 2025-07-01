import * as dom from './dom.js';
import { state, updateTierThreshold, addTier, removeLastTier, toggleTierEditMode } from './state.js';
import { showView } from './view.js';
import { isColorDark } from './color.js';
import { renderRankHistoryChart } from './historyChart.js';

let selectedTierToAssign = null;
export let editingTierIdForColor = null;

export function setEditingTierIdForColor(id) {
    editingTierIdForColor = id;
}

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
    if (numTiers > 0) state.tiers[state.tiers.length - 1].threshold = 0;
}

export function assignItemsToTiers() {
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

export function updateTierColor(tierId, newHexColor) {
    const tier = state.tiers.find(t => t.id === tierId);
    if (!tier) return;
    const r = parseInt(newHexColor.slice(1, 3), 16);
    const g = parseInt(newHexColor.slice(3, 5), 16);
    const b = parseInt(newHexColor.slice(5, 7), 16);
    const textColor = isColorDark([r, g, b]) ? '#FFFFFF' : '#000000';

    tier.color = newHexColor;
    tier.textColor = textColor;

    renderResultsView();
    // Also re-render the chart to update its line colors if it's visible
    const drawer = document.getElementById('rank-history-drawer');
    if (drawer.classList.contains('visible')) {
        renderRankHistoryChart();
    }
}


export function renderResultsView() {
    dom.resultsListTitle.textContent = state.title;

    const { comparisons, time } = state.sortStats;
    if (comparisons > 0) {
        const timeInSeconds = (time / 1000).toFixed(2);
        dom.sortStatsContainer.innerHTML = `Sort completed in <b>${timeInSeconds} seconds</b> with <b>${comparisons} comparisons</b>.`;
    } else {
        dom.sortStatsContainer.innerHTML = '';
    }

    // --- NEW: Manage Edit Mode state ---
    dom.btnToggleTierEdit.classList.toggle('active', state.tierEditMode);
    document.body.classList.toggle('tier-edit-mode', state.tierEditMode);


    dom.tierTagContainer.innerHTML = '';
    state.tiers.forEach(tier => {
        const tagEl = document.createElement('div');
        tagEl.className = 'tier-tag';
        tagEl.innerText = tier.label;
        tagEl.style.backgroundColor = tier.color;
        tagEl.style.color = tier.textColor;
        tagEl.dataset.tierId = tier.id;
        if (tier.id === selectedTierToAssign) tagEl.classList.add('selected');
        dom.tierTagContainer.appendChild(tagEl);
    });

    dom.rankedListWrapper.innerHTML = '';
    const renderQueue = [
        ...state.items.map(i => ({ ...i, type: 'item' })),
        ...state.tiers.map(t => ({ type: 'tier', score: t.threshold, tier: t, id: t.id }))
    ];
    renderQueue.sort((a, b) => (a.score !== b.score) ? b.score - a.score : (a.type === 'item' ? -1 : 1));

    let lastItemScore = 101;
    renderQueue.forEach((entity, index) => {
        if (entity.type === 'item') {
            const itemEl = document.createElement('div');
            itemEl.className = 'ranked-item';
            const itemTier = state.tiers.find(t => t.id === entity.tierId);
            if (itemTier) {
                const rgb = itemTier.color.match(/\w\w/g).map(hex => parseInt(hex, 16));
                itemEl.style.backgroundColor = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.1)`;

                const gradientStyle = ` 
                    background-image: linear-gradient(to right, ${itemTier.textColor} ${entity.score}%, var(--text-primary) ${entity.score}%);
                    -webkit-background-clip: text;
                    background-clip: text;
                `;

                itemEl.innerHTML = `
                    <img class="ranked-item-img" src="${entity.image || 'https://via.placeholder.com/30'}" alt="${entity.text}">
                    <div class="ranked-item-info">
                        <div class="bar-container">
                            <div class="ranked-item-bar" style="background-color: ${itemTier.color}; width: ${entity.score || 0}%" title="${entity.text}"></div>
                            <span class="bar-label-gradient" style="${gradientStyle}" data-solid-color-for-export="${itemTier.textColor}">${entity.text}</span>
                        </div>
                        <div class="ranked-item-score">${(entity.score || 0).toFixed(1)}%</div>
                    </div>
                `;
                dom.rankedListWrapper.appendChild(itemEl);
            }
            lastItemScore = entity.score;

            // --- Render editable boundaries between items ---
            if (state.tierEditMode) {
                const nextItemIndex = renderQueue.findIndex((nextEntity, nextIndex) => nextIndex > index && nextEntity.type === 'item');
                if (nextItemIndex !== -1) {
                    const nextItem = renderQueue[nextItemIndex];
                    const boundaryScore = (entity.score + nextItem.score) / 2;

                    const editableBoundaryEl = document.createElement('div');
                    editableBoundaryEl.className = 'tier-boundary-editable';
                    editableBoundaryEl.dataset.editableThreshold = boundaryScore;

                    const lineEl = document.createElement('div');
                    lineEl.className = 'tier-boundary-line-editable';

                    editableBoundaryEl.appendChild(lineEl);
                    dom.rankedListWrapper.appendChild(editableBoundaryEl);
                }
            }

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
            dom.rankedListWrapper.appendChild(boundaryEl);
        }
    });

    dom.tierListGridEl.innerHTML = '';
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
        itemsEl.innerHTML = tier.itemIds
            .map(id => state.items.find(i => i.id === id))
            .map(item => `<img class="tier-item" src="${item.image || 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='}" alt="${item.text}" title="${item.text}">`)
            .join('');

        tierRowEl.append(labelEl, itemsEl);
        dom.tierListGridEl.appendChild(tierRowEl);
    });
}

export function onSortDone(sortedItems) {
    const endTime = performance.now();
    state.isSorting = false;
    state.items = sortedItems;

    state.sortStats.comparisons = state.progress.current;
    state.sortStats.time = endTime - state.sortStartTime;

    calculateScores();
    setInitialTierThresholds();
    assignItemsToTiers();
    showView(dom.viewResults);
    renderResultsView();

    // Show the drawer container if data exists, but don't render the chart yet.
    // The user will trigger the render by clicking the button.
    const drawerEl = document.getElementById('rank-history-drawer');
    if (state.rankHistory && state.rankHistory.length >= 2) {
        drawerEl.style.display = 'flex';
    } else {
        drawerEl.style.display = 'none';
    }
}

export function handleTierTagClick(tierId) {
    if (!tierId) return;
    selectedTierToAssign = (selectedTierToAssign === tierId) ? null : tierId;
    document.body.classList.toggle('assign-mode', !!selectedTierToAssign);
    renderResultsView();
}

export function handleRankedListClick(e) {
    const assignedTag = e.target.closest('.assigned-tag');
    if (assignedTag) {
        handleTierTagClick(assignedTag.dataset.tierId);
        return;
    }

    const editableBoundary = e.target.closest('[data-editable-threshold]');
    if (selectedTierToAssign && editableBoundary) {
        updateTierThreshold(selectedTierToAssign, parseFloat(editableBoundary.dataset.editableThreshold));
        selectedTierToAssign = null;
        document.body.classList.remove('assign-mode');
        assignItemsToTiers();
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
}

export function handleAddTier() {
    addTier();
    assignItemsToTiers();
    renderResultsView();
}

export function handleRemoveLastTier() {
    removeLastTier();
    assignItemsToTiers();
    renderResultsView();
}

const ITEM_SIZE_STEP = 8;
const MIN_ITEM_SIZE = 32;
const MAX_ITEM_SIZE = 128;

function getCurrentItemSize() {
    const currentSizeStr = getComputedStyle(dom.tierListGridEl).getPropertyValue('--tier-item-size');
    return parseInt(currentSizeStr, 10) || 64;
}

function setItemSize(newSize) {
    const clampedSize = Math.max(MIN_ITEM_SIZE, Math.min(newSize, MAX_ITEM_SIZE));
    dom.tierListGridEl.style.setProperty('--tier-item-size', `${clampedSize}px`);
}

export function handleSizeIncrease() {
    setItemSize(getCurrentItemSize() + ITEM_SIZE_STEP);
}

export function handleSizeDecrease() {
    setItemSize(getCurrentItemSize() - ITEM_SIZE_STEP);
}