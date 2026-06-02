const cloud = require('../../utils/cloud');

Page({
  data: {
    categories: [],
    selectedCategoryId: '',
    guides: [],
    filteredGuides: []
  },

  onLoad() {
    this.loadCategories();
  },

  onShow() {
    this.loadFavorites();
  },

  loadCategories() {
    cloud.getCategories('active').then(list => {
      const selectedCategoryId = list.length > 0 ? list[0]._id : '';
      this.setData({ categories: list, selectedCategoryId });
      this.applyFilter();
    }).catch(() => {});
  },

  loadFavorites() {
    cloud.getFavorites().then(list => {
      list.sort((a, b) => {
        const da = a.favoritedAt ? new Date(a.favoritedAt).getTime() : 0;
        const db = b.favoritedAt ? new Date(b.favoritedAt).getTime() : 0;
        return db - da;
      });
      this.setData({ guides: list });
      this.applyFilter();
    }).catch(() => {});
  },

  applyFilter() {
    const { guides, selectedCategoryId } = this.data;
    if (!selectedCategoryId) {
      this.setData({ filteredGuides: guides });
    } else {
      this.setData({
        filteredGuides: guides.filter(g => g.categoryId === selectedCategoryId)
      });
    }
  },

  selectCategory(e) {
    this.setData({ selectedCategoryId: e.currentTarget.dataset.id });
    this.applyFilter();
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/guide-detail/guide-detail?id=${id}` });
  },

  removeFav(e) {
    const { id, index } = e.currentTarget.dataset;
    const guide = this.data.filteredGuides[index];
    cloud.toggleFavorite(id).then(() => {
      const guides = this.data.guides.filter(g => g._id !== guide._id);
      this.setData({ guides });
      this.applyFilter();
      wx.showToast({ title: '已取消收藏', icon: 'none' });
    }).catch(() => {});
  }
});
