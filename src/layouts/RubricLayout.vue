<template>
  <q-layout view="hHh Lpr lff" class="bg-white">
    <q-header unelevated class="bg-deep-purple-5">
      <q-toolbar>
        <q-btn v-show="false" flat dense round @click="toggleLeftDrawer" icon="menu"/>
        <q-toolbar-title> iRULER: Rubric Creation </q-toolbar-title>

        <!-- 显示当前模式信息 -->
        <div class="flex items-center q-gutter-sm">
          <!-- <div class="text-caption">{{currentUserId}} </div> -->
        </div>
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="leftDrawerOpen"
      bordered
      class="bg-grey-1"
      :width="240"
      overlay
      elevated
      behavior="mobile"
    >
       <!-- rubric列表 -->
        <div class="text-body1 text-bold q-ma-md">Rubric List</div>
        <!-- 新增rubric按钮 -->
        <q-card-actions align="center">
          <q-btn color="deep-purple-5" outline icon="add" label="Add Rubric" @click="handleNewModel" />
        </q-card-actions>
        <q-list>
          <q-item
            v-for="(model) in models"
            :key="model.id"
            @click="selectModel(model.id)"
            :active="selectedModel === model.id"
            active-class="bg-deep-purple-4 text-blue-1"
            clickable
          >
            <!-- rubric名称 -->
            <q-item-section>{{ model.name }}</q-item-section>
            <q-item-section side>
              <!-- 删除按钮 -->
              <!-- <q-btn dense flat round icon="delete_outline" color="black" @click.stop="handleDeleteModel(index)" /> -->
            </q-item-section>
          </q-item>
        </q-list>
    </q-drawer>

    <q-page-container>
      <!-- Tutorial Mode -->
      <div v-if="isTutorialMode" class="tutorial-container">
        <RubricDesignTutorial />
      </div>

      <!-- Normal Mode -->
      <q-tab-panels v-else v-model="selectedModel" animated keep-alive vertical>
          <q-tab-panel v-for="model in models" :key="model.id" :name="model.id" class="q-pa-none">
            <rubric-design
              :modelName="model.name"
              :modelCriteria="model.criteria"
              :condition="currentCondition"
              @update-model-name="(newName) => updateModelName(model.id, newName)"
            />
          </q-tab-panel>
        </q-tab-panels>
    </q-page-container>

    <q-dialog v-model="confirmDeleteDialog" persistent>
      <q-card>
        <q-card-section class="row items-center">
          <q-avatar icon="warning" color="warning" text-color="white"/>
          <span class="q-ml-sm">Are you sure to delete this rubric? This action cannot be undone.</span>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="primary" v-close-popup />
          <q-btn flat label="Delete" color="negative" @click="confirmDelete" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-layout>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useQuasar } from 'quasar'
import RubricDesign from 'src/pages/Rubric/RubricDesign.vue';
import RubricDesignTutorial from 'src/pages/Rubric/RubricDesignTutorial.vue';
import { getGistRubricList, updateGistContent } from 'src/components/multiAgentRubric.js'
import urlParamsStore from 'src/store/urlParams.js'

const $q = useQuasar();
const leftDrawerOpen = ref(false)
const models = ref([]);
const selectedModel = ref('');
const confirmDeleteDialog = ref(false);
const pendingDeleteIndex = ref(null);

// 获取当前condition、userid和tour参数
const currentCondition = computed(() => urlParamsStore.urlParams.condition)
const currentUserId = computed(() => urlParamsStore.urlParams.userid)
const isTutorialMode = computed(() => urlParamsStore.urlParams.tour === 'yes')

function toggleLeftDrawer () {
  leftDrawerOpen.value = !leftDrawerOpen.value
}

// 新增rubric模型
function handleNewModel() {
  let newRubric;
  if (models.value.length === 0) {
    newRubric = { id: 1, name: 'Empty Rubric 1', criteria: {} };
    models.value.push(newRubric);
  } else {
    const newId = Date.now() + Math.random().toString(36).substring(2, 15);
    const newModelName = 'Empty Rubric';
    newRubric = { id: newId, name: newModelName, criteria: {} };
    models.value.push(newRubric);
  }
  selectedModel.value = newRubric.id;
  // 更新URL参数
  urlParamsStore.updateUrlParams({ rubricRubric: newRubric.name });
}

// 删除rubric模型
function handleDeleteModel(index) {
  pendingDeleteIndex.value = index;
  confirmDeleteDialog.value = true;
}

// 添加确认删除rubric函数
async function confirmDelete() {
  if (pendingDeleteIndex.value !== null) {
    const index = pendingDeleteIndex.value;
    const isSelectedModel = selectedModel.value === models.value[index].id;
    const fileName = models.value[index].name;

    try {
      await updateGistContent(`${fileName}`, null);
      models.value.splice(index, 1);

      if (isSelectedModel) {
        if (models.value.length > 0) {
          selectedModel.value = models.value[0].id;
          // 更新URL参数为新选中的rubric
          const newSelectedRubric = models.value[0];
          urlParamsStore.updateUrlParams({ rubricRubric: newSelectedRubric.name });
        } else {
          selectedModel.value = null;
          // 清除URL参数
          urlParamsStore.updateUrlParams({ rubricRubric: null });
        }
      }

      // 使用 Quasar 的通知组件
      $q.notify({
        type: 'positive',
        message: 'deleted',
        position: 'top',
        timeout: 2000
      });
    } catch (error) {
      console.error('delete failed:', error);
      // 使用 Quasar 的通知组件显示错误
      $q.notify({
        type: 'negative',
        message: 'delete failed: ' + (error.message || 'unknown error'),
        position: 'top',
        timeout: 3000
      });
    } finally {
      pendingDeleteIndex.value = null;
    }
  }
}

// 选择模型
function selectModel(modelId) {
  selectedModel.value = modelId;

  // 更新URL参数 - 根据modelId找到对应的rubric name
  const selectedRubric = models.value.find(model => model.id === modelId);
  if (selectedRubric) {
    urlParamsStore.updateUrlParams({ rubricRubric: selectedRubric.name });
  }
}

// 根据rubricRubric参数设置选中的rubric
function setupRubricFromUrl() {
  const urlRubricName = urlParamsStore.urlParams.rubricRubric;
  const userid = urlParamsStore.urlParams.userid;

  if (urlRubricName && models.value.length > 0) {
    // 尝试根据name匹配rubric
    const matchedRubric = models.value.find(model => model.name === urlRubricName);
    if (matchedRubric) {
      selectedModel.value = matchedRubric.id;
      return;
    } else {
      // 如果没有匹配到，创建一个新的rubric
      const newId = Date.now() + Math.random().toString(36).substring(2, 15);
      const newRubric = { id: newId, name: urlRubricName, criteria: {} };
      models.value.push(newRubric);
      selectedModel.value = newId;

      $q.notify({
        type: 'info',
        message: `Created new rubric: ${urlRubricName}`,
        position: 'top',
        timeout: 3000
      });
      return;
    }
  }

  // 如果没有URL参数rubricRubric，则创建一个新rubric，名字为 new rubric_ + userid
  if (!urlRubricName && userid) {
    const newRubricName = `new rubric_${userid}`;
    const newId = Date.now() + Math.random().toString(36).substring(2, 15);
    const newRubric = { id: newId, name: newRubricName, criteria: {} };
    models.value.push(newRubric);
    selectedModel.value = newId;
    urlParamsStore.updateUrlParams({ rubricRubric: newRubricName });

    return;
  }

  // 如果没有rubric，选择第一个并更新URL参数
  if (models.value.length > 0) {
    selectedModel.value = models.value[0].id;
    const firstRubric = models.value[0];
    urlParamsStore.updateUrlParams({ rubricRubric: firstRubric.name });
  }
}

function updateModelName(modelId, newName) {
  const model = models.value.find(model => model.id === modelId);
  if (model) {
    model.name = newName;
    // 如果更新的是当前选中的rubric，也更新URL参数
    if (selectedModel.value === modelId) {
      urlParamsStore.updateUrlParams({ rubricRubric: newName });
    }
  }
}

// 获取模式颜色
function getModeColor() {
  const colors = {
    'intelligible': 'red',
    'rubric': 'orange',
    'text': 'blue'
  };
  return colors[currentCondition.value] || 'grey';
}

// 获取模式标签
function getModeLabel() {
  const labels = {
    'intelligible': 'Intelligible Mode',
    'rubric': 'Rubric Mode',
    'text': 'Text Mode'
  };
  return labels[currentCondition.value] || 'Unknown Mode';
}

// 启动教程
function startTutorial() {
  // 更新URL参数，添加tour=yes
  urlParamsStore.updateUrlParams({ tour: 'yes' });

  $q.notify({
    type: 'info',
    message: 'Tutorial will start soon, please wait...',
    position: 'top',
    timeout: 2000
  });
}

onMounted(async () => {
  try {
    console.log('Current condition:', currentCondition.value);
    console.log('Current user ID:', currentUserId.value);

    // 解析URL参数
    urlParamsStore.parseUrlParams();

    const gistRubricList = await getGistRubricList();
    console.log('gistRubricList', gistRubricList);

    if (gistRubricList.length === 0) {
      models.value.push({ id: 1, name: 'Empty Rubric', criteria: {} });
    } else {
      models.value = gistRubricList.map(item => ({ id: Date.now() + Math.random().toString(36).substring(2, 15), name: item.name, criteria: item.content }));
    }

    // 根据URL参数设置选中的rubric
    setupRubricFromUrl();
  } catch (error) {
    console.error('Error fetching criteria list:', error);
    models.value = [{ id: 1, name: 'Empty Rubric', criteria: {} }];
    selectedModel.value = models.value[0].id;
    // 更新URL参数
    urlParamsStore.updateUrlParams({ rubricRubric: 'Empty Rubric' });
  }
});
</script>

<style>
.absolute-full, .fullscreen, .fixed-full, .fullscreen, .q-drawer__backdrop {
  background-color: #ffffff00 !important;
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

/* Tutorial container */
.tutorial-container {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}
</style>
