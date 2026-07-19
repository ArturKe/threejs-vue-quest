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
import { createControllerVRXR } from './ControllerVRXR'
import { createPanelVRUI } from './PanelVRUI'

const containerRef = ref(null)
const sceneStore = useSceneStore()

let scene, camera, renderer, orbitControls, skyMesh, vrButton, controllerVRXR, panelVRUI
let objects = []
let objectMeshes = []  // cached flat array – avoids per-frame .map() in hot path
let interactableMeshes = []
let fpsSampleFrameCount = 0
let fpsSampleStartTime = 0

onMounted(() => {
  initScene()
  const environment = setupEnvironment(scene, sceneStore.skyParams)
  skyMesh = environment.skyMesh
  createGrid()
  createObjects()
  panelVRUI = createPanelVRUI({
    sceneStore,
    onResetObjects: resetObjects
  })
  scene.add(panelVRUI.mesh)
  interactableMeshes = [...objectMeshes, panelVRUI.mesh]

  controllerVRXR = createControllerVRXR(renderer, scene, () => interactableMeshes)
  controllerVRXR.setup()
  handleResize()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  renderer?.setAnimationLoop(null)
  controllerVRXR?.dispose()
  if (panelVRUI?.mesh) {
    scene.remove(panelVRUI.mesh)
  }
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

function initScene() {
  scene = new THREE.Scene()

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

  renderer.xr.addEventListener('sessionstart', () => { orbitControls.enabled = false })
  renderer.xr.addEventListener('sessionend', () => { orbitControls.enabled = true })

  fpsSampleStartTime = performance.now()
  renderer.setAnimationLoop(animate)
  window.addEventListener('resize', handleResize)
}

function createGrid() {
  const gridHelper = new THREE.GridHelper(20, 20, 0x00ff88, 0x444444)
  gridHelper.position.y = 0.01
  scene.add(gridHelper)
}

function createObjects() {
  const cubeGeometry = new THREE.BoxGeometry(2, 2, 2)
  const cubeMaterial = new THREE.MeshStandardMaterial({
    color: 0xff6b6b,
    metalness: 0.5,
    roughness: 0.5
  })
  const cube = new THREE.Mesh(cubeGeometry, cubeMaterial)
  cube.castShadow = true
  cube.receiveShadow = true
  cube.position.set(-5, 2, 0)
  scene.add(cube)
  objects.push({
    mesh: cube,
    rotation: { x: 0.01, y: 0.01, z: 0 },
    initialState: {
      position: cube.position.clone(),
      rotation: cube.rotation.clone()
    }
  })

  // Create a sphere
  const sphereGeometry = new THREE.IcosahedronGeometry(1.5, 32)
  const sphereMaterial = new THREE.MeshStandardMaterial({
    color: 0x4ecdc4,
    metalness: 0.7,
    roughness: 0.2
  })
  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial)
  sphere.castShadow = true
  sphere.receiveShadow = true
  sphere.position.set(5, 2, 0)
  scene.add(sphere)
  objects.push({
    mesh: sphere,
    rotation: { x: 0.005, y: 0.02, z: 0.01 },
    initialState: {
      position: sphere.position.clone(),
      rotation: sphere.rotation.clone()
    }
  })

  // Create a torus
  const torusGeometry = new THREE.TorusGeometry(2, 0.8, 64, 100)
  const torusMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd93d,
    metalness: 0.3,
    roughness: 0.7
  })
  const torus = new THREE.Mesh(torusGeometry, torusMaterial)
  torus.castShadow = true
  torus.receiveShadow = true
  torus.position.set(0, 2, -8)
  scene.add(torus)
  objects.push({
    mesh: torus,
    rotation: { x: 0.01, y: 0.008, z: 0 },
    initialState: {
      position: torus.position.clone(),
      rotation: torus.rotation.clone()
    }
  })

  sceneStore.setObjectCount(objects.length)
  objectMeshes = objects.map(o => o.mesh)
  interactableMeshes = [...objectMeshes, ...(panelVRUI?.mesh ? [panelVRUI.mesh] : [])]
}

function resetObjects() {
  objects.forEach(({ mesh, initialState }) => {
    mesh.position.copy(initialState.position)
    mesh.rotation.copy(initialState.rotation)
  })
}

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
