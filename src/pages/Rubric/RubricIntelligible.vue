<template>
  <!-- 评论和反馈区域 -->
  <q-expansion-item class="feedback-container" default-opened
    header-class="text-purple-5 text-subtitle1"
  >
    <template v-slot:header>
      <q-item-section avatar>
        <q-icon color="purple-5" name="sym_o_rubric" />
      </q-item-section>
      <q-item-section>
        <div class="text-purple-5" style="width: 200px;">
          Rubric of Rubrics
          <q-icon name="sym_o_help" color="purple-5" size="18px">
            <q-tooltip class="text-body2">
              Use this <b class="text-italic text-yellow-5">rubric of rubrics</b> to evaluate your rubric.
            </q-tooltip>
          </q-icon>
        </div>
      </q-item-section>

      <q-item-section side>
        <div class="row items-center text-weight-bold text-black">
          {{ 'Score: ' + (scores?.totalAIScore ? scores.totalAIScore.toFixed(1) : '--') + '/100' + ' (' + (scores?.aiScorePercentage || '0') + '%)' }}
        </div>
      </q-item-section>
    </template>
    <div class="feedback-section">
      <!-- <div class="q-mb-xs">
        <q-banner class="bg-blue-1 text-blue-9" rounded>
          <template v-slot:avatar>
            <q-icon name="assessment" color="blue" />
          </template>
          Your rubric will be evaluated based on the rubric(meta-rubric) below, which includes scores and detailed explanations and suggestions.
        </q-banner>
      </div> -->

      <!-- 分数显示区域 -->
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

      <div>
        <table class="rubric-table">
          <thead class="rubric-table-header">
            <tr>
              <th class="dimension-cell">Criteria</th>
              <th v-for="score in scoreRange" :key="score">Score: {{ score }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(dimension, index) in metaRubric" :key="index">
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
              <td v-for="score in scoreRange" :key="score" class="criteria-cell"
                :class="{ 'selected-cell': isCellSelected(dimension, score) }"
              >
                <div v-for="(criterion, cIndex) in dimension.criteria" :key="cIndex" class="criterion-item" :data-index="cIndex" :style="{ cursor: criterion[`score_${score}`].reason ? 'pointer' : 'default' }"
                  @mouseenter="onCellHoverStart(dimension, score, cIndex)"
                  @mouseleave="onCellHoverEnd(dimension, score, cIndex)"
                  @click="onCellClick(dimension, score, cIndex)"
                >
                  <div class="criterion-text text-truncated">
                    {{ criterion[`score_${score}`].text }}
                  </div>
                  <q-tooltip v-if="criterion[`score_${score}`].reason" anchor="top middle" self="bottom middle" :offset="[10, 10]" class="dimension-tooltip">
                    <div class="text-body2">
                      <q-icon name="question_mark" color="yellow-6" size="14px" class="q-mr-xs"/>
                      Click to view the reason of {{ criterion[`score_${score}`].checked ? 'why' : 'why not' }} getting score {{ score }}
                    </div>
                  </q-tooltip>
                  <q-popup-proxy v-if="criterion[`score_${score}`].reason">
                    <div class="dimension-popup-content bg-grey-1">
                      <div class="flex column">
                        <div class="text-weight-bold q-my-xs">
                          {{ 'Reason of ' + (criterion[`score_${score}`].checked ? 'why' : 'why not') + ' getting score ' + score + ': ' }}
                        </div>
                        <div class="text-body3" v-html="renderMarkdown(criterion[`score_${score}`].reason)"></div>
                      </div>
                      <q-btn rounded outline no-caps color="orange-8"
                        v-if="shouldShowPopup(criterion, score)"
                        class="q-mr-sm"
                        :icon="'img:icons/spark-32x32.png'"
                        @click="generateCounterfactual(dimension, criterion, score, cIndex)"
                        :loading="isPopupLoading(dimension, criterion, score, cIndex)"
                        :disable="isCounterfactualDisabled(dimension, score)">
                        An example of score {{ score }}
                      </q-btn>
                    </div>
                  </q-popup-proxy>
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
          <q-btn unelevated rounded color="purple-5" icon="assessment" label="Get Assessment" @click="sendContent" :loading="feedbackLoading"/>
        </div>

        <!-- 反事实示例表格 -->
        <div v-if="showVersionSelector && sortedCounterfactualRubrics.length > 0" class="counterfactual-section ">
          <div class="text-h6 q-ma-sm">Suggested Rubrics</div>
          <div v-for="item in sortedCounterfactualRubrics" :key="item.originalIndex" class="counterfactual-item q-mb-sm">
            <q-expansion-item
              :label="item.counterfactualRubric.generatedKey || `Suggested Rubric #${item.originalIndex + 1}`"
              class="expansion-item"
              header-class="expansion-header"
              expand-icon-class="text-purple-5"
            >
              <template v-slot:header>
                <div class="expansion-header-content">
                  <div class="flex column">
                    <div class="text-subtitle1 text-weight-medium text-grey-8">
                      {{ item.counterfactualRubric.generatedKey || `Suggested Rubric #${item.originalIndex + 1}` }}
                    </div>
                    <div class="text-caption text-grey-6">
                      Generated at: {{ item.counterfactualRubric.generatedAt || new Date().toLocaleString() }}
                    </div>
                    <div v-if="item.counterfactualRubric.appliedAt" class="text-caption text-green-6">
                      Applied at: {{ item.counterfactualRubric.appliedAt }}
                    </div>
                  </div>
                </div>
              </template>

              <div class="expansion-content q-pt-md">
                <table class="counterfactual-table">
                  <thead>
                    <tr>
                      <th class="dimension-header">Criteria</th>
                      <th v-for="score in scoreRange" :key="score">Score: {{ score }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(dimension, dimIndex) in item.counterfactualRubric" :key="dimIndex">
                      <td class="dimension-name">
                        <div class="q-py-sm">
                          <div class="text-weight-medium">{{ dimension.dimension }}</div>
                          <!-- <div class="text-caption text-grey-6">{{ dimension.description }}</div> -->
                          <div class="text-caption text-purple">Weight: {{ dimension.percentage }}%</div>
                        </div>
                      </td>
                      <td v-for="score in scoreRange" :key="score" class="counterfactual-cell"
                      >
                        <div class="criterion-content">
                          <div v-for="(criterion, cIndex) in dimension.criteria" :key="cIndex" class="criterion-item">
                            <div class="criterion-text text-truncated">
                              {{ criterion[`score_${score}`]?.text || '--' }}
                            </div>
                            <q-tooltip anchor="center right" self="center left" :offset="[10, 0]" class="dimension-tooltip">
                              <div class="text-body2 q-mb-xs">{{ criterion[`score_${score}`].text }}</div>
                            </q-tooltip>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div class="flex justify-end q-mt-sm q-gutter-x-sm">
                  <q-btn
                    flat
                    label="Apply this example"
                    color="purple-5"
                    @click="applyCounterfactualRubric(item.originalIndex)"
                  >
                    <q-icon name="sym_o_output" style="transform: rotate(180deg)" class="q-mx-sm"/>
                    <q-tooltip>Copy this example</q-tooltip>
                  </q-btn>
                  <q-btn
                    flat
                    icon="delete"
                    color="negative"
                    @click="removeCounterfactualRubric(item.originalIndex)"
                  >
                    <q-tooltip>Delete this example</q-tooltip>
                  </q-btn>
                </div>
              </div>
            </q-expansion-item>
          </div>
        </div>
      </div>
    </div>
  </q-expansion-item>
</template>

<script>
import { marked } from 'marked'
import { getRubricBasedFeedback, generateCounterfactualRubric } from 'src/components/multiAgentRubric'
import { formatToString, formatRubricString, formatScoreReasonString } from 'src/components/utilsRubric'
import usageLogger from 'src/store/usageLogger.js'

export default {
  name: 'RubricIntelligible',
  props: {
    userRubric: {
      type: Array,
      required: true
    },
    taskDescription: {
      type: String,
      required: true
    },
    columnCount: {
      type: Number,
      required: true
    },
    modelName: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      selectedCells: new Map(), // 存储选中的单元格
      editedEditorVisibleContent: [],
      showVersionSelector: true,
      feedbackLoading: false,
      loadingStates: new Map(), // 存储各种加载状态
      generatedCounterfactualRubrics: [], // 存储生成的反事实rubric
      scores: null, // 添加分数计算结果存储
      metaRubric: [{
        "dimension": "Criteria & Alignment",
        "description": "",
        "percentage": 30,
        "criteria": [
          {
            "score_4": {
              "text": "All criteria measure essential learning outcomes. Each is defined so precisely that a single piece of evidence can only be scored under one criterion.\t",
              "checked": false
            },
            "score_3": {
              "text": "Most criteria measure essential learning outcomes. Criteria are defined clearly enough that evidence largely fits under a single criterion, with minimal ambiguity.\t",
              "checked": false
            },
            "score_2": {
              "text": "Some criteria measure essential learning outcomes. Definitions are general, causing evidence to frequently fit under multiple criteria.\t",
              "checked": false
            },
            "score_1": {
              "text": "Few or no criteria measure essential learning outcomes. Definitions are vague, causing criteria to be redundant and overlapping.",
              "checked": false
            }
          }
        ]
      },
      {
        "dimension": "Level Distinction",
        "description": "",
        "percentage": 30,
        "criteria": [
          {
            "score_4": {
              "text": "The scale creates a clear, logical progression of quality. All levels are defined with enough detail to be clearly distinguished from their neighbors.\t",
              "checked": false
            },
            "score_3": {
              "text": "The scale shows a logical progression of quality. Most levels are clearly distinguished from their neighbors, though some may require minor interpretation.\t",
              "checked": false
            },
            "score_2": {
              "text": "The progression of quality is sometimes illogical or unclear. It is difficult to distinguish between some adjacent levels.\t",
              "checked": false
            },
            "score_1": {
              "text": "The progression is illogical or arbitrary. Levels are not distinct, making differentiation of performance impossible.",
              "checked": false
            }
          }
        ]
      },
      {
        "dimension": "Descriptive Language",
        "description": "",
        "percentage": 40,
        "criteria": [
          {
            "score_4": {
              "text": "Language describes precise, specific, observable evidence. All descriptions for a criterion follow a parallel grammatical structure across levels.\t",
              "checked": false
            },
            "score_3": {
              "text": "Language is mostly descriptive and objective, but may include some minor, un-defined subjective terms. Most descriptions follow a parallel structure.\t",
              "checked": false
            },
            "score_2": {
              "text": "Language mixes descriptive and subjective/evaluative terms, providing limited observable evidence. Parallel structure is inconsistent.\t",
              "checked": false
            },
            "score_1": {
              "text": "Language is primarily subjective and evaluative, offering no observable evidence. There is no parallel structure.",
              "checked": false
            }
          }
        ]
      }],
    }
  },
  computed: {
    scoreRange() {
      return Array.from({ length: 4 }, (_, i) => i + 1).reverse()
    },
    columnWidth() {
      const totalColumns = this.scoreRange.length;
      const remainingWidth = 80; // 剩余80%的宽度
      return `${remainingWidth / totalColumns}%`;
    },
    sortedCounterfactualRubrics() {
      // 创建带有原始索引的数组，然后按生成时间倒序排列（新生成的在最上面）
      return this.generatedCounterfactualRubrics
        .map((counterfactualRubric, originalIndex) => ({
          counterfactualRubric,
          originalIndex
        }))
        .sort((a, b) => {
          const timeA = a.counterfactualRubric.generatedAt ? new Date(a.counterfactualRubric.generatedAt).getTime() : 0
          const timeB = b.counterfactualRubric.generatedAt ? new Date(b.counterfactualRubric.generatedAt).getTime() : 0
          return timeB - timeA // 倒序排列，时间越新越靠前
        })
    }
  },
  watch: {
    metaRubric: {
      handler(newRubric) {
        if (newRubric) {
          this.scores = this.calculateScores(newRubric);
          console.log('Calculated rubric scores:', this.scores);
        }
      },
      deep: true
    }
  },
  methods: {
    mounted() {
      console.log('RubricEvaluation mounted', this.userRubric)
      try { usageLogger.init(this.$route ? this.$route.query : null, { page: 'RubricIntelligible' }) } catch (e) {}
      try { usageLogger.snapshotBeforeAssessment({ rubric: this.userRubric, columnCount: this.columnCount, taskDescription: this.taskDescription }) } catch (e) {}
      try { usageLogger.setCurrentRubric(this.userRubric, this.columnCount, this.taskDescription) } catch (e) {}
    },

    onCellHoverStart(dimension, score, cIndex) {
      const key = `${dimension.dimension}|${score}|${cIndex}`
      if (!this._hoverStartMap) this._hoverStartMap = new Map()
      this._hoverStartMap.set(key, Date.now())
    },
    onCellHoverEnd(dimension, score, cIndex) {
      const key = `${dimension.dimension}|${score}|${cIndex}`
      const start = this._hoverStartMap?.get(key)
      if (start) {
        const dwellMs = Date.now() - start
        try { usageLogger.log('cell_hover', { dimension: dimension.dimension, score, cIndex, dwellMs }, { page: 'RubricIntelligible' }) } catch (e) {}
        try { usageLogger.accumulateRubricHover(dwellMs) } catch (e) {}
        this._hoverStartMap.delete(key)
      }
    },
    onCellClick(dimension, score, cIndex) {
      try { usageLogger.log('cell_click', { dimension: dimension.dimension, score, cIndex }, { page: 'RubricIntelligible' }) } catch (e) {}
    },

    // 从 WritingIntelligible.vue 移植的分数计算方法
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
          // 计算该子标准的满分 (使用固定的4分制)
          const maxSubScore = 4;
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
      result.userScorePercentage = '--';

      return result;
    },

    // 从 WritingIntelligible.vue 移植的分数颜色方法
    getScoreColorClass(score) {
      if (!score) return 'score-grey';
      if (score >= 85) return 'score-green';
      if (score >= 70) return 'score-orange';
      return 'score-red';
    },

    // 从 WritingIntelligible.vue 移植的分数描述方法
    getScoreDescription(score) {
      if (!score) return 'No score available';
      if (score >= 85) return 'Excellent rubric quality';
      if (score >= 70) return 'Good rubric quality';
      if (score >= 60) return 'Satisfactory rubric quality';
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

    isCellSelected(dimension, score) {
      return dimension.criteria.some(criterion => criterion[`score_${score}`].checked);
    },

    renderMarkdown(text) {
      if (!text) return ''
      return marked(text)
    },

    getCurrentScore(criterion) {
      const checkedEntry = Object.entries(criterion).find(([key, value]) => value.checked === true);
      return checkedEntry ? checkedEntry[0].replace('score_', '') : '--';
    },

    shouldShowPopup(criterion, score) {
      // 检查是否有已评分的项
      const currentScore = this.getCurrentScore(criterion);
      if (currentScore === '--') return false;

      // 只有当目标分数与当前分数不同时才显示
      return parseInt(currentScore) !== score;
    },

    isPopupLoading(dimension, criterion, score, cIndex) {
      const key = `${dimension.dimension} to score ${score}`
      return this.loadingStates.get(key) || false
    },

    isCounterfactualDisabled(dimension, score) {
      // 根据业务逻辑决定是否禁用
      return false
    },

    isTargetScore(dimension, score) {
      // 检查该维度中是否有任何criteria在该分数下被选中
      return dimension.criteria.some(criterion => criterion[`score_${score}`]?.checked)
    },

    async generateCounterfactual(dimension, criterion, score, cIndex) {
      const key = `${dimension.dimension} to score ${score}`
      this.loadingStates.set(key, true)

      try {
        // 生成类似userRubric结构的新rubric
        const counterfactualRubric = await generateCounterfactualRubric(this.userRubric, criterion, dimension, score)
        console.log('counterfactualRubric', counterfactualRubric)
        const counterfactualRubricString = formatRubricString(counterfactualRubric.content)
        console.log('counterfactualRubricString', counterfactualRubricString)

        const parsedRubric = JSON.parse(counterfactualRubricString)
        // 保存key到反事实rubric中
        parsedRubric.generatedKey = key
        parsedRubric.generatedAt = new Date().toLocaleString()

        this.generatedCounterfactualRubrics.push(parsedRubric)
        try { usageLogger.log('generate_counterfactual_rubric', { key, score, dimension: dimension.dimension }, { page: 'RubricIntelligible' }) } catch (e) {}

      } catch (error) {
        console.error('Failed to generate counterfactual example:', error)
        this.$q.notify({
          type: 'negative',
          message: 'Failed to generate counterfactual example',
          position: 'top'
        })
      } finally {
        this.loadingStates.set(key, false)
      }
    },

    applyCounterfactualRubric(index) {
      // 先计算这个例子的评分scale, 然后应用到父组件的columnCount中，然后将该example 应用到父组件的tableData中
      const counterfactualRubric = this.generatedCounterfactualRubrics[index]
      if (!counterfactualRubric) return

      // 记录应用时间
      counterfactualRubric.appliedAt = new Date().toLocaleString()

      // 1. 计算评分scale - 通过检查criteria中的score属性来确定列数
      let maxScore = 0
      counterfactualRubric.forEach(dimension => {
        if (dimension.criteria && dimension.criteria.length > 0) {
          const criterion = dimension.criteria[0]
          Object.keys(criterion).forEach(key => {
            if (key.startsWith('score_')) {
              const score = parseInt(key.replace('score_', ''))
              if (score > maxScore) {
                maxScore = score
              }
            }
          })
        }
      })

      console.log('Calculated column count:', maxScore)

      // 2. 发送事件到父组件应用更改
      this.$emit('apply-counterfactual', {
        columnCount: maxScore,
        tableData: counterfactualRubric
      })
      try { usageLogger.log('apply_counterfactual_rubric', { index, columnCount: maxScore }, { page: 'RubricIntelligible' }) } catch (e) {}

      // 3. 显示成功消息
      this.$q.notify({
        type: 'positive',
        message: 'Successfully applied the example rubric!',
        position: 'top',
        timeout: 2000
      })
    },

    removeCounterfactualRubric(index) {
      this.generatedCounterfactualRubrics.splice(index, 1)
      try { usageLogger.log('delete_counterfactual_rubric', { index }, { page: 'RubricIntelligible' }) } catch (e) {}
    },

    async sendContent() {
      console.log('sendContent', this.userRubric, this.metaRubric)
      try { usageLogger.snapshotBeforeAssessment({ rubric: this.userRubric, columnCount: this.columnCount, taskDescription: this.taskDescription }) } catch (e) {}
      try { usageLogger.log('click_button', { id: 'get-assessment' }, { page: 'RubricIntelligible' }) } catch (e) {}

      // 重置所有criteria的状态
      this.metaRubric.forEach(dimension => {
        dimension.criteria.forEach(criterion => {
          for (let score = 1; score <= 4; score++) {
            criterion[`score_${score}`].checked = false
            delete criterion[`score_${score}`].reason
          }
        })
      })

      await this.getFeedbacksConcurrently(this.userRubric)
      try { usageLogger.updateScores(this.scores) } catch (e) {}

      // TODO: 如果需要保存到历史记录，可以在这里实现
      // this.saveToHistory(this.tableData)
    },

    async getFeedbacksConcurrently(userRubric) {
      console.log('getFeedbacksConcurrently', userRubric, this.metaRubric)
      const feedbackPromises = this.metaRubric
        .map(rubricItem => getRubricBasedFeedback(userRubric, rubricItem, [], this.columnCount, this.taskDescription))

      try {
        this.feedbackLoading = true
        const feedbacks = await Promise.all(feedbackPromises)

        console.log('------Feedbacks------:', feedbacks)

        feedbacks.forEach((feedback, index) => {
          const feedbackContent = JSON.parse(formatScoreReasonString(feedback.content))
          console.log('feedback content:', feedbackContent)
          if (!feedbackContent) return

          try {
            // 更新对应的rubric项目
            if (this.metaRubric[index]) {
              this.metaRubric[index].criteria = feedbackContent
            }
          } catch (e) {
            console.error('Error processing feedback:', e)
          }
        })

        // skip notify logging
      } catch (error) {
        console.error('Error fetching feedbacks:', error)
        // skip notify logging
      } finally {
        this.feedbackLoading = false
        try { usageLogger.saveNow() } catch (e) {}
      }
    }
  }
}
</script>

<style scoped>
/* 容器样式 */
.feedback-container {
  display: flex;
  flex-direction: row;
  flex: 1;
  min-height: 0;
}

.feedback-section {
  padding: 0px 4px;
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

/* 评分显示样式 - 从 WritingIntelligible.vue 移植 */
.score-section {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 8px;
  border-radius: 12px;
  background-color: #f9f9f9;
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

.rubric-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;

  box-sizing: border-box;
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
  width: 80px;
  font-size: 14px;
  background-color: #f8f9fa;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.dimension-content {
  display: flex;
  flex-direction: column;
  font-size: 14px;
  padding: 0px 4px;
}

.criteria-cell {
  width: v-bind(columnWidth);
  cursor: pointer;
  position: relative;
  transition: all 0.3s ease;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.criteria-cell:hover {
  background-color: #f5f5f5;
}

.selected-cell {
  background-color: #f4effd !important;
  border: 2px solid #7e57c2  !important;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3);
}

.criterion-item {
  margin-bottom: 6px;
  padding: 2px 2px 2px 4px;
}

.criterion-item:last-child {
  margin-bottom: 0;
}

.criterion-text {
  font-size: 13px;
  line-height: 1.3;
}

.text-truncated {
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-check-mark {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  background-color: #7e57c2 ;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.dimension-tooltip {
  max-width: 300px;
}

.dimension-tooltip-content {
  padding: 8px;
}

.dimension-popup-content {
  padding: 12px;
  border-radius: 4px;
  max-width: 400px;
  border: 1px solid #ddd;
}

.text-body3 {
  font-size: 13px;
  line-height: 1.4;
}

/* 反事实示例样式 */
.counterfactual-section {
  border-top: 1px solid #ddd;
  margin-top: 8px;
  padding-top: 4px;
}

.counterfactual-item {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: #ffffff;
  margin-bottom: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.3s ease;
}

.counterfactual-item:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.expansion-item {
  border-radius: 8px;
}

.expansion-header {
  padding: 12px 16px;
  background-color: #f8f9fa;
  border-radius: 8px 8px 0 0;
  border-bottom: 1px solid #e0e0e0;
}

.expansion-header-content {
  width: 100%;
}

.expansion-content {
  padding: 0 16px 16px 16px;
  background-color: #ffffff;
  border-radius: 0 0 8px 8px;
}

.counterfactual-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  margin-bottom: 8px;
  background-color: white;
  border: 1px solid #ddd;
  box-sizing: border-box;
}

.counterfactual-table th,
.counterfactual-table td {
  border: 1px solid #ddd;
  padding: 0px;
  text-align: left;
  vertical-align: top;
}

.counterfactual-table th {
  background-color: #f8f9fa;
  font-weight: 500;
  color: #333;
  text-align: center;
  font-size: 14px;
}

.dimension-header {
  width: 20%;
  background-color: #f5f5f5;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.dimension-name {
  background-color: #f8f9fa;
  font-weight: 500;
  width: 20%;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.counterfactual-cell {
  width: v-bind(columnWidth);
  position: relative;
  background-color: #fff;
}

.target-score {
  background-color: #fff3e0 !important;
  border: 2px solid #ff9800;
}

.criterion-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.criterion-content .criterion-item {
  margin-bottom: 8px;
  padding: 4px;
  border-radius: 4px;
}

.criterion-content .criterion-item:last-child {
  margin-bottom: 0;
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

/* 确保内部组件的滚动条样式 */
.feedback-section::-webkit-scrollbar {
  width: 6px;
}

.feedback-section::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.feedback-section::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.feedback-section::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

</style>
