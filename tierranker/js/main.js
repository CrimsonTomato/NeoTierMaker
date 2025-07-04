import '../style.css';
import { initializeEventListeners } from './events.js';
import { renderStagingList } from './ui.js';
import 'chart.js/auto'; // Import Chart.js

// --- INITIALIZATION ---

// Perform the initial render of the staging list on page load.
renderStagingList();

// Set up all user interactions for the entire application.
initializeEventListeners();