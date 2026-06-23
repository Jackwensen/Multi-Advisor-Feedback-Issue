<template>
  <q-card flat class="q-pa-xs">
    <div class="text-h6 text-bold q-ml-xl" style="color: rgb(70, 70, 70);">Editor: {{ modelName }}</div>
  </q-card>
  <div class="editor-container">
    <!-- 写作编辑器 -->
    <form class="writing-editor"  autocorrect="off" autocapitalize="off" autocomplete="off" spellcheck="false">
      <q-editor class="writing-area" ref="editorRef" toolbar-text-color="white" toolbar-toggle-color="yellow-8" toolbar-bg="primary" @paste="onPaste"
        v-model="editorVisibleContent"
        @click="onEditorClick"
      />
    </form>
    <!-- 评论和反馈区域 -->
    <div class="feedback-panel">
      <div v-if="feedbackComments.length === 0">
        <p>No feedback available. Click on a paragraph to view feedback.</p>
      </div>
      <div v-else class="feedback-section">
        <div v-for="(feedback, index) in feedbackComments.filter(item => item.checked)" :key="index"  class="feedback-card">
          <div v-if="feedback.checked" >
            <p class="feedback-item" :style="{ borderLeft: `4px solid ${colors[index]}` }" @click="highlightFeedback(index)">
              {{ feedback.type }} advisor:
            </p>
            <div class="feedback-details">
              <div v-for="(message, i) in feedback.messageList" :key="i" class="feedback-block">
                <div v-if="message.role !== 'user'">
                  <div v-for="(feedbackItem, j) in message.content" :key="j"
                    :class="feedbackItem.accept === 0 ? 'feedback-block-item' : ''"
                    :type="feedback.type"
                    :original-sentence="feedbackItem.original_content"
                    :suggested-revision="feedbackItem.suggested_revision"
                    :explanation="feedbackItem.explanation"
                  >
                  <div v-if="feedbackItem.accept === 0">
                    <span class="text-subtitle1 text-bold q-pl-xs">Feedback {{Math.ceil((i+1)/2)}}-{{j+1}} :</span><br>
                    <span class="text-body2 q-pl-xs">Time: {{feedbackItem.time}}</span>
                    <p class="original-sentence" :style="{ backgroundColor: colors[index] }"
                      :type="feedback.type"
                      :original-sentence="feedbackItem.original_content"
                      @click="handleClickFeedback({type: feedback.type, original: feedbackItem.original_content, suggested: feedbackItem.suggested_revision, explanation: feedbackItem.explanation})"
                    >
                      <strong>Original:</strong> {{ feedbackItem.original_content }}
                    </p>
                    <p class="suggested-revision">
                      <strong>Suggested Revision:</strong> {{ feedbackItem.suggested_revision }}
                    </p>
                    <p class="explanation">
                      <strong>Explanation:</strong> {{ feedbackItem.explanation }}
                    </p>
                  </div>
                  </div>
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
  </div>

  <div class="flex row">
    <q-btn class="q-ma-sm" color="primary" label="Get Feedback" @click="sendContent" :loading="feedbackLoading"/>
    <div class="q-ma-sm flex row">
      <div v-for="(feedbackAgent, index) in feedbackComments" :key="index">
        <q-checkbox v-model="feedbackAgent.checked" :label="feedbackAgent.type" />
      </div>
    </div>
  </div>
</template>

<script>
import { getFeedback, getAgents, formatDateTime } from 'src/components/multiAgentWriting.js'
import { formatToString } from 'src/components/utilsWriting.js'
export default {
  name: 'FeedbackPage',
  props: {
    modelName: String,
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
      contentFeedbackList: [],
      feedbackLoading: false,
      colors: ['#ffeb3b', '#8bc34a','#03a9f4', '#ff9800', '#e91e63', '#9c27b0', '#00bcd4', '#795548', '#ffe5b3'],
      editorRef: null,
    };
  },
  computed: {
    editorInvisibleContent() {
      // 使用正则表达式去除所有 HTML 标签
      const textContent = this.editorVisibleContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ');
      console.log('----editor Invisible Content:----', textContent);
      return textContent;
    }
  },
  watch: {
    feedbackComments: {
      handler(newVal, oldVal) {
        console.log('----feedbackComments changed:----', newVal);
        this.highlightedContent();
      },
      deep: true
    }
  },
  methods: {
    highlightedContent() {
      console.log('----highlighted Content----');
      let editContent = this.editorInvisibleContent;
      const sentencesToHighlight = [];

      // 收集所有advisor的original_sentence和对应的颜色
      this.feedbackComments.filter(item => item.checked).forEach((advisor, index) => {
        advisor.messageList.forEach((message) => {
          if (message.role === 'assistant' && Array.isArray(message.content)) {
            message.content.forEach((feedbackItem) => {
              // 检查句子是否已经在替换列表中，避免重复替换
              if (!sentencesToHighlight.some(item => item.sentence === feedbackItem.original_content)) {
                if (feedbackItem.accept === 0) {
                  sentencesToHighlight.push({
                    sentence: feedbackItem.original_content,
                    color: `background-color: #ffe5b3`
                  });
                }
              }
              // 为每个句子收集advisor的反馈
              const existingFeedback = this.contentFeedbackList.find(
                item => item.content === feedbackItem.original_content
              );
              if (existingFeedback) {
                if (existingFeedback.advisorFeedbackList.find(item => item.type === advisor.type)) {
                  return;
                }
                // 如果句子已存在，添加新的advisor反馈
                existingFeedback.advisorFeedbackList.push({
                  type: advisor.type,
                  comment: feedbackItem
                });
              } else {
                // 如果是新句子，创建新的反馈项
                this.contentFeedbackList.push({
                  content: feedbackItem.original_content,
                  advisorFeedbackList: [{
                    type: advisor.type,
                    comment: feedbackItem
                  }]
                });
              }
            });
          }
        });
      });
      console.log('sentences To Highlight:', sentencesToHighlight);
      console.log('content Feedback List:', this.contentFeedbackList);
      // 批量进行替换
      sentencesToHighlight.forEach(({ sentence, color }) => {
        const highlighted = `<span style="${color}" class="highlighted-text" data-original="${sentence}">${sentence}</span>`;
        console.log('highlighted:', highlighted);
        editContent = editContent.replace(sentence, highlighted);
      });
      console.log('highlighted Content\n', editContent);
      this.editorVisibleContent = editContent;
    },
    async getAgent() {
      this.feedbackComments = await getAgents();
    },
    sendContent() {
      const userMessage = {
        content: this.editorInvisibleContent,
        role: 'user',
      };
      console.log('sendContent', userMessage);
      this.getFeedbacksConcurrently(userMessage);
    },
    async getFeedbacksConcurrently(message) {
      const feedbackPromises = this.feedbackComments.map((item) => {
        if (item.checked) {
          item.messageList.push(message);
          return getFeedback(item.messageList, item.systemPrompts);
        }
      });
      try {
        this.feedbackLoading = true;
        const feedbacks = await Promise.all(feedbackPromises);
        feedbacks.forEach((feedback, index) => {
          if (!feedback) return;
          try {
            const content = formatToString(feedback.content);
            const contentObj = JSON.parse(content);
            // 使用对象解构来比较内容,而不是直接比较对象引用
            const isDuplicate =contentObj.every(newFeedback =>
              this.feedbackComments[index].messageList.some(item => {
                if (item.role === 'assistant') {
                  return item.content.some(existingFeedback =>
                    existingFeedback.original_content === newFeedback.original_content
                  );
                }
                return false;
              })
            );
            if (!isDuplicate) {
              const newFeedbacks = contentObj.filter(newFeedback =>
                !this.feedbackComments[index].messageList.some(item =>
                  item.role === 'assistant' &&
                  item.content.some(existingFeedback =>
                    existingFeedback.original_content === newFeedback.original_content
                  )
                )
              );
              // 只添加新的反馈
              if (newFeedbacks.length > 0) {
                newFeedbacks.forEach(item => {
                  item.accept = 0;
                  item.time = formatDateTime(new Date().getTime());
                });

                // 如果messageList中已经有assistant的消息，就更新它的content
                const existingAssistantMessage = this.feedbackComments[index].messageList.find(
                  item => item.role === 'assistant'
                );

                feedback.content = newFeedbacks;
                this.feedbackComments[index].messageList.push(feedback);
                // if (existingAssistantMessage) {
                //   existingAssistantMessage.content.push(...newFeedbacks);
                // } else {
                // }
              }
            }
          } catch (e) {
            console.error('Error processing feedback:', e);
            feedback.content = [];
          }
        });
      } catch (error) {
        console.error('Error fetching feedbacks:', error);
      } finally {
        this.feedbackLoading = false; // 确保loading状态总是被重置
      }
    },
    highlightFeedback(index) {
      const feedbackElement = document.querySelectorAll('.feedback-card')[index];
      if (feedbackElement) {
        this.scrollAndHighlightFeedback(feedbackElement);
      }
    },
    handleClickFeedback(feedback) {
      const editorElement = document.querySelector(`span[data-original="${feedback.original}"]`);
      console.log('editor Element:', editorElement);
      if (editorElement) {
        // 先清除所有已存在的UI元素
        this.removeExistingToolbar();
        this.clearExistingFeedbackUI();

        this.scrollAndHighlightFeedback(editorElement);
        const { type, original, suggested, explanation } = feedback;
        this.$nextTick(() => {
          this.showFeedbackActions(type, original, suggested, explanation);
        });
      }
    },
    onEditorClick(event) {
      const target = event.target;
      console.log('editor Visible Content', this.editorVisibleContent);
      console.log('editor Invisible Content:', this.editorInvisibleContent);
      console.log('feedback Comments:', this.feedbackComments);
      console.log('content Feedback List:', this.contentFeedbackList);
      if (target.tagName === 'SPAN' && target.dataset.original) {
        const sentence = target.dataset.original;
        this.scrollToFeedback(sentence);
        this.createToolbar(event, sentence); // 创建工具栏
      }
    },
    scrollToFeedback(sentence) {
      this.$nextTick(() => {
        const feedbackElements = document.querySelectorAll(`p[original-sentence="${sentence}"]`);
        if (feedbackElements.length > 0) {
          feedbackElements.forEach((element) => {
            this.scrollAndHighlightFeedback(element);
          });
        }
      });
    },
    createToolbar(event, sentence) {
      this.removeExistingToolbar();

      // 创建工具栏
      const toolbar = this.createToolbarElement(event, sentence);
      // 为工具栏按钮添加点击事件
      this.setupToolbarButtonEvents(toolbar);

      // 添加全局点击监听
      setTimeout(() => {
        document.addEventListener('click', this.hideToolbarOnClickOutside);
      }, 0);
    },
    createToolbarElement(event, sentence) {
      const toolbar = document.createElement('div');

      toolbar.className = 'popup-toolbar';

      const feedbackOfContent = this.contentFeedbackList.find(item => item.content === sentence );
      const buttonsHtml = this.createToolbarButtons(feedbackOfContent.advisorFeedbackList);

      toolbar.innerHTML = `
        <div class="toolbar-content">
          <span>Feedback:</span>
          ${buttonsHtml}
        </div>`;

      // 临时添加到DOM获取尺寸
      toolbar.style.visibility = 'hidden';
      toolbar.style.position = 'fixed';
      document.body.appendChild(toolbar);

      const toolbarRect = toolbar.getBoundingClientRect();
      const toolbarWidth = toolbarRect.width;
      const toolbarHeight = toolbarRect.height;

      // 使用鼠标点击位置计算
      const mouseX = event.clientX;
      const mouseY = event.clientY;

      // 计算位置 - 以鼠标位置为基准
      let top = mouseY - toolbarHeight - 10; // 显示在鼠标上方
      let left = mouseX - (toolbarWidth / 2); // 以鼠标为中心

      // Y轴边界检查
      if (top < 10) {
        top = mouseY + 10; // 如果上方空间不够，显示在鼠标下方
      }

      // X轴边界检查
      if (left < 10) {
        left = 10;
      } else if (left + toolbarWidth > window.innerWidth - 10) {
        left = window.innerWidth - toolbarWidth - 10;
      }

      // 设置位置
      toolbar.style.top = `${top}px`;
      toolbar.style.left = `${left}px`;
      toolbar.style.visibility = 'visible';

      return toolbar;
    },
    createToolbarButtons(advisorFeedbackList) {
      return advisorFeedbackList.map(item => {
        if (item.comment.accept === 0) {
          return `
            <button class="toolbar-button"
              data-type="${item.type}"
              data-original="${item.comment.original_content}"
              data-suggested="${item.comment.suggested_revision}"
              data-explanation="${item.comment.explanation}"
            >${item.type}</button>
          `;
        }
      }).join('');
    },
    setupToolbarButtonEvents(toolbar) {
      toolbar.querySelectorAll('.toolbar-button').forEach(button => {
        button.addEventListener('click', (e) => {
          const { type, original, suggested, explanation } = e.target.dataset;
          this.$nextTick(() => {
            this.clearExistingFeedbackUI();
            this.showFeedbackActions(type, original, suggested, explanation);
          });
        });
      });
    },
    clearExistingFeedbackUI() {
      // 移除所有操作按钮和高亮效果
      document.querySelectorAll('.feedback-action-buttons').forEach(btn => btn.remove());
      document.querySelectorAll('.spolight').forEach(el => el.classList.remove('spolight'));
    },
    showFeedbackActions(type, original, suggested, explanation) {
      // 先清除其他元素的spotlight效果
      document.querySelectorAll('.spolight').forEach(el => el.classList.remove('spolight'));
      const feedbackElement = document.querySelector(`div[original-sentence="${original}"][type="${type}"]`);
      if (!feedbackElement) return;
      feedbackElement.classList.add('spolight');
      this.scrollAndHighlightFeedback(feedbackElement);
      // 移除已存在的操作按钮
      feedbackElement.querySelectorAll('.feedback-action-buttons').forEach(btn => btn.remove());
      const actionButtons = this.createActionButtons(type, original, suggested, explanation);
      feedbackElement.appendChild(actionButtons);
      this.setupActionButtonsEvents(actionButtons, feedbackElement);
    },
    createActionButtons(type, original, suggested, explanation) {
      const actionButtons = document.createElement('div');
      actionButtons.className = 'feedback-action-buttons';
      actionButtons.innerHTML = `
        <div>
          <button class="feedback-action-button" data-method="accept" data-type="${type}" data-original="${original}" data-suggested="${suggested}" data-explanation="${explanation}">Accept</button>
          <button class="feedback-action-button" data-method="reject" data-type="${type}" data-original="${original}" data-suggested="${suggested}" data-explanation="${explanation}">Reject</button>
        </div>
      `;
      return actionButtons;
    },
    setupActionButtonsEvents(actionButtons, feedbackElement) {
      // 设置操作按钮点击事件
      actionButtons.querySelectorAll('.feedback-action-button').forEach(button => {
        button.addEventListener('click', (e) => {
          e.stopPropagation(); // 阻止事件冒泡
          const { type, method, original, suggested, explanation } = e.target.dataset;
          // 处理接受/拒绝操作
          console.log('Action clicked:\n', type, '\n', method, '\n', original, '\n', suggested, '\n', explanation);
          if (method === 'accept') {
            // 更新编辑器内容
            this.updateEditorContent(original, suggested);
            // 更新反馈状态
            this.updateFeedbackStatus(original, type, 1);
          } else if (method === 'reject') {
            this.updateFeedbackStatus(original, type, 2);
          }
          // 移除操作按钮和高亮效果
          this.clearExistingFeedbackUI();
          this.removeExistingToolbar();
        });
      });
      // 设置点击外部关闭事件
      const handleClickOutside = (event) => {
        const toolbar = document.querySelector('.popup-toolbar');
        if (!actionButtons.contains(event.target) && (!toolbar || !toolbar.contains(event.target)) && !event.target.closest('.original-sentence')) {
          feedbackElement.classList.remove('spolight');
          actionButtons.remove();
          document.removeEventListener('click', handleClickOutside);
        }
      };
      setTimeout(() => document.addEventListener('click', handleClickOutside), 0);
    },
    // 新增方法：更新编辑器内容
    updateEditorContent(original, suggested) {
      // 更新可见内容
      const spanElement = document.querySelector(`span[data-original="${original}"]`);
      console.log('spanElement', spanElement);
      if (spanElement) {
        // 获取原始HTML内容
        const originalHtml = spanElement.outerHTML;
        // 更新编辑器内容，用suggested替换整个span标签
        this.editorVisibleContent = this.editorVisibleContent.replace(originalHtml, suggested);
      }
      console.log('更新后的编辑器内容', this.editorVisibleContent);
      // const highlighted = `<span style="background-color: #ffe5b3" class="highlighted-text" data-original="${original}">${original}</span>`;
      // this.editorVisibleContent = this.editorVisibleContent.replace(highlighted, suggested);
      // 重新计算高亮内容
      // this.$nextTick(() => {
      //   this.highlighted Content();
      // });
    },
    // 新增方法：更新反馈状态
    updateFeedbackStatus(original, acceptedType, status) {
      this.feedbackComments.forEach(advisor => {
        advisor.messageList.forEach(message => {
          if (message.role === 'assistant' && Array.isArray(message.content)) {
            message.content.forEach(item => {
              if (item.original_content === original && status == 1) {
                // 如果是接受的advisor，标记为1，否则标记为2
                item.accept = advisor.type === acceptedType ? status : 2;
              } else if (item.original_content === original && status == 2 && advisor.type === acceptedType) {
                item.accept = 2;
              }
            });
          }
        });
      });
      // 更新 contentFeedbackList
      const feedbackItem = this.contentFeedbackList.find(
        item => item.content === original
      );
      if (feedbackItem) {
        feedbackItem.advisorFeedbackList.forEach(advisor => {
          if(status == 1) {
            advisor.comment.accept = advisor.type === acceptedType ? status : 2;
          } else if (status == 2 && advisor.type === acceptedType) {
            advisor.comment.accept = 2;
          }
        });
      }
    },
    removeExistingToolbar() {
      const existingToolbar = document.querySelector('.popup-toolbar');
      if (existingToolbar) {
        existingToolbar.remove();
      }
      document.removeEventListener('click', this.hideToolbarOnClickOutside);
    },
    hideToolbarOnClickOutside(event) {
      const toolbar = document.querySelector('.popup-toolbar');
      const actionButtons = document.querySelector('.feedback-action-buttons');

      if (toolbar && !toolbar.contains(event.target) &&
          (!actionButtons || !actionButtons.contains(event.target))) {
        this.removeExistingToolbar();
      }
    },
    scrollAndHighlightFeedback(feedbackElement) {
      feedbackElement.classList.add('highlight');
      feedbackElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => feedbackElement.classList.remove('highlight'), 500);
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
  mounted() {
    this.getAgent();
  }
};
</script>

<style scoped>
.editor-container {
  display: flex;
  justify-content: space-between;
}
.writing-editor {
  /* border: 1px solid #cbcbcb; */
  /* border-radius: 8px; */
  width: 62%;
  overflow-y: auto;
  margin: 0px 24px;
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
  width: 36%;
  padding-left: 8px;
  border-left: 2px solid #9c9c9c;
  background-color: #e0e7ff7e;
  overflow-y: auto;
  height: 80vh;
}
.spolight {
  background-color: #ffffff;
  /* border: 1px solid #5e5e5e; */
  border-radius: 8px;
  box-shadow: 4px 2px 12px rgba(0, 0, 0, 0.392);
  margin: 12px 0px;
}
.highlight {
  animation: highlight-animation 0.5s ease;
}
.highlighted-text {
  border: 1px solid #ffe5b3;
  border-radius: 8px;
  cursor: pointer;
}
.highlighted-text:hover {
  background-color: #ffa600 !important;
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
</style>
