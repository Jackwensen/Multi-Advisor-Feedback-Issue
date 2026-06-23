<template>
  <div class="feedback-section">
    <div class="text-h6 q-ma-sm">
      Rubric of Rubrics
      <q-icon name="sym_o_help" color="purple-5" class="q-ml-sm">
        <q-tooltip class="text-body2">
          Get feedback based on <b class="text-italic text-yellow-5">rubric of rubrics</b> with scores but without detailed explanations.
        </q-tooltip>
      </q-icon>
    </div>

    <div class="rubric-info q-mb-xs">
      <q-banner class="bg-green-1 text-green-9" rounded>
        <template v-slot:avatar>
          <q-icon name="assessment" color="green" />
        </template>
        Your rubric will be evaluated based on the rubric(meta-rubric) below, which includes scores but without detailed explanations.
      </q-banner>
    </div>


      <!-- 分数显示 -->
      <div v-if="scores?.totalAIScore" class="score-section q-mb-xs">
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
                :class="{ 'selected-cell': isCellSelected(dimension, score) }">
              <div v-for="(criterion, cIndex) in dimension.criteria" :key="cIndex" class="criterion-item">
                <div class="criterion-text text-truncated">
                  {{ criterion[`score_${score}`].text }}
                </div>
              </div>
              <!-- 选中状态的对勾图标 -->
              <div v-if="isCellSelected(dimension, score)" class="cell-check-mark">
                <q-icon name="check" color="white" size="14px" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>


      <div class="feedback-actions q-mt-md">
        <q-btn
          unelevated rounded color="purple-5"
          label="Get Assessment"
          @click="sendContent"
          :loading="feedbackLoading"
          icon="assessment"
        />
      </div>
    </div>
    <q-expansion-item
      class="chat-container q-mt-sm"
      header-class="text-purple-5 text-subtitle1 bg-purple-1"
    >
      <template v-slot:header>
        <q-item-section avatar>
          <q-icon color="purple-5" name="chat" />
        </q-item-section>
        <q-item-section>
          Rubric Assistant Chat
        </q-item-section>
      </template>

      <!-- Chat Messages -->
      <div class="chat-messages" ref="chatMessages">
        <div v-for="(message, index) in chatMessages" :key="index" class="q-my-sm">
          <!-- User Message -->
          <div v-if="message.type === 'user'" class="q-my-sm">
            <div class="message-bubble user-bubble">
              {{ message.content }}
            </div>
          </div>

          <!-- AI Message -->
          <div v-else class="q-my-sm">
            <div class="message-bubble ai-bubble">
              <div class="ai-content">
                {{ message.content }}
              </div>
              <div v-if="message.content" class="message-actions">
                <q-btn
                  flat
                  size="sm"
                  color="purple-5"
                  label="Compare"
                  @click="compareRevision(message.content)"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Loading indicator -->
        <div v-if="chatLoading" class="ai-message">
          <div class="message-bubble ai-bubble">
            <q-spinner-dots color="purple-5" size="md" />
            <span class="q-ml-sm">AI is thinking...</span>
          </div>
        </div>
      </div>

      <!-- Chat Input -->
      <div class="chat-input-container">
        <q-input
          v-model="chatInput"
          outlined
          dense
          placeholder="Tell me how you'd like to revise the rubric..."
          :disable="chatLoading"
        >
          <template v-slot:append>
            <q-btn
              flat
              round
              icon="send"
              color="purple-5"
              @click="sendChatMessage"
            />
          </template>
        </q-input>
      </div>
    </q-expansion-item>
  </div>
</template>

<script>
import { getRubricBasedFeedback } from 'src/components/multiAgentRubric'
import { formatScoreReasonString } from 'src/components/utilsRubric'
import usageLogger from 'src/store/usageLogger.js'

export default {
  name: 'RubricRubric',
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
      feedbackLoading: false,
      scores: null,
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
    }
  },
  methods: {
    isCellSelected(dimension, score) {
      return dimension.criteria.some(criterion => criterion[`score_${score}`].checked);
    },

    async sendContent() {
      console.log('sendContent', this.userRubric, this.metaRubric);

      try { usageLogger.snapshotBeforeAssessment({ rubric: this.userRubric, columnCount: this.columnCount, taskDescription: this.taskDescription }) } catch (e) {}
      const roundId = usageLogger.beginRound({ page: 'RubricRubric' })
      try { usageLogger.log('click_button', { id: 'get-assessment' }, { page: 'RubricRubric' }) } catch (e) {}

      // 重置所有criteria的状态
      this.metaRubric.forEach(dimension => {
        dimension.criteria.forEach(criterion => {
          for (let score = 1; score <= 4; score++) {
            criterion[`score_${score}`].checked = false;
            delete criterion[`score_${score}`].reason;
          }
        });
      });

      await this.getFeedbacksConcurrently(this.userRubric);
      try { usageLogger.updateScores(this.scores) } catch (e) {}
      try { usageLogger.endRound(roundId, { scores: this.scores }, { page: 'RubricRubric' }) } catch (e) {}
    },

    async getFeedbacksConcurrently(userRubric) {
      console.log('getFeedbacksConcurrently', userRubric, this.metaRubric);
      const feedbackPromises = this.metaRubric
        .map(rubricItem => getRubricBasedFeedback(userRubric, rubricItem, [], this.columnCount, this.taskDescription));

      try {
        this.feedbackLoading = true;
        const feedbacks = await Promise.all(feedbackPromises);

        console.log('------Feedbacks------:', feedbacks);

        feedbacks.forEach((feedback, index) => {
          const feedbackContent = JSON.parse(formatScoreReasonString(feedback.content));
          console.log('feedback content:', feedbackContent);
          if (!feedbackContent) return;

          try {
            // 更新对应的rubric项目，但不显示reason
            if (this.metaRubric[index]) {
              this.metaRubric[index].criteria = feedbackContent.map(criterion => {
                // 保留分数但移除reason
                const simplifiedCriterion = {};
                Object.keys(criterion).forEach(key => {
                  if (key.startsWith('score_')) {
                    simplifiedCriterion[key] = {
                      text: criterion[key].text,
                      checked: criterion[key].checked
                    };
                  }
                });
                return simplifiedCriterion;
              });
            }
          } catch (e) {
            console.error('Error processing feedback:', e);
          }
        });

        // 计算分数
        this.scores = this.calculateScores(this.metaRubric);
        console.log('Calculated scores:', this.scores);
        // 同步当前rubric（用于回合最终版本）
        try { usageLogger.setCurrentRubric(userRubric, this.columnCount, this.taskDescription) } catch (e) {}

      } catch (error) {
        console.error('Error fetching feedbacks:', error);
        this.$q.notify({
          type: 'negative',
          message: 'Failed to generate assessment',
          position: 'top'
        });
      } finally {
        this.feedbackLoading = false;
        try { usageLogger.saveNow() } catch (e) {}
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
          [1, 2, 3, 4].forEach(score => {
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

    getScoreColorClass(score) {
      if (!score) return 'score-grey';
      if (score >= 85) return 'score-green';
      if (score >= 70) return 'score-orange';
      return 'score-red';
    },

    getScoreDescription(score) {
      if (!score) return 'No score available';
      if (score >= 85) return 'Excellent rubric quality';
      if (score >= 70) return 'Good rubric quality';
      if (score >= 60) return 'Satisfactory rubric quality';
      return 'Needs improvement';
    },

    getScoreStatusText(score) {
      if (!score) return 'No score available';
      if (score >= 85) return 'Excellent';
      if (score >= 70) return 'Good';
      if (score >= 60) return 'Satisfactory';
      return 'Needs improvement';
    }
  }
}
</script>

<style scoped>
.feedback-section {
  margin: 4px 0px 0px 8px;
  padding: 0px;
  width: calc(100% - 12px);
  height: calc(100vh - 58px);
  overflow-x: hidden;
  overflow-y: auto;
  max-width: 100%;
  box-sizing: border-box;
  flex: 1;
  min-height: 0;
}

.rubric-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin-bottom: 16px;
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
  cursor: default;
  position: relative;
  transition: all 0.3s ease;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.criteria-cell:hover {
  background-color: #f5f5f5;
}

.selected-cell {
  background-color: #e3f2fd !important;
  border: 2px solid #1976d2 !important;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3);
}

.criterion-item {
  margin-bottom: 6px;
  padding: 2px;
}

.criterion-item:last-child {
  margin-bottom: 0;
}

.criterion-text {
  font-size: 13px;
  line-height: 1.3;
  color: #555;
}

.text-truncated {
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-check-mark {
  position: absolute;
  top: 6px;
  right: 6px;
  background-color: #28a745;
  border-radius: 2px;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dimension-tooltip {
  max-width: 300px;
}

.dimension-tooltip-content {
  padding: 8px;
}

.score-section {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 8px;
  border-radius: 12px;
  background-color: #f9f9f9;
  border: 1px solid #e0e0e0;
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
  flex: 1;
}

.feedback-actions {
  text-align: center;
  margin-top: 16px;
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
