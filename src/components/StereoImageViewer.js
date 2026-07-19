import * as THREE from 'three'

const LEFT_EYE_LAYER = 1
const RIGHT_EYE_LAYER = 2

function createFallbackStereoTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 2048
  canvas.height = 1024
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Unable to create fallback stereo texture')
  }

  ctx.fillStyle = '#12263a'
  ctx.fillRect(0, 0, 1024, 1024)
  ctx.fillStyle = '#61dafb'
  ctx.font = 'bold 100px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('LEFT', 512, 430)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(360, 520, 304, 180)

  ctx.fillStyle = '#2b2d42'
  ctx.fillRect(1024, 0, 1024, 1024)
  ctx.fillStyle = '#ff6b6b'
  ctx.font = 'bold 100px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('RIGHT', 1536, 430)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(1384, 520, 304, 180)

  return new THREE.CanvasTexture(canvas)
}

function disposeTexture(texture) {
  if (texture) texture.dispose()
}

export function createStereoImageViewer({
  scene,
  renderer,
  textureUrl,
  position = new THREE.Vector3(-1.2, 1.6, -1.3),
  panelWidth = 1,
  panelHeight = 1,
  initialFlipped = false
}) {
  const group = new THREE.Group()
  group.position.copy(position)

  let isFlipped = initialFlipped
  let baseTexture = null
  let leftTexture = null
  let rightTexture = null
  let geometry = null
  let leftMaterial = null
  let rightMaterial = null
  let monoMaterial = null
  let leftMesh = null
  let rightMesh = null
  let monoMesh = null
  let onSessionStart = null
  let onSessionEnd = null

  function updateTextureOffsets() {
    if (!leftTexture || !rightTexture) return

    leftTexture.repeat.set(0.5, 1)
    rightTexture.repeat.set(0.5, 1)

    if (isFlipped) {
      leftTexture.offset.set(0.5, 0)
      rightTexture.offset.set(0, 0)
    } else {
      leftTexture.offset.set(0, 0)
      rightTexture.offset.set(0.5, 0)
    }

    leftTexture.needsUpdate = true
    rightTexture.needsUpdate = true
  }

  function disposeMeshes() {
    if (leftMesh) group.remove(leftMesh)
    if (rightMesh) group.remove(rightMesh)
    if (monoMesh) group.remove(monoMesh)
    leftMesh = null
    rightMesh = null
    monoMesh = null

    if (leftMaterial) leftMaterial.dispose()
    if (rightMaterial) rightMaterial.dispose()
    if (monoMaterial) monoMaterial.dispose()
    leftMaterial = null
    rightMaterial = null
    monoMaterial = null

    if (geometry) geometry.dispose()
    geometry = null
  }

  function setVrVisibilityHandlers() {
    if (!renderer?.xr || !monoMesh) return
    onSessionStart = () => { monoMesh.visible = false }
    onSessionEnd = () => { monoMesh.visible = true }
    renderer.xr.addEventListener('sessionstart', onSessionStart)
    renderer.xr.addEventListener('sessionend', onSessionEnd)
  }

  function removeVrVisibilityHandlers() {
    if (!renderer?.xr) return
    if (onSessionStart) renderer.xr.removeEventListener('sessionstart', onSessionStart)
    if (onSessionEnd) renderer.xr.removeEventListener('sessionend', onSessionEnd)
    onSessionStart = null
    onSessionEnd = null
  }

  function applyBaseTexture(nextBaseTexture) {
    disposeMeshes()
    disposeTexture(leftTexture)
    disposeTexture(rightTexture)
    disposeTexture(baseTexture)

    baseTexture = nextBaseTexture
    baseTexture.colorSpace = THREE.SRGBColorSpace
    leftTexture = baseTexture.clone()
    rightTexture = baseTexture.clone()
    updateTextureOffsets()

    geometry = new THREE.PlaneGeometry(panelWidth, panelHeight)
    leftMaterial = new THREE.MeshBasicMaterial({ map: leftTexture, toneMapped: false })
    rightMaterial = new THREE.MeshBasicMaterial({ map: rightTexture, toneMapped: false })
    monoMaterial = new THREE.MeshBasicMaterial({ map: leftTexture, toneMapped: false })

    leftMesh = new THREE.Mesh(geometry, leftMaterial)
    rightMesh = new THREE.Mesh(geometry, rightMaterial)
    monoMesh = new THREE.Mesh(geometry, monoMaterial)

    leftMesh.layers.set(LEFT_EYE_LAYER)
    rightMesh.layers.set(RIGHT_EYE_LAYER)
    monoMesh.layers.set(0)

    group.add(leftMesh)
    group.add(rightMesh)
    group.add(monoMesh)

    removeVrVisibilityHandlers()
    setVrVisibilityHandlers()
  }

  const textureLoader = new THREE.TextureLoader()
  textureLoader.load(
    textureUrl,
    (loadedTexture) => applyBaseTexture(loadedTexture),
    undefined,
    () => applyBaseTexture(createFallbackStereoTexture())
  )

  scene.add(group)

  function setFlipped(nextIsFlipped) {
    isFlipped = !!nextIsFlipped
    updateTextureOffsets()
  }

  function getFlipped() {
    return isFlipped
  }

  function dispose() {
    removeVrVisibilityHandlers()
    scene.remove(group)
    disposeMeshes()
    disposeTexture(leftTexture)
    disposeTexture(rightTexture)
    disposeTexture(baseTexture)
    leftTexture = null
    rightTexture = null
    baseTexture = null
  }

  return {
    group,
    setFlipped,
    getFlipped,
    dispose
  }
}
