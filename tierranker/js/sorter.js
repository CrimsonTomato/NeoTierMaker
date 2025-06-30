// A non-recursive implementation of the 3-way Quicksort algorithm.

// This function will be called by our main controller to get the next comparison.
export function createSorter(items, onCompare, onDone) {
    const arr = [...items]; // Work on a copy
    
    // Stack for managing sub-arrays [low, high]
    const stack = [];
    stack.push(0);
    stack.push(arr.length - 1);

    let comparisons = 0;

    // Main sorting loop
    function next() {
        if (stack.length > 0) {
            const high = stack.pop();
            const low = stack.pop();
            
            partition(low, high);
        } else {
            // Sorting is complete
            onDone(arr);
        }
    }

    // Partitioning function
    function partition(low, high) {
        if (high <= low) {
            next(); // This segment is sorted, move to the next
            return;
        }

        // Choose a pivot (we'll use the last element)
        const pivotIndex = high;
        const pivot = arr[pivotIndex];
        
        let i = low; // Pointer for elements less than pivot
        let j = high - 1; // Pointer for elements greater than pivot
        let p = low; // Current element being compared

        // Ask the user to compare the pivot with the first element
        onCompare(pivot, arr[p], (result) => processComparison(result, p));

        function processComparison(result, currentIndex) {
            comparisons++;
            // result: 1 (A > B), -1 (A < B), 0 (A == B)
            // Here, A is the pivot.
            
            if (result === 1) { // pivot > arr[currentIndex]
                [arr[i], arr[currentIndex]] = [arr[currentIndex], arr[i]]; // Swap
                i++;
            }
            // If pivot < arr[currentIndex], we do nothing, it's already in the right place conceptually.
            // If pivot == arr[currentIndex], we also do nothing for now.
            
            // Move to the next element to compare
            let nextIndex = currentIndex + 1;
            if (nextIndex <= j) {
                // More elements to compare in this partition
                onCompare(pivot, arr[nextIndex], (res) => processComparison(res, nextIndex));
            } else {
                // End of this partition. Place the pivot in its final sorted position.
                [arr[i], arr[pivotIndex]] = [arr[pivotIndex], arr[i]]; // Swap pivot into place

                // Push new sub-arrays to the stack
                // Left side of the pivot
                stack.push(low);
                stack.push(i - 1);
                // Right side of the pivot
                stack.push(i + 1);
                stack.push(high);
                
                // Move to the next partition from the stack
                next();
            }
        }
    }

    // Start the first step
    next();
}