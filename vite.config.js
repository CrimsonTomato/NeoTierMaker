import { defineConfig } from 'vite';
import { createHtmlPlugin } from 'vite-plugin-html';
import fs from 'fs';
import path from 'path';

// Resolve the absolute path to the 'tierranker' directory, which is our Vite root.
// This ensures that file paths are correctly resolved regardless of the current working directory.
const tierrankerRoot = path.resolve(__dirname, 'tierranker');

// Helper function to read HTML partials from 'tierranker/components'
const readHtmlPartial = name =>
    fs.readFileSync(
        path.resolve(tierrankerRoot, 'components', `${name}.html`),
        'utf-8',
    );

// Helper function to read HTML view partials from 'tierranker/components/views'
const readHtmlView = name =>
    fs.readFileSync(
        path.resolve(tierrankerRoot, 'components', 'views', `${name}.html`),
        'utf-8',
    );

export default defineConfig(({ command }) => {
    const isProduction = command === 'build';

    // 1. Read individual HTML partials
    const leftSidebarContent = readHtmlPartial('left_sidebar');
    const rightSidebarContent = readHtmlPartial('right_sidebar');
    const hiddenElementsContent = readHtmlPartial('hidden_elements');
    const modalContent = readHtmlPartial('modal_content');

    // 2. Read each view's content
    const viewInputContent = readHtmlView('view_input');
    const viewSeedingContent = readHtmlView('view_seeding');
    const viewComparisonContent = readHtmlView('view_comparison');
    const viewResultsContent = readHtmlView('view_results');
    const viewClassicContent = readHtmlView('view_classic');

    // 3. Compose the 'center_stage' content from its individual views
    const centerStageContent = `
        <div id="view-input" class="view active">
            ${viewInputContent}
        </div>
        <div id="view-seeding" class="view">
            ${viewSeedingContent}
        </div>
        <div id="view-comparison" class="view">
            ${viewComparisonContent}
        </div>
        <div id="view-results" class="view">
            ${viewResultsContent}
        </div>
        <div id="view-classic" class="view">
            ${viewClassicContent}
        </div>
    `;

    return {
        root: 'tierranker', // Your application's root directory for Vite
        base: isProduction ? '/NeoTierMaker/' : '/', // Base URL for GitHub Pages deployment

        build: {
            outDir: '../dist', // Output directory for the build, relative to project root
            emptyOutDir: true,
        },
        plugins: [
            createHtmlPlugin({
                minify: isProduction, // Minify the output HTML in production
                template: 'index.html', // Path to your main HTML template in the `root` directory
                inject: {
                    // Inject the read HTML content into placeholders in the template
                    data: {
                        injectLeftSidebar: leftSidebarContent,
                        injectCenterStage: centerStageContent,
                        injectRightSidebar: rightSidebarContent,
                        injectHiddenElements: hiddenElementsContent,
                        injectModal: modalContent,
                    },
                },
            }),
        ],
    };
});
