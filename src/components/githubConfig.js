// GitHub API 配置文件
// 说明：
// 1. 公开 Gist 的读取不需要 token
// 2. 若需要读取私有 Gist 或执行写入，请通过环境变量 `VITE_GITHUB_TOKEN`
//    或浏览器 localStorage 中的 `github_pat` 提供 token

function getGitHubToken() {
  const envToken = import.meta.env.VITE_GITHUB_TOKEN?.trim();

  if (envToken) {
    return envToken;
  }

  if (typeof window !== "undefined" && window.localStorage) {
    const localToken = window.localStorage.getItem("github_pat")?.trim();
    if (localToken) {
      return localToken;
    }
  }

  return "";
}

function buildGitHubHeaders(headers = {}, token = getGitHubToken()) {
  return {
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "User-Agent": "diverse-feedback-llm-app",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };
}

function isWriteMethod(method = "GET") {
  return !["GET", "HEAD"].includes(String(method).toUpperCase());
}

function isBadCredentialError(response, responseBody) {
  const messageFromBody =
    typeof responseBody === "object" && responseBody && responseBody.message
      ? responseBody.message
      : typeof responseBody === "string"
      ? responseBody
      : "";

  return (
    response.status === 401 && /bad credentials/i.test(messageFromBody || "")
  );
}

// 通用的 GitHub API 请求函数，自动处理认证和错误
async function githubApiRequest(url, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const token = getGitHubToken();

  if (isWriteMethod(method) && !token) {
    const error = new Error(
      "GitHub token is required for updating Gists. Please set `VITE_GITHUB_TOKEN` or localStorage `github_pat`."
    );
    error.status = 401;
    error.isAuthError = true;
    throw error;
  }

  const defaultOptions = {
    headers: buildGitHubHeaders(options.headers, token),
    ...options,
  };

  let response = await fetch(url, defaultOptions);

  // 预解析 body（尽力而为，不要因解析失败再抛错）
  let responseBody = null;
  try {
    // 只在有内容时解析 JSON
    if (
      response.headers &&
      (response.headers.get("content-type") || "").includes("application/json")
    ) {
      responseBody = await response.json();
    } else {
      responseBody = await response.text();
    }
  } catch (_) {
    responseBody = null;
  }

  // 公开 Gist 读取：如果 token 失效，则自动回退为匿名请求
  if (
    !response.ok &&
    method === "GET" &&
    token &&
    isBadCredentialError(response, responseBody)
  ) {
    const fallbackOptions = {
      ...options,
      headers: buildGitHubHeaders(options.headers, ""),
    };

    response = await fetch(url, fallbackOptions);

    try {
      if (
        response.headers &&
        (response.headers.get("content-type") || "").includes(
          "application/json"
        )
      ) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
      }
    } catch (_) {
      responseBody = null;
    }
  }

  // 状态非 OK 时构造富错误，包含限流信息
  if (!response.ok) {
    const rateLimitRemaining = response.headers.get("X-RateLimit-Remaining");
    const rateLimitReset = response.headers.get("X-RateLimit-Reset");
    const retryAfter = response.headers.get("Retry-After");
    const messageFromBody =
      typeof responseBody === "object" && responseBody && responseBody.message
        ? responseBody.message
        : typeof responseBody === "string"
        ? responseBody
        : "";

    const isPrimaryRateLimit =
      response.status === 403 && rateLimitRemaining === "0";
    const isSecondaryRateLimit =
      response.status === 403 &&
      /abuse detection|rate limit exceeded/i.test(messageFromBody || "");

    const error = new Error(
      `GitHub API error ${response.status}: ${response.statusText}${
        messageFromBody ? ` - ${messageFromBody}` : ""
      }`
    );
    error.status = response.status;
    error.headers = {
      rateLimitRemaining,
      rateLimitReset,
      retryAfter,
    };
    error.responseMessage = messageFromBody;
    error.isRateLimited = Boolean(isPrimaryRateLimit || isSecondaryRateLimit);
    error.isAuthError = response.status === 401;
    error.rateLimitResetEpochSec = rateLimitReset
      ? parseInt(rateLimitReset, 10)
      : undefined;
    error.retryAfterSec = retryAfter ? parseInt(retryAfter, 10) : undefined;

    throw error;
  }

  // OK
  return typeof responseBody === "string" && responseBody
    ? (() => {
        try {
          return JSON.parse(responseBody);
        } catch {
          return responseBody;
        }
      })()
    : responseBody;
}

// 工具: 睡眠 + 抖动
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function jitter(baseMs, spreadMs = 300) {
  const delta = Math.floor(Math.random() * spreadMs);
  return baseMs + delta;
}

// 带重试与限流感知的 GitHub API 请求函数
async function githubApiRequestWithRetry(url, options = {}, maxRetries = 5) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await githubApiRequest(url, options);
    } catch (error) {
      const isLast = attempt === maxRetries - 1;

      // 限流/滥用检测，优先使用 Retry-After 或 X-RateLimit-Reset
      if (error && (error.isRateLimited || error.status === 429)) {
        let waitMs = 0;
        if (
          typeof error.retryAfterSec === "number" &&
          !Number.isNaN(error.retryAfterSec)
        ) {
          waitMs = error.retryAfterSec * 1000;
        } else if (
          typeof error.rateLimitResetEpochSec === "number" &&
          !Number.isNaN(error.rateLimitResetEpochSec)
        ) {
          const resetMs = error.rateLimitResetEpochSec * 1000;
          waitMs = Math.max(0, resetMs - Date.now());
        } else {
          // 兜底等待 60s
          waitMs = 60000;
        }
        const finalWait = jitter(waitMs, 500);
        console.warn(
          `GitHub rate limited. Waiting ~${Math.ceil(
            finalWait / 1000
          )}s before retry ${attempt + 1}/${maxRetries}`
        );
        if (isLast) throw error;
        await sleep(finalWait);
        continue;
      }

      // 认证失败 / 坏凭证：不重试
      if (error && (error.isAuthError || error.status === 401)) {
        throw error;
      }

      // 5xx 或网络类错误: 指数退避
      if (
        error &&
        (error.status >= 500 ||
          error.status === 0 ||
          error.name === "FetchError")
      ) {
        const backoff = Math.min(10000, Math.pow(2, attempt) * 1000);
        const finalWait = jitter(backoff, 300);
        console.warn(
          `Transient error ${error.status || ""}. Retrying in ~${Math.ceil(
            finalWait / 1000
          )}s (${attempt + 1}/${maxRetries})`
        );
        if (isLast) throw error;
        await sleep(finalWait);
        continue;
      }

      // 其他错误，短暂退避
      const finalWait = jitter(2000, 500);
      console.warn(
        `Request failed: ${error?.message || error}. Retrying in ~${Math.ceil(
          finalWait / 1000
        )}s (${attempt + 1}/${maxRetries})`
      );
      if (isLast) throw error;
      await sleep(finalWait);
    }
  }
}

// 缓存机制
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

function getCachedData(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

function setCachedData(key, data) {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

// 获取 Gist 数据的通用函数
async function getGistData(gistId) {
  const cacheKey = `gist_${gistId}`;

  // 尝试从缓存获取
  const cachedData = getCachedData(cacheKey);
  if (cachedData) {
    console.log(`Using cached data for gist ${gistId}`);
    return cachedData;
  }

  try {
    const data = await githubApiRequestWithRetry(
      `https://api.github.com/gists/${gistId}`
    );
    setCachedData(cacheKey, data);
    return data;
  } catch (error) {
    console.error(`Error fetching gist ${gistId}:`, error);
    return null;
  }
}

// 轻量级合并与串行写入，避免高频并发更新同一 Gist
const _gistUpdateState = new Map(); // gistId -> { timer, pendingFiles, inflightPromise }

// 更新 Gist 数据的函数（带合并/限流友好）
async function updateGistData(gistId, files) {
  const state = _gistUpdateState.get(gistId) || {
    timer: null,
    pendingFiles: {},
    inflightPromise: null,
  };
  state.pendingFiles = { ...state.pendingFiles, ...files };
  const cacheKey = `gist_${gistId}`;
  const hasPending = Object.keys(state.pendingFiles).length > 0;

  if (state.inflightPromise) {
    if (state.timer) {
      // 已有计划中的刷新，直接复用 Promise
      _gistUpdateState.set(gistId, state);
      return state.inflightPromise;
    }
    // 已有网络请求在进行中，但没有计划中的刷新：
    // 仅当当前存在未发送的待合并文件时，等当前请求完成后触发下一轮；否则直接复用当前 Promise
    _gistUpdateState.set(gistId, state);
    return hasPending
      ? state.inflightPromise.then(() => updateGistData(gistId, {}))
      : state.inflightPromise;
  }

  // 没有进行中的请求且也没有待合并文件，直接返回缓存（不发空 PATCH）
  if (!hasPending) {
    _gistUpdateState.set(gistId, state);
    return Promise.resolve(getCachedData(cacheKey) || null);
  }

  // 500ms 内合并多次调用
  state.inflightPromise = new Promise((resolve, reject) => {
    state.timer = setTimeout(async () => {
      const toSend = state.pendingFiles;
      state.pendingFiles = {};
      state.timer = null;
      try {
        // 没有实际变更则不发送请求，直接返回缓存
        if (!toSend || Object.keys(toSend).length === 0) {
          resolve(getCachedData(cacheKey) || null);
          return;
        }
        const data = await githubApiRequestWithRetry(
          `https://api.github.com/gists/${gistId}`,
          {
            method: "PATCH",
            body: JSON.stringify({ files: toSend }),
          }
        );
        setCachedData(cacheKey, data);
        resolve(data);
      } catch (error) {
        console.error(`Error updating gist ${gistId}:`, error);
        reject(error);
      } finally {
        // 允许后续请求再次创建新的合并窗口
        state.inflightPromise = null;
      }
    }, 500);
  });

  _gistUpdateState.set(gistId, state);
  return state.inflightPromise;
}

export {
  githubApiRequest,
  githubApiRequestWithRetry,
  getGistData,
  updateGistData,
  getCachedData,
  setCachedData,
};
