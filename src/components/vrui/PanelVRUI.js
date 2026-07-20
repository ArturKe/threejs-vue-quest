import * as THREE from 'three'
import { getHtmlRenderer, installHtmlInCanvasPolyfill } from 'three-html-render/polyfill'
import panelVRUIHtml from './PanelVRUI.html?raw'
import './PanelVRUI.css'

const CANVAS_SIZE = 1024
const PANEL_WIDTH_METERS = 1
const PANEL_HEIGHT_METERS = 1
let polyfillInstalled = false

const BUTTON_RECTS = {
  toggle: { x: 120, y: 450, width: 784, height: 130 },
  reset: { x: 120, y: 610, width: 784, height: 130 },
  flip: { x: 120, y: 770, width: 784, height: 130 }
}
const BUTTON_IDS = ['toggle', 'reset', 'flip']

/**
 * Tests whether a point falls inside a canvas-space rectangle.
 */
function isInsideRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
}

/**
 * Creates the hidden host element used to mount the offscreen panel.
 */
function createOffscreenHost() {
  const host = document.createElement('div')
  host.className = 'vrui-offscreen-host'
  document.body.appendChild(host)
  return host
}

/**
 * Parses the panel template into a DOM node that html-in-canvas can render.
 */
function createPanelDOM() {
  const template = document.createElement('template')
  template.innerHTML = panelVRUIHtml.trim()
  const root = template.content.firstElementChild
  if (!root) {
    throw new Error('PanelVRUI template is empty')
  }
  return root
}

/**
 * Installs html-in-canvas support once per page.
 */
function ensureHtmlInCanvasAPIs() {
  if (polyfillInstalled) return
  installHtmlInCanvasPolyfill({ force: true })
  polyfillInstalled = true
}

/**
 * Creates the VR control panel mesh backed by a canvas texture.
 */
export function createPanelVRUI({ sceneStore, onResetObjects, getStereoFlipState, onToggleStereoFlip }) {
  ensureHtmlInCanvasAPIs()
  const host = createOffscreenHost()

  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_SIZE
  canvas.height = CANVAS_SIZE
  canvas.className = 'vrui-canvas'
  canvas.setAttribute('layoutsubtree', 'true')
  canvas.layoutSubtree = true
  host.appendChild(canvas)

  const drawElement = createPanelDOM()
  canvas.appendChild(drawElement)

  const fpsText = drawElement.querySelector('[data-vrui-fps]')
  const toggleButton = drawElement.querySelector('[data-vrui-toggle]')
  const resetButton = drawElement.querySelector('[data-vrui-reset]')
  const flipRowButton = drawElement.querySelector('[data-vrui-flip-row]')
  const flipCheckbox = drawElement.querySelector('[data-vrui-flip-box]')
  if (!fpsText || !toggleButton || !resetButton || !flipRowButton || !flipCheckbox) {
    throw new Error('PanelVRUI template is missing required elements')
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    host.remove()
    throw new Error('PanelVRUI requires a 2D canvas context')
  }
  if (typeof canvas.requestPaint !== 'function' || typeof ctx.drawElementImage !== 'function') {
    host.remove()
    throw new Error('PanelVRUI requires html-in-canvas APIs (requestPaint/drawElementImage)')
  }

  const buttonElements = {
    toggle: toggleButton,
    reset: resetButton,
    flip: flipRowButton
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    toneMapped: false
  })

  const geometry = new THREE.PlaneGeometry(PANEL_WIDTH_METERS, PANEL_HEIGHT_METERS)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(0, 1.6, -1.3)
  mesh.renderOrder = 5

  const state = {
    fps: 0,
    hoveredButtonId: null
  }
  let needsRender = true
  let renderInFlight = false

  /**
   * Toggles the hovered class for a specific control button.
   */
  function setButtonHoverState(buttonId, isHovered) {
    buttonElements[buttonId]?.classList.toggle('vrui-hovered', isHovered)
  }

  /**
   * Updates the visible animation label on the toggle button.
   */
  function updateToggleButtonLabel() {
    toggleButton.textContent = sceneStore.isAnimating ? 'PAUSE ANIMATION' : 'RESUME ANIMATION'
  }

  /**
   * Renders the DOM panel into the canvas texture.
   */
  async function renderHtmlInCanvas() {
    const sourceCanvas = await getHtmlRenderer().update(drawElement)

    if (typeof ctx.reset === 'function') {
      ctx.reset()
    } else {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height)
    texture.needsUpdate = true
  }

  /**
   * Refreshes the panel DOM state and schedules a texture repaint.
   */
  function requestPanelPaint() {
    fpsText.textContent = `${state.fps} FPS`
    updateToggleButtonLabel()
    flipCheckbox.classList.toggle('vrui-checked', !!getStereoFlipState?.())
    BUTTON_IDS.forEach((buttonId) => {
      setButtonHoverState(buttonId, state.hoveredButtonId === buttonId)
    })

    needsRender = true
  }

  /**
   * Repaints the canvas when the panel state is stale.
   */
  function update() {
    if (!needsRender || renderInFlight) return
    renderInFlight = true
    needsRender = false
    renderHtmlInCanvas().finally(() => {
      renderInFlight = false
      if (needsRender) {
        update()
      }
    })
  }

  /**
   * Converts a UV hit into the matching button id.
   */
  function buttonIdFromUV(uv) {
    if (!uv) return null
    const x = uv.x * CANVAS_SIZE
    const y = (1 - uv.y) * CANVAS_SIZE
    for (const buttonId of BUTTON_IDS) {
      if (isInsideRect(x, y, BUTTON_RECTS[buttonId])) return buttonId
    }
    return null
  }

  /**
   * Toggles animation when the main button is clicked.
   */
  function onToggleClick() {
    sceneStore.toggleAnimation()
    requestPanelPaint()
  }

  /**
   * Resets scene objects when the reset button is clicked.
   */
  function onResetClick() {
    onResetObjects?.()
    requestPanelPaint()
  }

  /**
   * Flips the stereo image when the flip button is clicked.
   */
  function onFlipEyesClick() {
    onToggleStereoFlip?.()
    requestPanelPaint()
  }

  toggleButton.addEventListener('click', onToggleClick)
  resetButton.addEventListener('click', onResetClick)
  flipRowButton.addEventListener('click', onFlipEyesClick)

  /**
   * Routes XR select events to the matching button element.
   */
  function onSelect(intersection) {
    const buttonId = buttonIdFromUV(intersection?.uv)
    buttonElements[buttonId]?.click()
  }

  /**
   * Updates the hovered button state for XR pointer movement.
   */
  function onHover(intersection) {
    const hoveredButtonId = buttonIdFromUV(intersection?.uv)
    if (hoveredButtonId === state.hoveredButtonId) return
    state.hoveredButtonId = hoveredButtonId
    requestPanelPaint()
  }

  /**
   * Clears XR hover state when the pointer leaves the panel.
   */
  function onHoverEnd() {
    if (!state.hoveredButtonId) return
    state.hoveredButtonId = null
    requestPanelPaint()
  }

  mesh.userData.xrUI = {
    onSelect,
    onHover,
    onHoverEnd
  }

  requestPanelPaint()

  /**
   * Updates the displayed FPS value without repainting unchanged values.
   */
  function setFPS(nextFPS) {
    if (nextFPS === state.fps) return
    state.fps = nextFPS
    requestPanelPaint()
  }

  /**
   * Disposes textures, DOM nodes, and event listeners.
   */
  function dispose() {
    toggleButton.removeEventListener('click', onToggleClick)
    resetButton.removeEventListener('click', onResetClick)
    flipRowButton.removeEventListener('click', onFlipEyesClick)
    canvas.onpaint = null
    geometry.dispose()
    material.dispose()
    texture.dispose()
    host.remove()
  }

  return {
    mesh,
    update,
    setFPS,
    dispose
  }
}