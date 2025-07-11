import { hidePreview } from './ui.js';
import * as dom from './dom.js';
import { setClassicModeOrigin } from './classicTierListController.js';

/**
 * Shows a specific view element and hides all others.
 * @param {HTMLElement} viewElement The view element to make active.
 */
export function showView(viewElement) {
    hidePreview();

    if (viewElement === dom.viewResults) {
        setClassicModeOrigin('results');
    }
    else if (viewElement !== dom.viewClassic) {
        setClassicModeOrigin(null);
    }

    document
        .querySelectorAll('.view')
        .forEach(v => v.classList.remove('active'));
    viewElement.classList.add('active');
}
