import userData from 'src/assets/userName.js';
import { ref } from 'vue';

class AuthService {
  constructor() {
    this.currentUser = null;
    this.currentUserRef = ref(null); // 添加响应式引用
    this.initAuth();
  }

  // 初始化认证状态
  initAuth() {
    const savedUser = this.getCookie('currentUser');
    if (savedUser) {
      try {
        this.currentUser = JSON.parse(savedUser);
        this.currentUserRef.value = this.currentUser; // 同步更新响应式引用
        console.log('已从cookie恢复用户登录状态:', this.currentUser);
      } catch (error) {
        console.error('解析用户cookie失败:', error);
        this.clearAuth();
      }
    }
  }

    // 登录
  login(username) {
    const user = userData.userList.find(u => u.username === username);
    if (!user) {
      throw new Error('用户名不存在或无权限访问');
    }

    this.currentUser = {
      username: user.username,
      level: user.level,
      loginTime: new Date().toISOString()
    };

    // 同步更新响应式引用
    this.currentUserRef.value = this.currentUser;

    // 保存到cookie，有效期7天
    this.setCookie('currentUser', JSON.stringify(this.currentUser), 7);

    console.log('用户登录成功:', this.currentUser);
    return this.currentUser;
  }

  // 登出
  logout() {
    this.currentUser = null;
    this.currentUserRef.value = null; // 同步更新响应式引用
    this.deleteCookie('currentUser');
    console.log('用户已登出');
  }

  // 检查是否已登录
  isAuthenticated() {
    return this.currentUser !== null;
  }

  // 获取当前用户信息
  getCurrentUser() {
    return this.currentUser;
  }

  // 获取响应式的当前用户引用
  getCurrentUserRef() {
    return this.currentUserRef;
  }

  // 检查用户权限等级
  hasLevel(requiredLevel) {
    if (!this.currentUser) return false;
    return this.currentUser.level >= requiredLevel;
  }

  // Cookie操作方法
  setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
  }

  getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  }

  deleteCookie(name) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  }

  // 清除认证信息
  clearAuth() {
    this.currentUser = null;
    this.currentUserRef.value = null; // 同步更新响应式引用
    this.deleteCookie('currentUser');
  }
}

// 创建全局实例
const authService = new AuthService();

export default authService;
