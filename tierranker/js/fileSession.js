// Create new file: js/fileSession.js

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
    
    // Process items: extract images, replace data URL with a path
    for (const item of stateToSave.items) {
        if (item.image) {
            const fileExtension = item.image.startsWith('data:image/jpeg') ? 'jpg' : 'png';
            const fileName = `${item.id}.${fileExtension}`;
            
            // Add the image blob to the zip
            const imageBlob = dataURLtoBlob(item.image);
            imagesFolder.file(fileName, imageBlob);
            
            // Replace the huge data URL with a simple path
            item.image = `images/${fileName}`;
        }
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
            const imageFile = contents.file(item.image);
            if (imageFile) {
                const base64 = await imageFile.async('base64');
                const mimeType = item.image.endsWith('jpg') ? 'image/jpeg' : 'image/png';
                item.image = `data:${mimeType};base64,${base64}`;
            } else {
                console.warn(`Image not found in zip: ${item.image}`);
                item.image = null; // Image is missing, clear it
            }
        }
        return item;
    });

    // Wait for all images to be processed
    await Promise.all(imagePromises);

    return loadedState;
}