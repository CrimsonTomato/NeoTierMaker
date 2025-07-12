import * as dom from './dom.js';
import {
    state,
    moveItemInClassicView,
    addTier,
    deleteTierAndReassignItems,
    updateTierColor,
    setEditingTierIdForColor,
    updateTierLabel,
    handleSizeIncrease,
    handleSizeDecrease,
} from './state.js';
import { showView } from './view.js';
import Sortable from 'sortablejs';

let rightSidebarWasCollapsed = false;
let classicModeOrigin = null; // 'sidebar' or 'results'
let classicSortables = []; // To hold SortableJS instances for cleanup

/**
 * Manages the transition into Classic Mode.
 * @param {'sidebar' | 'results'} origin - Where the user is coming from.
 */
export function switchToClassicMode(origin) {
    // If the origin is not explicitly set by the click, use the last known origin.
    // This handles the case where the user clicks the sidebar button while on the results page.
    classicModeOrigin = origin || classicModeOrigin;

    rightSidebarWasCollapsed = dom.appContainer.classList.contains(
        'right-sidebar-collapsed',
    );
    dom.appContainer.classList.add('right-sidebar-collapsed');

    prepareAndShowClassicView();
    showView(dom.viewClassic);
}

/**
 * Sets or resets the origin tracker.
 * @param {'results' | null} origin
 */
export function setClassicModeOrigin(origin) {
    classicModeOrigin = origin;
}

export function getSidebarState() {
    return rightSidebarWasCollapsed;
}

export function prepareAndShowClassicView() {
    // Ensure unranked items are correctly identified.
    const rankedItemIds = new Set();
    state.tiers.forEach(tier => {
        (tier.itemIds || []).forEach(id => rankedItemIds.add(id));
    });
    state.unrankedItemIds = state.items
        .map(item => item.id)
        .filter(id => !rankedItemIds.has(id));

    // Toggle button visibility based on where the user came from
    dom.btnClassicBackToStaging.style.display =
        classicModeOrigin !== 'results' ? 'flex' : 'none';
    dom.btnClassicBackToResults.style.display =
        classicModeOrigin === 'results' ? 'flex' : 'none';

    // Set unranked pool visibility based on state
    dom.classicUnrankedPoolContainer.style.display = state.unrankedPoolVisible
        ? 'flex'
        : 'none';
    dom.btnClassicToggleUnranked.textContent = state.unrankedPoolVisible
        ? 'Hide Unranked Pool'
        : 'Show Unranked Pool';

    renderClassicTierList();
}

/**
 * Destroys any existing Sortable instances to prevent conflicts on re-render.
 */
function destroySortables() {
    if (classicSortables.length) {
        classicSortables.forEach(s => s.destroy());
        classicSortables = [];
    }
}

function initializeSortables() {
    const tierItemEls = document.querySelectorAll(
        '#classic-tier-list-grid .tier-items',
    );
    const unrankedPoolEl = dom.classicUnrankedPool;

    const sortableOptions = {
        group: 'tier-list-items',
        animation: 0, // Set to 0 to disable animation on drop
        ghostClass: 'ghost-placeholder', // Use a new class for the placeholder
        dragClass: 'sortable-drag',
        forceFallback: true, // Use a clone for dragging for better performance
        fallbackClass: 'sortable-fallback', // Class for the cloned element
        fallbackOnBody: true, // Append clone to body to avoid clipping issues
        onEnd: evt => {
            const itemId = evt.item.dataset.itemId;
            const fromId = evt.from.dataset.tierId || 'unranked';
            const toId = evt.to.dataset.tierId || 'unranked';
            const { oldIndex, newIndex } = evt;

            moveItemInClassicView(itemId, fromId, toId, oldIndex, newIndex);
        },
    };

    tierItemEls.forEach(el =>
        classicSortables.push(new Sortable(el, sortableOptions)),
    );
    // Only initialize Sortable for the unranked pool if it's visible
    if (state.unrankedPoolVisible) {
        // MODIFIED
        classicSortables.push(new Sortable(unrankedPoolEl, sortableOptions));
    }
}

export function renderClassicTierList() {
    // --- FIX: Destroy old instances before clearing and re-rendering the DOM ---
    destroySortables();

    dom.classicTierListGrid.innerHTML = '';
    state.tiers.sort((a, b) => b.threshold - a.threshold); // Ensure tiers are sorted

    // --- PERFORMANCE: Create a map for quick O(1) item lookups ---
    const itemMap = new Map(state.items.map(item => [item.id, item]));

    state.tiers.forEach(tier => {
        const tierRowEl = document.createElement('div');
        tierRowEl.className = 'tier-row';
        tierRowEl.dataset.tierId = tier.id;

        const labelEl = document.createElement('div');
        labelEl.className = 'tier-label';
        labelEl.style.backgroundColor = tier.color;
        labelEl.style.color = tier.textColor;
        labelEl.title = 'Left-click to change color, Right-click to rename';
        labelEl.innerText = tier.label;
        labelEl.dataset.tierId = tier.id;

        const itemsEl = document.createElement('div');
        itemsEl.className = 'tier-items';
        itemsEl.dataset.tierId = tier.id;
        itemsEl.innerHTML = (tier.itemIds || [])
            .map(id => itemMap.get(id)) // OPTIMIZED: Use map instead of find()
            .filter(Boolean) // Filter out any undefined items
            .map(item => {
                if (item.image) {
                    return `<img class="tier-item" data-item-id="${item.id}" src="${item.image}" alt="${item.text}" title="${item.text}" draggable="false">`;
                } else {
                    const color = item.color || {
                        background: '#eee',
                        text: '#111',
                    };
                    return `<div class="tier-item text-only-item" data-item-id="${item.id}" title="${item.text}" style="background-color: ${color.background}; color: ${color.text};"><span>${item.text}</span></div>`;
                }
            })
            .join('');

        const tierActionsEl = document.createElement('div');
        tierActionsEl.className = 'tier-row-actions';
        tierActionsEl.innerHTML = `
            <button class="tier-action-btn" data-action="add-above" title="Add Tier Above">+</button>
            <button class="tier-action-btn" data-action="delete" title="Delete Tier">×</button>
        `;

        tierRowEl.append(labelEl, itemsEl, tierActionsEl);
        dom.classicTierListGrid.appendChild(tierRowEl);
    });

    dom.classicUnrankedPool.innerHTML = '';
    dom.classicUnrankedPool.dataset.tierId = 'unranked';

    (state.unrankedItemIds || []).forEach(id => {
        const item = itemMap.get(id); // OPTIMIZED: Use map instead of find()
        if (item) {
            let itemEl;
            if (item.image) {
                itemEl = document.createElement('img');
                itemEl.src = item.image;
                itemEl.alt = item.text;
                itemEl.draggable = false; // Prevent native browser image drag
            } else {
                itemEl = document.createElement('div');
                itemEl.classList.add('text-only-item');
                const color = item.color || {
                    background: '#eee',
                    text: '#111',
                };
                itemEl.style.backgroundColor = color.background;
                itemEl.style.color = color.text;
                itemEl.innerHTML = `<span>${item.text}</span>`;
            }
            itemEl.classList.add('tier-item');
            itemEl.dataset.itemId = item.id;
            itemEl.title = item.text;
            dom.classicUnrankedPool.appendChild(itemEl);
        }
    });

    initializeSortables();
}

export function handleClassicTierAction(tierId, action) {
    if (action === 'add-above') {
        const targetTier = state.tiers.find(t => t.id === tierId);
        if (targetTier) {
            const newThreshold = targetTier.threshold + 1;
            addTier({
                id: crypto.randomUUID(),
                label: 'New Tier',
                color: '#cccccc',
                textColor: '#000000',
                threshold: newThreshold,
                itemIds: [],
            });
            renderClassicTierList();
        }
    } else if (action === 'delete') {
        if (state.tiers.length <= 1) {
            alert("You can't delete the last tier.");
            return;
        }
        if (
            confirm(
                'Are you sure you want to delete this tier? Its items will become unranked.',
            )
        ) {
            deleteTierAndReassignItems(tierId);
            renderClassicTierList();
        }
    }
}
