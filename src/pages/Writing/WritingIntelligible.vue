<template>
  <!-- <div class="text-h6 text-bold q-mx-lg q-px-sm q-my-sm flex justify-between" style="color: rgb(70, 70, 70);">
    <div>
      {{ modelName }}
      <q-btn unelevated rounded outline no-caps style="margin-left: 64px;" color="primary" icon="history" label="History" @click="showHistory = true" />
    </div>
    <div class="row items-center">
      <div class="criteria-section">
        <q-select
          outlined dense style="width: 440px;" label="Choose a rubric"
          v-model="selectedCriteria"
          :options="criteriaOptions"
        >
        <template v-slot:before>
          <q-icon color="primary" name="rule" />
        </template>
        </q-select>
        <q-btn unelevated outline rounded no-caps class="q-ml-md" color="primary" label="Edit Rubric" @click="openCriteriaMaker" />
      </div>
    </div>
  </div> -->
  <!-- <q-btn unelevated rounded outline no-caps class="q-ml-md" color="secondary" icon="download" label="Save this session" @click="saveData" /> -->
  <!-- <q-toggle
    v-model="userScoringEnabled"
    class="q-ml-md"
    color="primary"
    label="Enable User Scoring"
  /> -->


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
            :subtitle="'Score: ' + (record.scores?.aiScorePercentage || '--') + '% | ' + (record.rubricName || 'Unknown Rubric')"
            :color="index === historyRecords.length - 1 ? 'primary' : 'secondary'"
          >
            <div>
              <q-card flat bordered>
                <!-- 内容预览 -->
                <q-card-section>
                  <div class="text-body2 content-preview">{{ record.content }}</div>
                </q-card-section>

                <!-- 详细评分信息 -->
                <q-expansion-item
                  v-if="record.scores"
                  icon="assessment"
                  label="Score Details"
                  header-class="text-primary"
                >
                  <q-card-section class="q-pt-none">
                    <!-- 总分概览 -->
                    <div class="score-summary q-mb-md">
                      <div class="text-subtitle2 text-weight-bold">Score Summary</div>
                      <div class="row q-gutter-md">
                        <q-chip color="primary" text-color="white">
                          Score: {{ record.scores.totalAIScore.toFixed(1) }}/{{ record.scores.totalMaxScore }} ({{ record.scores.aiScorePercentage }}%)
                        </q-chip>
                      </div>
                    </div>

                    <!-- 各维度详细评分 -->
                    <div class="dimensions-detail">
                      <div class="text-subtitle2 text-weight-bold q-mb-sm">Dimension-wise Scores</div>
                      <div v-for="(dimension, dimIndex) in record.scores.dimensions" :key="dimIndex" class="dimension-card q-mb-sm">
                        <q-expansion-item
                          :label="dimension.name"
                          :caption="`Score: ${dimension.aiScore.toFixed(1)}/${dimension.maxScore} (Weight: ${dimension.weight}%)`"
                          dense
                        >
                          <div class="criteria-details q-px-xs">
                            <div v-for="(criterion, criIndex) in dimension.criteria" :key="criIndex" class="criterion-item q-mb-xs">
                              <div class="row q-ml-sm">
                                <q-badge
                                  v-if="criterion.aiSelectedScore > 0"
                                  color="primary"
                                  :label="`Score: ${criterion.aiSelectedScore}`"
                                />
                              </div>
                              <!-- 显示选中的评分标准内容 -->
                              <div v-if="criterion.aiSelectedScore > 0" class="text-caption text-grey-7 q-ml-sm q-mt-xs">
                                Score Criteria: {{ criterion.scoreDetails[`score_${criterion.aiSelectedScore}`]?.text }}
                              </div>
                              <div v-if="criterion.scoreDetails[`score_${criterion.aiSelectedScore}`]?.reason" class="text-caption text-orange-8 q-ml-sm">
                                Reason: {{ criterion.scoreDetails[`score_${criterion.aiSelectedScore}`].reason }}
                              </div>
                            </div>
                          </div>
                        </q-expansion-item>
                      </div>
                    </div>
                  </q-card-section>
                </q-expansion-item>

                <!-- Counterfactual点击记录 -->
                <q-expansion-item
                  v-if="record.counterfactualClicks && record.counterfactualClicks.length > 0"
                  icon="auto_fix_high"
                  :label="`Suggested Revisions (${record.counterfactualClicks.length})`"
                  header-class="text-secondary"
                >
                  <q-card-section class="q-pt-none">
                    <div class="suggested-revisions">
                      <div v-for="(click, clickIndex) in record.counterfactualClicks" :key="clickIndex" class="click-item q-mb-xs">
                        <q-chip
                          color="orange"
                          text-color="white"
                          size="sm"
                          :label="click.key"
                        />
                        <span class="text-caption text-grey-6 q-ml-sm">
                          {{ new Date(click.timestamp).toLocaleTimeString() }}
                        </span>
                      </div>
                    </div>
                  </q-card-section>
                </q-expansion-item>

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
        <div class="text-h6 text-bold  q-px-sm q-my-sm flex justify-between" style="color: rgb(70, 70, 70);">
          <div>
            {{ modelName }}
          </div>
          <q-btn unelevated rounded outline no-caps style="margin-left: 64px;" color="primary" icon="history" label="History" @click="showHistory = true" />
        </div>
        <DiffViewer
          :originalText="writingContent"
          :modifiedTexts="editedEditorVisibleContent"
          :versionVisibility="versionVisibility"
          :versionColorMap="reactiveVersionColorMap"
          @update:originalText="(val) => { writingContent = val; try { usageLogger.updateWritingContent(writingContent, { source: 'DiffViewer@update' }) } catch (e) {} }"
          @delete-version="handleVersionAutoDelete"
        />
      </form>
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

    <!-- 右侧区域 -->
    <div class="feedback-panel" :style="{ width: rightPanelWidth + '%' }">
      <div v-if="rightPanelWidth < minPanelWidthForContent" class="collapsed-title">
        <div class="collapsed-title-text">Rubric</div>
      </div>
      <template v-else>
          <!-- Criteria 选择区域 -->
          <q-card flat class="criteria-section">
            <q-select
              outlined dense style="width: 440px;" label="Choose a rubric"
              v-model="selectedCriteria"
              :options="criteriaOptions"
            >
            <template v-slot:before>
              <q-icon color="primary" name="list" />
            </template>
            </q-select>
            <q-btn unelevated outline rounded no-caps class="q-ml-md" color="primary" label="Edit Rubric" @click="openCriteriaMaker" />
          </q-card>
          <!-- <q-btn unelevated rounded outline no-caps class="q-ml-md" color="secondary" icon="download" label="Save this session" @click="saveData" /> -->
          <!-- <q-toggle
            v-model="userScoringEnabled"
            class="q-ml-md"
            color="primary"
            label="Enable User Scoring"
          /> -->

        <!-- 评论和反馈区域 -->
        <q-expansion-item v-if="selectedRubric" class="feedback-container" default-opened
          header-class="text-primary text-subtitle1"
        >
          <template v-slot:header>
            <q-item-section avatar>
              <q-icon color="primary" name="sym_o_rubric" />
            </q-item-section>
            <q-item-section>
              Rubric of Writing: {{ selectedCriteria.label.toUpperCase() }}
            </q-item-section>

            <q-item-section side>
              <div class="row items-center text-weight-bold text-black">
                {{ 'Score: ' + (scores?.totalAIScore ? scores.totalAIScore.toFixed(1) : '--') + '/' + scores?.totalMaxScore + ' (' + scores?.aiScorePercentage + '%)' + (userScoringEnabled ? ' | User Score: ' + (scores?.totalUserScore ? scores.totalUserScore.toFixed(1) : '--') + '/' + scores?.totalMaxScore + ' (' + scores?.userScorePercentage + '%)' : '') }}
              </div>
            </q-item-section>
          </template>
          <div class="feedback-section">
            <!-- <div class="q-mb-xs">
              <q-banner class="bg-blue-1 text-blue-9" rounded>
                <template v-slot:avatar>
                  <q-icon name="assessment" color="blue" />
                </template>
                The writing will be evaluated against each rubric criterion with scores and detailed explanations and suggestions.
              </q-banner>
            </div> -->

            <div v-if="scores?.totalAIScore" class="score-section">
              <div class="score-display">
                <div class="score-circle" :class="getScoreColorClass(scores.totalAIScore.toFixed(1))">
                  <div class="score-number">{{ scores.totalAIScore.toFixed(1) || '--' }}</div>
                  <div class="score-total">/100</div>
                </div>
                <div class="score-description">
                  <div class="text-h6 text-weight-bold">Overall Score:</div>
                  <div class="text-body2 text-grey-7">{{ getScoreDescription(scores.totalAIScore.toFixed(1)) }}</div>
                  <div class="text-caption text-grey-6">
                    {{ scores.aiScorePercentage }}% - {{ getScoreStatusText(scores.totalAIScore.toFixed(1)) }}
                  </div>
                </div>
              </div>
            </div>
            <div >
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
                    <td v-for="score in scoreRange" :key="score" class="criteria-cell" :class="{ 'selected-cell': isCellSelected(dimension, score) }" >
                      <div v-for="(criterion, cIndex) in dimension.criteria" :key="cIndex" class="criterion-item" :data-index="cIndex"
                        @mouseenter="onRubricCellHoverStart(dimension.dimension, score, cIndex)"
                        @mouseleave="onRubricCellHoverEnd(dimension.dimension, score, cIndex)"
                        @click="onRubricCellClick(dimension.dimension, score, cIndex)"
                      >
                        <div class="criterion-text text-truncated"
                          :class="{ 'criteria-text-clickable': criterion[`score_${score}`].reason }"
                          :style="getCellBorderColor(dimension, score) ? { borderLeft: `4px solid ${getCellBorderColor(dimension, score)}` } : {}"
                        >
                          {{ criterion[`score_${score}`].text }}
                        </div>
                        <q-tooltip v-if="criterion[`score_${score}`].reason" anchor="top middle" self="bottom middle" :offset="[10, 10]">
                          <div class="flex row">
                            <q-icon name="question_mark" color="yellow-6" size="14px" class="q-mr-xs"/>
                            Click to view the reason of {{ criterion[`score_${score}`].checked ? 'why' : 'why not' }} getting score {{ score }}
                          </div>
                        </q-tooltip>
                        <q-popup-proxy>
                          <div class="dimension-popup-content bg-grey-1" v-if="criterion[`score_${score}`].reason">
                            <div class="flex column">
                              <div class="text-weight-bold q-my-xs">
                                <q-icon name="help_outline" color="orange-4" size="24px" class="q-mr-xs"/>
                                {{ 'Reason of ' + (criterion[`score_${score}`].checked ? 'why' : 'why not') + ' getting score ' + score + ': ' }}
                              </div>
                              <div class="text-body3" v-html="renderMarkdown(criterion[`score_${score}`].reason)"></div>
                            </div>
                            <q-btn rounded outline no-caps color="orange-8" v-if="shouldShowPopup(criterion, score)" class="q-mr-sm" :icon="'img:icons/spark-32x32.png'" @click="generateCounterfactual(dimension, criterion, score, cIndex)" :loading="isPopupLoading(dimension, criterion, score, cIndex)" :disable="isCounterfactualDisabled(dimension, score)">
                              An example of score {{ score }}
                            </q-btn>
                          </div>
                        </q-popup-proxy>
                        <!-- <q-tooltip
                          anchor="top middle" self="bottom middle" :offset="[10, 10]"
                          class="dimension-tooltip"
                        >
                          <div class="dimension-tooltip-content">
                            <div class="text-weight-bold q-mb-xs">{{ dimension.dimension + ' : ' + `score_${score}` }}</div>
                            <div class="text-caption">{{ criterion[`score_${score}`].text }}</div>

                            <div v-if="criterion[`score_${score}`].reason" class="text-weight-bold q-my-xs">{{ 'Reason of ' + (criterion[`score_${score}`].checked ? 'why' : 'why not') + ' getting score ' + score + ': ' }}</div>
                            <div class="text-caption" v-html="renderMarkdown(criterion[`score_${score}`].reason)"></div>
                          </div>
                        </q-tooltip> -->
                      </div>
                      <!-- 选中状态的对勾图标 -->
                      <div v-if="isCellSelected(dimension, score)" class="cell-check-mark">
                        <q-icon name="check" color="white" size="14px" />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div class="feedback-actions">
                <q-btn
                  class="q-mr-sm"
                  v-if="editedEditorVisibleContent.length > 0"
                  unelevated rounded outline no-caps
                  color="secondary"
                  icon="compare_arrows"
                  :label="showVersionSelector ? 'Hide Suggested Revisions' : 'Show Suggested Revisions'"
                  @click="toggleVersionsVisibility"
                />
                <q-btn unelevated rounded color="primary" icon="assessment" label="Get Assessment" @click="sendContent" :loading="feedbackLoading"/>
              </div>

            </div>
          </div>
        </q-expansion-item>
        <!-- Counterfactual examples selector -->
        <q-dialog v-model="shouldShowVersionSelector" seamless position="bottom">
          <q-card class="version-selector-dialog">
            <div class="version-selector-header">
              <div class="text-subtitle2 text-weight-medium">Suggested Revisions</div>
              <q-btn flat dense round icon="close" size="sm" @click="toggleVersionsVisibility" />
            </div>
            <div class="version-selector">
              <div v-for="(text, index) in editedEditorVisibleContent" :key="`version-${index}`" class="version-item">
                <q-checkbox
                  v-model="versionVisibility[index + 1]"
                  keep-color
                  :color="getVersionColor(text.name)"
                  @update:model-value="(value) => handleVersionToggle(value, index)"
                >
                  <q-badge
                    outline
                    :color="getVersionColor(text.name)"
                    class="version-badge"
                  >
                    {{ text.name }}
                  </q-badge>
                </q-checkbox>
                <q-btn flat dense icon="delete" @click="handleVersionDelete(index + 1)" :color="getVersionColor(text.name)" />
              </div>
            </div>
          </q-card>
        </q-dialog>
      </template>
    </div>
  </div>

</template>

<script>
import { getRubricBasedFeedback, generateRevisedWriting, generateCounterfactualWriting, computeTrueDiffGroup,getAgents, formatDateTime, getRubric } from 'src/components/multiAgentWriting.js'
import { formatToString, extractRevisedWriting, extractRevisedWritingWithReason, formatDiffGroups, formatToNewString } from 'src/components/utilsWriting.js'
import { localAPI } from 'boot/axios'
import MarkdownIt from 'markdown-it';
import DiffViewer from 'src/components/DiffViewer.vue';
import urlParamsStore from 'src/store/urlParams.js';
import usageLogger from 'src/store/usageLogger.js';

export default {
  name: 'WritingIntelligible',
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
      editedEditorVisibleContent: [],
      feedbackLoading: false,

      editorRef: null,
      selectedCriteria: null,
      selectedRubric: null,

      historyRecords: [],
      showHistory: false,
      showVersionSelector: false,

      scores: null,  // 添加到 data 中
      currentCounterfactualClicks: [], // 记录当前轮次的counterfactual点击

      popupLoading: {}, // 添加这个来跟踪每个popup的loading状态

      userScoringEnabled: false,
      md: null,

      // 版本管理相关
      versionVisibility: {},
      versionColorMap: {}, // 存储版本名称到颜色索引的映射
      usedColorIndices: new Set(), // 跟踪已使用的颜色索引

      // 颜色常量
      COLOR_PALETTE: [
        { underline: 'bg-red-1', strike: 'text-red', border: 'border-red' },
        { underline: 'bg-green-1', strike: 'text-green', border: 'border-green' },
        { underline: 'bg-blue-1', strike: 'text-blue', border: 'border-blue' },
        { underline: 'bg-amber-1', strike: 'text-amber', border: 'border-amber' },
        { underline: 'bg-purple-1', strike: 'text-purple', border: 'border-purple' },
        { underline: 'bg-pink-1', strike: 'text-pink', border: 'border-pink' },
        { underline: 'bg-cyan-1', strike: 'text-cyan', border: 'border-cyan' },
        { underline: 'bg-teal-1', strike: 'text-teal', border: 'border-teal' },
        { underline: 'bg-orange-1', strike: 'text-orange', border: 'border-orange' },
        { underline: 'bg-indigo-1', strike: 'text-indigo', border: 'border-indigo' },
        { underline: 'bg-deep-purple-1', strike: 'text-deep-purple', border: 'border-deep-purple' },
        { underline: 'bg-light-blue-1', strike: 'text-light-blue', border: 'border-light-blue' },
        { underline: 'bg-light-green-1', strike: 'text-light-green', border: 'border-light-green' },
        { underline: 'bg-yellow-1', strike: 'text-yellow-9', border: 'border-yellow' },
        { underline: 'bg-deep-orange-1', strike: 'text-deep-orange', border: 'border-deep-orange' },
      ],
      COLOR_NAMES: ['red', 'green', 'blue', 'amber', 'purple', 'pink', 'cyan', 'teal', 'orange', 'indigo', 'deep-purple', 'light-blue', 'light-green', 'yellow', 'deep-orange'],

      // 布局控制
      leftPanelWidth: 54,  // 默认左侧宽度54%
      rightPanelWidth: 46, // 默认右侧宽度46%
      minPanelWidthForContent: 10, // 显示collapsed-title的宽度百分比
      absoluteMinPanelWidth: 4, // 绝对最小宽度百分比（拖拽限制）
      isResizing: false
    };
  },
  computed: {
    shouldShowVersionSelector: {
      get() {
        return this.editedEditorVisibleContent.length > 0 && this.showVersionSelector;
      },
      set(value) {
        this.showVersionSelector = value;
      }
    },
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
      if (!this.selectedRubric) return '33%';  // 默认值
      const totalColumns = this.selectedRubric.columnCount;
      return `${100 / (totalColumns)}%`;  // +1 是因为还有一列维度列
    },
    // 计算属性确保响应式传递
    reactiveVersionColorMap() {
      // 在Vue 3中，直接返回响应式对象即可
      // 添加Object.keys()依赖确保计算属性在对象键变化时重新计算
      const keys = Object.keys(this.versionColorMap);
      return { ...this.versionColorMap };
    }
  },
  watch: {
    selectedCriteria(newCriteria) {
      console.log('SelectedCriteria:', this.selectedCriteria.value);
      this.selectedRubric = JSON.parse(JSON.stringify(this.selectedCriteria.value));
      console.log('selectedRubric:', this.selectedRubric);

      // 更新URL参数
      if (newCriteria && newCriteria.label) {
        urlParamsStore.updateUrlParams({ writingRubric: newCriteria.label });
      }
      try { usageLogger.updateRubricSelection(newCriteria?.label, this.selectedRubric) } catch (e) {}
    },
    selectedRubric: {
      handler(newRubric) {
        if (newRubric) {
          this.scores = this.calculateScores(newRubric.rubric);
          console.log('Calculated scores:', this.scores);
          this.selectedRubric.rubric.forEach(dimension => {
            dimension.messageList = dimension.messageList || [];
          });
          this.editedEditorVisibleContent = [];
        }
      },
      deep: true  // 启用深度监听
    },
    editedEditorVisibleContent: {
      handler(newEditedEditorVisibleContent) {
        console.log('edited - Editor - Visible - Content:', newEditedEditorVisibleContent);
        // 当版本内容变化时，重新初始化可见性和颜色分配
        this.$nextTick(() => {
          // 为所有版本确保颜色分配
          newEditedEditorVisibleContent.forEach(version => {
            if (!(version.name in this.versionColorMap)) {
              this.assignColorToVersion(version.name);
            }
          });

          this.initializeVisibility();
          this.clearUnusedColors();
          // 当有新版本时自动显示版本选择器
          if (newEditedEditorVisibleContent.length > 0) {
            this.showVersionSelector = true;
          }
        });
      },
      deep: true
    },
    writingContent: {
      handler(newContent, oldContent) {
        console.log('Writing content updated:', newContent);
        // 这里可以添加其他需要在写作内容变化时执行的逻辑
      },
      deep: false
    }
  },
  async mounted() {
    this.writingContent = this.content;
    // 初始化 markdown 渲染器
    this.md = new MarkdownIt({
      html: true,
      breaks: true,  // 转换换行符为 <br>
      linkify: true
    });

    // 初始化版本管理
    this.initializeVisibility();

    // 解析URL参数
    urlParamsStore.parseUrlParams();

    // 设置rubric选择
    this.setupRubricFromUrl();

    usageLogger.init(urlParamsStore.getCurrentParams(), { page: 'WritingIntelligible', modelName: this.modelName })
    usageLogger.updateWritingContent(this.writingContent, { source: 'mounted' })
  },
  methods: {
    getScoreColorClass(score) {
      if (!score) return 'score-grey';
      if (score >= 85) return 'score-green';
      if (score >= 70) return 'score-orange';
      return 'score-red';
    },

    getScoreDescription(score) {
      if (!score) return 'No score available';
      if (score >= 85) return 'Excellent work';
      if (score >= 70) return 'Good work';
      if (score >= 60) return 'Satisfactory';
      return 'Needs improvement';
    },
    // 新增的分数状态文本方法
    getScoreStatusText(score) {
      if (!score) return 'Not evaluated';
      if (score >= 85) return 'High quality';
      if (score >= 70) return 'Moderate quality';
      if (score >= 60) return 'Basic quality';
      return 'Low quality';
    },
    setupRubricFromUrl() {
      // 获取URL中的writingRubric参数
      const urlRubricName = urlParamsStore.urlParams.writingRubric;

      // 等待criteriaOptions准备好
      this.$watch('criteriaOptions', (newOptions) => {
        if (newOptions && newOptions.length > 0) {
          let selectedOption = null;

          // 如果URL中有rubric参数，尝试匹配
          if (urlRubricName) {
            selectedOption = newOptions.find(c => c.label === urlRubricName);
          }

          // 如果没有匹配到或没有URL参数，选择第一个
          if (!selectedOption) {
            selectedOption = newOptions[0];
            // 更新URL参数为第一个rubric的名称
            if (selectedOption) {
              urlParamsStore.updateUrlParams({ writingRubric: selectedOption.label });
            }
          }

          // 设置选中的rubric
          if (selectedOption) {
            this.selectedCriteria = selectedOption;
          }
        }
      }, { immediate: true });
    },
    // 添加 markdown 渲染方法
    renderMarkdown(text) {
      if (!text) return '';
      return this.md.render(text);
    },
    isPopupLoading(dimension, criterion, score, cIndex) {
      const key = `${dimension.dimension} to score ${score}`;
      return this.popupLoading[key] === true;
    },
    isCounterfactualDisabled(dimension, score) {
      const key = `${dimension.dimension} to score ${score}`;
      return this.editedEditorVisibleContent.some(item => item.name === key);
    },
    async generateCounterfactual(dimension, criterion, score, cIndex) {
      const key = `${dimension.dimension} to score ${score}`;
      this.popupLoading[key] = true;

      // 记录用户的counterfactual点击
      const clickRecord = {
        key: key,
        dimension: dimension.dimension,
        targetScore: score,
        timestamp: new Date().toISOString(),
        criterionIndex: cIndex
      };
      this.currentCounterfactualClicks.push(clickRecord);

      try {
        const revisedWriting = await generateCounterfactualWriting(this.writingContent, criterion, dimension.dimension, score);
        const revisedWritingWithReason = extractRevisedWritingWithReason(revisedWriting.content);
        console.log('revisedWritingWithReason:', revisedWritingWithReason);

        const newVersion = {
          editedText: revisedWritingWithReason.revised_writing,
          reason: revisedWritingWithReason.reason,
          score: score,
          dimension: dimension.dimension,
          name: key,
          cIndex: cIndex
        };

        // 为新版本立即分配颜色
        this.assignColorToVersion(key);

        this.editedEditorVisibleContent.unshift(newVersion);
        usageLogger.log('generate_counterfactual', { dimension: dimension.dimension, targetScore: score, criterionIndex: cIndex }, { page: 'WritingIntelligible' })
      } finally {
        this.popupLoading[key] = false;
      }
    },
    async sendContent() {
      const userWriting = this.writingContent;
      console.log('sendContent', userWriting, this.selectedRubric.rubric);
      this.selectedRubric.rubric.forEach(dimension => {
        dimension.criteria.forEach(criterion => {
          if (criterion.score_1) criterion.score_1.checked = false;
          if (criterion.score_2) criterion.score_2.checked = false;
          if (criterion.score_3) criterion.score_3.checked = false;
          if (criterion.score_4) criterion.score_4.checked = false;
          if (criterion.score_5) criterion.score_5.checked = false;
          if (criterion.score_6) criterion.score_6.checked = false;
          delete criterion.score_1?.reason;
          delete criterion.score_2?.reason;
          delete criterion.score_3?.reason;
          delete criterion.score_4?.reason;
          delete criterion.score_5?.reason;
          delete criterion.score_6?.reason;
        });
      });
      const roundId = usageLogger.beginRound({ page: 'WritingIntelligible' })
      usageLogger.log('click_button', { id: 'get-assessment' }, { page: 'WritingIntelligible' })
      await this.getFeedbacksConcurrently(userWriting);
      // 保存到历史记录
      this.saveToHistory(userWriting);
      usageLogger.endRound(roundId, { scores: this.scores }, { page: 'WritingIntelligible' })
      usageLogger.saveNow()
    },
    async getFeedbacksConcurrently(userWriting) {
      const feedbackPromises = this.selectedRubric.rubric
        .map(rubricItem => getRubricBasedFeedback(userWriting, rubricItem, rubricItem.messageList, this.selectedRubric.columnCount, this.selectedRubric.taskDescription));

      try {
        this.feedbackLoading = true;
        const feedbacks = await Promise.all(feedbackPromises);

        console.log('------Feedbacks------:', feedbacks);

        feedbacks.forEach((feedback, index) => {
          const feedbackContent = JSON.parse(formatToString(feedback.content));
          console.log('feedback1111111111:', feedbackContent);
          if (!feedbackContent) return;

          try {
            // 使用 findIndex 找到第 index 个 checked 为 true 的项
            const rubricIndex = this.selectedRubric.rubric.reduce((acc, item, i) => {
              acc.push(i);
              return acc;
            }, [])[index];

            if (rubricIndex !== undefined) {
              this.selectedRubric.rubric[rubricIndex].criteria = feedbackContent;
            }
          } catch (e) {
            console.error('Error processing feedback:', e);
          }
        });
      } catch (error) {
        console.error('Error fetching feedbacks:', error);
        usageLogger.log('error', { scope: 'getFeedbacksConcurrently', message: String(error && error.message || error) }, { page: 'WritingIntelligible' })
      } finally {
        this.feedbackLoading = false;
        try { usageLogger.updateScores(this.scores) } catch (e) {}
      }
    },
    /**
     * Capture the <CTL-V> paste event, only allow plain-text, no images.
     * See: https://stackoverflow.com/a/28213320
     */
    onPaste (evt) {
      // Let inputs do their thing, so we don't break pasting of links.
      if (evt.target.nodeName === 'INPUT') return
      let text, onPasteStripFormattingIEPaste
      evt.preventDefault()
      evt.stopPropagation()
      if (evt.originalEvent && evt.originalEvent.clipboardData.getData) {
        text = evt.originalEvent.clipboardData.getData('text/plain')
        this.$refs.editorRef.runCmd('insertText', text)
      }
      else if (evt.clipboardData && evt.clipboardData.getData) {
        text = evt.clipboardData.getData('text/plain')
        this.$refs.editorRef.runCmd('insertText', text)
      }
      else if (window.clipboardData && window.clipboardData.getData) {
        if (!onPasteStripFormattingIEPaste) {
          onPasteStripFormattingIEPaste = true
          this.$refs.editorRef.runCmd('ms-pasteTextOnly', text)
        }
        onPasteStripFormattingIEPaste = false
      }
    },
    calculateScores(rubric) {
      const result = {
        totalMaxScore: 100,         // 总满分设为100，便于百分比计算
        totalUserScore: 0,          // 用户总得分（加权后）
        totalAIScore: 0,            // AI总得分（加权后）
        dimensions: []              // 每个维度的得分详情
      };

      rubric.forEach(dimension => {
        // 获取该维度的权重百分比，如果没有则平均分配
        const dimensionWeight = dimension.percentage || (100 / rubric.length);

        const dimensionScore = {
          name: dimension.dimension,
          weight: dimensionWeight,    // 维度权重
          rawMaxScore: 0,            // 维度内部原始满分
          rawUserScore: 0,           // 维度内部原始用户得分
          rawAiScore: 0,             // 维度内部原始AI得分
          weightedMaxScore: dimensionWeight,  // 加权满分（等于权重）
          weightedUserScore: 0,      // 加权用户得分
          weightedAiScore: 0,        // 加权AI得分
          criteria: []               // criteria级别的详细信息
        };

        // 计算每个子标准的分数
        dimension.criteria.forEach((subcriteria, criterionIndex) => {
          // 计算该子标准的满分
          const maxSubScore = this.selectedRubric.columnCount;
          dimensionScore.rawMaxScore += maxSubScore;

          // 为每个criterion创建详细记录
          const criterionDetail = {
            index: criterionIndex,
            aiSelectedScore: 0,
            userSelectedScore: 0,
            scoreDetails: {}
          };

          // 记录每个分数级别的详细信息
          this.scoreRange.forEach(score => {
            const scoreData = subcriteria[`score_${score}`];
            criterionDetail.scoreDetails[`score_${score}`] = {
              text: scoreData?.text || '',
              checked: scoreData?.checked || false,
              reason: scoreData?.reason || null
            };

            // 计算用户得分 - 只在启用用户评分时计算
            if (this.userScoringEnabled && scoreData?.userClick) {
              dimensionScore.rawUserScore += score;
              criterionDetail.userSelectedScore = score;
            }

            // 计算AI得分
            if (scoreData?.checked) {
              dimensionScore.rawAiScore += score;
              criterionDetail.aiSelectedScore = score;
            }
          });

          dimensionScore.criteria.push(criterionDetail);
        });

        // 计算加权分数
        if (dimensionScore.rawMaxScore > 0) {
          // 计算该维度内部的得分率
          const aiScoreRate = dimensionScore.rawAiScore / dimensionScore.rawMaxScore;
          const userScoreRate = dimensionScore.rawUserScore / dimensionScore.rawMaxScore;

          // 转换为加权分数
          dimensionScore.weightedAiScore = aiScoreRate * dimensionWeight;
          dimensionScore.weightedUserScore = userScoreRate * dimensionWeight;
        }

        // 累计到总分
        result.totalAIScore += dimensionScore.weightedAiScore;
        result.totalUserScore += dimensionScore.weightedUserScore;

        // 为了向后兼容，保留原有的 maxScore, aiScore, userScore 字段
        dimensionScore.maxScore = dimensionScore.weightedMaxScore;
        dimensionScore.aiScore = dimensionScore.weightedAiScore;
        dimensionScore.userScore = dimensionScore.weightedUserScore;

        // 添加维度得分详情
        result.dimensions.push(dimensionScore);
      });

      // 计算百分比
      result.aiScorePercentage = (result.totalAIScore / result.totalMaxScore * 100).toFixed(0);
      result.userScorePercentage = this.userScoringEnabled ?
        (result.totalUserScore / result.totalMaxScore * 100).toFixed(0) : '--';

      return result;
    },
    saveToHistory(content) {
      // 检查最新的记录是否与当前内容相同
      const latestRecord = this.historyRecords[this.historyRecords.length - 1];
      if (latestRecord && latestRecord.content === content) {
        return; // 如果内容相同，不保存
      }

      // 深拷贝scores以避免引用问题
      const scoresDeepCopy = JSON.parse(JSON.stringify(this.scores));

      // 深拷贝counterfactual点击记录
      const counterfactualClicksDeepCopy = JSON.parse(JSON.stringify(this.currentCounterfactualClicks));

      // 保存新记录
      const newRecord = {
        content: content,
        timestamp: new Date().toLocaleString(),
        scores: scoresDeepCopy,
        counterfactualClicks: counterfactualClicksDeepCopy,
        rubricName: this.selectedCriteria?.label || 'Unknown Rubric'
      };

      this.historyRecords.push(newRecord);
      console.log('Saved to history:', newRecord);
      usageLogger.log('save_history', { rubricName: newRecord.rubricName, scorePct: newRecord.scores?.aiScorePercentage }, { page: 'WritingIntelligible' })

      // 清空当前轮次的counterfactual点击记录，准备下一轮
      this.currentCounterfactualClicks = [];
    },
    restoreContent(record) {
      this.writingContent = record.content;
      this.editedEditorVisibleContent = [];

      // 清空当前的counterfactual点击记录
      this.currentCounterfactualClicks = [];

      // 如果有对应的rubric，可以尝试恢复rubric选择
      if (record.rubricName && this.criteriaOptions) {
        const matchingCriteria = this.criteriaOptions.find(option => option.label === record.rubricName);
        if (matchingCriteria) {
          this.selectedCriteria = matchingCriteria;
        }
      }

      this.showHistory = false;
      console.log('Restored content from history:', record.timestamp);
    },
    // 获取当前分数
    getCurrentScore(criterion) {
      const checkedEntry = Object.entries(criterion).find(([key, value]) => value.checked === true);
      return checkedEntry ? checkedEntry[0].replace('score_', '') : '--';
    },

    // 判断是否应该显示弹出框
    shouldShowPopup(criterion, targetScore) {
      // 检查是否有已评分的项
      const currentScore = this.getCurrentScore(criterion);
      if (currentScore === '--') return false;

      // 只有当目标分数与当前分数不同时才显示
      return parseInt(currentScore) !== targetScore;
    },

        // 获取单元格的边框颜色（如果有生成的counterfactual）
    getCellBorderColor(dimension, score) {
      const key = `${dimension.dimension} to score ${score}`;
      const hasCounterfactual = this.editedEditorVisibleContent.some(item => item.name === key);

      if (hasCounterfactual) {
        const colorName = this.getVersionColor(key);
        return this.getColorHexValue(colorName);
      }
      return null;
    },

    // 根据颜色名称获取对应的十六进制颜色值
    getColorHexValue(colorName) {
      const colorMap = {
        'red': '#f44336',
        'green': '#4caf50',
        'blue': '#2196f3',
        'amber': '#ff9800',
        'purple': '#9c27b0',
        'pink': '#e91e63',
        'cyan': '#00bcd4',
        'teal': '#009688',
        'orange': '#ff5722',
        'indigo': '#3f51b5',
        'deep-purple': '#673ab7',
        'light-blue': '#03a9f4',
        'light-green': '#8bc34a',
        'yellow': '#ffeb3b',
        'deep-orange': '#ff5722'
      };
      return colorMap[colorName] || '#666666';
    },
    openCriteriaMaker() {
      window.open(`https://jackwensen.github.io/diverse-feedback-llm/?task=rubric&condition=intelligible&userid=${this.currentUserId}&rubricRubric=${this.selectedCriteria.label}`, '_blank');
    },
    isCellSelected(dimension, score) {
      // 检查该维度的任何一个criterion在指定score下是否被选中
      return dimension.criteria.some(criterion => criterion[`score_${score}`].checked);
    },

    // 版本管理方法
    initializeVisibility() {
      const newVisibility = {};
      for (let i = 1; i <= this.editedEditorVisibleContent.length; i++) {
        newVisibility[i] = false; // 默认所有版本都不可见，实现单选模式
      }
      if (this.editedEditorVisibleContent.length > 0) {
        newVisibility[1] = true;
      }
      this.versionVisibility = newVisibility;
    },

    // 为版本分配颜色索引的函数
    assignColorToVersion(versionName) {
      // 基于版本名称生成初始哈希值
      let hash = 0;
      for (let i = 0; i < versionName.length; i++) {
        const char = versionName.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 转换为32位整数
      }

      let colorIndex = Math.abs(hash) % this.COLOR_NAMES.length;

      // 如果首选颜色已被使用，寻找下一个可用颜色
      while (this.usedColorIndices.has(colorIndex)) {
        colorIndex = (colorIndex + 1) % this.COLOR_NAMES.length;

        // 如果所有颜色都被使用，则重新开始（允许重复）
        if (this.usedColorIndices.size >= this.COLOR_NAMES.length) {
          break;
        }
      }

            // 记录颜色分配
      this.versionColorMap[versionName] = colorIndex;
      this.usedColorIndices.add(colorIndex);

      return colorIndex;
    },

    // 清理颜色分配的函数
    clearUnusedColors() {
      const currentVersionNames = new Set(this.editedEditorVisibleContent.map(text => text.name));

      // 清理不再使用的版本颜色映射
      for (const versionName in this.versionColorMap) {
        if (!currentVersionNames.has(versionName)) {
          const colorIndex = this.versionColorMap[versionName];
          delete this.versionColorMap[versionName];
          this.usedColorIndices.delete(colorIndex);
        }
      }
    },

    handleVersionToggle(value, index) {
      const clickedIndex = index + 1; // 因为使用了 slice(1)，所以需要 +1

      if (value) {
        // 如果要选中这个版本，先取消其他所有版本的选择
        Object.keys(this.versionVisibility).forEach(key => {
          this.versionVisibility[key] = false;
        });
        // 然后选中当前版本
        this.versionVisibility[clickedIndex] = true;
      } else {
        // 如果取消选择，直接设置为 false
        this.versionVisibility[clickedIndex] = false;
      }

      console.log('版本显示状态已更改:', this.versionVisibility);
    },

    handleVersionDelete(index) {
      console.log('handleVersionDelete', index);

      // 获取要删除的版本名称，用于清理颜色分配
      const deletedVersionName = this.editedEditorVisibleContent[index - 1]?.name;

      // 删除版本
      this.editedEditorVisibleContent = this.editedEditorVisibleContent.filter((item, idx) => idx !== index - 1);
      usageLogger.log('delete_version', { index }, { page: 'WritingIntelligible' })

      // 清理颜色分配
      if (deletedVersionName && deletedVersionName in this.versionColorMap) {
        const colorIndex = this.versionColorMap[deletedVersionName];
        delete this.versionColorMap[deletedVersionName];
        this.usedColorIndices.delete(colorIndex);
      }

      // 重新初始化可见性
      this.$nextTick(() => {
        this.initializeVisibility();
      });
    },

    getVersionColor(versionName) {
      // 如果已经分配过颜色，直接返回
      if (versionName in this.versionColorMap) {
        const colorIndex = this.versionColorMap[versionName];
        const colorName = this.COLOR_NAMES[colorIndex];
        return colorName;
      }

      // 为新版本分配颜色
      const colorIndex = this.assignColorToVersion(versionName);
      const colorName = this.COLOR_NAMES[colorIndex];
      return colorName;
    },

    closeVersionSelector() {
      this.showVersionSelector = false;
    },

    toggleVersionsVisibility() {
      this.showVersionSelector = !this.showVersionSelector;

      // 如果隐藏版本选择器，则清除所有选择
      if (!this.showVersionSelector) {
        const newVisibility = {};
        for (let i = 1; i <= this.editedEditorVisibleContent.length; i++) {
          newVisibility[i] = false;
        }
        this.versionVisibility = newVisibility;
      } else {
        // 如果打开版本选择器，默认选中第一个版本
        if (this.editedEditorVisibleContent.length > 0) {
          const newVisibility = {};
          for (let i = 1; i <= this.editedEditorVisibleContent.length; i++) {
            newVisibility[i] = (i === 1); // 只有第一个版本（索引1）被选中
          }
          this.versionVisibility = newVisibility;
        }
      }
    },
    // 右侧 rubric 表格 hover/click（可还原操作）
    onRubricCellHoverStart(dimensionName, score, cIndex) {
      const key = `${dimensionName}|${score}|${cIndex}`
      if (!this._rubricHoverStartMap) this._rubricHoverStartMap = new Map()
      this._rubricHoverStartMap.set(key, Date.now())
    },
    onRubricCellHoverEnd(dimensionName, score, cIndex) {
      const key = `${dimensionName}|${score}|${cIndex}`
      const start = this._rubricHoverStartMap?.get(key)
      if (start) {
        const dwellMs = Date.now() - start
        try { usageLogger.log('rubric_cell_hover', { dimension: dimensionName, score, cIndex, dwellMs }, { page: 'WritingIntelligible' }) } catch (e) {}
        try { usageLogger.accumulateRubricHover(dwellMs) } catch (e) {}
        this._rubricHoverStartMap.delete(key)
      }
    },
    onRubricCellClick(dimensionName, score, cIndex) {
      try { usageLogger.log('rubric_cell_click', { dimension: dimensionName, score, cIndex }, { page: 'WritingIntelligible' }) } catch (e) {}
    },

    // 处理版本自动删除
    handleVersionAutoDelete(versionName) {
      console.log(`Auto-deleting completed version: ${versionName}`);

      // 查找要删除的版本索引
      const versionIndex = this.editedEditorVisibleContent.findIndex(item => item.name === versionName);

      if (versionIndex !== -1) {
        // 获取要删除的版本名称，用于清理颜色分配
        const deletedVersionName = this.editedEditorVisibleContent[versionIndex]?.name;

        // 删除版本
        this.editedEditorVisibleContent = this.editedEditorVisibleContent.filter((item, idx) => idx !== versionIndex);

        // 清理颜色分配
        if (deletedVersionName && deletedVersionName in this.versionColorMap) {
          const colorIndex = this.versionColorMap[deletedVersionName];
          delete this.versionColorMap[deletedVersionName];
          this.usedColorIndices.delete(colorIndex);
        }

        // 重新初始化可见性
        this.$nextTick(() => {
          this.initializeVisibility();
        });

        console.log(`Successfully auto-deleted version "${versionName}"`);
        usageLogger.log('auto_delete_version', { versionName }, { page: 'WritingIntelligible' })
      } else {
        console.warn(`Version "${versionName}" not found for auto-deletion`);
      }
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
      usageLogger.log('resize_reset_default', {}, { page: 'WritingIntelligible' })
    }
  },
};
</script>

<style scoped>
.editor-container {
  display: flex;
  justify-content: space-between;
  height: calc(100vh - 52px);
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
  padding: 8px 8px 0px 8px;
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
  padding: 2px 4px;
  flex-shrink: 0;
}

.feedback-section {
  padding: 0px 4px;
  flex-shrink: 0;
}

.feedback-section {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.feedback-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 8px 0;
}

.q-expansion-item--expanded + .q-expansion-item {
  flex-shrink: 1;
}

/* 美化滚动条 */
.criteria-section::-webkit-scrollbar,
.feedback-section::-webkit-scrollbar {
  width: 8px;
}

.criteria-section::-webkit-scrollbar-thumb,
.feedback-section::-webkit-scrollbar-thumb {
  background-color: #ccc;
  border-radius: 3px;
}

.criteria-section::-webkit-scrollbar-track,
.feedback-section::-webkit-scrollbar-track {
  background-color: #f5f5f5;
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
  font-size: 16px !important;  /* 增大基础字体大小 */
  max-width: 360px;
  background: white;
  color: #333;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-radius: 8px;
}

.dimension-tooltip-content {
  font-size: 16px !important;  /* 增大基础字体大小 */
  max-width: 560px;
  padding: 2px;
  line-height: 1.6;  /* 增加行高提升可读性 */
  word-wrap: break-word;  /* 处理长单词换行 */
}

.dimension-popup-content {
  border-radius: 12px;
  max-width: 480px;
  padding: 12px 16px;
  word-wrap: break-word;  /* 处理长单词换行 */
}

/* 如果需要让 tooltip 更突出，可以添加以下样式 */
:deep(.q-tooltip) {
  background: white !important;
  color: #333 !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-radius: 8px;
}

/* 优化 checkbox 样式 */
:deep(.q-checkbox) {
  margin: 8px 0;
}

:deep(.q-checkbox__label) {
  font-size: 14px;
  color: #1976D2;
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

.selected-cell {
  background-color: #e3f2fd !important;
  border: 2px solid #1976d2 !important;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3);
}

.cell-check-mark {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  background-color: #1976d2;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
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

:deep(.q-checkbox__label) {
  font-size: 14px;
  line-height: 1.4;
}

/* 为不同行的 added 和 removed 添加对应的配色方案 */
.added[data-index="0"],
.removed[data-index="0"] {
  color: #2E7D32;  /* 深薄荷绿 */
  background-color: #E8F5E9;  /* 薄荷绿 */
}

.added[data-index="1"],
.removed[data-index="1"] {
  color: #1565C0;  /* 深蓝 */
  background-color: #E3F2FD;  /* 淡蓝 */
}

.added[data-index="2"],
.removed[data-index="2"] {
  color: #E65100;  /* 深橙 */
  background-color: #FFF3E0;  /* 浅橙 */
}

.added[data-index="3"],
.removed[data-index="3"] {
  color: #6A1B9A;  /* 深紫 */
  background-color: #F3E5F5;  /* 淡紫 */
}

.added[data-index="4"],
.removed[data-index="4"] {
  color: #2E7D32;  /* 深薄荷绿 */
}

.added[data-index="5"],
.removed[data-index="5"] {
  color: #1565C0;  /* 深蓝 */
  background-color: #E3F2FD;  /* 淡蓝 */
}

.added[data-index="6"],
.removed[data-index="6"]{
  color: #E65100;  /* 深橙 */
  background-color: #FFF3E0;  /* 浅橙 */
}

.added[data-index="7"],
.removed[data-index="7"] {
  color: #6A1B9A;  /* 深紫 */
  background-color: #F3E5F5;  /* 淡紫 */
}

.added[data-index="8"],
.removed[data-index="8"] {
  color: #2E7D32;  /* 深薄荷绿 */
  background-color: #E8F5E9;  /* 薄荷绿 */
}

.q-checkbox {
  margin: 0px;
}

.criterion-text {
  min-height: 1.5em;
  font-size: 13px;
  line-height: 1.4;
  overflow-y: auto;
  padding-left: 4px;
}

.criteria-text-clickable {
  cursor: pointer;
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

.diff-container {
  padding: 12px;
  background: #f5f5f5;
  border-radius: 8px;
  margin-top: 8px;
  font-family: monospace;
  white-space: pre-wrap;
  word-wrap: break-word;
  line-height: 1.5;
}

.diff-content {
  font-family: monospace;
  white-space: pre-wrap;
  word-wrap: break-word;
  line-height: 1.5;
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

.added {
  padding: 0 2px;
  border-radius: 2px;
}

.removed {
  text-decoration: line-through;
  padding: 0 2px;
  border-radius: 2px;
}

.common {
  color: #24292f;
}

.diff-mode {
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 8px;
  padding: 8px;
}

.diff-mode-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.diff-actions {
  display: flex;
  gap: 8px;
}

.diff-content {
  font-family: monospace;
  white-space: pre-wrap;
  word-wrap: break-word;
  line-height: 1.4;
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  background: #f3f3f3;
  border-radius: 8px;
}

.revised-content {
  line-height: 1.6;
  position: relative;
}

.highlighted-sentence {
  background-color: rgba(247, 247, 209, 0.3);
  padding: 2px 4px;
  border-radius: 3px;
  cursor: help;
  transition: background-color 0.2s ease;
}

.highlighted-sentence:hover {
  background-color: rgba(251, 251, 90, 0.6);
}

.custom-tooltip {
  position: fixed;
  transform: translateX(-50%) translateY(-100%);
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 14px;
  max-width: 360px;
  z-index: 9999;
  pointer-events: none;
  white-space: pre-line;  /* 添加这行以支持换行符 */
}

.custom-tooltip::after {
  content: '';
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  border-width: 5px 5px 0;
  border-style: solid;
  border-color: rgba(0, 0, 0, 0.8) transparent transparent;
}

/* Markdown 渲染样式 */
:deep(.dimension-tooltip-content p) {
  margin: 0.5em 0;
}

:deep(.dimension-tooltip-content ul) {
  margin: 0.5em 0;
  padding-left: 1.2em;
}

:deep(.dimension-tooltip-content li) {
  margin: 0.2em 0;
}

:deep(.dimension-tooltip-content strong) {
  font-weight: bold;
}

:deep(.dimension-tooltip-content br) {
  line-height: 1.5;
}

:deep(.dimension-tooltip-content *:first-child) {
  margin-top: 0;
}

:deep(.dimension-tooltip-content *:last-child) {
  margin-bottom: 0;
}

.diff-part-container {
  position: relative;
  display: inline-block;
}

.diff-group {
  position: relative;
  /** display: inline-block; */
}

.diff-toolbar {
  position: absolute;
  display: flex;
  gap: 4px;
  background: white;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  padding: 4px;
  z-index: 1000;
  transition: all 0.2s ease;
  top: -20px;
  right: 0;
}

/* 移除其他位置的样式 */
.diff-toolbar::after {
  display: none;
}

.hoverable {
  cursor: pointer;
  border-bottom: 1px dashed rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
}

.hoverable.active {
  background-color: rgba(0, 0, 0, 0.05);
}

/* 版本选择器对话框样式 */
.version-selector-dialog {
  width: auto;
  position: fixed;
  max-width: 52vw;
  padding: 4px 4px 0px 4px;
  bottom: 0px;
  right: 4px;
  margin: 0;
  z-index: 9999;
  border-radius: 12px;
}

.version-selector-header {
  display: flex;
  padding: 0px 8px;
  justify-content: space-between;
  align-items: center;
}

/* 版本选择器样式 */
.version-selector {
  background: rgba(0, 0, 0, 0.02);
  display: flex;
  flex-direction: row;
  gap: 4px;
  border-radius: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.version-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 0px;
  background: white;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.version-item:hover {
  background: rgba(25, 118, 210, 0.05);
  border-color: rgba(25, 118, 210, 0.2);
}

.version-badge {
  padding: 4px 8px !important;
  font-size: 0.75rem;
  border-radius: 4px;
}

/* 历史记录相关样式 */
.content-preview {
  max-height: 160px;
  overflow: auto;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  line-height: 1.4;
}

.score-summary {
  background: #f5f5f5;
  border-radius: 8px;
  padding: 12px;
}

.dimension-card {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: white;
}

.suggested-revisions {
  background: #fff3e0;
  border-radius: 6px;
  padding: 8px;
}

.click-item {
  display: flex;
  align-items: center;
  padding: 4px 0;
}

/* 历史记录时间线样式优化 */
:deep(.q-timeline__entry) {
  padding-bottom: 32px;
}

:deep(.q-timeline__entry--icon) {
  padding-left: 56px;
}

/* 评分显示样式 */
.score-section {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 8px;
  border-radius: 12px;
}

.score-display {
  display: flex;
  align-items: center;
  gap: 24px;
}

.score-circle {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border: 4px solid;
}

.score-green {
  background: linear-gradient(135deg, #4caf50 0%, #81c784 100%);
  border-color: #4caf50;
  color: white;
}

.score-orange {
  background: linear-gradient(135deg, #ff9800 0%, #ffb74d 100%);
  border-color: #ff9800;
  color: white;
}

.score-red {
  background: linear-gradient(135deg, #f44336 0%, #ef5350 100%);
  border-color: #f44336;
  color: white;
}

.score-grey {
  background: linear-gradient(135deg, #9e9e9e 0%, #bdbdbd 100%);
  border-color: #9e9e9e;
  color: white;
}

.score-number {
  font-size: 24px;
  font-weight: bold;
  line-height: 1;
}

.score-total {
  font-size: 12px;
  font-weight: 500;
  opacity: 0.9;
}

.score-description {
  text-align: left;
}

</style>
