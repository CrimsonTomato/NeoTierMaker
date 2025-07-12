import { initializeThemeSidebarEvents } from './_events/themeSidebarEvents.js';
import { initializeInputStagingEvents } from './_events/inputStagingEvents.js';
import { initializeSortFlowEvents } from './_events/sortFlowEvents.js';
import { initializeResultsViewEvents } from './_events/resultsViewEvents.js';
import { initializeExportSessionEvents } from './_events/exportSessionEvents.js';
import { initializeHistoryChartEvents } from './historyChart.js';
import { initializeClassicTierListEvents } from './_events/classicTierListEvents.js';

export function initializeEventListeners() {
    initializeThemeSidebarEvents();
    initializeInputStagingEvents();
    initializeSortFlowEvents();
    initializeResultsViewEvents();
    initializeExportSessionEvents();
    initializeHistoryChartEvents();
    initializeClassicTierListEvents();
}
