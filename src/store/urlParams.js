import { ref, reactive } from 'vue'

// URL参数的响应式状态
const urlParams = reactive({
  condition: 'intelligible', // 默认值
  task: 'writing',          // 默认值
  userid: null,
  writingRubric: null,      // rubric参数 (只在task=writing时使用)
  passage: null,            // 新增passage参数 (只在task=writing时使用)
  rubricRubric: null,       // 新增rubricRubric参数 (只在task=rubric时使用)
  tour: null                // 新增tour参数，用于控制tutorial模式
})

// 解析URL参数的函数
function parseUrlParams() {
  const urlSearchParams = new URLSearchParams(window.location.search)

  // 检查是否有任何参数
  const hasAnyParams = urlSearchParams.toString().length > 0

  // 获取参数，如果不存在则使用默认值
  const condition = urlSearchParams.get('condition') || 'intelligible'
  const task = urlSearchParams.get('task') || 'writing'
  const userid = urlSearchParams.get('userid') || null
  const tour = urlSearchParams.get('tour') || null

  // 只有当task=writing时才解析writingRubric和passage参数
  const writingRubric = task === 'writing' ? urlSearchParams.get('writingRubric') || null : null
  const passage = task === 'writing' ? urlSearchParams.get('passage') || null : null

  // 只有当task=rubric时才解析rubricRubric参数
  const rubricRubric = task === 'rubric' ? urlSearchParams.get('rubricRubric') || null : null

  // 如果没有任何参数，自动跳转到带默认参数的URL
  if (!hasAnyParams) {
    const defaultParams = new URLSearchParams()
    defaultParams.set('task', 'writing')
    defaultParams.set('condition', 'intelligible')

    const newUrl = `${window.location.pathname}?${defaultParams.toString()}`
    window.history.replaceState({}, '', newUrl)

    urlParams.condition = 'intelligible'
    urlParams.task = 'writing'
    urlParams.userid = null
    urlParams.writingRubric = null
    urlParams.passage = null
    urlParams.rubricRubric = null
    urlParams.tour = null

    console.log('自动跳转到默认参数URL:', newUrl)
    return
  }

  // 其它情况，只补userid，不动其它参数
  let finalUserid = userid;
  if (!finalUserid) {
    const base = new Date('2025-07-27T00:00:00Z').getTime();
    const offsetInTenthsOfSeconds = Math.floor((Date.now() - base) / 100); // 将毫秒转化为十分位秒
    finalUserid = (offsetInTenthsOfSeconds % 100000000).toString().padStart(8, '0'); // 确保是8位数字
    // 只补userid，不动其它参数
    const currentParams = Object.fromEntries(urlSearchParams.entries());
    updateUrlParams({ ...currentParams, userid: finalUserid });
  }

  // 更新参数
  urlParams.condition = condition
  urlParams.task = task
  urlParams.userid = finalUserid
  urlParams.writingRubric = writingRubric
  urlParams.passage = passage
  urlParams.rubricRubric = rubricRubric
  urlParams.tour = tour

  console.log('解析的URL参数:', urlParams)
}

// 更新URL参数的函数
function updateUrlParams(newParams) {
  Object.assign(urlParams, newParams)

  // 更新浏览器URL
  const searchParams = new URLSearchParams()

  // 保持所有非空参数，不再基于默认值过滤
  if (urlParams.task) {
    searchParams.set('task', urlParams.task)
  }
  if (urlParams.condition) {
    searchParams.set('condition', urlParams.condition)
  }
  if (urlParams.userid) {
    searchParams.set('userid', urlParams.userid)
  }
  if (urlParams.tour) {
    searchParams.set('tour', urlParams.tour)
  }

  // 只有当task=writing时才添加writingRubric和passage参数
  if (urlParams.task === 'writing') {
    if (urlParams.writingRubric) {
      searchParams.set('writingRubric', urlParams.writingRubric)
    }
    if (urlParams.passage) {
      searchParams.set('passage', urlParams.passage)
    }
  }

  // 只有当task=rubric时才添加rubricRubric参数
  if (urlParams.task === 'rubric') {
    if (urlParams.rubricRubric) {
      searchParams.set('rubricRubric', urlParams.rubricRubric)
    }
  }

  const newUrl = `${window.location.pathname}${searchParams.toString() ? '?' + searchParams.toString() : ''}`
  window.history.replaceState({}, '', newUrl)
}

// 获取当前参数的函数
function getCurrentParams() {
  return { ...urlParams }
}

// 监听浏览器前进后退
window.addEventListener('popstate', () => {
  parseUrlParams()
})

export default {
  urlParams,
  parseUrlParams,
  updateUrlParams,
  getCurrentParams
}
