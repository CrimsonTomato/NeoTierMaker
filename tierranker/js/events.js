// Import event initialization functions from separate files
import { initializeThemeSidebarEvents } from './_events/themeSidebarEvents.js';
import { initializeInputStagingEvents } from './_events/inputStagingEvents.js';
import { initializeSortFlowEvents } from './_events/sortFlowEvents.js';
import { initializeResultsViewEvents } from './_events/resultsViewEvents.js';
import { initializeExportSessionEvents } from './_events/exportSessionEvents.js';
import { initializeHistoryChartEvents } from './historyChart.js';

export function initializeEventListeners() {
    // Call each initializer to set up event listeners for its respective section
    initializeThemeSidebarEvents();
    initializeInputStagingEvents();
    initializeSortFlowEvents();
    initializeResultsViewEvents();
    initializeExportSessionEvents();
    initializeHistoryChartEvents();
}
