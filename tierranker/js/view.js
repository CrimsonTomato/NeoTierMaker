/**
 * Shows a specific view element and hides all others.
 * @param {HTMLElement} viewElement The view element to make active.
 */
export function showView(viewElement) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    viewElement.classList.add('active');
}