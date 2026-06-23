import urlParamsStore from 'src/store/urlParams.js'

const state = {
  initialized: false,
  session: {
    task: 'writing',
    condition: 'intelligible',
    userid: null,
    writingRubric: null,
    passage: null,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    timeStarted: new Date().toISOString(),
    timeHuman: null,
    experimentGroup: 'writing-intelligible',
  },
  context: {
    page: null,
    modelName: null,
  },
  events: [],
  counters: {
    operationsGroupsSuggested: 0,
    operationsSuggested: 0,
    operationsAccepted: 0,
    operationsRejected: 0,
  },
  snapshots: {
    lastWritingContent: '',
    lastCriteriaSelectedLabel: null,
    lastCriteriaJSON: null,
    lastScores: null,
    writingHistory: [],
    assessmentRounds: [],
    roundFinals: { writing: [] },
  },
  _saveTimer: null,
  _saving: false,
  currentRoundId: null,
  roundAccumulators: new Map(),
  currentRoundSeq: 0,
}

function toCst(date) {
  const cstMs = date.getTime() + 8 * 60 * 60 * 1000
  return new Date(cstMs)
}

function pad(n) {
  return n.toString().padStart(2, '0')
}

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

function nowIso() {
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

function buildFileName(session) {
  const userid = session?.userid || 'anonymous'
  const timeStr = session?.timeHuman || formatStartTime(new Date())
  const safeTime = String(timeStr).replace(/:/g, '-').replace(/\s+/g, '_')
  return `writing_intelligible_${userid}_${safeTime}.json`
}

function cloneSafe(obj) {
  try {
    return obj == null ? obj : JSON.parse(JSON.stringify(obj))
  } catch (e) {
    return obj
  }
}

function normalizeComponentBucket(component, page, eventType, payload) {
  const raw = (component || '').toString().trim().toLowerCase()
  if (['diffviewer', 'diff', 'editor', 'writingeditor'].includes(raw)) return 'DiffViewer'
  if (['writingpanel', 'writing'].includes(raw)) return 'WritingPanel'
  if (['criteriapanel', 'rubricpanel', 'rubric'].includes(raw)) return 'CriteriaPanel'
  if (['scores', 'assessment'].includes(raw)) return 'AssessmentPanel'
  if (['global'].includes(raw)) return 'Global'

  const et = (eventType || '').toString()
  if (et.startsWith('rubric_cell_') || et.startsWith('criteria_cell_')) return 'CriteriaPanel'
  if (et === 'writing_input') return 'WritingPanel'
  if (et === 'diff_editor_click' || et.startsWith('operations_')) return 'DiffViewer'
  if (et === 'scores_updated') return 'AssessmentPanel'
  if (et === 'click_button' && payload && /assessment/i.test(String(payload.id || ''))) return 'AssessmentPanel'

  const pageLower = (page || '').toString().toLowerCase()
  if (pageLower.includes('writing')) return 'WritingPanel'
  return 'Other'
}

function getActionKey(bucket, eventType, payload) {
  const et = (eventType || '').toString()
  const p = payload || {}

  if (bucket === 'CriteriaPanel') {
    if (et === 'rubric_cell_click' || et === 'criteria_cell_click') return 'cell:click'
    if (et === 'rubric_cell_hover' || et === 'criteria_cell_hover') return 'cell:hover'
    if (et === 'rubric_selected' || et === 'criteria_selected') return 'criteria:selected'
  }
  if (bucket === 'DiffViewer') {
    if (et === 'diff_editor_click') return 'editor:op-click'
    if (et === 'operations_accepted') return 'ops:accepted'
    if (et === 'operations_rejected') return 'ops:rejected'
    if (et === 'operations_computed') return 'ops:computed'
  }
  if (bucket === 'WritingPanel' && et === 'writing_input') return 'input:writing'
  if (bucket === 'AssessmentPanel') {
    if (et === 'scores_updated') return 'scores:updated'
    if (et === 'click_button' && p.id) return `button:${p.id}`
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
      version: 2,
    }
    window.localStorage.setItem(`mars_usage_${fileName}`, JSON.stringify(payload))
  } catch (e) {
    console.error('usageLogger save error:', e)
  } finally {
    state._saving = false
  }
}

function ensureInitContext(extraContext) {
  if (state.initialized) return
  try {
    urlParamsStore.parseUrlParams()
    api.init(urlParamsStore.getCurrentParams(), extraContext)
  } catch (e) {}
}

const api = {
  init(sessionParams, extraContext = {}) {
    const prevFile = buildFileName(state.session)
    const start = new Date()
    state.session = {
      ...state.session,
      task: 'writing',
      condition: 'intelligible',
      userid: sessionParams?.userid || state.session.userid,
      writingRubric: sessionParams?.writingRubric || state.session.writingRubric,
      passage: sessionParams?.passage || state.session.passage,
      timeStarted: state.session.timeStarted || start.toISOString(),
      timeHuman: state.session.timeHuman || formatStartTime(start),
      experimentGroup: 'writing-intelligible',
    }
    state.context = {
      ...state.context,
      ...extraContext,
    }
    state.initialized = true

    const newFile = buildFileName(state.session)
    if (prevFile !== newFile) {
      state.events.push({ ts: nowIso(), type: 'session_start', page: state.context.page || null, payload: cloneSafe(state.session) })
      scheduleSave(true)
    }

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
      if (!acc.actionsByBucket) acc.actionsByBucket = {}
      const actionKey = getActionKey(comp, record.type, record.payload)
      const actionMap = acc.actionsByBucket[comp] || {}
      actionMap[actionKey] = (actionMap[actionKey] || 0) + 1
      acc.actionsByBucket[comp] = actionMap
    }

    if (state.events.length > 5000) {
      state.events.splice(0, state.events.length - 5000)
    }
    scheduleSave(false)
  },

  updateWritingContent(content, meta = {}) {
    state.snapshots.lastWritingContent = typeof content === 'string' ? content : String(content || '')
    state.snapshots.writingHistory.push({ ts: nowIso(), content: state.snapshots.lastWritingContent })
    this.log('writing_input', { length: state.snapshots.lastWritingContent.length, content: state.snapshots.lastWritingContent, ...meta }, { component: 'WritingPanel' })
  },

  updateRubricSelection(label, criteriaJson) {
    state.snapshots.lastCriteriaSelectedLabel = label || null
    state.snapshots.lastCriteriaJSON = cloneSafe(criteriaJson)
    this.log('criteria_selected', { label, criteriaSize: criteriaJson ? JSON.stringify(criteriaJson).length : 0 }, { component: 'CriteriaPanel' })
  },

  updateScores(scoresObj) {
    state.snapshots.lastScores = cloneSafe(scoresObj)
    this.log('scores_updated', {
      summary: (scoresObj && scoresObj.totalAIScore != null)
        ? { totalAIScore: scoresObj.totalAIScore, aiScorePercentage: scoresObj.aiScorePercentage }
        : scoresObj,
    }, { component: 'Scores' })
  },

  beginRound(meta = {}) {
    const roundId = Math.random().toString(36).slice(2)
    state.currentRoundSeq = (state.currentRoundSeq || 0) + 1
    const seq = state.currentRoundSeq
    state.snapshots.assessmentRounds.push({ roundId, seq, phase: 'before', ts: nowIso(), meta: cloneSafe(meta), data: {} })
    this.log('assessment_round_begin', { roundId, meta }, { component: 'Assessment' })
    scheduleSave(false)
    state.currentRoundId = roundId
    state.roundAccumulators.set(roundId, { startedAt: Date.now(), interactions: 0, criteriaHoverMs: 0, maxOpsGroups: 0, maxOps: 0, clicksByComponent: {} })
    return roundId
  },

  endRound(roundId, data = {}, meta = {}) {
    const ts = nowIso()
    const acc = state.roundAccumulators.get(roundId) || {}
    const durationMs = acc.startedAt ? (Date.now() - acc.startedAt) : null
    const scoreAfter = data?.scores && typeof data.scores.totalAIScore === 'number' ? data.scores.totalAIScore : null
    const scoreBefore = state.snapshots.lastScores && typeof state.snapshots.lastScores.totalAIScore === 'number'
      ? state.snapshots.lastScores.totalAIScore
      : null
    const beforeRec = [...state.snapshots.assessmentRounds].reverse().find(r => r.roundId === roundId && r.phase === 'before')
    const seq = beforeRec?.seq || state.currentRoundSeq || 0
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
      criteriaHoverMs: acc.criteriaHoverMs || 0,
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

    state.snapshots.roundFinals.writing.push({ roundId, ts, content: state.snapshots.lastWritingContent })
    this.log('assessment_round_end', { roundId, meta }, { component: 'Assessment' })
    scheduleSave(false)
    if (state.currentRoundId === roundId) state.currentRoundId = null
    state.roundAccumulators.delete(roundId)
  },

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

  saveNow,

  accumulateRubricHover(dwellMs) {
    if (state.currentRoundId && state.roundAccumulators.has(state.currentRoundId)) {
      const acc = state.roundAccumulators.get(state.currentRoundId)
      acc.criteriaHoverMs = (acc.criteriaHoverMs || 0) + (dwellMs || 0)
    }
  },
}

export default api
