<template>
  <div class="diff-viewer">
    <!-- 新增：加载状态和错误提示 -->
    <div v-if="isLoading" class="loading-overlay">
      <q-spinner-dots size="50px" color="primary" />
      <div class="text-subtitle2 q-mt-sm">Processing...</div>
    </div>

    <div v-if="errorMessage" class="error-message q-pa-md q-mb-md">
      <q-icon name="error" color="negative" size="sm" class="q-mr-sm" />
      {{ errorMessage }}
      <q-btn
        flat
        dense
        icon="close"
        size="sm"
        class="float-right"
        @click="errorMessage = ''"
      />
    </div>

    <div class="layout-container" :class="{ 'has-operations': operations.length > 0 }">
      <!-- 编辑器容器 -->
      <div class="editor-container">
        <q-editor
          ref="editorRef"
          class="writing-editor text-body1 q-pa-sm"
          v-model="editableOutput"
          :toolbar="editorToolbar"
          @update:model-value="handleEditorChange"
        />

        <!-- Custom tooltip -->
        <q-tooltip
          v-if="tooltipTarget"
          ref="tooltipRef"
          v-model="showTooltip"
          :target="tooltipTarget"
          anchor="top middle"
          self="bottom middle"
          :offset="[0, 10]"
          class="custom-tooltip"
          max-width="440px"
        >
          <div v-if="tooltipContent" class="tooltip-content">
            <div class="tooltip-header">
              <q-icon
                :name="tooltipContent.type === 'insert' ? 'add' : 'remove'"
                :color="tooltipContent.type === 'insert' ? 'positive' : 'negative'"
                size="sm"
              />
              <span class="tooltip-action">
                {{ tooltipContent.type === 'insert' ? 'Added' : 'Deleted' }}
              </span>
              <span class="tooltip-version">by {{ tooltipContent.version }}</span>
            </div>

            <div v-if="tooltipContent.reason" class="tooltip-reason">
              {{ tooltipContent.reason }}
            </div>

            <div v-if="tooltipContent.text && tooltipContent.text.trim()" class="tooltip-change">
              <span class="change-label">{{ tooltipContent.type === 'insert' ? 'Added:' : 'Deleted:' }}</span>
              "{{ tooltipContent.text }}"
            </div>
          </div>
        </q-tooltip>
      </div>

      <!-- 右侧operations列表，只在有operations时显示 -->
      <div v-if="operations.length > 0" class="operations-column">
        <div class="operations-header">
          <h6 class="text-subtitle2 q-ma-none">Changes ({{ operations.length }})</h6>
        </div>
        <q-scroll-area ref="operationsScrollRef" class="operations-list" :thumb-style="{ width: '4px', backgroundColor: '#027be3', opacity: 0.5 }" >
          <div
            v-for="operationGroup in operations"
            :key="operationGroup.id"
            :ref="el => setOperationRef(operationGroup.id, el)"
            class="operation-group"
            :class="{ 'operation-highlighted': highlightedOperationId === operationGroup.id }"
            @click="scrollToEditorElement(operationGroup.id)"
          >
            <!-- Operation组类型标识 -->
            <div class="operation-header">
              <q-chip
                :color="getGroupChipColor(operationGroup.type)"
                text-color="white"
                size="sm"
                class="operation-type-chip"
              >
                <q-icon
                  :name="getGroupChipIcon(operationGroup.type)"
                  size="xs"
                />
              </q-chip>

              <!-- 版本信息 -->
              <div class="operation-version text-caption" :class="operationGroup.color?.strike">
                {{ operationGroup.version }}
              </div>
            </div>

            <!-- 修改内容 -->
            <div class="operation-content">
              <!-- 遍历操作组中的每个操作 -->
              <div
                v-for="(operation, index) in operationGroup.operations"
                :key="operation.id"
                class="individual-operation"
              >
                <div class="operation-text" :class="getOperationTextClass(operation)">
                  <span class="operation-label">
                    {{ operation.type === 'insert' ? '+  ' : '-  ' }}
                  </span>
                  "{{ operation.text }}"
                  <span v-if="index === 0 && operationGroup.operations.length > 1" class="q-ml-sm">
                    ➡️
                  </span>
                </div>

              </div>
            </div>
            <div
              v-for="(operation, index) in operationGroup.operations"
              :key="operation.id"
              class="individual-operation"
              :class="{ 'q-mt-sm': index > 0 }"
            >
              <!-- 原因说明（只在第一个操作显示，避免重复） -->
              <div v-if="index === 0 && operation.reason" class="operation-reason text-caption text-grey-7">
                {{ operation.reason }}
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="operation-actions">
              <q-btn
                @click.stop="acceptOperationGroup(operationGroup)"
                icon="check"
                color="positive"
                round
                flat
                class="q-mr-xs"
              >
                <q-tooltip>Accept this change</q-tooltip>
              </q-btn>
              <q-btn
                @click.stop="rejectOperationGroup(operationGroup)"
                icon="close"
                color="negative"
                round
                flat
              >
                <q-tooltip>Reject this change</q-tooltip>
              </q-btn>
            </div>
          </div>
        </q-scroll-area>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick, computed, onUnmounted } from 'vue';
import { diffWords } from 'diff';
import usageLogger from 'src/store/usageLogger.js'

// Constants
const EDITOR_TOOLBAR = [];

// 新增：更多常量定义
const OPERATION_TYPES = {
  ORIGINAL: 'original',
  INSERT: 'insert',
  DELETE: 'delete'
};

const COLOR_PALETTE = [
  { underline: 'bg-red-1', strike: 'text-red', border: 'border-red' },
  { underline: 'bg-green-1', strike: 'text-green', border: 'border-green' },
  { underline: 'bg-blue-1', strike: 'text-blue', border: 'border-blue' },
  { underline: 'bg-amber-1', strike: 'text-amber', border: 'border-amber' },
  { underline: 'bg-purple-1', strike: 'text-purple', border: 'border-purple' },
  { underline: 'bg-pink-1', strike: 'text-pink', border: 'border-pink' },
  { underline: 'bg-cyan-1', strike: 'text-cyan', border: 'border-cyan' },
  { underline: 'bg-teal-1', strike: 'text-teal', border: 'border-teal' },
  { underline: 'bg-orange-1', strike: 'text-orange', border: 'border-orange' },
  { underline: 'bg-indigo-1', strike: 'text-indigo', border: 'border-indigo' },
  { underline: 'bg-deep-purple-1', strike: 'text-deep-purple', border: 'border-deep-purple' },
  { underline: 'bg-light-blue-1', strike: 'text-light-blue', border: 'border-light-blue' },
  { underline: 'bg-light-green-1', strike: 'text-light-green', border: 'border-light-green' },
  { underline: 'bg-yellow-1', strike: 'text-yellow-9', border: 'border-yellow' },
  { underline: 'bg-deep-orange-1', strike: 'text-deep-orange', border: 'border-deep-orange' },
];

// Props validation with comprehensive checks
const props = defineProps({
  originalText: {
    type: String,
    required: true,
    default: '',
  },
  modifiedTexts: {
    type: Array,
    required: true,
    default: () => [],
    validator: (value) => {
      if (!Array.isArray(value)) return false;
      return value.every(item =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.editedText === 'string' &&
        typeof item.name === 'string' &&
        item.name.trim().length > 0
      );
    }
  },
  versionVisibility: {
    type: Object,
    default: () => ({}),
  },
  versionColorMap: {
    type: Object,
    default: () => ({}),
  }
});

// Emits
const emit = defineEmits(['update:originalText', 'delete-version']);

// Computed properties
const editorToolbar = computed(() => EDITOR_TOOLBAR);

// 新增：缓存版本颜色映射
const versionColorMap = computed(() => {
  const map = new Map();
  props.modifiedTexts.forEach((item, idx) => {
    const versionName = item?.name || `Version ${idx + 1}`;
    if (props.versionColorMap && versionName in props.versionColorMap) {
      const colorIndex = props.versionColorMap[versionName];
      map.set(versionName, colorIndex);
    } else {
      // 如果没有传递颜色映射，使用简单的索引分配
      // 但这应该由父组件处理，这里只是降级处理
      const colorIndex = idx % COLOR_PALETTE.length;
      map.set(versionName, colorIndex);
    }
  });
  return map;
});

// 新增：缓存可见版本列表
const visibleVersions = computed(() => {
  if (!props.modifiedTexts || props.modifiedTexts.length === 0) return [];

  return props.modifiedTexts
    .map((item, idx) => ({
      text: item?.editedText || '',
      version: item?.name || `Version ${idx + 1}`,
      score: item?.score || '',
      dimension: item?.dimension || '',
      cIndex: item?.cIndex || '',
      index: idx,
      reasonData: Array.isArray(item?.reason) ? item.reason : [],
      isVisible: Boolean(props.versionVisibility[idx + 1])
    }))
    .filter(item => item.text.trim() && item.isVisible);
});

// 新增：缓存原文内容
const currentOriginalText = computed(() => {
  return props.originalText || '';
});

// 优化：使用缓存的颜色映射
const getVersionColorPalette = computed(() => {
  return (versionName) => {
    const colorIndex = versionColorMap.value.get(versionName) || 0;
    return COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
  };
});

// Reactive references
const editorRef = ref(null);
const tooltipRef = ref(null);
const showTooltip = ref(false);
const tooltipTarget = ref(null);
const tooltipContent = ref(null);
const operationsMap = ref(new Map()); // Store operations by ID for tooltip lookup

const output = ref('');
const operations = ref([]);
const editableOutput = ref('');
const localTexts = ref([]);
const diffSegments = ref([]); // 新增：存储完整的diff段落信息

// Operations list related
const operationsScrollRef = ref(null);
const highlightedOperationId = ref(null);
const highlightedEditorElementIds = ref([]); // 修改：跟踪需要高亮的编辑器元素IDs（支持多个）
const operationRefs = ref(new Map()); // Store operation DOM refs
const processedOperationIds = ref(new Set()); // Track processed operations
const rejectedOperationsByVersion = ref(new Map()); // Track rejected operations by version

// Utility functions
/**
 * HTML转义函数
 * 作用: 将文本中的HTML特殊字符转义，防止XSS攻击
 * 依赖: DOM API
 * 位置: 工具函数区域
 * 调用: createDeletedSpan, createInsertedSpan, buildHtmlFromSegments
 */
const escapeHtml = (text) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// 防抖函数已移除，因为现在compareTexts只是组合预计算结果，速度很快

// 移除防抖函数，因为现在compareTexts只是组合预计算结果，速度很快

// 新增：加载状态管理
const isLoading = ref(false);
const errorMessage = ref('');

// ===== 核心初始化与比较函数 =====

/**
 * 初始化文本数据
 * 作用: 深拷贝props.modifiedTexts到本地状态，清理已处理的操作记录
 * 依赖: props.modifiedTexts, processedOperationIds
 * 位置: 组件生命周期钩子中调用
 * 调用: onMounted, watch(props.modifiedTexts)
 */
function initializeTexts() {
  try {
    localTexts.value = JSON.parse(JSON.stringify(props.modifiedTexts));
    // 清理已处理的操作记录
    processedOperationIds.value.clear();
    // 清理拒绝操作记录
    rejectedOperationsByVersion.value.clear();
    console.log('Texts initialized, cleared processed and rejected operations');

  } catch (error) {
    console.error('Error initializing texts:', error);
    localTexts.value = [...props.modifiedTexts];
    processedOperationIds.value.clear();
    rejectedOperationsByVersion.value.clear();
  }
}

/**
 * 实时计算可见版本的diff结果
 * 作用: 根据当前可见版本实时计算与原文的diff，生成segments和operations
 * 依赖: localTexts, visibleVersions, currentOriginalText, diffWords
 * 位置: 数据变化时的核心处理流程
 * 调用: 初始化、versionVisibility变化、originalText变化、用户交互后
 */
function compareTexts() {
  try {
    isLoading.value = true;
    errorMessage.value = '';

    if (!localTexts.value || localTexts.value.length === 0) {
      editableOutput.value = currentOriginalText.value;
      operations.value = [];
      diffSegments.value = [];
      isLoading.value = false;
      return;
    }

    console.log('Computing diff for visible versions in real time...');

    // 没有可见版本，只显示原文
    if (visibleVersions.value.length === 0) {
      const originalSegments = [{
        type: OPERATION_TYPES.ORIGINAL,
        text: currentOriginalText.value,
        originalStart: 0,
        originalEnd: currentOriginalText.value.length,
        id: generateUniqueId()
      }];

      diffSegments.value = originalSegments;
      operations.value = [];
      editableOutput.value = buildHtmlFromSegments(originalSegments);
      isLoading.value = false;
      return;
    }

    const originalTextContent = currentOriginalText.value;
    console.log('originalTextContent', originalTextContent);
    let allSegments;
    let allOperations;
    const newOperationsMap = new Map();

    if (visibleVersions.value.length === 1) {
      // 单版本：实时计算diff
      const versionData = visibleVersions.value[0];
      console.log('versionData', versionData);
      const result = computeSingleVersionDiff(originalTextContent, versionData, newOperationsMap);
      allSegments = result.segments;
      allOperations = result.operations;

    } else {
      // 多版本：实时计算并合并所有可见版本的diff
      const result = computeMultipleVersionsDiff(originalTextContent, visibleVersions.value, newOperationsMap);
      allSegments = result.segments;
      allOperations = result.operations;
    }

    // 应用操作过滤和去重
    const filteredSegments = filterAndDeduplicateSegments(allSegments);

    diffSegments.value = filteredSegments;
    console.log('filteredSegments', filteredSegments);

    // 更新operations map
    operationsMap.value = newOperationsMap;

    // 从segments中提取非original类型作为operations，并分组
    const rawOperations = filteredSegments
      .filter(segment => segment.type !== OPERATION_TYPES.ORIGINAL)
      .sort(compareSegments);

    operations.value = groupOperations(rawOperations);

    console.log('operations (grouped)', operations.value);
    console.log('operationsMap', operationsMap.value);

    const htmlOutput = buildHtmlFromSegments(filteredSegments);
    output.value = htmlOutput;
    editableOutput.value = htmlOutput;
    console.log('htmlOutput', htmlOutput);
    console.log('Real-time diff computation completed');

    // 更新操作统计到统一日志
    try {
      usageLogger.updateOperationsStats({
        groupsCount: operations.value?.length || 0,
        operationsCount: rawOperations?.length || 0
      })
    } catch (e) { /* noop */ }

    // Setup tooltip listeners after DOM update
    nextTick(() => {
      setupTooltipListeners();
    });

    // 检查版本完整性（是否与原文一致）
    nextTick(() => {
      checkVersionCompleteness();
    });

  } catch (error) {
    console.error('Error computing real-time diff:', error);
    errorMessage.value = 'Error computing diff: ' + error.message;
    editableOutput.value = currentOriginalText.value;
    operations.value = [];
    diffSegments.value = [];
  } finally {
    isLoading.value = false;
  }
}

/**
 * 计算单个版本与原文的diff
 * 作用: 实时计算单个版本与原文的diff，生成segments和operations
 * 依赖: diffWords, createSegment, addReasonInfo, getVersionColorPalette
 * 位置: compareTexts中单版本分支调用
 * 调用: compareTexts (当只有一个可见版本时)
 */
function computeSingleVersionDiff(originalTextContent, versionData, operationsMap) {
  const { text, version, reasonData, score, dimension, cIndex } = versionData;

  try {
    console.log(`Computing diff for single version: ${version}`);

    const diff = diffWords(originalTextContent, text);
    const segments = [];
    const operations = [];

    let currentOriginalIndex = 0;
    const versionColorPalette = getVersionColorPalette.value(version);

    diff.forEach(part => {
      if (!part.added && !part.removed) {
        // 原文内容
        const segment = {
          type: 'original',
          text: part.value || '',
          originalStart: currentOriginalIndex,
          originalEnd: currentOriginalIndex + (part.value || '').length,
          id: generateUniqueId()
        };
        segments.push(segment);
        currentOriginalIndex += (part.value || '').length;

      } else if (part.removed) {
        // 删除的内容
        const segment = createSegment('delete', {
          originalStart: currentOriginalIndex,
          originalEnd: currentOriginalIndex + (part.value || '').length,
          text: part.value || '',
          version,
          score,
          dimension,
          cIndex,
          color: versionColorPalette
        });

        addReasonInfo(segment, reasonData, originalTextContent);
        segments.push(segment);
        operations.push(segment);
        operationsMap.set(segment.id, segment);
        currentOriginalIndex += (part.value || '').length;

      } else if (part.added) {
        // 添加的内容
        const segment = createSegment('insert', {
          originalIndex: currentOriginalIndex,
          text: part.value || '',
          version,
          score,
          dimension,
          cIndex,
          color: versionColorPalette
        });

        addReasonInfo(segment, reasonData, originalTextContent);
        segments.push(segment);
        operations.push(segment);
        operationsMap.set(segment.id, segment);
      }
    });

    const sortedSegments = segments.sort(compareSegments);

    console.log('sortedSegments', sortedSegments);
    console.log('rejectedOperationsByVersion', rejectedOperationsByVersion.value.get(version));
    return {
      segments: sortedSegments,
      operations: operations.sort(compareSegments)
    };

  } catch (error) {
    console.error('Error computing single version diff:', error);
    return { segments: [], operations: [] };
  }
}

/**
 * 计算多个版本与原文的diff并合并
 * 作用: 实时计算多个版本与原文的diff，合并成统一的segments列表
 * 依赖: computeSingleVersionDiff, mergeOriginalAndOperationSegments
 * 位置: compareTexts中多版本分支调用
 * 调用: compareTexts (当有多个可见版本时)
 */
function computeMultipleVersionsDiff(originalTextContent, visibleVersions, operationsMap) {
  console.log(`Computing diff for ${visibleVersions.length} versions`);

  // 构建基础的原文segments
  const baseSegments = [{
    type: 'original',
    text: originalTextContent,
    originalStart: 0,
    originalEnd: originalTextContent.length,
    id: generateUniqueId()
  }];

  const allOperationSegments = [];
  const allOperations = [];

  try {
    // 为每个可见版本计算diff
    visibleVersions.forEach(versionData => {
      const versionResult = computeSingleVersionDiff(originalTextContent, versionData, operationsMap);

      // 收集该版本的操作segments
      versionResult.operations.forEach(op => {
        allOperationSegments.push(op);
        allOperations.push(op);
        operationsMap.set(op.id, op);
      });
    });

    // 合并原文segments和所有操作segments
    const mergedSegments = mergeOriginalAndOperationSegments(baseSegments, allOperationSegments);
    const sortedSegments = mergedSegments.sort(compareSegments);

    console.log(`Multiple versions diff computed: ${sortedSegments.length} segments, ${allOperations.length} operations`);

    return {
      segments: sortedSegments,
      operations: allOperations.sort(compareSegments)
    };

  } catch (error) {
    console.error('Error computing multiple versions diff:', error);
    return { segments: baseSegments, operations: [] };
  }
}

// ===== 辅助工具函数 =====

/**
 * 生成唯一ID的辅助函数
 * 作用: 为每个操作段落生成唯一标识符
 * 依赖: 无
 * 位置: 创建segment时调用
 * 调用: createSegment, 其他需要唯一ID的地方
 */
function generateUniqueId() {
  return Math.random().toString(36).substr(2, 9);
}

/**
 * 重置所有已处理的操作（暴露给外部使用）
 * 作用: 清空已处理操作集合和拒绝操作记录，重新显示所有操作
 * 依赖: processedOperationIds, rejectedOperationsByVersion, compareTexts
 * 位置: 暴露给父组件使用
 * 调用: 外部组件可通过ref调用
 */
function resetProcessedOperations() {
  processedOperationIds.value.clear();
  rejectedOperationsByVersion.value.clear();
  console.log('Processed and rejected operations reset');
  compareTexts(); // 重新计算显示所有操作
}

// ===== 版本处理核心函数 =====

/**
 * 创建segment对象
 * 作用: 统一创建操作段落对象，包含类型、数据、ID和内容哈希
 * 依赖: generateContentHash
 * 位置: 版本处理函数中调用
 * 调用: computeSingleVersionDiff
 */
function createSegment(type, data) {
  return {
    type,
    ...data,
    id: Math.random().toString(36).substr(2, 9),
    contentHash: generateContentHash(type, data)
  };
}

/**
 * 合并原文和操作segments
 * 作用: 将原文段落与操作段落按位置顺序合并成完整序列
 * 依赖: compareSegments
 * 位置: 多版本处理完成后调用
 * 调用: mergeMultipleVersionResults
 */
function mergeOriginalAndOperationSegments(originalSegments, operationSegments) {
  if (operationSegments.length === 0) {
    return originalSegments;
  }

  const result = [];
  const originalTextContent = originalSegments[0].text;

  // 按照位置排序操作segments
  const sortedOperations = operationSegments.sort(compareSegments);

  let currentPos = 0;

  sortedOperations.forEach(op => {
    const opPos = op.type === 'insert' ? op.originalIndex : op.originalStart;
    const opEndPos = op.type === 'insert' ? op.originalIndex : op.originalEnd;

    // 添加操作前的原文内容
    if (currentPos < opPos) {
      result.push({
        type: 'original',
        text: originalTextContent.substring(currentPos, opPos),
        originalStart: currentPos,
        originalEnd: opPos,
        id: Math.random().toString(36).substr(2, 9)
      });
    }

    // 添加操作
    result.push(op);

    // 更新位置
    if (op.type === 'delete') {
      currentPos = opEndPos;
    } else {
      currentPos = opPos;
    }
  });

  // 添加剩余的原文内容
  if (currentPos < originalTextContent.length) {
    result.push({
      type: 'original',
      text: originalTextContent.substring(currentPos),
      originalStart: currentPos,
      originalEnd: originalTextContent.length,
      id: Math.random().toString(36).substr(2, 9)
    });
  }

  return result;
}

/**
 * 比较segments的位置
 * 作用: 用于segments数组排序的比较函数，按位置和类型优先级排序
 * 依赖: getSegmentPosition
 * 位置: 排序操作中调用
 * 调用: Array.sort(), 各种需要排序segments的地方
 */
function compareSegments(a, b) {
  const aPos = getSegmentPosition(a);
  const bPos = getSegmentPosition(b);

  if (aPos !== bPos) return aPos - bPos;

  // 同一位置的排序优先级：
  // 1. original (原文内容)
  // 2. delete (删除的内容)
  // 3. insert (插入的内容)
  const typeOrder = { 'original': 0, 'delete': 1, 'insert': 2 };
  const aOrder = typeOrder[a.type] || 3;
  const bOrder = typeOrder[b.type] || 3;

  if (aOrder !== bOrder) return aOrder - bOrder;

  // 如果类型相同，按照原始位置或长度排序
  if (a.type === 'original' && b.type === 'original') {
    return (a.originalStart || 0) - (b.originalStart || 0);
  }

  if (a.type === 'delete' && b.type === 'delete') {
    return (a.originalStart || 0) - (b.originalStart || 0);
  }

  return 0;
}

/**
 * 获取segment的位置值
 * 作用: 根据segment类型返回其在原文中的位置
 * 依赖: 无
 * 位置: 比较排序时调用
 * 调用: compareSegments
 */
function getSegmentPosition(segment) {
  switch (segment.type) {
    case 'original':
      return segment.originalStart;
    case 'insert':
      return segment.originalIndex;
    case 'delete':
      return segment.originalStart;
    default:
      return 0;
  }
}

// ===== 核心算法函数 =====

/**
 * 过滤和去重segments
 * 作用: 移除已处理的操作，处理被拒绝的操作，合并重复位置的操作，保留最优选择
 * 依赖: selectBestOperation, compareSegments, rejectedOperationsByVersion
 * 位置: compareTexts完成diff后调用
 * 调用: compareTexts中处理segments的关键步骤
 */
function filterAndDeduplicateSegments(segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return [];
  }

  try {
    console.log('filterAndDeduplicateSegments input:', segments.length, 'segments');

    // 1. 首先处理被拒绝的操作和已接受的操作
    const processedSegments = [];

    segments.forEach(segment => {
      if (segment.type === 'original') {
        // 原文段落直接保留
        processedSegments.push(segment);
        return;
      }

      // 检查是否是已接受的操作（在processedOperationIds中）
      if (processedOperationIds.value.has(segment.contentHash)) {
        // 已接受的操作不显示
        return;
      }

      // 检查是否是被拒绝的操作
      const versionName = segment.version;
      const versionRejectedOps = rejectedOperationsByVersion.value.get(versionName);

      if (versionRejectedOps && versionRejectedOps.has(segment.contentHash)) {
        // 处理被拒绝的操作
        if (segment.type === 'delete') {
          // 拒绝删除 = 保留原文，转换为original类型
          processedSegments.push({
            ...segment,
            type: 'original'
          });
        }
        // 如果是insert类型，拒绝插入 = 不显示，直接过滤掉
        return;
      }

      // 未处理的操作正常保留
      processedSegments.push(segment);
    });

    console.log('After processing rejected and accepted operations:', processedSegments.length, 'segments');

    // 2. 从处理后的segments中分离original和operation segments
    const finalOriginalSegments = processedSegments.filter(s => s.type === 'original');
    const finalOperationSegments = processedSegments.filter(s => s.type !== 'original');

    // 3. 对operation segments按位置分组进行去重
    const positionGroups = new Map();

    finalOperationSegments.forEach(segment => {
      const posKey = segment.type === 'insert'
        ? `insert-${segment.originalIndex}`
        : `delete-${segment.originalStart}-${segment.originalEnd}`;

      if (!positionGroups.has(posKey)) {
        positionGroups.set(posKey, []);
      }
      positionGroups.get(posKey).push(segment);
    });

    // 4. 每个位置只保留最优操作
    const deduplicatedOperations = [];

    positionGroups.forEach(group => {
      if (group.length === 1) {
        deduplicatedOperations.push(group[0]);
      } else {
        const bestOp = selectBestOperation(group);
        if (bestOp) {
          deduplicatedOperations.push(bestOp);
        }
      }
    });

    console.log('Deduplicated operations:', deduplicatedOperations.length);

    // 5. 合并原文segments和去重后的操作segments
    const allSegments = [...finalOriginalSegments, ...deduplicatedOperations];
    const sortedSegments = allSegments.sort(compareSegments);

    console.log('Final segments after filtering and processing:', sortedSegments.length);
    return sortedSegments;

  } catch (error) {
    console.error('Error filtering and deduplicating segments:', error);
    return segments;
  }
}

// ===== HTML构建与显示函数 =====

/**
 * 从segments构建HTML
 * 作用: 将操作段落转换为带样式的HTML内容用于编辑器显示
 * 依赖: escapeHtml, createDeletedSpan, createInsertedSpan
 * 位置: 比较完成后的输出生成
 * 调用: compareTexts, acceptOperation, rejectOperation
 */
function buildHtmlFromSegments(segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    console.log('buildHtmlFromSegments: empty segments');
    return '';
  }

  console.log('buildHtmlFromSegments: processing segments', segments.length);
  let result = '';
  const seenHashes = new Set();

  segments.forEach((segment, index) => {
    try {
      // 跳过空文本的segments
      if (!segment.text || segment.text.trim() === '') {
        console.log(`Skipping empty segment ${index}:`, segment);
        return;
      }

      switch (segment.type) {
        case 'original':
          result += `<span>${escapeHtml(segment.text)}</span>`;
          break;
        case 'delete':
          result += createDeletedSpan(segment);
          // 去重记录删除片段
          try {
            const key = `del:${segment.contentHash}`
            if (!seenHashes.has(key)) {
              usageLogger.log('diff_segment', { kind: 'delete', segment: { text: segment.text, version: segment.version, dimension: segment.dimension, score: segment.score, cIndex: segment.cIndex } }, { component: 'DiffViewer' })
              seenHashes.add(key)
            }
          } catch (e) {}
          break;
        case 'insert':
          result += createInsertedSpan(segment);
          // 去重记录插入片段
          try {
            const key = `ins:${segment.contentHash}`
            if (!seenHashes.has(key)) {
              usageLogger.log('diff_segment', { kind: 'insert', segment: { text: segment.text, version: segment.version, dimension: segment.dimension, score: segment.score, cIndex: segment.cIndex } }, { component: 'DiffViewer' })
              seenHashes.add(key)
            }
          } catch (e) {}
          break;
        default:
          console.warn('Unknown segment type:', segment.type);
      }
    } catch (error) {
      console.error('Error building HTML for segment:', error, segment);
    }
  });
  return result;
}

/**
 * 创建删除标记的span元素
 * 作用: 生成带删除线样式的HTML span标签
 * 依赖: escapeHtml
 * 位置: HTML构建过程中调用
 * 调用: buildHtmlFromSegments
 */
function createDeletedSpan(op) {
  return `<span class="edits strikethrough ${op.color.strike}" data-operation-id="${op.id}" style="cursor: pointer;" data-tooltip-type="delete">${escapeHtml(op.text)}</span>`;
}

/**
 * 创建插入标记的span元素
 * 作用: 生成带背景色样式的HTML span标签
 * 依赖: escapeHtml
 * 位置: HTML构建过程中调用
 * 调用: buildHtmlFromSegments
 */
function createInsertedSpan(op) {
  return `<span class="edits inserted q-pa-xs rounded-borders ${op.color.underline}" data-operation-id="${op.id}" style="cursor: pointer;" data-tooltip-type="insert">${escapeHtml(op.text)}</span>`;
}

// ===== 原因查找与匹配系统 =====

/**
 * 为操作添加原因信息
 * 作用: 将操作与对应的修改原因进行关联
 * 依赖: findReasonForOperation
 * 位置: 创建操作segment时调用
 * 调用: computeSingleVersionDiff
 */
function addReasonInfo(operation, reasonData, originalTextContent) {
  const reasonInfo = findReasonForOperation(operation, reasonData, originalTextContent);
  if (reasonInfo) {
    operation.sentence = reasonInfo.sentence;
    operation.reason = reasonInfo.reason;
  }
}

/**
 * 增强的操作原因查找（改进错误处理）
 * 作用: 根据操作在文本中的位置查找对应的修改原因
 * 依赖: mapOriginalToEditedPosition, findSentenceAtPosition, matchReasonData
 * 位置: 原因匹配的核心逻辑
 * 调用: addReasonInfo
 */
function findReasonForOperation(operation, reasonData, originalTextContent) {
  if (!Array.isArray(reasonData) || reasonData.length === 0) {
    return null;
  }

  try {
    const currentVersionData = localTexts.value.find(item => item.name === operation.version);
    if (!currentVersionData?.editedText) {
      return null;
    }

    const editedText = currentVersionData.editedText;
    const mappedPos = mapOriginalToEditedPosition(operation, originalTextContent, editedText);
    const targetSentence = findSentenceAtPosition(mappedPos, editedText);

    return matchReasonData(targetSentence, reasonData);
  } catch (error) {
    console.error('Error finding reason for operation:', error);
    return null;
  }
}

function mapOriginalToEditedPosition(operation, originalTextContent, editedText) {
  if (!operation || !originalTextContent || !editedText) {
    return 0;
  }

  try {
    const operationPos = operation.type === 'insert' ? operation.originalIndex : operation.originalStart;

    // Bounds check
    if (operationPos < 0 || operationPos > originalTextContent.length) {
      console.warn('Operation position out of bounds:', operationPos, originalTextContent.length);
      return 0;
    }

    const diff = diffWords(originalTextContent, editedText);
    let originalPos = 0;
    let editedPos = 0;

    for (const part of diff) {
      if (!part || typeof part.value !== 'string') continue;

      if (!part.added && !part.removed) {
        if (originalPos <= operationPos && operationPos <= originalPos + part.value.length) {
          const offset = operationPos - originalPos;
          return Math.max(0, editedPos + offset);
        }
        originalPos += part.value.length;
        editedPos += part.value.length;
      } else if (part.removed) {
        if (originalPos <= operationPos && operationPos <= originalPos + part.value.length) {
          return Math.max(0, editedPos);
        }
        originalPos += part.value.length;
      } else if (part.added) {
        editedPos += part.value.length;
      }
    }

    return Math.min(editedPos, editedText.length);
  } catch (error) {
    console.error('Error mapping position:', error);
    return 0;
  }
}

function findSentenceAtPosition(position, text) {
  if (!text || typeof text !== 'string' || position < 0) {
    return null;
  }

  try {
    // Split by sentence endings, keeping the delimiters
    const sentencePattern = /([.!?]+)/;
    const parts = text.split(sentencePattern);
    const sentences = [];

    // Reconstruct sentences with their endings
    for (let i = 0; i < parts.length; i += 2) {
      const content = parts[i];
      const ending = parts[i + 1] || '';
      if (content && content.trim()) {
        sentences.push((content + ending).trim());
      }
    }

    let currentPos = 0;

    for (const sentence of sentences) {
      if (!sentence) continue;

      const sentenceStart = text.indexOf(sentence, currentPos);
      if (sentenceStart === -1) continue;

      const sentenceEnd = sentenceStart + sentence.length;

      if (sentenceStart <= position && position <= sentenceEnd) {
        return sentence;
      }

      currentPos = sentenceEnd;
    }

    // Fallback: find the paragraph containing the position
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
    currentPos = 0;

    for (const paragraph of paragraphs) {
      const paragraphStart = text.indexOf(paragraph, currentPos);
      if (paragraphStart === -1) continue;

      const paragraphEnd = paragraphStart + paragraph.length;

      if (paragraphStart <= position && position <= paragraphEnd) {
        // Return first sentence of the paragraph
        const firstSentence = paragraph.split(/[.!?]+/)[0];
        return firstSentence ? firstSentence.trim() : null;
      }

      currentPos = paragraphEnd;
    }

    return null;
  } catch (error) {
    console.error('Error finding sentence at position:', error);
    return null;
  }
}

function matchReasonData(targetSentence, reasonData) {
  if (!targetSentence || !Array.isArray(reasonData) || reasonData.length === 0) {
    return null;
  }

  try {
    const normalizedTarget = targetSentence.toLowerCase().trim();

    // Exact match first (case-insensitive)
    for (const item of reasonData) {
      if (item?.sentence) {
        const normalizedSentence = item.sentence.toLowerCase().trim();
        if (normalizedSentence === normalizedTarget) {
          return {
            sentence: item.sentence,
            reason: item.reason || 'No reason provided'
          };
        }
      }
    }

    // Fuzzy match with improved scoring
    const targetWords = normalizedTarget
      .split(/\s+/)
      .filter(w => w.length > 2) // Filter out very short words
      .map(w => w.replace(/[^\w]/g, '')); // Remove punctuation

    if (targetWords.length === 0) return null;

    let bestMatch = null;
    let bestScore = 0;

    for (const item of reasonData) {
      if (!item?.sentence) continue;

      const sentenceWords = item.sentence
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2)
        .map(w => w.replace(/[^\w]/g, ''));

      // Calculate similarity score
      const commonWords = targetWords.filter(word =>
        sentenceWords.some(sw =>
          sw.includes(word) ||
          word.includes(sw) ||
          levenshteinDistance(word, sw) <= 1
        )
      );

      const score = commonWords.length / Math.max(targetWords.length, sentenceWords.length);

      // Require at least 30% similarity and minimum 2 common words
      if (score > bestScore && score >= 0.3 && commonWords.length >= Math.min(2, targetWords.length)) {
        bestScore = score;
        bestMatch = {
          sentence: item.sentence,
          reason: item.reason || 'No reason provided'
        };
      }
    }

    return bestMatch;
  } catch (error) {
    console.error('Error matching reason data:', error);
    return null;
  }
}

// Simple Levenshtein distance for fuzzy matching
function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

// ===== 交互与Tooltip系统 =====

/**
 * 设置增强的tooltip监听器系统
 * 作用: 为编辑器中的操作元素添加鼠标事件监听器
 * 依赖: handleMouseEnter, handleMouseLeave, handleEditorClick
 * 位置: HTML更新后调用
 * 调用: compareTexts, nextTick后
 */
function setupTooltipListeners() {
  const editorElement = editorRef.value?.$el?.querySelector('.q-editor__content');
  if (!editorElement) return;

  // Remove existing listeners to prevent memory leaks
  editorElement.removeEventListener('mouseover', handleMouseEnter, true);
  editorElement.removeEventListener('mouseout', handleMouseLeave, true);
  editorElement.removeEventListener('click', handleEditorClick, true);

  // Add new listeners with mouseover/mouseout for better stability
  editorElement.addEventListener('mouseover', handleMouseEnter, true);
  editorElement.addEventListener('mouseout', handleMouseLeave, true);
  editorElement.addEventListener('click', handleEditorClick, true);
}

/**
 * 处理编辑器点击事件
 * 作用: 点击操作元素时滚动到右侧操作列表对应项
 * 依赖: scrollToOperationInList
 * 位置: 事件监听器中调用
 * 调用: setupTooltipListeners添加的监听器
 */
function handleEditorClick(event) {
  const target = event.target.closest('.edits[data-operation-id]');
  if (!target) return;

  const operationId = target.dataset.operationId;
  if (!operationId) return;

  try {
    const op = findOperationById(operationId)
    usageLogger.log('diff_editor_click', {
      operationId,
      operation: op ? {
        type: op.type,
        text: op.text,
        version: op.version,
        score: op.score,
        dimension: op.dimension,
        cIndex: op.cIndex,
        originalStart: op.originalStart,
        originalEnd: op.originalEnd,
        originalIndex: op.originalIndex
      } : null
    }, { component: 'DiffViewer' })
  } catch (e) { /* noop */ }

  // 滚动到operations列表中对应的项
  scrollToOperationInList(operationId);
}

let tooltipTimer = null;

/**
 * 处理鼠标进入事件
 * 作用: 鼠标悬停在操作元素上时显示tooltip
 * 依赖: hideTooltip, findOperationById
 * 位置: 事件监听器中调用
 * 调用: setupTooltipListeners添加的监听器
 */
function handleMouseEnter(event) {
  const target = event.target.closest('.edits[data-operation-id]');
  if (!target) {
    hideTooltip();
    return;
  }

  // Clear any existing timer
  if (tooltipTimer) {
    clearTimeout(tooltipTimer);
    tooltipTimer = null;
  }

  const operationId = target.dataset.operationId;
  const tooltipType = target.dataset.tooltipType;

  if (!operationId || !tooltipType) return;

  const operation = findOperationById(operationId);
  if (!operation) return;

  tooltipContent.value = {
    type: tooltipType,
    version: operation.version || 'Unknown',
    reason: operation.reason || '',
    text: operation.text || ''
  };

  tooltipTarget.value = target;
  showTooltip.value = true;
}

function handleMouseLeave(event) {
  const target = event.target.closest('.edits[data-operation-id]');
  const relatedTarget = event.relatedTarget;

  // If moving to another edit element, don't hide
  if (relatedTarget && relatedTarget.closest('.edits[data-operation-id]')) {
    return;
  }

  // If moving to tooltip, don't hide
  if (relatedTarget && relatedTarget.closest('.diff-tooltip')) {
    return;
  }

  // Add small delay for smoother experience
  tooltipTimer = setTimeout(() => {
    hideTooltip();
  }, 100);
}

function hideTooltip() {
  showTooltip.value = false;
  tooltipContent.value = null;
  tooltipTarget.value = null;
}

function findOperationById(operationId) {
  if (!operationId || !operationsMap.value) {
    return null;
  }
  // 首先从operationsMap中查找
  const operation = operationsMap.value.get(operationId);
  if (operation) {
    return operation;
  }

  // 如果没找到，从operations分组中查找
  for (const group of operations.value) {
    const found = group.operations.find(op => op.id === operationId);
    if (found) {
      return found;
    }
  }

  return null;
}

// Enhanced text conversion with better error handling
function convertToPlainText(htmlContent) {
  if (!htmlContent || typeof htmlContent !== 'string') {
    return '';
  }

  try {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    // 收集所有文本片段，包括必要的插入内容
    const textFragments = [];

    function collectFragments(node) {
      if (!node) return;

      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        if (text.length > 0) { // 保留所有文本，包括空格
          textFragments.push({
            type: 'text',
            content: text,
            element: null
          });
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // 智能处理 inserted 内容
        if (node.classList && node.classList.contains('inserted')) {
          const insertedText = node.textContent || '';

          // 判断插入的内容是否是必要的（标点符号、空格、连接词等）
          if (shouldKeepInsertedContent(insertedText)) {
            textFragments.push({
              type: 'necessary-insert',
              content: insertedText,
              element: node
            });
          }
          return; // 不再处理子节点
        }

        // 收集 strikethrough 元素
        if (node.classList && node.classList.contains('strikethrough')) {
          textFragments.push({
            type: 'strikethrough',
            content: node.textContent || '',
            element: node,
            colorClass: getColorClass(node)
          });
          return; // 不再处理子节点
        }

        // 处理其他元素的子节点
        if (node.childNodes) {
          for (let child of node.childNodes) {
            collectFragments(child);
          }
        }
      }
    }

        // 判断插入的内容是否应该保留
    function shouldKeepInsertedContent(text) {
      if (!text || text.length === 0) return false;

      // 只保留纯空格内容（用于连接相邻单词）
      if (/^\s+$/.test(text)) return true;

      // 保留短连接词（但不包括标点符号）
      const shortConnectors = /^[\s]*(and|or|but|the|a|an|in|on|at|to|of|for|with|by|as)[\s]*$/i;
      if (shortConnectors.test(text)) return true;

      // 保留纯数字和单位（不包括标点符号）
      if (/^[\s]*\d+[\s]*$/.test(text) || /^[\s]*\d+[a-zA-Z]+[\s]*$/.test(text)) return true;

      // 不保留包含标点符号的插入内容，让后续的空格处理逻辑来决定
      return false;
    }

    function getColorClass(element) {
      const classes = Array.from(element.classList);
      const colorClass = classes.find(cls =>
        cls.startsWith('text-') &&
        ['text-red', 'text-green', 'text-amber', 'text-purple', 'text-pink', 'text-blue'].includes(cls)
      );
      return colorClass || '';
    }

    // 收集所有片段
    collectFragments(tempDiv);

    // 处理 strikethrough 元素的去重，但保留必要的插入内容
    const processedFragments = deduplicateStrikethrough(textFragments);

    // 构建最终文本，智能处理空格
    let plainText = '';
    for (let i = 0; i < processedFragments.length; i++) {
      const fragment = processedFragments[i];
      const prevFragment = i > 0 ? processedFragments[i - 1] : null;
      const nextFragment = i < processedFragments.length - 1 ? processedFragments[i + 1] : null;

      let content = fragment.content;

      // 智能处理空格连接
      if (prevFragment && needsSpaceBetween(prevFragment.content, content)) {
        // 如果前一个片段不以空格结尾，当前片段不以空格开头，则添加空格
        if (plainText.length > 0 && !plainText.endsWith(' ') && !content.startsWith(' ')) {
          plainText += ' ';
        }
      }

      plainText += content;
    }

    // 清理和规范化文本
    return plainText
      .replace(/\s*\n\s*/g, '\n')      // Normalize line breaks
      .replace(/[ \t]+/g, ' ')         // Multiple spaces to single space
      .replace(/\n /g, '\n')           // Remove space after line break
      .replace(/ \n/g, '\n')           // Remove space before line break
      .replace(/\n{3,}/g, '\n\n')      // Limit consecutive line breaks
      .replace(/\s+([,.;:!?])/g, '$1') // Remove space before punctuation
      .replace(/([,.;:!?])([a-zA-Z])/g, '$1 $2') // Add space after punctuation if needed
      .trim();                         // Remove leading/trailing whitespace

  } catch (error) {
    console.error('Error converting HTML to plain text:', error);
    // 改进的降级处理：只保留必要的空格和连接词
    return htmlContent
      .replace(/<span[^>]*class="[^"]*inserted[^"]*"[^>]*>([\s]+|and|or|but|the|a|an|in|on|at|to|of|for|with|by|as|\d+[\w]*)<\/span>/gi, '$1')
      .replace(/<span[^>]*class="[^"]*inserted[^"]*"[^>]*>[^<]*<\/span>/gi, '') // 移除其他inserted内容
      .replace(/<[^>]*>/g, '')
      .replace(/([a-zA-Z0-9])([a-zA-Z0-9])/g, '$1 $2') // 在相邻字母数字间添加空格
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/([,.;:!?])([a-zA-Z])/g, '$1 $2')
      .trim();
  }
}

// 辅助函数：判断两个文本片段之间是否需要空格
function needsSpaceBetween(prev, current) {
  if (!prev || !current) return false;

  // 如果其中一个已经包含空格，则不需要额外空格
  if (prev.endsWith(' ') || current.startsWith(' ')) return false;

  // 标点符号前不需要空格
  if (/^[,.;:!?)]/.test(current)) return false;

  // 开括号后不需要空格
  if (/[([{]$/.test(prev)) return false;

  // 检查是否是字母数字字符之间的连接（最常见的需要空格的情况）
  const prevChar = prev.charAt(prev.length - 1);
  const currentChar = current.charAt(0);

  // 字母/数字与字母/数字之间需要空格
  if (/[a-zA-Z0-9]/.test(prevChar) && /[a-zA-Z0-9]/.test(currentChar)) {
    return true;
  }

  // 字母/数字与括号之间可能需要空格
  if (/[a-zA-Z0-9]/.test(prevChar) && /[([{]/.test(currentChar)) {
    return true;
  }

  // 其他情况默认不需要空格
  return false;
}

// 去重 strikethrough 元素的辅助函数
function deduplicateStrikethrough(fragments) {
  const result = [];

  for (let i = 0; i < fragments.length; i++) {
    const current = fragments[i];

    // 对于非strikethrough类型，直接添加（包括necessary-insert）
    if (current.type !== 'strikethrough') {
      result.push(current);
      continue;
    }

    // 查找相邻的 strikethrough 元素
    const adjacentGroup = [current];
    let j = i + 1;

    while (j < fragments.length && fragments[j].type === 'strikethrough') {
      adjacentGroup.push(fragments[j]);
      j++;
    }

    // 如果只有一个元素，直接添加
    if (adjacentGroup.length === 1) {
      result.push(current);
    } else {
      // 处理相邻的 strikethrough 元素组
      const deduplicated = processAdjacentStrikethrough(adjacentGroup);
      result.push(...deduplicated);

      // 跳过已处理的元素
      i = j - 1;
    }
  }

  return result;
}

// 处理相邻的 strikethrough 元素
function processAdjacentStrikethrough(group) {
  if (group.length <= 1) return group;

  // 按内容分组
  const contentGroups = new Map();

  group.forEach(item => {
    const content = item.content.trim();
    if (!contentGroups.has(content)) {
      contentGroups.set(content, []);
    }
    contentGroups.get(content).push(item);
  });

  const result = [];
  const processedContents = new Set();

  // 处理包含关系
  const sortedContents = Array.from(contentGroups.keys()).sort((a, b) => b.length - a.length);

  for (const content of sortedContents) {
    if (processedContents.has(content)) continue;

    // 检查是否被其他内容包含
    let isContained = false;
    for (const otherContent of sortedContents) {
      if (otherContent !== content &&
          otherContent.includes(content) &&
          !processedContents.has(otherContent)) {
        isContained = true;
        break;
      }
    }

    if (!isContained) {
      // 添加这个内容的第一个实例
      const items = contentGroups.get(content);
      result.push(items[0]);
      processedContents.add(content);

      // 标记所有被这个内容包含的其他内容
      for (const otherContent of sortedContents) {
        if (otherContent !== content && content.includes(otherContent)) {
          processedContents.add(otherContent);
        }
      }
    }
  }

  return result;
}

// Operations list methods
function setOperationRef(operationId, el) {
  if (el) {
    operationRefs.value.set(operationId, el);
  } else {
    operationRefs.value.delete(operationId);
  }
}

function scrollToEditorElement(groupId) {
  try {
    const editorElement = editorRef.value?.$el?.querySelector('.q-editor__content');
    if (!editorElement) return;

    // 查找该组的所有操作元素进行高亮
    const group = operations.value.find(g => g.id === groupId);
    if (!group || !group.operations.length) return;

    // 获取该组所有操作的ID和类型信息
    const operationData = group.operations.map(op => ({
      id: op.id,
      type: op.type
    }));

    console.log(`Highlighting operation group "${group.type}" with ${operationData.length} operations`);

    // 找到所有可用的元素
    const availableElements = [];
    for (const opData of operationData) {
      const element = editorElement.querySelector(`[data-operation-id="${opData.id}"]`);
      if (element) {
        availableElements.push({ element, ...opData });
      }
    }

    if (availableElements.length === 0) {
      console.warn('No target elements found for operation group:', groupId);
      return;
    }

    // 高亮当前操作组
    highlightedOperationId.value = groupId;

    // 高亮编辑器中的所有对应元素，包含类型信息
    highlightedEditorElementIds.value = {
      ids: operationData.map(op => op.id),
      groupType: group.type,
      operationData: operationData
    };

    // 滚动到第一个找到的元素，使用更平滑的滚动
    const firstElement = availableElements[0].element;
    firstElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest'
    });

    // 2秒后取消高亮（延长时间让用户更好地观察）
    setTimeout(() => {
      if (highlightedOperationId.value === groupId) {
        highlightedOperationId.value = null;
        highlightedEditorElementIds.value = [];
      }
    }, 2000);

  } catch (error) {
    console.error('Error scrolling to editor element:', error);
  }
}

function scrollToOperationInList(operationId) {
  try {
    // 查找包含该操作的组
    const group = operations.value.find(g =>
      g.operations.some(op => op.id === operationId)
    );

    if (!group) return;

    const operationElement = operationRefs.value.get(group.id);
    const scrollArea = operationsScrollRef.value;

    if (!operationElement || !scrollArea) return;

    // 高亮操作组（右侧列表）
    highlightedOperationId.value = group.id;

    // 同时高亮编辑器中对应的元素
    const operationData = group.operations.map(op => ({
      id: op.id,
      type: op.type
    }));

    highlightedEditorElementIds.value = {
      ids: operationData.map(op => op.id),
      groupType: group.type,
      operationData: operationData
    };

    // 滚动到列表中的目标项
    nextTick(() => {
      const targetPosition = operationElement.offsetTop - scrollArea.$el.clientHeight / 2 + operationElement.clientHeight / 2;
      scrollArea.setScrollPosition('vertical', targetPosition, 300);
    });

    // 2秒后取消高亮
    setTimeout(() => {
      if (highlightedOperationId.value === group.id) {
        highlightedOperationId.value = null;
        highlightedEditorElementIds.value = [];
      }
    }, 2000);

  } catch (error) {
    console.error('Error scrolling to operation in list:', error);
  }
}

// ===== 分组操作相关辅助函数 =====

/**
 * 获取分组类型对应的chip颜色
 */
function getGroupChipColor(type) {
  switch (type) {
    case 'replace':
      return 'warning';
    case 'insert':
      return 'positive';
    case 'delete':
      return 'negative';
    default:
      return 'primary';
  }
}

/**
 * 获取分组类型对应的图标
 */
function getGroupChipIcon(type) {
  switch (type) {
    case 'replace':
      return 'swap_horiz';
    case 'insert':
      return 'add';
    case 'delete':
      return 'remove';
    default:
      return 'edit';
  }
}

/**
 * 获取分组类型对应的标签
 */
function getGroupChipLabel(type) {
  switch (type) {
    case 'replace':
      return 'REPLACE';
    case 'insert':
      return 'ADD';
    case 'delete':
      return 'DEL';
    default:
      return 'EDIT';
  }
}

/**
 * 获取操作文本的样式类
 */
function getOperationTextClass(operation) {
  if (operation.type === 'insert') {
    return operation.color?.underline || '';
  } else if (operation.type === 'delete') {
    return ` ${operation.color?.strike || ''}`;
  }
  return '';
}

// ===== 用户操作处理函数 =====

/**
 * 接受操作组处理函数
 * 作用: 用户点击接受按钮时，根据操作信息修改HTML标签内容，更新原文
 * 依赖: convertToPlainText, handleEditorChange, checkAndCleanupVersion
 * 位置: 操作列表按钮点击时调用
 * 调用: 模板中的accept按钮@click
 */
function acceptOperationGroup(operationGroup) {
  console.log('Accepting operation group:', operationGroup);

  if (!operationGroup || !operationGroup.operations || operationGroup.operations.length === 0) {
    console.warn('Invalid operation group for acceptance');
    return;
  }

  try {
    let updatedHtml = editableOutput.value;

    // 按照操作在HTML中的出现顺序排序（从后往前处理，避免位置偏移）
    const sortedOperations = [...operationGroup.operations].sort((a, b) => {
      const aPos = a.type === 'insert' ? a.originalIndex : a.originalStart;
      const bPos = b.type === 'insert' ? b.originalIndex : b.originalStart;
      return bPos - aPos; // 从后往前处理
    });

    // 处理操作组中的每个操作
    sortedOperations.forEach(operation => {
      const operationId = operation.id;
      console.log('operationId', operationId);

            if (operation.type === 'delete') {
        // 删除操作：移除整个strikethrough标签（接受删除意味着确实要删除这部分内容）
        // 更灵活的正则，不依赖属性顺序
        const deleteRegex = new RegExp(
          `<span[^>]*data-operation-id="${operationId}"[^>]*>.*?</span>`,
          'gs'
        );
        updatedHtml = updatedHtml.replace(deleteRegex, '');
        console.log(`Accepted delete operation: "${operation.text}"`);

      } else if (operation.type === 'insert') {
        // 插入操作：将inserted样式标签替换为普通span标签（接受插入意味着保留这部分内容作为原文）
        // 更灵活的正则，不依赖属性顺序
        const insertRegex = new RegExp(
          `<span[^>]*data-operation-id="${operationId}"[^>]*>(.*?)</span>`,
          'gs'
        );
        updatedHtml = updatedHtml.replace(insertRegex, '<span>$1</span>');
        console.log(`Accepted insert operation: "${operation.text}"`);
      }

      // 标记为已处理
      processedOperationIds.value.add(operation.contentHash);
    });

    // 清理可能产生的多余空格和HTML结构
    // updatedHtml = cleanupHtml(updatedHtml);

    console.log('updatedHtml', updatedHtml);

    // 更新编辑器内容
    editableOutput.value = updatedHtml;

    // 调用handleEditorChange更新原文，这会触发后续的diff重新计算
    handleEditorChange(updatedHtml);

    console.log(`Accepted operation group with ${operationGroup.operations.length} operations`);

    try {
      usageLogger.markOperationsAccepted(operationGroup.operations.length, {
        groupType: operationGroup.type,
        version: operationGroup.version
      })
    } catch (e) { /* noop */ }

    // 检查并清理版本（如果该版本所有操作都已处理）
    nextTick(() => {
      checkAndCleanupVersion(operationGroup.version);
    });

  } catch (error) {
    console.error('Error accepting operation group:', error);
    errorMessage.value = 'Error accepting changes: ' + error.message;
  }
}

/**
 * 拒绝操作组处理函数
 * 作用: 用户点击拒绝按钮时，记录拒绝的操作并重新计算diff
 * 依赖: rejectedOperationsByVersion, checkAndCleanupVersion, compareTexts
 * 位置: 操作列表按钮点击时调用
 * 调用: 模板中的reject按钮@click
 */
function rejectOperationGroup(operationGroup) {
  console.log('Rejecting operation group:', operationGroup);

  if (!operationGroup || !operationGroup.operations || operationGroup.operations.length === 0) {
    console.warn('Invalid operation group for rejection');
    return;
  }

  try {
    const versionName = operationGroup.version;

    // 初始化版本的拒绝操作集合（如果不存在）
    if (!rejectedOperationsByVersion.value.has(versionName)) {
      rejectedOperationsByVersion.value.set(versionName, new Set());
    }

    const versionRejectedOps = rejectedOperationsByVersion.value.get(versionName);

    // 标记操作组中的每个操作为已拒绝（不添加到processedOperationIds）
    operationGroup.operations.forEach(operation => {
      versionRejectedOps.add(operation.contentHash);
      console.log(`Rejected operation: "${operation.text}" (${operation.type})`);
    });

    console.log(`Rejected operation group with ${operationGroup.operations.length} operations from version "${versionName}"`);

    // 重新计算diff以移除拒绝的操作
    compareTexts();

    // 检查并清理版本（如果该版本所有操作都已处理）
    nextTick(() => {
      checkAndCleanupVersion(versionName);
    });

    try {
      usageLogger.markOperationsRejected(operationGroup.operations.length, {
        groupType: operationGroup.type,
        version: operationGroup.version
      })
    } catch (e) { /* noop */ }

  } catch (error) {
    console.error('Error rejecting operation group:', error);
    errorMessage.value = 'Error rejecting changes: ' + error.message;
  }
}

// ===== HTML清理和版本管理辅助函数 =====

/**
 * 清理HTML内容
 * 作用: 清理接受操作后可能产生的多余空格和不规范的HTML结构
 * 依赖: 无
 * 位置: 操作接受后调用
 * 调用: acceptOperationGroup
 */
function cleanupHtml(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  return html
    .replace(/\s*<\/span>\s*<span[^>]*>/g, (match) => {
      // 如果是相邻的span标签，保持原样，避免过度清理
      return match;
    })
    .replace(/\s{2,}/g, ' ')  // 多个空格合并为一个
    .replace(/>\s+</g, '><')  // 移除标签间的空格
    .replace(/\s+/g, ' ')     // 规范化空格
    .trim();
}

/**
 * 检测版本是否已完成处理
 * 作用: 检查某个版本是否还有未处理的操作，如果没有操作则自动删除该版本
 * 依赖: operations.value, emit
 * 位置: compareTexts中调用
 * 调用: compareTexts
 */
function checkVersionCompleteness() {
  if (!visibleVersions.value || visibleVersions.value.length === 0) {
    return;
  }

  const versionsToDelete = [];

  visibleVersions.value.forEach(versionData => {
    const { version } = versionData;

    try {
      // 检查该版本是否还有未处理的操作
      const versionOperations = operations.value.filter(group => group.version === version);

      console.log(`Version "${version}" has ${versionOperations.length} operation groups`);

      if (versionOperations.length === 0) {
        console.log(`Version "${version}" has no remaining operations, marking for deletion`);
        versionsToDelete.push(version);
      }
    } catch (error) {
      console.error(`Error checking version completeness for "${version}":`, error);
    }
  });

  // 通知父组件删除已完成的版本
  versionsToDelete.forEach(versionName => {
    emit('delete-version', versionName);
  });
}

/**
 * 检查并清理版本
 * 作用: 检查指定版本是否所有操作都已被处理，如果是则清理相关数据
 * 依赖: processedOperationIds, operations, localTexts
 * 位置: 操作接受/拒绝后调用
 * 调用: acceptOperationGroup, rejectOperationGroup
 */
function checkAndCleanupVersion(versionName) {
  if (!versionName) return;

  try {
    console.log(`Checking version cleanup for: ${versionName}`);

    // 找出该版本的所有操作
    const versionOperations = [];
    operations.value.forEach(group => {
      if (group.version === versionName) {
        group.operations.forEach(op => {
          versionOperations.push(op);
        });
      }
    });

    if (versionOperations.length === 0) {
      console.log(`No operations found for version: ${versionName}`);
      return;
    }

    // 检查该版本的所有操作是否都已被处理
    const allProcessed = versionOperations.every(op =>
      processedOperationIds.value.has(op.contentHash)
    );

    console.log(`Version ${versionName}: ${versionOperations.length} operations, all processed: ${allProcessed}`);

        if (allProcessed) {
      console.log(`All operations for version "${versionName}" have been processed. Cleaning up...`);

      // 从localTexts中移除该版本
      const originalLength = localTexts.value.length;
      localTexts.value = localTexts.value.filter(item => item.name !== versionName);

      // 清理该版本的拒绝操作记录
      if (rejectedOperationsByVersion.value.has(versionName)) {
        rejectedOperationsByVersion.value.delete(versionName);
        console.log(`Cleaned up rejected operations for version "${versionName}"`);
      }

      console.log(`Removed version "${versionName}" from localTexts. ${originalLength} -> ${localTexts.value.length}`);

      // 重新计算diff以反映版本移除
      nextTick(() => {
        compareTexts();
      });
    }

  } catch (error) {
    console.error('Error checking version cleanup:', error);
  }
}

// Event handlers
function handleEditorChange(newValue) {
  const plainText = convertToPlainText(newValue);
  console.log('Converted plain text:', plainText);
  emit('update:originalText', plainText);
  try {
    usageLogger.updateWritingContent(plainText, { source: 'DiffViewer' })
  } catch (e) { /* noop */ }
}

// Watchers
watch(() => operations.value, (newOperations) => {
  console.log('operations changed');
}, { deep: true });

watch(() => diffSegments.value, (newSegments) => {
  console.log('diffSegments changed');
}, { deep: true });

// 监听修改的文本列表变化
watch(() => props.modifiedTexts, () => {
  console.log('Props modifiedTexts changed, reinitializing...');
  initializeTexts();
  compareTexts();
}, { deep: true });

// 监听原文变化 - 实时重新计算
watch(() => props.originalText, () => {
  console.log('Props originalText changed, recomputing diffs...');
  compareTexts();
});

// 监听版本可见性变化 - 实时重新计算
watch(() => props.versionVisibility, () => {
  console.log('versionVisibility changed from parent, recomputing visible diffs...', props.versionVisibility);
  compareTexts();
}, { deep: true });

// 监听编辑器元素高亮变化 - 支持多个元素和类型化样式
watch(() => highlightedEditorElementIds.value, (newData, oldData) => {
  nextTick(() => {
    const editorElement = editorRef.value?.$el?.querySelector('.q-editor__content');
    if (!editorElement) {
      console.warn('Editor element not found during highlight watch');
      return;
    }

    // 移除之前的高亮
    const oldIds = getIdsFromData(oldData);
    if (oldIds.length > 0) {
      oldIds.forEach(oldId => {
        const oldElement = editorElement.querySelector(`[data-operation-id="${oldId}"]`);
        if (oldElement) {
          // 移除所有高亮相关的CSS类
          oldElement.classList.remove(
            'editor-element-highlighted',
            'highlight-insert',
            'highlight-delete',
            'highlight-replace'
          );

          // 清理可能的内联样式（保持向后兼容）
          const stylesToRemove = [
            'box-shadow', 'border', 'border-radius', 'background-color',
            'transform', 'z-index', 'position', 'outline', 'outline-offset',
            'background', 'animation'
          ];
          stylesToRemove.forEach(prop => {
            oldElement.style.removeProperty(prop);
          });

                     // 元素高亮已移除
        }
      });
    }

    // 添加新的高亮
    const newIds = getIdsFromData(newData);
    const groupType = getGroupTypeFromData(newData);
    const operationData = getOperationDataFromData(newData);

    if (newIds.length > 0) {
      newIds.forEach((newId, index) => {
        const newElement = editorElement.querySelector(`[data-operation-id="${newId}"]`);
        if (newElement) {
          // 添加基础高亮类
          newElement.classList.add('editor-element-highlighted');

          // 根据操作类型添加特定的样式类
          const operationType = operationData?.[index]?.type || groupType;
          const highlightClass = getHighlightClassForType(operationType, groupType);
          if (highlightClass) {
            newElement.classList.add(highlightClass);
          }

                     // 高亮已应用到元素
         }
       });

       console.log(`Applied ${groupType} highlighting to ${newIds.length} elements`);
    }
  });
});

// 辅助函数：从数据中提取ID数组
function getIdsFromData(data) {
  if (Array.isArray(data)) return data; // 向后兼容旧格式
  if (data && Array.isArray(data.ids)) return data.ids;
  return [];
}

// 辅助函数：从数据中提取组类型
function getGroupTypeFromData(data) {
  if (data && typeof data.groupType === 'string') return data.groupType;
  return 'default';
}

// 辅助函数：从数据中提取操作数据
function getOperationDataFromData(data) {
  if (data && Array.isArray(data.operationData)) return data.operationData;
  return [];
}

// 辅助函数：根据操作类型获取高亮样式类
function getHighlightClassForType(operationType, groupType) {
  switch (groupType) {
    case 'insert':
      return 'highlight-insert';
    case 'delete':
      return 'highlight-delete';
    case 'replace':
      return 'highlight-replace';
    default:
      // 根据单个操作类型决定
      switch (operationType) {
        case 'insert':
          return 'highlight-insert';
        case 'delete':
          return 'highlight-delete';
        default:
          return null; // 使用默认蓝色高亮
      }
  }
}

// Lifecycle
onMounted(() => {
  console.log('Component mounted, initializing with real-time diff computation...');
  try { usageLogger.setContext({ page: 'DiffViewer' }) } catch (e) {}
  initializeTexts();
  compareTexts();
});

// 新增：组件卸载时的清理工作
onUnmounted(() => {
  // 清理事件监听器
  const editorElement = editorRef.value?.$el?.querySelector('.q-editor__content');
  if (editorElement) {
    editorElement.removeEventListener('mouseover', handleMouseEnter, true);
    editorElement.removeEventListener('mouseout', handleMouseLeave, true);
    editorElement.removeEventListener('click', handleEditorClick, true);
  }

  // 清理定时器
  if (tooltipTimer) {
    clearTimeout(tooltipTimer);
    tooltipTimer = null;
  }

  // 清理Map和Set
  operationsMap.value.clear();
  operationRefs.value.clear();
  processedOperationIds.value.clear();
  rejectedOperationsByVersion.value.clear();

  // 重置高亮状态
  highlightedEditorElementIds.value = [];

  // 隐藏tooltip
  hideTooltip();
});

// Expose functions and data for external use
defineExpose({
  resetProcessedOperations,
  diffSegments,
  operations
});

/**
 * 选择最佳操作的逻辑
 * 作用: 在多个相同位置的操作中选择最优的一个（基于reason、长度、分数）
 * 依赖: 无
 * 位置: 去重过程中调用
 * 调用: filterAndDeduplicateSegments
 */
function selectBestOperation(operations) {
  if (!Array.isArray(operations) || operations.length === 0) {
    return null;
  }

  if (operations.length === 1) {
    return operations[0];
  }

  // 优先级规则:
  // 1. 有 reason 的优于没有 reason 的
  // 2. 文本更长的（更具体的修改）
  // 3. 分数更高的
  return operations.reduce((best, current) => {
    // 有 reason 优先
    if (current.reason && !best.reason) return current;
    if (best.reason && !current.reason) return best;

    // 文本长度优先（更具体的修改）
    const currentLength = (current.text || '').length;
    const bestLength = (best.text || '').length;
    if (currentLength !== bestLength) {
      return currentLength > bestLength ? current : best;
    }

    // 分数优先
    const currentScore = parseFloat(current.score) || 0;
    const bestScore = parseFloat(best.score) || 0;
    if (currentScore !== bestScore) {
      return currentScore > bestScore ? current : best;
    }

    // 默认返回第一个
    return best;
  });
}

/**
 * 分组操作：将相邻的insert和delete成对，单独的操作各自成组
 * 作用: 将operations从一维数组转换为二维数组，便于管理相关的操作
 * 依赖: 无
 * 位置: compareTexts中调用
 * 调用: compareTexts
 */
function groupOperations(rawOperations) {
  if (!Array.isArray(rawOperations) || rawOperations.length === 0) {
    return [];
  }

  const groups = [];
  let i = 0;

  while (i < rawOperations.length) {
    const current = rawOperations[i];
    const next = i + 1 < rawOperations.length ? rawOperations[i + 1] : null;

    // 检查当前操作和下一个操作是否是相邻的delete和insert（替换操作）
    if (current.type === 'delete' && next && next.type === 'insert' &&
        current.originalEnd === next.originalIndex) {
      // 相邻的delete和insert成为一组（替换操作）
      groups.push({
        id: `group-${current.id}-${next.id}`,
        type: 'replace',
        operations: [current, next],
        position: current.originalStart,
        version: current.version || next.version,
        color: current.color || next.color
      });
      i += 2; // 跳过下一个操作
    } else {
      // 单独的操作各自成组
      groups.push({
        id: `group-${current.id}`,
        type: current.type,
        operations: [current],
        position: current.type === 'insert' ? current.originalIndex : current.originalStart,
        version: current.version,
        color: current.color
      });
      i += 1;
    }
  }

  console.log('Grouped operations:', groups);
  return groups;
}

/**
 * 生成操作内容哈希值（用于去重）
 * 作用: 为操作生成唯一哈希值，用于识别重复操作
 * 依赖: 无
 * 位置: 创建segment时调用
 * 调用: createSegment
 */
function generateContentHash(type, data) {
  console.log('generateContentHash', type, data);
  const content = `${type}-${data.version}-${data.text}`;

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString();
}
</script>

<style scoped>
.diff-viewer {
  width: 100%;
  height: 100%;
  position: relative; /* 为loading-overlay提供定位基准 */
}

.q-editor {
  border: 0px solid rgba(0, 0, 0, 0.12) !important;
  border-top: 1px solid rgba(0, 0, 0, 0.12) !important;
  /* border-radius: 4px; */
  /* background-color: #fff; */
}

/* 布局容器 */
.layout-container {
  display: flex;
  height: 100%;
  gap: 1px;
}

.editor-container {
  position: relative;
  height: 100%;
  flex: 1; /* 默认占满宽度 */
  transition: flex 0.3s ease;
}

/* 当有operations时，编辑器占4/5宽度 */
.layout-container.has-operations .editor-container {
  flex: 4;
  border-right: 1px solid rgba(0, 0, 0, 0.12);
}

.operations-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fafafa;
  min-width: 280px;
}

.writing-editor {
  width: 100%;
  height: 88vh;
  line-height: 1.8;
  font-size: 1rem;
  font-weight: 400;
  overflow-y: auto;

}

.writing-editor :deep(.q-editor__content) {
  padding: 0px;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.edits {
  transition: all 0.2s ease;
  cursor: pointer;
  position: relative;
}

.edits:hover {
  transform: scale(1.02);
  z-index: 10;
}

.strikethrough {
  text-decoration: line-through !important;
  text-decoration-thickness: 2px !important;
  text-decoration-color: currentColor !important;
  opacity: 0.7;
}

.inserted {
  border-radius: 4px;
  transition: all 0.2s ease;
}

.diff-tooltip {
  background: rgba(0, 0, 0, 0.85);
  border-radius: 6px;
  padding: 10px;
  color: white;
  font-size: 1rem;
  line-height: 1.4;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.custom-tooltip {
  background: rgba(0, 0, 0, 0.85);
  border-radius: 6px;
  padding: 10px;
  color: white;
  font-size: 1.1rem;
  line-height: 1.4;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.tooltip-content {
  max-width: 100%;
}

.tooltip-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 0.85rem;
  opacity: 0.9;
}

.tooltip-action {
  font-weight: 600;
}

.tooltip-version {
  opacity: 0.7;
  font-style: italic;
}

.tooltip-reason {
  margin-bottom: 6px;
  line-height: 1.3;
  font-size: 0.9rem;
}

.tooltip-change {
  font-family: monospace;
  background: rgba(255, 255, 255, 0.1);
  padding: 4px 6px;
  border-radius: 3px;
  font-size: 0.9rem;
}

.change-label {
  opacity: 0.8;
  margin-right: 4px;
}

/* Ensure strikethrough works in editor content */
.writing-editor :deep(.strikethrough) {
  text-decoration: line-through !important;
  text-decoration-thickness: 2px !important;
  text-decoration-color: currentColor !important;
}

/* Override any conflicting styles */
.edits.strikethrough {
  text-decoration: line-through !important;
  text-decoration-thickness: 2px !important;
  text-decoration-color: inherit !important;
}

/* Operations列表样式 */
.operations-header {
  padding: 8px 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  background: white;
}

.operations-list {
  flex: 1;
  height: calc(88vh - 40px);
}

.operation-group {
  padding: 8px 4px 0px 4px;
  background: white;
  transition: all 0.2s ease;
  cursor: pointer;
  position: relative;
  border-bottom: 3px solid #ebebeb;
}

.operation-group:hover {
  background: #f5f5f5;
}

.operation-highlighted {
  background: #e3f2fd !important;
  animation: highlight-pulse 1s ease-in-out;
}

@keyframes highlight-pulse {
  0% { background: #bbdefb; }
  50% { background: #e3f2fd; }
  100% { background: #e3f2fd; }
}

.operation-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.operation-type-chip {
  font-size: 0.7rem;
  font-weight: 600;
}

.operation-version {
  font-weight: 500;
  flex: 1;
  text-align: right;
  margin-left: 8px;
}

.operation-content {
  margin-bottom: 8px;
  display: flex;
  flex-direction: row;
  gap: 4px;
}

.operation-text {
  padding: 2px;
  border-radius: 4px;
  font-size: 0.85rem;
  line-height: 1.2;
  border: 3px solid transparent;
  word-wrap: break-word;
}

.operation-reason {
  line-height: 1.3;
  font-style: italic;
}

.operation-actions {
  display: flex;
  gap: 4px;
}

/* 新增：分组操作相关样式 */
.individual-operation {
  margin-bottom: 0px;
}

.operation-label {
  font-weight: 600;
  font-size: 0.8rem;
  opacity: 0.8;
}

/* 新增：加载状态和错误提示样式 */
.loading-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 8px;
  padding: 20px;
}

.error-message {
  background: #ffebee;
  border: 1px solid #f44336;
  border-radius: 4px;
  color: #c62828;
  position: relative;
}

/* 编辑器元素高亮样式 - 只显示底部横线 */
.writing-editor :deep(.editor-element-highlighted),
.editor-element-highlighted,
.editor-element-highlighted.highlight-insert,
.editor-element-highlighted.highlight-delete,
.editor-element-highlighted.highlight-replace {
  animation: editor-highlight-entrance 0.4s ease-out, editor-highlight-pulse 2s ease-in-out 0.4s infinite;
  border-bottom: 3px solid rgba(0, 157, 255, 0.8) !important;
  padding: 2px !important;
  margin: 2px !important;
  border-radius: 0px !important;
  z-index: 25 !important;
  position: relative !important;
  font-weight: bold !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

/* 进入动画 */
@keyframes editor-highlight-entrance {
  0% {
    opacity: 0.7;
    border-bottom-color: rgba(0, 157, 255, 0);
    background: rgba(0, 157, 255, 0);
  }
  50% {
    border-bottom-color: rgba(0, 157, 255, 0.9);
    background: rgba(0, 157, 255, 0.12);
  }
  100% {
    opacity: 1;
    border-bottom-color: rgba(0, 157, 255, 0.8);
    background: rgba(0, 157, 255, 0.08);
  }
}

/* 脉冲动画 */
@keyframes editor-highlight-pulse {
  0%, 100% {
    border-bottom-color: rgba(0, 157, 255, 0.8);
    background: rgba(0, 157, 255, 0.08);
  }
  50% {
    border-bottom-color: rgba(0, 157, 255, 1);
    background: rgba(0, 157, 255, 0.12);
  }
}
</style>
