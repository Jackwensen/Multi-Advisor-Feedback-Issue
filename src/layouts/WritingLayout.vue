<template>
  <q-layout view="hHh Lpr lff" class="bg-white">
    <q-header unelevated>
      <q-toolbar>
        <q-btn flat dense round @click="toggleLeftDrawer" icon="menu"/>
        <q-toolbar-title >
          iRULER: Writing
        </q-toolbar-title>

        <!-- 显示当前模式信息 -->
        <div class="flex items-center q-gutter-sm">
        </div>
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="leftDrawerOpen"
      bordered
      class="bg-grey-3"
      :width="240"
      overlay
      behavior="mobile"
      elevated
    >
      <!-- 写作列表 -->
      <div class="text-body1 text-bold q-ma-md">Writings</div>
      <q-list>
        <q-item
          v-for="model in models"
          :key="model.id"
          @click="selectModel(model.id)"
          :active="selectedModel === model.id"
          active-class="bg-blue-5 text-blue-1"
          clickable
        >
          <!-- 模型名称 -->
          <q-item-section>{{ model.name }}</q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <q-tab-panels v-model="selectedModel" animated keep-alive vertical>
        <q-tab-panel v-for="(model) in models" :key="model.id" :name="model.id" style="padding: 1px 0px 8px 0px;">
          <writing-intelligible
            :modelName="model.name"
            :criteriaList="criteriaList"
            :content="model.content"
          />
        </q-tab-panel>
      </q-tab-panels>
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import WritingIntelligible from 'src/pages/Writing/WritingIntelligible.vue';
import { getRubric, getWritingList } from 'src/components/multiAgentWriting.js'
import urlParamsStore from 'src/store/urlParams.js'

const defaultContent = `We present a novel approach to compositional visual planning by (1) fine-tuning large language models (LLMs) with task-specific instructions and (2) incorporating an object detection agent model with vLLM. Our method addresses the limitations of existing models, such as insensitivity to object positioning and suboptimal image processing performance. By integrating the object detection model, our method can accurately determine the spatial positions of objects within an image. Our agent method leverages the in-context learning capability of vision-language models (vLLM) to plan the target object's position without requiring fine-tuning. To address the inherent precision constraints of vLLMs, we use the object detection model as an agent, providing precise location data that enhances prediction accuracy. Compared to previous methods, our agent approach improve alignment between textual descriptions and visual elements, increasing both consistency and accuracy in object placement. Experimental results demonstrate that our method achieves the best performance while requiring minimal computation costs.`

const leftDrawerOpen = ref(false)
const models = ref([{ id: generateUniqueId(), name: 'Default Writing 1', content: defaultContent }]); // 默认决策树模型
const selectedModel = ref(models.value[0].id); // 默认选中的决策树模型

const criteriaList = ref([]);

function toggleLeftDrawer () {
  leftDrawerOpen.value = !leftDrawerOpen.value
}

function generateUniqueId() {
  return Math.random().toString(36).substr(2, 9);
}

// 选择模型
function selectModel(modelId) {
  selectedModel.value = modelId;

  // 更新URL参数 - 根据modelId找到对应的writing name
  const selectedWriting = models.value.find(model => model.id === modelId);
  if (selectedWriting) {
    urlParamsStore.updateUrlParams({ passage: selectedWriting.name });
  }
}

// 根据passage参数设置选中的writing
function setupWritingFromUrl() {
  const urlPassageName = urlParamsStore.urlParams.passage;

  if (urlPassageName && models.value.length > 0) {
    // 尝试根据name匹配writing
    const matchedWriting = models.value.find(model => model.name === urlPassageName);
    if (matchedWriting) {
      selectedModel.value = matchedWriting.id;
      return;
    }
  }

  // 如果没有匹配到或没有URL参数，选择第一个并更新URL参数
  if (models.value.length > 0) {
    selectedModel.value = models.value[0].id;
    const firstWriting = models.value[0];
    urlParamsStore.updateUrlParams({ passage: firstWriting.name });
  }
}

onMounted(async () => {
  try {
    // 解析URL参数
    urlParamsStore.parseUrlParams();

    // 获取写作列表
    const writingList = await getWritingList();
    models.value.push(...writingList);
    console.log('writingList', models.value);

    // 根据URL参数设置选中的writing
    setupWritingFromUrl();

    // 获取rubric列表
    const rubric = await getRubric();
    console.log('criteriaList Feedback Page', rubric);
    // 获取所有文件的数据
    const result = Object.entries(rubric).map(([filename, fileData]) => {
      // 解析 JSON 字符串为对象
      const content = JSON.parse(fileData.content);

      // 返回新的数据结构
      return {
        name: content.modelName,
        content: {
          modelName: content.modelName,
          taskDescription: content.taskDescription,
          columnCount: content.columnCount,
          rubric: content.rubric
        }
      };
    });
    console.log('result', result);
    criteriaList.value = result;

  } catch (error) {
    console.error('Error fetching criteria list:', error);

  }
});
</script>

<style>

.absolute-full, .fullscreen, .fixed-full, .fullscreen, .q-drawer__backdrop {
  background-color: #ffffff00 !important;
}

.q-panel > div {
  height: calc(100vh - 50px);
  width: 100%;
  overflow: hidden; /* 防止子组件超出容器产生滚动条 */
}

/* 模式信息样式 */
.mode-tooltip {
  padding: 8px;
  line-height: 1.4;
}

.mode-tooltip .text-weight-bold {
  color: #1976d2;
  margin-bottom: 4px;
}

.mode-tooltip .text-caption {
  margin: 2px 0;
  color: #666;
}

/* popup-toolbar全局样式 */
.popup-toolbar {
  background-color: #2c3e50 !important;
  padding: 8px 12px !important;
  border-radius: 8px !important;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15) !important;
  z-index: 9999 !important;
  color: white !important;
  font-size: 14px !important;
  position: fixed !important;
  width: auto !important;
}

.toolbar-content {
  display: flex !important;
  gap: 10px !important;
  align-items: center !important;
}

.toolbar-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  color: white !important;
  border: none !important;
  padding: 6px 12px !important;
  border-radius: 6px !important;
  cursor: pointer !important;
  font-size: 12px !important;
}

.toolbar-button:hover {
  background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%) !important;
}
</style>
