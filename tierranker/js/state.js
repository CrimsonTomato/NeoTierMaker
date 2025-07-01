export const state = {
    items: [],
    title: 'Tier List',
    editingItemId: null,

    comparisonMode: 2,

    // --- SORTING STATE ---
    isSorting: false,
    comparison: { items: [], callback: null },
    progress: { current: 0, total: 0 },
    sortStartTime: 0,
    sortStats: { comparisons: 0, time: 0 },

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
        { id: crypto.randomUUID(), label: 'S', color: '#ff7f7f', textColor: '#000000', threshold: 90 },
        { id: crypto.randomUUID(), label: 'A', color: '#ffbf7f', textColor: '#000000', threshold: 75 },
        { id: crypto.randomUUID(), label: 'B', color: '#ffff7f', textColor: '#000000', threshold: 60 },
        { id: crypto.randomUUID(), label: 'C', color: '#7fff7f', textColor: '#000000', threshold: 45 },
        { id: crypto.randomUUID(), label: 'D', color: '#7fbfff', textColor: '#000000', threshold: 0 },
    ],
    unrankedItemIds: [],
};

export function abortSort() {
    state.isSorting = false;
    state.isSeeding = false;
    state.comparison = { items: [], callback: null };
    state.progress = { current: 0, total: 0 };
    state.seedingProgress = { current: 0, total: 0 };
    state.itemSeedValues = {};
    state.sortStats = { comparisons: 0, time: 0 };
    state.sortStartTime = 0;
    // --- Clear undo/skip state ---
    state.decisionLog = [];
    state.skippedComparisons = [];
    state.isResolvingSkips = false;
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
    state.items = state.items.filter(item => item.id !== id);
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

export function addTier() {
    const lastThreshold = state.tiers.length > 0 ? state.tiers[state.tiers.length - 1].threshold : 0;
    const newThreshold = Math.max(0, lastThreshold - 15);
    state.tiers.push({ id: crypto.randomUUID(), label: 'New', color: '#cccccc', textColor: '#000000', threshold: newThreshold });
    state.tiers.sort((a, b) => b.threshold - a.threshold);
}
export function updateTierLabel(tierId, newLabel) {
    const tier = state.tiers.find(t => t.id === tierId);
    if (tier) tier.label = newLabel;
}
export function moveItemToTier(itemId, targetTierId, sourceId) {
    if (sourceId === 'unranked') {
        state.unrankedItemIds = state.unrankedItemIds.filter(id => id !== itemId);
    } else {
        const sourceTier = state.tiers.find(t => t.id === sourceId);
        if (sourceTier) {
            sourceTier.itemIds = sourceTier.itemIds.filter(id => id !== itemId);
        }
    }
    const targetTier = state.tiers.find(t => t.id === targetTierId);
    if (targetTier) {
        targetTier.itemIds.push(itemId);
    }
}
export function removeLastTier() {
    if (state.tiers.length > 1) {
        state.tiers.pop();
    }
}
export function updateTierThreshold(tierId, newThreshold) {
    const tier = state.tiers.find(t => t.id === tierId);
    if (tier) {
        tier.threshold = Math.max(0, Math.min(100, newThreshold));
        state.tiers.sort((a, b) => b.threshold - a.threshold);
    }
}

export function setItemSeedValue(itemId, seedValue) {
    state.itemSeedValues[itemId] = seedValue;
}

export function setComparisonMode(mode) {
    state.comparisonMode = parseInt(mode, 10);
}