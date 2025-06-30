import JSZip from 'jszip';
import { state } from './state.js';

/**
 * Converts a data URL (base64) to a Blob.
 * @param {string} dataUrl The data URL.
 * @returns {Blob}
 */
function dataURLtoBlob(dataUrl) {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

/**
 * Generates a .zip file containing the session state and images.
 */
export async function exportSessionToFile() {
    const zip = new JSZip();
    const imagesFolder = zip.folder('images');

    // Create a deep copy of the state to modify without affecting the live app
    const stateToSave = JSON.parse(JSON.stringify(state));
    
    // --- FIX: Clear transient sorting state before saving. ---
    // If a sort was in progress, we don't save its state. The user can restart 
    // the sort after loading. This prevents saving large base64 strings from 
    // the comparison object into the session file.
    stateToSave.isSorting = false;
    stateToSave.comparison = { a: null, b: null, callback: null };
    stateToSave.progress = { current: 0, total: 0 };


    // Process items: extract images, replace data URL with a path
    for (const item of stateToSave.items) {
        // Case 1: Item has an image that was loaded from a previous session.
        // We reuse its original path to avoid creating duplicate files.
        if (item.originalImagePath) {
            // The image data is the current base64 string in `item.image`
            const imageBlob = dataURLtoBlob(item.image);
            const fileName = item.originalImagePath.replace('images/', '');
            imagesFolder.file(fileName, imageBlob);

            // For the JSON file, we restore the original path reference.
            item.image = item.originalImagePath;

        } 
        // Case 2: Item has a NEW image (a data URL without an original path).
        // This happens for images added during the current session.
        else if (item.image && item.image.startsWith('data:image/')) {
            const fileExtension = item.image.startsWith('data:image/jpeg') ? 'jpg' : 'png';
            const fileName = `${item.id}.${fileExtension}`;
            const imagePath = `images/${fileName}`;
            
            const imageBlob = dataURLtoBlob(item.image);
            imagesFolder.file(fileName, imageBlob);
            
            // Replace the huge data URL with a simple path reference.
            item.image = imagePath;
        }

        // Clean up the temporary property before serializing to JSON.
        delete item.originalImagePath;
    }

    // Add the modified state as session.json
    zip.file('session.json', JSON.stringify(stateToSave, null, 2));

    // Generate the zip and trigger a download
    const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: "DEFLATE",
        compressionOptions: { level: 9 }
    });
    
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(zipBlob);
    downloadLink.download = `TierRanker-Session-${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(downloadLink.href);
}


/**
 * Reads a .zip file and reconstructs the application state.
 * @param {File} file The .zip file selected by the user.
 * @returns {Promise<object>} A promise that resolves with the reconstructed state object.
 */
export async function importSessionFromFile(file) {
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);

    const sessionFile = contents.file('session.json');
    if (!sessionFile) {
        throw new Error('Invalid session file: session.json not found.');
    }

    const sessionData = await sessionFile.async('string');
    const loadedState = JSON.parse(sessionData);

    // Re-hydrate images: load them from the zip and convert back to data URLs
    const imagePromises = loadedState.items.map(async (item) => {
        if (item.image && item.image.startsWith('images/')) {
            const originalPath = item.image; // Keep track of the source path
            const imageFile = contents.file(originalPath);

            if (imageFile) {
                const base64 = await imageFile.async('base64');
                const mimeType = originalPath.endsWith('jpg') || originalPath.endsWith('jpeg') ? 'image/jpeg' : 'image/png';
                
                // Set the displayable image to the rehydrated base64 data URL
                item.image = `data:${mimeType};base64,${base64}`;
                
                // Store the original path on the item for the next save operation.
                item.originalImagePath = originalPath;
            } else {
                console.warn(`Image not found in zip: ${originalPath}`);
                item.image = null; // Image is missing, clear it
            }
        }
        return item;
    });

    // Wait for all images to be processed
    await Promise.all(imagePromises);

    return loadedState;
}