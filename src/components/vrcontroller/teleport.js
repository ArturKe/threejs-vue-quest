import * as THREE from 'three'

/**
 * Creates a teleport marker that follows controller rays and moves the user rig.
 */
export function setupTeleport(scene, userRig, controllers, floor) {
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x00ff88 })
  )
  marker.visible = false
  scene.add(marker)

  const raycaster = new THREE.Raycaster()
  const tempMatrix = new THREE.Matrix4()

  /**
   * Moves the rig to the current marker position.
   */
  function teleportToMarker() {
    if (!marker.visible) return
    userRig.position.set(marker.position.x, 0.1, marker.position.z)
  }

  /**
   * Hooks teleport confirmation onto each controller.
   */
  controllers.forEach((controller) => {
    controller.addEventListener('selectend', teleportToMarker)
  })

  return {
    /**
     * Recomputes the teleport marker from the active controller rays.
     */
    update() {
      marker.visible = false

      controllers.forEach((controller) => {
        tempMatrix.identity().extractRotation(controller.matrixWorld)
        raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld)
        raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix)

        const intersects = raycaster.intersectObject(floor)
        if (intersects.length > 0) {
          marker.position.copy(intersects[0].point)
          marker.position.y += 0.1
          marker.visible = true
        }
      })
    },

    /**
     * Removes the teleport marker and its controller listeners.
     */
    dispose() {
      controllers.forEach((controller) => {
        controller.removeEventListener('selectend', teleportToMarker)
      })

      scene.remove(marker)
      marker.geometry.dispose()
      marker.material.dispose()
    }
  }
}
