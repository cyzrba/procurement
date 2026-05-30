/**
 * 类目管理
 */
const cloud = require('../../../utils/cloud');

Page({
  data: {
    list: [],
    showModal: false,
    editing: null,
    formName: '',
    formDesc: ''
  },

  onLoad() {
    this.loadList();
  },

  onShow() {
    this.loadList();
  },

  loadList() {
    cloud.getCategories().then(list => this.setData({ list }));
  },

  showCreate() {
    this.setData({ showModal: true, editing: null, formName: '', formDesc: '' });
  },

  showEdit(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      showModal: true,
      editing: item,
      formName: item.name,
      formDesc: item.description || ''
    });
  },

  closeModal() {
    this.setData({ showModal: false });
  },

  handleSave() {
    if (!this.data.formName.trim()) {
      return wx.showToast({ title: '请输入类目名称', icon: 'none' });
    }

    if (this.data.editing) {
      cloud.updateCategory(this.data.editing._id, {
        name: this.data.formName.trim(),
        description: this.data.formDesc.trim()
      }).then(() => {
        wx.showToast({ title: '更新成功' });
        this.closeModal();
        this.loadList();
      });
    } else {
      cloud.createCategory(this.data.formName.trim(), this.data.formDesc.trim()).then(() => {
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
      content: '删除后不可恢复，确定继续？',
      success: (res) => {
        if (res.confirm) {
          cloud.deleteCategory(id).then(() => {
            wx.showToast({ title: '已删除' });
            this.loadList();
          });
        }
      }
    });
  }
});
