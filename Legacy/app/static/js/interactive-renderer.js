/**
 * Interactive Size Diff Renderer
 * 
 * Extends the UniversalRenderer with client-side interactivity:
 * - Drag and drop character reordering
 * - Click to edit character properties (color, text position)
 * - Real-time updates without server round trips
 */

class InteractiveRenderer extends UniversalRenderer {
    constructor(options = {}) {
        super(options);
        
        this.isInteractive = true;
        this.characters = [];
        this.selectedCharacter = null;
        this.isDragging = false;
        this.dragStartPos = { x: 0, y: 0 };
        this.characterPositions = []; // Track character bounds for interaction
        
        // Event callbacks
        this.onCharacterSelect = options.onCharacterSelect || (() => {});
        this.onCharactersReorder = options.onCharactersReorder || (() => {});
        this.onCharacterUpdate = options.onCharacterUpdate || (() => {});
    }

    async initialize(canvas = null) {
        await super.initialize(canvas);
        
        if (this.isClientSide && this.canvas) {
            this.setupEventListeners();
        }
    }

    setupEventListeners() {
        // Mouse events for interaction
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('click', this.handleClick.bind(this));
        
        // Touch events for mobile
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
        
        // Prevent context menu on right click
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    }

    /**
     * Update characters and re-render
     */
    async updateCharacters(newCharacters) {
        this.characters = [...newCharacters];
        await this.render(this.characters);
    }

    /**
     * Override render to track character positions for interaction
     */
    async render(characters) {
        this.characterPositions = [];
        
        const canvas = await super.render(characters);
        
        // Calculate character hit areas after rendering
        this.calculateCharacterHitAreas(characters);
        
        return canvas;
    }

    /**
     * Calculate clickable areas for each character
     */
    calculateCharacterHitAreas(characters) {
        const layout = this.lastLayout; // Store layout in parent render method
        let xOffset = 0;
        
        this.characterPositions = [];
        
        for (let i = 0; i < characters.length; i++) {
            const dimensions = layout.characterDimensions[i];
            const yOffset = this.options.size - dimensions.height;
            
            this.characterPositions.push({
                index: i,
                character: characters[i],
                bounds: {
                    left: xOffset,
                    top: yOffset,
                    right: xOffset + dimensions.width,
                    bottom: yOffset + dimensions.height,
                    width: dimensions.width,
                    height: dimensions.height
                }
            });
            
            xOffset += dimensions.width + layout.charPadding;
        }
    }

    /**
     * Get character at mouse position
     */
    getCharacterAtPosition(x, y) {
        return this.characterPositions.find(pos => 
            x >= pos.bounds.left && 
            x <= pos.bounds.right && 
            y >= pos.bounds.top && 
            y <= pos.bounds.bottom
        );
    }

    /**
     * Get mouse position relative to canvas
     */
    getMousePosition(event) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (event.clientX - rect.left) * (this.canvas.width / rect.width),
            y: (event.clientY - rect.top) * (this.canvas.height / rect.height)
        };
    }

    handleMouseDown(event) {
        const pos = this.getMousePosition(event);
        const character = this.getCharacterAtPosition(pos.x, pos.y);
        
        if (character) {
            this.selectedCharacter = character;
            this.isDragging = true;
            this.dragStartPos = pos;
            this.canvas.style.cursor = 'grabbing';
        }
    }

    handleMouseMove(event) {
        const pos = this.getMousePosition(event);
        
        if (this.isDragging && this.selectedCharacter) {
            // Visual feedback for dragging
            this.canvas.style.cursor = 'grabbing';
            
            // Could add visual drag preview here
            
        } else {
            // Update cursor based on hover
            const character = this.getCharacterAtPosition(pos.x, pos.y);
            this.canvas.style.cursor = character ? 'grab' : 'default';
        }
    }

    handleMouseUp(event) {
        if (this.isDragging && this.selectedCharacter) {
            const pos = this.getMousePosition(event);
            this.handleDrop(pos);
        }
        
        this.isDragging = false;
        this.selectedCharacter = null;
        this.canvas.style.cursor = 'default';
    }

    handleClick(event) {
        const pos = this.getMousePosition(event);
        const character = this.getCharacterAtPosition(pos.x, pos.y);
        
        if (character) {
            this.onCharacterSelect(character.character, character.index);
        }
    }

    handleDrop(dropPos) {
        if (!this.selectedCharacter) return;
        
        // Find which character position we're dropping onto
        const targetCharacter = this.getCharacterAtPosition(dropPos.x, dropPos.y);
        
        if (targetCharacter && targetCharacter.index !== this.selectedCharacter.index) {
            // Reorder characters
            const newCharacters = [...this.characters];
            const [movedChar] = newCharacters.splice(this.selectedCharacter.index, 1);
            newCharacters.splice(targetCharacter.index, 0, movedChar);
            
            this.characters = newCharacters;
            this.onCharactersReorder(newCharacters);
            
            // Re-render with new order
            this.render(this.characters);
        }
    }

    // Touch event handlers (delegate to mouse handlers)
    handleTouchStart(event) {
        event.preventDefault();
        const touch = event.touches[0];
        this.handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
    }

    handleTouchMove(event) {
        event.preventDefault();
        const touch = event.touches[0];
        this.handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    }

    handleTouchEnd(event) {
        event.preventDefault();
        if (event.changedTouches.length > 0) {
            const touch = event.changedTouches[0];
            this.handleMouseUp({ clientX: touch.clientX, clientY: touch.clientY });
        }
    }

    /**
     * Highlight a specific character
     */
    highlightCharacter(index) {
        if (!this.characterPositions[index]) return;
        
        const pos = this.characterPositions[index];
        
        // Draw highlight overlay
        this.ctx.save();
        this.ctx.strokeStyle = '#4CAF50';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(
            pos.bounds.left - 2, 
            pos.bounds.top - 2, 
            pos.bounds.width + 4, 
            pos.bounds.height + 4
        );
        this.ctx.restore();
    }

    /**
     * Update a specific character property and re-render
     */
    async updateCharacterProperty(index, property, value) {
        if (index >= 0 && index < this.characters.length) {
            this.characters[index] = {
                ...this.characters[index],
                [property]: value
            };
            
            await this.render(this.characters);
            this.onCharacterUpdate(this.characters[index], index);
        }
    }

    /**
     * Add a new character
     */
    async addCharacter(character) {
        this.characters.push(character);
        await this.render(this.characters);
        this.onCharacterUpdate(character, this.characters.length - 1);
    }

    /**
     * Remove a character
     */
    async removeCharacter(index) {
        if (index >= 0 && index < this.characters.length) {
            const removed = this.characters.splice(index, 1)[0];
            await this.render(this.characters);
            this.onCharactersReorder(this.characters);
            return removed;
        }
    }

    /**
     * Export current state as URL parameters (for sharing)
     */
    exportAsURLParams() {
        const charactersQuery = this.characters.map(char => 
            `${char.species},${char.gender},${char.height},${char.name}`
        ).join('|');
        
        const params = new URLSearchParams();
        params.set('characters', charactersQuery);
        params.set('measure_ears', this.options.measureToEars);
        params.set('scale_height', this.options.useSpeciesScaling);
        params.set('size', this.options.size);
        
        return params.toString();
    }

    /**
     * Load state from URL parameters
     */
    loadFromURLParams(urlParams) {
        const params = new URLSearchParams(urlParams);
        
        // Update options
        this.options.measureToEars = params.get('measure_ears') !== 'false';
        this.options.useSpeciesScaling = params.get('scale_height') === 'true';
        this.options.size = parseInt(params.get('size')) || 400;
        
        // Parse characters
        const charactersParam = params.get('characters');
        if (charactersParam) {
            this.characters = charactersParam.split('|').map(charStr => {
                const [species, gender, height, name] = charStr.split(',');
                return {
                    species,
                    gender,
                    height: parseFloat(height),
                    name,
                    feral_height: parseFloat(height), // Default to same as height
                    image: `${species}_${gender}.png`, // Construct image filename
                    ears_offset: 0, // Default
                    color: null // Default
                };
            });
        }
    }
}

// Export for browser use
if (typeof window !== 'undefined') {
    window.InteractiveRenderer = InteractiveRenderer;
}