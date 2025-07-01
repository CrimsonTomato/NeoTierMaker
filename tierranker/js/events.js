import * as dom from './dom.js';
import { state, clearItems, removeItem, setEditingItemId, updateItemText, updateTierLabel, updateTitle, setComparisonMode, abortSort, toggleTierEditMode } from './state.js';
import { handleTextInput, handleFileInput } from './inputController.js';
import { renderStagingList, showPreview, hidePreview, setDragging } from './ui.js';
import { startSort, handleSeedButtonClick, cleanupSortListeners } from './sortController.js';
import { renderResultsView, handleTierTagClick, handleRankedListClick, handleAddTier, handleRemoveLastTier, updateTierColor, setEditingTierIdForColor, editingTierIdForColor, handleSizeIncrease, handleSizeDecrease } from './resultsController.js';
import { exportElementAsImage, copyElementAsImage } from './export.js';
import { exportSessionToFile, importSessionFromFile } from './fileSession.js';
import { showView } from './view.js';
import Sortable from 'sortablejs';

export function initializeEventListeners() {
    // --- Input View Events ---
    dom.addFromTextBtn.addEventListener('click', async () => {
        await handleTextInput(dom.textInputArea.value);
        dom.textInputArea.value = "";
    });

    dom.clearStagingBtn.addEventListener('click', () => {
        if (state.items.length > 0 && confirm("Are you sure you want to clear all items?")) {
            clearItems();
            renderStagingList();
        }
    });

    dom.uploadImagesBtn.addEventListener('click', () => dom.imageInput.click());
    dom.imageInput.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            await handleFileInput(e.target.files);
        }
        e.target.value = null;
    });

    dom.imageDropZone.addEventListener('dragenter', (e) => { e.preventDefault(); dom.imageDropZone.classList.add('drag-over'); });
    dom.imageDropZone.addEventListener('dragover', (e) => { e.preventDefault(); dom.imageDropZone.classList.add('drag-over'); });
    dom.imageDropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dom.imageDropZone.classList.remove('drag-over'); });
    dom.imageDropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dom.imageDropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            await handleFileInput(e.dataTransfer.files);
        }
    });

    dom.startSortBtn.addEventListener('click', startSort);

    // --- Staging List Events ---
    dom.stagingListEl.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (!action) return;
        const itemId = e.target.closest('.staging-item')?.dataset.id;
        if (!itemId) return;

        if (action === 'delete') {
            if (confirm(`Are you sure you want to delete "${state.items.find(i => i.id === itemId).text}"?`)) {
                removeItem(itemId);
                renderStagingList();
            }
        } else if (action === 'edit') {
            setEditingItemId(itemId);
            renderStagingList();
        } else if (action === 'save') {
            const inputEl = e.target.closest('.staging-item').querySelector('.staging-item-edit-input');
            updateItemText(itemId, inputEl.value.trim());
            setEditingItemId(null);
            renderStagingList();
        } else if (action === 'cancel') {
            setEditingItemId(null);
            renderStagingList();
        }
    });

    dom.stagingListEl.addEventListener('dragstart', () => setDragging(true));
    dom.stagingListEl.addEventListener('dragend', () => setDragging(false));
    dom.stagingListEl.addEventListener('mouseover', (e) => showPreview(e, '.staging-item-thumbnail-wrapper'));
    dom.stagingListEl.addEventListener('mouseout', () => hidePreview());

    new Sortable(dom.stagingListEl, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        onEnd: function (evt) {
            const { oldIndex, newIndex } = evt;
            const itemsCopy = [...state.items];
            const [draggedItem] = itemsCopy.splice(oldIndex, 1);
            itemsCopy.splice(newIndex, 0, draggedItem);
            state.items = itemsCopy;
        },
    });

    // --- Staging View Toggles ---
    dom.viewListBtn.addEventListener('click', () => {
        dom.stagingListEl.classList.remove('view-grid');
        dom.stagingListEl.classList.add('view-list');
        dom.viewListBtn.classList.add('active');
        dom.viewGridBtn.classList.remove('active');
        renderStagingList();
    });

    dom.viewGridBtn.addEventListener('click', () => {
        dom.stagingListEl.classList.remove('view-list');
        dom.stagingListEl.classList.add('view-grid');
        dom.viewGridBtn.classList.add('active');
        dom.viewListBtn.classList.remove('active');
        renderStagingList();
    });

    // --- Sorting, Seeding, and Abort Events ---
    const handleAbort = () => {
        if (confirm("Are you sure you want to abort the sort and return to the item list?")) {
            abortSort();
            cleanupSortListeners();
            showView(dom.viewInput);
        }
    };
    dom.btnAbortSeeding.addEventListener('click', handleAbort);
    dom.btnAbortComparison.addEventListener('click', handleAbort);

    dom.comparisonModeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => setComparisonMode(e.target.value));
    });

    dom.seedTierButtonsEl.addEventListener('click', (e) => {
        const value = e.target.closest('[data-value]')?.dataset.value;
        handleSeedButtonClick(value);
    });

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

    // --- Results View Events ---
    dom.tierTagContainer.addEventListener('click', (e) => {
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

    dom.btnRestart.addEventListener('click', () => {
        if (confirm("Are you sure you want to start over? This will clear all items and reset the page.")) {
            window.location.reload();
        }
    });

    dom.tierListGridEl.addEventListener('click', (e) => {
        const tierLabel = e.target.closest('.tier-label');
        if (!tierLabel || tierLabel.querySelector('textarea')) return;
        setEditingTierIdForColor(tierLabel.dataset.tierId);
        dom.tierColorInput.click();
    });

    dom.tierListGridEl.addEventListener('contextmenu', (e) => {
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
            renderResultsView();
        };

        editInput.addEventListener('blur', saveChanges);
        editInput.addEventListener('keydown', (evt) => {
            if (evt.key === 'Enter' && !evt.shiftKey) { evt.preventDefault(); saveChanges(); }
            else if (evt.key === 'Escape') { renderResultsView(); }
        });

        tierLabel.innerHTML = '';
        tierLabel.appendChild(editInput);
        editInput.focus();
        editInput.select();
    });

    dom.tierColorInput.addEventListener('input', (e) => {
        if (editingTierIdForColor) {
            updateTierColor(editingTierIdForColor, e.target.value);
        }
    });

    dom.resultsListTitle.addEventListener('click', () => {
        if (dom.resultsListTitle.querySelector('input')) return;

        const originalTitle = state.title;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'title-edit-input';
        input.value = originalTitle;

        const saveChanges = () => {
            const newTitle = input.value.trim();
            updateTitle(newTitle || "Tier List");
            renderResultsView();
        };

        input.addEventListener('blur', saveChanges);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); saveChanges(); }
            else if (e.key === 'Escape') { e.preventDefault(); renderResultsView(); }
        });

        dom.resultsListTitle.innerHTML = '';
        dom.resultsListTitle.appendChild(input);
        input.focus();
        input.select();
    });

    // --- Export and Session Events ---
    dom.btnSizeIncrease.addEventListener('click', handleSizeIncrease);
    dom.btnSizeDecrease.addEventListener('click', handleSizeDecrease);

    // --- Off-screen Wrapper Creation Logic (Updated) ---
    const createOffscreenCloneForCapture = (originalElement, isBarChart = false) => {
        const exportWrapper = document.createElement('div');
        const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-secondary').trim();
        exportWrapper.style.position = 'absolute';
        exportWrapper.style.left = '-9999px';
        exportWrapper.style.top = '-9999px';
        exportWrapper.style.width = `${originalElement.offsetWidth}px`;
        exportWrapper.style.padding = getComputedStyle(originalElement).padding;
        exportWrapper.style.backgroundColor = bgColor;

        if (!isBarChart) {
            exportWrapper.style.display = 'flex';
            exportWrapper.style.flexDirection = 'column';
            exportWrapper.style.height = 'fit-content';
        }

        const clone = originalElement.cloneNode(true);

        // --- NEW: Remove only specific UI elements from the clone ---
        if (isBarChart) {
            // For the bar chart, remove its action buttons and tier editing palette
            clone.querySelector('.results-column-header .results-column-actions')?.remove();
            clone.querySelector('.tier-tag-palette')?.remove();

            // Also fix the gradient text for the screenshot
            const gradientLabelsInClone = clone.querySelectorAll('.bar-label-gradient');
            gradientLabelsInClone.forEach(label => {
                const solidColor = label.dataset.solidColorForExport;
                if (solidColor) {
                    label.style.backgroundImage = 'none';
                    label.style.webkitBackgroundClip = 'initial';
                    label.style.backgroundClip = 'initial';
                    label.style.color = solidColor;
                }
            });
        } else {
            // For the tier list, just remove its action buttons
            clone.querySelector('.results-column-header .results-column-actions')?.remove();
        }

        exportWrapper.appendChild(clone);
        document.body.appendChild(exportWrapper);
        return exportWrapper;
    };

    // --- Tier List Export/Copy ---
    dom.btnExportImage.addEventListener('click', async () => {
        const originalElement = document.getElementById('tier-list-export-area');
        const originalText = dom.btnExportImage.textContent;
        dom.btnExportImage.textContent = 'Generating...';
        dom.btnExportImage.disabled = true;

        const exportWrapper = createOffscreenCloneForCapture(originalElement, false);

        try {
            await exportElementAsImage(exportWrapper, 'my-tier-list.png', {
                scrollX: 0,
                scrollY: 0,
                backgroundColor: exportWrapper.style.backgroundColor,
            });
        } catch (error) {
            console.error("Tier list export failed:", error);
            alert("Could not export the tier list.");
        } finally {
            document.body.removeChild(exportWrapper);
            dom.btnExportImage.textContent = originalText;
            dom.btnExportImage.disabled = false;
        }
    });

    dom.btnCopyImage.addEventListener('click', async () => {
        const originalElement = document.getElementById('tier-list-export-area');
        const originalText = dom.btnCopyImage.textContent;
        dom.btnCopyImage.textContent = 'Copying...';
        dom.btnCopyImage.disabled = true;

        const exportWrapper = createOffscreenCloneForCapture(originalElement, false);

        try {
            const success = await copyElementAsImage(exportWrapper, {
                scrollX: 0,
                scrollY: 0,
                backgroundColor: exportWrapper.style.backgroundColor,
            });
            if (success) {
                dom.btnCopyImage.textContent = 'Copied!';
                setTimeout(() => dom.btnCopyImage.textContent = originalText, 2000);
            } else {
                dom.btnCopyImage.textContent = originalText;
            }
        } catch (error) {
            console.error("Tier list copy failed:", error);
            alert("Could not copy the tier list.");
            dom.btnCopyImage.textContent = originalText;
        } finally {
            document.body.removeChild(exportWrapper);
            dom.btnCopyImage.disabled = false;
        }
    });

    // --- Bar Chart Export/Copy ---
    dom.btnExportBarChart.addEventListener('click', async () => {
        const originalElement = dom.rankedListContainer;
        const originalText = dom.btnExportBarChart.textContent;
        dom.btnExportBarChart.textContent = 'Generating...';
        dom.btnExportBarChart.disabled = true;

        const exportWrapper = createOffscreenCloneForCapture(originalElement, true);

        try {
            await exportElementAsImage(exportWrapper, 'my-ranked-list.png', {
                scrollX: 0,
                scrollY: 0,
                backgroundColor: exportWrapper.style.backgroundColor,
            });
        } catch (error) {
            console.error("Bar chart export failed:", error);
            alert("Could not export the bar chart.");
        } finally {
            document.body.removeChild(exportWrapper);
            dom.btnExportBarChart.textContent = originalText;
            dom.btnExportBarChart.disabled = false;
        }
    });

    dom.btnCopyBarChart.addEventListener('click', async () => {
        const originalElement = dom.rankedListContainer;
        const originalText = dom.btnCopyBarChart.textContent;
        dom.btnCopyBarChart.textContent = 'Copying...';
        dom.btnCopyBarChart.disabled = true;

        const exportWrapper = createOffscreenCloneForCapture(originalElement, true);

        try {
            const success = await copyElementAsImage(exportWrapper, {
                scrollX: 0,
                scrollY: 0,
                backgroundColor: exportWrapper.style.backgroundColor,
            });
            if (success) {
                dom.btnCopyBarChart.textContent = 'Copied!';
                setTimeout(() => dom.btnCopyBarChart.textContent = originalText, 2000);
            } else {
                dom.btnCopyBarChart.textContent = originalText;
            }
        } catch (error) {
            console.error("Bar chart copy failed:", error);
            alert("Could not copy the bar chart.");
            dom.btnCopyBarChart.textContent = originalText;
        } finally {
            document.body.removeChild(exportWrapper);
            dom.btnCopyBarChart.disabled = false;
        }
    });

    // --- Session Management ---
    dom.btnExportSession.addEventListener('click', async () => {
        if (state.items.length === 0) { alert("There is nothing to export."); return; }
        const originalText = dom.btnExportSession.textContent;
        dom.btnExportSession.textContent = "Exporting...";
        dom.btnExportSession.disabled = true;
        try {
            await exportSessionToFile();
        } catch (error) {
            console.error("Export failed:", error);
            alert("An error occurred during export.");
        } finally {
            dom.btnExportSession.textContent = originalText;
            dom.btnExportSession.disabled = false;
        }
    });

    dom.btnImportSession.addEventListener('click', () => dom.sessionFileInput.click());

    dom.sessionFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!confirm("Importing a session file will overwrite your current progress. Are you sure?")) {
            e.target.value = null; return;
        }
        try {
            const loadedState = await importSessionFromFile(file);
            Object.assign(state, {
                items: loadedState.items || [],
                tiers: loadedState.tiers || [],
                title: loadedState.title || 'Tier List',
                editingItemId: null,
                isSorting: false,
            });
            alert("Session imported successfully!");
            if (state.items.length > 0 && state.items.some(item => item.score !== undefined)) {
                showView(dom.viewResults);
                renderResultsView();
            } else {
                showView(dom.viewInput);
                renderStagingList();
            }
        } catch (error) {
            console.error("Failed to import session:", error);
            alert(`Error importing session: ${error.message}`);
        } finally {
            e.target.value = null;
        }
    });
}