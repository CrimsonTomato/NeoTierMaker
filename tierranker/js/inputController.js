// In js/inputController.js - This needs significant updates

import { state, addItem } from './state.js';
import { renderStagingList } from './ui.js';
// Import the new color functions
import { colorInfoFromString, colorInfoFromImage } from './color.js';

export async function handleTextInput(text) { // This function is now async
    if (!text) return;

    const existingTexts = new Set(state.items.map(item => item.text));
    const lines = text.split('\n');
    const potentialItems = lines.flatMap(line => line.split(','));

    for (const rawItem of potentialItems) {
        const trimmed = rawItem.trim();
        if (trimmed && !existingTexts.has(trimmed)) {
            addItem({
                id: crypto.randomUUID(),
                text: trimmed,
                image: null,
                // --- FIX: Generate and store color on creation ---
                color: colorInfoFromString(trimmed),
            });
            existingTexts.add(trimmed);
        }
    }

    renderStagingList();
}

export async function handleFileInput(files) { // This function is already async-friendly
    const existingTexts = new Set(state.items.map(item => item.text));

    const readFileAsDataURL = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const promises = Array.from(files).map(async (file) => {
        const text = file.name.split('.').slice(0, -1).join('.') || file.name;
        
        if (existingTexts.has(text)) {
            console.warn(`Skipping duplicate item: ${text}`);
            return;
        }

        try {
            const imageDataUrl = await readFileAsDataURL(file);
            // --- FIX: Generate and store color on creation ---
            const colorInfo = await colorInfoFromImage(imageDataUrl);

            addItem({
                id: crypto.randomUUID(),
                text: text,
                image: imageDataUrl,
                color: colorInfo,
            });
            existingTexts.add(text);
        } catch (error) {
            console.error("Error reading file:", error);
        }
    });

    // Wait for all files to be processed before rendering
    await Promise.all(promises);
    renderStagingList();
}