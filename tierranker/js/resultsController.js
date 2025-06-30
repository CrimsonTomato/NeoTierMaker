import * as dom from './dom.js';
import { state, updateTierThreshold, addTier, removeLastTier } from './state.js';
import { showView } from './view.js';
import { isColorDark } from './color.js';

let selectedTierToAssign = null;
export let editingTierIdForColor = null;

export function setEditingTierIdForColor(id) {
    editingTierIdForColor = id;
}

function calculateScores() {
    const n = state.items.length;
    if (n === 0) return;
    state.items.forEach((item, index) => {
        // The score is based on the final sorted position (0 is best).
        item.score = n > 1 ? 100 - (index * (100 / (n - 1))) : 100;
    });
}

function setInitialTierThresholds() {
    const numTiers = state.tiers.length;
    if (numTiers < 1) return;
    // Ensure tiers are sorted by current threshold before recalculating
    state.tiers.sort((a, b) => b.threshold - a.threshold);
    const step = 100 / numTiers;
    state.tiers.forEach((tier, index) => {
        tier.threshold = 100 - (index + 1) * step;
    });
    // Ensure the last tier goes all the way to 0.
    if (numTiers > 0) state.tiers[state.tiers.length - 1].threshold = 0;
}

export function assignItemsToTiers() {
    state.tiers.sort((a, b) => b.threshold - a.threshold);
    state.tiers.forEach(tier => tier.itemIds = []);
    state.items.forEach(item => {
        // Find the highest-threshold tier this item qualifies for.
        for (const tier of state.tiers) {
            if (item.score >= tier.threshold) {
                item.tierId = tier.id;
                tier.itemIds.push(item.id);
                return; // Assign to the first one found and stop.
            }
        }
    });
}

export function updateTierColor(tierId, newHexColor) {
    const tier = state.tiers.find(t => t.id === tierId);
    if (!tier) return;
    // Calculate contrast color before updating state
    const r = parseInt(newHexColor.slice(1, 3), 16);
    const g = parseInt(newHexColor.slice(3, 5), 16);
    const b = parseInt(newHexColor.slice(5, 7), 16);
    const textColor = isColorDark([r, g, b]) ? '#FFFFFF' : '#000000';
    
    // Update state (This part doesn't exist yet, so we'll add it)
    const tierInState = state.tiers.find(t => t.id === tierId);
    if(tierInState) {
        tierInState.color = newHexColor;
        tierInState.textColor = textColor;
    }

    renderResultsView();
}


export function renderResultsView() {
    dom.resultsListTitle.textContent = state.title;

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
    // Create a combined list of items and tier boundaries to render in order
    const renderQueue = [
        ...state.items.map(i => ({ ...i, type: 'item' })),
        ...state.tiers.map(t => ({ type: 'tier', score: t.threshold, tier: t, id: t.id }))
    ];
    // Sort by score (desc), with items appearing just before boundaries of the same score
    renderQueue.sort((a, b) => (a.score !== b.score) ? b.score - a.score : (a.type === 'item' ? -1 : 1));

    let lastItemScore = 101; // Used for calculating boundary positions
    renderQueue.forEach(entity => {
        if (entity.type === 'item') {
            const itemEl = document.createElement('div');
            itemEl.className = 'ranked-item';
            const itemTier = state.tiers.find(t => t.id === entity.tierId);
            if (itemTier) {
                // Faded background color for the row
                const rgb = itemTier.color.match(/\w\w/g).map(hex => parseInt(hex, 16));
                itemEl.style.backgroundColor = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.1)`;

                // Gradient text for the score bar label
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
                dom.rankedListWrapper.appendChild(itemEl);
            }
            lastItemScore = entity.score;
        } else if (entity.type === 'tier') {
            const boundaryEl = document.createElement('div');
            boundaryEl.className = 'tier-boundary';
            // The boundary's clickable value is halfway between the item above and itself
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

/**
 * The main entry point function for when a sort completes.
 * @param {Array<object>} sortedItems The final, sorted array of items.
 */
export function onSortDone(sortedItems) {
    state.isSorting = false;
    state.items = sortedItems; // The master list is now the sorted list
    calculateScores();
    setInitialTierThresholds();
    assignItemsToTiers();
    showView(dom.viewResults);
    renderResultsView();
}

// --- Direct User Action Handlers ---

export function handleTierTagClick(tierId) {
    if (!tierId) return;
    selectedTierToAssign = (selectedTierToAssign === tierId) ? null : tierId;
    document.body.classList.toggle('assign-mode', !!selectedTierToAssign);
    renderResultsView();
}

export function handleRankedListClick(e) {
    const assignedTag = e.target.closest('.assigned-tag');
    if (assignedTag) {
        const tierId = assignedTag.dataset.tierId;
        handleTierTagClick(tierId);
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