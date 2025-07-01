import html2canvas from 'html2canvas';

/**
 * Renders a target DOM element to a high-resolution canvas and triggers a download.
 * @param {HTMLElement} elementToCapture The DOM element to capture.
 * @param {string} fileName The desired name for the downloaded file.
 * @param {object} [options={}] Optional settings.
 * @param {string} [options.backgroundColor] A specific background color to apply to the canvas.
 * @param {number} [options.scrollX] Explicit scrollX position for capture.
 * @param {number} [options.scrollY] Explicit scrollY position for capture.
 */
export async function exportElementAsImage(elementToCapture, fileName, options = {}) {
    if (!elementToCapture) {
        console.error("Export failed: Target element not found.");
        alert("Could not export the image. The target element is missing.");
        return;
    }

    const scalingFactor = 3;
    const scale = window.devicePixelRatio * scalingFactor;

    try {
        const canvas = await html2canvas(elementToCapture, {
            scale: scale,
            useCORS: true,
            allowTaint: true,

            // Use the override from options if it exists, otherwise get it from the element.
            backgroundColor: options.backgroundColor || getComputedStyle(elementToCapture).backgroundColor,

            width: elementToCapture.offsetWidth,
            height: elementToCapture.offsetHeight,

            // Use passed options, otherwise default to capturing from the window's current scroll.
            // This is key for capturing off-screen elements correctly from their top.
            scrollX: options.scrollX !== undefined ? options.scrollX : -window.scrollX,
            scrollY: options.scrollY !== undefined ? options.scrollY : -window.scrollY,
        });

        const imageURL = canvas.toDataURL('image/png');

        const downloadLink = document.createElement('a');
        downloadLink.href = imageURL;
        downloadLink.download = fileName;

        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

    } catch (error) {
        console.error("Export failed:", error);
        alert("An error occurred while generating the image.");
    }
}

/**
 * Renders a target DOM element to a canvas and copies it to the clipboard.
 * @param {HTMLElement} elementToCapture The DOM element to capture.
 * @param {object} [options={}] Optional settings.
 * @param {string} [options.backgroundColor] A specific background color to apply to the canvas.
 * @param {number} [options.scrollX] Explicit scrollX position for capture.
 * @param {number} [options.scrollY] Explicit scrollY position for capture.
 */
export async function copyElementAsImage(elementToCapture, options = {}) {
    if (!elementToCapture) {
        console.error("Copy failed: Target element not found.");
        return Promise.reject("Target element not found.");
    }

    if (!navigator.clipboard?.write) {
        alert("Your browser does not support copying images to the clipboard.");
        return Promise.reject("Clipboard API not supported.");
    }

    try {
        const canvas = await html2canvas(elementToCapture, {
            scale: 2,
            useCORS: true,
            backgroundColor: options.backgroundColor || getComputedStyle(elementToCapture).backgroundColor,
            width: elementToCapture.offsetWidth,
            height: elementToCapture.offsetHeight,
            scrollX: options.scrollX !== undefined ? options.scrollX : -window.scrollX,
            scrollY: options.scrollY !== undefined ? options.scrollY : -window.scrollY,
        });

        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    console.error("Canvas to Blob conversion failed.");
                    alert("Could not generate image blob for copying.");
                    resolve(false);
                    return;
                }
                navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]).then(() => {
                    resolve(true);
                }).catch(err => {
                    console.error("Clipboard write failed:", err);
                    alert("Could not copy image to clipboard. Your browser might have blocked it.");
                    resolve(false);
                });
            }, 'image/png');
        });

    } catch (error) {
        console.error("Copy failed:", error);
        alert("An error occurred while generating the image for copying.");
        return Promise.reject(error);
    }
}