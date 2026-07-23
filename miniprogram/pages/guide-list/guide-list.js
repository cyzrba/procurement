/**
 * 指南匹配结果列表
 */
const cloud = require('../../utils/cloud');

Page({
  data: {
    priceRange: {},
    guides: [],
    priceRangeText: '',
    categoryName: ''
  },

  onLoad(options) {
    try {
      const data = JSON.parse(decodeURIComponent(options.data));
      const pr = data.priceRange || {};
      const guides = (data.guides || []).map(g => ({
        ...g,
        isFavorited: false,
        _publishedText: g.publishedAt ? this._fmtDate(g.publishedAt) : '待发布'
      }));
      this.setData({
        priceRange: pr,
        guides,
        priceRangeText: pr.min !== undefined
          ? `¥${Number(pr.min).toLocaleString()} - ${pr.max === Infinity ? '不限' : '¥' + Number(pr.max).toLocaleString()}`
          : '',
        categoryName: data.categoryName || ''
      });
      this.loadFavoriteStatus();
    } catch (e) {
      wx.showToast({ title: '数据异常', icon: 'none' });
    }
  },

  _fmtDate(str) {
    try {
      const d = new Date(str);
      if (isNaN(d.getTime())) return str;
      const Y = d.getFullYear();
      const M = String(d.getMonth() + 1).padStart(2, '0');
      const D = String(d.getDate()).padStart(2, '0');
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${Y}-${M}-${D} ${h}:${m}`;
    } catch (e) {
      return str;
    }
  },

  loadFavoriteStatus() {
    const guideIds = this.data.guides.map(g => g._id);
    if (guideIds.length === 0) return;
    cloud.checkFavorites(guideIds).then(statusMap => {
      const guides = this.data.guides.map(g => ({
        ...g,
        isFavorited: !!statusMap[g._id]
      }));
      this.setData({ guides });
    }).catch(() => {});
  },

  toggleFav(e) {
    const { id, index } = e.currentTarget.dataset;
    cloud.toggleFavorite(id).then(res => {
      const guides = this.data.guides;
      guides[index].isFavorited = res.favorited;
      this.setData({ guides });
    }).catch(err => {
      console.error('[toggleFav] 失败:', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/guide-detail/guide-detail?id=${id}` });
  },

  goBack() {
    wx.navigateBack();
  }
});
