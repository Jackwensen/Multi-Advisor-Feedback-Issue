import { reactive } from 'vue'

const urlParams = reactive({
  condition: 'intelligible',
  task: 'writing',
  userid: null,
  writingRubric: null,
  passage: null,
})

function parseUrlParams() {
  const urlSearchParams = new URLSearchParams(window.location.search)
  const userid = urlSearchParams.get('userid') || null

  let finalUserid = userid;
  if (!finalUserid) {
    const base = new Date('2025-07-27T00:00:00Z').getTime();
    const offsetInTenthsOfSeconds = Math.floor((Date.now() - base) / 100); // 将毫秒转化为十分位秒
    finalUserid = (offsetInTenthsOfSeconds % 100000000).toString().padStart(8, '0'); // 确保是8位数字
  }

  urlParams.condition = 'intelligible'
  urlParams.task = 'writing'
  urlParams.userid = finalUserid
  urlParams.writingRubric = urlSearchParams.get('writingRubric') || null
  urlParams.passage = urlSearchParams.get('passage') || null
}

function updateUrlParams(newParams) {
  Object.assign(urlParams, newParams)
}

function getCurrentParams() {
  return { ...urlParams }
}

window.addEventListener('popstate', () => {
  parseUrlParams()
})

export default {
  urlParams,
  parseUrlParams,
  updateUrlParams,
  getCurrentParams
}
