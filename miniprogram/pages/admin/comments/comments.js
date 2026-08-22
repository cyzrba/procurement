/**
 * 留言管理（管理端）
 * 管理员可查看全部用户留言并删除，无编辑功能
 */
const auth = require('../../../utils/auth');
const cloud = require('../../../utils/cloud');

// 留言超过该字数后，列表内自动折叠，点击查看全文
const MAX_PREVIEW_LENGTH = 100;

Page({
  data: {
    list: [],
    total: 0,
    page: 1,
    pageSize: 20,
    hasMore: true,
    loading: false,
    loaded: false,
    loadFailed: false,
    filterDate: '',
    maxDate: '',
    // 详情弹窗
    showDetailModal: false,
    detailItem: null
  },

  onLoad() {
    const user = auth.getUser();
    if (!user || user.role !== 'admin') {
      return wx.reLaunch({ url: '/pages/login/login' });
    }
    this.setData({ maxDate: this.formatToday() });
    this.loadComments(true);
  },

  onShow() {
    // 首次加载失败后，再次进入页面时自动补拉一次
    if (!this.data.loaded && !this.data.loading) {
      this.loadComments(true);
    }
  },

  loadComments(reset, retried) {
    if (this.data.loading) return Promise.resolve();
    if (!reset && !this.data.hasMore) return Promise.resolve();

    const page = reset ? 1 : this.data.page;
    this.setData({ loading: true });

    return cloud.getAllComments({ page, pageSize: this.data.pageSize, ...this.buildFilter() }, { silent: true })
      .then(result => {
        const incoming = (result.list || []).map(c => this.decorateComment(c));
        const list = reset ? incoming : [...this.data.list, ...incoming];
        this.setData({
          list,
          loaded: true,
          loadFailed: false,
          total: result.total || 0,
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

  // ===== 日期筛选 =====
  onFilterDateChange(e) {
    this.setData({ filterDate: e.detail.value });
    this.loadComments(true);
  },

  clearFilter() {
    this.setData({ filterDate: '' });
    this.loadComments(true);
  },

  // 将选中日期转为本地时区当天的时间范围（毫秒时间戳）
  buildFilter() {
    const { filterDate } = this.data;
    if (!filterDate) return {};
    const parts = filterDate.split('-').map(Number);
    const start = new Date(parts[0], parts[1] - 1, parts[2]).getTime();
    const end = start + 24 * 60 * 60 * 1000;
    return { start, end };
  },

  // 今天的日期（YYYY-MM-DD），用于限制日期选择器可选范围
  formatToday() {
    const d = new Date();
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    return `${Y}-${M}-${D}`;
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

  handleDelete(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.list.find(c => c._id === id);
    const name = item ? (item.userName || '该用户') : '该用户';

    wx.showModal({
      title: '删除留言',
      content: `确定删除「${name}」的这条留言吗？删除后不可恢复。`,
      success: (res) => {
        if (!res.confirm) return;
        cloud.deleteCommentByAdmin(id)
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
