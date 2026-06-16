/**
 * 采购指南管理
 */
const cloud = require('../../../utils/cloud');
const auth = require('../../../utils/auth');

Page({
  data: {
    list: [],
    statusOptions: ['全部状态', '草稿', '已发布', '已下架'],
    statusIdx: 0,
    statusMap: { draft: '草稿', published: '已发布', unpublished: '已下架' },
    showModal: false,
    editingId: null,
    categories: [],
    priceRanges: [],
    categoryOptions: [],
    priceRangeOptions: [],
    formCategoryIdx: 0,
    formPriceIdx: 0,
    formTitle: '',
    formPreparationContent: '',
    formPreparationMedia: [],
    _preparationMediaDisplay: [],
    formSteps: [{ description: '', media: [], _mediaDisplay: [], hasGroups: false, groups: [] }],
    filterCategoryIdx: 0,
    filterCategoryOptions: []
  },

  onLoad() {
    this.loadOptions().then(() => this.loadList());
  },

  onShow() { this.loadList(); },

  loadList() {
    const params = {};
    const statusMap = ['', 'draft', 'published', 'unpublished'];
    const status = statusMap[this.data.statusIdx];
    if (status) params.status = status;

    const catIdx = this.data.filterCategoryIdx;
    if (catIdx > 0) {
      const cat = this.data.categories[catIdx - 1];
      if (cat) params.categoryId = cat._id;
    }

    cloud.getGuides(params).then(result => {
      const catMap = {};
      (this.data.categories || []).forEach(c => { catMap[c._id] = c.name; });
      const list = (result.list || []).map(item => ({
        ...item,
        categoryName: catMap[item.categoryId] || ''
      }));
      this.setData({ list });
    }).catch(() => {});
  },

  loadOptions() {
    wx.showLoading({ title: '加载中...' });
    return Promise.all([
      cloud.getCategories().catch(() => []),
      cloud.getPriceRanges().catch(() => [])
    ]).then(([categories, priceRanges]) => {
      wx.hideLoading();
      this.setData({
        categories: categories || [],
        categoryOptions: ['-- 请选择类目 --', ...(categories || []).map(
          c => `${c.name}${c.description ? ' - ' + c.description : ''}`
        )],
        filterCategoryOptions: ['全部类目', ...(categories || []).map(c => c.name)],
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

  filterByCategory(e) {
    this.setData({ filterCategoryIdx: parseInt(e.detail.value, 10) }, () => this.loadList());
  },

  showCreate() {
    this.setData({
      showModal: true,
      editingId: null,
      formTitle: '',
      formPreparationContent: '',
      formPreparationMedia: [],
      _preparationMediaDisplay: [],
      formSteps: [{ _key: this._genKey(), description: '', media: [], _mediaDisplay: [], hasGroups: false, groups: [] }],
      formCategoryIdx: 0,
      formPriceIdx: 0
    });
  },

  closeModal() { this.setData({ showModal: false }); },

  pickCategory(e) {
    this.setData({ formCategoryIdx: parseInt(e.detail.value, 10) });
  },

  pickPriceRange(e) {
    this.setData({ formPriceIdx: parseInt(e.detail.value, 10) });
  },

  // ==================== 步骤管理 ====================
  addStep() {
    const steps = this.data.formSteps;
    steps.push({ _key: this._genKey(), description: '', media: [], _mediaDisplay: [], hasGroups: false, groups: [] });
    this.setData({ formSteps: steps });
  },

  removeStep(e) {
    const idx = e.currentTarget.dataset.index;
    const steps = this.data.formSteps;
    if (steps.length <= 1) {
      return wx.showToast({ title: '至少保留一个步骤', icon: 'none' });
    }
    steps.splice(idx, 1);
    this.setData({ formSteps: steps });
  },

  onStepDescInput(e) {
    const idx = e.currentTarget.dataset.index;
    const steps = this.data.formSteps;
    steps[idx].description = e.detail.value;
    this.setData({ formSteps: steps });
  },

  // ==================== 分组开关 ====================
  toggleGroupMode(e) {
    const idx = e.currentTarget.dataset.index;
    const steps = this.data.formSteps;
    const step = steps[idx];
    step.hasGroups = !step.hasGroups;

    if (step.hasGroups && step.groups.length === 0) {
      step.groups = [{ _key: this._genKey(), title: '', media: [], _mediaDisplay: [] }];
    }

    this.setData({ formSteps: steps });
  },

  // ==================== 分组管理 ====================
  addGroup(e) {
    const stepIdx = e.currentTarget.dataset.stepIdx;
    const steps = this.data.formSteps;
    steps[stepIdx].groups.push({ _key: this._genKey(), title: '', media: [], _mediaDisplay: [] });
    this.setData({ formSteps: steps });
  },

  removeGroup(e) {
    const stepIdx = e.currentTarget.dataset.stepIdx;
    const groupIdx = e.currentTarget.dataset.groupIdx;
    const steps = this.data.formSteps;
    steps[stepIdx].groups.splice(groupIdx, 1);
    this.setData({ formSteps: steps });
  },

  onGroupTitleInput(e) {
    const stepIdx = e.currentTarget.dataset.stepIdx;
    const groupIdx = e.currentTarget.dataset.groupIdx;
    const steps = this.data.formSteps;
    steps[stepIdx].groups[groupIdx].title = e.detail.value;
    this.setData({ formSteps: steps });
  },

  // ==================== 步骤媒体上传（无分组） ====================
  chooseStepMedia(e) {
    const stepIdx = e.currentTarget.dataset.index;
    wx.showActionSheet({
      itemList: ['附件 (PDF/Word/Excel)', '图片 (JPG/PNG)', '视频 (MP4)'],
      success: (res) => {
        switch (res.tapIndex) {
          case 0: this.pickDocuments(stepIdx, null); break;
          case 1: this.pickImages(stepIdx, null); break;
          case 2: this.pickVideos(stepIdx, null); break;
        }
      }
    });
  },

  // ==================== 分组媒体上传 ====================
  chooseGroupMedia(e) {
    const stepIdx = e.currentTarget.dataset.stepIdx;
    const groupIdx = e.currentTarget.dataset.groupIdx;
    wx.showActionSheet({
      itemList: ['附件 (PDF/Word/Excel)', '图片 (JPG/PNG)', '视频 (MP4)'],
      success: (res) => {
        switch (res.tapIndex) {
          case 0: this.pickDocuments(stepIdx, groupIdx); break;
          case 1: this.pickImages(stepIdx, groupIdx); break;
          case 2: this.pickVideos(stepIdx, groupIdx); break;
        }
      }
    });
  },

  pickDocuments(stepIdx, groupIdx) {
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
        this.uploadFiles(stepIdx, groupIdx, files, 'document');
      }
    });
  },

  pickImages(stepIdx, groupIdx) {
    wx.chooseImage({
      count: 9,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const files = res.tempFiles.filter(f => {
          const path = (f.path || f.tempFilePath || '');
          const ext = path.split('.').pop().toLowerCase();
          if (!['jpg', 'jpeg', 'png'].includes(ext)) {
            wx.showToast({ title: '仅支持 JPG/JPEG/PNG 格式', icon: 'none' });
            return false;
          }
          return true;
        });
        if (files.length === 0) return;
        const items = files.map(f => ({
          path: f.path || f.tempFilePath,
          size: f.size || 0,
          name: (f.path || f.tempFilePath || '').split('/').pop() || `image_${Date.now()}.jpg`
        }));
        this.uploadFiles(stepIdx, groupIdx, items, 'image');
      }
    });
  },

  pickVideos(stepIdx, groupIdx) {
    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      sourceType: ['album', 'camera'],
      maxDuration: 600,
      success: (res) => {
        const file = res.tempFiles[0];
        if (!file) return;
        const path = file.tempFilePath || '';
        const ext = path.split('.').pop().toLowerCase();
        if (ext !== 'mp4') {
          return wx.showToast({ title: '仅支持 MP4 格式', icon: 'none' });
        }
        this.uploadFiles(stepIdx, groupIdx, [{
          path,
          size: file.size || 0,
          name: `video_${Date.now()}.mp4`
        }], 'video');
      }
    });
  },

  uploadFiles(stepIdx, groupIdx, files, type) {
    wx.showLoading({ title: '上传中...' });
    const dirMap = { document: 'documents', image: 'images', video: 'videos' };
    const dir = dirMap[type] || 'attachments';

    const uploads = files.map(file => {
      const dotIdx = file.name.lastIndexOf('.');
      const ext = dotIdx > -1 ? file.name.slice(dotIdx) : '';
      const cloudPath = `${dir}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;

      return wx.cloud.uploadFile({
        cloudPath,
        filePath: file.path
      }).then(uploadRes => ({
        name: file.name,
        fileId: uploadRes.fileID,
        size: file.size || 0,
        type
      }));
    });

    Promise.all(uploads).then(results => {
      wx.hideLoading();
      const steps = this.data.formSteps;

      if (groupIdx !== null && groupIdx !== undefined) {
        steps[stepIdx].groups[groupIdx].media = [
          ...(steps[stepIdx].groups[groupIdx].media || []),
          ...results
        ];
        this.setData({ formSteps: steps });
        this.syncGroupMediaDisplay(stepIdx, groupIdx);
      } else {
        steps[stepIdx].media = [...(steps[stepIdx].media || []), ...results];
        this.setData({ formSteps: steps });
        this.syncStepMediaDisplay(stepIdx);
      }

      wx.showToast({ title: `已上传 ${results.length} 个文件`, icon: 'success' });
    }).catch(err => {
      wx.hideLoading();
      console.error('[upload error]', err);
      wx.showToast({ title: '上传失败', icon: 'none' });
    });
  },

  // ==================== 步骤媒体展示同步 ====================
  syncStepMediaDisplay(stepIdx) {
    const step = this.data.formSteps[stepIdx];
    const display = (step.media || []).map(m => ({
      ...m,
      icon: this.getFileIcon(m.name),
      sizeDisplay: this.formatSize(m.size)
    }));
    const steps = this.data.formSteps;
    steps[stepIdx]._mediaDisplay = display;
    this.setData({ formSteps: steps });
  },

  syncGroupMediaDisplay(stepIdx, groupIdx) {
    const group = this.data.formSteps[stepIdx].groups[groupIdx];
    const display = (group.media || []).map(m => ({
      ...m,
      icon: this.getFileIcon(m.name),
      sizeDisplay: this.formatSize(m.size)
    }));
    const steps = this.data.formSteps;
    steps[stepIdx].groups[groupIdx]._mediaDisplay = display;
    this.setData({ formSteps: steps });
  },

  removeStepMedia(e) {
    const stepIdx = e.currentTarget.dataset.step;
    const midx = e.currentTarget.dataset.midx;
    const steps = this.data.formSteps;
    steps[stepIdx].media.splice(midx, 1);
    this.setData({ formSteps: steps });
    this.syncStepMediaDisplay(stepIdx);
  },

  removeGroupMedia(e) {
    const stepIdx = e.currentTarget.dataset.stepIdx;
    const groupIdx = e.currentTarget.dataset.groupIdx;
    const midx = e.currentTarget.dataset.midx;
    const steps = this.data.formSteps;
    steps[stepIdx].groups[groupIdx].media.splice(midx, 1);
    this.setData({ formSteps: steps });
    this.syncGroupMediaDisplay(stepIdx, groupIdx);
  },

  // ==================== 前期准备媒体上传 ====================
  choosePreparationMedia() {
    wx.showActionSheet({
      itemList: ['附件 (PDF/Word/Excel)', '图片 (JPG/PNG)', '视频 (MP4)'],
      success: (res) => {
        switch (res.tapIndex) {
          case 0: this.pickPreparationDocuments(); break;
          case 1: this.pickPreparationImages(); break;
          case 2: this.pickPreparationVideos(); break;
        }
      }
    });
  },

  pickPreparationDocuments() {
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
        this.uploadPreparationFiles(files, 'document');
      }
    });
  },

  pickPreparationImages() {
    wx.chooseImage({
      count: 9,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const files = res.tempFiles.filter(f => {
          const path = (f.path || f.tempFilePath || '');
          const ext = path.split('.').pop().toLowerCase();
          if (!['jpg', 'jpeg', 'png'].includes(ext)) {
            wx.showToast({ title: '仅支持 JPG/JPEG/PNG 格式', icon: 'none' });
            return false;
          }
          return true;
        });
        if (files.length === 0) return;
        const items = files.map(f => ({
          path: f.path || f.tempFilePath,
          size: f.size || 0,
          name: (f.path || f.tempFilePath || '').split('/').pop() || `image_${Date.now()}.jpg`
        }));
        this.uploadPreparationFiles(items, 'image');
      }
    });
  },

  pickPreparationVideos() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      sourceType: ['album', 'camera'],
      maxDuration: 600,
      success: (res) => {
        const file = res.tempFiles[0];
        if (!file) return;
        const path = file.tempFilePath || '';
        const ext = path.split('.').pop().toLowerCase();
        if (ext !== 'mp4') {
          return wx.showToast({ title: '仅支持 MP4 格式', icon: 'none' });
        }
        this.uploadPreparationFiles([{
          path,
          size: file.size || 0,
          name: `video_${Date.now()}.mp4`
        }], 'video');
      }
    });
  },

  uploadPreparationFiles(files, type) {
    wx.showLoading({ title: '上传中...' });
    const dirMap = { document: 'documents', image: 'images', video: 'videos' };
    const dir = dirMap[type] || 'attachments';

    const uploads = files.map(file => {
      const dotIdx = file.name.lastIndexOf('.');
      const ext = dotIdx > -1 ? file.name.slice(dotIdx) : '';
      const cloudPath = `${dir}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;

      return wx.cloud.uploadFile({
        cloudPath,
        filePath: file.path
      }).then(uploadRes => ({
        name: file.name,
        fileId: uploadRes.fileID,
        size: file.size || 0,
        type
      }));
    });

    Promise.all(uploads).then(results => {
      wx.hideLoading();
      const media = [...(this.data.formPreparationMedia || []), ...results];
      this.setData({ formPreparationMedia: media });
      this.syncPreparationMediaDisplay();
      wx.showToast({ title: `已上传 ${results.length} 个文件`, icon: 'success' });
    }).catch(err => {
      wx.hideLoading();
      console.error('[upload error]', err);
      wx.showToast({ title: '上传失败', icon: 'none' });
    });
  },

  syncPreparationMediaDisplay() {
    const display = (this.data.formPreparationMedia || []).map(m => ({
      ...m,
      icon: this.getFileIcon(m.name),
      sizeDisplay: this.formatSize(m.size)
    }));
    this.setData({ _preparationMediaDisplay: display });
  },

  removePreparationMedia(e) {
    const midx = e.currentTarget.dataset.midx;
    const media = this.data.formPreparationMedia;
    media.splice(midx, 1);
    this.setData({ formPreparationMedia: media });
    this.syncPreparationMediaDisplay();
  },

  // ==================== 工具方法 ====================
  _genKey() {
    return 'k_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
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

  // ==================== 保存 ====================
  saveDraft() {
    const admin = auth.getUser();
    const { formTitle, formPreparationContent, formPreparationMedia, formSteps, formCategoryIdx, formPriceIdx, editingId } = this.data;

    if (!formTitle.trim()) {
      return wx.showToast({ title: '标题为必填', icon: 'none' });
    }
    const hasPrepText = formPreparationContent.trim().length > 0;
    const hasPrepMedia = formPreparationMedia && formPreparationMedia.length > 0;
    if (!hasPrepText && !hasPrepMedia) {
      return wx.showToast({ title: '前期准备为必填（文字或上传文件至少一项）', icon: 'none' });
    }
    if (formCategoryIdx <= 0) {
      return wx.showToast({ title: '请选择关联类目', icon: 'none' });
    }
    if (formPriceIdx <= 0) {
      return wx.showToast({ title: '请选择价格区间', icon: 'none' });
    }

    const validSteps = formSteps.filter(s => s.description && s.description.trim());
    if (validSteps.length === 0) {
      return wx.showToast({ title: '至少填写一个采购流程步骤', icon: 'none' });
    }

    const processSteps = formSteps.map((step, i) => {
      const data = {
        stepOrder: i + 1,
        description: (step.description || '').trim(),
        media: (step.media || []).map(m => ({
          name: m.name,
          fileId: m.fileId,
          size: m.size,
          type: m.type
        }))
      };

      if (step.hasGroups) {
        data.groups = (step.groups || []).map(g => ({
          title: (g.title || '').trim(),
          media: (g.media || []).map(m => ({
            name: m.name,
            fileId: m.fileId,
            size: m.size,
            type: m.type
          }))
        }));
      }

      return data;
    });

    if (editingId) {
      const guideData = {
        title: formTitle.trim(),
        preparation: {
          content: formPreparationContent.trim(),
          media: (formPreparationMedia || []).map(m => ({
            name: m.name,
            fileId: m.fileId,
            size: m.size,
            type: m.type
          }))
        },
        processSteps,
        categoryId: this.data.categories[formCategoryIdx - 1]._id,
        priceRangeId: this.data.priceRanges[formPriceIdx - 1]._id,
        status: 'draft'
      };

      cloud.updateGuide({ _id: editingId, ...guideData }).then(() => {
        wx.showToast({ title: '已更新' });
        this.closeModal();
        this.loadList();
      }).catch((err) => {
        console.error('[saveDraft] 更新失败:', err);
        wx.showToast({ title: (err && err.message) || '保存失败', icon: 'none' });
      });
    } else {
      const guideData = {
        title: formTitle.trim(),
        preparation: {
          content: formPreparationContent.trim(),
          media: (formPreparationMedia || []).map(m => ({
            name: m.name,
            fileId: m.fileId,
            size: m.size,
            type: m.type
          }))
        },
        processSteps,
        categoryId: this.data.categories[formCategoryIdx - 1]._id,
        priceRangeId: this.data.priceRanges[formPriceIdx - 1]._id,
        createdBy: admin ? admin.userId : '',
        status: 'draft'
      };

      cloud.createGuide(guideData).then(() => {
        wx.showToast({ title: '草稿已保存' });
        this.closeModal();
        this.loadList();
      }).catch((err) => {
        console.error('[saveDraft] 创建失败:', err);
        wx.showToast({ title: (err && err.message) || '创建失败', icon: 'none' });
      });
    }
  },

  editGuide(e) {
    const id = e.currentTarget.dataset.id;
    wx.showLoading({ title: '加载中...' });
    cloud.getGuideDetail(id).then(guide => {
      wx.hideLoading();
      const catIdx = this.data.categories.findIndex(c => c._id === guide.categoryId) + 1;
      const priceIdx = this.data.priceRanges.findIndex(p => p._id === guide.priceRangeId) + 1;

      const steps = (guide.processSteps || []).map(step => {
        const hasGroups = !!(step.groups && step.groups.length > 0);
        return {
          _key: this._genKey(),
          description: step.description || '',
          media: (step.media || []).map(m => ({
            name: m.name, fileId: m.fileId, size: m.size, type: m.type
          })),
          _mediaDisplay: (step.media || []).map(m => ({
            name: m.name, fileId: m.fileId, size: m.size, type: m.type,
            icon: this.getFileIcon(m.name), sizeDisplay: this.formatSize(m.size)
          })),
          hasGroups,
          groups: hasGroups ? (step.groups || []).map(g => ({
            _key: this._genKey(),
            title: g.title || '',
            media: (g.media || []).map(m => ({
              name: m.name, fileId: m.fileId, size: m.size, type: m.type
            })),
            _mediaDisplay: (g.media || []).map(m => ({
              name: m.name, fileId: m.fileId, size: m.size, type: m.type,
              icon: this.getFileIcon(m.name), sizeDisplay: this.formatSize(m.size)
            }))
          })) : []
        };
      });

      // 兼容旧版（字符串）和新版（{content, media}）preparation
      let prepContent = '';
      let prepMedia = [];
      if (typeof guide.preparation === 'string') {
        prepContent = guide.preparation || '';
      } else if (guide.preparation) {
        prepContent = guide.preparation.content || '';
        prepMedia = (guide.preparation.media || []).map(m => ({
          name: m.name, fileId: m.fileId, size: m.size, type: m.type
        }));
      }
      const prepDisplay = prepMedia.map(m => ({
        ...m,
        icon: this.getFileIcon(m.name),
        sizeDisplay: this.formatSize(m.size)
      }));

      this.setData({
        showModal: true,
        editingId: id,
        formTitle: guide.title,
        formPreparationContent: prepContent,
        formPreparationMedia: prepMedia,
        _preparationMediaDisplay: prepDisplay,
        formSteps: steps.length > 0 ? steps : [{ description: '', media: [], _mediaDisplay: [], hasGroups: false, groups: [] }],
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

  previewGuide(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/guide-detail/guide-detail?id=${id}` });
  },

  noop() {}
});
