<template>
  <div v-if="tutorialCompleted" class="tutorial-completed-screen">
    <div class="completion-content">
      <div class="completion-icon">
        <q-icon name="check_circle" size="80px" color="positive" />
      </div>
      <h2 class="completion-title">Tutorial Complete!</h2>
      <p class="completion-description">
        You've successfully learned how to create and customize rubrics.
        <br>You can now start building your own assessment rubrics.
      </p>
    </div>
  </div>
  <div v-else class="main-layout split-mode">
    <div class="rubric-container" :style="{ width: leftPanelWidth + '%' }" :class="{ 'collapsed': leftPanelWidth < minPanelWidthForContent }">
      <q-scroll-area class="fit" :bar-style="{ background: 'transparent' }" :thumb-style="{ background: 'rgba(0,0,0,0.2)', borderRadius: '4px', width: '8px' }">
        <div class="rubric-container-inner">

          <!-- 完整内容 -->
          <div class="full-content">
            <!-- Rubric Header -->
            <div class="rubric-header q-my-sm">
              <span v-if="!isEditing" class="text-h6 text-weight-medium">{{ modelName }}</span>
              <q-input v-else class="text-h6 text-bold" style="width: 280px;" v-model="editingName" dense outlined @keyup.enter="saveModelName" @blur="saveModelName" autofocus />
              <q-btn class="q-ml-sm" flat round dense icon="edit" color="deep-purple-4" @click="startEditing" />
            </div>

            <!-- Task Description 部分 -->
            <q-card class="rubric-card q-mb-sm">
              <div class="row items-center">
                <q-input
                  v-model="taskDescription"
                  class="q-pa-sm q-ma-sm col"
                  type="textarea"
                  filled
                  label="Task Description"
                  autogrow
                />
                <q-btn rounded no-caps outline label="Enhance" color="deep-purple-5" class="q-mx-sm" @click="elaborateTaskDescription" :disable="taskDescription.length === 0" :loading="false"/>
              </div>
            </q-card>

            <!-- Rubric Table -->
            <q-card class="rubric-card">
              <div class="q-pa-sm">
                <!-- 列数选择器和权重显示 -->
                <div class="q-mb-md row items-center justify-between">
                  <q-select
                    standout="bg-deep-purple-5 text-white"
                    v-model="columnCount"
                    :options="[3,4,5,6]"
                    label="Choose Rating Scale"
                    style="width: 240px"
                    dense
                  />
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
                    <tbody>
                      <tr v-for="(row, index) in tableData" :key="index">
                        <!-- 拖拽手柄 -->
                        <td class="drag-cell">
                          <q-icon name="drag_indicator" class="drag-handle" size="sm" style="cursor: grab;" />
                        </td>
                        <!-- 维度内容 -->
                        <td class="dimension-cell">
                          <div class="dimension-content">
                            <div class="dimension-input-wrapper">
                              <!-- Dimension Input -->
                              <q-input dense v-model="row.dimension" :rules="[val => !!val || 'Dimension is required']"
                                :input-style="{ fontSize: '14px' }"
                                class="dimension-input"
                                placeholder="Criterion"
                                @click="toggleDimensionToolbar(row, index, $event)"
                              />
                              <!-- Dimension Toolbar -->
                              <div class="dimension-toolbar" v-if="activeDimensionToolbar === index && !row.dimension">
                                <q-btn flat dense no-caps
                                  icon="tips_and_updates"
                                  label="Recommend a Criterion"
                                  @click="recommendDimension(row, index)"
                                  :loading="recommendingDimension"
                                  color="yellow-5"
                                >
                                  <q-tooltip class="text-body2">Get a recommended criterion based on task description</q-tooltip>
                                </q-btn>
                              </div>
                            </div>
                            <!-- Weight Input -->
                            <q-input v-model.number="row.percentage" type="number" label="Weight (%)" borderless dense
                              :rules="[
                                val => (val >= 0 && val <= 100) || 'Weight must be between 0-100'
                              ]" />
                            <!-- 行工具栏 -->
                            <div class="row-toolbar-cell" v-if="row.dimension">
                              <q-btn dense no-caps outline rounded
                                class="q-pl-sm"
                                icon="img:icons/spark-32x32.png"
                                color="deep-purple-5"
                                v-if="row.dimension && !row.criteria[0][`score_${columnCount}`].text"
                                :label="`Generate Criterion`"
                                @click="getOrImproveCriterion(index, 0, 'Generate')"
                              >
                                <q-tooltip class="text-body2"> Generate descriptors for this criterion: {{row.dimension}}</q-tooltip>
                              </q-btn>
                              <!-- refine criteria 工具栏 -->
                              <q-btn-dropdown dense no-caps outline rounded
                                class="q-pl-sm"
                                color="deep-purple-5"
                                icon="img:icons/spark-32x32.png"
                                v-if="row.dimension && row.criteria[0][`score_${columnCount}`] && row.criteria[0][`score_${columnCount}`].text"
                                :loading="generatingRubric[index]"
                                @click.stop
                              >
                                <template v-slot:label>
                                  <span>Refine This Criterion</span>
                                </template>
                                <q-list style="min-width: 100px">
                                  <q-item v-for="type in refineTypes" :key="type" clickable v-close-popup>
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
                          <div v-for="(criterion, cIndex) in (row.criteria || [])" :key="cIndex" class="criterion-cell">
                            <!-- criterion input -->
                            <q-input
                              v-model="criterion[`score_${columnCount - col + 1}`].text"
                              filled
                              type="textarea"
                              dense
                              autogrow
                              class="auto-height-input"
                              :key="`textarea-${index}-${cIndex}-${columnCount - col + 1}`"
                              @click="toggleToolbar(index, cIndex, columnCount - col + 1, $event)"
                            >
                              <template v-slot:before>
                                <span v-if="row.criteria.length > 1" class="text-weight-bold text-subtitle1">{{cIndex + 1}}</span>
                              </template>
                            </q-input>

                            <!-- Criterion Toolbar -->
                            <div class="criterion-toolbar" v-if="activeToolbar === `${index}_${cIndex}_${columnCount - col + 1}` && row.dimension">
                              <q-btn-dropdown flat dense no-caps
                                icon="img:icons/spark-32x32.png"
                                label="Refine Descriptor"
                                v-if="criterion[`score_${columnCount - col + 1}`].text && row.dimension"
                                :loading="false"
                                @click.stop
                              >
                                <q-list style="min-width: 100px">
                                  <q-item v-for="type in refineTypes" :key="type" clickable v-close-popup>
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
                            <q-btn flat dense icon="sym_o_delete" color="negative" @click="removeRowAt(index)" :disable="tableData.length === 1">
                              <q-tooltip>delete this criterion</q-tooltip>
                            </q-btn>
                          </div>
                        </td>
                      </tr>
                    </tbody>
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
                  />
                </div>

                <!-- 保存按钮 -->
                <div class="row q-mt-sm items-center">
                  <q-btn color="purple-5" label="Save Rubric" unelevated rounded @click="saveRubric" class="q-mr-sm" />
                  <q-btn
                    color="teal-6"
                    label="Test on Essay"
                    unelevated
                    rounded
                    @click="testOnEssay"
                  />
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
        <div class="collapsed-title-text">Tutorial Demo</div>
      </div>

      <div class="evaluate-panel-content" v-show="rightPanelWidth > minPanelWidthForContent">
        <div class="tutorial-demo-content">
          <h4 class="text-center q-mt-md">Tutorial Demo Panel</h4>
          <p class="text-center text-grey-7">This panel demonstrates the evaluation interface</p>

          <div class="demo-features q-pa-md">
            <q-list>
              <q-item>
                <q-item-section avatar>
                  <q-icon name="check_circle" color="positive" />
                </q-item-section>
                <q-item-section>Real-time feedback</q-item-section>
              </q-item>
              <q-item>
                <q-item-section avatar>
                  <q-icon name="check_circle" color="positive" />
                </q-item-section>
                <q-item-section>AI-powered evaluation</q-item-section>
              </q-item>
              <q-item>
                <q-item-section avatar>
                  <q-icon name="check_circle" color="positive" />
                </q-item-section>
                <q-item-section>Interactive rubric application</q-item-section>
              </q-item>
            </q-list>
          </div>
        </div>
      </div>
    </div>

    <!-- Tutorial Card -->
    <div v-if="tutorialActive" class="tutorial-overlay">
      <div class="tutorial-card">
        <div class="tutorial-header">
          <div class="tutorial-step-indicator">
            Step {{ currentTutorialStep + 1 }} of {{ tutorialSteps.length }}
          </div>
          <q-btn
            flat
            round
            dense
            icon="close"
            @click="exitTutorial"
            class="tutorial-close-btn"
          />
        </div>

        <div class="tutorial-content">
          <h3 class="tutorial-title">{{ currentStep?.title }}</h3>
          <p class="tutorial-description">{{ currentStep?.description }}</p>


        </div>

        <div class="tutorial-actions">
          <q-btn
            v-if="currentTutorialStep > 0"
            flat
            label="Previous"
            color="grey-7"
            @click="prevTutorialStep"
            class="q-mr-sm"
          />
          <q-btn
            unelevated
            :label="currentTutorialStep === tutorialSteps.length - 1 ? 'Finish Tutorial' : 'Next'"
            color="deep-purple-5"
            @click="nextTutorialStep"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useQuasar } from 'quasar'
import urlParamsStore from 'src/store/urlParams.js'

export default {
  name: 'RubricDesignTutorial',
  data() {
    return {
      $q: useQuasar(),
      refineTypes: ['Improve', 'Shorten', 'Elaborate', 'Retry', 'Bullet-point'],
      refineIcons: ['auto_fix_high', 'unfold_less', 'expand', 'sym_o_refresh', 'sym_o_list'],
      columnCount: 3,
      taskDescription: '',
      modelName: 'Tutorial Rubric',
      isEditing: false,
      editingName: '',

      // Mock data for tutorial
      tableData: [
        {
          dimension: '',
          description: '',
          percentage: 100,
          criteria: [this.createEmptyCriterion(3)]
        }
      ],

      generatingRubric: {},
      activeToolbar: null,
      activeDimensionToolbar: null,
      recommendingDimension: false,

      // Panel layout
      leftPanelWidth: 96,
      rightPanelWidth: 4,
      minPanelWidthForContent: 10,
      absoluteMinPanelWidth: 4,
      isResizing: false,

      // Tutorial state
      tutorialActive: true,
      currentTutorialStep: 0,
      waitingForUserAction: false,
      userCompletedAction: false,
      tutorialCompleted: false,
      tutorialSteps: [
        {
          id: 'rubric-header',
          title: 'Rubric Name',
          description: 'You can click the edit button anytime to change your rubric name.',
          selector: '.rubric-header span',
          position: 'bottom',
          autoTrigger: false
        },
        {
          id: 'task-description',
          title: 'Task Description',
          description: 'Designing a rubric starts with describing your assignment first. We\'ll auto-fill a sample for demonstration.',
          selector: '.rubric-card.q-mb-sm',
          position: 'bottom',
          autoTrigger: true,
          action: 'fillTaskDescription'
        },
        {
          id: 'column-count',
          title: 'Rating Scale',
          description: 'You can choose how many performance levels (3-6 points). Higher numbers give more detailed scoring.',
          selector: '.q-select',
          position: 'bottom',
          autoTrigger: false
        },
        {
          id: 'weight-setup',
          title: 'Criterion Weights',
          description: 'Here you can set importance percentage for each criterion. All weights must total 100%.',
          selector: '.dimension-content',
          customSelector: 'weightInput',
          position: 'bottom',
          autoTrigger: false
        },
        {
          id: 'ai-recommend',
          title: 'AI Recommendations',
          description: 'Now try it yourself! Please click the criterion input box below, then click "Recommend a Criterion" to see AI suggestions.',
          selector: '.dimension-input-wrapper:first-of-type',
          position: 'right',
          autoTrigger: true,
          action: 'showRecommendationButton',
          waitingForUserAction: true
        },
        {
          id: 'refine-criterion',
          title: 'Bulk Refinement',
          description: 'After filling in the criterion, you can refine all performance levels at once with different options.',
          selector: '.row-toolbar-cell .q-btn-dropdown',
          position: 'right',
          autoTrigger: true,
          action: 'triggerBulkRefineDropdown'
        },
        {
          id: 'individual-refinement',
          title: 'Individual Refinement',
          description: 'For each descriptor, you can also refine specific performance levels individually.',
          selector: '.criterion-cell:first-of-type .auto-height-input',
          position: 'top',
          autoTrigger: true,
          action: 'triggerIndividualRefineDropdown'
        },
        {
          id: 'drag-reorder',
          title: 'Reorder Criteria',
          description: 'You can use this drag handle to reorder criteria when you have multiple ones.',
          selector: '.drag-handle:first-of-type',
          position: 'right',
          autoTrigger: false
        },
        {
          id: 'add-criterion',
          title: 'Add Criteria',
          description: 'You can click here to add more evaluation criteria to your rubric.',
          selector: '.add-criterion-btn',
          position: 'top',
          autoTrigger: false
        },
        {
          id: 'delete-criterion',
          title: 'Remove Criteria',
          description: 'You can click this button to delete criteria you don\'t need.',
          selector: '.action-cell .q-btn',
          position: 'left',
          autoTrigger: false
        },
        {
          id: 'tutorial-complete',
          title: 'Tutorial Complete!',
          description: 'You\'ve learned all the key features. Ready to create your own rubric?',
          selector: '.q-btn',
          customSelector: 'saveRubricButton',
          position: 'top',
          autoTrigger: false
        }
      ]
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
    currentStep() {
      return this.tutorialSteps[this.currentTutorialStep] || null;
    }
  },
  watch: {
    columnCount(newCount) {
      this.tableData.forEach(row => {
        row.criteria.forEach(criterion => {
          const existingScores = { ...criterion };
          Object.keys(criterion).forEach(key => {
            if (key.startsWith('score_')) {
              delete criterion[key];
            }
          });
          for (let i = newCount; i >= 1; i--) {
            criterion[`score_${i}`] = existingScores[`score_${i}`] || { text: '', checked: false };
          }
        });
      });
    }
  },
  mounted() {
    // 启动tutorial
    this.$nextTick(() => {
      this.showTutorialStep();
    });

    // 添加全局点击事件监听
    document.addEventListener('click', this.handleGlobalClick);
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleGlobalClick);
    this.removeAllHighlights();
  },
  methods: {
    // Tutorial methods
    showTutorialStep() {
      if (!this.currentStep) return;

      this.removeAllHighlights();

      // Reset user action state for steps that require user interaction
      if (this.currentStep.waitingForUserAction) {
        this.userCompletedAction = false;
      }

      this.$nextTick(() => {
        this.highlightCurrentElement();

        // Execute auto-triggered actions
        if (this.currentStep.autoTrigger && this.currentStep.action) {
          setTimeout(() => {
            this.executeStepAction();
          }, 200);
        }
      });
    },

    highlightCurrentElement() {
      let element;

      if (this.currentStep.customSelector) {
        element = this.findElementByCustomSelector(this.currentStep.customSelector);
      } else {
        element = document.querySelector(this.currentStep.selector);
      }

      if (element) {
        element.classList.add('tutorial-highlight');
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        this.positionTutorialCard(element);
      }
    },

        findElementByCustomSelector(selectorType) {
      switch (selectorType) {
        case 'saveRubricButton':
          const buttons = document.querySelectorAll('.q-btn');
          return Array.from(buttons).find(btn =>
            btn.textContent && btn.textContent.includes('Save Rubric')
          );
        case 'weightInput':
          // Find .q-input element containing number type input
          const numberInputs = document.querySelectorAll('input[type="number"]');
          for (let input of numberInputs) {
            const qInputParent = input.closest('.q-input');
            if (qInputParent) {
              return qInputParent;
            }
          }
          return null;
        default:
          return null;
      }
    },

    positionTutorialCard(targetElement) {
      const card = document.querySelector('.tutorial-card');
      if (!card || !targetElement) return;

      const rect = targetElement.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const position = this.currentStep.position;

      let top, left;

      switch (position) {
        case 'right':
          top = rect.top + (rect.height / 2) - (cardRect.height / 2);
          left = rect.right + 20;
          break;
        case 'left':
          top = rect.top + (rect.height / 2) - (cardRect.height / 2);
          left = rect.left - cardRect.width - 20;
          break;
        case 'top':
          top = rect.top - cardRect.height - 20;
          left = rect.left + (rect.width / 2) - (cardRect.width / 2);
          break;
        case 'bottom':
        default:
          top = rect.bottom + 20;
          left = rect.left + (rect.width / 2) - (cardRect.width / 2);
          break;
      }

      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      // 更智能的边界检查
      if (left < 20) {
        left = 20;
        // 如果左边放不下，尝试放右边
        if (position === 'left') {
          left = rect.right + 20;
          if (left + cardRect.width > windowWidth - 20) {
            left = windowWidth - cardRect.width - 20;
          }
        }
      }
      if (left + cardRect.width > windowWidth - 20) {
        left = windowWidth - cardRect.width - 20;
        // 如果右边放不下，尝试放左边
        if (position === 'right') {
          left = rect.left - cardRect.width - 20;
          if (left < 20) {
            left = 20;
          }
        }
      }

      if (top < 20) {
        top = 20;
        // 如果上面放不下，尝试放下面
        if (position === 'top') {
          top = rect.bottom + 20;
        }
      }
      if (top + cardRect.height > windowHeight - 20) {
        top = windowHeight - cardRect.height - 20;
        // 如果下面放不下，尝试放上面
        if (position === 'bottom') {
          top = rect.top - cardRect.height - 20;
          if (top < 20) {
            top = 20;
          }
        }
      }

      card.style.position = 'fixed';
      card.style.top = top + 'px';
      card.style.left = left + 'px';
      card.style.transform = 'none';
    },

    executeStepAction() {
      const action = this.currentStep.action;

      switch (action) {
        case 'fillTaskDescription':
          this.fillSampleTaskDescription();
          break;
        case 'showRecommendationButton':
          this.showRecommendationButton();
          break;
        case 'triggerBulkRefineDropdown':
          this.triggerBulkRefineDropdown();
          break;
        case 'triggerIndividualRefineDropdown':
          this.triggerIndividualRefineDropdown();
          break;
      }
    },

    fillSampleTaskDescription() {
      this.taskDescription = `Students will analyze a historical document and write a 500-word essay examining the author's perspective, the historical context, and the document's significance. The essay should demonstrate critical thinking, use evidence from the document, and connect to broader historical themes.

Evaluation Focus:
- Analysis of author's perspective and bias
- Understanding of historical context
- Use of evidence from the document
- Writing quality and organization
- Connection to broader historical patterns`;

      this.$q.notify({
        type: 'info',
        message: 'Sample task description filled automatically',
        position: 'top',
        timeout: 2000
      });
    },

    showRecommendationButton() {
      // 只显示recommendation按钮，不自动执行
      this.activeDimensionToolbar = 0;

      this.$q.notify({
        type: 'info',
        message: 'Now you can click "Recommend a Criterion" button to get AI suggestion.',
        position: 'top',
        timeout: 3000
      });
    },

    async triggerAIRecommendation() {
      // 用户点击recommendation按钮时执行
      this.recommendingDimension = true;

      this.$q.notify({
        type: 'info',
        message: 'Getting AI recommendation...',
        position: 'top',
        timeout: 2000
      });

      // 模拟AI推荐结果
      setTimeout(() => {
        this.tableData[0].dimension = 'Historical Analysis';
        this.tableData[0].criteria[0] = {
          score_3: { text: 'Demonstrates sophisticated analysis of the author\'s perspective, clearly identifying bias and viewpoint. Shows deep understanding of historical context with accurate connections to the time period.', checked: false },
          score_2: { text: 'Shows good analysis of the author\'s perspective with some identification of bias. Demonstrates adequate understanding of historical context with mostly accurate connections.', checked: false },
          score_1: { text: 'Shows limited analysis of the author\'s perspective with little identification of bias. Demonstrates basic understanding of historical context with few or inaccurate connections.', checked: false }
        };

        this.activeDimensionToolbar = null;
        this.recommendingDimension = false;

        this.$q.notify({
          type: 'positive',
          message: 'AI recommendation completed! Click "Next" to continue.',
          position: 'top',
          timeout: 3000
        });
      }, 2000);
    },

    triggerBulkRefineDropdown() {
      // Auto-trigger the dropdown after a delay
      setTimeout(() => {
        const bulkRefineBtn = document.querySelector('.row-toolbar-cell .q-btn-dropdown');
        if (bulkRefineBtn) {
          bulkRefineBtn.click();
        }
      }, 200);
    },

    triggerIndividualRefineDropdown() {
      // First show the criterion toolbar
      setTimeout(() => {
        this.activeToolbar = '0_0_3'; // Show toolbar for first criterion, first item, score 3

        // Then trigger the dropdown after toolbar appears
        setTimeout(() => {
          const refineDescriptorBtn = document.querySelector('.criterion-toolbar .q-btn-dropdown');
          if (refineDescriptorBtn) {
            refineDescriptorBtn.click();

          }
        }, 200);
      }, 200);
    },

    nextTutorialStep() {
      // Check if current step requires user action and user hasn't completed it
      if (this.currentStep?.waitingForUserAction && !this.userCompletedAction) {
        this.$q.notify({
          type: 'warning',
          message: 'Please complete the required action first!',
          position: 'top',
          timeout: 2000
        });
        return;
      }

      if (this.currentTutorialStep < this.tutorialSteps.length - 1) {
        this.currentTutorialStep++;
        this.waitingForUserAction = false;
        this.userCompletedAction = false; // Reset for next step
        this.showTutorialStep();
      } else {
        this.completeTutorial();
      }
    },

    prevTutorialStep() {
      if (this.currentTutorialStep > 0) {
        this.currentTutorialStep--;
        this.waitingForUserAction = false;
        this.showTutorialStep();
      }
    },



    completeTutorial() {
      this.tutorialActive = false;
      this.tutorialCompleted = true;
      this.removeAllHighlights();

      this.$q.notify({
        type: 'positive',
        message: 'Tutorial completed! You can now start creating your own rubric.',
        position: 'top',
        timeout: 2000
      });
    },

    exitTutorial() {
      this.$q.dialog({
        title: 'Exit Tutorial',
        message: 'Are you sure you want to exit the tutorial?',
        cancel: true,
        persistent: false
      }).onOk(() => {
        this.completeTutorial();
      });
    },

    removeAllHighlights() {
      const highlightedElements = document.querySelectorAll('.tutorial-highlight');
      highlightedElements.forEach(el => {
        el.classList.remove('tutorial-highlight');
      });
    },

    handleGlobalClick(event) {
      const isClickOnCriterionToolbar = event.target.closest('.criterion-toolbar');
      const isClickOnCriterionInput = event.target.closest('.auto-height-input');
      const isClickOnDropdownMenu = event.target.closest('.q-menu') || event.target.closest('.q-list') || event.target.closest('.q-item');

      if (!isClickOnCriterionToolbar && !isClickOnCriterionInput && !isClickOnDropdownMenu && this.activeToolbar) {
        this.activeToolbar = null;
      }

      const isClickOnDimensionToolbar = event.target.closest('.dimension-toolbar');
      const isClickOnDimensionInput = event.target.closest('.dimension-input-wrapper');

      if (!isClickOnDimensionToolbar && !isClickOnDimensionInput && this.activeDimensionToolbar !== null) {
        this.activeDimensionToolbar = null;
      }
    },

    // Mock methods (no real API calls)
    startEditing() {
      this.isEditing = true;
      this.editingName = this.modelName;
    },

    saveModelName() {
      if (this.editingName && this.editingName !== this.modelName) {
        this.modelName = this.editingName;
      }
      this.isEditing = false;
    },

    toggleDimensionToolbar(row, rowIndex) {
      if (this.activeDimensionToolbar === rowIndex) {
        this.activeDimensionToolbar = null;
      } else {
        this.activeDimensionToolbar = rowIndex;
      }
    },

    toggleToolbar(rowIndex, cIndex, score) {
      const toolbarId = `${rowIndex}_${cIndex}_${score}`;
      if (this.activeToolbar === toolbarId) {
        this.activeToolbar = null;
      } else {
        this.activeToolbar = toolbarId;
      }
    },

    addRow() {
      const newRow = {
        dimension: '',
        description: '',
        percentage: 0,
        criteria: [this.createEmptyCriterion(this.columnCount)]
      };
      this.tableData.push(newRow);
    },

    removeRowAt(index) {
      if (this.tableData.length > 1) {
        this.tableData.splice(index, 1);
      }
    },

    createEmptyCriterion(colCount) {
      const criterion = {};
      for (let i = colCount; i >= 1; i--) {
        criterion[`score_${i}`] = { text: '', checked: false };
      }
      return criterion;
    },

    // Mock API methods
    async recommendDimension(row, index) {
      // Mark user completed action for tutorial step 5
      if (this.tutorialActive && this.currentTutorialStep === 4) { // Step 5 (0-indexed)
        this.userCompletedAction = true;
      }

      // Execute AI recommendation in tutorial mode
      if (this.tutorialActive) {
        this.triggerAIRecommendation();
      } else {
        this.recommendingDimension = true;
        // Simulate API delay
        setTimeout(() => {
          this.recommendingDimension = false;
        }, 1000);
      }
    },

    async getOrImproveCriterion(index, cIndex, type) {
      // Mock implementation
    },

    async refineDescription(row, criterion, col, index, cIndex, type) {
      // Mock implementation
    },

    async elaborateTaskDescription() {
      // Mock implementation
    },

    saveRubric() {
      this.$q.notify({
        type: 'info',
        message: 'This is tutorial mode - no actual saving occurs',
        position: 'top',
        timeout: 2000
      });
    },

    testOnEssay() {
      this.$q.notify({
        type: 'info',
        message: 'This is tutorial mode - feature demonstration only',
        position: 'top',
        timeout: 2000
      });
    },

    // Panel resize methods
    startResize(event) {
      this.isResizing = true;
      const startX = event.clientX;
      const containerWidth = document.querySelector('.main-layout').offsetWidth;
      const startLeftWidth = this.leftPanelWidth;

      const resize = (event) => {
        const deltaX = event.clientX - startX;
        const deltaPercent = (deltaX / containerWidth) * 100;
        let newLeftWidth = startLeftWidth + deltaPercent;

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
      this.leftPanelWidth = 90;
      this.rightPanelWidth = 10;
    },

    // startNewRubric() {
    //   // Remove tour parameter and reload to normal rubric design
    //   urlParamsStore.updateUrlParams({ tour: null });
    //   window.location.reload();
    // }
  }
};
</script>

<style scoped>
/* 使用原来的样式，但添加tutorial专用样式 */
/* Main layout container */
.main-layout {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
}

.main-layout.split-mode {
  /* 分屏模式时的样式 - 维持左右结构 */
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
  padding: 4px 12px;
  box-sizing: border-box;
  height: 100%;
  overflow: hidden;
}

.rubric-container.collapsed .rubric-container-inner {
  padding: 4px 8px;
}

.rubric-container.collapsed {
  /* 折叠状态下的样式 */
}

/* Tutorial Banner */
.tutorial-banner {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 12px;
  background: linear-gradient(135deg, #673ab7 0%, #512da8 100%);
  color: white;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 14px;
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
}

.rubric-card {
  width: 100%;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.table-container {
  width: 100%;
  overflow-x: auto;
  overflow-y: visible;
}

.custom-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 0.5rem;
}

.custom-table th,
.custom-table td {
  border: 1px solid #ddd;
  padding: 4px;
  vertical-align: middle;
}

.table-header {
  background-color: #f5f5f5;
  height: 40px;
  font-size: 16px;
  font-family: 'Noto Sans SC', sans-serif;
}

.drag-cell {
  width: 32px;
  min-width: 32px;
}

.dimension-cell {
  min-width: 12%;
  max-width: 12%;
  width: 12%;
}

.dimension-content {
  display: flex;
  flex-direction: column;
  padding: 2px;
}

.dimension-input-wrapper {
  position: relative;
  overflow: visible;
}

.dimension-input .q-field__native {
  font-weight: bold !important;
}

.dimension-input .q-field__native::placeholder {
  font-weight: normal !important;
}

.criterion-cell {
  margin-bottom: 4px;
  padding: 0px;
  position: relative;
  min-height: fit-content;
  overflow: visible;
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
  min-height: 2.8em !important;
  line-height: 1.4em !important;
}

.auto-height-input textarea {
  line-height: 1.4em;
  resize: none !important;
  overflow-y: hidden;
  transition: height 0.2s ease;
  box-sizing: border-box;
}

.q-textarea.q-field--dense .q-field__native {
  padding-top: 0px;
  padding-bottom: 0px;
}

.q-field--filled .q-field__control {
  font-size: 14px !important;
  padding-right: 0px !important;
  padding-left: 4px !important;
}

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

.row-toolbar-cell {
  margin-top: 8px;
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

.evaluate-panel.collapsed {
  /* 折叠状态下的样式 */
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
}

.tutorial-demo-content {
  padding: 20px;
  text-align: center;
}

.demo-features {
  background: white;
  border-radius: 12px;
  margin-top: 20px;
}

/* Tutorial相关样式 */
.tutorial-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 9999;
}

.tutorial-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  max-width: 350px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  border: 2px solid #673ab7;
  pointer-events: auto;
  position: fixed;
  animation: fadeInScale 0.3s ease-out;
}

@keyframes fadeInScale {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.tutorial-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.tutorial-step-indicator {
  color: #666;
  font-size: 13px;
  font-weight: 500;
}

.tutorial-close-btn {
  color: #999 !important;
  margin: -8px -8px -8px 0;
}

.tutorial-close-btn:hover {
  color: #666 !important;
  background: rgba(0, 0, 0, 0.05) !important;
}

.tutorial-content {
  margin-bottom: 20px;
}

.tutorial-title {
  margin: 0 0 10px 0;
  color: #1a1a1a;
  font-size: 18px;
  font-weight: 600;
}

.tutorial-description {
  margin: 0;
  color: #666;
  line-height: 1.5;
  font-size: 14px;
}

.tutorial-waiting {
  display: flex;
  align-items: center;
  margin-top: 12px;
  padding: 8px 12px;
  background: #f3e5f5;
  border-radius: 8px;
  border-left: 3px solid #673ab7;
}

.tutorial-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

/* Highlight styles */
.tutorial-highlight {
  position: relative;
  z-index: 9998 !important;
  border: 2px solid #673ab7 !important;
  border-radius: 6px !important;
  background-color: rgba(103, 58, 183, 0.05) !important;
  transition: all 0.3s ease !important;
}

/* Tutorial Completion Screen */
.tutorial-completed-screen {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #703da2;
  color: white;
}

.completion-content {
  text-align: center;
  max-width: 500px;
  padding: 40px;
}

.completion-icon {
  margin-bottom: 24px;
  animation: completionBounce 1s ease-out;
}

@keyframes completionBounce {
  0% {
    transform: scale(0.3);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.completion-title {
  font-size: 32px;
  font-weight: 600;
  margin-bottom: 16px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.completion-description {
  font-size: 18px;
  line-height: 1.6;
  opacity: 0.9;
  margin-bottom: 0;
}

/* Responsive design */
@media (max-width: 600px) {
  .tutorial-card {
    padding: 16px;
    max-width: 300px;
  }

  .tutorial-title {
    font-size: 16px;
  }

  .tutorial-actions {
    flex-direction: column;
    gap: 8px;
  }

  .tutorial-actions .q-btn {
    width: 100%;
    margin: 0 !important;
  }

  .completion-content {
    padding: 20px;
  }

  .completion-title {
    font-size: 24px;
  }

  .completion-description {
    font-size: 16px;
  }
}
</style>
