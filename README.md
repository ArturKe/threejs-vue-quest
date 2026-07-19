# Three.js + Vue 3 Project

A high-performance interactive 3D scene viewer built with Three.js and Vue 3, demonstrating best practices for combining WebGL graphics with modern Vue frameworks.

## Features

✨ **Three.js Integration**
- Interactive 3D objects (cube, sphere, torus)
- Shadow rendering and dynamic lighting
- Optimized WebGL renderer settings
- Stereo side-by-side image viewer for WebXR

🎨 **Vue 3 Architecture**
- Composition API for clean component logic
- Pinia state management
- Responsive UI components
- Smooth animations with requestAnimationFrame

⚡ **Performance Optimized**
- Separated Three.js from Vue reactivity
- Efficient object pooling
- Proper resource cleanup
- Device pixel ratio adaptation

📱 **Responsive Design**
- Automatic canvas resizing
- Mobile-friendly UI panel
- Fullscreen support

## Project Structure

```
src/
├── components/
│   ├── SceneViewer.vue      # Main 3D scene canvas
│   └── UIPanel.vue          # Control panel
├── stores/
│   └── sceneStore.js        # Pinia state management
└── App.vue                  # Root component
public/
└── content/
   └── example-stereo.svg    # Example SBS stereo texture
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

## Build

```bash
npm run build
```

## Key Implementation Details

### Separation of Concerns
- **Three.js Logic**: Isolated in SceneViewer component
- **Vue State**: Managed via Pinia store
- **UI Interactions**: Separated in UIPanel component

### Performance Patterns
1. **requestAnimationFrame** - Native browser animation loop
2. **Object Reuse** - Geometries and materials shared
3. **Efficient Rendering** - Proper camera and renderer setup
4. **Resource Cleanup** - onUnmounted lifecycle cleanup

### Best Practices
- ✓ Separated Three.js from Vue's reactivity system
- ✓ Proper event listener cleanup
- ✓ Optimized WebGL context settings
- ✓ Responsive viewport handling
- ✓ State management with Pinia

## Controls

- **Play/Pause** - Start/stop object rotation
- **Reset** - Reload scene
- **Fullscreen** - Enter fullscreen mode
- **VR Panel Flip Stereo Eyes** - Swap left/right eye texture halves in headset

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Next Steps

To extend this project:

1. Add model loading (GLTF/FBX)
2. Implement mouse controls (orbit camera)
3. Add post-processing effects
4. Create interactive object selection
5. Add animation timeline
6. Implement asset lazy-loading

## License

MIT
