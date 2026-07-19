import { defineStore } from 'pinia'
import { ref } from 'vue'

const DEFAULT_SKY_PARAMS = {
  rayleigh: 0.1,
  mieCoefficient: 0.001,
  mieDirectionalG: 0.8,
  cloudCoverage: 0.5,
  cloudDensity: 1.0,
  cloudElevation: 2,
  showSunDisc: true,
  azimuth: 180,
  elevation: 45,
  exposure: 1.4
}

export const useSceneStore = defineStore('scene', () => {
  const isAnimating = ref(true)
  const objectCount = ref(0)
  const skyParams = ref({ ...DEFAULT_SKY_PARAMS })

  function toggleAnimation() {
    isAnimating.value = !isAnimating.value
  }

  function setObjectCount(count) {
    objectCount.value = count
  }

  function updateSkyParam(param, value) {
    skyParams.value[param] = value
  }

  function reset() {
    isAnimating.value = true
    objectCount.value = 0
    skyParams.value = { ...DEFAULT_SKY_PARAMS }
  }

  return {
    isAnimating,
    objectCount,
    skyParams,
    toggleAnimation,
    setObjectCount,
    updateSkyParam,
    reset
  }
})
