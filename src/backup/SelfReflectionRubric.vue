<template>
  <div class="text-h6 text-bold q-mx-lg q-px-sm q-my-sm flex justify-between" style="color: rgb(70, 70, 70);">
    <div>
      {{ modelName }} - Control 1: Self-Reflection with Rubric
    </div>
    <div>
      <q-btn unelevated rounded outline no-caps class="q-ml-md" color="primary" icon="history" label="History" @click="showHistory = true" />
    </div>
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
            :subtitle="record.rubricName || 'Unknown Rubric'"
            :color="index === historyRecords.length - 1 ? 'primary' : 'secondary'"
          >
            <div>
              <q-card flat bordered>
                <!-- 内容预览 -->
                <q-card-section>
                  <div class="text-body2 content-preview">{{ record.content }}</div>
                </q-card-section>

                <!-- 操作按钮 -->
                <q-card-actions align="right">
                  <q-btn flat color="primary" label="Restore this version" @click="restoreContent(record)" />
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

  <div class="editor-container">
    <!-- 写作编辑器 -->
    <div class="writing-editor" :style="{ width: leftPanelWidth + '%' }">
      <div v-if="leftPanelWidth < minPanelWidthForContent" class="collapsed-title">
        <div class="collapsed-title-text">Writing</div>
      </div>
      <form v-else class="writing-form" autocorrect="off" autocapitalize="off" autocomplete="off" spellcheck="false">
        <DiffViewer
          :originalText="writingContent"
          :modifiedTexts="[]"
          :versionVisibility="{}"
          :versionColorMap="{}"
          @update:originalText="handleContentUpdate"
        />
      </form>
    </div>

    <!-- 可拖拽的分隔条 -->
    <div
      class="resizer"
      @mousedown="startResize"
      @dblclick="resetToDefault"
    >
      <div class="resizer-line"></div>
      <div class="resizer-tooltip">
        <q-icon name="drag_indicator" size="16px" color="grey-6" />
      </div>
    </div>

    <!-- 右侧区域 -->
    <div class="feedback-panel" :style="{ width: rightPanelWidth + '%' }">
      <div v-if="rightPanelWidth < minPanelWidthForContent" class="collapsed-title">
        <div class="collapsed-title-text">Rubric</div>
      </div>
      <template v-else>
        <!-- Criteria 选择区域 -->
        <q-card flat class="criteria-section">
          <q-select
            outlined dense style="width: 100%;" label="Choose a rubric"
            v-model="selectedCriteria"
            :options="criteriaOptions"
          >
            <template v-slot:before>
              <q-icon color="primary" name="rule" />
            </template>
          </q-select>
        </q-card>

        <!-- 自我反思区域 -->
        <q-expansion-item v-if="selectedRubric" class="feedback-container" default-opened
          header-class="text-primary text-subtitle1"
        >
          <template v-slot:header>
            <q-item-section avatar>
              <q-icon color="primary" name="sym_o_rubric" />
            </q-item-section>
            <q-item-section>
              Self-Reflection Rubric
            </q-item-section>
          </template>
          <div class="feedback-section">
            <div class="self-reflection-info q-mb-md">
              <q-banner class="bg-blue-1 text-blue-9" rounded>
                <template v-slot:avatar>
                  <q-icon name="info" color="blue" />
                </template>
                Use this rubric to self-assess your writing. Review each criterion and reflect on how well your work meets these standards.
              </q-banner>
            </div>

            <div>
              <table class="rubric-table">
                <thead class="rubric-table-header">
                  <tr>
                    <th class="dimension-cell">Criteria</th>
                    <th v-for="score in scoreRange" :key="score">Score: {{ score }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(dimension, index) in selectedRubric.rubric" :key="index">
                    <td class="dimension-cell">
                      <div class="dimension-content">
                        <div class="">{{ dimension.dimension }}
                          <q-tooltip anchor="center right" self="center left" :offset="[10, 0]" class="dimension-tooltip">
                            <div class="dimension-tooltip-content">
                              <div class="text-subtitle1 q-mb-xs">{{ dimension.dimension }}</div>
                              <div class="text-caption">{{ dimension.description }}</div>
                              <div class="text-caption">Weight: {{ dimension.percentage }}%</div>
                            </div>
                          </q-tooltip>
                        </div>
                      </div>
                    </td>
                    <td v-for="score in scoreRange" :key="score" class="criteria-cell">
                      <div v-for="(criterion, cIndex) in dimension.criteria" :key="cIndex" class="criterion-item">
                        <div class="criterion-text">
                          {{ criterion[`score_${score}`].text }}
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div class="self-reflection-actions q-mt-md">
                <q-btn
                  unelevated rounded color="primary"
                  label="Save Current Version"
                  @click="saveCurrentVersion"
                  icon="save"
                />
              </div>
            </div>
          </div>
        </q-expansion-item>

      </template>
    </div>
  </div>
</template>

<script>
import DiffViewer from 'src/components/DiffViewer.vue';

export default {
  name: 'SelfReflectionRubric',
  components: {
    DiffViewer
  },
  props: {
    modelName: String,
    criteriaList: Array,
    content: String,
  },
  data() {
    return {
      writingContent: '',
      selectedCriteria: null,
      selectedRubric: null,
      historyRecords: [],
      showHistory: false,

      // 布局控制
      leftPanelWidth: 54,  // 默认左侧宽度54%
      rightPanelWidth: 46, // 默认右侧宽度46%
      minPanelWidthForContent: 10, // 显示collapsed-title的宽度百分比
      absoluteMinPanelWidth: 4, // 绝对最小宽度百分比（拖拽限制）
      isResizing: false
    };
  },
  computed: {
    criteriaOptions() {
      return this.criteriaList.map(criteria => ({
        label: criteria.name,
        value: criteria.content
      }))
    },
    scoreRange() {
      if (!this.selectedRubric) return [];
      const count = this.selectedRubric.columnCount;
      return Array.from({length: count}, (_, i) => count - i);
    },
    columnWidth() {
      if (!this.selectedRubric) return '33%';
      const totalColumns = this.selectedRubric.columnCount;
      return `${100 / totalColumns}%`;
    }
  },
  watch: {
    selectedCriteria(newCriteria) {
      console.log('SelectedCriteria:', this.selectedCriteria.value);
      this.selectedRubric = JSON.parse(JSON.stringify(this.selectedCriteria.value));
      console.log('selectedRubric:', this.selectedRubric);
    },
    writingContent: {
      handler(newContent, oldContent) {
        console.log('Writing content updated:', newContent);
      },
      deep: false
    }
  },
  async mounted() {
    this.writingContent = this.content;

    // 从 URL hash 中获取 rubric 名称并设置
    const hash = window.location.hash;
    const queryIndex = hash.indexOf('?');
    if (queryIndex !== -1) {
      const queryString = hash.substring(queryIndex);
      const urlParams = new URLSearchParams(queryString);
      const rubricName = urlParams.get('rubric');

      if (rubricName) {
        const decodedRubricName = decodeURIComponent(rubricName);
        this.$watch('criteriaOptions', (newOptions) => {
          if (newOptions && newOptions.length > 0) {
            const criteriaOption = newOptions.find(c => c.label === decodedRubricName);
            if (criteriaOption) {
              this.selectedCriteria = criteriaOption;
            }
          }
        }, { immediate: true });
      }
    }
  },
  methods: {
    handleContentUpdate(newContent) {
      this.writingContent = newContent;
    },

    saveCurrentVersion() {
      const newRecord = {
        content: this.writingContent,
        timestamp: new Date().toLocaleString(),
        rubricName: this.selectedCriteria?.label || 'Unknown Rubric',
      };

      // 检查是否与最新记录相同
      const latestRecord = this.historyRecords[this.historyRecords.length - 1];
      if (latestRecord && latestRecord.content === this.writingContent) {
        this.$q.notify({
          type: 'info',
          message: 'No changes detected since last save',
          position: 'top'
        });
        return;
      }

      this.historyRecords.push(newRecord);
      console.log('Saved current version:', newRecord);

      this.$q.notify({
        type: 'positive',
        message: 'Current version saved successfully',
        position: 'top',
        icon: 'save'
      });
    },

    restoreContent(record) {
      this.writingContent = record.content;

      // 如果有对应的rubric，尝试恢复rubric选择
      if (record.rubricName && this.criteriaOptions) {
        const matchingCriteria = this.criteriaOptions.find(option => option.label === record.rubricName);
        if (matchingCriteria) {
          this.selectedCriteria = matchingCriteria;
        }
      }

      this.showHistory = false;
      console.log('Restored content from history:', record.timestamp);

      this.$q.notify({
        type: 'positive',
        message: 'Content restored from history',
        position: 'top',
        icon: 'history'
      });
    },

    startResize(event) {
      this.isResizing = true;
      const startX = event.clientX;
      const containerWidth = document.querySelector('.editor-container').offsetWidth;
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
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', resize);
      document.addEventListener('mouseup', endResize);
    },

    resetToDefault() {
      this.leftPanelWidth = 54;
      this.rightPanelWidth = 46;
    }
  },
};
</script>

<style scoped>
.editor-container {
  display: flex;
  justify-content: space-between;
  height: 88vh;
}

.writing-editor {
  padding: 0px 16px 0px 32px;
  min-width: 0;
  overflow: hidden;
  transition: width 0.2s ease;
}

.writing-form {
  height: 100%;
}

.feedback-panel {
  padding: 0px 8px;
  border-radius: 12px;
  display: flex;
  font-size: .875rem;
  flex-direction: column;
  background-color: rgb(249, 250, 251);
  overflow-y: auto;
  min-width: 0;
  transition: width 0.2s ease;
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
  background-color: #f5f5f5;
  border-radius: 8px;
  writing-mode: vertical-lr;
  text-orientation: mixed;
}

.collapsed-title-text {
  font-size: 16px;
  font-weight: bold;
  color: #666;
  letter-spacing: 2px;
}

/* 容器样式 */
.feedback-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}


/* 内容区域样式 */
.criteria-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0px 4px;
  flex-shrink: 0;
}

.feedback-section {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  padding: 0px 4px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.self-reflection-info {
  margin-bottom: 16px;
}

.self-reflection-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 8px 0;
}

/* 确保expansion item header样式统一 */
:deep(.q-expansion-item__header) {
  min-height: 48px;
  padding: 8px;
  background-color: #d3dcfd;
  margin-bottom: 4px;
  border-radius: 8px;
}

:deep(.q-expansion-item__header:hover) {
  background-color: #eeeeee;
}

.dimension-tooltip {
  font-size: 16px !important;
  max-width: 360px;
  background: white;
  color: #333;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-radius: 8px;
}

.dimension-tooltip-content {
  font-size: 16px !important;
  max-width: 560px;
  padding: 2px;
  line-height: 1.6;
  word-wrap: break-word;
}

.rubric-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.rubric-table-header {
  font-size: 14px;
  height: 32px;
}

.rubric-table th,
.rubric-table td {
  border: 1px solid #ddd;
  padding: 0px;
}

.rubric-table th {
  background-color: #f5f5f5;
  font-weight: bold;
  text-align: center;
}

.dimension-cell {
  width: 0%;
  font-size: 14px;
  background-color: #f8f9fa;
}

.criteria-cell {
  width: v-bind(columnWidth);
  position: relative;
  transition: all 0.3s ease;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.dimension-content {
  font-size: 14px;
  padding: 0px 4px;
}

.criterion-item {
  padding: 4px;
  display: flex;
  flex-direction: row;
}

.criterion-text {
  min-height: 1.5em;
  line-height: 1.4;
  overflow-y: auto;
  padding-left: 4px;
}

/* 美化滚动条 */
.criterion-text::-webkit-scrollbar {
  width: 4px;
}

.criterion-text::-webkit-scrollbar-thumb {
  background-color: #ccc;
  border-radius: 2px;
}

.criterion-text::-webkit-scrollbar-track {
  background-color: #f5f5f5;
}

/* 历史记录时间线样式 */
:deep(.q-timeline) {
  padding: 16px;
}

:deep(.q-timeline__entry) {
  padding-bottom: 24px;
}

:deep(.q-timeline__entry--icon) {
  padding-left: 48px;
}

:deep(.q-timeline__dot) {
  font-size: 24px;
}

:deep(.q-timeline__title) {
  font-size: 16px;
  font-weight: 500;
  color: #1976D2;
}

:deep(.q-timeline__subtitle) {
  font-size: 14px;
  color: #666;
}

:deep(.q-card) {
  margin: 8px 0;
  border-radius: 8px;
}

:deep(.q-card__section) {
  padding: 12px 16px;
}

:deep(.q-card__actions) {
  padding: 8px 16px;
}

.content-preview {
  max-height: 160px;
  overflow: auto;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  line-height: 1.4;
}

/* 自定义banner样式 */
:deep(.q-banner) {
  border-radius: 8px;
}

/* 反思笔记区域样式 */
:deep(.q-expansion-item:nth-child(2) .q-expansion-item__header) {
  background-color: #f3e5f5;
}
</style>
