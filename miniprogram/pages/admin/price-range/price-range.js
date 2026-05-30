/**
 * 价格区间管理
 */
const cloud = require('../../../utils/cloud');

Page({
  data: {
    list: [],
    showModal: false,
    editing: null,
    formLabel: '',
    formMin: '',
    formMax: '',
    formEnabled: true
  },

  onLoad() { this.loadList(); },
  onShow() { this.loadList(); },

  loadList() {
    cloud.getPriceRanges().then(list => {
      list.forEach(item => {
        item.displayRange = `¥${Number(item.min).toLocaleString('zh-CN')} - ${item.max === Infinity ? '不限' : '¥' + Number(item.max).toLocaleString('zh-CN')}`;
      });
      this.setData({ list });
    });
  },

  showCreate() {
    this.setData({
      showModal: true, editing: null,
      formLabel: '', formMin: '', formMax: '', formEnabled: true
    });
  },

  showEdit(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      showModal: true, editing: item,
      formLabel: item.label,
      formMin: String(item.min),
      formMax: item.max === Infinity ? '' : String(item.max),
      formEnabled: item.enabled
    });
  },

  closeModal() { this.setData({ showModal: false }); },

  toggleEnabled(e) {
    this.setData({ formEnabled: e.detail.value });
  },

  handleSave() {
    const { formLabel, formMin, formMax, formEnabled } = this.data;
    if (!formLabel.trim() || !formMin) {
      return wx.showToast({ title: '请填写完整信息', icon: 'none' });
    }

    const data = {
      label: formLabel.trim(),
      min: Number(formMin),
      max: formMax ? Number(formMax) : Infinity,
      enabled: formEnabled
    };

    if (this.data.editing) {
      cloud.updatePriceRange(this.data.editing._id, data).then(() => {
        wx.showToast({ title: '更新成功' });
        this.closeModal();
        this.loadList();
      });
    } else {
      cloud.createPriceRange(data).then(() => {
        wx.showToast({ title: '创建成功' });
        this.closeModal();
        this.loadList();
      });
    }
  },

  handleDelete(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定删除该价格区间？',
      success: (res) => {
        if (res.confirm) {
          cloud.deletePriceRange(id).then(() => {
            wx.showToast({ title: '已删除' });
            this.loadList();
          });
        }
      }
    });
  },

  formatNum(n) {
    return Number(n).toLocaleString('zh-CN');
  }
});
