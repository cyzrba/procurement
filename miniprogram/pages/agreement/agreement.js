/**
 * 用户服务协议页面
 */
Page({
  goBack() {
    wx.navigateBack({
      delta: 1,
      fail: () => wx.reLaunch({ url: '/pages/login/login' })
    });
  }
});
