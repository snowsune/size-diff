"""
Server-side adapter for the Universal Renderer
This bridges the Python Flask app with the JavaScript renderer for server-side rendering
"""

import json
import os
import subprocess
import tempfile
from PIL import Image
import io

class JSRendererAdapter:
    """
    Adapter to use the JavaScript Universal Renderer from Python
    This allows us to maintain consistent rendering logic between client and server
    """
    
    def __init__(self):
        self.node_script_path = os.path.join(os.path.dirname(__file__), '..', 'static', 'js', 'server-renderer.js')
    
    def render_characters(self, characters, options=None):
        """
        Render characters using the JavaScript renderer via Node.js
        
        Args:
            characters: List of character dictionaries
            options: Rendering options (size, measureToEars, etc.)
        
        Returns:
            PIL Image object
        """
        if options is None:
            options = {}
        
        # Prepare the data to send to Node.js
        render_data = {
            'characters': characters,
            'options': options
        }
        
        try:
            # Create a temporary file for the render data
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
                json.dump(render_data, temp_file)
                temp_file_path = temp_file.name
            
            # Run the Node.js renderer
            result = subprocess.run([
                'node', 
                self.node_script_path, 
                temp_file_path
            ], capture_output=True, text=True, timeout=30)
            
            # Clean up temp file
            os.unlink(temp_file_path)
            
            if result.returncode != 0:
                raise RuntimeError(f"Node.js renderer failed: {result.stderr}")
            
            # The Node.js script outputs base64 encoded image data
            image_data = result.stdout.strip()
            
            # Decode base64 and create PIL Image
            import base64
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))
            
            return image
            
        except subprocess.TimeoutExpired:
            raise RuntimeError("Node.js renderer timed out")
        except Exception as e:
            raise RuntimeError(f"Failed to render with JS renderer: {str(e)}")
    
    def is_available(self):
        """Check if Node.js and the renderer script are available"""
        try:
            # Check if Node.js is available
            result = subprocess.run(['node', '--version'], capture_output=True, timeout=5)
            if result.returncode != 0:
                return False
            
            # Check if the renderer script exists
            return os.path.exists(self.node_script_path)
            
        except (subprocess.TimeoutExpired, FileNotFoundError):
            return False


def render_with_js_fallback(characters, options=None):
    """
    Try to render with JS renderer, fall back to Python PIL renderer if unavailable
    """
    js_adapter = JSRendererAdapter()
    
    if js_adapter.is_available():
        try:
            return js_adapter.render_characters(characters, options)
        except Exception as e:
            print(f"JS renderer failed, falling back to PIL: {e}")
    
    # Fall back to existing PIL renderer
    from app.utils.generate_image import render_image
    
    # Convert character dicts to Character objects if needed
    from app.utils.character import Character
    character_objects = []
    
    for char_data in characters:
        if isinstance(char_data, dict):
            char = Character(
                name=char_data.get('name', 'Unknown'),
                species=char_data.get('species', 'wolf'),
                height=char_data.get('height', 60),
                gender=char_data.get('gender', 'male'),
                feral_height=char_data.get('feral_height', char_data.get('height', 60)),
                image=char_data.get('image', 'missing.png'),
                ears_offset=char_data.get('ears_offset', 0)
            )
            if 'color' in char_data:
                char.color = char_data['color']
            character_objects.append(char)
        else:
            character_objects.append(char_data)
    
    # Use existing PIL renderer
    size = options.get('size', 400) if options else 400
    measure_to_ears = options.get('measureToEars', True) if options else True
    use_species_scaling = options.get('useSpeciesScaling', False) if options else False
    
    return render_image(
        character_objects,
        size,
        measure_to_ears=measure_to_ears,
        use_species_scaling=use_species_scaling
    )