import { VRUIInterface } from '../VRUIInterface'
import panelVRUIHtml from './PanelVRUI.html?raw'
import panelVRUICSS from './PanelVRUI.css?raw'
import { PANEL_VRUI_CONFIG } from './PanelVRUI.config'

export function createPanelVRUI({ sceneStore, onResetObjects, getStereoFlipState, onToggleStereoFlip }) {
  const ui = new VRUIInterface({
    config: PANEL_VRUI_CONFIG,
    html: panelVRUIHtml,
    css: panelVRUICSS
  })

  const fpsText = ui.drawElement.querySelector('[data-vrui-fps]')
  const flipCheckbox = ui.drawElement.querySelector('[data-vrui-flip-box]')

  let fps = 0

  function updateDOM() {
    if (fpsText) fpsText.textContent = `${fps} FPS`
    
    if (ui.buttons.toggle) {
      ui.buttons.toggle.textContent = sceneStore.isAnimating ? 'PAUSE ANIMATION' : 'RESUME ANIMATION'
    }
    
    if (flipCheckbox) {
      flipCheckbox.classList.toggle('vrui-checked', !!getStereoFlipState?.())
    }
    
    ui.requestPanelPaint()
  }

  // Bind UI Interactions
  ui.buttons.toggle?.addEventListener('click', () => {
    sceneStore.toggleAnimation()
    updateDOM()
  })

  ui.buttons.reset?.addEventListener('click', () => {
    onResetObjects?.()
    updateDOM()
  })

  ui.buttons.flip?.addEventListener('click', () => {
    onToggleStereoFlip?.()
    updateDOM()
  })

  updateDOM()

  function setFPS(nextFPS) {
    if (nextFPS === fps) return
    fps = nextFPS
    updateDOM()
  }

  return {
    mesh: ui.mesh,
    update: ui.update.bind(ui),
    setFPS,
    dispose: ui.dispose.bind(ui)
  }
}