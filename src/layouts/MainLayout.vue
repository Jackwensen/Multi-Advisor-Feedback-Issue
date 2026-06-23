<template>
  <component :is="currentLayout" />
</template>

<script setup>
import { computed, onMounted } from 'vue'
import WritingLayout from './WritingLayout.vue'
import RubricLayout from './RubricLayout.vue'
import urlParamsStore from 'src/store/urlParams.js'

// 在组件挂载时解析URL参数
onMounted(() => {
  urlParamsStore.parseUrlParams()
})

// 根据task参数决定显示哪个布局
const currentLayout = computed(() => {
  const task = urlParamsStore.urlParams.task

  console.log('当前task参数:', task)

  switch (task) {
    case 'rubric':
      return RubricLayout
    case 'writing':
    default:
      return WritingLayout
  }
})
</script>

<style>

.q-textarea.q-field--dense .q-field__native {
  padding-top: 0px;
  padding-bottom: 0px;
}

.q-field--filled .q-field__control {
  font-size: 14px !important;
  padding-right: 0px !important;
  padding-left: 4px !important;
}

.q-field__bottom {
  padding: 0px !important;
}
</style>
