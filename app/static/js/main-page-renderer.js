/**
 * Main Page Interactive Renderer
 * Handles the interactive canvas on the main index page
 */

class MainPageRenderer {
    constructor() {
        this.renderer = null;
        this.selectedCharacterIndex = -1;
        this.characters = [];
        this.options = {};
    }

    async init(charactersData, renderOptions) {
        // Set up characters and options from data passed from server
        this.characters = charactersData || [];
        this.options = renderOptions || {
            size: 1200, // Larger default size for better viewport usage
            measureToEars: true,
            useSpeciesScaling: false
        };

        // Initialize renderer
        const canvas = document.getElementById('main-canvas');
        if (canvas && this.characters.length > 0) {
            this.renderer = new InteractiveRenderer({
                size: this.options.size,
                measureToEars: this.options.measureToEars,
                useSpeciesScaling: this.options.useSpeciesScaling,
                onCharacterSelect: this.onCharacterSelect.bind(this),
                onCharactersReorder: this.onCharactersReorder.bind(this),
                onCharacterUpdate: this.onCharacterUpdate.bind(this)
            });

            await this.renderer.initialize(canvas);
            await this.renderer.updateCharacters(this.characters);
            this.updateCharacterList();
            this.setupEventListeners();
        }
    }

    setupEventListeners() {
        // Character property changes
        const nameInput = document.getElementById('main-char-name');
        const heightInput = document.getElementById('main-char-height');
        const colorInput = document.getElementById('main-char-color');
        const removeButton = document.getElementById('main-remove-character');

        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                if (this.selectedCharacterIndex >= 0) {
                    this.renderer.updateCharacterProperty(this.selectedCharacterIndex, 'name', e.target.value);
                    this.updateCharacterList();
                }
            });
        }

        if (heightInput) {
            heightInput.addEventListener('input', (e) => {
                if (this.selectedCharacterIndex >= 0) {
                    const height = parseFloat(e.target.value);
                    this.renderer.updateCharacterProperty(this.selectedCharacterIndex, 'height', height);
                    this.renderer.updateCharacterProperty(this.selectedCharacterIndex, 'feral_height', height);
                    this.updateCharacterList();
                }
            });
        }

        if (colorInput) {
            colorInput.addEventListener('input', (e) => {
                if (this.selectedCharacterIndex >= 0) {
                    const color = e.target.value.substring(1); // Remove # from hex color
                    this.renderer.updateCharacterProperty(this.selectedCharacterIndex, 'color', color);
                }
            });
        }

        if (removeButton) {
            removeButton.addEventListener('click', () => {
                if (this.selectedCharacterIndex >= 0) {
                    this.renderer.removeCharacter(this.selectedCharacterIndex);
                    this.selectedCharacterIndex = -1;
                    this.updateCharacterList();
                    this.updateCharacterProperties();
                }
            });
        }
    }

    onCharacterSelect(character, index) {
        this.selectedCharacterIndex = index;
        this.updateCharacterList();
        this.updateCharacterProperties();
    }

    onCharactersReorder(characters) {
        this.characters = characters;
        this.updateCharacterList();
        if (this.selectedCharacterIndex >= characters.length) {
            this.selectedCharacterIndex = -1;
            this.updateCharacterProperties();
        }
    }

    onCharacterUpdate(character, index) {
        this.updateCharacterList();
    }

    updateCharacterList() {
        const listElement = document.getElementById('main-character-list');
        if (!listElement || !this.renderer) return;

        listElement.innerHTML = '';

        this.renderer.characters.forEach((char, index) => {
            const item = document.createElement('div');
            item.className = 'character-item-main';
            if (index === this.selectedCharacterIndex) {
                item.classList.add('selected');
            }

            item.innerHTML = `
                <strong>${char.name}</strong><br>
                <small>${char.species.replace('_', ' ')} • ${char.height}"</small>
            `;

            item.addEventListener('click', () => {
                this.onCharacterSelect(char, index);
            });

            listElement.appendChild(item);
        });
    }

    updateCharacterProperties() {
        const noSelection = document.getElementById('main-no-selection');
        const properties = document.getElementById('main-character-properties');

        if (this.selectedCharacterIndex >= 0 && this.renderer) {
            const char = this.renderer.characters[this.selectedCharacterIndex];

            if (noSelection) noSelection.style.display = 'none';
            if (properties) properties.classList.add('active');

            const nameInput = document.getElementById('main-char-name');
            const heightInput = document.getElementById('main-char-height');
            const colorInput = document.getElementById('main-char-color');

            if (nameInput) nameInput.value = char.name;
            if (heightInput) heightInput.value = char.height;
            if (colorInput) colorInput.value = char.color ? `#${char.color}` : '#ffffff';
        } else {
            if (noSelection) noSelection.style.display = 'block';
            if (properties) properties.classList.remove('active');
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Get data from the page
    const dataElement = document.getElementById('character-data');
    if (dataElement) {
        try {
            const charactersData = JSON.parse(dataElement.dataset.characters || '[]');
            const renderOptions = JSON.parse(dataElement.dataset.options || '{}');

            const renderer = new MainPageRenderer();
            renderer.init(charactersData, renderOptions);
        } catch (error) {
            console.error('Failed to initialize main page renderer:', error);
        }
    }
});