/**
 * Creates and starts a sorter for a list of items.
 * @param {Array<object>} items The array of items to sort.
 * @param {number} mode The comparison mode (2 for pairwise, 3 for tri-wise).
 * @param {function} onCompare The comparison callback. It receives an array of items and a result callback.
 * @param {function} onDone The final callback.
 */
export function createSorter(items, mode, onCompare, onDone) {
    const arrCopy = [...items];

    if (mode === 3) {
        // Use the new, more efficient Ternary Insertion Sort for 3-item comparisons.
        ternaryInsertionSort(arrCopy, onCompare, onDone)
            .catch(err => console.error("Error in Ternary Sort:", err));
    } else {
        // Use the robust Quicksort for standard pairwise comparisons.
        pairwiseQuicksort(arrCopy, onCompare, onDone)
            .catch(err => console.error("Error in Pairwise Sort:", err));
    }
}

// --- ALGORITHM 1: Ternary Insertion Sort (for 3-item comparison) ---

async function ternaryInsertionSort(arr, onCompare, onDone) {
    // Helper to wrap the callback-based onCompare into a promise.
    function compareAsync(itemsToCompare) {
        return new Promise(resolve => onCompare(itemsToCompare, resolve));
    }

    // A recursive ternary search to find the correct insertion index.
    async function findInsertIndex(sortedPart, itemToInsert, low, high) {
        if (high < low) {
            return low;
        }

        // Base case: for small sub-arrays, do a simple pairwise comparison.
        if (high - low < 2) {
            // The result will be an array of the two items, sorted.
            const result = await compareAsync([itemToInsert, sortedPart[low]]);
            // If the item to insert is first in the result, it's higher-ranked.
            // Its correct index is `low`. Otherwise, its index is `low + 1`.
            return result[0].id === itemToInsert.id ? low : low + 1;
        }

        const oneThird = low + Math.floor((high - low) / 3);
        const twoThirds = high - Math.floor((high - low) / 3);

        const pivots = [itemToInsert, sortedPart[oneThird], sortedPart[twoThirds]];
        const result = await compareAsync(pivots);

        if (result[0].id === itemToInsert.id) { // Item belongs in the first third
            return await findInsertIndex(sortedPart, itemToInsert, low, oneThird - 1);
        } else if (result[1].id === itemToInsert.id) { // Item belongs in the middle third
            return await findInsertIndex(sortedPart, itemToInsert, oneThird, twoThirds - 1);
        } else { // Item belongs in the last third
            return await findInsertIndex(sortedPart, itemToInsert, twoThirds, high);
        }
    }

    // Main sort loop
    for (let i = 1; i < arr.length; i++) {
        const itemToInsert = arr[i];
        const sortedPart = arr.slice(0, i);
        const insertIndex = await findInsertIndex(sortedPart, itemToInsert, 0, i - 1);

        // Remove item from its current position and insert it at the correct one.
        arr.splice(i, 1);
        arr.splice(insertIndex, 0, itemToInsert);
    }

    onDone(arr);
}


// --- ALGORITHM 2: Pairwise Quicksort (from previous step) ---

async function pairwiseQuicksort(arr, onCompare, onDone) {
    // Helper to wrap the callback-based onCompare into a promise for async/await.
    function compareAsync(itemA, itemB) {
        return new Promise(resolve => onCompare([itemA, itemB], resolve));
    }

    // Main recursive function for Quicksort
    async function quickSort(arr, low, high) {
        if (low >= high) {
            return; // Base case: the partition has 0 or 1 elements.
        }

        // --- 1. PIVOT SELECTION (Median-of-Three) ---
        // FIX: The Median-of-Three logic is only safe for partitions of 3 or more items.
        // For smaller partitions, we use a simpler (and safe) pivot selection.
        let pivotIndex;
        if (high - low + 1 < 3) {
            pivotIndex = high; // Just use the last element as the pivot.
        } else {
            // This logic is now only run on partitions where low, mid, and high are distinct.
            const mid = low + Math.floor((high - low) / 2);

            const low_vs_mid = await compareAsync(arr[low], arr[mid]);
            const mid_vs_high = await compareAsync(arr[mid], arr[high]);
            const low_vs_high = await compareAsync(arr[low], arr[high]);

            if (low_vs_mid >= 0) {
                if (mid_vs_high >= 0) { pivotIndex = mid; }
                else if (low_vs_high >= 0) { pivotIndex = high; }
                else { pivotIndex = low; }
            } else {
                if (mid_vs_high <= 0) { pivotIndex = mid; }
                else if (low_vs_high >= 0) { pivotIndex = low; }
                else { pivotIndex = high; }
            }
        }

        // Place the chosen pivot at the end of the partition for convenience.
        [arr[pivotIndex], arr[high]] = [arr[high], arr[pivotIndex]];
        const pivot = arr[high];

        // --- 2. PARTITIONING (3-Way Dutch National Flag) ---
        let i = low;
        let lt = low;
        let gt = high - 1;

        while (i <= gt) {
            const comparisonResult = await compareAsync(arr[i], pivot);

            if (comparisonResult > 0) { // arr[i] > pivot
                [arr[i], arr[lt]] = [arr[lt], arr[i]];
                i++;
                lt++;
            } else if (comparisonResult < 0) { // arr[i] < pivot
                [arr[i], arr[gt]] = [arr[gt], arr[i]];
                gt--;
            } else { // arr[i] == pivot
                i++;
            }
        }

        // The pivot was at 'high'; now we move it to its correct spot.
        [arr[high], arr[gt + 1]] = [arr[gt + 1], arr[high]];

        // --- 3. RECURSIVE CALLS ---
        await quickSort(arr, low, lt - 1);
        await quickSort(arr, gt + 2, high);
    }

    // --- Main execution ---
    await quickSort(arr, 0, arr.length - 1);
    onDone(arr);
}