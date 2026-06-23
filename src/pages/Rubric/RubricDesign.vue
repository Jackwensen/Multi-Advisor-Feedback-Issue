<template>
  <div class="main-layout split-mode">
    <div class="rubric-container" :style="{ width: leftPanelWidth + '%' }" :class="{ 'collapsed': leftPanelWidth < minPanelWidthForContent }">
      <q-scroll-area class="fit" :bar-style="{ background: 'transparent' }" :thumb-style="{ background: 'rgba(0,0,0,0.2)', borderRadius: '4px', width: '8px' }">
        <div class="rubric-container-inner">
          <!-- 标题 - 当面板很小时只显示标题 -->
          <div class="collapsed-title" v-if="leftPanelWidth <= minPanelWidthForContent">
            <div class="collapsed-title-text">Rubric</div>
          </div>

          <!-- 完整内容 - 当面板足够大时显示 -->
          <div class="full-content" v-if="leftPanelWidth > minPanelWidthForContent">
            <!-- Dimension Toolbar will be positioned relative to each dimension input -->
            <div class="rubric-header q-my-sm">
              <div v-if="!isEditing" class="text-h6 text-weight-medium">
                {{ modelName }}
                <q-btn class="q-ml-sm" flat round dense icon="edit" color="deep-purple-4" @click="startEditing" />
              </div>
              <q-input v-else class="text-h6 text-bold" style="width: 280px;" v-model="editingName" dense outlined @keyup.enter="saveModelName" @blur="saveModelName" autofocus />
              <q-btn unelevated rounded outline no-caps class="q-ml-sm" color="purple-5" icon="history" label="History" @click="showHistory = true" />
            </div>

          <!-- 历史记录弹出框 -->
          <q-dialog v-model="showHistory">
            <q-card style="width: 900px; max-width: 90vw; max-height: 90vh;">
              <q-card-section class="row items-center">
                <div class="text-h6">History Timeline</div>
                <q-space />
                <q-btn icon="close" flat round dense v-close-popup />
              </q-card-section>

              <q-card-section class="q-pt-none" style="max-height: 80vh; overflow-y: auto;">
                <q-timeline color="secondary">
                  <q-timeline-entry
                    v-for="(record, index) in historyRecords"
                    :key="index"
                    :title="record.timestamp"
                    :subtitle="record.summary"
                    :color="index === historyRecords.length - 1 ? 'primary' : 'secondary'"
                  >
                    <div>
                      <q-card flat bordered>
                        <q-card-section>
                          <div class="text-subtitle2 text-weight-bold q-mb-xs">Task Description</div>
                          <div class="text-body2 content-preview">{{ record.snapshot.taskDescription }}</div>
                        </q-card-section>
                        <q-card-section>
                          <div class="text-subtitle2 text-weight-bold q-mb-xs">Dimensions</div>
                          <div class="text-caption">
                            {{ (record.snapshot.rubric || []).map(d => d.dimension || '(empty)').join(', ') }}
                          </div>
                        </q-card-section>
                        <q-card-section>
                          <div class="text-subtitle2 text-weight-bold q-mb-xs">Rubric Snapshot</div>
                          <q-table
                            flat
                            bordered
                            dense
                            :rows="buildPreviewData(record.snapshot)"
                            :columns="getPreviewColumns(record.snapshot.columnCount)"
                            row-key="__dim"
                            hide-bottom
                          >
                            <template v-slot:body-cell="props">
                              <q-td :props="props">
                                <div class="text-caption" :title="String(props.value || '')">{{ props.value }}</div>
                              </q-td>
                            </template>
                          </q-table>
                        </q-card-section>
                        <q-card-actions align="right">
                          <q-btn flat color="primary" label="Restore this version" @click="restoreRubric(record)" />
                        </q-card-actions>
                      </q-card>
                    </div>
                  </q-timeline-entry>
                </q-timeline>
              </q-card-section>

              <q-card-actions align="right">
                <q-btn flat label="Close" color="primary" v-close-popup />
              </q-card-actions>
            </q-card>
          </q-dialog>

            <!-- Task Description 部分 -->
            <q-card class="rubric-card q-mb-sm">
              <div class="row items-center">
                <q-input
                  v-model="taskDescription"
                  class="q-pa-sm q-my-sm col"
                  type="textarea"
                  filled
                  label="Task Description"
                  autogrow
                  @update:model-value="onTaskDescriptionChange"
                />
                <q-btn rounded no-caps outline label="Enhance" color="deep-purple-5" class="q-mr-sm" @click="elaborateTaskDescription" :disable="taskDescription.length === 0" :loading="elaboratingTaskDescription">
                  <q-tooltip class="text-body2">Enhance the task description to make it more clear and specific.</q-tooltip>
                </q-btn>
              </div>
            </q-card>

            <!-- Rubric Table -->
            <q-card class="rubric-card">
              <div class="q-pa-sm">
                <!-- 列数选择器和权重显示 -->
                <div class="q-mb-sm row items-center justify-between">
                  <q-select
                    standout="bg-deep-purple-5 text-white"
                    v-model="columnCount"
                    :options="[3,4,5,6]"
                    label="Choose Rating Scale"
                    style="width: 240px"
                    dense
                     @update:model-value="handleColumnCountChange"
                  />
                  <div class="row items-center">
                    <!-- 自动保存时间显示 -->
                    <div v-if="lastAutoSavedTime" class="save-time-indicator q-mr-md">
                      <transition name="fade-in-save-time">
                        <span :key="lastAutoSavedTime" class="text-grey-9 text-subtitle2 text-bold">
                          {{ formattedSaveTime }}
                        </span>
                      </transition>
                    </div>
                    <div class="weight-indicator" :class="{ 'weight-invalid': !isWeightValid }">
                      <q-icon :name="isWeightValid ? 'check_circle' : 'error'"
                              :color="isWeightValid ? 'positive' : 'negative'"
                              size="sm" class="q-mr-xs" />
                      <span class="text-weight-medium">
                        Total Weight: {{ totalWeight }}%
                        <span v-if="remainingWeight > 0" class="text-positive">({{ remainingWeight }}% remaining)</span>
                        <span v-else-if="remainingWeight < 0" class="text-negative">({{ Math.abs(remainingWeight) }}% over limit)</span>
                        <span v-else class="text-positive">(Perfect!)</span>
                      </span>
                    </div>
                  </div>
                </div>

                <!-- 动态表格 -->
                <div class="table-container">
                  <table class="custom-table">
                    <thead class="table-header">
                      <tr>
                        <th class="drag-cell"></th>
                        <th class="dimension-cell">Criteria</th>
                        <th class="description-cell" v-for="n in columnCount" :key="n">
                          {{ columnCount - n + 1 }} point
                        </th>
                        <th class="action-cell"></th>
                      </tr>
                    </thead>
                    <draggable
                      tag="tbody"
                      :list="tableData"
                      handle=".drag-handle"
                      item-key="index"
                      animation="200"
                    >
                      <template #item="{ element: row, index }">
                        <tr>
                          <!-- 拖拽手柄 -->
                          <td class="drag-cell">
                            <q-icon name="drag_indicator" class="drag-handle" size="sm" style="cursor: grab;" />
                          </td>
                          <!-- 维度内容 -->
                          <td class="dimension-cell">
                            <div class="dimension-content">
                              <div class="dimension-input-wrapper" :data-row-index="index">
                                <!-- Dimension Input -->
                                <!-- :rules="[val => !!val || 'Dimension is required']" -->
                                <q-input dense v-model="row.dimension"
                                  :input-style="{ fontSize: '13px', fontWeight: 'bold' }"
                                  class="dimension-input"
                                  placeholder="Criterion"
                                  @click="toggleDimensionToolbar(row, index, $event)"
                                />
                                <!-- Dimension Toolbar - 相对定位显示 -->
                                <div class="dimension-toolbar" v-if="activeDimensionToolbar === index && !row.dimension">
                                  <q-btn flat dense no-caps
                                    icon="tips_and_updates"
                                    label="Recommend a Criterion"
                                    @click="recommendDimension(row, index)"
                                    :loading="recommendingDimension"
                                    color="yellow-5"
                                    data-button="recommend-criterion"
                                    :data-row-index="index"
                                  >
                                    <q-tooltip class="text-body2">Get a recommended criterion based on task description</q-tooltip>
                                  </q-btn>
                                </div>
                              </div>
                              <!-- Weight Input -->
                              <q-input v-model.number="row.percentage" type="number" label="Weight (%)" borderless dense
                                :rules="[
                                  val => (val >= 0 && val <= 100) || 'Weight must be between 0-100',
                                  val => validateWeight(val, row) || 'Total weight cannot exceed 100%'
                                ]" />
                              <!-- 行工具栏 针对该行整个criterion -->
                              <div class="row-toolbar-cell" v-if="row.dimension">
                                <q-btn no-caps outline rounded
                                  class="q-px-sm q-mr-sm"
                                  icon="img:icons/spark-32x32.png"
                                  color="deep-purple-5"
                                  v-if="row.dimension && !row.criteria[0][`score_${columnCount}`].text"
                                  :label="getButtonLabel('Generate Criterion')"
                                  :loading="generatingRubric[index]"
                                  @click="getOrImproveCriterion(index, 0, 'Generate')"
                                  data-button="generate-criterion"
                                  :data-row-index="index"
                                  :data-c-index="0"
                                >
                                  <q-tooltip class="text-body2"> Generate descriptors for this criterion: {{row.dimension}}</q-tooltip>
                                </q-btn>
                                <!-- refine criteria 工具栏 -->
                                <q-btn-dropdown no-caps outline rounded
                                  class="q-pl-sm"
                                  color="deep-purple-5"
                                  icon="img:icons/spark-32x32.png"
                                  v-if="row.dimension && row.criteria[0][`score_${columnCount}`].text"
                                  :loading="generatingRubric[index]"
                                  @click.stop
                                >
                                  <template v-slot:label>
                                    <span>{{ getButtonLabel(`Refine ${row.criteria.length > 1 ? 'Sub-criterion' : 'Criterion'}`) }}</span>
                                  </template>
                                  <q-list style="min-width: 96px">
                                    <q-item v-for="type in refineTypes" :key="type" clickable v-close-popup :data-button="'refine-criterion'" :data-row-index="index" :data-c-index="0" :data-type="type">
                                      <q-item-section avatar><q-icon :name="refineIcons[refineTypes.indexOf(type)]"></q-icon></q-item-section>
                                      <q-item-section @click="getOrImproveCriterion(index, 0, type)">{{ type }}</q-item-section>
                                      <q-tooltip class="text-body2" anchor="center right" self="center left">{{ type }} this criterion for all score levels.</q-tooltip>
                                    </q-item>
                                  </q-list>
                                </q-btn-dropdown>
                              </div>
                            </div>
                          </td>
                          <!-- 评分标准 -->
                          <td v-for="col in columnCount" :key="col">
                            <div v-for="(criterion, cIndex) in (row.criteria || [])" :key="cIndex" class="criterion-cell" :data-row-index="index" :data-c-index="cIndex" :data-score="(columnCount - col + 1)">
                              <!-- criterion input -->
                              <q-input
                                v-model="criterion[`score_${columnCount - col + 1}`].text"
                                filled
                                type="textarea"
                                dense
                                autogrow
                                class="auto-height-input"
                                :input-style="{ fontSize: '13px' }"
                                :key="`textarea-${index}-${cIndex}-${columnCount - col + 1}`"
                                @click="toggleToolbar(index, cIndex, columnCount - col + 1, $event)"
                                @update:model-value="updateCriterionText($event, criterion, columnCount - col + 1)"
                                data-role="criterion-input"
                                :data-row-index="index"
                                :data-c-index="cIndex"
                                :data-score="(columnCount - col + 1)"
                                >
                              </q-input>

                              <!-- Criterion Toolbar - 浮动显示 -->
                              <div class="criterion-toolbar" v-if="activeToolbar === `${index}_${cIndex}_${columnCount - col + 1}` && row.dimension">
                                <q-btn-dropdown flat dense no-caps
                                  icon="img:icons/spark-32x32.png"
                                  label="Refine Descriptor"
                                  v-if="criterion[`score_${columnCount - col + 1}`].text && row.dimension"
                                  :loading="improvingCriteria[`${index}_${cIndex}_${columnCount - col + 1}`]"
                                  @click.stop
                                >
                                  <q-list style="min-width: 100px">
                                    <q-item v-for="type in refineTypes" :key="type" clickable v-close-popup :data-button="'refine-criterion-level'" :data-row-index="index" :data-c-index="cIndex" :data-score="(columnCount - col + 1)" :data-type="type">
                                      <q-item-section avatar><q-icon :name="refineIcons[refineTypes.indexOf(type)]"></q-icon></q-item-section>
                                      <q-item-section @click="refineDescription(row, criterion, col, index, cIndex, type)">{{ type }}</q-item-section>
                                      <q-tooltip class="text-body2" anchor="center right" self="center left">{{ type }} this criterion at this level.</q-tooltip>
                                    </q-item>
                                  </q-list>
                                </q-btn-dropdown>
                              </div>
                            </div>
                          </td>
                          <!-- 行操作按钮 -->
                          <td class="action-cell">
                            <div class="action-buttons">
                              <q-btn flat dense icon="sym_o_delete" color="negative" @click="removeRowAt(index)" :disable="tableData.length === 1" data-button="delete-criterion-row" :data-row-index="index">
                                <q-tooltip>delete this criterion</q-tooltip>
                              </q-btn>
                            </div>
                          </td>
                        </tr>
                      </template>
                    </draggable>
                  </table>
                </div>

                <!-- Add criterion 按钮 -->
                <div class="row q-mb-sm">
                  <q-btn
                    color="deep-purple-5"
                    icon="sym_o_add_circle"
                    label="Add criterion"
                    flat
                    no-caps
                    @click="addRow"
                    class="add-criterion-btn"
                    size="md"
                    data-button="add-criterion"
                  />
                </div>

                <!-- 保存按钮 -->
                <div class="row q-mt-sm items-center justify-between">
                  <q-btn color="purple-5" label="Save Rubric" unelevated rounded @click="saveRubric" no-caps class="q-mr-sm" />
                  <q-btn
                    color="deep-purple-5"
                    label="Use this Rubric"
                    unelevated
                    outline
                    rounded
                    no-caps
                    @click="testOnEssay"
                  />
                  <!-- <div class="q-ml-md text-grey-8" style="height: 36px; display: flex; align-items: center;">
                    <transition name="fade" mode="out-in">
                      <div :key="saveStatus" class="row items-center">
                        <q-spinner-dots v-if="saveStatus === 'Saving...'" color="primary" size="2em" class="q-mr-sm" />
                        <span v-if="saveStatus === 'Saving...'" class="text-weight-medium">Saving...</span>

                        <q-icon v-if="saveStatus === 'Saved' && lastAutoSavedTime" name="check_circle" color="positive" size="sm" class="q-mr-sm" />
                        <span v-if="saveStatus === 'Saved' && lastAutoSavedTime" class="text-weight-medium">
                          All changes saved at {{ formattedLastSaveTime }}
                        </span>

                        <q-icon v-if="saveStatus === 'Unsaved changes'" name="edit" size="sm" class="q-mr-sm" />
                        <span v-if="saveStatus === 'Unsaved changes'">Unsaved changes. Auto-saving soon...</span>

                        <q-icon v-if="saveStatus === 'Save failed'" name="error" color="negative" size="sm" class="q-mr-sm" />
                        <span v-if="saveStatus === 'Save failed'">Save failed. Please try again.</span>

                        <div v-if="saveStatus === 'Paused'" class="row items-start">
                          <q-icon name="warning" color="warning" size="sm" class="q-mr-sm q-mt-xs" />
                          <div>
                            <div class="text-weight-medium text-orange-8">Auto-save paused</div>
                            <div class="text-caption text-grey-7">{{ autoSaveError }}</div>
                          </div>
                        </div>
                      </div>
                    </transition>
                  </div> -->
                </div>
              </div>
            </q-card>
          </div>
        </div>
      </q-scroll-area>
    </div>

    <!-- 可拖拽的分隔条 -->
    <div
      class="resizer"
      @mousedown="startResize"
      @dblclick="resetToDefault"
      title="Drag to adjust panel size, double click to reset to default position"
    >
      <div class="resizer-line"></div>
      <div class="resizer-tooltip">
        <q-icon name="drag_indicator" size="16px" color="grey-6" />
      </div>
    </div>

    <!-- Evaluate panel -->
    <div class="evaluate-panel" :style="{ width: rightPanelWidth + '%' }" :class="{ 'collapsed': rightPanelWidth < minPanelWidthForContent }">
      <div class="collapsed-title" v-show="rightPanelWidth <= minPanelWidthForContent">
        <div class="collapsed-title-text">{{ getPanelTitle() }}</div>
      </div>

      <div class="evaluate-panel-content" v-show="rightPanelWidth > minPanelWidthForContent">
        <component
          :is="evaluationComponent"
          :user-rubric="tableData"
          :task-description="taskDescription"
          :column-count="columnCount"
          :model-name="modelName"
          @apply-counterfactual="handleApplyCounterfactual"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { useQuasar } from 'quasar'
import draggable from 'vuedraggable'

import { formatCriterionWithName, formatCriterionString, formatTaskString } from 'src/components/utilsRubric.js'
import { getOrImproveCriterion, updateGistContent, getSubRubric, refineDescription, recommendCriterion, elaborateDescription } from 'src/components/multiAgentRubric.js'
import RubricIntelligible from 'src/pages/Rubric/RubricIntelligible.vue'
import RubricText from 'src/pages/Rubric/RubricText.vue'
import RubricRubric from 'src/pages/Rubric/RubricRubric.vue'
import usageLogger from 'src/store/usageLogger.js'

export default {
  props: {
    modelName: {
      type: String,
      required: true,
    },
    modelCriteria: {
      type: Object,
    },
    condition: {
      type: String,
      default: 'intelligible'
    },
  },
  components: {
    draggable,
    RubricIntelligible,
    RubricText,
    RubricRubric,
  },
  data() {
    return {
      $q: useQuasar(),
      refineTypes: ['Improve', 'Shorten', 'Elaborate', 'Retry', 'Bullet-point'],
      refineIcons: ['auto_fix_high', 'unfold_less', 'expand', 'sym_o_refresh', 'sym_o_list'],
      columnCount: 3,
      taskDescription: '',
      exampleDescription:
      `Each student will give a five-minute presentation on a topic that has changed in a particular neighborhood over the past thirty years. Students are free to choose the focus of their presentation, but it needs to have a clear thesis, not just a chronological narrative. The presentation should include appropriate photographs, maps, diagrams, and other visual aids to aid in audience comprehension.

Grading Focus:
- Depth and accuracy of content
- Clarity of argument and analytical skills
- Presentation skills and interaction with the audience
- Effectiveness of use of visual aids
- Time control and overall performance`,
      tableData: [
        {
          dimension: '',
          description: '',
          percentage: 0,
          criteria: [this.createEmptyCriterion(3)]
        },
        {
          dimension: '',
          description: '',
          percentage: 0,
          criteria: [this.createEmptyCriterion(3)]
        },
        {
          dimension: '',
          description: '',
          percentage: 0,
          criteria: [this.createEmptyCriterion(3)]
        },

      ],
      isEditing: false,
      editingName: '',
      generatingRubric: {},
      improvingCriteria: {},
      activeToolbar: null, // 当前激活的toolbar，格式: "rowIndex_cIndex_score"
      preventHideToolbar: false, // 防止toolbar被立即隐藏
      activeDimensionToolbar: null, // 当前激活的dimension toolbar的行索引
      recommendingDimension: false,
      elaboratingTaskDescription: false,

      // 拖拽相关属性
      leftPanelWidth: 60, // 左侧面板的宽度百分比，默认60%
      rightPanelWidth: 40, // 右侧面板的宽度百分比，默认40%
      minPanelWidthForContent: 10, // 显示collapsed-title的宽度百分比
      absoluteMinPanelWidth: 4, // 绝对最小宽度百分比（拖拽限制）
      isResizing: false,

      autoSaveTimeout: null,
      lastAutoSavedData: '',
      lastAutoSavedTime: null,
      saveStatus: 'Saved', // Saved, Unsaved changes, Saving..., Paused
      autoSaveError: '',
      textareaResizeTimeout: null,
      cellWidthCalculationTimeout: null, // 用于防抖的计时器
      isCompactMode: false, // 是否启用紧凑模式
      rubricContainerWidth: 1000, // rubric-container-inner的实际宽度
      // 历史记录
      historyRecords: [],
      showHistory: false,

      // 常量定义 - 避免硬编码数值
      CELL_WIDTH: {
        NORMAL: 176,   // 标准模式宽度
        COMPACT: 120   // 紧凑模式宽度
      },
      BREAKPOINTS: {
        CONTAINER_WIDTH: 960  // rubric-container-inner宽度断点
      }
    };
  },
  computed: {
    totalWeight() {
      return this.tableData.reduce((sum, row) => {
        return sum + (row.percentage || 0);
      }, 0);
    },
    remainingWeight() {
      return 100 - this.totalWeight;
    },
    isWeightValid() {
      return this.totalWeight <= 100;
    },
    savableData() {
      return JSON.stringify({
        modelName: this.modelName,
        taskDescription: this.taskDescription,
        rubric: this.tableData,
        columnCount: this.columnCount,
      });
    },
        formattedLastSaveTime() {
      if (!this.lastAutoSavedTime) return '';
      return new Date(this.lastAutoSavedTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    },

    formattedSaveTime() {
      if (!this.lastAutoSavedTime) return '';
      return 'Saved at ' + new Date(this.lastAutoSavedTime).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    },

    evaluationComponent() {
      switch (this.condition) {
        case 'text':
          return 'RubricText';
        case 'rubric':
          return 'RubricRubric';
        case 'intelligible':
        default:
          return 'RubricIntelligible';
      }
    },

    // 计算当前应该使用的cell宽度
    dimensionCellWidth() {
      return this.shouldUseCompactMode ? this.CELL_WIDTH.COMPACT : this.CELL_WIDTH.NORMAL;
    },

    // 判断是否应该使用紧凑模式（基于rubric-container-inner宽度）
    shouldUseCompactMode() {
      return this.isCompactMode || this.rubricContainerWidth < this.BREAKPOINTS.CONTAINER_WIDTH;
    }
  },
      watch: {
    columnCount(newCount, oldCount) {
      this.tableData.forEach(row => {
        row.criteria.forEach(criterion => {
          // 保存现有的分数数据
          const existingScores = { ...criterion };

          // 清空现有的分数
          Object.keys(criterion).forEach(key => {
            if (key.startsWith('score_')) {
              delete criterion[key];
            }
          });

          // 根据新的列数重新创建分数
          for (let i = newCount; i >= 1; i--) {
            criterion[`score_${i}`] = existingScores[`score_${i}`] || { text: '', checked: false };
          }
        });
      });
      // 列数改变后重新计算cell宽度
      this.applyCellStyles();
    },
    // 监听面板宽度变化，重新计算textarea高度
    leftPanelWidth() {
      this.$nextTick(() => {
        this.recalculateTextareaHeights();
        this.applyCellStyles();
      });
    },
    // 监听rubric-container-inner宽度变化
    rubricContainerWidth() {
      this.applyCellStyles();
    },
    savableData(newValue) {
      // 首次加载数据时不触发
      if (!this.lastAutoSavedData) {
        this.lastAutoSavedData = newValue;
        return;
      }

      if (newValue === this.lastAutoSavedData) {
        return;
      }

      this.saveStatus = 'Unsaved changes';
      this.autoSaveError = '';
      clearTimeout(this.autoSaveTimeout);
      this.autoSaveTimeout = setTimeout(() => {
        this.performAutoSave();
      }, 5000); // 5 seconds delay
    }
  },
  async mounted() {
    // this.agents = await getAgents();
    // console.log('agents', this.agents[0].systemPrompts);
    if (this.modelCriteria && this.modelCriteria.rubric) {
      this.columnCount = this.modelCriteria.columnCount;
      this.taskDescription = this.modelCriteria.taskDescription;
      this.tableData = this.modelCriteria.rubric;
    } else {
      console.log('modelCriteria is empty');
    }

    this.$nextTick(() => {
      this.lastAutoSavedData = this.savableData;
      // 初始化textarea高度
      this.recalculateTextareaHeights();
      // 初始化rubric container宽度
      this.calculateRubricContainerWidth();
      // 初始化dimension cell样式
      this.applyCellStyles();
    });

    console.log('tableData', this.tableData);

    // 初始化日志会话
    try { usageLogger.init(this.$route ? this.$route.query : null, { page: 'RubricDesign', modelName: this.modelName }) } catch (e) {}
    try { usageLogger.snapshotBeforeAssessment({ rubric: this.tableData, columnCount: this.columnCount, taskDescription: this.taskDescription }) } catch (e) {}

    // 添加全局点击事件监听
    document.addEventListener('click', this.handleGlobalClick);
    // 添加窗口大小变化监听
    window.addEventListener('resize', this.applyCellStyles);
  },
    beforeUnmount() {
    // 清理全局事件监听
    document.removeEventListener('click', this.handleGlobalClick);
    window.removeEventListener('resize', this.applyCellStyles);
    // 清理定时器
    clearTimeout(this.autoSaveTimeout);
    clearTimeout(this.textareaResizeTimeout);
    clearTimeout(this.cellWidthCalculationTimeout);
  },
  methods: {
    // 更细粒度：任务描述输入
    onTaskDescriptionChange(val) {
      try { usageLogger.log('task_description_input', { length: (val || '').length, content: val }, { page: 'RubricDesign' }) } catch (e) {}
    },
    // 更细粒度：列数改变
    handleColumnCountChange(val) {
      try { usageLogger.log('change_column_count', { columnCount: val }, { page: 'RubricDesign' }) } catch (e) {}
      try { usageLogger.setCurrentRubric(this.tableData, val, this.taskDescription) } catch (e) {}
    },
    testOnEssay() {
      const params = new URLSearchParams();
      params.set('task', 'writing');
      params.set('condition', 'intelligible');
      params.set('writingRubric', this.modelName);

      const url = `https://jackwensen.github.io/diverse-feedback-llm/?${params.toString()}`;
      window.open(url, '_blank');
    },
    handleGlobalClick(event) {
      // 检查点击是否在criterion toolbar或criterion input内
      const isClickOnCriterionToolbar = event.target.closest('.criterion-toolbar');
      const isClickOnCriterionInput = event.target.closest('.auto-height-input');
      // 检查是否点击在dropdown菜单上（Quasar dropdown通过portal渲染到body中）
      const isClickOnDropdownMenu = event.target.closest('.q-menu') || event.target.closest('.q-list') || event.target.closest('.q-item');

      console.log('activeToolbar', this.activeToolbar);
      console.log('activeDimensionToolbar', this.activeDimensionToolbar);
      console.log('isClickOnCriterionToolbar', isClickOnCriterionToolbar);
      console.log('isClickOnCriterionInput', isClickOnCriterionInput);
      console.log('isClickOnDropdownMenu', isClickOnDropdownMenu);

      if (!isClickOnCriterionToolbar && !isClickOnCriterionInput && !isClickOnDropdownMenu && this.activeToolbar) {
        this.activeToolbar = null;
      }

      // 检查点击是否在dimension toolbar或dimension输入框内
      const isClickOnDimensionToolbar = event.target.closest('.dimension-toolbar');
      const isClickOnDimensionInput = event.target.closest('.dimension-input-wrapper');

      console.log('isClickOnDimensionToolbar', isClickOnDimensionToolbar);
      console.log('isClickOnDimensionInput', isClickOnDimensionInput);


      if (!isClickOnDimensionToolbar && !isClickOnDimensionInput && this.activeDimensionToolbar !== null) {
        this.activeDimensionToolbar = null;
      }

      // 记录一次更细粒度的点击
      try {
        const el = event.target
        const tag = el && el.tagName
        const button = el.closest('[data-button]')
        const role = el.closest('[data-role]')
        const cell = el.closest('.criterion-cell')
        const wrapper = el.closest('.dimension-input-wrapper')
        const payload = { tag: tag || 'unknown' }
        if (button) {
          payload.button = button.getAttribute('data-button')
          payload.rowIndex = button.getAttribute('data-row-index')
          payload.cIndex = button.getAttribute('data-c-index')
          payload.type = button.getAttribute('data-type')
          payload.score = button.getAttribute('data-score')
        }
        if (role && role.getAttribute('data-role') === 'criterion-input') {
          payload.role = 'criterion-input'
          payload.rowIndex = role.getAttribute('data-row-index')
          payload.cIndex = role.getAttribute('data-c-index')
          payload.score = role.getAttribute('data-score')
        }
        if (cell) {
          payload.rowIndex = payload.rowIndex ?? cell.getAttribute('data-row-index')
          payload.cIndex = payload.cIndex ?? cell.getAttribute('data-c-index')
          payload.score = payload.score ?? cell.getAttribute('data-score')
        }
        if (wrapper) {
          payload.rowIndex = payload.rowIndex ?? wrapper.getAttribute('data-row-index')
        }
        usageLogger.log('click', payload, { page: 'RubricDesign' })
      } catch (e) {}
    },
    addRow() {
      const newRow = {
        dimension: '',
        description: '',
        percentage: 0,
        criteria: [this.createEmptyCriterion(this.columnCount)]
      };
      this.tableData.push(newRow);
      try { usageLogger.log('click_button', { id: 'add-criterion' }, { page: 'RubricDesign' }) } catch (e) {}
    },
    removeRow() {
      console.log('removeRow', this.tableData);
      if (this.tableData.length > 1) {
        this.tableData.pop();
      }
    },
    async elaborateTaskDescription() {
      this.elaboratingTaskDescription = true;
      try {
        const taskDescription = await elaborateDescription(this.taskDescription);
        const formattedTaskDescription = formatTaskString(taskDescription);
        console.log('formattedTaskDescription', formattedTaskDescription);
        if (formattedTaskDescription) {
          this.taskDescription = JSON.parse(formattedTaskDescription).task;
        }
      } catch (error) {
        console.error('Error elaborating task description:', error);
        this.$q.notify({
          type: 'negative',
          message: 'Failed to elaborate task description',
          position: 'top'
        });
      } finally {
        this.elaboratingTaskDescription = false;
      }
    },
    // addCriteria(rowIndex) {
    //   const newCriterion = {};
    //   for (let i = 0; i < this.columnCount; i++) {
    //     newCriterion[`score_${this.columnCount - i}`] = { text: '' };
    //   }
    //   this.tableData[rowIndex].criteria.push(newCriterion);
    // },
    // removeCriteria(rowIndex) {
    //   if (this.tableData[rowIndex].criteria.length > 1) {
    //     this.tableData[rowIndex].criteria.pop();
    //   }
    // },
    // getCriteriaCount(row) {
    //   return row.criteria?.length || 0;
    // },
    async saveRubric() {
      // 内容验证
      const validation = this.validateRubricContent();
      if (!validation.isValid) {
        this.$q.notify({
          type: 'negative',
          message: validation.message,
          position: 'bottom',
          timeout: 2000
        });
        return;
      }

      // 停止任何待处理的自动保存
      clearTimeout(this.autoSaveTimeout);
      this.saveStatus = 'Saving...';

      try {
        await this._saveRubricData();

        this.lastAutoSavedData = this.savableData;
        this.lastAutoSavedTime = new Date();
        this.saveStatus = 'Saved';

        // 记录历史
        this.saveToHistory('manual');

        this.$q.notify({
          type: 'positive',
          message: 'Rubric Saved',
          position: 'bottom',
          timeout: 2000
        });

        try { usageLogger.log('click_button', { id: 'save-rubric' }, { page: 'RubricDesign' }) } catch (e) {}
      } catch (error) {
        console.error('rubric save failed:', error);
        this.saveStatus = 'Save failed';
        this.$q.notify({
          type: 'negative',
          message: 'rubric save failed: ' + (error.message || 'unknown error'),
          position: 'bottom',
          timeout: 2000
        });
      }
    },

    async performAutoSave() {
      const validation = this.validateRubricContent();
      if (!validation.isValid) {
        this.saveStatus = 'Paused';
        this.autoSaveError = validation.message;
        this.$q.notify({
          type: 'negative',
          message: validation.message,
          position: 'bottom',
          timeout: 2000
        });
        return;
      }

      const currentData = this.savableData;
      if (currentData === this.lastAutoSavedData) {
        this.saveStatus = 'Saved';
        return;
      }

      this.saveStatus = 'Saving...';
      try {
        await this._saveRubricData();

        this.lastAutoSavedData = currentData;
        this.lastAutoSavedTime = new Date();
        this.saveStatus = 'Saved';

        // 记录历史（自动保存）
        this.saveToHistory('auto');

        this.$q.notify({
          type: 'positive',
          message: 'Rubric Auto-Saved',
          position: 'bottom',
          timeout: 2000
        });

        try { usageLogger.log('auto_save', {}, { page: 'RubricDesign' }) } catch (e) {}
      } catch (error) {
        console.error('Auto-save failed:', error);
        this.saveStatus = 'Save failed';
        this.$q.notify({
          type: 'negative',
          message: 'Auto-save failed: ' + (error.message || 'unknown error'),
          position: 'bottom',
          timeout: 2000
        });
      }
    },

    async _saveRubricData() {
      const fileName = `${this.modelName}`;
      const content = {
        content: JSON.stringify({
          modelName: this.modelName,
          taskDescription: this.taskDescription,
          rubric: this.tableData,
          columnCount: this.columnCount,
        }, null, 2)
      };
      await updateGistContent(fileName, content);
    },

    validateRubricContent() {
      // 检查权重总和必须正好是100%
      if (this.totalWeight !== 100) {
        if (this.totalWeight > 100) {
          return {
            isValid: false,
            message: `Total weight is ${this.totalWeight}%, which exceeds 100%. Please adjust the weights to exactly 100%.`
          };
        } else {
          return {
            isValid: false,
            message: `Total weight is ${this.totalWeight}%, which is less than 100%. Please adjust the weights to exactly 100%.`
          };
        }
      }

      // 检查是否有空的维度或标准
      for (let i = 0; i < this.tableData.length; i++) {
        const row = this.tableData[i];

        // 检查维度是否为空
        if (!row.dimension || row.dimension.trim() === '') {
          return {
            isValid: false,
            message: `The dimension of row ${i + 1} cannot be empty, please fill in the complete dimension before saving`
          };
        }

        // 检查该维度下的所有标准
        if (!row.criteria || row.criteria.length === 0) {
          return {
            isValid: false,
            message: `The criterion of row ${i + 1} (dimension: ${row.dimension}) is empty, please add a criterion before saving`
          };
        }

        // 检查每个标准的所有分数级别
        for (let j = 0; j < row.criteria.length; j++) {
          const criterion = row.criteria[j];

          for (let score = 1; score <= this.columnCount; score++) {
            const scoreKey = `score_${score}`;
            if (!criterion[scoreKey] || !criterion[scoreKey].text || criterion[scoreKey].text.trim() === '') {
              const criterionLabel = row.criteria.length > 1 ? `sub-criterion ${j + 1}` : 'criterion';
              return {
                isValid: false,
                message: `The description of the ${criterionLabel} of row ${i + 1} (dimension: ${row.dimension}) for ${score} points cannot be empty, please fill in completely before saving`
              };
            }
          }
        }
      }

      return { isValid: true };
    },

    validateWeight(newValue, currentRow) {
      // 计算除当前行外的总权重
      const otherRowsWeight = this.tableData.reduce((sum, row) => {
        if (row === currentRow) return sum;
        return sum + (row.percentage || 0);
      }, 0);

      // 检查新值加上其他行的权重是否超过100
      return (otherRowsWeight + (newValue || 0)) <= 100;
    },
    startEditing() {
      this.isEditing = true;
      this.editingName = this.modelName;
      try { usageLogger.log('start_edit_model_name', {}, { page: 'RubricDesign' }) } catch (e) {}
    },
    saveModelName() {
      if (this.editingName && this.editingName !== this.modelName) {
        this.$emit('update-model-name', this.editingName);
        try { usageLogger.log('change_model_name', { name: this.editingName }, { page: 'RubricDesign' }) } catch (e) {}
      }
      this.isEditing = false;
    },
    toggleToolbar(rowIndex, cIndex, score, event) {
      const toolbarId = `${rowIndex}_${cIndex}_${score}`;

      // 如果点击的是当前激活的toolbar，则隐藏；否则显示新的toolbar
      if (this.activeToolbar === toolbarId) {
        this.activeToolbar = null;
      } else {
        this.activeToolbar = toolbarId;
      }
      try { usageLogger.log('toggle_toolbar', { rowIndex, cIndex, score, open: this.activeToolbar === toolbarId }, { page: 'RubricDesign' }) } catch (e) {}
    },
    async getOrImproveCriterion(index, cIndex, type) {
      const key = index;
      this.generatingRubric[key] = true;
      try {
        const row = this.tableData[index];
        const criteria = row.criteria[cIndex];
        console.log('criteria', criteria);
        const rubric = await getOrImproveCriterion(this.taskDescription, this.columnCount, row.dimension, row.description, criteria, type);
        const formattedRubric = JSON.parse(formatCriterionString(rubric));

        console.log('formattedRubric', formattedRubric);

        if (formattedRubric) {
          this.tableData[index].criteria[cIndex] = formattedRubric;
        }

        console.log('Updated scores for row', index, this.tableData[index].criteria[cIndex]);
      } catch (error) {
        console.error('Error generating rubric:', error);
        this.$q.notify({
          type: 'negative',
          message: 'Failed to generate rubric',
          position: 'top'
        });
        try { usageLogger.log('refine_or_generate', { rowIndex: index, cIndex, type }, { page: 'RubricDesign' }) } catch (e) {}
      } finally {
        this.generatingRubric[key] = false;
      }
    },
    // async generateRestCriteria(row, criterion, col, rowIndex, colIndex) {
    //   console.log('Row Info:', {
    //     dimension: row.dimension,
    //     description: row.description,
    //     tableData: this.tableData,
    //     criterion,
    //     row,
    //     col,
    //     score: this.columnCount - col + 1,
    //     criterionText: criterion[`score_${this.columnCount - col + 1}`].text
    //   });
    //   const subRubric = await getSubRubric(this.taskDescription, this.columnCount, row.dimension, row.description, criterion, `score_${this.columnCount - col + 1}`);

    //   const formattedRubric = formatCriterionString(subRubric);
    //   console.log('formattedRubric', formattedRubric);
    //   if (formattedRubric) {
    //     const parsedRubric = JSON.parse(formattedRubric);
    //     console.log('Parsed subRubric:', parsedRubric);
    //     this.tableData[rowIndex].criteria[colIndex] = parsedRubric;
    //   }
    // },

    async refineDescription(row, criterion, col, rowIndex, colIndex, type) {
      const loadingKey = `${rowIndex}_${colIndex}_${this.columnCount - col + 1}`;
      this.improvingCriteria[loadingKey] = true;

      try {
        console.log('Row Info:', {
          dimension: row.dimension,
          description: row.description,
          tableData: this.tableData,
          criterion,
          row,
          col,
          score: this.columnCount - col + 1,
          criterionText: criterion[`score_${this.columnCount - col + 1}`].text
        });
        console.log('criterion', this.tableData[rowIndex].criteria[colIndex][`score_${this.columnCount - col + 1}`]);
        const refinedCriterion = await refineDescription(this.taskDescription, this.columnCount, row.dimension, row.description, criterion, `score_${this.columnCount - col + 1}`, type);

        const formattedRubric = formatCriterionString(refinedCriterion);
        console.log('formattedRubric', formattedRubric);
        if (formattedRubric) {
          const parsedRubric = JSON.parse(formattedRubric);
          console.log('Parsed subRubric:', parsedRubric);
          this.tableData[rowIndex].criteria[colIndex][`score_${this.columnCount - col + 1}`] = parsedRubric[`score_${this.columnCount - col + 1}`];
        }
      } catch (error) {
        console.error('Error improving criteria:', error);
        this.$q.notify({
          type: 'negative',
          message: 'Failed to improve criteria',
          position: 'top'
        });
      } finally {
        this.improvingCriteria[loadingKey] = false;
        try { usageLogger.log('refine_description', { rowIndex, colIndex, level: this.columnCount - col + 1, type }, { page: 'RubricDesign' }) } catch (e) {}
      }
    },

        updateCriterionText(value, criterion, score) {
      if (!criterion[`score_${score}`]) {
        criterion[`score_${score}`] = { text: '', checked: false };
      }
      criterion[`score_${score}`] = {
        text: value,
        ...(criterion[`score_${score}`].focused ? { focused: true } : {}),
        checked: false
      };

      // 使用防抖避免过于频繁的重新计算
      clearTimeout(this.textareaResizeTimeout);
      this.textareaResizeTimeout = setTimeout(() => {
        this.recalculateTextareaHeights();
        try { usageLogger.setCurrentRubric(this.tableData, this.columnCount, this.taskDescription) } catch (e) {}
      }, 150);
      try { usageLogger.log('input_change', { field: 'criterion_text', scoreLevel: score, length: (value || '').length }, { page: 'RubricDesign' }) } catch (e) {}
    },

    addCriteriaAt(rowIndex, criterionIndex) {
      const newCriterion = this.createEmptyCriterion(this.columnCount);
      this.tableData[rowIndex].criteria.splice(criterionIndex + 1, 0, newCriterion);
      try { usageLogger.log('click_button', { id: 'add-sub-criterion', rowIndex, afterIndex: criterionIndex }, { page: 'RubricDesign' }) } catch (e) {}
    },

    removeCriteriaAt(rowIndex, criterionIndex) {
      if (this.tableData[rowIndex].criteria.length > 1) {
        this.tableData[rowIndex].criteria.splice(criterionIndex, 1);
      } else {
        // 跳过 notify 记录
      }
    },

    // insertRowAt(index) {
    //   const newRow = {
    //     dimension: '',
    //     description: '',
    //     percentage: 0,
    //     criteria: [this.createEmptyCriterion(this.columnCount)]
    //   };
    //   this.tableData.splice(index + 1, 0, newRow);
    // },

    removeRowAt(index) {
      if (this.tableData.length > 1) {
        this.$q.dialog({
          title: 'Confirm',
          message: 'Are you sure to delete this criterion? This action cannot be undone.',
          cancel: true,
          persistent: false
        }).onOk(() => {
          this.tableData.splice(index, 1);
          try { usageLogger.log('delete_row', { index }, { page: 'RubricDesign' }) } catch (e) {}
        });
      }
    },

    createEmptyCriterion(colCount) {
      const criterion = {};
      for (let i = colCount; i >= 1; i--) {
        criterion[`score_${i}`] = { text: '', checked: false };
      }
      return criterion;
    },

    toggleDimensionToolbar(row, rowIndex, event) {
      const key = rowIndex;
      // 只有在dimension为空时才显示toolbar
      if (this.activeDimensionToolbar === key) {
        this.activeDimensionToolbar = null;
      } else {
        this.activeDimensionToolbar = key;
      }
      try { usageLogger.log('toggle_dimension_toolbar', { rowIndex, open: this.activeDimensionToolbar === key }, { page: 'RubricDesign' }) } catch (e) {}
    },

    async recommendDimension(row, index) {
      // 这里是推荐维度的功能，先留空
      this.recommendingDimension = true;

      try {
        // TODO: 实现推荐维度的逻辑
        console.log('Recommending dimension for task:', this.taskDescription, row);

        console.log(this.tableData[index])

        // 模拟异步操作
        const recommendedCriterion = await recommendCriterion(this.taskDescription, this.columnCount, this.tableData);

        console.log(recommendedCriterion)
        const formattedCriterion = formatCriterionWithName(recommendedCriterion);
        console.log(formattedCriterion)

        if (formattedCriterion) {
          const parsedCriterion = JSON.parse(formattedCriterion);
          console.log('Parsed criterion:', parsedCriterion);
          this.tableData[index].dimension = parsedCriterion.name;
          this.tableData[index].criteria[0] = parsedCriterion.criteria;
        }

      } catch (error) {
        console.error('Error recommending dimension:', error);
        this.$q.notify({
          type: 'negative',
          message: 'Error recommending dimension',
          position: 'top'
        });
      } finally {
        this.recommendingDimension = false;
        try { usageLogger.log('recommend_dimension', { rowIndex: index }, { page: 'RubricDesign' }) } catch (e) {}
      }
    },


    // 历史记录：保存当前rubric快照
    saveToHistory(trigger = 'manual') {
      try {
        const contentKey = this.savableData;
        const latest = this.historyRecords[this.historyRecords.length - 1];
        if (latest && latest.contentKey === contentKey) {
          return; // 与上一条相同则跳过
        }

        const snapshot = {
          modelName: this.modelName,
          taskDescription: this.taskDescription,
          rubric: JSON.parse(JSON.stringify(this.tableData)),
          columnCount: this.columnCount,
          totalWeight: this.totalWeight
        };

        const summary = `Criteria: ${snapshot.rubric.length} | Scale: ${snapshot.columnCount} | Total Weight: ${snapshot.totalWeight}%`;

        const record = {
          timestamp: new Date().toLocaleString(),
          snapshot,
          summary,
          contentKey,
          trigger
        };

        this.historyRecords.push(record);
        try { usageLogger.log('save_rubric_history', { trigger, summary }, { page: 'RubricDesign' }) } catch (e) {}
      } catch (e) {
        // 忽略历史记录失败
      }
    },

    // 历史记录：恢复到某个快照
    restoreRubric(record) {
      if (!record || !record.snapshot) return;
      const { taskDescription, rubric, columnCount } = record.snapshot;
      this.taskDescription = taskDescription || '';
      this.columnCount = columnCount || 3;
      this.tableData = Array.isArray(rubric) ? JSON.parse(JSON.stringify(rubric)) : this.tableData;

      this.$nextTick(() => {
        try {
          this.recalculateTextareaHeights();
          this.applyCellStyles();
          this.calculateRubricContainerWidth();
        } catch (e) {}
      });

      this.showHistory = false;
      try { usageLogger.log('restore_rubric_history', { summary: record.summary }, { page: 'RubricDesign' }) } catch (e) {}
    },

    // 历史记录预览：表头
    getPreviewColumns(columnCount) {
      const cols = [
        { name: 'dimension', label: 'Criteria', field: row => row.dimension, align: 'left' },
        { name: 'percentage', label: 'Weight (%)', field: row => row.percentage, align: 'left' },
      ];
      for (let s = columnCount; s >= 1; s--) {
        cols.push({
          name: `score_${s}`,
          label: `${s} point`,
          field: row => row[`score_${s}`],
          align: 'left'
        });
      }
      return cols;
    },

    // 历史记录预览：行数据
    buildPreviewData(snapshot) {
      const rubric = snapshot?.rubric || [];
      const columnCount = snapshot?.columnCount || 3;
      return rubric.map(dim => {
        const row = {
          __dim: dim.dimension || '(empty)',
          dimension: dim.dimension || '(empty)',
          percentage: dim.percentage ?? 0,
        };
        for (let s = columnCount; s >= 1; s--) {
          const parts = (dim.criteria || []).map(c => (c?.[`score_${s}`]?.text || '')).filter(Boolean);
          const joined = parts.slice(0, 2).join(' | ');
          row[`score_${s}`] = this.truncateText(joined, 80);
        }
        return row;
      });
    },

    truncateText(text, maxLen = 80) {
      if (!text) return '';
      const str = String(text);
      return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
    },



    handleApplyCounterfactual(data) {
      // 接收子组件传递的反事实rubric数据
      const { columnCount, tableData } = data;

      console.log('Applying counterfactual rubric:', { columnCount, tableData });

      // 1. 更新列数
      this.columnCount = columnCount;

      // 2. 更新表格数据
      // 需要将counterfactual rubric的格式转换为tableData的格式
      this.tableData = tableData.map(dimension => {
        return {
          dimension: dimension.dimension,
          description: dimension.description || '',
          percentage: dimension.percentage || 0,
          criteria: dimension.criteria || [this.createEmptyCriterion(columnCount)]
        };
      });


    },

    startResize(event) {
      this.isResizing = true;
      const startX = event.clientX;
      const containerWidth = document.querySelector('.main-layout').offsetWidth;
      const startLeftWidth = this.leftPanelWidth;

      const resize = (event) => {
        const deltaX = event.clientX - startX;
        const deltaPercent = (deltaX / containerWidth) * 100;
        let newLeftWidth = startLeftWidth + deltaPercent;

        // 限制最小和最大宽度
        newLeftWidth = Math.max(this.absoluteMinPanelWidth, newLeftWidth);
        newLeftWidth = Math.min(100 - this.absoluteMinPanelWidth, newLeftWidth);

        this.leftPanelWidth = newLeftWidth;
        this.rightPanelWidth = 100 - newLeftWidth;
      };

      const endResize = () => {
        this.isResizing = false;
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', endResize);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        // 拖拽结束后重新计算textarea高度
        this.$nextTick(() => {
          this.recalculateTextareaHeights();
        });
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', resize);
      document.addEventListener('mouseup', endResize);
    },

    resetToDefault() {
      this.leftPanelWidth = 60;
      this.rightPanelWidth = 40;
    },

        // 重新计算所有textarea的高度
    recalculateTextareaHeights() {
      // 确保DOM已经更新
      this.$nextTick(() => {
        // 获取所有的textarea元素
        const textareas = this.$el ? this.$el.querySelectorAll('.auto-height-input textarea') : [];

        textareas.forEach(textarea => {
          if (textarea && textarea.style) {
            // 暂时禁用过渡效果，避免闪烁
            textarea.style.transition = 'none';
            // 重置高度为auto，让其重新计算
            textarea.style.height = 'auto';
            // 强制重新计算高度
            const newHeight = Math.max(textarea.scrollHeight, 44); // 最小高度44px
            textarea.style.height = newHeight + 'px';
            // 恢复过渡效果
            setTimeout(() => {
              textarea.style.transition = 'height 0.2s ease';
            }, 10);
          }
        });
      });
    },

    // 获取面板标题
    getPanelTitle() {
      switch (this.condition) {
        case 'text':
          return 'Text Feedback';
        case 'rubric':
          return 'Rubric Assessment';
        case 'intelligible':
        default:
          return 'Rubric of Rubrics';
      }
    },

    // 根据cell宽度动态调整按钮文本
    getButtonLabel(fullText) {
      if (!this.shouldUseCompactMode) {
        return fullText;
      }

      // 紧凑模式下的文本映射
      const compactLabels = {
        'Generate': ['Generate'],
        'Refine': ['Refine']
      };

      for (const [shortText, keywords] of Object.entries(compactLabels)) {
        if (keywords.some(keyword => fullText.includes(keyword))) {
          return shortText;
        }
      }

      return fullText;
    },

            // 应用cell样式（防抖版本）
    applyCellStyles() {
      clearTimeout(this.cellWidthCalculationTimeout);
      this.cellWidthCalculationTimeout = setTimeout(() => {
        this.$nextTick(() => {
          this.updateDimensionCellStyles();
        });
      }, 100);
    },

    // 更新dimension cell的样式
    updateDimensionCellStyles() {
      const dimensionCells = this.$el?.querySelectorAll('.dimension-cell');
      if (!dimensionCells?.length) return;

      // 计算rubric-container-inner的宽度
      this.calculateRubricContainerWidth();

      const shouldUseCompact = this.shouldUseCompactMode;

      dimensionCells.forEach(cell => {
        cell.classList.toggle('dimension-cell-small', shouldUseCompact);
      });
    },

    // 计算rubric-container-inner的实际宽度
    calculateRubricContainerWidth() {
      const rubricContainer = this.$el?.querySelector('.rubric-container-inner');
      if (rubricContainer) {
        this.rubricContainerWidth = rubricContainer.offsetWidth;
      }
    },
  },
};
</script>
<style scoped>
/* Main layout container */
.main-layout {
  display: flex;
  width: 100vw;
  height: calc(100vh - 50px);
  overflow: hidden;
  position: relative;
}



.rubric-container {
  height: calc(100vh - 56px);
  box-sizing: border-box;
  transition: width 0.2s ease;
  overflow: hidden;
  position: relative;
  min-width: 0;
}

.rubric-container-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: start;
  padding: 4px 0px;
  box-sizing: border-box;
  height: 100%;
  overflow: hidden;
}

.rubric-container.collapsed .rubric-container-inner {
  padding: 4px 8px;
}



/* 拖拽分隔条样式 */
.resizer {
  width: 8px;
  cursor: col-resize;
  background: transparent;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  transition: background-color 0.2s;
}

.resizer:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.resizer-line {
  width: 3px;
  height: 100%;
  background-color: #ddd;
  border-radius: 1px;
  transition: background-color 0.2s;
}

.resizer:hover .resizer-line {
  background-color: #1976d2;
}

.resizer-tooltip {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}

.resizer:hover .resizer-tooltip {
  opacity: 1;
}

/* 折叠状态样式 */
.collapsed-title {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  border-radius: 8px;
  writing-mode: vertical-lr;
  text-orientation: mixed;
}

.collapsed-title-text {
  font-size: 20px;
  font-weight: bold;
  color: #666;
  letter-spacing: 2px;
}

/* 面板标题样式 */
.panel-title {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  writing-mode: vertical-lr;
  text-orientation: mixed;
  padding: 20px 0;
}

.panel-title .title-text {
  font-size: 18px;
  font-weight: 600;
  color: #5D4037;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.full-content {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.rubric-header {
  text-align: center;
  color: #5D4037;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0px 12px;
}

.rubric-card {
  width: 100%;
  border-radius: 0px;
  box-shadow: 1px 1px 1px 0px rgba(0, 0, 0, 0.1)

}

.table-container {
  width: 100%;
  overflow-x: auto;
  overflow-y: visible;
  padding-bottom: 4px;
}

.rubric-container.compressed .table-container {
  /* 在压缩模式下确保表格能够正确显示 */
  font-size: 13px;
}

.rubric-container.compressed .custom-table th,
.rubric-container.compressed .custom-table td {
  padding: 2px 4px;
}

.rubric-container.compressed .dimension-cell {
  max-width: 15%;
}

.custom-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 0.5rem;
}

.custom-table th,
.custom-table td {
  border: 1px solid #ddd;
  padding: 0px 4px 4px 4px;
  vertical-align: middle;
}

.table-header {
  background-color: #f5f5f5;
  height: 40px;
  font-size: 16px;
  font-family: 'Noto Sans SC', sans-serif;
}

.drag-cell {
  width: 24px;
  min-width: 24px;
}

.dimension-cell {
  width: 176px;
  min-width: 176px;
  max-width: 176px;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.dimension-cell.dimension-cell-small {
  width: 120px;
  min-width: 120px;
  max-width: 120px;
}

.dimension-content {
  display: flex;
  flex-direction: column;
  padding: 2px;
  transition: all 0.3s ease;
}

.row-toolbar-cell .q-btn {
  font-size: 12px;
  padding: 4px 8px;
  min-width: auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 当dimension cell宽度较小时，优化按钮显示 */
.dimension-cell-small .row-toolbar-cell .q-btn {
  font-size: 12px;
  padding: 2px 6px;
}



.dimension-input-wrapper {
  position: relative;
  overflow: visible;
}

.dimension-input .q-field__native {
  font-weight: bold !important;
}

.q-field--with-bottom {
  padding-bottom: 12px !important;
}

.dimension-input .q-field__native::placeholder {
  font-weight: normal !important;
}

.criterion-cell {
  margin-bottom: 4px;
  padding: 0px;
  position: relative;
  min-height: fit-content;
  overflow: visible; /* 确保toolbar能够显示在cell外部 */
}

.criterion-cell:last-child {
  border-bottom: none;
}

.criterion-toolbar {
  position: absolute;
  top: 100%;
  left: 6px;
  right: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 0px 0px 8px 8px;
  border: none;
  padding: 0px 0px;
  margin-top: 0px;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3), 0 2px 6px rgba(0,0,0,0.15);
  z-index: 1000;
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  white-space: nowrap;
  width: max-content;
  pointer-events: auto;
  opacity: 0;
  animation: fadeInUp 0.2s ease-out forwards;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.criterion-toolbar .q-btn {
  color: white !important;
  margin: 0 1px;
  border-radius: 0px 0px 6px 6px;
  transition: all 0.2s ease;
  flex-shrink: 0;
  font-size: 13px;
  min-width: auto;
  font-weight: 500;
}

.criterion-toolbar .q-btn .q-btn__content {
  line-height: 1.2;
}

.criterion-toolbar .q-btn:hover {
  background-color: rgba(255, 255, 255, 0.2) !important;
}

.auto-height-input .q-field__native {
  min-height: 2.8em !important;  /* 设置最低高度约为两行 */
  line-height: 1.4em !important;
}

.auto-height-input textarea {
  line-height: 1.4em;
  resize: none !important;  /* 禁止手动调整大小 */
  overflow-y: hidden;
  transition: height 0.2s ease; /* 添加平滑过渡效果 */
  box-sizing: border-box;
}

/* 基础样式保持不变 */


.action-cell {
  width: 32px;
  min-width: 32px;
  text-align: center;
  padding: 0px !important;
}

.action-buttons {
  display: flex;
  gap: 4px;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.add-criterion-btn {
  border-radius: 8px;
  padding: 8px 16px;
  transition: all 0.3s ease;
  width: auto;
}

.add-criterion-btn:hover {
  border-color: #1976d2;
  background-color: rgba(25, 118, 210, 0.04);
}

.weight-indicator {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 6px;
  background-color: #f5f5f5;
  transition: all 0.3s ease;
}

.weight-indicator.weight-invalid {
  background-color: #ffebee;
  border: 1px solid #f44336;
}

.dimension-toolbar {
  position: absolute;
  top: -42px;
  left: -8px;
  right: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  border: none;
  padding: 4px;
  margin-top: 4px;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3), 0 2px 6px rgba(0,0,0,0.15);
  z-index: 1000;
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  white-space: nowrap;
  min-width: max-content;
  pointer-events: auto;
  opacity: 0;
  animation: fadeInUp 0.2s ease-out forwards;
}

.dimension-toolbar .q-btn {
  color: white !important;
  margin: 0 1px;
  border-radius: 6px;
  transition: all 0.2s ease;
  flex-shrink: 0;
  font-size: 13px;
  min-width: auto;
  padding: 4px 6px;
  font-weight: 500;
}

.dimension-toolbar .q-btn .q-btn__content {
  line-height: 1.2;
}

.dimension-toolbar .q-btn:hover {
  background-color: rgba(255, 255, 255, 0.2) !important;
  transform: translateY(-1px);
}

/* Evaluate Panel Styles */
.evaluate-panel {
  height: 100vh;
  background: white;
  display: flex;
  flex-direction: column;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  box-sizing: border-box;
  transition: width 0.2s ease;
  min-width: 0;
}



.evaluate-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0px 12px;
  margin-top: 4px;
  background: white;
  flex-shrink: 0;
  min-height: 48px;
  position: sticky;
  top: 0;
  z-index: 10;
}

.evaluate-panel-header .text-h6 {
  margin: 0;
  font-weight: 500;
  color: #1a1a1a;
}

.evaluate-panel-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  height: calc(100vh - 100px);
  width: 100%;
  background: #fafafa;
  box-sizing: border-box;
  min-height: 0;
  padding: 8px 4px;
}

/* 确保popup能正常显示在评估面板上方 */
.q-popup-proxy {
  z-index: 9001 !important;
}

.evaluate-panel .q-popup-proxy {
  z-index: 9001 !important;
}

.q-menu {
  z-index: 9001 !important;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .rubric-container.compressed {
    flex: 0 0 55%;
    max-width: 55%;
  }

  .evaluate-panel {
    flex: 0 0 45%;
    max-width: 45%;
  }

  /* 中等屏幕下的工具栏位置调整 */
  .rubric-container.compressed .criterion-row-toolbar {
    left: calc(-55vw + 12px);
  }
}

@media (max-width: 768px) {
  .main-layout {
    flex-direction: column;
  }

  .rubric-container {
    height: 50vh;
    min-height: 300px;
  }

  .evaluate-panel {
    height: 50vh;
    min-height: 300px;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
  }

  .resizer {
    width: 100%;
    height: 6px;
    cursor: row-resize;
    flex-direction: row;
  }

  .resizer-line {
    width: 100%;
    height: 2px;
  }
}

@media (max-width: 480px) {
  .evaluate-panel-header {
    padding: 12px 16px;
  }

  .evaluate-panel {
    flex: 0 0 60vh;
    height: 60vh;
  }
}

.criterion-row-toolbar {
  position: absolute;
  left: calc(-100vw + 84px);
  top: -12%;
  transform: translateY(-50%);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px 12px 0px 0px;
  border: none;
  z-index: 1000;
  display: flex;
  align-items: center;
  white-space: nowrap;
  max-width: max-content;
  pointer-events: auto;
  opacity: 0;
  animation: fadeInLeft 0.2s ease-out forwards;
}

/* 压缩模式下的工具栏位置调整 */
.rubric-container.compressed .criterion-row-toolbar {
  left: calc(-60vw + 42px); /* 压缩模式下的位置 */
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

@keyframes fadeInLeft {
  from {
    opacity: 0;
    transform: translate(-10px, -50%);
  }
  to {
    opacity: 1;
    transform: translate(0, -50%);
  }
}

.criterion-row-toolbar .q-btn {
  color: white !important;
  margin: 2px 0px;
  border-radius: 12px 12px 0px 0px;
  flex-shrink: 0;
  font-size: 13px;
  min-width: auto;
  font-weight: 500;
}

.criterion-row-toolbar .q-btn .q-btn__content {
  line-height: 1.2;
}

.q-btn .q-icon {
  margin-right: 4px !important;
}

.criterion-row-toolbar .q-btn:hover {
  background-color: rgba(255, 255, 255, 0.2) !important;
}

.q-btn-dropdown--simple * + .q-btn-dropdown__arrow {
  margin-left: 0px !important;
}

/* 优化布局滚动 */
.q-tab-panel {
  padding: 0 !important;
  height: 100vh !important;
  overflow: hidden !important;
}

.q-page-container {
  height: 100vh !important;
  overflow: hidden !important;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* 自动保存时间显示样式 */
.save-time-indicator {
  display: flex;
  align-items: center;
  opacity: 0.8;
}

.fade-in-save-time-enter-active {
  transition: all 0.4s ease;
}

.fade-in-save-time-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.fade-in-save-time-enter-to {
  opacity: 0.8;
  transform: translateX(0);
}

.rubric-container::-webkit-scrollbar {
  width: 6px;
}

.rubric-container::-webkit-scrollbar-track {
  background: transparent;
}

.rubric-container::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.rubric-container::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.4);
}



/* 面板过渡效果 */
.rubric-container,
.evaluate-panel {
  transition: width 0.2s ease;
}

.rubric-container.collapsed .collapsed-title,
.evaluate-panel.collapsed .collapsed-title {
  transition: opacity 0.2s ease;
}

.full-content {
  transition: opacity 0.2s ease;
}
</style>
