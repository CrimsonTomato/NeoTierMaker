import html2canvas from 'html2canvas';

/**
 * Creates an offscreen clone of an element for capture, applying specific export styling/cleanup.
 * @param {HTMLElement} originalElement The original DOM element to clone.
 * @param {boolean} isBarChart Whether the element is a bar chart, for specific cleanup.
 * @returns {HTMLElement} The wrapper containing the cloned element, appended to body.
 */
function createOffscreenCloneForCapture(originalElement, isBarChart = false) {
    const exportWrapper = document.createElement('div');
    const bgColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--bg-secondary')
        .trim(); // Ensure background matches current theme

    exportWrapper.style.position = 'absolute';
    exportWrapper.style.left = '-9999px';
    exportWrapper.style.top = '-9999px';
    // Use actual dimensions of the original element to maintain aspect ratio
    exportWrapper.style.width = `${originalElement.offsetWidth}px`;
    exportWrapper.style.padding = getComputedStyle(originalElement).padding;
    exportWrapper.style.backgroundColor = bgColor;

    // Apply flex column layout for tier list, but not for bar chart which might have its own layout
    if (!isBarChart) {
        exportWrapper.style.display = 'flex';
        exportWrapper.style.flexDirection = 'column';
        exportWrapper.style.height = 'fit-content'; // Ensure content determines height
    }

    const clone = originalElement.cloneNode(true);

    if (isBarChart) {
        // Remove interactive elements from the cloned bar chart
        clone
            .querySelector('.results-column-header .results-column-actions')
            ?.remove();
        clone.querySelector('.tier-tag-palette')?.remove();

        // Adjust gradient labels for solid color export
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
        // Specific cleanup for tier list clone (e.g., remove actions)
        clone
            .querySelector('.results-column-header .results-column-actions')
            ?.remove();
    }

    exportWrapper.appendChild(clone);
    document.body.appendChild(exportWrapper); // Append to body to make it renderable by html2canvas
    return exportWrapper;
}

/**
 * Renders a target DOM element to a high-resolution canvas and triggers a download.
 * It creates an offscreen clone to ensure consistent styling for export.
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

    const scalingFactor = 3; // Higher scale for higher resolution
    const scale = window.devicePixelRatio * scalingFactor;

    let exportWrapper = null;
    try {
        exportWrapper = createOffscreenCloneForCapture(
            elementToCapture,
            isBarChart,
        );
        // html2canvas should capture the content *inside* the wrapper
        const canvas = await html2canvas(
            exportWrapper.querySelector(':scope > *'),
            {
                scale: scale,
                useCORS: true,
                allowTaint: true,
                backgroundColor:
                    options.backgroundColor ||
                    getComputedStyle(exportWrapper).backgroundColor,
                // Ensure width and height match the cloned content
                width: exportWrapper.offsetWidth,
                height: exportWrapper.offsetHeight,
                // Capture from the top-left of the cloned element (which is offscreen)
                scrollX: 0,
                scrollY: 0,
            },
        );

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
 * It creates an offscreen clone to ensure consistent styling for copy.
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
        exportWrapper = createOffscreenCloneForCapture(
            elementToCapture,
            isBarChart,
        );
        const canvas = await html2canvas(
            exportWrapper.querySelector(':scope > *'),
            {
                scale: 2, // Slightly lower scale for faster clipboard copy
                useCORS: true,
                backgroundColor:
                    options.backgroundColor ||
                    getComputedStyle(exportWrapper).backgroundColor,
                width: exportWrapper.offsetWidth,
                height: exportWrapper.offsetHeight,
                scrollX: 0,
                scrollY: 0,
            },
        );

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
