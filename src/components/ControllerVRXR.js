import * as THREE from 'three'
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js'
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory.js'

export function createControllerVRXR(renderer, scene, getInteractableMeshes) {
  const xrControllers = []
  const xrGrips = []
  const xrHands = []
  const xrRays = []
  const grabbedObjects = [null, null]
  const grabbedOffsets = [null, null]
  const controllerListeners = []
  const handListeners = []

  let highlightedMesh = null

  const raycaster = new THREE.Raycaster()
  const tempMatrix = new THREE.Matrix4()

  function getRaycastHits(controller) {
    tempMatrix.identity().extractRotation(controller.matrixWorld)
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld)
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix)
    return raycaster.intersectObjects(getInteractableMeshes())
  }

  function grabObject(i, mesh, source) {
    grabbedObjects[i] = mesh
    const sourcePosition = new THREE.Vector3().setFromMatrixPosition(source.matrixWorld)
    grabbedOffsets[i] = mesh.position.clone().sub(sourcePosition)
  }

  function releaseObject(i) {
    if (grabbedObjects[i]) {
      grabbedObjects[i].material.emissive?.set(0, 0, 0)
      grabbedObjects[i] = null
      grabbedOffsets[i] = null
    }
  }

  function onSelectStart(i) {
    const hits = getRaycastHits(xrControllers[i])
    if (hits.length > 0) {
      grabObject(i, hits[0].object, xrControllers[i])
    }
  }

  function onPinchStart(i) {
    const hand = xrHands[i]
    const indexTip = hand.joints?.['index-finger-tip']
    if (!indexTip) return

    raycaster.ray.origin.setFromMatrixPosition(indexTip.matrixWorld)

    const wrist = hand.joints?.wrist
    if (wrist) {
      raycaster.ray.direction
        .setFromMatrixPosition(indexTip.matrixWorld)
        .sub(new THREE.Vector3().setFromMatrixPosition(wrist.matrixWorld))
        .normalize()
    } else {
      raycaster.ray.direction.set(0, 0, -1)
    }

    const hits = raycaster.intersectObjects(getInteractableMeshes())
    if (hits.length > 0) {
      grabObject(i, hits[0].object, indexTip)
    }
  }

  function setup() {
    const controllerModelFactory = new XRControllerModelFactory()
    const handModelFactory = new XRHandModelFactory()

    for (let i = 0; i < 2; i++) {
      const controller = renderer.xr.getController(i)
      const onSelectStartHandler = () => onSelectStart(i)
      const onSelectEndHandler = () => releaseObject(i)
      const onConnectedHandler = (event) => {
        const isHand = !!(event.data && event.data.hand)
        if (xrRays[i]) xrRays[i].visible = !isHand
      }
      const onDisconnectedHandler = () => {
        if (xrRays[i]) xrRays[i].visible = false
      }

      controller.addEventListener('selectstart', onSelectStartHandler)
      controller.addEventListener('selectend', onSelectEndHandler)
      controller.addEventListener('connected', onConnectedHandler)
      controller.addEventListener('disconnected', onDisconnectedHandler)
      scene.add(controller)
      xrControllers[i] = controller
      controllerListeners[i] = {
        onSelectStartHandler,
        onSelectEndHandler,
        onConnectedHandler,
        onDisconnectedHandler
      }

      const rayGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1)
      ])
      const ray = new THREE.Line(
        rayGeometry,
        new THREE.LineBasicMaterial({
          color: 0x00ff88,
          transparent: true,
          opacity: 0.75
        })
      )
      ray.name = 'ray'
      ray.scale.z = 6
      ray.visible = false
      controller.add(ray)
      xrRays[i] = ray

      const grip = renderer.xr.getControllerGrip(i)
      grip.add(controllerModelFactory.createControllerModel(grip))
      scene.add(grip)
      xrGrips[i] = grip

      const hand = renderer.xr.getHand(i)
      const onPinchStartHandler = () => onPinchStart(i)
      const onPinchEndHandler = () => releaseObject(i)
      hand.add(handModelFactory.createHandModel(hand, 'spheres'))
      hand.addEventListener('pinchstart', onPinchStartHandler)
      hand.addEventListener('pinchend', onPinchEndHandler)
      scene.add(hand)
      xrHands[i] = hand
      handListeners[i] = { onPinchStartHandler, onPinchEndHandler }
    }
  }

  function update() {
    if (!renderer.xr.isPresenting) return

    if (highlightedMesh) {
      highlightedMesh.material.emissive?.set(0, 0, 0)
      highlightedMesh = null
    }

    for (let i = 0; i < 2; i++) {
      const controller = xrControllers[i]

      if (grabbedObjects[i]) {
        const controllerPosition = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld)
        grabbedObjects[i].position.copy(controllerPosition).add(grabbedOffsets[i])
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

  function dispose() {
    if (highlightedMesh) {
      highlightedMesh.material.emissive?.set(0, 0, 0)
      highlightedMesh = null
    }

    for (let i = 0; i < 2; i++) {
      releaseObject(i)

      const controller = xrControllers[i]
      const controllerListener = controllerListeners[i]
      if (controller && controllerListener) {
        controller.removeEventListener('selectstart', controllerListener.onSelectStartHandler)
        controller.removeEventListener('selectend', controllerListener.onSelectEndHandler)
        controller.removeEventListener('connected', controllerListener.onConnectedHandler)
        controller.removeEventListener('disconnected', controllerListener.onDisconnectedHandler)
        scene.remove(controller)
      }

      const hand = xrHands[i]
      const handListener = handListeners[i]
      if (hand && handListener) {
        hand.removeEventListener('pinchstart', handListener.onPinchStartHandler)
        hand.removeEventListener('pinchend', handListener.onPinchEndHandler)
        scene.remove(hand)
      }

      if (xrGrips[i]) {
        scene.remove(xrGrips[i])
      }

      const ray = xrRays[i]
      if (ray) {
        ray.geometry.dispose()
        ray.material.dispose()
      }
    }
  }

  return {
    setup,
    update,
    dispose
  }
}
