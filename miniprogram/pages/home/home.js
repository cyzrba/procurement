/**
 * 首页（类目选择）
 */
const auth = require('../../utils/auth');
const cloud = require('../../utils/cloud');

Page({
  data: {
    userName: '',
    initial: '',
    categories: [],
    selectedCategory: null,
    selectedCategoryName: ''
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

  onShow() {
    this.setData({ selectedCategory: null, selectedCategoryName: '' });
  },

  loadCategories() {
    cloud.getCategories('active').then(list => {
      const enriched = list.map((c) => ({
        ...c,
        media: c.media || []
      }));
      this.setData({ categories: enriched }, () => {
        this.enrichAllCategoryMedia();
      });
    }).catch(() => {});
  },

  enrichAllCategoryMedia() {
    const categories = this.data.categories;
    const allFileIds = [];
    categories.forEach(cat => {
      (cat.media || []).forEach(m => {
        if (m.fileId) allFileIds.push(m.fileId);
      });
    });

    if (allFileIds.length === 0) return;

    cloud.getTempFileURL(allFileIds).then(fileList => {
      const urlMap = {};
      (fileList || []).forEach(f => {
        if (f.fileID && f.tempFileURL) urlMap[f.fileID] = f.tempFileURL;
      });

      const enriched = categories.map(cat => {
        const media = cat.media || [];
        if (media.length === 0) {
          cat._documents = [];
          return cat;
        }
        cat._documents = media.map(m => ({
          ...m,
          url: urlMap[m.fileId] || m.fileId
        }));
        return cat;
      });

      this.setData({ categories: enriched });
    }).catch(() => {});
  },

  selectCategory(e) {
    const { id, name } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/price-range-select/price-range-select?categoryId=${id}&categoryName=${encodeURIComponent(name)}`
    });
  },

  openDocMenu(e) {
    const { fileid, name } = e.currentTarget.dataset;
    const ext = (name || '').split('.').pop().toLowerCase();

    wx.showLoading({ title: '加载中...' });
    cloud.getTempFileURL([fileid]).then(fileList => {
      if (!fileList || !fileList[0] || !fileList[0].tempFileURL) {
        wx.hideLoading();
        return;
      }
      const tempURL = fileList[0].tempFileURL;
      wx.downloadFile({
        url: tempURL,
        success: (res) => {
          const savedPath = `${wx.env.USER_DATA_PATH}/doc_${Date.now()}.${ext}`;
          try {
            const fs = wx.getFileSystemManager();
            fs.copyFileSync(res.tempFilePath, savedPath);
            wx.hideLoading();

            wx.showActionSheet({
              itemList: ['预览', '复制下载链接', '分享给朋友'],
              success: (act) => {
                if (act.tapIndex === 0) {
                  wx.openDocument({ filePath: savedPath, fileType: ext });
                } else if (act.tapIndex === 1) {
                  wx.setClipboardData({
                    data: tempURL,
                    success: () => {
                      wx.showModal({
                        title: '链接已复制',
                        content: '下载链接已复制到剪贴板，请打开手机浏览器粘贴并打开',
                        showCancel: false
                      });
                    }
                  });
                } else {
                  wx.shareFileMessage({
                    filePath: savedPath,
                    fileName: name,
                    fail: (err) => {
                      console.error('[shareFile fail]', JSON.stringify(err));
                      wx.setClipboardData({
                        data: tempURL,
                        success: () => {
                          wx.showModal({
                            title: '分享暂不可用',
                            content: '已复制下载链接，可粘贴到微信聊天发送给朋友',
                            showCancel: false
                          });
                        }
                      });
                    }
                  });
                }
              }
            });
          } catch (e) {
            wx.hideLoading();
            console.error('[copyFile fail]', e);
            wx.showToast({ title: '文件准备失败', icon: 'none' });
          }
        },
        fail: () => { wx.hideLoading(); wx.showToast({ title: '下载失败', icon: 'none' }); }
      });
    }).catch(() => wx.hideLoading());
  },

  getFileIcon(name) {
    if (!name) return '📄';
    const ext = name.split('.').pop().toLowerCase();
    const map = { pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗', zip: '📦', rar: '📦' };
    return map[ext] || '📄';
  },

  formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / 1024 / 1024).toFixed(1) + 'MB';
  }
});