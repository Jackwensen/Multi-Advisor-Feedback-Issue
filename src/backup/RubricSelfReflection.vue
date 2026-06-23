<template>
  <div class="feedback-section">
    <div class="text-h6 q-ma-sm">
      Self-Reflection with Rubric of Rubrics
      <q-icon name="sym_o_help" color="purple-5" class="q-ml-sm">
        <q-tooltip class="text-body2">
          Use this <b class="text-italic text-yellow-5">rubric of rubrics</b> to self-assess your rubric.
        </q-tooltip>
      </q-icon>
    </div>

    <div class="self-reflection-info q-mb-md">
      <q-banner class="bg-blue-1 text-blue-9" rounded>
        <template v-slot:avatar>
          <q-icon name="info" color="blue" />
        </template>
        Use this rubric to self-assess your rubric. Review each criterion and reflect on how well your rubric meets these standards.
      </q-banner>
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
            <td v-for="score in scoreRange" :key="score" class="criteria-cell">
              <div v-for="(criterion, cIndex) in dimension.criteria" :key="cIndex" class="criterion-item">
                <div class="criterion-text text-truncated">
                  {{ criterion[`score_${score}`].text }}
                </div>
                <q-tooltip anchor="center right" self="center left" :offset="[10, 0]" class="dimension-tooltip">
                  <div class="text-body2 q-mb-xs">{{ criterion[`score_${score}`].text }}</div>
                </q-tooltip>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="self-reflection-actions q-mt-md">
        <q-btn
          unelevated rounded color="primary"
          label="Save Self-Assessment"
          @click="saveSelfAssessment"
          icon="save"
        />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'RubricSelfReflection',
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
      metaRubric: [{
        "dimension": "Clarity of criteria",
        "description": "",
        "percentage": 40,
        "criteria": [
          {
            "score_4": {
              "text": "Each criteria is distinct, clearly delineated and fully appropriate for the assignment(s)/course",
              "checked": false
            },
            "score_3": {
              "text": "Criteria being assessed are clear, appropriate and distinct",
              "checked": false
            },
            "score_2": {
              "text": "Criteria being assessed can be identified, but are not clearly differentiated or are inappropriate",
              "checked": false
            },
            "score_1": {
              "text": "Criteria being assessed are unclear, inappropriate and/or have significant overlap",
              "checked": false
            }
          }
        ]
      },
      {
        "dimension": "Distinction between Levels",
        "description": "",
        "percentage": 30,
        "criteria": [
          {
            "score_4": {
              "text": "Each level is distinct and progresses in a clear and logical order",
              "checked": false,
            },
            "score_3": {
              "text": "Distinction between levels is apparent",
              "checked": false,
            },
            "score_2": {
              "text": "Some distinction between levels is evident, but remain unclear",
              "checked": false,
            },
            "score_1": {
              "text": "Little/no distinction can be made between levels of achievement",
              "checked": false,
            }
          }
        ]
      },
      {
        "dimension": "Reliability of Scoring",
        "description": "",
        "percentage": 30,
        "criteria": [
          {
            "score_4": {
              "text": "Cross-scoring of assignments using rubric results in consistent agreement among scorers",
              "checked": false
            },
            "score_3": {
              "text": "There is general agreement between different scorers when using the rubric (e.g. differs by less than 5–10% or less than ½ level)",
              "checked": false
            },
            "score_2": {
              "text": "Cross-scoring by faculty and/or students occasionally produces inconsistent results",
              "checked": false
            },
            "score_1": {
              "text": "Cross-scoring among faculty and/or students often results in significant differences",
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
    saveSelfAssessment() {
      this.$q.notify({
        type: 'positive',
        message: 'Self-assessment saved successfully!',
        position: 'top',
        timeout: 2000
      });
    }
  }
}
</script>

<style scoped>
.feedback-section {
  margin: 4px 0px 0px 8px;
  padding: 0px;
  width: calc(100% - 12px);
  height: calc(100vh - 108px);
  overflow-x: hidden;
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
  width: 20%;
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

.criterion-item {
  margin-bottom: 6px;
  padding: 2px;
}

.criterion-item:last-child {
  margin-bottom: 0;
}

.criterion-text {
  font-size: 14px;
  line-height: 1.3;
  color: #555;
}

.text-truncated {
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dimension-tooltip {
  max-width: 300px;
}

.dimension-tooltip-content {
  padding: 8px;
}

.self-reflection-actions {
  text-align: center;
  margin-top: 16px;
}
</style>
