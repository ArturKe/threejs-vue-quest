<template>
  <div ref="containerRef" class="scene-container" />
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'
import { useSceneStore } from '../stores/sceneStore'
import { applySkyUniforms, setupEnvironment } from './EnvironmentSetup'
import { createControllerVRXR } from './vrcontroller/ControllerVRXR'
import { createPanelVRUI } from './vrui/PanelVRUI'
import { createStereoImageViewer } from './StereoImageViewer'

const containerRef = ref(null)
const sceneStore = useSceneStore()

let scene, camera, renderer, orbitControls, skyMesh, floorMesh, vrButton, controllerVRXR, panelVRUI, stereoImageViewer, playerRig
let objects = []
let objectMeshes = []  // cached flat array – avoids per-frame .map() in hot path
let interactableMeshes = []
let fpsSampleFrameCount = 0
let fpsSampleStartTime = 0
const desktopCameraPosition = new THREE.Vector3(0, 8, 15)

const SCENE_OBJECT_DEFINITIONS = [
  {
    createGeometry: () => new THREE.BoxGeometry(2, 2, 2),
    material: { color: 0xff6b6b, metalness: 0.5, roughness: 0.5 },
    position: [-5, 2, 0],
    rotation: { x: 0.01, y: 0.01, z: 0 }
  },
  {
    createGeometry: () => new THREE.IcosahedronGeometry(1, 32),
    material: { color: 0x4ecdc4, metalness: 0.7, roughness: 0.2 },
    position: [5, 2, 0],
    rotation: { x: 0.005, y: 0.02, z: 0.01 }
  },
  {
    createGeometry: () => new THREE.TorusGeometry(1, 0.8, 64, 100),
    material: { color: 0xffd93d, metalness: 0.3, roughness: 0.7 },
    position: [0, 2, -8],
    rotation: { x: 0.01, y: 0.008, z: 0 }
  }
]

/**
 * Builds the Three.js scene and wires the VR helpers on mount.
 */
onMounted(() => {
  initScene()
  const environment = setupEnvironment(scene, sceneStore.skyParams)
  skyMesh = environment.skyMesh
  floorMesh = environment.floor
  createGrid()
  createObjects()

  stereoImageViewer = createStereoImageViewer({
    scene,
    renderer,
    textureUrl: '/content/example-stereo.png',
    position: new THREE.Vector3(-1.2, 1.6, -1.3),
    panelWidth: 1,
    panelHeight: 1
  })

  // PanelVRUI requires Quest-specific html-in-canvas APIs; guard so the
  // scene still renders on desktop when those APIs are unavailable.
  try {
    panelVRUI = createPanelVRUI({
      sceneStore,
      onResetObjects: resetObjects,
      getStereoFlipState: () => stereoImageViewer?.getFlipped() ?? false,
      onToggleStereoFlip: () => {
        const nextFlipState = !(stereoImageViewer?.getFlipped() ?? false)
        stereoImageViewer?.setFlipped(nextFlipState)
      }
    })
    scene.add(panelVRUI.mesh)
    interactableMeshes = [...objectMeshes, panelVRUI.mesh]
  } catch {
    interactableMeshes = [...objectMeshes]
  }

  controllerVRXR = createControllerVRXR(renderer, scene, playerRig, floorMesh, () => interactableMeshes)
  controllerVRXR.setup()
  handleResize()
})

/**
 * Tears down rendering resources and XR helpers on unmount.
 */
onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  renderer?.setAnimationLoop(null)
  controllerVRXR?.dispose()
  if (panelVRUI?.mesh) {
    scene.remove(panelVRUI.mesh)
  }
  stereoImageViewer?.dispose()
  panelVRUI?.dispose()
  if (renderer && renderer.domElement.parentNode === containerRef.value) {
    containerRef.value.removeChild(renderer.domElement)
  }
  if (vrButton && vrButton.parentNode) {
    vrButton.parentNode.removeChild(vrButton)
  }
  renderer?.dispose()
  orbitControls?.dispose()
})

watch(() => sceneStore.skyParams, (newParams) => {
  if (skyMesh?.material.uniforms) {
    applySkyUniforms(skyMesh.material.uniforms, newParams)
  }
}, { deep: true })

/**
 * Creates the scene, camera, renderer, and desktop/XR controls.
 */
function initScene() {
  scene = new THREE.Scene()
  playerRig = new THREE.Group()
  scene.add(playerRig)

  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight
  camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 2000)
  camera.position.set(0, 8, 15)
  camera.lookAt(0, 0, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.LinearToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.xr.enabled = true
  containerRef.value.appendChild(renderer.domElement)

  vrButton = VRButton.createButton(renderer, {
    optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'layers']
  })
  document.body.appendChild(vrButton)

  orbitControls = new OrbitControls(camera, renderer.domElement)
  orbitControls.enableDamping = true
  orbitControls.dampingFactor = 0.05
  orbitControls.autoRotate = false
  orbitControls.autoRotateSpeed = 2
  orbitControls.minDistance = 5
  orbitControls.maxDistance = 100

  renderer.xr.addEventListener('sessionstart', () => {
    orbitControls.enabled = false
    playerRig.attach(camera)
    camera.position.set(0, 0, 0)
    camera.rotation.set(0, 0, 0)
  })
  renderer.xr.addEventListener('sessionend', () => {
    orbitControls.enabled = true
    scene.attach(camera)
    camera.position.copy(desktopCameraPosition)
    camera.lookAt(0, 0, 0)
    playerRig.position.set(0, 0, 0)
  })

  fpsSampleStartTime = performance.now()
  renderer.setAnimationLoop(animate)
  window.addEventListener('resize', handleResize)
}

/**
 * Adds the ground grid to the scene.
 */
function createGrid() {
  const gridHelper = new THREE.GridHelper(20, 20, 0x00ff88, 0x444444)
  gridHelper.position.y = 0.01
  scene.add(gridHelper)
}

/**
 * Creates the sample meshes and caches their reset state.
 */
function createObjects() {
  objects = SCENE_OBJECT_DEFINITIONS.map((def) => {
    const mesh = new THREE.Mesh(
      def.createGeometry(),
      new THREE.MeshStandardMaterial(def.material)
    )
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.position.set(...def.position)
    scene.add(mesh)
    return {
      mesh,
      rotation: def.rotation,
      initialState: {
        position: mesh.position.clone(),
        rotation: mesh.rotation.clone()
      }
    }
  })

  sceneStore.setObjectCount(objects.length)
  objectMeshes = objects.map(o => o.mesh)
  interactableMeshes = [...objectMeshes]
}

/**
 * Restores all sample meshes to their initial transforms.
 */
function resetObjects() {
  objects.forEach(({ mesh, initialState }) => {
    mesh.position.copy(initialState.position)
    mesh.rotation.copy(initialState.rotation)
  })
}

/**
 * Advances controls, updates XR helpers, and renders each frame.
 */
function animate() {
  orbitControls.update()
  controllerVRXR?.update()
  panelVRUI?.update()

  fpsSampleFrameCount += 1
  const now = performance.now()
  if (now - fpsSampleStartTime >= 500) {
    const fps = Math.round((fpsSampleFrameCount * 1000) / (now - fpsSampleStartTime))
    panelVRUI?.setFPS(fps)
    fpsSampleFrameCount = 0
    fpsSampleStartTime = now
  }

  if (sceneStore.isAnimating) {
    objects.forEach(({ mesh, rotation }) => {
      mesh.rotation.x += rotation.x
      mesh.rotation.y += rotation.y
      mesh.rotation.z += rotation.z
    })
  }

  renderer.render(scene, camera)
}

/**
 * Resizes the renderer and camera to match the container.
 */
function handleResize() {
  const width = containerRef.value?.clientWidth || window.innerWidth
  const height = containerRef.value?.clientHeight || window.innerHeight

  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}
</script>

<style scoped>
.scene-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #000;
}
</style>