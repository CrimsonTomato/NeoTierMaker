import html2canvas from 'html2canvas';

/**
 * Renders a target DOM element to a high-resolution canvas and triggers a download.
 * @param {HTMLElement} elementToCapture The DOM element to capture.
 * @param {string} fileName The desired name for the downloaded file.
 */
export async function exportElementAsImage(elementToCapture, fileName) {
    if (!elementToCapture) {
        console.error("Export failed: Target element not found.");
        alert("Could not export the image. The target element is missing.");
        return;
    }

    // --- HIGH-RESOLUTION FIX ---
    // We get the device pixel ratio to account for HiDPI/Retina screens
    // and apply an additional scaling factor for super resolution.
    const scalingFactor = 3; // Increase for higher resolution. 2 is good, 3 is great.
    const scale = window.devicePixelRatio * scalingFactor;

    try {
        const canvas = await html2canvas(elementToCapture, {
            // --- QUALITY & APPEARANCE OPTIONS ---
            scale: scale, // Use the calculated high-res scale
            useCORS: true, // Allows loading of cross-origin images if any
            allowTaint: true,
            
            // This tells html2canvas to use the element's actual background color
            backgroundColor: getComputedStyle(elementToCapture).backgroundColor,
            
            // Improve rendering by setting width and height explicitly
            width: elementToCapture.offsetWidth,
            height: elementToCapture.offsetHeight,
            scrollX: 0,
            scrollY: -window.scrollY, // Ensure capture starts from the top of the element
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
 */
export async function copyElementAsImage(elementToCapture) {
    if (!elementToCapture) {
        console.error("Copy failed: Target element not found.");
        return Promise.reject("Target element not found.");
    }

    // Check for browser support
    if (!navigator.clipboard?.write) {
        alert("Your browser does not support copying images to the clipboard.");
        return Promise.reject("Clipboard API not supported.");
    }

    try {
        const canvas = await html2canvas(elementToCapture, {
            scale: 2,
            useCORS: true,
            backgroundColor: getComputedStyle(elementToCapture).backgroundColor,
            width: elementToCapture.offsetWidth,
            height: elementToCapture.offsetHeight,
            scrollX: 0,
            scrollY: -window.scrollY,
        });

        // Convert canvas to a Blob, which is what the clipboard API needs
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]).then(() => {
                    resolve(true); // Success
                }).catch(err => {
                    console.error("Clipboard write failed:", err);
                    alert("Could not copy image to clipboard. Your browser might have blocked it.");
                    resolve(false); // Failure
                });
            }, 'image/png');
        });

    } catch (error) {
        console.error("Copy failed:", error);
        alert("An error occurred while generating the image for copying.");
        return Promise.reject(error);
    }
}