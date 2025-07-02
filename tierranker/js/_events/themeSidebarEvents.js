import * as dom from '../dom.js';
import { renderRankHistoryChart } from '../historyChart.js';

export function initializeThemeSidebarEvents() {
    // --- Theme and Sidebar Toggles ---
    const toggleTheme = () => {
        document.body.classList.add('no-transitions');
        const isDarkMode =
            document.documentElement.classList.toggle('dark-mode');
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');

        const drawer = document.getElementById('rank-history-drawer');
        if (drawer.classList.contains('visible')) {
            renderRankHistoryChart(); // Re-render chart for theme change
        }

        setTimeout(() => {
            document.body.classList.remove('no-transitions');
        }, 100);
    };
    dom.themeToggleButton.addEventListener('click', toggleTheme);
    dom.iconThemeButton.addEventListener('click', toggleTheme);

    dom.toggleLeftSidebarButton.addEventListener('click', () => {
        dom.appContainer.classList.toggle('left-sidebar-collapsed');
    });

    dom.toggleRightSidebarButton.addEventListener('click', () => {
        dom.appContainer.classList.toggle('right-sidebar-collapsed');
    });

    // --- Sidebar Resizer Logic ---
    const MIN_SIDEBAR_WIDTH = 240;
    const MAX_SIDEBAR_WIDTH = 600;

    dom.sidebarResizer.addEventListener('mousedown', e => {
        e.preventDefault();
        if (dom.appContainer.classList.contains('right-sidebar-collapsed')) {
            return;
        }

        document.body.classList.add('is-resizing');

        const handleMouseMove = moveEvent => {
            let newWidth = window.innerWidth - moveEvent.clientX;

            if (newWidth < MIN_SIDEBAR_WIDTH) newWidth = MIN_SIDEBAR_WIDTH;
            if (newWidth > MAX_SIDEBAR_WIDTH) newWidth = MAX_SIDEBAR_WIDTH;

            document.documentElement.style.setProperty(
                '--sidebar-right-width-wide',
                `${newWidth}px`,
            );
        };

        const handleMouseUp = () => {
            document.body.classList.remove('is-resizing');
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    });

    // --- Icon-only button listeners ---
    dom.iconExportButton.addEventListener('click', () =>
        dom.btnExportSession.click(),
    );
    dom.iconImportButton.addEventListener('click', () =>
        dom.btnImportSession.click(),
    );

    // Sync logic to handle three states for comparison mode radios (main and icon versions)
    // Note: The actual state update (setComparisonMode) is in sortController.js.
    // This section only handles syncing the two UI elements.
    dom.comparisonModeRadios.forEach(radio => {
        radio.addEventListener('change', e => {
            const value = e.target.value;
            let iconId;
            if (value === '2') iconId = 'mode-pairwise-icon';
            else if (value === '3') iconId = 'mode-triwise-icon';
            else iconId = 'mode-ask-icon';
            const iconRadio = document.getElementById(iconId);
            if (iconRadio) iconRadio.checked = true;
        });
    });

    dom.comparisonModeIconRadios.forEach(radio => {
        radio.addEventListener('change', e => {
            const value = e.target.value;
            let mainId;
            if (value === '2') mainId = 'mode-pairwise';
            else if (value === '3') mainId = 'mode-triwise';
            else mainId = 'mode-ask';
            const mainRadio = document.getElementById(mainId);
            if (mainRadio) mainRadio.checked = true;
        });
    });
}
