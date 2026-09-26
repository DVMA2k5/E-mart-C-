import { configureStore } from "@reduxjs/toolkit";
import promotionsReducer from "../features/promotions/promotionSlice";
import statisticsReducer from "../features/statistics/statisticsSlice";
import customerReducer from "../features/customers/customerSlice";
import categoryReducer from "../features/categories/categorySlice";

export const store = configureStore({
  reducer: {
    promotions: promotionsReducer,
    statistics: statisticsReducer,
    customers: customerReducer,
    categories: categoryReducer,
  },
});

export default store;
