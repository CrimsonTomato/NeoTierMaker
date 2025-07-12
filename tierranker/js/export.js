import html2canvas from 'html2canvas';

/**
 * Creates an offscreen clone of an element for capture, applying precise CSS overrides
 * to ensure its full height is calculable without breaking the visual layout.
 * @param {HTMLElement} originalElement The original DOM element to clone.
 * @param {boolean} isBarChart Whether the element is a bar chart, for specific cleanup.
 * @returns {Promise<HTMLElement>} The wrapper containing the cloned element, appended to body.
 */
async function createOffscreenCloneForCapture(
    originalElement,
    isBarChart = false,
) {
    const exportWrapper = document.createElement('div');
    const bgColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--bg-primary')
        .trim();

    // 1. Setup the offscreen wrapper. It needs a fixed width to correctly calculate content wrapping and height.
    exportWrapper.style.position = 'absolute';
    exportWrapper.style.left = '-9999px';
    exportWrapper.style.top = '-9999px';
    exportWrapper.style.padding = '0'; // The cloned content will have its own padding
    exportWrapper.style.backgroundColor = bgColor; // This sets the background for the wrapper if needed, but html2canvas option will override.
    exportWrapper.style.width = isBarChart
        ? `${originalElement.offsetWidth}px`
        : '1200px';
    exportWrapper.style.boxSizing = 'content-box'; // Ensure padding doesn't affect width calculations if we were to add it

    const clone = originalElement.cloneNode(true);

    // --- GENERIC PREPARATION FOR CLONE (applies to the root cloned element) ---
    // Ensure the top-level cloned element itself expands fully
    clone.style.display = 'block';
    clone.style.height = 'auto'; // Allow content to define height
    clone.style.minHeight = '0'; // Crucial for flex/grid items to release minimums
    clone.style.overflow = 'visible'; // Ensure all content is visible, no scrolling
    clone.style.flexGrow = '0'; // Prevent it from trying to fill parent flex space in the clone's context
    clone.style.flexShrink = '0'; // Prevent it from shrinking
    clone.style.margin = '0'; // Remove any external margins that might influence positioning or sizing

    // 2. Remove any interactive elements (buttons, etc.) that shouldn't appear in the static image.
    clone
        .querySelector('.results-column-header .results-column-actions')
        ?.remove();
    // Also remove the control buttons from the classic view header
    clone.querySelector('.classic-controls .results-actions')?.remove();

    // --- CONTENT-SPECIFIC LAYOUT FIXES ---
    if (isBarChart) {
        const scrollableContent = clone.querySelector('#ranked-list-wrapper');
        if (scrollableContent) {
            scrollableContent.style.height = 'auto';
            scrollableContent.style.overflow = 'visible';
            scrollableContent.style.flexGrow = '0'; // Ensure this also doesn't try to fill space
            scrollableContent.style.minHeight = '0'; // Release any min-height constraints
        }
        clone.querySelector('.tier-tag-palette')?.remove();
        const gradientLabelsInClone = clone.querySelectorAll(
            '.bar-label-gradient',
        );
        gradientLabelsInClone.forEach(label => {
            const solidColor = label.dataset.solidColorForExport;
            if (solidColor) {
                label.style.backgroundImage = 'none';
                label.style.webkitBackgroundClip = 'initial';
                label.style.backgroundClip = 'initial';
                label.style.color = solidColor;
            }
        });
    } else {
        // --- TIER LISTS (Results & Classic) - THE DEFINITIVE, LAYOUT-PRESERVING FIX ---
        const tierListGrid = clone.querySelector(
            '#tier-list-grid, #classic-tier-list-grid',
        );
        if (tierListGrid) {
            // A. Force the main grid to expand.
            tierListGrid.style.height = 'auto';
            tierListGrid.style.overflow = 'visible';
            tierListGrid.style.flexGrow = '0'; // Crucial: make grid size to its content
            tierListGrid.style.minHeight = '0'; // Release any min-height

            // B. Find all inner containers for the items within each tier.
            const tierItemsContainers =
                tierListGrid.querySelectorAll('.tier-items');
            tierItemsContainers.forEach(container => {
                // C. CRITICAL FIX: The `min-height` CSS property is the root cause. Override it.
                // This forces the container to calculate its height from its actual content, not a CSS minimum.
                container.style.height = 'auto';
                container.style.minHeight = '0'; // THE KEY

                // D. Remove the `will-change` performance hint, which can interfere with html2canvas.
                container.style.willChange = 'auto';
                container.style.flexGrow = '0'; // Ensure these containers also size to content
            });
        }

        // E. Remove the unranked items pool from the classic view export.
        if (originalElement.id === 'classic-tier-list-export-area') {
            clone.querySelector('#classic-unranked-pool-container')?.remove();
        }
    }

    exportWrapper.appendChild(clone);
    document.body.appendChild(exportWrapper);

    // Give the browser a chance to render the cloned element with its new styles
    // before measuring its dimensions. This is crucial for accurate scrollHeight.
    await new Promise(resolve => requestAnimationFrame(resolve));

    return exportWrapper;
}

/**
 * Renders a target DOM element to a canvas and triggers a download.
 * @param {HTMLElement} elementToCapture The original DOM element to capture.
 * @param {string} fileName The desired name for the downloaded file.
 * @param {boolean} isBarChart Flag to apply bar chart specific cleanup.
 * @param {object} [options={}] Optional settings passed to html2canvas.
 */
export async function exportElementAsImage(
    elementToCapture,
    fileName,
    isBarChart = false,
    options = {},
) {
    if (!elementToCapture) {
        console.error('Export failed: Target element not found.');
        alert('Could not export the image. The target element is missing.');
        return;
    }

    const scalingFactor = 3;
    const scale = window.devicePixelRatio * scalingFactor;

    let exportWrapper = null;
    try {
        exportWrapper = await createOffscreenCloneForCapture(
            // Await the creation process
            elementToCapture,
            isBarChart,
        );
        const contentToCapture = exportWrapper.querySelector(':scope > *'); // This is the clone

        // Measure after styles are applied and rendered
        const captureWidth = contentToCapture.offsetWidth;
        const captureHeight = contentToCapture.scrollHeight;

        // FINAL SAFEGUARD: Explicitly set the clone's style height right before capture.
        contentToCapture.style.height = `${captureHeight}px`;

        const canvas = await html2canvas(contentToCapture, {
            scale: scale,
            useCORS: true,
            allowTaint: true,
            // Use the actual background color of the content being captured
            backgroundColor: getComputedStyle(contentToCapture).backgroundColor,
            width: captureWidth,
            height: captureHeight,
            scrollX: 0,
            scrollY: 0,
            ...options, // Merge any additional options
        });

        const imageURL = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = imageURL;
        downloadLink.download = fileName;

        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    } catch (error) {
        console.error('Export failed:', error);
        alert('An error occurred while generating the image.');
    } finally {
        if (exportWrapper) {
            document.body.removeChild(exportWrapper);
        }
    }
}

/**
 * Renders a target DOM element to a canvas and copies it to the clipboard.
 * @param {HTMLElement} elementToCapture The original DOM element to capture.
 * @param {boolean} isBarChart Flag to apply bar chart specific cleanup.
 * @param {object} [options={}] Optional settings passed to html2canvas.
 */
export async function copyElementAsImage(
    elementToCapture,
    isBarChart = false,
    options = {},
) {
    if (!elementToCapture) {
        console.error('Copy failed: Target element not found.');
        return Promise.reject('Target element not found.');
    }

    if (!navigator.clipboard?.write) {
        alert('Your browser does not support copying images to the clipboard.');
        return Promise.reject('Clipboard API not supported.');
    }

    let exportWrapper = null;
    try {
        exportWrapper = await createOffscreenCloneForCapture(
            // Await the creation process
            elementToCapture,
            isBarChart,
        );
        const contentToCapture = exportWrapper.querySelector(':scope > *'); // This is the clone

        const captureWidth = contentToCapture.offsetWidth;
        const captureHeight = contentToCapture.scrollHeight;

        contentToCapture.style.height = `${captureHeight}px`;

        const canvas = await html2canvas(contentToCapture, {
            scale: 2, // A slightly lower scale for clipboard is often sufficient and faster
            useCORS: true,
            backgroundColor: getComputedStyle(contentToCapture).backgroundColor,
            width: captureWidth,
            height: captureHeight,
            scrollX: 0,
            scrollY: 0,
            ...options, // Merge any additional options
        });

        return new Promise(resolve => {
            canvas.toBlob(blob => {
                if (!blob) {
                    console.error('Canvas to Blob conversion failed.');
                    alert('Could not generate image blob for copying.');
                    resolve(false);
                    return;
                }
                navigator.clipboard
                    .write([new ClipboardItem({ 'image/png': blob })])
                    .then(() => {
                        resolve(true);
                    })
                    .catch(err => {
                        console.error('Clipboard write failed:', err);
                        alert(
                            'Could not copy image to clipboard. Your browser might have blocked it.',
                        );
                        resolve(false);
                    });
            }, 'image/png');
        });
    } catch (error) {
        console.error('Copy failed:', error);
        alert('An error occurred while generating the image for copying.');
        return Promise.reject(error);
    } finally {
        if (exportWrapper) {
            document.body.removeChild(exportWrapper);
        }
    }
}
