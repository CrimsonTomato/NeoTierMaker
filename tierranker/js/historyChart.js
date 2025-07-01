import * as dom from './dom.js';
import { state } from './state.js';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

let historyChartInstance = null;
const drawerEl = document.getElementById('rank-history-drawer');
const canvasEl = document.getElementById('rank-history-chart');

// --- ADDED: State for the filter ---
let showOnlyTop5 = false;

/**
 * Toggles the "show only top 5" filter and re-renders the chart.
 */
export function toggleHistoryFilter() {
    showOnlyTop5 = !showOnlyTop5;
    renderRankHistoryChart();
}

/**
 * Resets the filter state to its default (showing all).
 */
export function resetHistoryFilter() {
    showOnlyTop5 = false;
}
// --- END ADDED ---

/**
 * Destroys the active chart instance to free up resources.
 */
export function destroyHistoryChart() {
    if (historyChartInstance) {
        historyChartInstance.destroy();
        historyChartInstance = null;
    }
}

/**
 * Renders the rank history chart based on data in the state.
 * This function should only be called when the drawer is visible.
 */
export function renderRankHistoryChart() {
    destroyHistoryChart();

    if (!drawerEl.classList.contains('visible') || !state.rankHistory || state.rankHistory.length < 2) {
        return;
    }

    const LEGEND_DISPLAY_THRESHOLD = 25;
    const showLegend = state.items.length <= LEGEND_DISPLAY_THRESHOLD;

    const top5Colors = [
        '#ef4444', // Rank 1: Red
        '#3b82f6', // Rank 2: Blue
        '#22c55e', // Rank 3: Green
        '#f59e0b', // Rank 4: Amber/Yellow
        '#a855f7'  // Rank 5: Purple
    ];
    const neutralColor = '#888888';

    const top5Items = state.items.slice(0, 5);
    const top5ItemIds = new Set(top5Items.map(item => item.id));

    const itemColorMap = new Map();
    top5Items.forEach((item, index) => {
        itemColorMap.set(item.id, top5Colors[index]);
    });

    const ctx = canvasEl.getContext('2d');
    const labels = state.rankHistory.map(snapshot => snapshot.comparisonCount);

    // --- MODIFICATION: Apply filter before creating datasets ---
    const itemsToDisplay = showOnlyTop5
        ? state.items.filter(item => top5ItemIds.has(item.id))
        : state.items;

    const datasets = itemsToDisplay.map(item => {
        // --- END MODIFICATION ---
        const itemColor = itemColorMap.get(item.id) || neutralColor;
        const data = state.rankHistory.map(snapshot => {
            const rankInfo = snapshot.ranks.find(r => r.id === item.id);
            return rankInfo ? rankInfo.rank : null;
        });

        return {
            label: item.text,
            data: data,
            borderColor: itemColor,
            backgroundColor: itemColor,
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 5,
            fill: false,
            tension: 0.1,
            spanGaps: true,
        };
    });

    historyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: showLegend,
                    position: 'top',
                    labels: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim(),
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                },
            },
            scales: {
                y: {
                    reverse: true,
                    min: 1,
                    title: {
                        display: true,
                        text: 'Rank',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim(),
                    },
                    ticks: {
                        stepSize: 1,
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim(),
                    },
                    grid: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim(),
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Comparison #',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim(),
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim(),
                    },
                    grid: {
                        display: false,
                    }
                }
            }
        }
    });

    // --- ADDED: Update the button's appearance based on the filter state ---
    if (dom.btnToggleHistoryFilter) {
        dom.btnToggleHistoryFilter.classList.toggle('active', showOnlyTop5);
        dom.btnToggleHistoryFilter.textContent = showOnlyTop5 ? 'Show All' : 'Show Top 5 Only';
    }
    // --- END ADDED ---
}