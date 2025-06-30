export const state = {
    items: [],
    title: 'Tier List', // The title for the generated results view
    editingItemId: null,
    
    // --- NEW SORTING STATE ---
    isSorting: false,
    comparison: {
        a: null, // Item A
        b: null, // Item B
        callback: null, // The function to call with the result
    },
    progress: {
        current: 0,
        total: 0,
    },

    // --- NEW TIER LIST STATE ---
    tiers: [
        { id: crypto.randomUUID(), label: 'S', color: '#ff7f7f', textColor: '#000000', threshold: 90 },
        { id: crypto.randomUUID(), label: 'A', color: '#ffbf7f', textColor: '#000000', threshold: 75 },
        { id: crypto.randomUUID(), label: 'B', color: '#ffff7f', textColor: '#000000', threshold: 60 },
        { id: crypto.randomUUID(), label: 'C', color: '#7fff7f', textColor: '#000000', threshold: 45 },
        { id: crypto.randomUUID(), label: 'D', color: '#7fbfff', textColor: '#000000', threshold: 0 },
    ],
    // This will hold items not yet placed in a tier
    unrankedItemIds: [],
};

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
    const item = state.items.find(item => item.id === id); // FIX: Was item.id === item.id
    if (item) {
        item.text = newText;
    }
}

export function setEditingItemId(id) {
    state.editingItemId = id;
}

// --- TIER & TITLE FUNCTIONS ---
export function updateTitle(newTitle) {
    state.title = newTitle;
}

export function addTier() {
    // Add a new tier just above the last one
    const lastThreshold = state.tiers.length > 0 ? state.tiers[state.tiers.length - 1].threshold : 0;
    const newThreshold = Math.max(0, lastThreshold - 15);
    state.tiers.push({ id: crypto.randomUUID(), label: 'New', color: '#cccccc', textColor: '#000000', threshold: newThreshold });
    // Re-sort tiers by threshold after adding
    state.tiers.sort((a, b) => b.threshold - a.threshold);
}
export function updateTierLabel(tierId, newLabel) {
    const tier = state.tiers.find(t => t.id === tierId);
    if (tier) tier.label = newLabel;
}
export function moveItemToTier(itemId, targetTierId, sourceId) {
    // Remove from old location
    if (sourceId === 'unranked') {
        state.unrankedItemIds = state.unrankedItemIds.filter(id => id !== itemId);
    } else {
        const sourceTier = state.tiers.find(t => t.id === sourceId);
        if (sourceTier) {
            sourceTier.itemIds = sourceTier.itemIds.filter(id => id !== itemId);
        }
    }
    // Add to new location
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
        // Re-sort tiers by threshold after update to maintain order
        state.tiers.sort((a, b) => b.threshold - a.threshold);
    }
}