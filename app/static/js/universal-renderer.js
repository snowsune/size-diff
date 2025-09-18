/**
 * Universal Size Diff Renderer
 * 
 * This renderer can work both server-side (Node.js) and client-side (browser)
 * to generate size comparison images. The core logic is shared between environments.
 */

class UniversalRenderer {
    constructor(options = {}) {
        this.options = {
            size: 400,
            measureToEars: true,
            useSpeciesScaling: false,
            fontFamily: 'Arial, sans-serif',
            fontSize: null, // Will be calculated from size
            charPadding: null, // Will be calculated from fontSize
            backgroundColor: 'white',
            gridColor: 'grey',
            gridLineWidth: 1,
            ...options
        };

        this.canvas = null;
        this.ctx = null;
        this.isClientSide = typeof window !== 'undefined';
        this.characterImages = new Map(); // Cache for loaded images
    }

    /**
     * Initialize the renderer with a canvas or create one
     */
    async initialize(canvas = null) {
        if (this.isClientSide) {
            if (canvas) {
                this.canvas = canvas;
            } else {
                this.canvas = document.createElement('canvas');
            }
            this.ctx = this.canvas.getContext('2d');
        } else {
            // Server-side: would use node-canvas or similar
            throw new Error('Server-side canvas not implemented yet');
        }
    }

    /**
     * Calculate dynamic sizes based on image size
     */
    calculateDynamicSizes() {
        const fontSize = Math.floor(this.options.size / 20);
        const charPadding = fontSize * 6;
        return { fontSize, charPadding };
    }

    /**
     * Load character image (async for both client and server)
     */
    async loadCharacterImage(imagePath) {
        if (this.characterImages.has(imagePath)) {
            return this.characterImages.get(imagePath);
        }

        if (this.isClientSide) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    this.characterImages.set(imagePath, img);
                    resolve(img);
                };
                img.onerror = (e) => {
                    console.warn(`Failed to load image: ${imagePath}`, e);
                    // Fallback to missing.png
                    if (!imagePath.includes('missing.png')) {
                        resolve(this.loadCharacterImage('/species_data/missing.png'));
                    } else {
                        reject(e);
                    }
                };
                img.src = imagePath;
            });
        } else {
            // Server-side image loading would go here
            throw new Error('Server-side image loading not implemented yet');
        }
    }

    /**
 * Apply color tint to character image using the alpha channel as a mask.
 * This matches the Python PIL implementation for consistent color tinting.
 */
    applyColorTint(imageElement, color) {
        if (!color) return imageElement; // No change if no color is provided

        // Create a temporary canvas to apply the tint
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        tempCanvas.width = imageElement.width;
        tempCanvas.height = imageElement.height;

        // Draw the original image
        tempCtx.drawImage(imageElement, 0, 0);

        // Apply color tint using composite operation
        // This simulates PIL's composite with alpha mask
        tempCtx.globalCompositeOperation = 'multiply';
        tempCtx.fillStyle = `#${color}`;
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        // Reset composite operation and preserve alpha
        tempCtx.globalCompositeOperation = 'destination-in';
        tempCtx.drawImage(imageElement, 0, 0);

        return tempCanvas;
    }

    /**
 * Calculate character heights and visual positioning.
 * This follows the same logic as the Python version's height calculation steps.
 */
    calculateCharacterMetrics(characters) {
        // Step 1: Calculate scaled heights, adjusting for ears offset if applicable
        const heightAdjustedChars = characters.map(char => {
            // Apply species scaling if enabled (would call calculate_height_offset equivalent)
            let adjustedHeight = char.feral_height;
            if (this.options.useSpeciesScaling) {
                // TODO: Implement species-specific height adjustments
                // This would apply species scaling similar to Python calculate_height_offset
            }

            // Calculate visual height by adding ears_offset percentage if applicable
            let visualHeight = adjustedHeight;
            if (this.options.measureToEars && char.ears_offset) {
                // Increase height by a percentage factor so the top of the character appears taller
                visualHeight = adjustedHeight * (1 + char.ears_offset / 100.0);
            } else {
                // Default to actual character height if not measuring to ears
                visualHeight = adjustedHeight;
            }

            return {
                ...char,
                adjustedHeight,
                visualHeight
            };
        });

        // Step 2: Determine the render height based on the tallest character's visual height
        const tallestHeight = Math.max(...heightAdjustedChars.map(c => c.visualHeight));
        const renderHeight = tallestHeight * 1.05; // Add 5% padding

        // Decide line granularity based on height (matches Python logic)
        const drawLineAtFoot = renderHeight > 22;

        // Step 3: Calculate scale factors based on render height
        const scaleFactors = heightAdjustedChars.map(char =>
            char.visualHeight / renderHeight
        );

        return {
            characters: heightAdjustedChars,
            renderHeight,
            scaleFactors,
            drawLineAtFoot
        };
    }

    /**
     * Calculate canvas dimensions and character positioning
     */
    async calculateLayout(characters) {
        const { fontSize, charPadding } = this.calculateDynamicSizes();
        const metrics = this.calculateCharacterMetrics(characters);

        let totalWidth = 0;
        const characterDimensions = [];

        for (let i = 0; i < characters.length; i++) {
            const char = metrics.characters[i];
            const scaleFactor = metrics.scaleFactors[i];

            // Load image to get dimensions  
            // Flask serves species_data as static files, but they're actually in app/species_data
            const img = await this.loadCharacterImage(`/species_data/${char.image}`);

            // Calculate scaled dimensions
            const charImgHeight = Math.floor(this.options.size * scaleFactor);
            const charImgWidth = Math.floor(img.width * (charImgHeight / img.height));

            characterDimensions.push({
                width: charImgWidth,
                height: charImgHeight,
                image: img
            });

            totalWidth += charImgWidth + charPadding;
        }

        // Remove the last padding
        totalWidth -= charPadding;

        const bottomPadding = Math.floor(this.options.size / 10);
        const canvasHeight = this.options.size + bottomPadding;

        return {
            width: totalWidth,
            height: canvasHeight,
            metrics,
            characterDimensions,
            fontSize,
            charPadding,
            bottomPadding
        };
    }

    /**
     * Draw grid lines
     */
    drawGrid(layout) {
        const { width, height, metrics } = layout;

        this.ctx.strokeStyle = this.options.gridColor;
        this.ctx.lineWidth = this.options.gridLineWidth;

        if (metrics.drawLineAtFoot) {
            // Draw lines every foot
            for (let foot = 0; foot <= Math.floor(metrics.renderHeight / 12); foot++) {
                const y = this.options.size - Math.floor((foot * 12) / metrics.renderHeight * this.options.size);
                this.ctx.beginPath();
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(width, y);
                this.ctx.stroke();
            }
        } else {
            // Draw lines every inch
            for (let inch = 0; inch <= Math.floor(metrics.renderHeight); inch++) {
                const y = this.options.size - Math.floor(inch / metrics.renderHeight * this.options.size);
                this.ctx.beginPath();
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(width, y);
                this.ctx.stroke();
            }
        }
    }

    /**
     * Draw dotted line for height indicators
     */
    drawDottedLine(startX, endX, y, color) {
        const dashLength = Math.floor((40 * this.options.size) / 1024);
        const gap = Math.floor((20 * this.options.size) / 1024);
        const lineWidth = Math.floor((6 * this.options.size) / 1024);

        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.setLineDash([dashLength, gap]);

        this.ctx.beginPath();
        this.ctx.moveTo(startX, y);
        this.ctx.lineTo(endX, y);
        this.ctx.stroke();

        this.ctx.setLineDash([]); // Reset line dash
    }

    /**
     * Get dominant color from image (simplified version)
     */
    getDominantColor(imageElement) {
        // Create a 1x1 canvas to get average color
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = 1;
        tempCanvas.height = 1;

        tempCtx.drawImage(imageElement, 0, 0, 1, 1);
        const pixelData = tempCtx.getImageData(0, 0, 1, 1).data;

        return `rgb(${pixelData[0]}, ${pixelData[1]}, ${pixelData[2]})`;
    }

    /**
     * Convert inches to feet and inches display
     */
    inchesToFeetInches(inches) {
        const feet = Math.floor(inches / 12);
        const remainingInches = Math.round(inches % 12);
        return `${feet}'${remainingInches}"`;
    }

    /**
     * Main render function
     */
    async render(characters) {
        if (!this.canvas || !this.ctx) {
            throw new Error('Renderer not initialized');
        }

        const layout = await this.calculateLayout(characters);
        this.lastLayout = layout; // Store for subclasses to access

        // Set canvas size
        this.canvas.width = layout.width;
        this.canvas.height = layout.height;

        // Clear canvas with background color
        this.ctx.fillStyle = this.options.backgroundColor;
        this.ctx.fillRect(0, 0, layout.width, layout.height);

        // Draw grid
        this.drawGrid(layout);

        // Draw characters
        let xOffset = 0;

        for (let i = 0; i < characters.length; i++) {
            const char = layout.metrics.characters[i];
            const dimensions = layout.characterDimensions[i];

            // Apply color tint if specified
            let characterImage = dimensions.image;
            if (char.color) {
                characterImage = this.applyColorTint(characterImage, char.color);
            }

            // Calculate y position
            const yOffset = this.options.size - dimensions.height;

            // Draw character image
            this.ctx.drawImage(characterImage, xOffset, yOffset, dimensions.width, dimensions.height);

            // Draw character text
            const textX = xOffset + Math.floor(1.1 * dimensions.width);
            const textY = yOffset + Math.floor(0.1 * dimensions.height);
            const dominantColor = this.getDominantColor(characterImage);

            // Draw height indicator line if measuring to ears
            if (this.options.measureToEars && char.ears_offset) {
                const heightLineY = this.options.size - Math.floor((char.adjustedHeight / layout.metrics.renderHeight) * this.options.size);
                this.drawDottedLine(xOffset, xOffset + dimensions.width, heightLineY, dominantColor);
            }

            this.ctx.fillStyle = dominantColor;
            this.ctx.font = `${layout.fontSize}px ${this.options.fontFamily}`;

            // Character name
            this.ctx.fillText(char.name, textX, textY - (layout.fontSize + 5));

            // Height and species info
            const heightText = this.inchesToFeetInches(char.adjustedHeight);
            const speciesText = char.species.replace('_', ' ');
            const fullText = `${heightText}\n${speciesText}`;

            // Draw multi-line text
            const lines = fullText.split('\n');
            lines.forEach((line, lineIndex) => {
                this.ctx.fillText(line, textX, textY + (lineIndex * (layout.fontSize + 2)));
            });

            xOffset += dimensions.width + layout.charPadding;
        }

        return this.canvas;
    }

    /**
     * Export canvas as blob (client-side only)
     */
    async exportAsBlob(type = 'image/png', quality = 0.92) {
        if (!this.isClientSide) {
            throw new Error('exportAsBlob only available client-side');
        }

        return new Promise(resolve => {
            this.canvas.toBlob(resolve, type, quality);
        });
    }

    /**
     * Export canvas as data URL (client-side only)
     */
    exportAsDataURL(type = 'image/png', quality = 0.92) {
        if (!this.isClientSide) {
            throw new Error('exportAsDataURL only available client-side');
        }

        return this.canvas.toDataURL(type, quality);
    }
}

// Export for both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UniversalRenderer;
} else if (typeof window !== 'undefined') {
    window.UniversalRenderer = UniversalRenderer;
}