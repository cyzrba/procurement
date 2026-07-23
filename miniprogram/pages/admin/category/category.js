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
    formDesc: '',
    formMedia: [],
    _mediaDisplay: []
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
    this.setData({
      showModal: true,
      editing: null,
      formName: '',
      formDesc: '',
      formMedia: [],
      _mediaDisplay: []
    });
  },

  showEdit(e) {
    const item = e.currentTarget.dataset.item;
    const media = (item.media || []).map(m => ({
      name: m.name, fileId: m.fileId, size: m.size, type: m.type
    }));
    this.setData({
      showModal: true,
      editing: item,
      formName: item.name,
      formDesc: item.description || '',
      formMedia: media
    });
    this.syncMediaDisplay();
  },

  closeModal() {
    this.setData({ showModal: false });
  },

  chooseAttachment() {
    wx.chooseMessageFile({
      count: 5,
      type: 'file',
      success: (res) => {
        const files = res.tempFiles.filter(f => {
          const ext = (f.name || '').split('.').pop().toLowerCase();
          if (!['pdf', 'doc', 'docx', 'xls', 'xlsx'].includes(ext)) {
            wx.showToast({ title: `${f.name} 格式不支持，仅支持 PDF、Word、Excel 文档`, icon: 'none' });
            return false;
          }
          return true;
        });
        if (files.length === 0) return;
        this.uploadFiles(files);
      }
    });
  },

  uploadFiles(files) {
    wx.showLoading({ title: '上传中...' });

    const uploads = files.map(file => {
      const dotIdx = file.name.lastIndexOf('.');
      const ext = dotIdx > -1 ? file.name.slice(dotIdx) : '';
      const cloudPath = `documents/${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;

      return wx.cloud.uploadFile({
        cloudPath,
        filePath: file.path
      }).then(uploadRes => ({
        name: file.name,
        fileId: uploadRes.fileID,
        size: file.size || 0,
        type: 'document'
      }));
    });

    Promise.all(uploads).then(results => {
      wx.hideLoading();
      const media = [...(this.data.formMedia || []), ...results];
      this.setData({ formMedia: media });
      this.syncMediaDisplay();
      wx.showToast({ title: `已上传 ${results.length} 个文件`, icon: 'success' });
    }).catch(err => {
      wx.hideLoading();
      console.error('[upload error]', err);
      wx.showToast({ title: '上传失败', icon: 'none' });
    });
  },

  syncMediaDisplay() {
    const display = (this.data.formMedia || []).map(m => ({
      ...m,
      icon: this.getFileIcon(m.name),
      sizeDisplay: this.formatSize(m.size)
    }));
    this.setData({ _mediaDisplay: display });
  },

  removeMedia(e) {
    const midx = e.currentTarget.dataset.midx;
    const media = this.data.formMedia;
    media.splice(midx, 1);
    this.setData({ formMedia: media });
    this.syncMediaDisplay();
  },

  formatSize(bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / 1024 / 1024).toFixed(1) + 'MB';
  },

  getFileIcon(name) {
    if (!name) return '📄';
    const ext = name.split('.').pop().toLowerCase();
    const map = { pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗' };
    return map[ext] || '📄';
  },

  handleSave() {
    if (!this.data.formName.trim()) {
      return wx.showToast({ title: '请输入类目名称', icon: 'none' });
    }

    const media = (this.data.formMedia || []).map(m => ({
      name: m.name,
      fileId: m.fileId,
      size: m.size,
      type: m.type
    }));

    if (this.data.editing) {
      cloud.updateCategory(this.data.editing._id, {
        name: this.data.formName.trim(),
        description: this.data.formDesc.trim(),
        media
      }).then(() => {
        wx.showToast({ title: '更新成功' });
        this.closeModal();
        this.loadList();
      });
    } else {
      cloud.createCategory(this.data.formName.trim(), this.data.formDesc.trim(), media).then(() => {
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