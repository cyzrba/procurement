/**
 * 预算区间选择页
 */
const cloud = require('../../utils/cloud');

Page({
  data: {
    categoryId: '',
    categoryName: '',
    priceRanges: [],
    selectedPriceRange: null
  },

  onLoad(options) {
    const categoryId = options.categoryId || '';
    const categoryName = decodeURIComponent(options.categoryName || '');

    this.setData({ categoryId, categoryName });
    this.loadPriceRanges();
  },

  loadPriceRanges() {
    const categoryId = this.data.categoryId;
    cloud.getPriceRangesByCategory(categoryId, true).then(list => {
      if (!list || list.length === 0) {
        this.setData({ priceRanges: [] });
        return;
      }
      list.forEach(item => {
        item.displayRange = `¥${Number(item.min).toLocaleString('zh-CN')} - ${item.max === Infinity ? '不限' : '¥' + Number(item.max).toLocaleString('zh-CN')}`;
      });
      this.setData({ priceRanges: list });
    }).catch(() => {});
  },

  selectPriceRange(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ selectedPriceRange: id });
    this.handleSearch();
  },

  backToCategory() {
    wx.navigateBack();
  },

  handleSearch() {
    if (!this.data.selectedPriceRange) {
      return wx.showToast({ title: '请选择预算区间', icon: 'none' });
    }
    if (!this.data.categoryId) {
      return wx.showToast({ title: '请先选择采购类目', icon: 'none' });
    }

    const categoryId = this.data.categoryId;
    const priceRangeId = this.data.selectedPriceRange;

    wx.showLoading({ title: '匹配指南中...' });
    cloud.matchGuides(categoryId, priceRangeId).then(result => {
      wx.hideLoading();
      result.categoryName = this.data.categoryName;
      wx.navigateTo({
        url: `/pages/guide-list/guide-list?data=${encodeURIComponent(JSON.stringify(result))}`
      });
    }).catch(err => {
      wx.hideLoading();
      console.error('[handleSearch] matchGuides err:', err);
    });
  }
});
