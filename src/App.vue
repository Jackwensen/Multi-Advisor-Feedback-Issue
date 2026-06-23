<template>
  <router-view v-slot="{ Component }">
    <keep-alive>
      <component :is="Component" />
    </keep-alive>
  </router-view>
</template>

<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'App'
})
</script>
<style>
:root {
  --background: #efefef;
}

.layout-container {
  display: flex;
  flex-wrap: wrap;
}

.content-box {
  padding: 1px;
  margin: 1px;
  /* border: 1px solid #ccc; */
  /* 默认情况下，所有内容块都尽可能地填充空间 */
  /* flex: 1;  */
}

/* 电脑端的两栏布局 */
@media (min-width: 769px) {
  .left-content {
    flex: 2; /* 左侧内容占据50%的宽度 */
    margin-top: 4px;
    margin-left: 4px;
  }
  .mid-content {
    flex: 3; /* 中间内容占据50%的宽度 */
  }
}

/* 移动端的单栏布局 */
@media (max-width: 768px) {
  .content-box {
    flex: 100%; /* 在移动端，所有内容块都占据100%的宽度 */
  }
}

.chat-box {
  text-align: left;
  display: inline-block;
  max-width: 360px;
  /* margin: 0 auto; */
  /* border: 1px solid #e0e0e0; */
  /* border-radius: 16px; */
}

.small-canvas {
  border: 1px solid #c4c4c4;
  border-radius: 16px;
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.1), /* 水平偏移 垂直偏移 模糊距离 颜色 */
    0 6px 20px rgba(0, 0, 0, 0.13); /* 水平偏移 垂直偏移 模糊距离 颜色 */
  width: 288px;
}

.report-box {
  border: 0px solid #c4c4c4;
  border-radius: 16px;
  min-width: 240px;
}


.message {
  margin-bottom: 4px;
}

.message-content {
  display: flex;
  justify-content: flex-end;
}

.message.assistant .message-content {
  justify-content: flex-start;
  text-align: left;

}

.message-bubble {
  max-width: 320px;
  word-wrap: break-word;
  padding: 8px;
  border-radius: 8px 16px;

}

.message-time {
  font-size: 12px;
  color: #888;
  text-align: right;
}

.message.assistant .message-time {
  text-align: left;
}

.message-input {
  display: flex;
  justify-content: space-between;
  align-items: center;
  /* margin: 4px;
  margin-left: 8px;
  margin-right: 8px; */
  padding: 8px;
}
</style>
