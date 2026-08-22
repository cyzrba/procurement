/**
 * 留言页面（用户端）
 * 仅展示本人留言，支持发布 / 编辑 / 删除，按发表时间倒序
 */
const auth = require('../../utils/auth');
const cloud = require('../../utils/cloud');

// 留言超过该字数后，列表内自动折叠，点击查看全文
const MAX_PREVIEW_LENGTH = 100;

Page({
  data: {
    draft: '',
    canSend: false,
    sending: false,
    list: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: false,
    loaded: false,
    loadFailed: false,
    // 编辑弹窗
    showEditModal: false,
    editingId: '',
    editContent: '',
    // 详情弹窗
    showDetailModal: false,
    detailItem: null
  },

  onLoad() {
    const user = auth.getUser();
    if (!user || user.role !== 'user') {
      return wx.reLaunch({ url: '/pages/login/login' });
    }
    this.loadComments(true);
  },

  onShow() {
    // 首次加载失败后，再次进入页面时自动补拉一次
    if (!this.data.loaded && !this.data.loading) {
      this.loadComments(true);
    }
  },

  // ===== 发布留言 =====
  onDraftInput(e) {
    const draft = e.detail.value;
    this.setData({ draft, canSend: draft.trim().length > 0 });
  },

  handleSend() {
    const content = this.data.draft.trim();
    if (!content) {
      return wx.showToast({ title: '请输入留言内容', icon: 'none' });
    }
    if (this.data.sending) return;

    this.setData({ sending: true });
    cloud.createComment(content)
      .then(() => {
        this.setData({ draft: '', canSend: false });
        wx.showToast({ title: '发布成功', icon: 'success' });
        this.loadComments(true);
      })
      .catch(() => {})
      .finally(() => this.setData({ sending: false }));
  },

  // ===== 留言列表 =====
  loadComments(reset, retried) {
    if (this.data.loading) return Promise.resolve();
    if (!reset && !this.data.hasMore) return Promise.resolve();

    const page = reset ? 1 : this.data.page;
    this.setData({ loading: true });

    return cloud.getComments(page, this.data.pageSize, { silent: true })
      .then(result => {
        const incoming = (result.list || []).map(c => this.decorateComment(c));
        const list = reset ? incoming : [...this.data.list, ...incoming];
        this.setData({
          list,
          loaded: true,
          loadFailed: false,
          page: page + 1,
          hasMore: list.length < (result.total || 0),
          loading: false
        });
      })
      .catch(() => {
        this.setData({ loading: false });
        // 首次失败多为冷启动/连接未就绪，自动重试一次（全程静默）
        if (!retried) {
          return this.loadComments(reset, true);
        }
        this.setData({ loadFailed: true });
        return Promise.resolve();
      });
  },

  loadMore() {
    this.loadComments(false);
  },

  handleRetry() {
    this.loadComments(true);
  },

  // 超长留言折叠处理
  decorateComment(item) {
    const content = item.content || '';
    const isLong = content.length > MAX_PREVIEW_LENGTH;
    return {
      ...item,
      _isLong: isLong,
      _preview: isLong ? `${content.slice(0, MAX_PREVIEW_LENGTH)}…` : content,
      _timeText: this.formatTime(item.createdAt || item.updatedAt)
    };
  },

  // ===== 查看全文 =====
  openDetail(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.list.find(c => c._id === id);
    if (!item) return;
    this.setData({ showDetailModal: true, detailItem: item });
  },

  closeDetail() {
    this.setData({ showDetailModal: false, detailItem: null });
  },

  onPullDownRefresh() {
    this.loadComments(true).then(() => wx.stopPullDownRefresh());
  },

  // ===== 编辑留言 =====
  openEdit(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.list.find(c => c._id === id);
    if (!item) return;
    this.setData({ showEditModal: true, editingId: id, editContent: item.content });
  },

  closeEdit() {
    this.setData({ showEditModal: false, editingId: '', editContent: '' });
  },

  onEditInput(e) {
    this.setData({ editContent: e.detail.value });
  },

  handleSaveEdit() {
    const content = this.data.editContent.trim();
    if (!content) {
      return wx.showToast({ title: '留言内容不能为空', icon: 'none' });
    }

    cloud.updateComment(this.data.editingId, content)
      .then(() => {
        wx.showToast({ title: '已保存', icon: 'success' });
        this.closeEdit();
        this.loadComments(true);
      })
      .catch(() => {});
  },

  // ===== 删除留言 =====
  handleDelete(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除留言',
      content: '确定删除这条留言吗？删除后不可恢复。',
      success: (res) => {
        if (!res.confirm) return;
        cloud.deleteComment(id)
          .then(() => {
            wx.showToast({ title: '已删除' });
            this.loadComments(true);
          })
          .catch(() => {});
      }
    });
  },

  formatTime(dateStr) {
    if (!dateStr) return '';
    let d;
    if (dateStr instanceof Date) {
      d = dateStr;
    } else if (typeof dateStr === 'object' && dateStr.$date) {
      d = new Date(dateStr.$date);
    } else if (typeof dateStr === 'number') {
      d = new Date(dateStr);
    } else {
      d = new Date(dateStr);
    }
    if (isNaN(d.getTime())) return '';
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${Y}-${M}-${D} ${h}:${m}`;
  }
});
