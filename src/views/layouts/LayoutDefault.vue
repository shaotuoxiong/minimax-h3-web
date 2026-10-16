<template>
  <WorkspaceAuthGate>
    <main class="relative size-full overflow-hidden">
      <router-view />
    </main>
  </WorkspaceAuthGate>
</template>

<script setup lang="ts">
import { useFavicon } from '@vueuse/core'

import WorkspaceAuthGate from '@/platform/workspace/auth/WorkspaceAuthGate.vue'

useFavicon(`${import.meta.env.BASE_URL}assets/favicon.ico`)
</script>
