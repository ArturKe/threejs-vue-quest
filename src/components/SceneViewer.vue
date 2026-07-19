<template>
  <div ref="containerRef" class="scene-container" />
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js'
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory.js'
import { useSceneStore } from '../stores/sceneStore'
import { SkyShader } from '../utils/skyShader'

const containerRef = ref(null)
const sceneStore = useSceneStore()

let scene, camera, renderer, orbitControls, skyMesh, vrButton
let objects = []
let objectMeshes = []  // cached flat array – avoids per-frame .map() in hot path

// XR / controller & hand tracking state
const xrControllers = []    // [0] = right, [1] = left – input event sources
const xrGrips = []          // controller 3-D model groups
const xrHands = []          // hand tracking groups
const xrRays = []           // visible ray lines per controller
const grabbedObjects = [null, null]
const grabbedOffsets = [null, null]
let highlightedMesh = null
const raycaster = new THREE.Raycaster()
const tempMatrix = new THREE.Matrix4()

onMounted(() => {
  initScene()
  createFloor()
  createGrid()
  createSky()
  createObjects()
  setupXRControllers()
  handleResize()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  renderer?.setAnimationLoop(null)
  if (renderer && renderer.domElement.parentNode === containerRef.value) {
    containerRef.value.removeChild(renderer.domElement)
  }
  if (vrButton && vrButton.parentNode) {
    vrButton.parentNode.removeChild(vrButton)
  }
  renderer?.dispose()
  orbitControls?.dispose()
})

// Watch for sky parameter changes
watch(() => sceneStore.skyParams, (newParams) => {
  if (skyMesh?.material.uniforms) {
    applySkyUniforms(skyMesh.material.uniforms, newParams)
  }
}, { deep: true })

function applySkyUniforms(uniforms, params) {
  uniforms.rayleigh.value         = params.rayleigh
  uniforms.mieCoefficient.value   = params.mieCoefficient
  uniforms.mieDirectionalG.value  = params.mieDirectionalG
  uniforms.cloudCoverage.value    = params.cloudCoverage
  uniforms.cloudDensity.value     = params.cloudDensity
  uniforms.cloudElevation.value   = params.cloudElevation
  uniforms.showSunDisc.value      = params.showSunDisc ? 1 : 0
  uniforms.azimuth.value          = params.azimuth
  uniforms.elevation.value        = params.elevation
  uniforms.exposure.value         = params.exposure
}

function initScene() {
  // Scene setup - no background color, sky will handle it
  scene = new THREE.Scene()

  // Camera setup - higher and further for floor view
  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight
  camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 2000)
  camera.position.set(0, 8, 15)
  camera.lookAt(0, 0, 0)

  // Renderer setup
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

  // VR Button – request hand-tracking as optional so Quest 3 enables it
  vrButton = VRButton.createButton(renderer, {
    optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'layers']
  })
  document.body.appendChild(vrButton)

  // Orbit Controls
  orbitControls = new OrbitControls(camera, renderer.domElement)
  orbitControls.enableDamping = true
  orbitControls.dampingFactor = 0.05
  orbitControls.autoRotate = false
  orbitControls.autoRotateSpeed = 2
  orbitControls.minDistance = 5
  orbitControls.maxDistance = 100

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(30, 40, 30)
  directionalLight.castShadow = true
  directionalLight.shadow.mapSize.width = 2048
  directionalLight.shadow.mapSize.height = 2048
  directionalLight.shadow.camera.near = 0.1
  directionalLight.shadow.camera.far = 200
  directionalLight.shadow.camera.left = -50
  directionalLight.shadow.camera.right = 50
  directionalLight.shadow.camera.top = 50
  directionalLight.shadow.camera.bottom = -50
  scene.add(directionalLight)

  const pointLight = new THREE.PointLight(0x00ff88, 0.3, 100)
  pointLight.position.set(-15, 20, 15)
  scene.add(pointLight)

  // Disable OrbitControls during XR session (headset controls the camera)
  renderer.xr.addEventListener('sessionstart', () => { orbitControls.enabled = false })
  renderer.xr.addEventListener('sessionend', () => { orbitControls.enabled = true })

  // Start animation loop (setAnimationLoop is XR-compatible)
  renderer.setAnimationLoop(animate)

  // Resize listener
  window.addEventListener('resize', handleResize)
}

function createFloor() {
  // Floor plane - 20 by 20 meters - GREY COLOR
  const floorGeometry = new THREE.PlaneGeometry(20, 20)
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x808080,  // Medium grey
    metalness: 0.2,
    roughness: 0.8,
    side: THREE.DoubleSide
  })
  const floor = new THREE.Mesh(floorGeometry, floorMaterial)
  floor.rotation.x = -Math.PI / 2 // Rotate to horizontal
  floor.receiveShadow = true
  floor.position.y = 0
  scene.add(floor)
}

function createGrid() {
  // Grid helper - 20 cells of 1 meter each (20x20 grid)
  const gridHelper = new THREE.GridHelper(20, 20, 0x00ff88, 0x444444)
  gridHelper.position.y = 0.01 // Slightly above floor to avoid z-fighting
  scene.add(gridHelper)
}

function createSky() {
  // Create sky with procedural shader
  const skyGeometry = new THREE.SphereGeometry(400, 64, 64)
  
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(SkyShader.uniforms),
    vertexShader: SkyShader.vertexShader,
    fragmentShader: SkyShader.fragmentShader,
    side: THREE.BackSide,
    toneMapped: false
  })

  applySkyUniforms(skyMaterial.uniforms, sceneStore.skyParams)

  skyMesh = new THREE.Mesh(skyGeometry, skyMaterial)
  scene.add(skyMesh)
}

function createObjects() {
  // Create a rotating cube
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
  objects.push({ mesh: cube, rotation: { x: 0.01, y: 0.01, z: 0 } })

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
  objects.push({ mesh: sphere, rotation: { x: 0.005, y: 0.02, z: 0.01 } })

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
  objects.push({ mesh: torus, rotation: { x: 0.01, y: 0.008, z: 0 } })

  sceneStore.setObjectCount(objects.length)
  objectMeshes = objects.map(o => o.mesh)
}

function setupXRControllers() {
  const controllerModelFactory = new XRControllerModelFactory()
  const handModelFactory = new XRHandModelFactory()

  for (let i = 0; i < 2; i++) {
    // ── Abstract input source (events + pose) ──────────────────────────────
    const controller = renderer.xr.getController(i)
    controller.addEventListener('selectstart', (e) => onSelectStart(e, i))
    controller.addEventListener('selectend', (e) => onSelectEnd(e, i))
    // Show/hide ray based on whether it's a real controller or hand source
    controller.addEventListener('connected', (e) => {
      const isHand = !!(e.data && e.data.hand)
      if (xrRays[i]) xrRays[i].visible = !isHand
    })
    controller.addEventListener('disconnected', () => {
      if (xrRays[i]) xrRays[i].visible = false
    })
    scene.add(controller)
    xrControllers[i] = controller

    // ── Visible ray pointer ────────────────────────────────────────────────
    const rayGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1)
    ])
    const ray = new THREE.Line(
      rayGeo,
      new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.75 })
    )
    ray.name = 'ray'
    ray.scale.z = 6   // 6 m default length; shrinks when hitting an object
    ray.visible = false
    controller.add(ray)
    xrRays[i] = ray

    // ── Controller grip + 3-D model (Quest 3 layout via WebXR Profiles) ───
    const grip = renderer.xr.getControllerGrip(i)
    grip.add(controllerModelFactory.createControllerModel(grip))
    scene.add(grip)
    xrGrips[i] = grip

    // ── Hand tracking – joint spheres (no external assets required) ────────
    const hand = renderer.xr.getHand(i)
    hand.add(handModelFactory.createHandModel(hand, 'spheres'))
    hand.addEventListener('pinchstart', (e) => onPinchStart(e, i))
    hand.addEventListener('pinchend', (e) => onPinchEnd(e, i))
    scene.add(hand)
    xrHands[i] = hand
  }
}

// ── Raycasting helpers ──────────────────────────────────────────────────────

function getRaycastHits(controller) {
  tempMatrix.identity().extractRotation(controller.matrixWorld)
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld)
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix)
  return raycaster.intersectObjects(objectMeshes)
}

function grabObject(i, mesh, controller) {
  grabbedObjects[i] = mesh
  const ctrlPos = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld)
  grabbedOffsets[i] = mesh.position.clone().sub(ctrlPos)
}

function releaseObject(i) {
  if (grabbedObjects[i]) {
    grabbedObjects[i].material.emissive?.set(0, 0, 0)
    grabbedObjects[i] = null
    grabbedOffsets[i] = null
  }
}

// ── Controller trigger (selectstart / selectend) ────────────────────────────

function onSelectStart(event, i) {
  const hits = getRaycastHits(xrControllers[i])
  if (hits.length > 0) grabObject(i, hits[0].object, xrControllers[i])
}

function onSelectEnd(_, i) {
  releaseObject(i)
}

// ── Hand pinch (pinchstart / pinchend) ─────────────────────────────────────

function onPinchStart(event, i) {
  // For pinch raycasting use index-finger-tip joint as origin facing forward
  const indexTip = xrHands[i].joints?.['index-finger-tip']
  if (!indexTip) return
  raycaster.ray.origin.setFromMatrixPosition(indexTip.matrixWorld)
  // Direction: from wrist toward index tip
  const wrist = xrHands[i].joints?.['wrist']
  if (wrist) {
    raycaster.ray.direction
      .setFromMatrixPosition(indexTip.matrixWorld)
      .sub(new THREE.Vector3().setFromMatrixPosition(wrist.matrixWorld))
      .normalize()
  } else {
    raycaster.ray.direction.set(0, 0, -1)
  }
  const hits = raycaster.intersectObjects(objectMeshes)
  if (hits.length > 0) grabObject(i, hits[0].object, { matrixWorld: indexTip.matrixWorld })
}

function onPinchEnd(_, i) {
  releaseObject(i)
}

// ── Per-frame: move grabbed objects + update ray length + hover highlight ──

function updateXRPointers() {
  if (!renderer.xr.isPresenting) return

  // Clear previous highlight
  if (highlightedMesh) {
    highlightedMesh.material.emissive?.set(0, 0, 0)
    highlightedMesh = null
  }

  for (let i = 0; i < 2; i++) {
    const controller = xrControllers[i]

    // Move grabbed object with the controller
    if (grabbedObjects[i]) {
      const ctrlPos = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld)
      grabbedObjects[i].position.copy(ctrlPos).add(grabbedOffsets[i])
      continue
    }

    if (!xrRays[i] || !xrRays[i].visible) continue

    const hits = getRaycastHits(controller)
    if (hits.length > 0) {
      const hit = hits[0]
      xrRays[i].scale.z = hit.distance
      if (hit.object.material.emissive) {
        hit.object.material.emissive.set(0.25, 0.25, 0.05)
        highlightedMesh = hit.object
      }
    } else {
      xrRays[i].scale.z = 6
    }
  }
}

function animate() {
  orbitControls.update()
  updateXRPointers()

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
