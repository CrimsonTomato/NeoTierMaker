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
} from '../resultsController.js';
import { switchToClassicMode } from '../classicTierListController.js';

export function initializeResultsViewEvents() {
    // --- Results View Events ---
    dom.tierTagContainer.addEventListener('click', e => {
        const tierId = e.target.closest('.tier-tag')?.dataset.tierId;
        handleTierTagClick(tierId);
    });

    dom.rankedListWrapper.addEventListener('click', handleRankedListClick);

    dom.btnToggleTierEdit.addEventListener('click', () => {
        toggleTierEditMode();
        renderResultsView();
    });

    dom.btnEditInClassic.addEventListener('click', () => {
        if (
            confirm(
                'This will take you to the classic editor. Any changes you make can be discarded if you return to this results screen.',
            )
        ) {
            switchToClassicMode();
        }
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
