# URL用户名自动登录功能

## 功能概述

现在系统支持通过URL直接指定用户名来自动登录，并且在LoginPage登录后也会跳转到包含用户名的URL。当用户访问带有username参数的URL时，系统会：

1. 检查URL中的username参数
2. 验证该用户是否存在于用户列表中
3. 如果存在，自动登录该用户并覆盖之前的cookie
4. 如果不存在，跳转到登录页面

## 支持的URL格式

### 写作系统 (WritingLayout)
- `http://localhost:9000/ruby` - 以ruby用户身份访问写作系统
- `http://localhost:9000/oreo` - 以oreo用户身份访问写作系统
- `http://localhost:9000/husky` - 以husky用户身份访问写作系统
- `http://localhost:9000/coco` - 以coco用户身份访问写作系统

### 评分标准系统 (RubricLayout)
- `http://localhost:9000/rubric-maker/ruby` - 以ruby用户身份访问评分标准制作系统
- `http://localhost:9000/rubric-maker/oreo` - 以oreo用户身份访问评分标准制作系统
- `http://localhost:9000/rubric-maker/husky` - 以husky用户身份访问评分标准制作系统
- `http://localhost:9000/rubric-maker/coco` - 以coco用户身份访问评分标准制作系统

### 登录页面跳转
- `http://localhost:9000/login?redirect=writing` - 登录后跳转到写作系统（/用户名）
- `http://localhost:9000/login?redirect=rubric-maker` - 登录后跳转到评分标准系统（/rubric-maker/用户名）

## 用户权限级别

| 用户名 | 权限等级 | 描述 |
|--------|----------|------|
| ruby   | Level 1  | 自我反思模式 - Self-Reflection with Rubric |
| oreo   | Level 2  | 基础反馈模式 - LLM Feedback without Rubric |
| husky  | Level 3  | 中级反馈模式 - LLM Feedback with Rubric |
| coco   | Level 4  | 完整系统模式 - Intelligible Rubric Feedback |

## 功能特性

### 1. 直接URL访问
- 通过URL直接指定用户名自动登录
- 覆盖之前的cookie，实现强制用户切换
- 无效用户名自动跳转到登录页面

### 2. 登录页面智能跳转
- 从不同系统页面跳转到登录页时会记录来源
- 登录成功后自动跳转到包含用户名的正确URL
- 支持写作系统和评分标准系统的智能跳转

### 3. 认证状态管理
- 两个路由系统共享同一套认证服务
- 已登录用户访问登录页会自动跳转到用户首页
- 未认证用户访问保护页面会记录来源并跳转到登录页

## 测试方法

### 1. 启动开发服务器
```bash
npm run dev
# 或者
quasar dev
```

### 2. 打开测试页面
在浏览器中访问 `file:///home/bai/diverse-feedback-llm/test_url_auth.html`

### 3. 测试直接URL访问
- 点击任何有效用户链接，应该自动登录对应的用户
- 不管之前登录的是哪个用户，都会被URL中的用户覆盖
- 点击无效用户链接，应该跳转到登录页面

### 4. 测试登录页面跳转
- 访问 `http://localhost:9000/login?redirect=writing` 或 `http://localhost:9000/login?redirect=rubric-maker`
- 输入用户名（ruby/oreo/husky/coco）登录
- 验证是否跳转到 `/用户名` 或 `/rubric-maker/用户名`

### 5. 测试未认证访问
- 清除浏览器cookie
- 访问 `http://localhost:9000/` 或 `http://localhost:9000/rubric-maker`
- 应该自动跳转到带redirect参数的登录页面
- 登录后会跳转到带用户名的URL

### 6. 验证功能
- 检查页面顶部的用户信息显示是否正确
- 检查不同权限等级的用户看到的界面是否不同
- 检查浏览器的开发者工具控制台，查看路由守卫的日志

## 技术实现

### 路由配置
```javascript
// src/router/routes.js
const routes = [
  {
    path: "/login",
    name: "Login",
    component: () => import("src/pages/LoginPage.vue"),
    meta: { requiresAuth: false }
  },
  {
    path: "/rubric-maker",
    name: "RubricMaker",
    component: () => import("src/layouts/RubricLayout.vue"),
    meta: { requiresAuth: true }
  },
  {
    path: "/rubric-maker/:username",
    name: "RubricMakerWithUser",
    component: () => import("src/layouts/RubricLayout.vue"),
    meta: { requiresAuth: true }
  },
  {
    path: "/",
    component: () => import("src/layouts/WritingLayout.vue"),
    name: "Writing",
    meta: { requiresAuth: true },
  },
  {
    path: "/:username",
    component: () => import("src/layouts/WritingLayout.vue"),
    name: "WritingWithUser",
    meta: { requiresAuth: true },
  }
];
```

### 路由守卫
```javascript
// src/router/index.js
Router.beforeEach((to, from, next) => {
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth !== false);
  const isAuthenticated = authService.isAuthenticated();
  const urlUsername = to.params.username;

  // 检查URL中是否有username参数
  if (urlUsername) {
    const userExists = userData.userList.find(user => user.username === urlUsername);

    if (userExists) {
      // 用户存在，自动登录（覆盖之前的cookie）
      authService.login(urlUsername);
      next();
    } else {
      // 用户不存在，跳转到登录页，记录来源
      const redirectTo = to.path.includes('/rubric-maker') ? 'rubric-maker' : 'writing';
      next(`/login?redirect=${redirectTo}`);
    }
  } else {
    // 原来的认证逻辑
    if (requiresAuth && !isAuthenticated) {
      // 需要认证但未登录，跳转到登录页，记录来源
      const redirectTo = to.path.includes('/rubric-maker') ? 'rubric-maker' : 'writing';
      next(`/login?redirect=${redirectTo}`);
    } else if (to.path === '/login' && isAuthenticated) {
      // 已登录用户访问登录页，重定向到用户首页
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        next(`/${currentUser.username}`);
      } else {
        next('/');
      }
    } else {
      next();
    }
  }
});
```

### 登录页面跳转逻辑
```javascript
// src/pages/LoginPage.vue
const handleLogin = async () => {
  try {
    const user = authService.login(username.value.trim());

    // 根据redirect参数决定跳转目标
    const redirectTo = route.query.redirect || 'writing';
    let targetUrl;

    if (redirectTo === 'rubric-maker') {
      targetUrl = `/rubric-maker/${user.username}`;
    } else {
      targetUrl = `/${user.username}`;
    }

    // 延迟跳转，让用户看到成功消息
    setTimeout(() => {
      router.push(targetUrl);
    }, 1000);
  } catch (error) {
    // 错误处理
  }
};
```

## 完整的用户流程

### 场景1：直接URL访问
1. 用户访问 `http://localhost:9000/ruby`
2. 系统检查URL中的username参数
3. 验证ruby用户存在于用户列表中
4. 自动登录ruby用户（覆盖之前的cookie）
5. 显示ruby用户的写作界面

### 场景2：未认证用户访问
1. 未认证用户访问 `http://localhost:9000/rubric-maker`
2. 路由守卫检测到需要认证但未登录
3. 跳转到 `http://localhost:9000/login?redirect=rubric-maker`
4. 用户在登录页面输入用户名并登录
5. 系统读取redirect参数，跳转到 `/rubric-maker/用户名`

### 场景3：已登录用户访问登录页
1. 已登录用户访问 `http://localhost:9000/login`
2. 路由守卫检测到已登录
3. 自动跳转到 `http://localhost:9000/用户名`

## 注意事项

1. **路由顺序重要**：确保具体路由（如 `/rubric-maker`）在动态路由（如 `/:username`）之前定义
2. **用户数据验证**：只有在 `src/assets/userName.js` 的 `userList` 中的用户才能自动登录
3. **Cookie覆盖**：URL中的用户名会覆盖之前的cookie，实现强制切换用户
4. **共享认证**：两个路由系统使用同一套认证服务，用户状态是共享的
5. **智能跳转**：系统会根据用户来源智能决定登录后的跳转目标

## 调试信息

在浏览器的开发者工具控制台中，可以看到路由守卫的详细日志：
- 访问的路径
- 是否需要认证
- 当前认证状态
- URL中的用户名
- 当前用户信息
- 跳转目标URL
- redirect参数

这些信息有助于调试和验证功能是否正常工作。
