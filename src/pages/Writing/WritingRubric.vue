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

  <div class="editor-container">
    <!-- 写作编辑器 -->
    <div class="writing-editor" :style="{ width: leftPanelWidth + '%' }">
      <div v-if="leftPanelWidth < minPanelWidthForContent" class="collapsed-title">
        <div class="collapsed-title-text">Writing</div>
      </div>
      <form v-else class="writing-form">
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
        <div class="collapsed-title-text">Rubric</div>
      </div>
      <template v-else>
        <!-- Criteria 选择区域 -->
        <q-card flat class="criteria-section">
          <q-select
            v-show="false"
            outlined dense style="width: 100%;" label="Choose a rubric"
            v-model="selectedCriteria"
            :options="criteriaOptions"
          >
          <template v-slot:before>
            <q-icon color="primary" name="rule" />
          </template>
          </q-select>
        </q-card>

        <!-- 评论和反馈区域 -->
        <q-expansion-item v-if="selectedRubric" class="feedback-container" default-opened
          header-class="text-primary text-subtitle1 bg-blue-1"
        >
          <template v-slot:header>
            <q-item-section avatar>
              <q-icon color="primary" name="sym_o_rubric" />
            </q-item-section>
            <q-item-section>
              Rubric: {{ selectedCriteria.label }}
            </q-item-section>
            <q-item-section side>
              <div class="row items-center text-weight-bold text-black">
                Score: {{ scores?.totalAIScore ? scores.totalAIScore.toFixed(1) : '--' }}/{{ scores?.totalMaxScore }} ({{ scores?.aiScorePercentage }}%)
              </div>
            </q-item-section>
          </template>

          <div class="feedback-section">
            <div class="q-mb-xs">
              <q-banner class="bg-green-1 text-green-9" rounded>
                <template v-slot:avatar>
                  <q-icon name="assessment" color="green" />
                </template>
                The writing will be evaluated against each rubric criterion with scores but without detailed explanations.
              </q-banner>
            </div>

            <div v-if="scores?.totalAIScore" class="score-section">
              <div class="score-display">
                <div class="score-circle" :class="getScoreColorClass(scores.totalAIScore.toFixed(1))">
                  <div class="score-number">{{ scores.totalAIScore.toFixed(1) || '--' }}</div>
                  <div class="score-total">/100</div>
                </div>
                <div class="score-description">
                  <div class="text-h6 text-weight-bold">Overall Score:</div>
                  <div class="text-body2 text-grey-7">{{ getScoreDescription(scores.totalAIScore.toFixed(1)) }}</div>
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
                      <div v-for="(criterion, cIndex) in dimension.criteria" :key="cIndex" class="criterion-item">
                        <div class="criterion-text">
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
              <div class="feedback-actions">
                <q-btn unelevated rounded color="primary" label="Get Assessment" @click="sendContent" :loading="feedbackLoading"/>
              </div>
            </div>
          </div>
        </q-expansion-item>

        <!-- v-if="scores?.totalAIScore" -->
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
import urlParamsStore from 'src/store/urlParams.js';
import { generateInstructionBasedWriting } from 'src/components/multiAgentWriting.js';
import { extractRevisedWritingWithReason } from 'src/components/utilsWriting.js';
import usageLogger from 'src/store/usageLogger.js';

export default {
  name: 'WritingRubric',
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
      selectedCriteria: null,
      selectedRubric: null,
      scores: null,

      // Chat功能相关
      chatMessages: [],
      chatInput: '',
      chatLoading: false,

      // 比对功能相关
      comparisonTexts: [], // 用于DiffViewer的modifiedTexts
      isComparing: false,

      leftPanelWidth: 54,
      rightPanelWidth: 46,
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
        }
      },
      deep: true
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

    // 解析URL参数
    urlParamsStore.parseUrlParams();

    // 设置rubric选择
    this.setupRubricFromUrl();

    usageLogger.init(urlParamsStore.getCurrentParams(), { page: 'WritingRubric', modelName: this.modelName })
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
    handleContentUpdate(newContent) {
      this.writingContent = newContent;
      usageLogger.updateWritingContent(this.writingContent, { source: 'DiffViewer@update' })
    },

    async sendContent() {
      if (!this.writingContent.trim()) {
        this.$q.notify({
          type: 'warning',
          message: 'Please write something before getting assessment',
          position: 'top'
        });
        usageLogger.log('notify', { type: 'warning', reason: 'empty_writing_before_assessment' }, { page: 'WritingRubric' })
        return;
      }

      const userWriting = this.writingContent;
      console.log('sendContent', userWriting, this.selectedRubric.rubric);

      // 重置评分状态
      this.selectedRubric.rubric.forEach(dimension => {
        dimension.criteria.forEach(criterion => {
          criterion.score_1.checked = false;
          criterion.score_2.checked = false;
          criterion.score_3.checked = false;
          // 简化模式不需要reason
        });
      });

      const roundId = usageLogger.beginRound({ page: 'WritingRubric' })
      usageLogger.log('click_button', { id: 'get-assessment' }, { page: 'WritingRubric' })
      await this.getFeedbacksConcurrently(userWriting);
      // 保存到历史记录
      this.saveToHistory(userWriting);
      usageLogger.endRound(roundId, { scores: this.scores }, { page: 'WritingRubric' })
      usageLogger.saveNow()
    },

    async getFeedbacksConcurrently(userWriting) {
      const { getRubricBasedFeedback } = await import('src/components/multiAgentWriting.js');
      const { formatToString } = await import('src/components/utilsWriting.js');

      const feedbackPromises = this.selectedRubric.rubric
        .map(rubricItem => getRubricBasedFeedback(userWriting, rubricItem, rubricItem.messageList, this.selectedRubric.columnCount, this.selectedRubric.taskDescription));

      try {
        this.feedbackLoading = true;
        const feedbacks = await Promise.all(feedbackPromises);

        console.log('------Feedbacks------:', feedbacks);

        feedbacks.forEach((feedback, index) => {
          const feedbackContent = JSON.parse(formatToString(feedback.content));
          console.log('feedback content:', feedbackContent);
          if (!feedbackContent) return;

          try {
            const rubricIndex = this.selectedRubric.rubric.reduce((acc, item, i) => {
              acc.push(i);
              return acc;
            }, [])[index];

            if (rubricIndex !== undefined) {
              // 只保留评分，移除reason字段
              const simplifiedCriteria = feedbackContent.map(criterion => {
                const simplifiedCriterion = { ...criterion };
                // 移除所有reason字段
                Object.keys(simplifiedCriterion).forEach(key => {
                  if (key.startsWith('score_') && simplifiedCriterion[key].reason) {
                    delete simplifiedCriterion[key].reason;
                  }
                });
                return simplifiedCriterion;
              });

              this.selectedRubric.rubric[rubricIndex].criteria = simplifiedCriteria;
            }
          } catch (e) {
            console.error('Error processing feedback:', e);
          }
        });
      } catch (error) {
        console.error('Error fetching feedbacks:', error);
        this.$q.notify({
          type: 'negative',
          message: 'Failed to get assessment. Please try again.',
          position: 'top'
        });
        usageLogger.log('error', { scope: 'getFeedbacksConcurrently', message: String(error && error.message || error) }, { page: 'WritingRubric' })
      } finally {
        this.feedbackLoading = false;
        // 分数汇总快照
        try { usageLogger.updateScores(this.scores) } catch (e) {}
      }
    },

    calculateScores(rubric) {
      const result = {
        totalMaxScore: 100,
        totalAIScore: 0,
        dimensions: []
      };

      rubric.forEach(dimension => {
        const dimensionWeight = dimension.percentage || (100 / rubric.length);

        const dimensionScore = {
          name: dimension.dimension,
          weight: dimensionWeight,
          rawMaxScore: 0,
          rawAiScore: 0,
          weightedMaxScore: dimensionWeight,
          weightedAiScore: 0,
          criteria: []
        };

        dimension.criteria.forEach((subcriteria, criterionIndex) => {
          const maxSubScore = this.selectedRubric.columnCount;
          dimensionScore.rawMaxScore += maxSubScore;

          const criterionDetail = {
            index: criterionIndex,
            aiSelectedScore: 0,
            scoreDetails: {}
          };

          this.scoreRange.forEach(score => {
            const scoreData = subcriteria[`score_${score}`];
            criterionDetail.scoreDetails[`score_${score}`] = {
              text: scoreData?.text || '',
              checked: scoreData?.checked || false
            };

            if (scoreData?.checked) {
              dimensionScore.rawAiScore += score;
              criterionDetail.aiSelectedScore = score;
            }
          });

          dimensionScore.criteria.push(criterionDetail);
        });

        if (dimensionScore.rawMaxScore > 0) {
          const aiScoreRate = dimensionScore.rawAiScore / dimensionScore.rawMaxScore;
          dimensionScore.weightedAiScore = aiScoreRate * dimensionWeight;
        }

        result.totalAIScore += dimensionScore.weightedAiScore;

        dimensionScore.maxScore = dimensionScore.weightedMaxScore;
        dimensionScore.aiScore = dimensionScore.weightedAiScore;

        result.dimensions.push(dimensionScore);
      });

      result.aiScorePercentage = (result.totalAIScore / result.totalMaxScore * 100).toFixed(0);

      return result;
    },

    saveToHistory(content) {
      // 简化版历史记录功能
      console.log('Assessment completed for content length:', content.length);
    },

    isCellSelected(dimension, score) {
      return dimension.criteria.some(criterion => criterion[`score_${score}`].checked);
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
        usageLogger.log('error', { scope: 'sendChatMessage', message: String(error && error.message || error) }, { page: 'WritingRubric' })

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
        usageLogger.log('notify', { type: 'warning', reason: 'no_content_to_compare' }, { page: 'WritingRubric' })
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
      usageLogger.log('compare_revision', { hasContent: true }, { page: 'WritingRubric' })

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
      usageLogger.log('hide_comparison', {}, { page: 'WritingRubric' })

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
  font-size: 16px;
  font-weight: bold;
  color: #666;
  letter-spacing: 2px;
}

.criteria-section {
  padding: 0px 4px;
  flex-shrink: 0;
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

.criterion-text {
  min-height: 1.5em;
  font-size: 13px;
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

/* 确保expansion item header样式统一 */
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
