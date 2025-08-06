# Universal Renderer for Size Diff Calculator

This project now includes a universal renderer that can work both client-side (in the browser) and server-side (in Node.js), allowing for consistent rendering logic and improved performance.

## Features

### Client-Side Interactive Renderer
- **Real-time rendering** without server round trips
- **Drag and drop** character reordering
- **Click to edit** character properties (color, name, height)
- **Live preview** of changes
- **Export** as PNG or shareable URL

### Server-Side Universal Renderer (Optional)
- **Consistent rendering** between client and server
- **Performance benefits** for high-traffic scenarios
- **Fallback support** - gracefully falls back to Python PIL if Node.js isn't available

## Setup

### Basic Setup (Client-side only)
The interactive renderer works out of the box with no additional setup. Just visit `/interactive-demo` in your browser.

### Advanced Setup (Universal rendering)
For server-side rendering support:

1. **Install Node.js** (version 14 or higher)
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Test the server-side renderer**:
   ```bash
   node app/static/js/server-renderer.js test-input.json
   ```

### Using the Hybrid Endpoint

The hybrid endpoint `/generate-image-hybrid` automatically:
1. Tries to use the JavaScript renderer (if Node.js and canvas are available)
2. Falls back to the existing Python PIL renderer
3. Returns the same image format as the original `/generate-image` endpoint

## Architecture

### UniversalRenderer Class
- Core rendering logic shared between environments
- Handles character positioning, scaling, text rendering
- Supports color tinting and height indicators

### InteractiveRenderer Class
- Extends UniversalRenderer with client-side interactivity
- Handles mouse/touch events for drag and drop
- Provides real-time editing capabilities

### Server-Side Adapter
- `js_renderer.py`: Python bridge to Node.js renderer
- `server-renderer.js`: Node.js script using node-canvas
- Graceful fallback to existing PIL renderer

## Usage Examples

### Client-Side Interactive Rendering
```javascript
const renderer = new InteractiveRenderer({
    size: 800,
    measureToEars: true,
    onCharacterSelect: (character, index) => {
        console.log('Selected:', character.name);
    },
    onCharactersReorder: (newOrder) => {
        console.log('New order:', newOrder);
    }
});

await renderer.initialize(canvasElement);
await renderer.updateCharacters([
    {
        name: "Vixi",
        species: "red_fox", 
        gender: "female",
        height: 66,
        // ... other properties
    }
]);
```

### Server-Side Rendering
```python
from app.utils.js_renderer import render_with_js_fallback

characters = [
    {
        'name': 'Vixi',
        'species': 'red_fox',
        'gender': 'female', 
        'height': 66,
        # ... other properties
    }
]

options = {
    'size': 800,
    'measureToEars': True,
    'useSpeciesScaling': False
}

image = render_with_js_fallback(characters, options)
```

## Benefits

### Performance
- **Client-side**: No server requests for interactive changes
- **Server-side**: Consistent rendering logic, potential for caching
- **Hybrid**: Best of both worlds with graceful fallback

### User Experience
- **Immediate feedback** for character edits
- **Intuitive drag and drop** reordering
- **Visual feedback** with hover states and selection highlights

### Maintainability
- **Single source of truth** for rendering logic
- **Consistent output** between environments
- **Easy to extend** with new features

## File Structure

```
app/
├── static/js/
│   ├── universal-renderer.js    # Core renderer logic
│   ├── interactive-renderer.js  # Client-side interactivity
│   └── server-renderer.js       # Node.js server-side adapter
├── templates/
│   └── interactive_demo.html    # Demo page
└── utils/
    └── js_renderer.py          # Python bridge to Node.js
```

## Troubleshooting

### Node.js Issues
- Ensure Node.js 14+ is installed
- Install canvas dependencies: `npm install canvas`
- On Linux, you may need: `sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`

### Canvas Issues
- The renderer will automatically fall back to PIL if canvas is unavailable
- Check browser console for JavaScript errors
- Ensure images are accessible from the web server

### Image Loading
- Character images must be in `app/species_data/`
- Missing images will automatically fall back to `missing.png`
- Check file permissions and paths

## Future Enhancements

- **Advanced color controls** (HSV sliders, palette selection)
- **Text positioning** (drag text labels around)
- **Export options** (different formats, sizes)
- **Animation support** (pose variations, expressions)
- **Collaborative editing** (real-time multi-user editing)