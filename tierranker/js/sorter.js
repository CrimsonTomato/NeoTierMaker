/**
 * Creates and starts a sorter for a list of items.
 * @param {Array<object>} items The array of items to sort.
 * @param {number} mode The comparison mode (2 for pairwise, 3 for tri-wise).
 * @param {function} onCompare The comparison callback. It receives an array of items and a result callback.
 * @param {function} onDone The final callback.
 * @param {function} [onProgress] Optional callback for intermediate progress.
 * @param {object} [progressContext] Optional context object to pass to the onProgress callback.
 */
export function createSorter(items, mode, onCompare, onDone, onProgress, progressContext) {
    const arrCopy = [...items];

    if (mode === 3) {
        // Use the new, more efficient Ternary Insertion Sort for 3-item comparisons.
        ternaryInsertionSort(arrCopy, onCompare, onDone, onProgress, progressContext)
            .catch(err => console.error("Error in Ternary Sort:", err));
    } else {
        // Use Merge Sort for pairwise comparisons.
        pairwiseMergeSort(arrCopy, onCompare, onDone, onProgress, progressContext)
            .catch(err => console.error("Error in Pairwise Sort:", err));
    }
}

// --- ALGORITHM 1: Ternary Insertion Sort (for 3-item comparison) ---

async function ternaryInsertionSort(arr, onCompare, onDone, onProgress, progressContext) {
    // Cache for tri-wise comparison results
    const ternaryComparisonCache = new Map();

    // Helper to wrap the callback-based onCompare into a promise.
    function compareAsync(itemsToCompare) {
        if (itemsToCompare.length === 3) {
            // Generate a cache key from sorted item IDs
            const key = itemsToCompare.map(item => item.id).sort().join('-');
            if (ternaryComparisonCache.has(key)) {
                // Return cached result, ensuring it matches the input order
                const cachedResult = ternaryComparisonCache.get(key);
                // Reorder cached result to match the input itemsToCompare order
                const idToItem = new Map(itemsToCompare.map(item => [item.id, item]));
                const reorderedResult = cachedResult.map(cachedItem => idToItem.get(cachedItem.id));
                return Promise.resolve(reorderedResult);
            }
            // Perform comparison and cache the result
            return new Promise(resolve => {
                onCompare(itemsToCompare, result => {
                    ternaryComparisonCache.set(key, result);
                    resolve(result);
                });
            });
        }
        // For pairwise comparisons (e.g., in base case)
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
        if (onProgress) onProgress(arr, progressContext);
    }

    onDone(arr);
}

// --- ALGORITHM 2: Pairwise Merge Sort ---

async function pairwiseMergeSort(arr, onCompare, onDone, onProgress, progressContext) {
    // Helper to wrap the callback-based onCompare into a promise for async/await.
    function compareAsync(itemA, itemB) {
        return new Promise(resolve => onCompare([itemA, itemB], resolve));
    }

    // Main recursive merge sort function
    async function mergeSort(arr, low, high) {
        if (low >= high) {
            return; // Base case: 0 or 1 element
        }

        const mid = low + Math.floor((high - low) / 2);
        await mergeSort(arr, low, mid); // Sort left half
        await mergeSort(arr, mid + 1, high); // Sort right half
        await merge(arr, low, mid, high); // Merge the sorted halves
        if (onProgress) onProgress(arr, progressContext); // Report progress after each merge
    }

    // Merge two sorted subarrays: [low, mid] and [mid + 1, high]
    async function merge(arr, low, mid, high) {
        const left = arr.slice(low, mid + 1);
        const right = arr.slice(mid + 1, high + 1);
        let i = 0; // Index for left subarray
        let j = 0; // Index for right subarray
        let k = low; // Index for merged array

        while (i < left.length && j < right.length) {
            const result = await compareAsync(left[i], right[j]);
            if (result >= 0) { // left[i] >= right[j] (stable sort)
                arr[k] = left[i];
                i++;
            } else { // left[i] < right[j]
                arr[k] = right[j];
                j++;
            }
            k++;
        }

        // Copy remaining elements from left subarray, if any
        while (i < left.length) {
            arr[k] = left[i];
            i++;
            k++;
        }

        // Copy remaining elements from right subarray, if any
        while (j < right.length) {
            arr[k] = right[j];
            j++;
            k++;
        }
    }

    // Main execution
    await mergeSort(arr, 0, arr.length - 1);
    onDone(arr);
}