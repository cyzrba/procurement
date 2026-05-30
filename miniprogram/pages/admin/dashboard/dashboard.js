/**
 * 管理首页
 */
const auth = require('../../../utils/auth');

Page({
  data: {
    adminName: ''
  },

  onLoad() {
    const user = auth.getUser();
    if (!user || user.role !== 'admin') {
      return wx.reLaunch({ url: '/pages/login/login' });
    }
    this.setData({ adminName: user.name });
  },

  goTo(e) {
    const page = e.currentTarget.dataset.page;
    wx.navigateTo({ url: `/pages/admin/${page}/${page}` });
  },

  handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出管理后台吗？',
      success: (res) => {
        if (res.confirm) auth.logout();
      }
    });
  }
});
