<template>
  <div class="app-container">
    <SceneViewer />
    <UIPanel />
  </div>
</template>

<script setup>
import SceneViewer from './components/SceneViewer.vue'
import UIPanel from './components/UIPanel.vue'
</script>

<style scoped>
.app-container {
  display: flex;
  width: 100%;
  height: 100%;
  background: #0a0e27;
}
</style>
