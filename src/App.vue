<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import DefaultLayout from './layouts/DefaultLayout.vue'
import ImmersiveLayout from './layouts/ImmersiveLayout.vue'

const route = useRoute()

const layoutComponent = computed(() => (route.meta.layout === 'immersive' ? ImmersiveLayout : DefaultLayout))
</script>

<template>
  <component :is="layoutComponent">
    <RouterView v-slot="{ Component, route: current }">
      <!-- Keyed single-element wrapper. Re-created on every navigation, so the
           new view mounts immediately (no <Transition> leave phase that could
           hang and blank the page) and the CSS `routeEnter` animation on
           `.route-view` plays each time — a soft fade-up per step. Immersive
           routes use a display:contents wrapper with no animation, so
           home/recording keep their own full-bleed layout and motion. -->
      <div :key="current.matched[0]?.path ?? current.path" :class="current.meta.layout === 'immersive' ? 'route-view-bare' : 'route-view'">
        <component :is="Component" />
      </div>
    </RouterView>
  </component>
</template>
