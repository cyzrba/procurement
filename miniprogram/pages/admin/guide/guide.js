/**
 * 采购指南管理
 */
const cloud = require('../../../utils/cloud');
const auth = require('../../../utils/auth');

Page({
  data: {
    list: [],
    statusOptions: ['全部', '草稿 draft', '已发布 published', '已下架 unpublished'],
    statusIdx: 0,
    statusMap: { draft: '草稿', published: '已发布', unpublished: '已下架' },
    showModal: false,
    editingId: null,
    categories: [],
    priceRanges: [],
    categoryOptions: [],        // 含 "请选择" 占位
    priceRangeOptions: [],      // 含 "请选择" 占位
    formCategoryIdx: 0,         // 0 = 未选择
    formPriceIdx: 0,            // 0 = 未选择
    formTitle: '',
    formCover: '',
    formCoverPreview: '',       // 预览用临时 URL
    formContent: '',
    formAttachments: '[]',      // JSON 字符串
    formAttachmentList: [],     // 解析后的附件数组（含图标）
    uploadLoading: false
  },

  onLoad() {
    this.loadList();
    this.loadOptions();
  },

  onShow() { this.loadList(); },

  loadList() {
    const params = {};
    const statusMap = ['', 'draft', 'published', 'unpublished'];
    const status = statusMap[this.data.statusIdx];
    if (status) params.status = status;

    cloud.getGuides(params).then(result => {
      this.setData({ list: result.list || [] });
    }).catch(() => {});
  },

  loadOptions() {
    wx.showLoading({ title: '加载中...' });
    Promise.all([
      cloud.getCategories().catch(() => []),
      cloud.getPriceRanges().catch(() => [])
    ]).then(([categories, priceRanges]) => {
      wx.hideLoading();
      this.setData({
        categories: categories || [],
        categoryOptions: ['-- 请选择类目 --', ...(categories || []).map(
          c => `${c.name}${c.description ? ' - ' + c.description : ''}`
        )],
        priceRanges: priceRanges || [],
        priceRangeOptions: ['-- 请选择价格区间 --', ...(priceRanges || []).map(p => p.label)]
      });
    }).catch(() => {
      wx.hideLoading();
    });
  },

  filterByStatus(e) {
    this.setData({ statusIdx: e.detail.value }, () => this.loadList());
  },

  showCreate() {
    this.setData({
      showModal: true,
      editingId: null,
      formTitle: '',
      formCover: '',
      formCoverPreview: '',
      formContent: '',
      formAttachments: '[]',
      formAttachmentList: [],
      formCategoryIdx: 0,
      formPriceIdx: 0
    });
  },

  closeModal() { this.setData({ showModal: false }); },

  pickCategory(e) {
    const idx = parseInt(e.detail.value, 10);
    this.setData({ formCategoryIdx: idx });
  },

  pickPriceRange(e) {
    const idx = parseInt(e.detail.value, 10);
    this.setData({ formPriceIdx: idx });
  },

  // ==================== 附件列表同步 ====================
  // WXML 不支持调用 JSON.parse，所以需要维护一个解析好的数组
  syncFormAttachmentList() {
    let list = [];
    try {
      list = JSON.parse(this.data.formAttachments || '[]');
    } catch (e) {
      list = [];
    }
    // 为每个附件计算图标和可读大小
    list = list.map(item => ({
      ...item,
      icon: this.getFileIcon(item.name),
      sizeDisplay: this.formatSize(item.size)
    }));
    this.setData({ formAttachmentList: list });
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
    const map = { pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗', zip: '📦', rar: '📦' };
    return map[ext] || '📄';
  },

  // ==================== 封面图上传 ====================
  chooseCoverImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempPath = res.tempFilePaths[0];
        this.setData({ uploadLoading: true });

        // 生成唯一文件名
        const ext = tempPath.split('.').pop() || 'jpg';
        const cloudPath = `covers/guide_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

        wx.cloud.uploadFile({
          cloudPath,
          filePath: tempPath
        }).then(uploadRes => {
          this.setData({
            formCover: uploadRes.fileID,
            formCoverPreview: tempPath,
            uploadLoading: false
          });
          wx.showToast({ title: '封面上传成功', icon: 'success' });
        }).catch(err => {
          console.error('[cover upload]', err);
          wx.showToast({ title: '上传失败', icon: 'none' });
          this.setData({ uploadLoading: false });
        });
      }
    });
  },

  removeCover() {
    this.setData({ formCover: '', formCoverPreview: '' });
  },

  // ==================== 附件上传 ====================
  chooseAttachment() {
    wx.chooseMessageFile({
      count: 5,
      type: 'file',
      success: (res) => {
        const files = res.tempFiles; // [{path, size, name}]
        this.setData({ uploadLoading: true });

        const uploadPromises = files.map(file => {
          const dotIdx = file.name.lastIndexOf('.');
          const ext = dotIdx > -1 ? file.name.slice(dotIdx) : '';
          const cloudPath = `attachments/${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;

          return wx.cloud.uploadFile({
            cloudPath,
            filePath: file.path
          }).then(uploadRes => ({
            name: file.name,
            fileId: uploadRes.fileID,
            size: file.size
          }));
        });

        Promise.all(uploadPromises).then(results => {
          const current = JSON.parse(this.data.formAttachments || '[]');
          const updated = [...current, ...results];
          this.setData({
            formAttachments: JSON.stringify(updated, null, 2),
            uploadLoading: false
          });
          this.syncFormAttachmentList();
          wx.showToast({ title: `已上传 ${results.length} 个文件`, icon: 'success' });
        }).catch(err => {
          console.error('[attachment upload]', err);
          wx.showToast({ title: '部分文件上传失败', icon: 'none' });
          this.setData({ uploadLoading: false });
        });
      }
    });
  },

  removeAttachment(e) {
    const idx = e.currentTarget.dataset.index;
    const current = JSON.parse(this.data.formAttachments || '[]');
    current.splice(idx, 1);
    this.setData({ formAttachments: JSON.stringify(current, null, 2) });
    this.syncFormAttachmentList();
  },

  // ==================== 保存 ====================
  saveDraft() {
    const admin = auth.getUser();
    const { formTitle, formCover, formContent, formAttachments, formCategoryIdx, formPriceIdx, editingId } = this.data;

    if (!formTitle.trim() || !formContent.trim()) {
      return wx.showToast({ title: '标题和内容为必填', icon: 'none' });
    }
    if (formCategoryIdx <= 0) {
      return wx.showToast({ title: '请选择关联类目', icon: 'none' });
    }
    if (formPriceIdx <= 0) {
      return wx.showToast({ title: '请选择价格区间', icon: 'none' });
    }

    let attachments = [];
    try {
      if (formAttachments.trim()) attachments = JSON.parse(formAttachments);
    } catch (e) {
      return wx.showToast({ title: '附件数据格式错误', icon: 'none' });
    }

    const guideData = {
      title: formTitle.trim(),
      coverImage: formCover.trim(),
      content: formContent,
      // 因为有 "请选择" 占位在索引0，所以实际数据索引要 -1
      categoryId: this.data.categories[formCategoryIdx - 1]._id,
      priceRangeId: this.data.priceRanges[formPriceIdx - 1]._id,
      attachments,
      createdBy: admin ? admin.userId : '',
      status: 'draft'
    };

    if (editingId) {
      cloud.updateGuide({ _id: editingId, ...guideData }).then(() => {
        wx.showToast({ title: '已更新' });
        this.closeModal();
        this.loadList();
      }).catch(() => {});
    } else {
      cloud.createGuide(guideData).then(() => {
        wx.showToast({ title: '草稿已保存' });
        this.closeModal();
        this.loadList();
      }).catch(() => {});
    }
  },

  editGuide(e) {
    const id = e.currentTarget.dataset.id;
    wx.showLoading({ title: '加载中...' });
    cloud.getGuideDetail(id).then(guide => {
      wx.hideLoading();
      // 因为有 "请选择" 占位在索引0，所以实际数据索引 +1
      const catIdx = this.data.categories.findIndex(c => c._id === guide.categoryId) + 1;
      const priceIdx = this.data.priceRanges.findIndex(p => p._id === guide.priceRangeId) + 1;
      this.setData({
        showModal: true,
        editingId: id,
        formTitle: guide.title,
        formCover: guide.coverImage || '',
        formCoverPreview: '',
        formContent: guide.content,
        formAttachments: JSON.stringify(guide.attachments || [], null, 2),
        formAttachmentList: (guide.attachments || []).map(a => ({
          ...a, icon: this.getFileIcon(a.name), sizeDisplay: this.formatSize(a.size)
        })),
        formCategoryIdx: catIdx > 0 ? catIdx : 0,
        formPriceIdx: priceIdx > 0 ? priceIdx : 0
      });
    }).catch(() => {
      wx.hideLoading();
    });
  },

  publishGuide(e) {
    const id = e.currentTarget.dataset.id;
    cloud.publishGuide(id).then(() => {
      wx.showToast({ title: '已发布' });
      this.loadList();
    }).catch(() => {});
  },

  unpublishGuide(e) {
    const id = e.currentTarget.dataset.id;
    cloud.unpublishGuide(id).then(() => {
      wx.showToast({ title: '已下架' });
      this.loadList();
    }).catch(() => {});
  },

  deleteGuide(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复，确定继续？',
      success: (res) => {
        if (res.confirm) {
          cloud.deleteGuide(id).then(() => {
            wx.showToast({ title: '已删除' });
            this.loadList();
          }).catch(() => {});
        }
      }
    });
  },

  // 阻止弹窗关闭（点击弹窗内部不关闭）
  noop() {}
});
