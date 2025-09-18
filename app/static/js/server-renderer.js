#!/usr/bin/env node

/**
 * Server-side Universal Renderer for Node.js
 * 
 * This script allows the Universal Renderer to work in a Node.js environment
 * for server-side rendering. It uses node-canvas to provide a Canvas API.
 */

const fs = require('fs');
const path = require('path');

// Try to require node-canvas, exit gracefully if not available
let Canvas, Image;
try {
    const canvas = require('canvas');
    Canvas = canvas.Canvas;
    Image = canvas.Image;
} catch (error) {
    console.error('node-canvas is required for server-side rendering');
    console.error('Install it with: npm install canvas');
    process.exit(1);
}

// Load the Universal Renderer
// We need to simulate a browser-like environment
global.window = {};
global.document = {
    createElement: (tag) => {
        if (tag === 'canvas') {
            return new Canvas();
        }
        return {
            style: {},
            addEventListener: () => {},
            removeEventListener: () => {}
        };
    }
};

// Load our renderer
const rendererPath = path.join(__dirname, 'universal-renderer.js');
const rendererCode = fs.readFileSync(rendererPath, 'utf8');

// Remove browser-specific exports
const modifiedCode = rendererCode.replace(/if \(typeof window !== 'undefined'\) \{[\s\S]*?\}/, '');
eval(modifiedCode);

// Server-side Universal Renderer class
class ServerUniversalRenderer extends UniversalRenderer {
    constructor(options = {}) {
        super(options);
        this.isClientSide = false;
    }

    async initialize(canvas = null) {
        if (canvas) {
            this.canvas = canvas;
        } else {
            this.canvas = new Canvas();
        }
        this.ctx = this.canvas.getContext('2d');
    }

    async loadCharacterImage(imagePath) {
        if (this.characterImages.has(imagePath)) {
            return this.characterImages.get(imagePath);
        }

        // Convert web path to file system path
        const filename = path.basename(imagePath);
        const speciesDataPath = path.join(__dirname, '..', '..', 'species_data', filename);
        
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.characterImages.set(imagePath, img);
                resolve(img);
            };
            img.onerror = (err) => {
                // Try fallback to missing.png
                if (!imagePath.includes('missing.png')) {
                    const missingPath = path.join(path.dirname(speciesDataPath), 'missing.png');
                    const fallbackImg = new Image();
                    fallbackImg.onload = () => {
                        this.characterImages.set(imagePath, fallbackImg);
                        resolve(fallbackImg);
                    };
                    fallbackImg.onerror = reject;
                    fallbackImg.src = missingPath;
                } else {
                    reject(err);
                }
            };
            img.src = speciesDataPath;
        });
    }

    exportAsBuffer(type = 'image/png') {
        return this.canvas.toBuffer(type);
    }

    exportAsBase64(type = 'image/png') {
        return this.canvas.toDataURL(type).split(',')[1];
    }
}

// Main function to run the renderer
async function main() {
    try {
        // Get input file path from command line
        const inputPath = process.argv[2];
        if (!inputPath) {
            console.error('Usage: node server-renderer.js <input-json-file>');
            process.exit(1);
        }

        // Read input data
        const inputData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
        const { characters, options = {} } = inputData;

        // Create renderer
        const renderer = new ServerUniversalRenderer(options);
        await renderer.initialize();

        // Render characters
        await renderer.render(characters);

        // Output base64 encoded image
        const base64Data = renderer.exportAsBase64();
        console.log(base64Data);

    } catch (error) {
        console.error('Rendering failed:', error.message);
        process.exit(1);
    }
}

// Run if this script is executed directly
if (require.main === module) {
    main();
}

module.exports = ServerUniversalRenderer;