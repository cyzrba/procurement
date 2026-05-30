/**
 * 指南详情页
 */
const cloud = require('../../utils/cloud');

Page({
  data: {
    loading: true,
    guide: null
  },

  onLoad(options) {
    const { id } = options;
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      return;
    }
    this.loadDetail(id);
  },

  loadDetail(guideId) {
    cloud.getGuideDetail(guideId).then(guide => {
      this.setData({ guide, loading: false });
      wx.setNavigationBarTitle({ title: guide.title || '指南详情' });
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  downloadFile(e) {
    const { fileid, name } = e.currentTarget.dataset;
    wx.showLoading({ title: '下载中...' });

    cloud.getTempFileURL([fileid]).then(fileList => {
      wx.hideLoading();
      if (fileList && fileList[0] && fileList[0].tempFileURL) {
        wx.downloadFile({
          url: fileList[0].tempFileURL,
          success: (res) => {
            wx.openDocument({ filePath: res.tempFilePath });
          },
          fail: () => {
            wx.showToast({ title: '下载失败', icon: 'none' });
          }
        });
      }
    }).catch(() => wx.hideLoading());
  },

  getFileIcon(name) {
    if (!name) return '📄';
    const ext = name.split('.').pop().toLowerCase();
    const map = { pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗', zip: '📦', rar: '📦', jpg: '🖼️', png: '🖼️' };
    return map[ext] || '📄';
  },

  formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / 1024 / 1024).toFixed(1) + 'MB';
  }
});
