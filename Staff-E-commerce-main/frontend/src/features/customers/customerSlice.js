import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  toggleCustomerStatus,
  deleteCustomer,
} from "../../api/customerApi";

// Async thunks
export const fetchCustomers = createAsyncThunk(
  "customers/fetchCustomers",
  async (
    { page = 1, pageSize = 5, search = "", status = "all" },
    { rejectWithValue }
  ) => {
    try {
      const data = await getCustomers(page, pageSize, search, status);
      return data;
    } catch (error) {
      return rejectWithValue(error.message || "Error fetching customers");
    }
  }
);

export const fetchCustomerById = createAsyncThunk(
  "customers/fetchCustomerById",
  async (customerId, { rejectWithValue }) => {
    try {
      const data = await getCustomerById(customerId);
      return data;
    } catch (error) {
      return rejectWithValue(error.message || "Error fetching customer");
    }
  }
);

export const createNewCustomer = createAsyncThunk(
  "customers/createNewCustomer",
  async (customerData, { rejectWithValue }) => {
    try {
      const data = await createCustomer(customerData);
      return data;
    } catch (error) {
      return rejectWithValue(error.message || "Error creating customer");
    }
  }
);

export const updateCustomerInfo = createAsyncThunk(
  "customers/updateCustomerInfo",
  async ({ customerId, customerData }, { rejectWithValue }) => {
    try {
      const data = await updateCustomer(customerId, customerData);
      return data;
    } catch (error) {
      return rejectWithValue(error.message || "Error updating customer");
    }
  }
);

export const toggleStatus = createAsyncThunk(
  "customers/toggleStatus",
  async ({ customerId, isActive }, { rejectWithValue }) => {
    try {
      const data = await toggleCustomerStatus(customerId, isActive);
      return data;
    } catch (error) {
      return rejectWithValue(error.message || "Error toggling status");
    }
  }
);

export const removeCustomer = createAsyncThunk(
  "customers/removeCustomer",
  async (customerId, { rejectWithValue }) => {
    try {
      const data = await deleteCustomer(customerId);
      return data;
    } catch (error) {
      return rejectWithValue(error.message || "Error deleting customer");
    }
  }
);

const initialState = {
  items: [],
  currentCustomer: null,
  loading: false,
  error: null,
  successMessage: null,
  pagination: {
    currentPage: 1,
    pageSize: 5,
    totalItems: 0,
    totalPages: 0,
  },
  filters: {
    search: "",
    status: "all",
  },
};

const customerSlice = createSlice({
  name: "customers",
  initialState,
  reducers: {
    setCurrentPage: (state, action) => {
      state.pagination.currentPage = action.payload;
    },
    setSearchTerm: (state, action) => {
      state.filters.search = action.payload;
      state.pagination.currentPage = 1;
    },
    setStatusFilter: (state, action) => {
      state.filters.status = action.payload;
      state.pagination.currentPage = 1;
    },
    resetFilters: (state) => {
      state.filters.search = "";
      state.filters.status = "all";
      state.pagination.currentPage = 1;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearSuccess: (state) => {
      state.successMessage = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch Customers
    builder
      .addCase(fetchCustomers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCustomers.fulfilled, (state, action) => {
        state.loading = false;
        // Backend returns: { Items, CurrentPage, TotalPages, TotalItems }
        state.items = action.payload.items || [];
        state.pagination = {
          currentPage: action.payload.currentPage || 1,
          pageSize: state.pagination.pageSize || 5,
          totalItems: action.payload.totalItems || 0,
          totalPages: action.payload.totalPages || 0,
        };
      })
      .addCase(fetchCustomers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Fetch Customer By ID
    builder
      .addCase(fetchCustomerById.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchCustomerById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentCustomer = action.payload.data;
      })
      .addCase(fetchCustomerById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Create Customer
    builder
      .addCase(createNewCustomer.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createNewCustomer.fulfilled, (state, action) => {
        state.loading = false;
        state.successMessage = "Tạo khách hàng thành công";
        state.items.unshift(action.payload.data);
      })
      .addCase(createNewCustomer.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Update Customer
    builder
      .addCase(updateCustomerInfo.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateCustomerInfo.fulfilled, (state, action) => {
        state.loading = false;
        state.successMessage = "Cập nhật khách hàng thành công";
        const index = state.items.findIndex(
          (item) => item.id === action.payload.data.id
        );
        if (index !== -1) {
          state.items[index] = action.payload.data;
        }
        state.currentCustomer = action.payload.data;
      })
      .addCase(updateCustomerInfo.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Toggle Status
    builder
      .addCase(toggleStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(toggleStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.successMessage = "Cập nhật trạng thái thành công";
        // Response is the customer data directly, not wrapped in .data
        const customerId = action.payload.id || action.payload.data?.id;
        const index = state.items.findIndex((item) => item.id === customerId);
        if (index !== -1) {
          state.items[index] = action.payload.data || action.payload;
        }
      })
      .addCase(toggleStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });

    // Delete Customer
    builder
      .addCase(removeCustomer.pending, (state) => {
        state.loading = true;
      })
      .addCase(removeCustomer.fulfilled, (state, action) => {
        state.loading = false;
        state.successMessage = "Xóa khách hàng thành công";
        state.items = state.items.filter(
          (item) => item.id !== action.payload.data.id
        );
      })
      .addCase(removeCustomer.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const {
  setCurrentPage,
  setSearchTerm,
  setStatusFilter,
  resetFilters,
  clearError,
  clearSuccess,
} = customerSlice.actions;
export default customerSlice.reducer;
