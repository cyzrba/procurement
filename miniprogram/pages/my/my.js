/**
 * 我的页面（用户信息 + 消息通知 + 退出）
 */
const auth = require('../../utils/auth');
const cloud = require('../../utils/cloud');

Page({
  data: {
    userName: '',
    userPhone: '',
    initial: '',
    subscribedTemplates: [],
    _cachedTemplates: []
  },

  onLoad() {
    const user = auth.getUser();
    if (!user) return wx.reLaunch({ url: '/pages/login/login' });

    this.setData({
      userName: user.name,
      userPhone: user.phone || '',
      initial: user.name.charAt(0)
    });

    this.loadSubscriptionStatus();
  },

  loadSubscriptionStatus() {
    const stored = wx.getStorageSync('subscribed_templates');
    const templates = stored || [];
    this.setData({
      subscribedTemplates: templates,
      _cachedTemplates: templates
    });
  },

  // 跳转到消息通知页面
  goToMessages() {
    wx.navigateTo({ url: '/pages/messages/messages' });
  },

  // 微信通知开关切换
  handleSubscribeSwitch(e) {
    const isOn = e.detail.value;
    if (!isOn) {
      // 关闭开关 → 确认后取消订阅
      wx.showModal({
        title: '关闭通知',
        content: '关闭后您将不再收到微信通知，可在需要时重新开启',
        success: (res) => {
          if (res.confirm) {
            wx.setStorageSync('subscribed_templates', []);
            this.setData({
              subscribedTemplates: [],
              _cachedTemplates: []
            });
            cloud.updateSubscription([]).catch(() => {});
          } else {
            // 取消操作，恢复开关状态
            this.setData({ subscribedTemplates: this.data._cachedTemplates });
          }
        }
      });
    } else {
      // 打开开关 → 请求订阅授权
      this.handleRequestSubscribe();
    }
  },

  // 请求微信订阅消息授权
  handleRequestSubscribe() {
    const { SUBSCRIPTION_TEMPLATES } = require('../../config/subscription');
    const tmplIds = Object.values(SUBSCRIPTION_TEMPLATES).map(t => t.templateId);

    wx.requestSubscribeMessage({
      tmplIds,
      success: (res) => {
        const accepted = [];

        for (const [type, config] of Object.entries(SUBSCRIPTION_TEMPLATES)) {
          if (res[config.templateId] === 'accept') {
            accepted.push(type);
          }
        }

        if (accepted.length === 0) {
          wx.showToast({ title: '未同意任何订阅', icon: 'none' });
          return;
        }

        // 本地保存
        wx.setStorageSync('subscribed_templates', accepted);
        this.setData({
          subscribedTemplates: accepted,
          _cachedTemplates: accepted
        });

        // 同步到云端
        cloud.updateSubscription(accepted)
          .then(() => {
            wx.showToast({ title: '订阅成功', icon: 'success' });
          })
          .catch(() => {
            console.warn('订阅状态云端同步失败');
          });
      },
      fail: (err) => {
        if (err.errCode !== 20004) {
          wx.showToast({ title: '订阅请求失败', icon: 'none' });
        }
      }
    });
  },

  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          auth.logout();
        }
      }
    });
  }
});
