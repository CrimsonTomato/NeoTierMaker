import * as dom from '../dom.js';
import {
    state,
    updateTierLabel,
    setEditingTierIdForColor,
    editingTierIdForColor,
    updateTierColor,
    handleSizeIncrease,
    handleSizeDecrease,
    addTier,
    randomizeTierAssignments,
} from '../state.js';
import { showView } from '../view.js';
import {
    renderClassicTierList,
    handleClassicTierAction,
    switchToClassicMode,
    getSidebarState,
} from '../classicTierListController.js';
import { renderResultsView } from '../resultsController.js';
import { exportElementAsImage, copyElementAsImage } from '../export.js';

export function initializeClassicTierListEvents() {
    const restoreSidebar = () => {
        if (!getSidebarState()) {
            dom.appContainer.classList.remove('right-sidebar-collapsed');
        }
    };

    // The logic in showView() now correctly preserves the origin state,
    // so we can just call switchToClassicMode without an argument.
    dom.btnClassicMode.addEventListener('click', () => switchToClassicMode());
    dom.iconClassicMode.addEventListener('click', () => switchToClassicMode());

    dom.btnClassicBackToStaging.addEventListener('click', () => {
        restoreSidebar();
        showView(dom.viewInput);
    });

    dom.btnClassicBackToResults.addEventListener('click', () => {
        if (
            confirm(
                'Are you sure? Any changes made in Classic Mode will be discarded.',
            )
        ) {
            restoreSidebar();
            renderResultsView(); // Re-render results from original state
            showView(dom.viewResults);
        }
    });

    dom.btnClassicRandomize.addEventListener('click', () => {
        if (
            confirm(
                'Are you sure you want to randomly assign all items to new tiers?',
            )
        ) {
            randomizeTierAssignments();
            renderClassicTierList();
        }
    });

    dom.btnClassicCopyImage.addEventListener('click', async () => {
        const originalText = dom.btnClassicCopyImage.textContent;
        dom.btnClassicCopyImage.textContent = 'Copying...';
        dom.btnClassicCopyImage.disabled = true;

        try {
            const success = await copyElementAsImage(
                dom.classicExportArea,
                false,
            );
            if (success) {
                dom.btnClassicCopyImage.textContent = 'Copied!';
                setTimeout(
                    () => (dom.btnClassicCopyImage.textContent = originalText),
                    2000,
                );
            } else {
                dom.btnClassicCopyImage.textContent = originalText;
            }
        } catch (error) {
            console.error('Classic view copy failed:', error);
            alert('Could not copy the tier list.');
            dom.btnClassicCopyImage.textContent = originalText;
        } finally {
            dom.btnClassicCopyImage.disabled = false;
        }
    });

    dom.btnClassicExportImage.addEventListener('click', async () => {
        const originalText = dom.btnClassicExportImage.textContent;
        dom.btnClassicExportImage.textContent = 'Generating...';
        dom.btnClassicExportImage.disabled = true;

        try {
            await exportElementAsImage(
                dom.classicExportArea,
                'classic-tier-list.png',
                false,
            );
        } catch (error) {
            console.error('Classic view export failed:', error);
            alert('Could not export the tier list.');
        } finally {
            dom.btnClassicExportImage.textContent = originalText;
            dom.btnClassicExportImage.disabled = false;
        }
    });

    dom.classicTierListGrid.addEventListener('click', e => {
        const tierLabel = e.target.closest('.tier-label');
        if (tierLabel && !tierLabel.querySelector('textarea')) {
            setEditingTierIdForColor(tierLabel.dataset.tierId);
            dom.tierColorInput.click();
        }

        const actionBtn = e.target.closest('.tier-action-btn');
        if (actionBtn) {
            const tierId = actionBtn.closest('.tier-row').dataset.tierId;
            const action = actionBtn.dataset.action;
            handleClassicTierAction(tierId, action);
        }
    });

    dom.classicTiersSizeIncreaseBtn.addEventListener(
        'click',
        handleSizeIncrease,
    );
    dom.classicTiersSizeDecreaseBtn.addEventListener(
        'click',
        handleSizeDecrease,
    );

    dom.tierColorInput.addEventListener('input', e => {
        if (
            editingTierIdForColor &&
            dom.viewClassic.classList.contains('active')
        ) {
            updateTierColor(editingTierIdForColor, e.target.value);
            renderClassicTierList();
        }
    });

    dom.classicTierListGrid.addEventListener('contextmenu', e => {
        e.preventDefault();
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
            renderClassicTierList();
        };

        editInput.addEventListener('blur', saveChanges);
        editInput.addEventListener('keydown', evt => {
            if (evt.key === 'Enter' && !evt.shiftKey) {
                evt.preventDefault();
                saveChanges();
            } else if (evt.key === 'Escape') {
                renderClassicTierList();
            }
        });

        tierLabel.innerHTML = '';
        tierLabel.appendChild(editInput);
        editInput.focus();
        editInput.select();
    });
}
