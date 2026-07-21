const BUTTON_BASE_LAYOUT = {
  x: 120,
  width: 784,
  height: 130
}

const BUTTON_LAYOUT = {
  toggle: {
    ...BUTTON_BASE_LAYOUT,
    y: 450
  },
  reset: {
    ...BUTTON_BASE_LAYOUT,
    y: 610
  },
  flip: {
    ...BUTTON_BASE_LAYOUT,
    y: 770
  }
}

export const PANEL_VRUI_CONFIG = {
  canvasSize: 1024,
  panelSizeMeters: {
    width: 1,
    height: 1
  },
  panelPositionMeters: {
    x: 0,
    y: 1.6,
    z: -1.3
  },
  buttonLayout: BUTTON_LAYOUT
}

export const PANEL_VRUI_BUTTON_IDS = Object.keys(PANEL_VRUI_CONFIG.buttonLayout)

