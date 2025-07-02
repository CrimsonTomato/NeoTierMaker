import * as dom from '../dom.js';
import { state, abortSort, setComparisonMode } from '../state.js';
import { showView } from '../view.js';
import {
    cleanupSortListeners,
    handleUndoComparison,
    handleSkipComparison,
    handleSkipSeeding,
    handleSeedButtonClick,
} from '../sortController.js';
import { hidePreview, showPreview } from '../ui.js'; // For comparison cards preview

export function initializeSortFlowEvents() {
    // --- Sorting, Seeding, and Abort Events ---
    const handleAbort = () => {
        if (
            confirm(
                'Are you sure you want to abort the sort and return to the item list?',
            )
        ) {
            abortSort();
            cleanupSortListeners(); // Ensure keyboard listeners are removed
            showView(dom.viewInput);
        }
    };
    dom.btnAbortSeeding.addEventListener('click', handleAbort);
    dom.btnAbortComparison.addEventListener('click', handleAbort);

    dom.btnSkipSeeding.addEventListener('click', handleSkipSeeding);
    dom.btnUndoComparison.addEventListener('click', handleUndoComparison);
    dom.btnSkipComparison.addEventListener('click', handleSkipComparison);

    dom.seedTierButtonsEl.addEventListener('click', e => {
        const value = e.target.closest('[data-value]')?.dataset.value;
        handleSeedButtonClick(value);
    });

    // This section is dynamically rendered by sortController.updateComparisonView()
    // but the global handlers for the tri-wise layout buttons live here.
    // --- Tri-wise Layout Controls ---
    dom.btnTriLayoutVertical.addEventListener('click', () => {
        const list = document.getElementById('triwise-ranking-list');
        if (list) {
            list.classList.remove('layout-horizontal');
            dom.btnTriLayoutVertical.classList.add('active');
            dom.btnTriLayoutHorizontal.classList.remove('active');
        }
    });
    dom.btnTriLayoutHorizontal.addEventListener('click', () => {
        const list = document.getElementById('triwise-ranking-list');
        if (list) {
            list.classList.add('layout-horizontal');
            dom.btnTriLayoutHorizontal.classList.add('active');
            dom.btnTriLayoutVertical.classList.remove('active');
        }
    });

    // Comparison Mode Modal Logic (part of sort initiation flow)
    // The actual setComparisonMode is handled by sortController.startSort.
    // This just sets up the listeners for the modal buttons.
    dom.modalBtnPairwise.addEventListener('click', () => setComparisonMode(2));
    dom.modalBtnTriwise.addEventListener('click', () => setComparisonMode(3));

    // The comparison area itself might have SortableJS or mouseover for previews,
    // which are dynamic and handled by `updateComparisonView` in `sortController.js`.
    // However, the `mouseover` and `mouseout` events for the pairwise cards are global
    // and can be attached here, as they target the static `comparisonAreaEl`.
    dom.comparisonAreaEl.addEventListener('mouseover', e =>
        showPreview(e, '.card-image-container'),
    );
    dom.comparisonAreaEl.addEventListener('mouseout', () => hidePreview());
}
