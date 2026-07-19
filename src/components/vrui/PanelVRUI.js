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

function isInsideRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
}

function createOffscreenHost() {
  const host = document.createElement('div')
  host.className = 'vrui-offscreen-host'
  document.body.appendChild(host)
  return host
}

function createPanelDOM() {
  const template = document.createElement('template')
  template.innerHTML = panelVRUIHtml.trim()
  const root = template.content.firstElementChild
  if (!root) {
    throw new Error('PanelVRUI template is empty')
  }
  return root
}

function ensureHtmlInCanvasAPIs() {
  if (polyfillInstalled) return
  installHtmlInCanvasPolyfill({ force: true })
  polyfillInstalled = true
}

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

  // buttonElements must be declared before any function that references it
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

  function setButtonHoverState(buttonId, isHovered) {
    buttonElements[buttonId]?.classList.toggle('vrui-hovered', isHovered)
  }

  function updateToggleButtonLabel() {
    toggleButton.textContent = sceneStore.isAnimating ? 'PAUSE ANIMATION' : 'RESUME ANIMATION'
  }

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

  function requestPanelPaint() {
    fpsText.textContent = `${state.fps} FPS`
    updateToggleButtonLabel()
    flipCheckbox.classList.toggle('vrui-checked', !!getStereoFlipState?.())
    BUTTON_IDS.forEach((buttonId) => {
      setButtonHoverState(buttonId, state.hoveredButtonId === buttonId)
    })

    needsRender = true
  }

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

  function buttonIdFromUV(uv) {
    if (!uv) return null
    const x = uv.x * CANVAS_SIZE
    const y = (1 - uv.y) * CANVAS_SIZE
    for (const buttonId of BUTTON_IDS) {
      if (isInsideRect(x, y, BUTTON_RECTS[buttonId])) return buttonId
    }
    return null
  }

  function onToggleClick() {
    sceneStore.toggleAnimation()
    requestPanelPaint()
  }

  function onResetClick() {
    onResetObjects?.()
    requestPanelPaint()
  }

  function onFlipEyesClick() {
    onToggleStereoFlip?.()
    requestPanelPaint()
  }

  toggleButton.addEventListener('click', onToggleClick)
  resetButton.addEventListener('click', onResetClick)
  flipRowButton.addEventListener('click', onFlipEyesClick)

  function onSelect(intersection) {
    const buttonId = buttonIdFromUV(intersection?.uv)
    buttonElements[buttonId]?.click()
  }

  function onHover(intersection) {
    const hoveredButtonId = buttonIdFromUV(intersection?.uv)
    if (hoveredButtonId === state.hoveredButtonId) return
    state.hoveredButtonId = hoveredButtonId
    requestPanelPaint()
  }

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

  function setFPS(nextFPS) {
    if (nextFPS === state.fps) return
    state.fps = nextFPS
    requestPanelPaint()
  }

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