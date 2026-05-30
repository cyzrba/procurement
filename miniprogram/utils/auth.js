/**
 * 登录态管理
 */
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

const auth = {
  // 保存登录态
  save(token, user) {
    wx.setStorageSync(TOKEN_KEY, token);
    wx.setStorageSync(USER_KEY, JSON.stringify(user));
  },

  // 获取 token
  getToken() {
    return wx.getStorageSync(TOKEN_KEY) || '';
  },

  // 获取当前用户
  getUser() {
    const raw = wx.getStorageSync(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },

  // 是否已登录
  isLoggedIn() {
    return !!this.getToken();
  },

  // 是否为管理员
  isAdmin() {
    const user = this.getUser();
    return user && user.role === 'admin';
  },

  // 清除登录态
  logout() {
    wx.removeStorageSync(TOKEN_KEY);
    wx.removeStorageSync(USER_KEY);
    wx.reLaunch({ url: '/pages/login/login?from=logout' });
  }
};

module.exports = auth;
