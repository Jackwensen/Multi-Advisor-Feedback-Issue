// src/boot/axios.js

import { boot } from 'quasar/wrappers'
import axios from 'axios'

const local_ai = 'http://localhost:5000/'
const localAPI = axios.create({ baseURL: local_ai })

const zhipu_ai = 'https://open.bigmodel.cn/'
const chatAPI = axios.create({ baseURL: zhipu_ai })
const apiKey = import.meta.env.VITE_BIGMODEL_API_KEY?.trim()



const chatCompletionsGood = (messages) => {
  if (!apiKey) {
    return Promise.reject(new Error('Missing VITE_BIGMODEL_API_KEY. Add it to your local .env file.'))
  }

  return chatAPI.post('api/paas/v4/chat/completions', {
    model: 'glm-4-plus',
    messages: messages,
    // temperature: 0.4,
    // top_p: 0.5,
  }, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  })
}

export default boot(({ app }) => {
  // for use inside Vue files (Options API) through this.$axios and this.$api

  app.config.globalProperties.$axios = axios
  // ^ ^ ^ this will allow you to use this.$axios (for Vue Options API form)
  //       so you won't necessarily have to import axios in each vue file

  app.config.globalProperties.$localAPI = localAPI
  // ^ ^ ^ this will allow you to use this.$api (for Vue Options API form)
  //       so you can easily perform requests against your app's API
})

export { axios, localAPI, chatCompletionsGood }
