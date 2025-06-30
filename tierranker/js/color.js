import { FastAverageColor } from 'fast-average-color';

const fac = new FastAverageColor();

/**
 * Calculates the perceived luminance of an RGB color.
 * Formula from WCAG 2.0. Values range from 0 (black) to 1 (white).
 * @param {number} r Red value (0-255)
 * @param {number} g Green value (0-255)
 * @param {number} b Blue value (0-255)
 * @returns {number} The luminance.
 */
function getLuminance(r, g, b) {
    const a = [r, g, b].map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

/**
 * Determines if a color is "dark".
 * @param {number[]} rgb - An array of [r, g, b] values.
 * @returns {boolean} True if the color is dark, false otherwise.
 */
export function isColorDark(rgb) {
    // The threshold 0.5 is a common choice, but can be adjusted.
    // A lower value (e.g., 0.4) means more colors will be considered "light".
    return getLuminance(rgb[0], rgb[1], rgb[2]) < 0.5;
}

/**
 * Generates a deterministic, visually pleasing color from a string.
 * @param {string} str The input string.
 * @returns {object} An object containing the background color and contrasting text color.
 */
export function colorInfoFromString(str) {
    let hash = 0;
    if (str.length === 0) return { background: 'hsl(0, 0%, 85%)', text: '#000000' };
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash;
    }
    const h = hash % 360;
    // The HSL colors are always light, so text is always black.
    return {
        background: `hsl(${h}, 70%, 85%)`,
        text: '#000000'
    };
}

/**
 * Gets the dominant color from an image and determines the best contrasting text color.
 * @param {string} imageDataUrl The base64 data URL of the image.
 * @returns {Promise<object>} A promise resolving to { background, text }.
 */
export async function colorInfoFromImage(imageDataUrl) {
    try {
        const color = await fac.getColorAsync(imageDataUrl);
        const isDark = isColorDark(color.value); // color.value is [r, g, b, a]

        return {
            background: color.hex,
            text: isDark ? '#FFFFFF' : '#000000'
        };
    } catch (e) {
        console.error("Could not get color from image", e);
        return {
            background: '#cccccc',
            text: '#000000'
        };
    }
}