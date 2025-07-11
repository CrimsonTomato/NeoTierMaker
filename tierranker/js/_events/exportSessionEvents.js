import * as dom from '../dom.js';
import { state, handleSizeIncrease, handleSizeDecrease } from '../state.js';
import { exportElementAsImage, copyElementAsImage } from '../export.js';
import { exportSessionToFile, importSessionFromFile } from '../fileSession.js';
import { renderStagingList } from '../ui.js';
import { renderResultsView } from '../resultsController.js';
import { prepareAndShowClassicView } from '../classicTierListController.js';
import { showView } from '../view.js';

export function initializeExportSessionEvents() {
    // --- Export and Session Events ---
    // These buttons are physically located in the export section, but their logic
    // pertains to controlling item display size in the results view.
    dom.btnSizeIncrease.addEventListener('click', handleSizeIncrease);
    dom.btnSizeDecrease.addEventListener('click', handleSizeDecrease);

    dom.btnExportImage.addEventListener('click', async () => {
        const originalElement = document.getElementById(
            'tier-list-export-area',
        );
        const originalText = dom.btnExportImage.textContent;
        dom.btnExportImage.textContent = 'Generating...';
        dom.btnExportImage.disabled = true;

        try {
            await exportElementAsImage(
                originalElement,
                'my-tier-list.png',
                false,
            );
        } catch (error) {
            console.error('Tier list export failed:', error);
            alert('Could not export the tier list.');
        } finally {
            dom.btnExportImage.textContent = originalText;
            dom.btnExportImage.disabled = false;
        }
    });

    dom.btnCopyImage.addEventListener('click', async () => {
        const originalElement = document.getElementById(
            'tier-list-export-area',
        );
        const originalText = dom.btnCopyImage.textContent;
        dom.btnCopyImage.textContent = 'Copying...';
        dom.btnCopyImage.disabled = true;

        try {
            const success = await copyElementAsImage(originalElement, false);
            if (success) {
                dom.btnCopyImage.textContent = 'Copied!';
                setTimeout(
                    () => (dom.btnCopyImage.textContent = originalText),
                    2000,
                );
            } else {
                dom.btnCopyImage.textContent = originalText;
            }
        } catch (error) {
            console.error('Tier list copy failed:', error);
            alert('Could not copy the tier list.');
            dom.btnCopyImage.textContent = originalText;
        } finally {
            dom.btnCopyImage.disabled = false;
        }
    });

    dom.btnExportBarChart.addEventListener('click', async () => {
        const originalElement = dom.rankedListContainer;
        const originalText = dom.btnExportBarChart.textContent;
        dom.btnExportBarChart.textContent = 'Generating...';
        dom.btnExportBarChart.disabled = true;

        try {
            await exportElementAsImage(
                originalElement,
                'my-ranked-list.png',
                true,
            );
        } catch (error) {
            console.error('Bar chart export failed:', error);
            alert('Could not export the bar chart.');
        } finally {
            dom.btnExportBarChart.textContent = originalText;
            dom.btnExportBarChart.disabled = false;
        }
    });

    dom.btnCopyBarChart.addEventListener('click', async () => {
        const originalElement = dom.rankedListContainer;
        const originalText = dom.btnCopyBarChart.textContent;
        dom.btnCopyBarChart.textContent = 'Copying...';
        dom.btnCopyBarChart.disabled = true;

        try {
            const success = await copyElementAsImage(originalElement, true);
            if (success) {
                dom.btnCopyBarChart.textContent = 'Copied!';
                setTimeout(
                    () => (dom.btnCopyBarChart.textContent = originalText),
                    2000,
                );
            } else {
                dom.btnCopyBarChart.textContent = originalText;
            }
        } catch (error) {
            console.error('Bar chart copy failed:', error);
            alert('Could not copy the bar chart.');
            dom.btnCopyBarChart.textContent = originalText;
        } finally {
            dom.btnCopyBarChart.disabled = false;
        }
    });

    dom.btnExportSession.addEventListener('click', async () => {
        if (state.items.length === 0) {
            alert('There is nothing to export.');
            return;
        }
        const originalText = dom.btnExportSession.textContent;
        dom.btnExportSession.textContent = 'Exporting...';
        dom.btnExportSession.disabled = true;
        try {
            await exportSessionToFile();
        } catch (error) {
            console.error('Export failed:', error);
            alert('An error occurred during export.');
        } finally {
            dom.btnExportSession.textContent = originalText;
            dom.btnExportSession.disabled = false;
        }
    });

    dom.btnImportSession.addEventListener('click', () =>
        dom.sessionFileInput.click(),
    );

    dom.sessionFileInput.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        if (
            !confirm(
                'Importing a session file will overwrite your current progress. Are you sure?',
            )
        ) {
            e.target.value = null;
            return;
        }
        try {
            const loadedState = await importSessionFromFile(file);
            // Overwrite the live state with the loaded state.
            Object.assign(state, loadedState);

            // Reset any transient UI state that shouldn't persist.
            state.editingItemId = null;
            state.tierEditMode = false;
            state.isSorting = false;
            state.isSeeding = false;
            state.comparison = { items: [], callback: null };

            renderStagingList();
            alert('Session imported successfully!');

            // Decide which view to show.
            if (
                state.items.length > 0 &&
                state.items.every(item => item.score !== undefined)
            ) {
                showView(dom.viewResults);
                renderResultsView();
            } else if (state.items.length > 0) {
                // If there are items, default to the classic view to let the user arrange them.
                prepareAndShowClassicView();
                showView(dom.viewClassic);
            } else {
                showView(dom.viewInput);
            }
        } catch (error) {
            console.error('Failed to import session:', error);
            alert(`Error importing session: ${error.message}`);
        } finally {
            e.target.value = null;
        }
    });
}
