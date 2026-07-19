<template>
  <div class="panel-wrapper" :class="{ closed: !isPanelOpen }">
    <!-- Slide toggle tab -->
    <button class="panel-tab" @click="isPanelOpen = !isPanelOpen" :title="isPanelOpen ? 'Hide panel' : 'Show panel'">
      <span class="tab-arrow" :class="{ flipped: !isPanelOpen }">&#8250;</span>
    </button>

    <div class="ui-panel">
      <h1>Three.js + Vue 3</h1>

      <div class="stats">
        <div class="stat-item">
          <span class="label">Objects:</span>
          <span class="value">{{ objectCount }}</span>
        </div>
        <div class="stat-item">
          <span class="label">FPS:</span>
          <span class="value">{{ fps }}</span>
        </div>
      </div>

      <div class="controls">
        <button class="ctrl-btn" @click="toggleAnimation" :class="{ active: isAnimating }">
          {{ isAnimating ? '⏸ Pause' : '▶ Play' }}
        </button>

        <button class="ctrl-btn" @click="resetScene">
          🔄 Reset
        </button>

        <button class="ctrl-btn" @click="toggleFullscreen">
          ⛶ Fullscreen
        </button>
      </div>

      <!-- Sky Shader Controls (collapsible) -->
      <div class="sky-controls" :class="{ collapsed: !isSkyOpen }">
        <button class="section-header" @click="isSkyOpen = !isSkyOpen">
          <span>Sky Shader</span>
          <span class="chevron" :class="{ open: isSkyOpen }">&#8250;</span>
        </button>

        <div class="sky-body">
          <div v-for="slider in SKY_SLIDERS" :key="slider.key" class="control-group">
            <label>
              <span class="label-text">{{ slider.label }}</span>
              <span class="value-text">
                {{ sceneStore.skyParams[slider.key].toFixed(slider.decimals) }}{{ slider.unit ?? '' }}
              </span>
            </label>
            <input
              type="range"
              :value="sceneStore.skyParams[slider.key]"
              @input="sceneStore.updateSkyParam(slider.key, parseFloat($event.target.value))"
              :min="slider.min"
              :max="slider.max"
              :step="slider.step"
            />
          </div>

          <div class="control-group checkbox">
            <label>
              <input
                type="checkbox"
                :checked="sceneStore.skyParams.showSunDisc"
                @change="sceneStore.updateSkyParam('showSunDisc', $event.target.checked)"
              />
              <span class="label-text">Show Sun Disc</span>
            </label>
          </div>
        </div>
      </div>

      <div class="info">
        <h3>Features</h3>
        <ul>
          <li>✓ Three.js Integration</li>
          <li>✓ Vue 3 Composition API</li>
          <li>✓ Pinia State Management</li>
          <li>✓ Responsive Design</li>
          <li>✓ Orbit Controls</li>
          <li>✓ Sky Shader</li>
          <li>✓ WebXR / VR (Quest 3)</li>
        </ul>
      </div>

      <div class="footer">
        <p>Performance Optimized</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSceneStore } from '../stores/sceneStore'

const sceneStore = useSceneStore()
const fps = ref(0)
const isPanelOpen = ref(true)
const isSkyOpen = ref(true)

const isAnimating = computed(() => sceneStore.isAnimating)
const objectCount = computed(() => sceneStore.objectCount)

const SKY_SLIDERS = [
  { key: 'rayleigh',        label: 'Rayleigh',          min: 0,   max: 4,   step: 0.1,   decimals: 2 },
  { key: 'mieCoefficient',  label: 'Mie Coefficient',   min: 0,   max: 0.1, step: 0.001, decimals: 4 },
  { key: 'mieDirectionalG', label: 'Mie Directional G', min: 0,   max: 1,   step: 0.01,  decimals: 2 },
  { key: 'cloudCoverage',   label: 'Cloud Coverage',    min: 0,   max: 1,   step: 0.05,  decimals: 2 },
  { key: 'cloudDensity',    label: 'Cloud Density',     min: 0,   max: 3,   step: 0.1,   decimals: 2 },
  { key: 'cloudElevation',  label: 'Cloud Elevation',   min: 0,   max: 10,  step: 0.5,   decimals: 1 },
  { key: 'azimuth',         label: 'Azimuth',           min: 0,   max: 360, step: 5,     decimals: 0, unit: '°' },
  { key: 'elevation',       label: 'Elevation',         min: -10, max: 90,  step: 1,     decimals: 0, unit: '°' },
  { key: 'exposure',        label: 'Exposure',          min: 0,   max: 2,   step: 0.05,  decimals: 2 },
]

// Real FPS via requestAnimationFrame
let rafId, intervalId
let frameCount = 0
let lastTime = performance.now()

function countFrame() {
  frameCount++
  rafId = requestAnimationFrame(countFrame)
}

onMounted(() => {
  rafId = requestAnimationFrame(countFrame)
  intervalId = setInterval(() => {
    const now = performance.now()
    fps.value = Math.round(frameCount * 1000 / (now - lastTime))
    frameCount = 0
    lastTime = now
  }, 1000)
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
  clearInterval(intervalId)
})

function toggleAnimation() {
  sceneStore.toggleAnimation()
}

function resetScene() {
  sceneStore.reset()
  location.reload()
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
  } else {
    document.exitFullscreen?.()
  }
}
</script>

<style scoped>
/* ── Panel wrapper & slide animation ── */
.panel-wrapper {
  position: fixed;
  top: 0;
  right: 0;
  height: 100%;
  display: flex;
  align-items: stretch;
  transform: translateX(0);
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 100;
}

.panel-wrapper.closed {
  transform: translateX(320px);
}

/* ── Toggle tab ── */
.panel-tab {
  position: absolute;
  left: -36px;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 64px;
  background: rgba(10, 14, 39, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-right: none;
  border-radius: 8px 0 0 8px;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: background 0.2s ease, border-color 0.2s ease;
  backdrop-filter: blur(10px);
}

.panel-tab:hover {
  background: rgba(30, 36, 70, 0.98);
  border-color: rgba(0, 255, 136, 0.4);
  transform: translateY(-50%) scale(1.05);
}

.tab-arrow {
  font-size: 22px;
  line-height: 1;
  color: #00ff88;
  display: inline-block;
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.tab-arrow.flipped {
  transform: rotate(180deg);
}

/* ── Main panel ── */
.ui-panel {
  width: 320px;
  background: rgba(10, 14, 39, 0.95);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
  backdrop-filter: blur(10px);
}

h1 {
  font-size: 20px;
  font-weight: 600;
  background: linear-gradient(135deg, #ff6b6b, #4ecdc4);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

button {
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.3s ease, border-color 0.3s ease;
}

.ctrl-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

.ctrl-btn.active {
  background: linear-gradient(135deg, #ff6b6b, #ff8e8e);
  border-color: #ff6b6b;
  color: #fff;
}

.stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.stat-item {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.label {
  color: rgba(255, 255, 255, 0.6);
}

.value {
  font-weight: 600;
  color: #00ff88;
  font-family: 'Courier New', monospace;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── Collapsible sky section ── */
.sky-controls {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  min-height: 250px;
}

.section-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: transparent;
  border: none;
  border-radius: 0;
  font-size: 13px;
  text-transform: uppercase;
  color: #00ff88;
  letter-spacing: 1px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s ease;
}

.section-header:hover {
  background: rgba(0, 255, 136, 0.07);
}

.chevron {
  font-size: 18px;
  color: #00ff88;
  display: inline-block;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform: rotate(90deg);
}

.chevron.open {
  transform: rotate(-90deg);
}

.sky-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 16px 16px;
  max-height: 280px;
  overflow-y: auto;
  overflow-x: hidden;
  transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1),
              padding 0.35s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.3s ease;
  opacity: 1;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 255, 136, 0.4) transparent;
}

.sky-body::-webkit-scrollbar {
  width: 4px;
}

.sky-body::-webkit-scrollbar-track {
  background: transparent;
}

.sky-body::-webkit-scrollbar-thumb {
  background: rgba(0, 255, 136, 0.4);
  border-radius: 2px;
}

.sky-body::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 255, 136, 0.7);
}

.sky-controls.collapsed .sky-body {
  max-height: 0;
  padding-bottom: 0;
  opacity: 0;
  overflow: hidden;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.control-group label {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}

.label-text {
  color: rgba(255, 255, 255, 0.7);
}

.value-text {
  color: #00ff88;
  font-weight: 600;
  font-family: 'Courier New', monospace;
}

input[type="range"] {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  background: #00ff88;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
}

input[type="range"]::-webkit-slider-thumb:hover {
  width: 14px;
  height: 14px;
  box-shadow: 0 0 8px #00ff88;
}

input[type="range"]::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: #00ff88;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

input[type="range"]::-moz-range-thumb:hover {
  width: 14px;
  height: 14px;
  box-shadow: 0 0 8px #00ff88;
}

.control-group.checkbox label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: #00ff88;
}

.info {
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

h3 {
  font-size: 12px;
  text-transform: uppercase;
  color: #00ff88;
  margin-bottom: 8px;
  letter-spacing: 1px;
}

ul {
  list-style: none;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

li {
  display: flex;
  align-items: center;
  gap: 8px;
}

.footer {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
}
</style>
