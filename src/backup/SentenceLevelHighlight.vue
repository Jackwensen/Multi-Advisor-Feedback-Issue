<template>
  <div class="editor-container">
    <!-- Writing Content Area using contenteditable -->
    <div 
      ref="editor"
      class="contenteditable-area"
      contenteditable="true"
      @mouseup="getSelectedText"
      @input="saveContent"
    >
    </div>

    <!-- Feedback Area -->
    <div class="feedback-area">
      <h5>Feedback Comments</h5>
      <div v-if="feedbackComments.length === 0">
        <p>No feedback yet. Highlight text and click 'Get Feedback'.</p>
      </div>
      <div v-else>
        <p
          v-for="(feedback, index) in feedbackComments"
          :key="index"
          @click="highlightText(feedback.highlightedText)"
          class="feedback-item"
        >
          {{ feedback.comment }}
        </p>
      </div>
    </div>

    <!-- Get Feedback Button -->
    <q-btn
      color="primary"
      label="Get Feedback"
      @click="generateFeedback"
      class="get-feedback-btn"
    />
  </div>
</template>

<script>
export default {
  data() {
    return {
      feedbackComments: [],
      contentHtml: "", 
    };
  },
  methods: {
    // Function to get selected text in the contenteditable div
    getSelectedText() {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();

      if (selectedText.length > 0) {
        // Store the highlighted text for feedback
        this.feedbackComments.push({
          highlightedText: selectedText,
          comment: "This is a placeholder comment. Click 'Get Feedback' for feedback.",
        });
        
        // Wrap the selected text in a span with highlight style
        this.highlightSelection();
      }
    },

    // Function to highlight the selected text
    highlightSelection() {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const span = document.createElement("span");
        span.style.backgroundColor = "yellow"; // Apply yellow highlight
        range.surroundContents(span);
        selection.removeAllRanges(); // Clear the selection
      }
    },

    // Save the contenteditable HTML content
    saveContent() {
      this.contentHtml = this.$refs.editor.innerHTML;
    },

    // Function to generate feedback
    generateFeedback() {
      console.log(this.contentHtml)
      this.feedbackComments = this.feedbackComments.map((item) => ({
        ...item,
        comment: `Feedback for "${item.highlightedText}": [AI-generated feedback here]`,
      }));
    },

    // Function to highlight the text based on the comment click
    highlightText(text) {
      const editor = this.$refs.editor;
      const innerHTML = editor.innerHTML;
      const index = innerHTML.indexOf(text);
      
      console.log("Highlighting text:", text);
      if (index >= 0) {
        // Create a new range and highlight the text
        const range = document.createRange();
        const node = editor.childNodes[0];
        range.setStart(node, index);
        range.setEnd(node, index + text.length);
        
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }
    },
  },
};
</script>

<style scoped>
.editor-container {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  padding: 20px;
}

.contenteditable-area {
  flex: 3;
  margin-right: 20px;
  width: 100%;
  height: 500px;
  border: 1px solid #ccc;
  padding: 10px;
  font-size: 16px;
  line-height: 1.6;
  overflow-y: auto;
}

.feedback-area {
  flex: 1;
  background-color: #f9f9f9;
  padding: 20px;
  border-left: 1px solid #ccc;
  height: 540px;
  overflow-y: auto;
}

.feedback-item {
  margin-bottom: 10px;
  cursor: pointer;
  border-left: 4px solid #42a5f5;
  padding-left: 10px;
}

.get-feedback-btn {
  position: fixed;
  bottom: 20px;
  right: 20px;
}
</style>
