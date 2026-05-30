/**
 * 消息通知页面
 */
const cloud = require('../../utils/cloud');

Page({
  data: {
    list: [],
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false
  },

  onLoad() {
    this.loadMessages();
  },

  loadMessages() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });

    return cloud.getMessages(this.data.page, this.data.pageSize).then(result => {
      const list = [...this.data.list, ...result.list];
      this.setData({
        list,
        page: this.data.page + 1,
        hasMore: list.length < result.total,
        loading: false
      });
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  loadMore() {
    this.loadMessages();
  },

  onPullDownRefresh() {
    this.setData({ page: 1, list: [], hasMore: true });
    this.loadMessages().then(() => wx.stopPullDownRefresh());
  },

  formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${M}-${D} ${h}:${m}`;
  }
});
