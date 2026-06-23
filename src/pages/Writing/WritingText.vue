<template>
  <div class="text-h6 text-bold q-mx-lg q-px-sm q-my-sm flex justify-between" style="color: rgb(70, 70, 70);">
    <div>
      {{ modelName }}
    </div>
    <div>
      <q-btn
        v-if="isComparing"
        unelevated
        rounded
        outline
        no-caps
        class="q-ml-md"
        color="secondary"
        icon="visibility_off"
        label="Hide Comparison"
        @click="hideComparison"
      />
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
            :subtitle="record.score ? `Score: ${record.score}` : 'No score'"
            :color="index === historyRecords.length - 1 ? 'primary' : 'secondary'"
          >
            <div>
              <q-card flat bordered>
                <!-- 内容预览 -->
                <q-card-section>
                  <div class="text-body2 content-preview">{{ record.content }}</div>
                </q-card-section>

                <!-- 反馈预览 -->
                <q-card-section v-if="record.feedback">
                  <div class="text-subtitle2 text-weight-bold">Feedback:</div>
                  <div class="text-body2">{{ record.feedback }}</div>
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
          :modifiedTexts="comparisonTexts"
          :versionVisibility="{ 1: isComparing }"
          :versionColorMap="{ 'Comparison': 0 }"
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
        <div class="collapsed-title-text">Feedback</div>
      </div>
      <template v-else>
        <q-expansion-item class="feedback-container" default-opened
          header-class="text-primary text-subtitle1 bg-blue-1"
        >
        <template v-slot:header>
          <q-item-section avatar>
            <q-icon color="primary" name="sym_o_rubric" />
          </q-item-section>
          <q-item-section>
            Feedback
          </q-item-section>
        </template>
        <!-- 反馈获取区域 -->
        <q-card flat class="feedback-request-section">
          <div class="feedback-request-info">
            <q-banner class="bg-orange-1 text-orange-9" rounded>
              <template v-slot:avatar>
                <q-icon name="feedback" color="orange" />
              </template>
              Get overall feedback on the writing. You'll receive a holistic score and general comments.
            </q-banner>
          </div>

          <div class="feedback-request-actions">
            <q-btn
              unelevated rounded color="primary"
              label="Get Assessment"
              @click="getTextFeedback"
              :loading="feedbackLoading"
              icon="assessment"
              size="md"
            />
          </div>
        </q-card>

        <!-- 反馈显示区域 -->
        <div v-if="hasReceivedFeedback" class="feedback-display">
          <q-card flat bordered class="feedback-card">
            <q-card-section class="feedback-header">
              <div class="text-h6 text-weight-bold">
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
                    <div class="text-body1 feedback-comment-text">
                      {{ currentFeedback || 'No feedback available.' }}
                    </div>
                  </q-card-section>
                </q-card>
              </div>

              <!-- 操作按钮 -->
              <div class="feedback-actions q-mt-md">
                <q-btn
                  unelevated rounded outline color="secondary"
                  label="Get New Assessment"
                  @click="getTextFeedback"
                  :loading="feedbackLoading"
                  icon="refresh"
                />
              </div>
            </q-card-section>
          </q-card>
        </div>
        </q-expansion-item>

        <!-- v-if="hasReceivedFeedback" -->
        <!-- Chat-based Writing Assistant -->
        <q-expansion-item
          class="chat-container"
          header-class="text-primary text-subtitle1 bg-blue-1"
        >
          <template v-slot:header>
            <q-item-section avatar>
              <q-icon color="primary" name="chat" />
            </q-item-section>
            <q-item-section>
              Writing Assistant Chat
            </q-item-section>
          </template>

          <!-- Chat Messages -->
          <div class="chat-messages" ref="chatMessages">
            <div v-for="(message, index) in chatMessages" :key="index" class="message-container">
              <!-- User Message -->
              <div v-if="message.type === 'user'" class="user-message">
                <div class="message-bubble user-bubble">
                  {{ message.content }}
                </div>
              </div>

              <!-- AI Message -->
              <div v-else class="ai-message">
                <div class="message-bubble ai-bubble">
                  <div class="ai-content">
                    {{ message.content }}
                  </div>
                  <div v-if="message.content" class="message-actions">
                    <q-btn
                      flat
                      size="sm"
                      color="primary"
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
                <q-spinner-dots color="primary" size="md" />
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
              placeholder="Tell me how you'd like to revise the writing..."
              @keyup.enter="sendChatMessage"
              :disable="chatLoading"
            >
              <template v-slot:append>
                <q-btn
                  flat
                  round
                  icon="send"
                  color="primary"
                  @click="sendChatMessage"
                  :disable="!chatInput.trim() || chatLoading"
                />
              </template>
            </q-input>
          </div>
        </q-expansion-item>
      </template>
    </div>
  </div>
</template>

<script>
import DiffViewer from 'src/components/DiffViewer.vue';
import { getBasicFeedback, generateInstructionBasedWriting } from 'src/components/multiAgentWriting.js';
import { extractRevisedWritingWithReason } from 'src/components/utilsWriting.js';
import usageLogger from 'src/store/usageLogger.js';

export default {
  name: 'WritingText',
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
      feedbackLoading: false,
      currentScore: null,
      currentFeedback: '',
      hasReceivedFeedback: false,
      historyRecords: [],
      showHistory: false,

      // Chat功能相关
      chatMessages: [],
      chatInput: '',
      chatLoading: false,

      // 比对功能相关
      comparisonTexts: [], // 用于DiffViewer的modifiedTexts
      isComparing: false,

      // 布局控制
      leftPanelWidth: 54,  // 默认左侧宽度54%
      rightPanelWidth: 46, // 默认右侧宽度46%
      minPanelWidthForContent: 10, // 显示collapsed-title的宽度百分比
      absoluteMinPanelWidth: 4, // 绝对最小宽度百分比（拖拽限制）
      isResizing: false
    };
  },
  watch: {
    writingContent: {
      handler(newContent, oldContent) {
        console.log('Writing content updated:', newContent);
      },
      deep: false
    }
  },
  async mounted() {
    this.writingContent = this.content;
    usageLogger.init(this.$route ? this.$route.query : null, { page: 'WritingText', modelName: this.modelName })
    usageLogger.updateWritingContent(this.writingContent, { source: 'mounted' })
  },
  methods: {
    handleContentUpdate(newContent) {
      this.writingContent = newContent;
      usageLogger.updateWritingContent(this.writingContent, { source: 'DiffViewer@update' })
    },

    async getTextFeedback() {
      if (!this.writingContent.trim()) {
        this.$q.notify({
          type: 'warning',
          message: 'Please write something before getting feedback',
          position: 'top'
        });
        usageLogger.log('notify', { type: 'warning', reason: 'empty_writing_before_feedback' }, { page: 'WritingText' })
        return;
      }

      this.feedbackLoading = true;
      usageLogger.log('click_button', { id: 'get-assessment' }, { page: 'WritingText' })

      try {
        const roundId = usageLogger.beginRound({ page: 'WritingText' })
        // 调用专门的基础反馈API
        const feedbackData = await getBasicFeedback(this.writingContent);
        console.log('Basic feedback response:', feedbackData);

        // 直接使用返回的数据
        this.currentScore = feedbackData.score;
        this.currentFeedback = feedbackData.comment;
        this.hasReceivedFeedback = true;

        usageLogger.updateTextFeedback({ score: this.currentScore, comment: this.currentFeedback })

        // 保存到历史记录
        this.saveToHistory();
        usageLogger.endRound(roundId, { score: this.currentScore, comment: this.currentFeedback }, { page: 'WritingText' })

      } catch (error) {
        console.error('Error getting feedback:', error);
        this.$q.notify({
          type: 'negative',
          message: 'Failed to get feedback. Please try again.',
          position: 'top'
        });
        usageLogger.log('error', { scope: 'getTextFeedback', message: String(error && error.message || error) }, { page: 'WritingText' })
      } finally {
        this.feedbackLoading = false;
        usageLogger.saveNow()
      }
    },



    getScoreColor(score) {
      if (!score) return 'grey';
      if (score >= 85) return 'green';
      if (score >= 70) return 'orange';
      return 'red';
    },

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

    saveToHistory() {
      const newRecord = {
        content: this.writingContent,
        timestamp: new Date().toLocaleString(),
        score: this.currentScore,
        feedback: this.currentFeedback
      };

      // 检查是否与最新记录相同
      const latestRecord = this.historyRecords[this.historyRecords.length - 1];
      if (latestRecord && latestRecord.content === this.writingContent) {
        // 更新反馈但不添加新记录
        latestRecord.score = this.currentScore;
        latestRecord.feedback = this.currentFeedback;
        latestRecord.timestamp = new Date().toLocaleString();
        return;
      }

      this.historyRecords.push(newRecord);
      console.log('Saved to history:', newRecord);
    },

    restoreContent(record) {
      this.writingContent = record.content;
      this.currentScore = record.score;
      this.currentFeedback = record.feedback;
      this.hasReceivedFeedback = !!(record.score || record.feedback);

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
    },

    async sendChatMessage() {
      if (!this.chatInput.trim()) return;

      const userMessage = this.chatInput.trim();
      this.chatInput = '';

      // 添加用户消息
      this.chatMessages.push({
        type: 'user',
        content: userMessage,
        timestamp: new Date()
      });
      usageLogger.appendChatMessage({ type: 'user', content: userMessage })

      this.chatLoading = true;

      try {
        // 调用AI生成修改后的文章
        const response = await generateInstructionBasedWriting(this.writingContent, userMessage);
        console.log('Chat AI response:', response);

        // 使用extractRevisedWritingWithReason提取内容
        const extractedData = extractRevisedWritingWithReason(response.content);

        if (extractedData && extractedData.revised_writing) {
          // 添加AI回复
          this.chatMessages.push({
            type: 'ai',
            content: extractedData.revised_writing,
            timestamp: new Date()
          });
          usageLogger.appendChatMessage({ type: 'ai', content: extractedData.revised_writing })
        } else {
          throw new Error('Failed to extract revised writing from AI response');
        }

        // 滚动到底部
        this.$nextTick(() => {
          this.scrollToBottom();
        });

      } catch (error) {
        console.error('Error in chat message:', error);
        this.$q.notify({
          type: 'negative',
          message: 'Failed to get AI response. Please try again.',
          position: 'top'
        });
        usageLogger.log('error', { scope: 'sendChatMessage', message: String(error && error.message || error) }, { page: 'WritingText' })

        // 添加错误消息
        this.chatMessages.push({
          type: 'ai',
          content: 'Sorry, I encountered an error while processing your request. Please try again.',
          timestamp: new Date()
        });
        usageLogger.appendChatMessage({ type: 'ai', content: 'ERROR_PLACEHOLDER' })
      } finally {
        this.chatLoading = false;
        usageLogger.saveNow()
      }
    },

    compareRevision(revisedContent) {
      console.log('Compare revision:', revisedContent);

      if (!revisedContent || !revisedContent.trim()) {
        this.$q.notify({
          type: 'warning',
          message: 'No content to compare',
          position: 'top'
        });
        usageLogger.log('notify', { type: 'warning', reason: 'no_content_to_compare' }, { page: 'WritingText' })
        return;
      }

      // 如果正在比对，先清空之前的比对
      if (this.isComparing) {
        this.hideComparison();
      }

      // 创建比对版本
      const comparisonVersion = {
        editedText: revisedContent.trim(),
        name: 'Comparison',
        score: '',
        dimension: '',
        cIndex: '',
        reason: []
      };

      // 设置比对数据
      this.comparisonTexts = [comparisonVersion];
      this.isComparing = true;
      usageLogger.log('compare_revision', { hasContent: true }, { page: 'WritingText' })

      this.$q.notify({
        type: 'positive',
        message: 'Comparison started. You can now see the differences in the editor.',
        position: 'top'
      });
    },

    hideComparison() {
      this.comparisonTexts = [];
      this.isComparing = false;
      console.log('Comparison hidden');
      usageLogger.log('hide_comparison', {}, { page: 'WritingText' })

      this.$q.notify({
        type: 'info',
        message: 'Comparison hidden. Click Compare again to start a new comparison.',
        position: 'top'
      });
    },

    scrollToBottom() {
      const chatContainer = this.$refs.chatMessages;
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }
  },
};
</script>

<style scoped>
.editor-container {
  display: flex;
  justify-content: space-between;
  height: calc(100vh - 104px);
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

/* 反馈请求区域样式 */
.feedback-request-section {
  flex-shrink: 0;
  padding: 8px 4px;
  margin-bottom: 16px;
}

.feedback-request-info {
  margin-bottom: 16px;
}

.feedback-request-actions {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* 反馈显示区域样式 */
.feedback-display {
  flex: 1;
  min-height: 0;
}

.feedback-card {
  background: white;
  border-radius: 8px;
}

.feedback-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
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

/* 反馈评论样式 */
.feedback-comment-section {
  margin-top: 16px;
}

.feedback-comment-card {
  background: white;
  border-radius: 8px;
}

.feedback-comment-text {
  line-height: 1.6;
  min-height: 60px;
  display: flex;
  align-items: center;
  white-space: pre-wrap;
}

.feedback-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 8px 0;
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
  line-clamp: 3;
  -webkit-box-orient: vertical;
  line-height: 1.4;
}

/* expansion item 样式优化 */
:deep(.q-expansion-item) {
  margin-bottom: 8px;
}

:deep(.q-expansion-item__header) {
  min-height: 48px;
  padding: 8px;
  background-color: #d3dcfd;
  margin-bottom: 4px;
  border-radius: 8px;
  border: 2px solid #b3c6fd;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  cursor: pointer;
}

:deep(.q-expansion-item__header:hover) {
  background-color: #c5d0fc;
  border-color: #9bb1fd;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

:deep(.q-expansion-item__header:active) {
  transform: translateY(0);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* 自定义banner样式 */
:deep(.q-banner) {
  border-radius: 8px;
}

/* Chat 样式 */
.chat-container {
  margin-top: 8px;
}

.chat-messages {
  max-height: 400px;
  overflow-y: auto;
  padding: 16px;
  background: white;
  border-radius: 8px;
  margin-bottom: 16px;
}

.message-container {
  margin-bottom: 16px;
}

.user-message {
  display: flex;
  justify-content: flex-end;
}

.ai-message {
  display: flex;
  justify-content: flex-start;
}

.message-bubble {
  max-width: 80%;
  padding: 12px 16px;
  border-radius: 18px;
  word-wrap: break-word;
  white-space: pre-wrap;
}

.user-bubble {
  background: #1976d2;
  color: white;
  border-bottom-right-radius: 4px;
}

.ai-bubble {
  background: #f5f5f5;
  color: #333;
  border-bottom-left-radius: 4px;
  border: 1px solid #e0e0e0;
}

.ai-content {
  margin-bottom: 8px;
}

.message-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #e0e0e0;
}

.chat-input-container {
  padding: 0 4px;
}

/* Chat messages滚动条样式 */
.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-thumb {
  background-color: #ccc;
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-track {
  background-color: #f5f5f5;
}
</style>
