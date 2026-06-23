<template>
  <div class="feedback-section">
    <div class="text-h6 q-ma-sm">
      Basic AI Feedback
      <q-icon name="sym_o_help" color="purple-5" class="q-ml-sm">
        <q-tooltip class="text-body2">
          Get overall feedback on your rubric without detailed rubric analysis.
        </q-tooltip>
      </q-icon>
    </div>

    <!-- 反馈获取区域 -->
    <div class="feedback-request-section q-mb-xs">
      <div class="feedback-request-info q-mb-xs">
        <q-banner class="bg-orange-1 text-orange-9" rounded>
          <template v-slot:avatar>
            <q-icon name="feedback" color="orange" />
          </template>
          Get overall feedback on your rubric. You'll receive a holistic score and general comments.
        </q-banner>
      </div>

      <div class="feedback-request-actions">
        <q-btn
          unelevated rounded color="purple-5"
          label="Get Assessment"
          @click="getTextFeedback"
          :loading="feedbackLoading"
          icon="assessment"
          size="md"
        />
      </div>
    </div>

    <!-- 反馈显示区域 -->
    <div v-if="hasReceivedFeedback" class="feedback-display">
      <q-card flat bordered class="feedback-card">
        <q-card-section class="feedback-header">
          <div class="text-subtitle1 text-weight-bold">
            <q-icon name="rate_review" color="primary" class="q-mr-sm" />
            The Feedback from AI
          </div>
          <q-chip
            :color="getScoreColor(currentScore)"
            text-color="white"
            size="md"
            v-if="currentScore"
            class="q-ml-md"
          >
            {{ currentScore }}/100
          </q-chip>
        </q-card-section>

        <q-card-section>
          <!-- 整体评分显示 -->
          <div class="score-section">
            <div class="score-display">
              <div class="score-circle" :class="getScoreColorClass(currentScore)">
                <div class="score-number">{{ currentScore || '--' }}</div>
                <div class="score-total">/100</div>
              </div>
              <div class="score-description">
                <div class="text-h6 text-weight-bold">Overall Score</div>
                <div class="text-body2 text-grey-7">{{ getScoreDescription(currentScore) }}</div>
              </div>
            </div>
          </div>

          <!-- 通用评论 -->
          <div class="feedback-comment-section">
            <div class="text-subtitle2 text-weight-bold q-mb-sm">
              <q-icon name="comment" color="primary" class="q-mr-xs" />
              Feedback Comment
            </div>
            <q-card flat bordered class="feedback-comment-card">
              <q-card-section>
                <div class="text-body2 feedback-comment-text">
                  {{ currentFeedback || 'No feedback available.' }}
                </div>
              </q-card-section>
            </q-card>
          </div>

          <!-- 操作按钮 -->
          <div class="feedback-actions q-mt-md">
            <q-btn
              unelevated rounded outline color="purple-5"
              label="Get New Assessment"
              @click="getTextFeedback"
              :loading="feedbackLoading"
              icon="refresh"
            />
          </div>
        </q-card-section>
      </q-card>
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
import { getRubricBasicFeedback } from 'src/components/multiAgentRubric.js'
import usageLogger from 'src/store/usageLogger.js'

export default {
  name: 'RubricBasicFeedback',
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
      currentScore: null,
      currentFeedback: null,
      hasReceivedFeedback: false
    }
  },
  methods: {
    async getTextFeedback() {
      this.feedbackLoading = true;
      usageLogger.log('click_button', { id: 'rubric-get-assessment' }, { page: 'RubricText' })

      try {
        // 将用户的rubric转换为文本格式以供LLM评估
        const rubricText = this.formatRubricForFeedback();

        // 使用getBasicFeedback函数获取反馈
        const feedback = await getRubricBasicFeedback(rubricText, this.taskDescription);

        // 解析反馈结果
        this.parseFeedbackResult(feedback);

        this.hasReceivedFeedback = true;

        usageLogger.updateTextFeedback({ score: this.currentScore, comment: this.currentFeedback })

      } catch (error) {
        console.error('Error getting feedback:', error);
        this.$q.notify({
          type: 'negative',
          message: 'Failed to get feedback. Please try again.',
          position: 'top',
          timeout: 3000
        });
        usageLogger.log('error', { scope: 'RubricText.getTextFeedback', message: String(error && error.message || error) }, { page: 'RubricText' })
      } finally {
        this.feedbackLoading = false;
        usageLogger.saveNow()
      }
    },

    formatRubricForFeedback() {
      // 将rubric格式化为文本，供LLM分析
      let rubricText = `Task Description: ${this.taskDescription}\n\n`;
      rubricText += `Rubric (${this.columnCount}-point scale):\n\n`;

      this.userRubric.forEach((dimension, index) => {
        rubricText += `${index + 1}. ${dimension.dimension} (${dimension.percentage}%)\n`;

        dimension.criteria.forEach((criterion, cIndex) => {
          if (dimension.criteria.length > 1) {
            rubricText += `   Sub-criterion ${cIndex + 1}:\n`;
          }

          for (let score = this.columnCount; score >= 1; score--) {
            const scoreText = criterion[`score_${score}`]?.text || '';
            if (scoreText) {
              rubricText += `   ${score} points: ${scoreText}\n`;
            }
          }
        });

        rubricText += '\n';
      });

      return rubricText;
    },

    parseFeedbackResult(feedback) {
      // 假设feedback返回的格式类似于 { score: 85, comment: "..." }
      if (typeof feedback === 'object' && feedback.score !== undefined) {
        this.currentScore = feedback.score;
        this.currentFeedback = feedback.comment;
      } else if (typeof feedback === 'string') {
        // 如果是字符串，尝试解析分数
        const scoreMatch = feedback.match(/(\d+)\/100|Score:\s*(\d+)|(\d+)\s*points?/i);
        if (scoreMatch) {
          this.currentScore = parseInt(scoreMatch[1] || scoreMatch[2] || scoreMatch[3]);
        } else {
          this.currentScore = 75; // 默认分数
        }
        this.currentFeedback = feedback;
      } else {
        this.currentScore = 75;
        this.currentFeedback = 'Feedback received successfully.';
      }
      usageLogger.updateTextFeedback({ score: this.currentScore, comment: this.currentFeedback })
    },

    getScoreColor(score) {
      if (!score) return 'grey';
      if (score >= 90) return 'green';
      if (score >= 80) return 'light-green';
      if (score >= 70) return 'amber';
      if (score >= 60) return 'orange';
      return 'red';
    },

    getScoreColorClass(score) {
      if (!score) return 'score-grey';
      if (score >= 90) return 'score-excellent';
      if (score >= 80) return 'score-good';
      if (score >= 70) return 'score-fair';
      if (score >= 60) return 'score-poor';
      return 'score-fail';
    },

    getScoreDescription(score) {
      if (!score) return 'No score available';
      if (score >= 90) return 'Excellent rubric quality';
      if (score >= 80) return 'Good rubric quality';
      if (score >= 70) return 'Fair rubric quality';
      if (score >= 60) return 'Poor rubric quality';
      return 'Needs significant improvement';
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

.feedback-request-section {
  margin-bottom: 16px;
}

.feedback-request-actions {
  text-align: center;
  margin-top: 16px;
}

.feedback-display {
  margin-top: 16px;
}

.feedback-card {
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.feedback-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e0e0e0;
  padding: 8px 12px;
}

.score-section {
  display: flex;
  justify-content: center;
  padding: 8px 0;
}

.score-display {
  display: flex;
  align-items: center;
  gap: 20px;
}

.score-circle {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.score-excellent {
  background: linear-gradient(135deg, #4caf50, #66bb6a);
  color: white;
}

.score-good {
  background: linear-gradient(135deg, #8bc34a, #9ccc65);
  color: white;
}

.score-fair {
  background: linear-gradient(135deg, #ffc107, #ffca28);
  color: white;
}

.score-poor {
  background: linear-gradient(135deg, #ff9800, #ffa726);
  color: white;
}

.score-fail {
  background: linear-gradient(135deg, #f44336, #ef5350);
  color: white;
}

.score-grey {
  background: linear-gradient(135deg, #9e9e9e, #bdbdbd);
  color: white;
}

.score-number {
  font-size: 24px;
  line-height: 1;
}

.score-total {
  font-size: 14px;
  opacity: 0.9;
  margin-top: -4px;
}

.score-description {
  flex: 1;
}

.feedback-comment-section {
  margin-top: 20px;
}

.feedback-comment-card {
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
}

.feedback-comment-text {
  line-height: 1.6;
  color: #495057;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.feedback-actions {
  text-align: center;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
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
