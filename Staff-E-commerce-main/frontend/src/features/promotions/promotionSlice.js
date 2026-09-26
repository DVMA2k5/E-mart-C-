import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  getPromotionsPaginated,
  deletePromotion as apiDeletePromotion,
  togglePromotionActive as apiTogglePromotionActive,
  getPromotionOverviewStats,
} from '../../api/promotionApi';

export const fetchPromotionsPaginated = createAsyncThunk(
  'promotions/fetchPaginated',
  async ({ page = 1, pageSize = 12, search = '', status = 'all', type = 'all' } = {}, { rejectWithValue }) => {
    try {
      const data = await getPromotionsPaginated(page, pageSize, search, status, type);
      const items = data.items ?? data.Items ?? [];
      const meta = {
        totalItems: data.totalItems ?? data.TotalItems ?? 0,
        currentPage: data.currentPage ?? data.CurrentPage ?? page,
        pageSize: data.pageSize ?? data.PageSize ?? pageSize,
        totalPages: data.totalPages ?? data.TotalPages ?? 1,
        hasNext: data.hasNext ?? data.HasNext ?? false,
        hasPrevious: data.hasPrevious ?? data.HasPrevious ?? false,
      };
      return { items, meta };
    } catch (err) {
      return rejectWithValue(err.message || 'Không thể tải danh sách khuyến mãi');
    }
  }
);

export const deletePromotion = createAsyncThunk(
  'promotions/delete',
  async (id, { rejectWithValue }) => {
    try {
      await apiDeletePromotion(id);
      return id;
    } catch (err) {
      return rejectWithValue(err.message || 'Xóa khuyến mãi thất bại');
    }
  }
);

export const togglePromotionActive = createAsyncThunk(
  'promotions/toggleActive',
  async (id, { rejectWithValue }) => {
    try {
      await apiTogglePromotionActive(id);
      return id; // optimistic toggle
    } catch (err) {
      return rejectWithValue(err.message || 'Đổi trạng thái thất bại');
    }
  }
);

export const fetchPromotionStats = createAsyncThunk(
  'promotions/fetchOverviewStats',
  async (_, { rejectWithValue }) => {
    try {
      const data = await getPromotionOverviewStats();
      return data;
    } catch (err) {
      return rejectWithValue(err.message || 'Không thể tải thống kê');
    }
  }
);

const initialState = {
  items: [],
  meta: { totalItems: 0, currentPage: 1, pageSize: 12, totalPages: 1, hasNext: false, hasPrevious: false },
  loading: false,
  error: null,
  overview: { total: 0, active: 0, expired: 0, inactive: 0 },
};

const promotionsSlice = createSlice({
  name: 'promotions',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPromotionsPaginated.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPromotionsPaginated.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.meta = action.payload.meta;
      })
      .addCase(fetchPromotionsPaginated.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Lỗi tải danh sách';
      })
      .addCase(deletePromotion.fulfilled, (state, action) => {
        const id = action.payload;
        state.items = state.items.filter((x) => x.id !== id);
        state.meta.totalItems = Math.max(0, state.meta.totalItems - 1);
      })
      .addCase(togglePromotionActive.fulfilled, (state, action) => {
        const id = action.payload;
        const item = state.items.find((x) => x.id === id);
        if (item) item.active = !item.active;
      })
      .addCase(fetchPromotionStats.fulfilled, (state, action) => {
        state.overview = action.payload || state.overview;
      });
  },
});

export default promotionsSlice.reducer;