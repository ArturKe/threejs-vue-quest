import * as THREE from 'three'
import { getHtmlRenderer, installHtmlInCanvasPolyfill } from 'three-html-render/polyfill'

let polyfillInstalled = false

function ensureHtmlInCanvasAPIs() {
  if (polyfillInstalled) return
  installHtmlInCanvasPolyfill({ force: true })
  polyfillInstalled = true
}

export class VRUIInterface {
  constructor({ config, html, css }) {
    ensureHtmlInCanvasAPIs()
    this.config = config

    this.host = document.createElement('div')
    this.host.className = 'vrui-offscreen-host'
    document.body.appendChild(this.host)

    if (css) {
      const styleEl = document.createElement('style')
      styleEl.textContent = css
      this.host.appendChild(styleEl)
    }

    this.applyLayoutConfig()

    this.canvas = document.createElement('canvas')
    this.canvas.width = config.canvasSize
    this.canvas.height = config.canvasSize
    this.canvas.className = 'vrui-canvas'
    this.canvas.setAttribute('layoutsubtree', 'true')
    this.canvas.layoutSubtree = true
    this.host.appendChild(this.canvas)

    const template = document.createElement('template')
    template.innerHTML = html.trim()
    this.drawElement = template.content.firstElementChild
    this.canvas.appendChild(this.drawElement)

    this.buttons = {}
    this.drawElement.querySelectorAll('[data-vrui-btn]').forEach(el => {
      this.buttons[el.dataset.vruiBtn] = el
    })

    this.ctx = this.canvas.getContext('2d')
    if (!this.ctx) {
      throw new Error('VRUIInterface requires a 2D canvas context')
    }

    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace

    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      side: THREE.DoubleSide,
      toneMapped: false
    })

    const { panelSizeMeters, panelPositionMeters } = config
    this.geometry = new THREE.PlaneGeometry(panelSizeMeters.width, panelSizeMeters.height)
    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.mesh.position.set(panelPositionMeters.x, panelPositionMeters.y, panelPositionMeters.z)
    this.mesh.renderOrder = 5

    this.needsRender = true
    this.renderInFlight = false
    this.hoveredButtonId = null

    this.setupXRInteraction()
  }

  applyLayoutConfig() {
    const { canvasSize, buttonLayout } = this.config
    const declarations = [`--vrui-canvas-size: ${canvasSize}px;`]

    const buttonIds = Object.keys(buttonLayout || {})
    buttonIds.forEach((buttonId) => {
      const button = buttonLayout[buttonId]
      declarations.push(`--vrui-${buttonId}-x: ${button.x}px;`)
      declarations.push(`--vrui-${buttonId}-y: ${button.y}px;`)
      declarations.push(`--vrui-${buttonId}-width: ${button.width}px;`)
      declarations.push(`--vrui-${buttonId}-height: ${button.height}px;`)
    })

    const styleElement = document.createElement('style')
    const uniqueId = `vrui-layout-${Math.random().toString(36).substring(2, 9)}`
    this.host.classList.add(uniqueId)
    styleElement.textContent = `.${uniqueId} {\n${declarations.join('\n')}\n}`
    this.host.appendChild(styleElement)
  }

  setupXRInteraction() {
    this.mesh.userData.xrUI = {
      onSelect: (intersection) => {
        const buttonId = this.getHitButtonId(intersection?.uv)
        if (buttonId && this.buttons[buttonId]) {
          this.buttons[buttonId].click()
        }
      },
      onHover: (intersection) => {
        const buttonId = this.getHitButtonId(intersection?.uv)
        if (buttonId !== this.hoveredButtonId) {
          if (this.hoveredButtonId && this.buttons[this.hoveredButtonId]) {
            this.buttons[this.hoveredButtonId].classList.remove('vrui-hovered')
          }
          this.hoveredButtonId = buttonId
          if (buttonId && this.buttons[buttonId]) {
            this.buttons[buttonId].classList.add('vrui-hovered')
          }
          this.requestPanelPaint()
        }
      },
      onHoverEnd: () => {
        if (this.hoveredButtonId) {
          if (this.buttons[this.hoveredButtonId]) {
            this.buttons[this.hoveredButtonId].classList.remove('vrui-hovered')
          }
          this.hoveredButtonId = null
          this.requestPanelPaint()
        }
      }
    }
  }

  requestPanelPaint() {
    this.needsRender = true
  }

  async renderHtmlInCanvas() {
    const sourceCanvas = await getHtmlRenderer().update(this.drawElement)

    if (typeof this.ctx.reset === 'function') {
      this.ctx.reset()
    } else {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0)
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    }

    this.ctx.drawImage(sourceCanvas, 0, 0, this.canvas.width, this.canvas.height)
    this.texture.needsUpdate = true
  }

  update() {
    if (!this.needsRender || this.renderInFlight) return
    this.renderInFlight = true
    this.needsRender = false
    this.renderHtmlInCanvas().finally(() => {
      this.renderInFlight = false
      if (this.needsRender) {
        this.update()
      }
    })
  }

  getHitButtonId(uv) {
    if (!uv) return null
    const x = uv.x * this.config.canvasSize
    const y = (1 - uv.y) * this.config.canvasSize
    const buttonLayout = this.config.buttonLayout || {}
    for (const [buttonId, rect] of Object.entries(buttonLayout)) {
      if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
        return buttonId
      }
    }
    return null
  }

  dispose() {
    this.canvas.onpaint = null
    this.geometry.dispose()
    this.material.dispose()
    this.texture.dispose()
    this.host.remove()
  }
}
