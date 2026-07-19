import * as THREE from 'three'
import { getHtmlRenderer, installHtmlInCanvasPolyfill } from 'three-html-render/polyfill'
import panelVRUIHtml from './PanelVRUI.html?raw'
import './PanelVRUI.css'

const CANVAS_SIZE = 1024
const PANEL_WIDTH_METERS = 1
const PANEL_HEIGHT_METERS = 1
let polyfillInstalled = false

const BUTTON_RECTS = {
  toggle: { x: 120, y: 520, width: 784, height: 140 },
  reset: { x: 120, y: 710, width: 784, height: 140 }
}

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

export function createPanelVRUI({ sceneStore, onResetObjects }) {
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
  if (!fpsText || !toggleButton || !resetButton) {
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
    if (buttonId === 'toggle') {
      toggleButton.classList.toggle('vrui-hovered', isHovered)
      return
    }
    if (buttonId === 'reset') {
      resetButton.classList.toggle('vrui-hovered', isHovered)
    }
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
    setButtonHoverState('toggle', state.hoveredButtonId === 'toggle')
    setButtonHoverState('reset', state.hoveredButtonId === 'reset')

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
    if (isInsideRect(x, y, BUTTON_RECTS.toggle)) return 'toggle'
    if (isInsideRect(x, y, BUTTON_RECTS.reset)) return 'reset'
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

  toggleButton.addEventListener('click', onToggleClick)
  resetButton.addEventListener('click', onResetClick)

  function onSelect(intersection) {
    const buttonId = buttonIdFromUV(intersection?.uv)
    if (buttonId === 'toggle') {
      toggleButton.click()
      return
    }
    if (buttonId === 'reset') {
      resetButton.click()
    }
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
