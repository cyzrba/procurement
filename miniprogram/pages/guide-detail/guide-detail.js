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
    wx.showLoading({ title: '加载中...' });
    cloud.getGuideDetail(guideId).then(guide => {
      if (guide.publishedAt) {
        guide._publishedText = this._fmtDate(guide.publishedAt);
      }
      this.enrichMedia(guide).then(enriched => {
        wx.hideLoading();
        this.setData({ guide: enriched, loading: false });
        wx.setNavigationBarTitle({ title: guide.title || '指南详情' });
      });
    }).catch(() => {
      wx.hideLoading();
      this.setData({ loading: false });
    });
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

  enrichMedia(guide) {
    const steps = guide.processSteps || [];
    const allFileIds = [];
    steps.forEach(step => {
      (step.media || []).forEach(m => { if (m.fileId) allFileIds.push(m.fileId); });
      (step.groups || []).forEach(g => {
        (g.media || []).forEach(m => { if (m.fileId) allFileIds.push(m.fileId); });
      });
    });
    // 收集前期准备的媒体文件ID
    const prepMedia = (guide.preparation && guide.preparation.media) || [];
    prepMedia.forEach(m => { if (m.fileId) allFileIds.push(m.fileId); });

    // 无论是否有媒体，先设置基础富化属性（WXML 依赖 _preparationContent / _preparationMedia / _processSteps）
    guide._preparationContent = typeof guide.preparation === 'string' ? guide.preparation : (guide.preparation && guide.preparation.content || '');
    guide._preparationMedia = { _imageUrls: [], _videoItems: [], _documents: [] };
    guide._processSteps = steps.map(step => {
      const hasGroups = !!(step.groups && step.groups.length > 0);
      if (hasGroups) {
        return {
          ...step,
          _hasGroups: true,
          _groups: (step.groups || []).map(g => ({ ...g, _imageUrls: [], _videoItems: [], _documents: [] })),
          _imageUrls: [], _videoItems: [], _documents: []
        };
      }
      return { ...step, _hasGroups: false, _imageUrls: [], _videoItems: [], _documents: [] };
    });

    if (allFileIds.length === 0) return Promise.resolve(guide);

    return cloud.getTempFileURL(allFileIds).then(fileList => {
      const urlMap = {};
      (fileList || []).forEach(f => {
        if (f.fileID && f.tempFileURL) urlMap[f.fileID] = f.tempFileURL;
      });

      // 分类前期准备的媒体（覆盖初始空值）
      const prepImageUrls = [];
      const prepVideoItems = [];
      const prepDocuments = [];
      prepMedia.forEach(m => {
        const url = urlMap[m.fileId] || m.fileId;
        if (m.type === 'image') prepImageUrls.push(url);
        else if (m.type === 'video') prepVideoItems.push({ ...m, url });
        else prepDocuments.push({ ...m, url });
      });
      guide._preparationMedia = { _imageUrls: prepImageUrls, _videoItems: prepVideoItems, _documents: prepDocuments };

      // 重新构建 _processSteps（含媒体 URL，覆盖初始空值）
      guide._processSteps = steps.map(step => {
        const hasGroups = !!(step.groups && step.groups.length > 0);

        if (hasGroups) {
          // 处理步骤级媒体（步骤全局附件）
          const stepMedia = step.media || [];
          const stepImageUrls = [];
          const stepVideoItems = [];
          const stepDocuments = [];

          stepMedia.forEach(m => {
            const url = urlMap[m.fileId] || m.fileId;
            if (m.type === 'image') stepImageUrls.push(url);
            else if (m.type === 'video') stepVideoItems.push({ ...m, url });
            else stepDocuments.push({ ...m, url });
          });

          // 处理子项级媒体
          const enrichedGroups = (step.groups || []).map(g => {
            const media = g.media || [];
            const imageUrls = [];
            const videoItems = [];
            const documents = [];

            media.forEach(m => {
              const url = urlMap[m.fileId] || m.fileId;
              if (m.type === 'image') imageUrls.push(url);
              else if (m.type === 'video') videoItems.push({ ...m, url });
              else documents.push({ ...m, url });
            });

            return {
              ...g,
              _imageUrls: imageUrls,
              _videoItems: videoItems,
              _documents: documents
            };
          });

          return {
            ...step,
            _hasGroups: true,
            _groups: enrichedGroups,
            _imageUrls: stepImageUrls,
            _videoItems: stepVideoItems,
            _documents: stepDocuments
          };
        }

        const media = step.media || [];
        const imageUrls = [];
        const videoItems = [];
        const documents = [];

        media.forEach(m => {
          const url = urlMap[m.fileId] || m.fileId;
          if (m.type === 'image') imageUrls.push(url);
          else if (m.type === 'video') videoItems.push({ ...m, url });
          else documents.push({ ...m, url });
        });

        return {
          ...step,
          _hasGroups: false,
          _imageUrls: imageUrls,
          _videoItems: videoItems,
          _documents: documents
        };
      });

      return guide;
    }).catch(() => Promise.resolve(guide));
  },

  previewImage(e) {
    const { urls, current } = e.currentTarget.dataset;
    if (urls && urls.length > 0) {
      wx.previewImage({ urls, current: current || urls[0] });
    }
  },

  openDocMenu(e) {
    const { fileid, name } = e.currentTarget.dataset;
    const ext = (name || '').split('.').pop().toLowerCase();

    // 先下载文件，下载完再弹菜单，确保分享时文件已就绪
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

            // 文件已就绪，弹菜单（此时用户的手势可以直接触发 shareFileMessage）
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
    const map = { pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗', zip: '📦', rar: '📦', jpg: '🖼️', png: '🖼️' };
    return map[ext] || '📄';
  },

  formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / 1024 / 1024).toFixed(1) + 'MB';
  },

  saveVideo(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;

    const doSave = () => {
      wx.showLoading({ title: '下载中...' });
      wx.downloadFile({
        url,
        success: (res) => {
          wx.hideLoading();
          wx.saveVideoToPhotosAlbum({
            filePath: res.tempFilePath,
            success: () => {
              wx.showToast({ title: '已保存到相册' });
            },
            fail: (err) => {
              if (err.errMsg && err.errMsg.includes('auth deny')) {
                wx.showModal({
                  title: '提示',
                  content: '需要相册权限才能保存视频，是否去设置？',
                  success: (m) => { if (m.confirm) wx.openSetting(); }
                });
              } else {
                wx.showToast({ title: '保存失败', icon: 'none' });
              }
            }
          });
        },
        fail: () => {
          wx.hideLoading();
          wx.showToast({ title: '下载失败', icon: 'none' });
        }
      });
    };

    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.writePhotosAlbum']) {
          doSave();
        } else {
          wx.authorize({
            scope: 'scope.writePhotosAlbum',
            success: doSave,
            fail: () => {
              wx.showModal({
                title: '提示',
                content: '需要授权保存到相册，是否去设置？',
                success: (m) => { if (m.confirm) wx.openSetting(); }
              });
            }
          });
        }
      }
    });
  }
});
