// 统一用户交互日志服务
// 用法：
// import usageLogger from 'src/store/usageLogger.js'
// usageLogger.init(urlParamsStore.getCurrentParams(), { page: 'WritingText' })
// usageLogger.log('click_button', { id: 'get-assessment' })

import { updateGistData } from 'src/components/githubConfig.js'
import urlParamsStore from 'src/store/urlParams.js'

const USAGE_GIST_ID = '8df50421bf5432ef8c8f5aaf495afb2e'

const state = {
  initialized: false,
  session: {
    task: null,
    condition: null,
    userid: null,
    writingRubric: null,
    passage: null,
    rubricRubric: null,
    tour: null,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    timeStarted: new Date().toISOString(),
    timeHuman: null,
  },
  context: {
    page: null, // 当前页面名，如 WritingText/WritingRubric/WritingIntelligible/RubricText/DiffViewer
    modelName: null,
  },
  events: [], // 时间序列事件
  counters: {
    operationsGroupsSuggested: 0,
    operationsSuggested: 0,
    operationsAccepted: 0,
    operationsRejected: 0,
  },
  snapshots: {
    lastWritingContent: '',
    lastRubricSelectedLabel: null,
    lastRubricJSON: null,
    lastScores: null, // 写作/量表得分对象
    lastTextFeedback: null, // text condition 的反馈文本
    chatMessages: [], // 简略保存
    writingHistory: [], // [{ts, content}]
    rubricHistory: [], // [{ts, rubric, columnCount, taskDescription}]
    assessmentRounds: [], // [{roundId, phase: 'before'|'after', ts, meta, data}]
    roundFinals: { writing: [], rubric: [] },
  },
  _saveTimer: null,
  _saving: false,
  currentRoundId: null,
  roundAccumulators: new Map(),
  currentRoundSeq: 0,
}

function toCst(date) {
  // Convert UTC date to UTC+8 (CST) by adding 8 hours
  const cstMs = date.getTime() + 8 * 60 * 60 * 1000
  return new Date(cstMs)
}

function pad(n) { return n.toString().padStart(2, '0') }

function formatStartTime(dateObj) {
  const d = toCst(dateObj)
  const yy = pad(d.getUTCFullYear() % 100)
  const mm = pad(d.getUTCMonth() + 1)
  const dd = pad(d.getUTCDate())
  const HH = pad(d.getUTCHours())
  const MM = pad(d.getUTCMinutes())
  const SS = pad(d.getUTCSeconds())
  return `${yy}-${mm}-${dd} ${HH}:${MM}:${SS}`
}

function buildFileName(session) {
  const task = session?.task || 'unknownTask'
  const condition = session?.condition || 'unknownCondition'
  const userid = session?.userid || 'anonymous'
  const timeStr = session?.timeHuman || formatStartTime(new Date())
  const safeTime = String(timeStr).replace(/:/g, '-').replace(/\s+/g, '_')
  return `${task}_${condition}_${userid}_${safeTime}.json`
}

function nowIso() {
  // Return ISO-like string in +08:00 timezone
  const d = toCst(new Date())
  const YYYY = d.getUTCFullYear()
  const MM = pad(d.getUTCMonth() + 1)
  const DD = pad(d.getUTCDate())
  const hh = pad(d.getUTCHours())
  const mm = pad(d.getUTCMinutes())
  const ss = pad(d.getUTCSeconds())
  const ms = d.getUTCMilliseconds().toString().padStart(3, '0')
  return `${YYYY}-${MM}-${DD}T${hh}:${mm}:${ss}.${ms}+08:00`
}

function cloneSafe(obj) {
  try {
    return obj == null ? obj : JSON.parse(JSON.stringify(obj))
  } catch (e) {
    return obj
  }
}

// 组件名称标准化为固定枚举，降低后续清洗成本
function normalizeComponentBucket(component, page, eventType, payload) {
  const raw = (component || '').toString().trim()
  const lower = raw.toLowerCase()
  // 直接映射
  if (['diffviewer', 'diff', 'editor', 'writingeditor'].includes(lower)) return 'DiffViewer'
  if (['rubricpanel', 'rubric', 'rubricfeedback', 'rubricintelligiblepanel'].includes(lower)) return 'RubricPanel'
  if (['writingpanel', 'writing'].includes(lower)) return 'WritingPanel'
  if (['scores', 'textfeedback', 'feedback', 'rubrictext', 'rubricbasicfeedback', 'assessment'].includes(lower)) return 'FeedbackPanel'
  if (['chat'].includes(lower)) return 'Chat'
  if (['rubricdesign'].includes(lower)) return 'RubricDesign'
  if (['preassessment'].includes(lower)) return 'PreAssessment'
  if (['global'].includes(lower)) return 'Global'

  // 事件类型/负载判断（细分反馈面板中的 rubric 交互等）
  const et = (eventType || '').toString()
  if (et.startsWith('rubric_cell_')) return 'FeedbackPanelRubric'
  if (et === 'writing_input') return 'WritingPanel'
  if (et === 'diff_editor_click' || et.startsWith('operations_')) return 'DiffViewer'
  if (et === 'pre_assessment_snapshot') return 'PreAssessment'
  if (et === 'rubric_design_snapshot') return 'RubricDesign'
  if (et === 'scores_updated' || et === 'text_feedback_updated') return 'FeedbackPanel'
  if (et === 'rubric_selected' || et === 'rubric_current_updated') return 'RubricPanel'
  if (et === 'click_button') {
    const id = (payload && payload.id) ? String(payload.id) : ''
    if (/assessment/i.test(id)) return 'FeedbackPanel'
    if (/save-rubric|add-criterion|delete|toggle|recommend|refine|improve|dimension/i.test(id)) return 'RubricDesign'
  }

  // 根据页面名兜底
  const pageLower = (page || '').toString().toLowerCase()
  if (pageLower.includes('intelligible') || pageLower.includes('rubric') || pageLower.includes('writing')) {
    if (pageLower.includes('writing')) {
      if (et.startsWith('rubric_cell_')) return 'FeedbackPanelRubric'
      if (et === 'click_button' && payload && /assessment/i.test(String(payload.id || ''))) return 'FeedbackPanel'
      return et === 'writing_input' ? 'WritingPanel' : 'DiffViewer'
    }
    if (pageLower.includes('rubricdesign')) return 'RubricDesign'
    if (pageLower.includes('rubric')) return 'RubricPanel'
  }
  return 'Other'
}

// 针对某个桶的细粒度动作键（RubricDesign/FeedbackPanelRubric 等）
function getActionKey(bucket, eventType, payload) {
  const et = (eventType || '').toString()
  const p = payload || {}
  if (bucket === 'RubricDesign') {
    // 来自全局点击的细粒度记录（包含 refineTypes）
    if (et === 'click' && p.button) {
      if ((p.button === 'refine-criterion' || p.button === 'refine-criterion-level') && p.type) {
        return `menu:${p.button}:${p.type}`
      }
      return `button:${p.button}`
    }
    if (et === 'click_button' && p.id) return `button:${p.id}`
    if (et === 'input_change' && p.role) return `input:${p.role}`
    if (et.startsWith('toggle_')) return `toolbar:${et}`
    if (/^(start_edit_model_name|change_model_name|delete_row)$/.test(et)) return et
    // AI 驱动动作：实际事件名
    if (/^(refine_or_generate|refine_description|recommend_dimension)$/i.test(et)) return `ai:${et}`
  }
  if (bucket === 'FeedbackPanelRubric') {
    if (et === 'rubric_cell_click') return 'cell:click'
    if (et === 'rubric_cell_hover') return 'cell:hover'
  }
  if (bucket === 'DiffViewer') {
    if (et === 'diff_editor_click') return 'editor:op-click'
    if (et === 'operations_accepted') return 'ops:accepted'
    if (et === 'operations_rejected') return 'ops:rejected'
    if (et === 'operations_computed') return 'ops:computed'
  }
  if (bucket === 'WritingPanel') {
    if (et === 'writing_input') return 'input:writing'
  }
  if (bucket === 'FeedbackPanel') {
    if (et === 'scores_updated') return 'scores:updated'
    if (et === 'text_feedback_updated') return 'text:updated'
    if (et === 'click_button' && p.id) return `button:${p.id}`
  }
  if (bucket === 'Chat') {
    if (et === 'chat_message') return 'chat:message'
  }
  return et || 'unknown'
}

function scheduleSave(immediate = false) {
  if (immediate) {
    return saveNow()
  }
  if (state._saveTimer) {
    clearTimeout(state._saveTimer)
  }
  state._saveTimer = setTimeout(() => {
    saveNow()
  }, 2000)
}

async function saveNow() {
  if (state._saving) return
  state._saving = true
  try {
    const fileName = buildFileName(state.session)
    const payload = {
      session: state.session,
      context: state.context,
      counters: state.counters,
      snapshots: state.snapshots,
      events: state.events,
      savedAt: nowIso(),
      version: 1,
    }

    const files = {
      [fileName]: { content: JSON.stringify(payload, null, 2) }
    }
    // await updateGistData(USAGE_GIST_ID, files)
  } catch (e) {
    console.error('usageLogger save error:', e)
  } finally {
    state._saving = false
  }
}

function ensureInitContext(extraContext) {
  if (!state.initialized) {
    // 尝试从 urlParamsStore 读取
    try {
      urlParamsStore.parseUrlParams()
      const params = urlParamsStore.getCurrentParams()
      // 调用 init
      api.init(params, extraContext)
    } catch (e) {
      // 忽略
    }
  }
}

const api = {
  init(sessionParams, extraContext = {}) {
    const prevFile = buildFileName(state.session)
    const start = new Date()
    state.session = {
      ...state.session,
      task: sessionParams?.task || state.session.task,
      condition: sessionParams?.condition || state.session.condition,
      userid: sessionParams?.userid || state.session.userid,
      writingRubric: sessionParams?.writingRubric || null,
      passage: sessionParams?.passage || null,
      rubricRubric: sessionParams?.rubricRubric || null,
      tour: sessionParams?.tour || null,
      timeStarted: state.session.timeStarted || start.toISOString(),
      timeHuman: state.session.timeHuman || formatStartTime(start),
    }
    // 实验分组标注（便于分析）
    const task = state.session.task
    const cond = state.session.condition
    let experimentGroup = 'control'
    if (cond === 'intelligible') experimentGroup = `${task}-intelligible`
    else if (cond === 'text') experimentGroup = `${task}-text`
    else if (cond === 'rubric') experimentGroup = `${task}-rubric`
    state.session.experimentGroup = experimentGroup
    state.context = {
      ...state.context,
      ...extraContext,
    }
    state.initialized = true

    const newFile = buildFileName(state.session)
    // 文件名变更时立即保存一次开场记录
    if (prevFile !== newFile) {
      state.events.push({ ts: nowIso(), type: 'session_start', page: state.context.page || null, payload: cloneSafe(state.session) })
      scheduleSave(true)
    }

    // 绑定 beforeunload/visibilitychange/pagehide，尽力保存
    if (typeof window !== 'undefined' && !window.__usageLoggerUnloadBound) {
      const attemptSave = () => {
        try { saveNow() } catch (e) {}
      }
      window.addEventListener('beforeunload', attemptSave)
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') attemptSave()
      })
      window.addEventListener('pagehide', attemptSave)
      window.__usageLoggerUnloadBound = true
    }
  },

  setContext(context = {}) {
    state.context = { ...state.context, ...context }
    scheduleSave(false)
  },

  log(eventType, payload = {}, options = {}) {
    // 忽略不需要的事件类型
    if (!eventType || eventType.startsWith('notify') || eventType.startsWith('resize')) {
      return
    }
    ensureInitContext(options?.context)
    const record = {
      ts: nowIso(),
      type: eventType,
      page: options?.page || state.context.page || null,
      component: options?.component || null,
      payload: cloneSafe(payload),
    }
    state.events.push(record)
    if (state.currentRoundId && state.roundAccumulators.has(state.currentRoundId)) {
      const acc = state.roundAccumulators.get(state.currentRoundId)
      acc.interactions = (acc.interactions || 0) + 1
      const comp = normalizeComponentBucket(record.component, record.page, record.type, record.payload)
      acc.clicksByComponent = acc.clicksByComponent || {}
      acc.clicksByComponent[comp] = (acc.clicksByComponent[comp] || 0) + 1
      // 针对细分桶记录动作键（如 RubricDesign 按钮/输入/工具条）
      if (!acc.actionsByBucket) acc.actionsByBucket = {}
      const actionKey = getActionKey(comp, record.type, record.payload)
      const actionMap = acc.actionsByBucket[comp] || {}
      actionMap[actionKey] = (actionMap[actionKey] || 0) + 1
      acc.actionsByBucket[comp] = actionMap
    }
    // 控制事件数组增长，避免过大（可根据需要调整）
    if (state.events.length > 5000) {
      state.events.splice(0, state.events.length - 5000)
    }
    scheduleSave(false)
  },

  // 写作内容更新与快照
  updateWritingContent(content, meta = {}) {
    state.snapshots.lastWritingContent = typeof content === 'string' ? content : String(content || '')
    // 追加到历史
    state.snapshots.writingHistory.push({ ts: nowIso(), content: state.snapshots.lastWritingContent })
    this.log('writing_input', { length: state.snapshots.lastWritingContent.length, content: state.snapshots.lastWritingContent, ...meta }, { component: 'WritingPanel' })
  },

  // Rubric 选择与内容快照
  updateRubricSelection(label, rubricJson) {
    state.snapshots.lastRubricSelectedLabel = label || null
    state.snapshots.lastRubricJSON = cloneSafe(rubricJson)
    this.log('rubric_selected', { label, rubricSize: rubricJson ? JSON.stringify(rubricJson).length : 0 }, { component: 'RubricPanel' })
  },

  // 直接设置当前 rubric（用于设计或评估面板在用户编辑时）
  setCurrentRubric(rubricJson, columnCount, taskDescription) {
    state.snapshots.lastRubricJSON = cloneSafe(rubricJson)
    // 记一下上下文，供 roundFinals.rubric
    state.session.columnCount = columnCount
    state.session.taskDescription = taskDescription
    // 追加到 rubric 历史（rubric task 的过程记录）
    try {
      state.snapshots.rubricHistory.push({
        ts: nowIso(),
        rubric: cloneSafe(rubricJson),
        columnCount,
        taskDescription
      })
    } catch (e) {}
    this.log('rubric_current_updated', {
      rubricSize: rubricJson ? JSON.stringify(rubricJson).length : 0,
      columnCount,
      hasTaskDescription: !!taskDescription
    }, { component: 'RubricPanel' })
    scheduleSave(false)
  },

  // 分数/反馈快照
  updateScores(scoresObj) {
    state.snapshots.lastScores = cloneSafe(scoresObj)
    this.log('scores_updated', { summary: (scoresObj && scoresObj.totalAIScore != null) ? { totalAIScore: scoresObj.totalAIScore, aiScorePercentage: scoresObj.aiScorePercentage } : scoresObj }, { component: 'Scores' })
  },
  updateTextFeedback(feedbackObj) {
    state.snapshots.lastTextFeedback = cloneSafe(feedbackObj)
    this.log('text_feedback_updated', feedbackObj, { component: 'TextFeedback' })
  },
  // 预评估快照（rubric或writing）
  snapshotBeforeAssessment(data) {
    const safe = cloneSafe(data)
    this.log('pre_assessment_snapshot', { size: JSON.stringify(safe).length }, { component: 'PreAssessment' })
    // 将快照也放入 snapshots 中，便于恢复
    state.snapshots.preAssessment = safe
    scheduleSave(false)
  },

  // RubricDesign 全量快照
  updateRubricDesignSnapshot(rubricData) {
    const snapshot = cloneSafe(rubricData)
    state.snapshots.rubricHistory.push({ ts: nowIso(), ...snapshot })
    this.log('rubric_design_snapshot', { size: JSON.stringify(snapshot).length }, { component: 'RubricDesign' })
    scheduleSave(false)
  },

  // 评估轮次管理
  beginRound(meta = {}) {
    const roundId = Math.random().toString(36).slice(2)
    state.currentRoundSeq = (state.currentRoundSeq || 0) + 1
    const seq = state.currentRoundSeq
    state.snapshots.assessmentRounds.push({ roundId, seq, phase: 'before', ts: nowIso(), meta: cloneSafe(meta), data: cloneSafe(state.snapshots.preAssessment || {}) })
    this.log('assessment_round_begin', { roundId, meta }, { component: 'Assessment' })
    scheduleSave(false)
    state.currentRoundId = roundId
    state.roundAccumulators.set(roundId, { startedAt: Date.now(), interactions: 0, rubricHoverMs: 0, maxOpsGroups: 0, maxOps: 0, clicksByComponent: {} })
    return roundId
  },
  endRound(roundId, data = {}, meta = {}) {
    const ts = nowIso()
    const acc = state.roundAccumulators.get(roundId) || {}
    const durationMs = acc.startedAt ? (Date.now() - acc.startedAt) : null

    let scoreAfter = null
    let scoreBefore = null
    if (data && typeof data === 'object') {
      if (data.scores && typeof data.scores.totalAIScore === 'number') scoreAfter = data.scores.totalAIScore
      if (typeof data.score === 'number') scoreAfter = data.score
    }
    if (state.snapshots.lastScores && typeof state.snapshots.lastScores.totalAIScore === 'number') {
      scoreBefore = state.snapshots.lastScores.totalAIScore
    }

    // 找到对应的 before 记录以取 seq
    const beforeRec = [...state.snapshots.assessmentRounds].reverse().find(r => r.roundId === roundId && r.phase === 'before')
    const seq = beforeRec?.seq || state.currentRoundSeq || 0

    // 规范化本轮组件点击映射
    const normalizedClicks = {}
    Object.entries(acc.clicksByComponent || {}).forEach(([k, v]) => {
      const norm = normalizeComponentBucket(k, state.context.page, null)
      normalizedClicks[norm] = (normalizedClicks[norm] || 0) + (v || 0)
    })

    state.snapshots.assessmentRounds.push({
      roundId,
      seq,
      phase: 'after',
      ts,
      meta: cloneSafe(meta),
      data: cloneSafe(data),
      durationMs,
      interactions: acc.interactions || 0,
      rubricHoverMs: acc.rubricHoverMs || 0,
      maxOpsGroups: acc.maxOpsGroups || 0,
      maxOps: acc.maxOps || 0,
      clicksByComponent: normalizedClicks,
      actionsByBucket: cloneSafe(acc.actionsByBucket || {}),
      operationsAccepted: acc.accepted || 0,
      operationsRejected: acc.rejected || 0,
      scoreBefore,
      scoreAfter,
      scoreDelta: (scoreAfter != null && scoreBefore != null) ? (scoreAfter - scoreBefore) : null,
    })

    // 记录本轮最终版本（writing 或 rubric，按任务类型）
    try {
      const task = state.session.task
      if (task === 'writing') {
        state.snapshots.roundFinals.writing.push({ roundId, ts, content: state.snapshots.lastWritingContent })
      } else if (task === 'rubric') {
        state.snapshots.roundFinals.rubric.push({ roundId, ts, rubric: cloneSafe(state.snapshots.lastRubricJSON), columnCount: state.session.columnCount || null, taskDescription: state.session.taskDescription || null })
      }
    } catch (e) {}
    this.log('assessment_round_end', { roundId, meta }, { component: 'Assessment' })
    scheduleSave(false)
    if (state.currentRoundId === roundId) state.currentRoundId = null
    state.roundAccumulators.delete(roundId)

    // 更新会话级汇总（便于后续可视化/制表）
    try {
      const afterRounds = state.snapshots.assessmentRounds.filter(r => r.phase === 'after')
      const roundCount = afterRounds.length
      const totalDurationMs = afterRounds.reduce((s, r) => s + (r.durationMs || 0), 0)
      const totalInteractions = afterRounds.reduce((s, r) => s + (r.interactions || 0), 0)
      const totalRubricHoverMs = afterRounds.reduce((s, r) => s + (r.rubricHoverMs || 0), 0)
      const totalAccepted = afterRounds.reduce((s, r) => s + (r.operationsAccepted || 0), 0)
      const totalRejected = afterRounds.reduce((s, r) => s + (r.operationsRejected || 0), 0)
      const avgScoreDelta = roundCount > 0 ? (afterRounds.reduce((s, r) => s + ((r.scoreDelta != null) ? r.scoreDelta : 0), 0) / roundCount) : null

      // 计算会话总时长（开始-最后一个 after ts）
      const start = state.session.timeStarted
      const end = afterRounds.length > 0 ? afterRounds[afterRounds.length - 1].ts : nowIso()
      const totalSessionMs = start && end ? (new Date(end) - new Date(start)) : null

      // 聚合 clicksByComponent
      const clicksByComponentTotal = {}
      afterRounds.forEach(r => {
        const map = r.clicksByComponent || {}
        Object.keys(map).forEach(k => {
          clicksByComponentTotal[k] = (clicksByComponentTotal[k] || 0) + (map[k] || 0)
        })
      })

      state.snapshots.sessionSummary = {
        roundCount,
        totalDurationMs,
        totalInteractions,
        totalRubricHoverMs,
        totalAccepted,
        totalRejected,
        avgScoreDelta,
        totalSessionMs,
        clicksByComponentTotal,
      }
    } catch (e) {}
  },

  // operations 统计
  updateOperationsStats({ groupsCount, operationsCount }) {
    state.counters.operationsGroupsSuggested = groupsCount
    state.counters.operationsSuggested = operationsCount
    this.log('operations_computed', { groupsCount, operationsCount }, { component: 'DiffViewer' })
    if (state.currentRoundId && state.roundAccumulators.has(state.currentRoundId)) {
      const acc = state.roundAccumulators.get(state.currentRoundId)
      acc.maxOpsGroups = Math.max(acc.maxOpsGroups || 0, groupsCount || 0)
      acc.maxOps = Math.max(acc.maxOps || 0, operationsCount || 0)
    }
  },
  markOperationsAccepted(count, detail = {}) {
    state.counters.operationsAccepted += count
    this.log('operations_accepted', { count, detail }, { component: 'DiffViewer' })
    if (state.currentRoundId && state.roundAccumulators.has(state.currentRoundId)) {
      const acc = state.roundAccumulators.get(state.currentRoundId)
      acc.accepted = (acc.accepted || 0) + (count || 0)
    }
  },
  markOperationsRejected(count, detail = {}) {
    state.counters.operationsRejected += count
    this.log('operations_rejected', { count, detail }, { component: 'DiffViewer' })
    if (state.currentRoundId && state.roundAccumulators.has(state.currentRoundId)) {
      const acc = state.roundAccumulators.get(state.currentRoundId)
      acc.rejected = (acc.rejected || 0) + (count || 0)
    }
  },

  // Chat 记录
  appendChatMessage(message) {
    const msg = cloneSafe(message)
    state.snapshots.chatMessages.push({ ts: nowIso(), ...msg })
    // 控制记录长度
    if (state.snapshots.chatMessages.length > 200) {
      state.snapshots.chatMessages.splice(0, state.snapshots.chatMessages.length - 200)
    }
    this.log('chat_message', msg, { component: 'Chat' })
  },

  saveNow,

  accumulateRubricHover(dwellMs) {
    if (state.currentRoundId && state.roundAccumulators.has(state.currentRoundId)) {
      const acc = state.roundAccumulators.get(state.currentRoundId)
      acc.rubricHoverMs = (acc.rubricHoverMs || 0) + (dwellMs || 0)
    }
  },
}

export default api


