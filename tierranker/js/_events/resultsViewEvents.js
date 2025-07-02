import * as dom from '../dom.js';
import {
    state,
    updateTierLabel,
    updateTitle,
    toggleTierEditMode,
    discardSortResults,
} from '../state.js';
import { showView } from '../view.js';
import {
    renderResultsView,
    handleTierTagClick,
    handleRankedListClick,
    handleAddTier,
    handleRemoveLastTier,
    updateTierColor,
    setEditingTierIdForColor,
    editingTierIdForColor,
} from '../resultsController.js';

export function initializeResultsViewEvents() {
    // --- Results View Events ---
    dom.tierTagContainer.addEventListener('click', e => {
        const tierId = e.target.closest('.tier-tag')?.dataset.tierId;
        handleTierTagClick(tierId);
    });

    dom.rankedListWrapper.addEventListener('click', handleRankedListClick);
    dom.btnAddTier.addEventListener('click', handleAddTier);
    dom.btnRemoveTier.addEventListener('click', handleRemoveLastTier);

    dom.btnToggleTierEdit.addEventListener('click', () => {
        toggleTierEditMode();
        renderResultsView();
    });

    dom.btnBackToStaging.addEventListener('click', () => {
        if (
            confirm(
                'Are you sure? This will discard the current sort results and return you to the staging list.',
            )
        ) {
            discardSortResults();
            showView(dom.viewInput);
        }
    });

    dom.btnRestart.addEventListener('click', () => {
        if (
            confirm(
                'Are you sure you want to start over? This will clear all items and reset the page.',
            )
        ) {
            window.location.reload();
        }
    });

    // Tier Color Picker
    dom.tierListGridEl.addEventListener('click', e => {
        const tierLabel = e.target.closest('.tier-label');
        if (!tierLabel || tierLabel.querySelector('textarea')) return; // Avoid re-triggering if already editing
        setEditingTierIdForColor(tierLabel.dataset.tierId);
        dom.tierColorInput.click();
    });

    dom.tierColorInput.addEventListener('input', e => {
        if (editingTierIdForColor) {
            updateTierColor(editingTierIdForColor, e.target.value);
        }
    });

    // Tier Label Editing (Context Menu)
    dom.tierListGridEl.addEventListener('contextmenu', e => {
        e.preventDefault(); // Prevent default context menu
        const tierLabel = e.target.closest('.tier-label');
        if (!tierLabel || tierLabel.querySelector('textarea')) return;

        const tierId = tierLabel.dataset.tierId;
        const originalText = state.tiers.find(t => t.id === tierId).label;
        const editInput = document.createElement('textarea');
        editInput.className = 'tier-label-edit';
        editInput.value = originalText;

        const saveChanges = () => {
            const newLabel = editInput.value.trim();
            if (newLabel) updateTierLabel(tierId, newLabel);
            renderResultsView();
        };

        editInput.addEventListener('blur', saveChanges);
        editInput.addEventListener('keydown', evt => {
            if (evt.key === 'Enter' && !evt.shiftKey) {
                evt.preventDefault();
                saveChanges();
            } else if (evt.key === 'Escape') {
                renderResultsView(); // Cancel changes
            }
        });

        tierLabel.innerHTML = ''; // Clear label and append input
        tierLabel.appendChild(editInput);
        editInput.focus();
        editInput.select();
    });

    // Results List Title Editing
    dom.resultsListTitle.addEventListener('click', () => {
        if (dom.resultsListTitle.querySelector('input')) return; // Avoid re-triggering if already editing

        const originalTitle = state.title;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'title-edit-input';
        input.value = originalTitle;

        const saveChanges = () => {
            const newTitle = input.value.trim();
            updateTitle(newTitle || 'Tier List'); // Default to "Tier List" if empty
            renderResultsView();
        };

        input.addEventListener('blur', saveChanges);
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveChanges();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                renderResultsView(); // Cancel changes
            }
        });

        dom.resultsListTitle.innerHTML = ''; // Clear title and append input
        dom.resultsListTitle.appendChild(input);
        input.focus();
        input.select();
    });
}
