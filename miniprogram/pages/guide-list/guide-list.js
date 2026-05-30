/**
 * 指南匹配结果列表
 */
const cloud = require('../../utils/cloud');

Page({
  data: {
    priceRange: {},
    guides: [],
    priceRangeText: ''
  },

  onLoad(options) {
    try {
      const data = JSON.parse(decodeURIComponent(options.data));
      const pr = data.priceRange || {};
      this.setData({
        priceRange: pr,
        guides: data.guides || [],
        priceRangeText: pr.min !== undefined
          ? `¥${Number(pr.min).toLocaleString()} - ${pr.max === Infinity ? '不限' : '¥' + Number(pr.max).toLocaleString()}`
          : ''
      });
    } catch (e) {
      wx.showToast({ title: '数据异常', icon: 'none' });
    }
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/guide-detail/guide-detail?id=${id}` });
  },

  goBack() {
    wx.navigateBack();
  }
});
