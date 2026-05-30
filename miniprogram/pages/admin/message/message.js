/**
 * 消息推送管理
 */
const cloud = require('../../../utils/cloud');
const auth = require('../../../utils/auth');

Page({
  data: {
    list: [],
    showModal: false,
    formTitle: '',
    formContent: '',
    formTypeIdx: 0,
    formTargetIdx: 0,
    sendingSubscription: false
  },

  onLoad() { this.loadList(); },

  loadList() {
    cloud.getMessages(1, 50).then(result => {
      this.setData({ list: result.list || [] });
    });
  },

  showCreate() {
    this.setData({
      showModal: true,
      formTitle: '', formContent: '', formTypeIdx: 0, formTargetIdx: 0
    });
  },

  closeModal() { this.setData({ showModal: false }); },

  pickType(e) { this.setData({ formTypeIdx: e.detail.value }); },
  pickTarget(e) { this.setData({ formTargetIdx: e.detail.value }); },

  handleSend() {
    const { formTitle, formContent, formTypeIdx, formTargetIdx } = this.data;
    if (!formTitle.trim() || !formContent.trim()) {
      return wx.showToast({ title: '标题和内容不能为空', icon: 'none' });
    }

    const admin = auth.getUser();
    const types = ['announcement', 'guide_update'];

    cloud.createMessage({
      title: formTitle.trim(),
      content: formContent.trim(),
      type: types[formTypeIdx],
      targetType: formTargetIdx === 0 ? 'all' : 'specific',
      targetUserIds: [],
      createdBy: admin ? admin.userId : ''
    }).then(() => {
      wx.showToast({ title: '发送成功' });
      this.closeModal();
      this.loadList();
    });
  },

  handleSendSubscription(e) {
    const messageId = e.currentTarget.dataset.id;
    const message = this.data.list.find(m => m._id === messageId);
    if (!message) return;

    wx.showModal({
      title: '发送订阅通知',
      content: `将通过微信订阅消息向已订阅的用户推送「${message.title}」吗？`,
      success: (res) => {
        if (!res.confirm) return;

        this.setData({ sendingSubscription: true });

        cloud.sendSubscriptionMessage(messageId)
          .then(result => {
            wx.showToast({
              title: `发送完成：共 ${result.total} 名，成功 ${result.sent} 条`,
              icon: 'success',
              duration: 3000
            });
            if (result.failed > 0) {
              console.warn(`订阅发送失败 ${result.failed} 条:`, result.errors);
            }
          })
          .catch(err => {
            wx.showToast({ title: err.message || '发送失败', icon: 'none' });
          })
          .finally(() => {
            this.setData({ sendingSubscription: false });
          });
      }
    });
  },

  formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const M = String(d.getMonth()+1).padStart(2,'0');
    const D = String(d.getDate()).padStart(2,'0');
    const h = String(d.getHours()).padStart(2,'0');
    const m = String(d.getMinutes()).padStart(2,'0');
    return `${M}-${D} ${h}:${m}`;
  }
});
