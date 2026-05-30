/**
 * 首页（类目选择 + 预算区间选择）
 */
const auth = require('../../utils/auth');
const cloud = require('../../utils/cloud');

Page({
  data: {
    userName: '',
    initial: '',
    step: 1,
    categories: [],
    expandedCategory: null,
    selectedCategory: null,
    selectedCategoryName: '',
    priceRanges: [],
    selectedPriceRange: null
  },

  onLoad() {
    const user = auth.getUser();
    if (!user) return wx.reLaunch({ url: '/pages/login/login' });

    this.setData({
      userName: user.name,
      initial: user.name.charAt(0)
    });

    this.loadCategories();
  },

  // 加载类目列表
  loadCategories() {
    cloud.getCategories('active').then(list => {
      const icons = ['📋', '💻', '🏗️', '🚗', '🏥', '📚', '🔧', '🧪', '🖥️', '🛠️'];
      const enriched = list.map((c, i) => ({
        ...c,
        icon: icons[i % icons.length]
      }));
      this.setData({ categories: enriched });
    }).catch(() => {});
  },

  // 加载价格区间
  loadPriceRanges() {
    cloud.getPriceRanges(true).then(list => {
      list.forEach(item => {
        item.displayRange = `¥${Number(item.min).toLocaleString('zh-CN')} - ${item.max === Infinity ? '不限' : '¥' + Number(item.max).toLocaleString('zh-CN')}`;
      });
      this.setData({ priceRanges: list });
    }).catch(() => {});
  },

  // 选中类目 → 进入步骤2
  selectCategory(e) {
    const { id, name } = e.currentTarget.dataset;
    this.setData({
      selectedCategory: id,
      selectedCategoryName: name,
      selectedPriceRange: null,
      step: 2
    });
    this.loadPriceRanges();
  },

  // 展开/收起类目简介
  toggleExpand(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      expandedCategory: this.data.expandedCategory === id ? null : id
    });
  },

  // 选中价格区间
  selectPriceRange(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ selectedPriceRange: id });
  },

  backToStep1() {
    this.setData({ step: 1, selectedCategory: null, selectedCategoryName: '' });
  },

  // 查询指南
  handleSearch() {
    if (!this.data.selectedPriceRange) {
      return wx.showToast({ title: '请选择预算区间', icon: 'none' });
    }
    if (!this.data.selectedCategory) {
      return wx.showToast({ title: '请先选择采购类目', icon: 'none' });
    }

    const categoryId = this.data.selectedCategory;
    const priceRangeId = this.data.selectedPriceRange;

    console.log('[handleSearch] categoryId:', categoryId, 'priceRangeId:', priceRangeId);

    wx.showLoading({ title: '匹配指南中...' });
    cloud.matchGuides(categoryId, priceRangeId).then(result => {
      wx.hideLoading();
      wx.navigateTo({
        url: `/pages/guide-list/guide-list?data=${encodeURIComponent(JSON.stringify(result))}`
      });
    }).catch(err => {
      wx.hideLoading();
      console.error('[handleSearch] matchGuides err:', err);
      // cloud.js 内部已通过 wx.showToast 显示错误消息
    });
  },

  formatNum(n) {
    if (n === undefined || n === null) return '';
    if (n === Infinity) return '';
    return Number(n).toLocaleString('zh-CN');
  }
});
