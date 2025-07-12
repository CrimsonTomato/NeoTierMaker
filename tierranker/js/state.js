import { destroyHistoryChart } from './historyChart.js';
import { isColorDark } from './color.js'; // Import for color logic

export const state = {
    items: [],
    title: 'Tier List',
    editingItemId: null,

    // MODIFIED: 'ask' is the new default. Can be 'ask', 2, or 3.
    comparisonMode: 'ask',

    // --- SORTING STATE ---
    isSorting: false,
    comparison: { items: [], callback: null },
    progress: { current: 0, total: 0 },
    sortStartTime: 0,
    sortStats: { comparisons: 0, time: 0 },
    rankHistory: [],

    // --- UNDO/SKIP STATE ---
    decisionLog: [],
    skippedComparisons: [],
    isResolvingSkips: false,

    // --- SEEDING STATE ---
    isSeeding: false,
    seedingProgress: { current: 0, total: 0 },
    seedTiers: [
        { label: 'Top Tier', value: 5, color: '#ff7f7f' },
        { label: 'High Tier', value: 4, color: '#ffbf7f' },
        { label: 'Mid Tier', value: 3, color: '#ffff7f' },
        { label: 'Low Tier', value: 2, color: '#7fff7f' },
        { label: 'Bottom Tier', value: 1, color: '#7fbfff' },
    ],
    itemSeedValues: {},

    // --- TIER LIST STATE ---
    tierEditMode: false,
    tiers: [
        {
            id: crypto.randomUUID(),
            label: 'S',
            color: '#ff7f7f',
            textColor: '#000000',
            threshold: 90,
            itemIds: [],
        },
        {
            id: crypto.randomUUID(),
            label: 'A',
            color: '#ffbf7f',
            textColor: '#000000',
            threshold: 75,
            itemIds: [],
        },
        {
            id: crypto.randomUUID(),
            label: 'B',
            color: '#ffff7f',
            textColor: '#000000',
            threshold: 60,
            itemIds: [],
        },
        {
            id: crypto.randomUUID(),
            label: 'C',
            color: '#7fff7f',
            textColor: '#000000',
            threshold: 45,
            itemIds: [],
        },
        {
            id: crypto.randomUUID(),
            label: 'D',
            color: '#7fbfff',
            textColor: '#000000',
            threshold: 0,
            itemIds: [],
        },
    ],
    unrankedItemIds: [],
    unrankedPoolVisible: true, // NEW: controls visibility of the unranked pool in classic mode
};

export let editingTierIdForColor = null;
export function setEditingTierIdForColor(id) {
    editingTierIdForColor = id;
}

export function abortSort() {
    state.isSorting = false;
    state.isSeeding = false;
    state.comparison = { items: [], callback: null };
    state.progress = { current: 0, total: 0 };
    state.seedingProgress = { current: 0, total: 0 };
    state.itemSeedValues = {};
    state.sortStats = { comparisons: 0, time: 0 };
    state.sortStartTime = 0;
    // --- Clear undo/skip/history state ---
    state.decisionLog = [];
    state.skippedComparisons = [];
    state.isResolvingSkips = false;
    state.rankHistory = [];
    destroyHistoryChart();
}

export function toggleTierEditMode() {
    state.tierEditMode = !state.tierEditMode;
}

export function addItem(item) {
    state.items.push(item);
}

export function clearItems() {
    state.items = [];
}

export function removeItem(id) {
    // Remove from main items list
    state.items = state.items.filter(item => item.id !== id);

    // Also remove from unranked pool if present
    state.unrankedItemIds = state.unrankedItemIds.filter(
        itemId => itemId !== id,
    );

    // And remove from any tiers if present (though this should be handled by classic mode drag/drop or results view assignment)
    state.tiers.forEach(tier => {
        tier.itemIds = tier.itemIds.filter(itemId => itemId !== id);
    });
}

export function updateItemText(id, newText) {
    const item = state.items.find(item => item.id === id);
    if (item) {
        item.text = newText;
    }
}

export function setEditingItemId(id) {
    state.editingItemId = id;
}

export function updateTitle(newTitle) {
    state.title = newTitle;
}

export function addTier(newTier) {
    state.tiers.push(newTier);
    state.tiers.sort((a, b) => b.threshold - a.threshold);
}
export function updateTierLabel(tierId, newLabel) {
    const tier = state.tiers.find(t => t.id === tierId);
    if (tier) tier.label = newLabel;
}

export function moveItemInClassicView(
    itemId,
    fromId,
    toId,
    oldIndex, // Kept for potential future use, but logic will use itemId
    newIndex,
) {
    let sourceList;
    if (fromId === 'unranked') {
        sourceList = state.unrankedItemIds;
    } else {
        const sourceTier = state.tiers.find(t => t.id === fromId);
        if (sourceTier) sourceList = sourceTier.itemIds;
    }

    let targetList;
    if (toId === 'unranked') {
        targetList = state.unrankedItemIds;
    } else {
        const targetTier = state.tiers.find(t => t.id === toId);
        if (targetTier) {
            if (!targetTier.itemIds) targetTier.itemIds = [];
            targetList = targetTier.itemIds;
        }
    }

    if (sourceList && targetList) {
        // --- FIX: Make the removal more robust ---
        // 1. Find the item's actual index in the source list using its ID.
        // This is more reliable than relying on evt.oldIndex which can be tricky.
        const itemIndexInSource = sourceList.indexOf(itemId);

        if (itemIndexInSource > -1) {
            // 2. Remove from source using the found index.
            const [movedItem] = sourceList.splice(itemIndexInSource, 1);

            // 3. Add to target at the new index provided by SortableJS.
            if (movedItem) {
                targetList.splice(newIndex, 0, movedItem);
            }
        } else {
            console.warn(
                `Item with ID ${itemId} not found in source list ${fromId}`,
            );
        }
    }
}

export function deleteTierAndReassignItems(tierId) {
    const tierIndex = state.tiers.findIndex(t => t.id === tierId);
    if (tierIndex > -1) {
        const [deletedTier] = state.tiers.splice(tierIndex, 1);
        if (deletedTier.itemIds && deletedTier.itemIds.length > 0) {
            if (!state.unrankedItemIds) state.unrankedItemIds = [];
            state.unrankedItemIds.push(...deletedTier.itemIds);
        }
    }
}

export function randomizeTierAssignments() {
    if (state.items.length === 0) return;
    if (state.tiers.length === 0) return;

    // 1. Collect all item IDs into one array
    let allItemIds = state.items.map(item => item.id);

    // 2. Shuffle the array (Fisher-Yates shuffle)
    for (let i = allItemIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allItemIds[i], allItemIds[j]] = [allItemIds[j], allItemIds[i]];
    }

    // 3. Clear all existing assignments
    state.unrankedItemIds = [];
    state.tiers.forEach(tier => {
        tier.itemIds = [];
    });

    // 4. Distribute the shuffled items randomly among the tiers
    allItemIds.forEach(itemId => {
        const randomTierIndex = Math.floor(Math.random() * state.tiers.length);
        state.tiers[randomTierIndex].itemIds.push(itemId);
    });
}

export function unrankAllItems() {
    // NEW FUNCTION
    if (!state.unrankedItemIds) state.unrankedItemIds = [];

    // Collect all item IDs from all tiers
    const itemIdsToUnrank = [];
    state.tiers.forEach(tier => {
        if (tier.itemIds && tier.itemIds.length > 0) {
            itemIdsToUnrank.push(...tier.itemIds);
            tier.itemIds = []; // Clear items from the tier
        }
    });

    // Add them to the unranked pool, avoiding duplicates in case of prior state issues
    itemIdsToUnrank.forEach(itemId => {
        if (!state.unrankedItemIds.includes(itemId)) {
            state.unrankedItemIds.push(itemId);
        }
    });
}

export function toggleUnrankedPoolVisibility() {
    // NEW
    state.unrankedPoolVisible = !state.unrankedPoolVisible;
}

export function updateTierThreshold(tierId, newThreshold) {
    const tier = state.tiers.find(t => t.id === tierId);
    if (tier) {
        tier.threshold = Math.max(0, Math.min(100, newThreshold));
        state.tiers.sort((a, b) => b.threshold - a.threshold);
    }
}

export function updateTierColor(tierId, newHexColor) {
    const tier = state.tiers.find(t => t.id === tierId);
    if (!tier) return;

    const r = parseInt(newHexColor.slice(1, 3), 16);
    const g = parseInt(newHexColor.slice(3, 5), 16);
    const b = parseInt(newHexColor.slice(5, 7), 16);

    tier.color = newHexColor;
    tier.textColor = isColorDark([r, g, b]) ? '#FFFFFF' : '#000000';
}

export function setItemSeedValue(itemId, seedValue) {
    state.itemSeedValues[itemId] = seedValue;
}

export function setComparisonMode(mode) {
    // The value from the radio button is a string "2", "3", or "ask".
    // We handle the numeric conversion if needed, otherwise store 'ask'.
    if (mode === 'ask') {
        state.comparisonMode = 'ask';
    } else {
        state.comparisonMode = parseInt(mode, 10);
    }
}

/**
 * Discards all sorting results (scores, stats, tier assignments)
 * but keeps the core item list and tier definitions.
 */
export function discardSortResults() {
    // Reset all the in-progress and completed sort state.
    abortSort();

    // Clear scores and tier assignments from individual items.
    state.items.forEach(item => {
        delete item.score;
        delete item.tierId;
    });

    // Clear the list of items within each tier.
    state.tiers.forEach(tier => {
        tier.itemIds = [];
    });

    // Reset comparison mode to 'ask' so the modal shows again
    // when the user starts a new sort.
    state.comparisonMode = 'ask';
}

const ITEM_SIZE_STEP = 8;
const MIN_ITEM_SIZE = 32;
const MAX_ITEM_SIZE = 128;

function getCurrentItemSize() {
    const currentSizeStr = getComputedStyle(
        document.documentElement,
    ).getPropertyValue('--tier-item-size');
    return parseInt(currentSizeStr, 10) || 64;
}

function setItemSize(newSize) {
    const clampedSize = Math.max(
        MIN_ITEM_SIZE,
        Math.min(newSize, MAX_ITEM_SIZE),
    );
    document.documentElement.style.setProperty(
        '--tier-item-size',
        `${clampedSize}px`,
    );
}

export function handleSizeIncrease() {
    setItemSize(getCurrentItemSize() + ITEM_SIZE_STEP);
}

export function handleSizeDecrease() {
    setItemSize(getCurrentItemSize() - ITEM_SIZE_STEP);
}
