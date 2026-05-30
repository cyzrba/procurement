/**
 * 登录页
 */
const auth = require('../../utils/auth');
const cloud = require('../../utils/cloud');

Page({
  data: {
    loginMode: 'user',
    name: '',
    phone: '',
    username: '',
    password: '',
    loading: false,
    checkingAuth: true
  },

  onLoad(options) {
    if (options && options.from === 'logout') {
      this.setData({ checkingAuth: false });
    } else {
      this.autoLogin();
    }
  },

  autoLogin() {
    cloud.autoLogin()
      .then(user => {
        auth.save(user.token, {
          userId: user.userId,
          name: user.name,
          phone: user.phone,
          role: 'user'
        });
        wx.reLaunch({ url: '/pages/home/home' });
      })
      .catch(() => {
        this.setData({ checkingAuth: false });
      });
  },

  // 用户登录
  handleUserLogin() {
    const { name, phone } = this.data;
    if (!name.trim()) return wx.showToast({ title: '请输入姓名', icon: 'none' });
    if (!/^1\d{10}$/.test(phone)) return wx.showToast({ title: '请输入正确手机号', icon: 'none' });

    this.setData({ loading: true });
    cloud.userLogin(name.trim(), phone.trim())
      .then(user => {
        auth.save(user.token, { userId: user.userId, name: user.name, phone: user.phone, role: 'user' });
        wx.reLaunch({ url: '/pages/home/home' });
      })
      .catch(() => {})
      .finally(() => this.setData({ loading: false }));
  },

  // 管理员登录
  handleAdminLogin() {
    const { username, password } = this.data;
    if (!username.trim()) return wx.showToast({ title: '请输入用户名', icon: 'none' });
    if (!password) return wx.showToast({ title: '请输入密码', icon: 'none' });

    this.setData({ loading: true });
    cloud.adminLogin(username.trim(), password)
      .then(admin => {
        auth.save(admin.token, { userId: admin.userId, name: admin.username, role: 'admin' });
        wx.reLaunch({ url: '/pages/admin/dashboard/dashboard' });
      })
      .catch(() => {})
      .finally(() => this.setData({ loading: false }));
  },

  switchToAdmin() {
    this.setData({ loginMode: 'admin' });
  },

  switchToUser() {
    this.setData({ loginMode: 'user' });
  }
});
