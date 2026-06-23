<template>
  <q-card flat class="q-pa-xs">
    <div class="text-h6 text-bold" style="color: rgb(70, 70, 70);">Rubric Feedback Editor: {{ modelName }}</div>
  </q-card>
  <div class="editor-container">
    <!-- 写作编辑器 -->
    <form class="writing-editor"  autocorrect="off" autocapitalize="off" autocomplete="off" spellcheck="false">
      <q-editor class="writing-area" ref="editorRef" toolbar-text-color="white" toolbar-toggle-color="yellow-8" toolbar-bg="primary"
        @paste="onPaste"
        v-model="editorVisibleContent"
      />
    </form>
    <!-- 右侧区域 -->
    <div class="flex column feedback-panel">
      <!-- Criteria 选择区域 -->
      <q-expansion-item
        class="criteria-container"
        default-opened
        icon="rule"
        label="Rubric Criteria"
        header-class="text-primary"
      >
        <div class="criteria-section">
          <q-select
            v-model="selectedCriteria"
            :options="criteriaOptions"
            label="Choose a criteria"
            outlined
            dense
            class="q-mb-md"
          />

          <!-- Rubric 展示区域 -->
          <div v-if="selectedRubric" class="rubric-section">
            <div v-for="(dimension, index) in selectedRubric.rubric" :key="index" class="dimension-card q-mb-sm">
              <div class="dimension-header text-weight-bold">
                <q-checkbox
                  v-model="selectedDimensions"
                  :val="dimension.dimension"
                  :label="dimension.dimension"
                >
                  <q-tooltip
                    anchor="center right"
                    self="center left"
                    :offset="[10, 0]"
                    class="dimension-tooltip"
                  >
                    <div class="dimension-tooltip-content">
                      <div class="text-weight-bold q-mb-sm">{{ dimension.dimension }}</div>
                      <div class="text-caption q-mb-md">{{ dimension.description }}</div>
                      <div class="scores-preview">
                        <div v-for="(score, scoreIndex) in dimension.criteria" :key="scoreIndex"
                          class="score-preview-item q-pa-xs text-black"
                          :class="'score-level-' + (scoreIndex + 1)"
                        >
                          Criteria {{ dimension.criteria.length - scoreIndex }}:<br>
                          <span v-for="(item, index) in score" :key="index" class="text-weight-bold">{{ index }}: {{ item.text }}<br></span>
                        </div>
                      </div>
                    </div>
                  </q-tooltip>
                </q-checkbox>
              </div>
            </div>
          </div>
        </div>
      </q-expansion-item>

      <!-- 评论和反馈区域 -->
      <q-expansion-item
        class="feedback-container"
        default-opened
        icon="comment"
        label="Feedback"
        header-class="text-primary"
      >
        <div class="feedback-section">
          <div v-if="selectedRubric">
            <div v-for="(feedback, index) in selectedRubric.rubric.filter(item => item.checked)" :key="index" class="feedback-card">
              <div v-if="feedback.checked" >
                <p class="feedback-item" :style="{ borderLeft: `4px solid ${colors[index]}` }">
                  {{ feedback.dimension }} advisor:
                </p>
                <div class="feedback-details">
                  <div v-for="(message, i) in feedback.messageList" :key="i" class="feedback-block">
                    <div v-if="message.role !== 'user'">
                      <div v-html="renderMarkdown(message.content)" class="markdown-content"></div>
                    </div>
                  </div>
                  <div v-if="feedbackLoading" class="feedback-loading">
                    <q-skeleton type="text" />
                    <q-skeleton type="text" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </q-expansion-item>
    </div>
  </div>

  <div class="flex row">
    <q-btn class="q-ma-sm" color="primary" label="Get Feedback" @click="sendContent" :loading="feedbackLoading"/>
  </div>
</template>

<script>
import { getFeedback, getRubricBasedFeedback, getAgents, formatDateTime } from 'src/components/multiAgentWriting.js'
import { formatToString, formatToNewString } from 'src/components/utilsWriting.js'
import { localAPI } from 'boot/axios'
import MarkdownIt from 'markdown-it';

export default {
  name: 'FeedbackPage',
  props: {
    modelName: String,
    criteriaList: Array,
  },
  data() {
    return {
      editorVisibleContent: `We present a novel approach to compositional visual planning by (1) fine-tuning large language models (LLMs) with task-specific instructions and (2) incorporating an object detection agent model with vLLM.
Our method addresses the limitations of existing models, such as insensitivity to object positioning and suboptimal image processing performance.
By integrating the object detection model, our method can accurately determine the spatial positions of objects within an image.
Our agent method leverages the in-context learning capability of vision-language models (vLLM) to plan the target object's position without requiring fine-tuning.
To address the inherent precision constraints of vLLMs, we use the object detection model as an agent, providing precise location data that enhances prediction accuracy. Compared to previous methods, our agent approach improve alignment between textual descriptions and visual elements, increasing both consistency and accuracy in object placement.
Experimental results demonstrate that our method achieves the best performance while requiring minimal computation costs.`,
      feedbackComments: [],
      feedbackLoading: false,
      colors: ['#ffeb3b', '#8bc34a','#03a9f4', '#ff9800', '#e91e63', '#9c27b0', '#00bcd4', '#795548', '#ffe5b3'],
      editorRef: null,
      selectedCriteria: null,

      selectedRubric: null,
      selectedDimensions: [],
      md: new MarkdownIt({
        html: true,
        breaks: true,
        linkify: true,
      }),
    };
  },
  computed: {
    editorInvisibleContent() {
      // 使用正则表达式去除所有 HTML 标签
      const textContent = this.editorVisibleContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ');
      return textContent;
    },
    criteriaOptions() {
      return this.criteriaList.map(criteria => ({
        label: criteria.name,
        value: criteria.content
      }))
    }
  },
  watch: {
    selectedCriteria(newCriteria) {
      console.log('Selected Criteria:', this.selectedCriteria.value);
      this.selectedRubric = JSON.parse(JSON.stringify(this.selectedCriteria.value));
      console.log('rubricList:', this.selectedRubric);
      this.selectedDimensions = this.selectedRubric.rubric.map(dimension => dimension.dimension);
    },
    selectedDimensions(newDimensions) {
      console.log('selectedDimensions:', newDimensions);
      this.selectedRubric.rubric.forEach(dimension => {
        dimension.messageList = [];
        dimension.checked = newDimensions.includes(dimension.dimension);
      });
      console.log('selectedRubric:', this.selectedRubric.rubric);
    }
  },
  mounted() {
    // this.feedbackComments = await getAgents();
    console.log('criteriaList Feedback Page', this.criteriaList);
  },
  methods: {
    renderMarkdown(content) {
      // 移除开头的分数行
      const contentWithoutScore = content;
      return this.md.render(contentWithoutScore);
    },
    sendContent() {
      const userWriting = this.editorInvisibleContent;
      console.log('sendContent', userWriting, this.selectedRubric.rubric);
      this.getFeedbacksConcurrently(userWriting);
    },
    async getFeedbacksConcurrently(userWriting) {
      const feedbackPromises = this.selectedRubric.rubric.map((rubricItem) => {
        if (rubricItem.checked) {
          return getRubricBasedFeedback(userWriting, rubricItem);
        }
      });

      try {
        this.feedbackLoading = true;
        const feedbacks = await Promise.all(feedbackPromises);

        console.log('------Feedbacks------:', feedbacks);

        feedbacks.forEach((feedback, index) => {

          console.log('feedback1111111111:', feedback);
          if (!feedback) return;
          try {
            const feedbackContent = feedback;
            this.selectedRubric.rubric[index].messageList.push(feedbackContent);
            console.log('feedbackComments:', this.feedbackComments);
          } catch (e) {
            console.error('Error processing feedback:', e);
            feedback.content = [];
          }
        });
      } catch (error) {
        console.error('Error fetching feedbacks:', error);
      } finally {
        this.feedbackLoading = false;
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
    }
  },
};
</script>

<style scoped>
.editor-container {
  display: flex;
  justify-content: space-between;
}

.writing-editor {
  border: 1px solid #cbcbcb;
  border-radius: 8px;
  width: 48%;
  overflow-y: auto;
}

.writing-area {
  width: 100%;
  height: 80vh;
  border: none;
  outline: none;
  resize: none;
  padding: 0px;
  font-size: 16px;
  line-height: 1.6;
}

.feedback-section {
  display: flex;
  flex-direction: column; /* 使子元素横向排列 */
  gap: 4px; /* 控制子元素间距 */
  width: 100%; /* 占满容器宽度 */
}

.feedback-card {
  flex: 1; /* 使反馈容器在父级中均匀占比 */
  margin: 8px 4px;
}
.feedback-details {
  flex: 1; /* 使反馈详细信息部分占用更多空间 */
  display: flex;
  flex-direction: column;
}
.feedback-item {
  font: 16px Times New Roman, sans-serif;
  margin-bottom: 8px;
  cursor: pointer;
  padding-left: 8px;
  flex: 1;
}
.feedback-block {
  /* padding: 4px; */
  line-height: 1.6;
  font-family: Arial, sans-serif;
}
.feedback-block-item {
  padding: 4px;
  /* border-bottom: 1px solid #e0e0e0; */
  margin-bottom: 8px;
  border-radius: 12px;
  background-color: #e4e4e4;
}


.original-sentence, .suggested-revision, .explanation {
  font-size: 14px;
  margin: 4px 0px 0px 0px;
  padding: 4px;
  border-radius: 8px;
}

.feedback-panel {
  width: 48%;
  padding-left: 8px;
  border-left: 2px solid #9c9c9c;
  height: 80vh;
  display: flex;
  flex-direction: column;
}

/* 容器样式 */
.criteria-container, .feedback-container {
  max-height: 50vh;
  display: flex;
  flex-direction: column;
}

/* 内容区域样式 */
.criteria-section, .feedback-section {
  padding: 4px;
  background-color: #f5f5f5;
  border-radius: 8px;
  overflow-y: auto;
  max-height: calc(50vh - 48px); /* 减去expansion item header的高度 */
}

.q-expansion-item--expanded + .q-expansion-item {
  flex-shrink: 1;
}

/* 美化滚动条 */
.criteria-section::-webkit-scrollbar,
.feedback-section::-webkit-scrollbar {
  width: 6px;
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
  background-color: #f8f8f8;
  margin-bottom: 4px;
  border-radius: 8px;
}

:deep(.q-expansion-item__header:hover) {
  background-color: #eeeeee;
}

.highlighted-text {
  border: 1px solid #ffe5b3;
  border-radius: 8px;
  cursor: pointer;
}
.highlighted-text:hover {
  background-color: #ffa600 !important;
}

.popup-toolbar {
  background-color: #333;
  padding: 5px;
  border-radius: 6px;
  box-shadow: 3px 2px 14px 6px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  color: white;
}
.toolbar-content {
  display: flex;
  gap: 8px;
  align-items: center;
}
.toolbar-button {
  background-color: #555;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 3px;
  cursor: pointer;
}
.toolbar-button:hover {
  background-color: #777;
}
.feedback-action-buttons {
  display: flex;
  gap: 8px;
  margin-left: 4px;
}
.feedback-action-button {
  margin: 4px;
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background-color: #1976D2;
  color: white;
}

@keyframes highlight-animation {
  from { background-color: #ffcd6f;
    border: 1px solid #ffe5b3;
    border-radius: 8px; }
  to { background-color: rgb(249, 228, 222);
    border: 1px solid #ffe5b3;
    border-radius: 8px; }
}

.overall-score {
  font-size: 14px;
  color: #666;
  margin-left: 8px;
}

.criteria-section {
  padding: 8px;
  background-color: #f5f5f5;
  border-radius: 8px;
}

.rubric-section {
  padding: 4px;
  background-color: #f5f5f5;
  border-radius: 8px;
}

.dimension-card {
  background-color: white;
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.dimension-header {
  color: #1976D2;
  font-size: 16px;
}

.scores-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.score-item {
  border-radius: 4px;
  font-size: 16px;
}

.score-level-1 {
  background-color: #E3F2FD;
  border-left: 4px solid #2196F3;
}

.score-level-2 {
  background-color: #E8F5E9;
  border-left: 4px solid #4CAF50;
}

.score-level-3 {
  background-color: #FFF3E0;
  border-left: 4px solid #FF9800;
}

.score-level-4 {
  background-color: #FFEBEE;
  border-left: 4px solid #F44336;
}

.dimension-tooltip {
  max-width: 400px;
  background: white;
  color: #333;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-radius: 8px;
}

.dimension-tooltip-content {
  padding: 4px;
}

.scores-preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.score-preview-item {
  font-size: 12px;
  border-radius: 4px;
}

/* 确保 tooltip 中的评分等级样式与主视图一致 */
.score-preview-item.score-level-1 {
  background-color: #E3F2FD;
  border-left: 3px solid #2196F3;
}

.score-preview-item.score-level-2 {
  background-color: #E8F5E9;
  border-left: 3px solid #4CAF50;
}

.score-preview-item.score-level-3 {
  background-color: #FFF3E0;
  border-left: 3px solid #FF9800;
}

.score-preview-item.score-level-4 {
  background-color: #FFEBEE;
  border-left: 3px solid #F44336;
}

.score-preview-item.score-level-5 {
  background-color: #efffeb;
  border-left: 3px solid #c5f436;
}

.score-preview-item.score-level-6 {
  background-color: #ebfffc;
  border-left: 3px solid #36a8f4;
}

.score-preview-item.score-level-7 {
  background-color: #fff8eb;
  border-left: 3px solid #e436f4;
}

.score-preview-item.score-level-8 {
  background-color: #edebff;
  border-left: 3px solid #f43659;
}

.score-preview-item.score-level-9 {
  background-color: #ffebfe;
  border-left: 3px solid #46f436;
}

.score-preview-item.score-level-10 {
  background-color: #fff5eb;
  border-left: 3px solid #36f4c5;
}

/* 优化 checkbox 样式 */
:deep(.q-checkbox) {
  margin: 8px 0;
}

:deep(.q-checkbox__label) {
  font-size: 14px;
  color: #1976D2;
}

.markdown-content {
  line-height: 1.6;
}

.markdown-content :deep(h1) {
  font-size: 1.5em;
  margin: 0.5em 0;
}

.markdown-content :deep(h2) {
  font-size: 1.3em;
  margin: 0.5em 0;
}

.markdown-content :deep(p) {
  margin: 0.5em 0;
}

.markdown-content :deep(strong) {
  color: #1976D2;
  font-weight: 500;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
}

.markdown-content :deep(li) {
  margin: 0.3em 0;
}

.feedback-message {
  background-color: white;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

/* 添加分隔样式 */
.markdown-content :deep(hr) {
  border: none;
  border-top: 1px solid #e0e0e0;
  margin: 1em 0;
}

/* 为每个问题添加样式 */
.markdown-content :deep(ol) > li {
  background-color: #f8f9fa;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 12px;
}

/* 为不同类型的内容添加视觉区分 */
.markdown-content :deep(strong:contains("Problem with Sentence(s):")) {
  color: #f44336;
}

.markdown-content :deep(strong:contains("Improvement Suggestion:")) {
  color: #4caf50;
}

.markdown-content :deep(strong:contains("Explanation:")) {
  color: #ff9800;
}

/* 添加分隔样式 */
.markdown-content :deep(hr) {
  border: none;
  border-top: 1px solid #e0e0e0;
  margin: 1em 0;
}

/* 为每个问题添加样式 */
.markdown-content :deep(ol) > li {
  background-color: #f8f9fa;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 12px;
}

/* 为不同类型的内容添加视觉区分 */
.markdown-content :deep(strong:contains("Problem with Sentence(s):")) {
  color: #f44336;
}

.markdown-content :deep(strong:contains("Improvement Suggestion:")) {
  color: #4caf50;
}

.markdown-content :deep(strong:contains("Explanation:")) {
  color: #ff9800;
}

</style>
