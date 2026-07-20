import * as THREE from 'three'
import { SkyShader } from '../utils/skyShader'

export function applySkyUniforms(uniforms, params) {
  uniforms.rayleigh.value = params.rayleigh
  uniforms.mieCoefficient.value = params.mieCoefficient
  uniforms.mieDirectionalG.value = params.mieDirectionalG
  uniforms.cloudCoverage.value = params.cloudCoverage
  uniforms.cloudDensity.value = params.cloudDensity
  uniforms.cloudElevation.value = params.cloudElevation
  uniforms.showSunDisc.value = params.showSunDisc ? 1 : 0
  uniforms.azimuth.value = params.azimuth
  uniforms.elevation.value = params.elevation
  uniforms.exposure.value = params.exposure
}

function createSceneLights(scene) {
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
}

function createFloorPlanes(scene) {
  const floorGeometry = new THREE.PlaneGeometry(20, 20)
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x808080,
    metalness: 0.2,
    roughness: 0.8,
    side: THREE.DoubleSide
  })
  const floor = new THREE.Mesh(floorGeometry, floorMaterial)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  floor.position.y = 0
  scene.add(floor)

  return floor
}

function createSky(scene, skyParams) {
  const skyGeometry = new THREE.SphereGeometry(400, 64, 64)
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(SkyShader.uniforms),
    vertexShader: SkyShader.vertexShader,
    fragmentShader: SkyShader.fragmentShader,
    side: THREE.BackSide,
    toneMapped: false
  })

  applySkyUniforms(skyMaterial.uniforms, skyParams)

  const skyMesh = new THREE.Mesh(skyGeometry, skyMaterial)
  scene.add(skyMesh)

  return skyMesh
}

export function setupEnvironment(scene, skyParams) {
  createSceneLights(scene)
  const floor = createFloorPlanes(scene)
  const skyMesh = createSky(scene, skyParams)

  return { skyMesh, floor }
}
