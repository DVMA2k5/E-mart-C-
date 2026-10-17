import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  IconMenu,
  IconSearch,
  IconCart,
  IconLocation,
  IconChevronRight,
  IconClose,
  IconCloseCircle,
  IconHome,
  IconReceipt,
  IconUser,
  IconPlus,
  IconMinus,
  IconCheck,
  IconFlash,
  IconShield,
  IconStar,
  IconSort,
  CategoryAll,
  getCategoryIcon,
} from "./components/Icons";

const defaultHost = typeof window !== "undefined" && window.location?.hostname
  ? `http://${window.location.hostname}:5099/api`
  : "http://10.0.2.2:5099/api";
const API_URL = (typeof window !== "undefined" && window.location?.hostname
  ? defaultHost
  : process.env.EXPO_PUBLIC_API_URL || defaultHost).replace(/\/$/, "");
const API_ORIGIN = API_URL.replace(/\/api$/, "");
const CART_KEY = "e-mart-mobile-cart";
const CUSTOMER_KEY = "e-mart-mobile-customer";
const CUSTOMER_TOKEN_KEY = "e-mart-mobile-customer-token";
const ADDRESS_KEY = "e-mart-mobile-delivery-address";

// Bảng màu chuẩn Bách Hóa Xanh
const BHX_GREEN = "#008848";
const BHX_DARK_GREEN = "#006837";
const BHX_YELLOW = "#ffd400";
const BHX_RED = "#d32f2f";
const BHX_ORANGE = "#f57c00";
const TEXT_DARK = "#1a202c";
const TEXT_MUTED = "#64748b";
const BORDER_COLOR = "#e2e8f0";
const BG_PAGE = "#f1f5f9";

const imageUrl = (path) => !path ? null : path.startsWith("http") ? path : `${API_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`;
const money = (value) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value || 0);
const productPriceLabel = (product, price = product.price) => `${money(price)}${product.unitName ? `/${product.unitName}` : ""}`;
const stockLimit = (product) => Number.isFinite(product?.stockQuantity) ? Math.max(0, Math.floor(product.stockQuantity)) : 0;

function ProductStock({ product, style = styles.stockLabel }) {
  if (product.stockQuantity == null) return null;
  return <Text style={style}>Còn: {product.stockQuantity}{product.unitName ? ` ${product.unitName}` : ""}</Text>;
}

const productDiscountAmount = (product) => Math.max(0, product.discountAmount ?? ((product.originalPrice ?? product.price) - product.price));
const eventPromotionIssue = (promotion, orderAmount) => {
  if (orderAmount <= 0) return "Thêm sản phẩm vào giỏ để sử dụng ưu đãi.";
  const minimum = Number(promotion.minOrderAmount) || 0;
  return orderAmount < minimum ? `Mua thêm ${money(minimum - orderAmount)} để sử dụng ưu đãi.` : "";
};

const QUICK_TAGS = ["Thịt tươi", "Rau sạch", "Cá hồi", "Bia Tiger", "Dầu ăn", "Mì Hảo Hảo", "Nước ngọt"];

const BANNERS = [
  {
    id: 1,
    tag: "GIÁ SỐC HÔM NAY",
    title: "Thực Phẩm Tươi Sống Mỗi Ngày",
    subtitle: "Giảm đến 30% thịt heo, thịt bò & rau củ sạch",
    code: "CHOTUOI30",
    bg: BHX_DARK_GREEN,
  },
  {
    id: 2,
    tag: "GIAO NHANH 2H",
    title: "Miễn Phí Vận Chuyển Toàn Thành Phố",
    subtitle: "Áp dụng cho mọi đơn từ 150.000đ",
    code: "FREESHIP150",
    bg: "#006699",
  },
  {
    id: 3,
    tag: "ĐẶC QUYỀN THÀNH VIÊN",
    title: "Tích Điểm Đổi Quà Thả Ga",
    subtitle: "Tích lũy 1 điểm = 1.000đ trừ trực tiếp vào đơn hàng",
    code: "EMART20",
    bg: "#b74700",
  },
];

function ProductImage({ imagePath, productId, categoryName, style }) {
  // Loại bỏ hoàn toàn fallback default.jpg và các ảnh anime placeholder
  const isWaifuOrPlaceholder = (path) => {
    if (!path) return true;
    const lower = String(path).toLowerCase();
    return lower.includes("default.jpg") || lower.includes("temp-") || lower.includes("product-81") || lower.includes("product-82") || lower.includes("product-83");
  };

  const validPath = isWaifuOrPlaceholder(imagePath) ? null : imageUrl(imagePath);
  const candidateProductImg = productId && productId !== 81 && productId !== 82 && productId !== 83 
    ? `${API_ORIGIN}/assets/images/products/product-${productId}.jpg` 
    : null;

  const candidates = [validPath, candidateProductImg].filter((uri, index, all) => uri && all.indexOf(uri) === index);
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => setCandidateIndex(0), [imagePath, productId]);

  const uri = candidates[candidateIndex];
  if (!uri || candidateIndex >= candidates.length) {
    return (
      <View style={[style, { backgroundColor: "#f0fdf4", alignItems: "center", justifyContent: "center" }]}>
        {getCategoryIcon(categoryName, 36)}
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode="contain"
      onError={() => setCandidateIndex((index) => index + 1)}
    />
  );
}

async function readError(response) {
  const body = await response.json().catch(() => ({}));
  return body.message || body.title || "Không kết nối được cửa hàng. Hãy kiểm tra backend và địa chỉ API.";
}

function AppButton({ title, onPress, secondary = false, disabled = false, style }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.button, secondary && styles.buttonSecondary, disabled && styles.buttonDisabled, style]}>
      <Text style={[styles.buttonText, secondary && styles.buttonSecondaryText]}>{title}</Text>
    </Pressable>
  );
}

function ProductCard({ product, cartQty = 0, onAdd, onQuantityChange, onOpen, cardWidthStyle }) {
  const originalPrice = product.originalPrice ?? product.price;
  const isHot = (product.id % 2 === 0);
  const discountPercent = originalPrice > 0 ? Math.max(0, Math.round(((originalPrice - product.price) / originalPrice) * 100)) : 0;

  return (
    <View style={[styles.productCard, cardWidthStyle, cartQty > 0 && styles.productCardActive]}>
      <Pressable style={styles.productImageBox} onPress={() => onOpen(product)} accessibilityRole="button" accessibilityLabel={`Xem chi tiết ${product.productName}`}>
        <ProductImage
          imagePath={product.imageUrl}
          productId={product.id}
          categoryName={product.categoryName}
          style={styles.productImage}
        />
        <View style={styles.badgeRow}>
          {discountPercent > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>-{discountPercent}%</Text>
            </View>
          )}
          {isHot && (
            <View style={styles.hotBadge}>
              <Text style={styles.hotBadgeText}>HOT</Text>
            </View>
          )}
        </View>
      </Pressable>

      <View style={styles.productBody}>
        <Text style={styles.productCategory} numberOfLines={1}>{product.categoryName || "BÁCH HÓA"}</Text>
        <Text style={styles.productName} numberOfLines={2}>{product.productName}</Text>
        <View style={styles.priceContainer}>
          <Text style={styles.productPrice}>{productPriceLabel(product)}</Text>
          {originalPrice > product.price && (
            <Text style={styles.originalPrice}>{productPriceLabel(product, originalPrice)}</Text>
          )}
        </View>

        <ProductStock product={product} />
        {/* Smart Stepper Control */}
        <View style={styles.stepperContainer}>
          {cartQty === 0 ? (
            <Pressable
              accessibilityLabel={`Thêm ${product.productName} vào giỏ`}
              onPress={() => onAdd(product)}
              disabled={stockLimit(product) === 0}
              style={[styles.addCartBtn, stockLimit(product) === 0 && styles.buttonDisabled]}
            >
              <IconCart size={13} color="#ffffff" />
              <Text style={styles.addCartBtnText}>CHỌN MUA</Text>
            </Pressable>
          ) : (
            <View style={styles.stepperBox}>
              <Pressable
                accessibilityLabel={`Bớt ${product.productName}`}
                onPress={() => onQuantityChange(product.id, -1)}
                style={styles.stepperBtn}
              >
                <IconMinus size={12} color={BHX_GREEN} />
              </Pressable>
              <Text style={styles.stepperQtyText}>{cartQty}</Text>
              <Pressable
                accessibilityLabel={`Thêm ${product.productName}`}
                onPress={() => onQuantityChange(product.id, 1)}
                disabled={cartQty >= stockLimit(product)}
                style={[styles.stepperBtn, styles.stepperBtnPlus, cartQty >= stockLimit(product) && styles.buttonDisabled]}
              >
                <IconPlus size={12} color="#ffffff" />
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function ProductDetails({ product, products = [], quantity, onClose, onAdd, onQuantityChange, onViewCart, onOpen }) {
  const relatedProducts = product.categoryId == null ? [] : products.filter((item) => (
    String(item.categoryId) === String(product.categoryId) && String(item.id) !== String(product.id)
  ));
  return (
    <SafeAreaView style={styles.productDetailScreen}>
      <View style={styles.productDetailHeader}>
        <Pressable onPress={onClose} style={styles.productDetailBack} accessibilityRole="button" accessibilityLabel="Quay lại">
          <View style={{ transform: [{ rotate: "180deg" }] }}><IconChevronRight size={24} color={TEXT_DARK} /></View>
        </Pressable>
        <Text style={styles.productDetailHeaderTitle}>Chi tiết sản phẩm</Text>
      </View>
      <ScrollView contentContainerStyle={styles.productDetailContent}>
        <View style={styles.productDetailImageBox}>
          <ProductImage imagePath={product.imageUrl} productId={product.id} categoryName={product.categoryName} style={styles.productDetailImage} />
        </View>
        <View style={styles.productDetailInfo}>
          <Text style={styles.eyebrow}>{product.categoryName || "Sản phẩm"}</Text>
          <Text style={styles.productDetailName}>{product.productName}</Text>
          <View style={styles.productDetailPriceBlock}>
            <View style={styles.productDetailPriceRow}>
              <Text style={styles.productDetailPrice}>{productPriceLabel(product)}</Text>
              {product.originalPrice > product.price && <Text style={styles.productDetailOriginalPrice}>{productPriceLabel(product, product.originalPrice)}</Text>}
            </View>
            {productDiscountAmount(product) > 0 && <Text style={styles.productDetailSaving}>Tiết kiệm {money(productDiscountAmount(product))}</Text>}
          </View>
          <ProductStock product={product} style={styles.productDetailStock} />
          {product.promotionName && <Text style={styles.productDetailStock}>{product.promotionName}</Text>}
          {product.description && <Text style={styles.productDetailDescription}>{product.description}</Text>}
        </View>
        <View style={styles.relatedProductsSection}>
          <Text style={styles.relatedProductsTitle}>Sản phẩm liên quan</Text>
          {relatedProducts.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedProductsRow}>
              {relatedProducts.map((item) => (
                <Pressable key={item.id} onPress={() => onOpen(item)} style={styles.relatedProductCard} accessibilityRole="button" accessibilityLabel={`Xem chi tiết ${item.productName}`}>
                  <View style={styles.relatedProductImageBox}>
                    <ProductImage imagePath={item.imageUrl} productId={item.id} categoryName={item.categoryName} style={styles.productImage} />
                  </View>
                  <Text style={styles.relatedProductName} numberOfLines={2}>{item.productName}</Text>
                  <Text style={styles.relatedProductPrice}>{productPriceLabel(item)}</Text>
                  <ProductStock product={item} />
                </Pressable>
              ))}
            </ScrollView>
          ) : <Text style={styles.productDetailDescription}>Chưa có sản phẩm cùng loại khác.</Text>}
        </View>
      </ScrollView>
      <View style={styles.productDetailAction}>
        {quantity > 0 ? (
          <View style={styles.productDetailQuantityControl}>
            <Pressable onPress={() => onQuantityChange(product.id, -1)} style={styles.productDetailQuantityButton} accessibilityRole="button" accessibilityLabel="Giảm số lượng">
              <IconMinus size={20} color={BHX_GREEN} />
            </Pressable>
            <Text style={styles.productDetailQuantityValue}>{quantity}</Text>
            <Pressable onPress={() => onAdd(product)} disabled={quantity >= stockLimit(product)} style={[styles.productDetailQuantityButton, quantity >= stockLimit(product) && styles.buttonDisabled]} accessibilityRole="button" accessibilityLabel="Tăng số lượng">
              <IconPlus size={20} color={BHX_GREEN} />
            </Pressable>
          </View>
        ) : <AppButton title="Thêm vào giỏ hàng" disabled={stockLimit(product) === 0} onPress={() => onAdd(product)} />}
        {quantity > 0 && quantity >= stockLimit(product) && <Text style={styles.stateText}>Đã chọn tối đa số lượng còn trong kho.</Text>}
        {quantity > 0 && <AppButton title="Xem giỏ hàng" onPress={onViewCart} />}
      </View>
    </SafeAreaView>
  );
}

function CustomerInvoice({ order, token, onClose }) {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setInvoice(null);
    const load = async () => {
      try {
        if (!token) throw new Error("Vui lòng đăng nhập để xem hóa đơn.");
        const response = await fetch(`${API_URL}/storefront/orders/${order.id}/invoice`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(await readError(response));
        const data = await response.json();
        if (active) setInvoice(data);
      } catch (err) {
        if (active) setError(err.message || "Không tải được hóa đơn.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [order.id, token, retry]);

  const paymentLabels = { paid: "Đã thanh toán", pending: "Chờ thanh toán", failed: "Thất bại", refunded: "Đã hoàn tiền" };
  const invoiceLabels = { issued: "Đã phát hành", paid: "Đã thanh toán", voided: "Đã hủy", refunded: "Đã hoàn tiền" };
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.ordersScreen}>
        <View style={styles.orderDetailHeading}>
          <Pressable onPress={onClose} style={styles.orderBack} accessibilityRole="button" accessibilityLabel="Đóng hóa đơn"><Text style={styles.orderBackText}>‹</Text></Pressable>
          <Text style={styles.orderDetailTitle}>Hóa đơn</Text>
        </View>
        {loading ? <View style={styles.centerState}><ActivityIndicator color={BHX_GREEN} /><Text style={styles.stateText}>Đang tải hóa đơn...</Text></View> : error ? (
          <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text><AppButton title="Thử lại" onPress={() => setRetry((value) => value + 1)} /></View>
        ) : invoice && (
          <ScrollView contentContainerStyle={styles.orderDetailContent}>
            <View style={styles.responsiveContainer}>
              <View style={styles.orderInfoCard}>
                <Text style={styles.pageTitle}>{invoice.invoiceNumber}</Text>
                <Text style={styles.invoiceText}>Đơn hàng: {invoice.orderNumber}</Text>
                <Text style={styles.invoiceText}>Ngày lập: {new Date(invoice.issuedAt).toLocaleString("vi-VN")}</Text>
                <Text style={styles.invoiceText}>Hóa đơn: {invoiceLabels[invoice.invoiceStatus] || invoice.invoiceStatus}</Text>
                <Text style={styles.invoiceText}>Thanh toán: {paymentLabels[invoice.paymentStatus] || invoice.paymentStatus}</Text>
              </View>
              <View style={styles.orderInfoCard}>
                <Text style={styles.orderInfoLabel}>Thông tin khách hàng</Text>
                <Text style={styles.invoiceText}>{invoice.customerName || "Khách lẻ"}</Text>
                {!!invoice.customerPhone && <Text style={styles.invoiceText}>Điện thoại: {invoice.customerPhone}</Text>}
                {!!invoice.customerEmail && <Text style={styles.invoiceText}>Email: {invoice.customerEmail}</Text>}
                {!!invoice.customerAddress && <Text style={styles.invoiceText}>Địa chỉ: {invoice.customerAddress}</Text>}
              </View>
              <View style={styles.orderItemsCard}>
                {(invoice.items || []).map((item, index) => (
                  <View key={`${item.sku}-${index}`} style={styles.orderItemRow}>
                    <View style={styles.orderItemInfo}><Text style={styles.orderItemName}>{item.productName}</Text><Text style={styles.orderItemQuantity}>{item.quantity} × {money(item.unitPrice)}</Text></View>
                    <Text style={styles.orderItemPrice}>{money(item.totalPrice)}</Text>
                  </View>
                ))}
                <View style={styles.orderTotals}>
                  {[["Tạm tính", money(invoice.subtotal)], ["Thuế", money(invoice.taxAmount)], ["Phí giao hàng", money(invoice.feeAmount)], ["Giảm giá", `−${money(invoice.discount)}`]].map(([label, value]) => (
                    <View key={label} style={styles.summaryLine}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>
                  ))}
                  <View style={styles.summaryTotal}><Text style={styles.summaryTotalLabel}>Tổng cộng</Text><Text style={styles.summaryTotalValue}>{money(invoice.totalAmount)}</Text></View>
                </View>
              </View>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

export default function App() {
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;
  const isWide = windowWidth >= 1024;

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [tab, setTab] = useState("home");
  const [bannerIndex, setBannerIndex] = useState(0);

  // Bộ lọc & Sắp xếp
  const [sortOption, setSortOption] = useState("default");
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [selectedDrawerCatId, setSelectedDrawerCatId] = useState("all");
  const [drawerSearchText, setDrawerSearchText] = useState("");

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState({ fullName: "", phone: "", address: "", note: "" });
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [completedOrder, setCompletedOrder] = useState(null);

  const [customerOrders, setCustomerOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [orderFilter, setOrderFilter] = useState("all");

  const [customer, setCustomer] = useState(null);
  const [customerToken, setCustomerToken] = useState("");
  const [accountReady, setAccountReady] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerMode, setRegisterMode] = useState(false);
  const [registerFullName, setRegisterFullName] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountAddress, setAccountAddress] = useState("");
  const [accountDateOfBirth, setAccountDateOfBirth] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [accountMessage, setAccountMessage] = useState("");
  const [profilePage, setProfilePage] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState({ city: "", ward: "", street: "", otherReceiver: false });
  const [addressMessage, setAddressMessage] = useState("");

  const [voucherOpen, setVoucherOpen] = useState(false);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherList, setVoucherList] = useState([]);
  const [voucherBusy, setVoucherBusy] = useState(false);
  const [voucherMessage, setVoucherMessage] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState(null);

  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [useRewardPoints, setUseRewardPoints] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Auto scroll banner
  useEffect(() => {
    const timer = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % BANNERS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(ADDRESS_KEY).then((stored) => {
      if (!stored) return;
      const address = JSON.parse(stored);
      setDeliveryAddress(address);
      setCheckoutForm((form) => ({ ...form, address: [address.street, address.ward, address.city].filter(Boolean).join(", ") }));
    }).catch(() => { });
  }, []);

  const loadStore = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [productsResponse, categoriesResponse] = await Promise.all([
        fetch(`${API_URL}/storefront/products`),
        fetch(`${API_URL}/storefront/categories`),
      ]);
      if (!productsResponse.ok) throw new Error(await readError(productsResponse));
      if (!categoriesResponse.ok) throw new Error(await readError(categoriesResponse));
      const [productData, categoryData] = await Promise.all([productsResponse.json(), categoriesResponse.json()]);
      setProducts(Array.isArray(productData) ? productData : []);
      setCategories(Array.isArray(categoryData) ? categoryData : []);
    } catch (error) {
      setLoadError(error.message || "Không thể tải sản phẩm.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStore(); }, [loadStore]);

  useEffect(() => {
    AsyncStorage.getItem(CART_KEY)
      .then((stored) => setCart(stored ? JSON.parse(stored) : []))
      .catch(() => setCart([]))
      .finally(() => setCartLoaded(true));
  }, []);

  useEffect(() => {
    if (cartLoaded) AsyncStorage.setItem(CART_KEY, JSON.stringify(cart)).catch(() => { });
  }, [cart, cartLoaded]);

  useEffect(() => {
    if (!cartLoaded || loading || loadError) return;
    setCart((current) => {
      const adjusted = current.map((item) => ({
        ...item,
        quantity: Math.min(item.quantity, stockLimit(products.find((product) => product.id === item.id))),
      })).filter((item) => item.quantity > 0);
      return adjusted.length === current.length && adjusted.every((item, index) => item.quantity === current[index].quantity) ? current : adjusted;
    });
  }, [products, cartLoaded, loading, loadError]);

  useEffect(() => {
    let active = true;
    const restoreAccount = async () => {
      try {
        const values = await AsyncStorage.multiGet([CUSTOMER_TOKEN_KEY, CUSTOMER_KEY]);
        const token = values[0][1];
        const storedCustomer = values[1][1] ? JSON.parse(values[1][1]) : null;
        if (!token || !storedCustomer) return;

        const response = await fetch(`${API_URL}/storefront/account`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Phiên đăng nhập đã hết hạn.");
        const profile = await response.json();
        if (!active) return;
        setCustomer(profile);
        setCustomerToken(token);
        setAccountName(profile.fullName || "");
        setAccountEmail(profile.email || "");
        setAccountAddress(profile.address || "");
        setAccountDateOfBirth(profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : "");
        setCheckoutForm((form) => ({ ...form, fullName: profile.fullName || "", phone: profile.phone || "" }));
      } catch {
        await AsyncStorage.multiRemove([CUSTOMER_TOKEN_KEY, CUSTOMER_KEY]).catch(() => { });
      } finally {
        if (active) setAccountReady(true);
      }
    };
    restoreAccount();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (tab !== "orders" || !customerToken) return undefined;
    let active = true;
    setOrdersLoading(true);
    setOrdersError("");
    fetch(`${API_URL}/storefront/orders`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response));
        return response.json();
      })
      .then((data) => { if (active) setCustomerOrders(Array.isArray(data) ? data : []); })
      .catch((error) => { if (active) setOrdersError(error.message || "Không thể tải lịch sử đơn hàng."); })
      .finally(() => { if (active) setOrdersLoading(false); });
    return () => { active = false; };
  }, [tab, customerToken, ordersRefreshKey]);

  const loginCustomer = async () => {
    const username = loginUsername.trim();
    if (username.length < 3 || loginPassword.length < 6) {
      setAccountError("Vui lòng nhập tên đăng nhập và mật khẩu hợp lệ.");
      return;
    }

    setAccountBusy(true);
    setAccountError("");
    setAccountMessage("");
    try {
      const response = await fetch(`${API_URL}/storefront/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: loginPassword }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const result = await response.json();
      await AsyncStorage.multiSet([
        [CUSTOMER_TOKEN_KEY, result.token],
        [CUSTOMER_KEY, JSON.stringify(result.customer)],
      ]);
      setCustomerToken(result.token);
      setCustomer(result.customer);
      setAccountName(result.customer.fullName || "");
      setAccountEmail(result.customer.email || "");
      setAccountAddress(result.customer.address || "");
      setAccountDateOfBirth(result.customer.dateOfBirth ? result.customer.dateOfBirth.slice(0, 10) : "");
      setCheckoutForm((form) => ({ ...form, fullName: result.customer.fullName || "", phone: result.customer.phone }));
      setAccountMessage("Đăng nhập thành công.");
    } catch (error) {
      setAccountError(error.message || "Không thể đăng nhập.");
    } finally {
      setAccountBusy(false);
    }
  };

  const registerCustomer = async () => {
    const username = loginUsername.trim();
    const fullName = registerFullName.trim();
    const phone = registerPhone.trim();
    if (username.length < 3 || loginPassword.length < 6 || fullName.length < 2) {
      setAccountError("Vui lòng nhập tên đăng nhập, mật khẩu và họ tên hợp lệ.");
      return;
    }
    if (!/^(0|\+84)[35789]\d{8}$/.test(phone)) {
      setAccountError("Số điện thoại Việt Nam chưa đúng định dạng.");
      return;
    }

    setAccountBusy(true);
    setAccountError("");
    setAccountMessage("");
    try {
      const response = await fetch(`${API_URL}/storefront/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: loginPassword, fullName, phone }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const result = await response.json();
      await AsyncStorage.multiSet([
        [CUSTOMER_TOKEN_KEY, result.token],
        [CUSTOMER_KEY, JSON.stringify(result.customer)],
      ]);
      setCustomerToken(result.token);
      setCustomer(result.customer);
      setAccountName(result.customer.fullName || "");
      setCheckoutForm((form) => ({ ...form, fullName: result.customer.fullName || "", phone: result.customer.phone || "" }));
      setAccountMessage("Tạo tài khoản thành công.");
    } catch (error) {
      setAccountError(error.message || "Không thể tạo tài khoản.");
    } finally {
      setAccountBusy(false);
    }
  };

  const saveAccountName = async () => {
    const fullName = accountName.trim();
    if (fullName.length < 2) {
      setAccountError("Họ tên cần có ít nhất 2 ký tự.");
      return;
    }

    setAccountBusy(true);
    setAccountError("");
    setAccountMessage("");
    try {
      const response = await fetch(`${API_URL}/storefront/account`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${customerToken}`,
        },
        body: JSON.stringify({
          fullName,
          email: accountEmail.trim() || null,
          address: accountAddress.trim() || null,
          dateOfBirth: accountDateOfBirth || null,
        }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const profile = await response.json();
      await AsyncStorage.setItem(CUSTOMER_KEY, JSON.stringify(profile));
      setCustomer(profile);
      setAccountEmail(profile.email || "");
      setAccountAddress(profile.address || "");
      setAccountDateOfBirth(profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : "");
      setCheckoutForm((form) => ({ ...form, fullName: profile.fullName }));
      setAccountMessage("Đã cập nhật họ tên.");
    } catch (error) {
      setAccountError(error.message || "Không thể lưu thông tin tài khoản.");
    } finally {
      setAccountBusy(false);
    }
  };

  const saveDeliveryAddress = async () => {
    if (!deliveryAddress.city.trim() || !deliveryAddress.ward.trim() || !deliveryAddress.street.trim()) {
      setAddressMessage("Vui lòng nhập tỉnh/thành phố, phường/xã và số nhà, tên đường.");
      return;
    }
    const address = { ...deliveryAddress, city: deliveryAddress.city.trim(), ward: deliveryAddress.ward.trim(), street: deliveryAddress.street.trim() };
    await AsyncStorage.setItem(ADDRESS_KEY, JSON.stringify(address));
    setDeliveryAddress(address);
    setCheckoutForm((form) => ({ ...form, address: [address.street, address.ward, address.city].join(", ") }));
    setAddressMessage("Đã lưu địa chỉ nhận hàng.");
  };

  const logoutCustomer = () => {
    Alert.alert("Đăng xuất", "Bạn muốn đăng xuất khỏi tài khoản này?", [
      { text: "Ở lại", style: "cancel" },
      {
        text: "Đăng xuất",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.multiRemove([CUSTOMER_TOKEN_KEY, CUSTOMER_KEY]);
          setCustomer(null);
          setCustomerToken("");
          setAccountName("");
          setAccountEmail("");
          setAccountAddress("");
          setAccountDateOfBirth("");
          setLoginUsername("");
          setLoginPassword("");
          setRegisterFullName("");
          setRegisterPhone("");
          setAccountError("");
          setAccountMessage("");
          setCheckoutForm((form) => ({ ...form, fullName: "", phone: "" }));
        },
      },
    ]);
  };

  // Lọc và Sắp xếp danh sách sản phẩm
  const visibleProducts = useMemo(() => {
    let result = products.filter((product) => {
      const matchesSearch = product.productName?.toLowerCase().includes(query.trim().toLowerCase());
      const matchesCategory = categoryId === "all" || String(product.categoryId) === String(categoryId);
      return matchesSearch && matchesCategory;
    });

    if (sortOption === "price_asc") {
      result = [...result].sort((a, b) => a.price - b.price);
    } else if (sortOption === "price_desc") {
      result = [...result].sort((a, b) => b.price - a.price);
    } else if (sortOption === "hot") {
      result = [...result].sort((a, b) => (a.id % 2 === 0 ? -1 : 1));
    }
    return result;
  }, [products, query, categoryId, sortOption]);

  const activeDrawerCategory = useMemo(() => (
    categories.find((category) => String(category.id) === String(selectedDrawerCatId))
  ), [categories, selectedDrawerCatId]);

  const drawerProducts = useMemo(() => {
    const keyword = drawerSearchText.trim().toLocaleLowerCase("vi-VN");
    return products.filter((product) => (
      (selectedDrawerCatId === "all" || String(product.categoryId) === String(selectedDrawerCatId))
      && (product.productName || "").toLocaleLowerCase("vi-VN").includes(keyword)
    ));
  }, [products, selectedDrawerCatId, drawerSearchText]);

  const cartItemMap = useMemo(() => {
    const map = {};
    for (const item of cart) {
      map[item.id] = item.quantity;
    }
    return map;
  }, [cart]);

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const productDiscount = cart.reduce((sum, item) => sum + productDiscountAmount(item) * item.quantity, 0);
  const originalSubtotal = subtotal + productDiscount;
  const voucherDiscount = appliedVoucher?.discountAmount || 0;
  const afterVoucher = Math.max(0, subtotal - voucherDiscount);
  const maxPointsUsable = Math.min(customer?.rewardPoints || 0, Math.floor(afterVoucher / 1000));
  const pointsDiscount = useRewardPoints ? maxPointsUsable * 1000 : 0;
  const payable = Math.max(0, afterVoucher - pointsDiscount);

  const openVouchers = async () => {
    setVoucherOpen(true);
    setVoucherMessage("");
    try {
      const response = await fetch(`${API_URL}/storefront/promotions`);
      if (!response.ok) throw new Error(await readError(response));
      const data = await response.json();
      setVoucherList(Array.isArray(data) ? data.filter((promotion) => promotion.type === "event") : []);
    } catch (error) {
      setVoucherMessage(error.message || "Không tải được phiếu mua hàng.");
    }
  };

  const applyVoucher = async (code = voucherCode, eventPromotionId = null) => {
    const normalizedCode = code.trim();
    if (!eventPromotionId && !normalizedCode) { setVoucherMessage("Nhập mã voucher."); return; }
    if (eventPromotionId) {
      const promotion = voucherList.find((item) => item.id === eventPromotionId);
      const issue = promotion ? eventPromotionIssue(promotion, subtotal) : "Ưu đãi không còn khả dụng. Vui lòng mở lại danh sách.";
      if (issue) { setVoucherMessage(issue); return; }
    }
    setVoucherBusy(true);
    setVoucherMessage("");
    try {
      const response = await fetch(`${API_URL}/storefront/promotions/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: eventPromotionId ? "" : normalizedCode, eventPromotionId, orderAmount: subtotal }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.isValid) throw new Error(result.message || "Phiếu mua hàng không hợp lệ.");
      setAppliedVoucher({ code: eventPromotionId ? null : normalizedCode, eventPromotionId, discountAmount: result.discountAmount, promotion: result.promotion });
      if (!eventPromotionId) setVoucherCode(normalizedCode);
      setVoucherMessage(`Đã áp dụng ${money(result.discountAmount)} giảm giá.`);
      setVoucherOpen(false);
    } catch (error) {
      setAppliedVoucher(null);
      setVoucherMessage(error.message || "Không thể áp dụng phiếu mua hàng.");
    } finally {
      setVoucherBusy(false);
    }
  };

  const requireAuthenticatedCustomer = () => {
    if (customer && customerToken) return true;
    setProfilePage("");
    setTab("profile");
    return false;
  };

  const addToCart = (product) => {
    if (loading || loadError) return;
    const available = stockLimit(products.find((item) => item.id === product.id));
    if (available === 0) return;
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      if (found && found.quantity >= available) return current;
      if (found) return current.map((item) => item.id === product.id ? {
        ...item,
        price: product.price,
        unitName: product.unitName,
        originalPrice: product.originalPrice,
        discountAmount: productDiscountAmount(product),
        quantity: item.quantity + 1,
      } : item);
      return [...current, {
        id: product.id,
        name: product.productName,
        price: product.price,
        unitName: product.unitName,
        originalPrice: product.originalPrice,
        discountAmount: productDiscountAmount(product),
        image: product.imageUrl,
        quantity: 1,
      }];
    });
  };

  const changeQuantity = (id, amount) => {
    if (amount > 0 && (loading || loadError)) return;
    const available = stockLimit(products.find((product) => product.id === id));
    setCart((current) => current
      .map((item) => item.id === id ? {
        ...item,
        quantity: amount > 0 ? Math.min(item.quantity + amount, available) : item.quantity + amount,
      } : item)
      .filter((item) => item.quantity > 0));
  };

  const getCartQuantity = (productId) => cart.find((item) => item.id === productId)?.quantity || 0;

  const renderProductDetails = () => selectedProduct && (
    <ProductDetails
      key={selectedProduct.id}
      product={products.find((product) => product.id === selectedProduct.id) || { ...selectedProduct, stockQuantity: 0 }}
      products={products}
      onOpen={setSelectedProduct}
      quantity={getCartQuantity(selectedProduct.id)}
      onClose={() => setSelectedProduct(null)}
      onAdd={addToCart}
      onQuantityChange={changeQuantity}
      onViewCart={() => {
        setSelectedProduct(null);
        setCategoryModalOpen(false);
        setTab("cart");
      }}
    />
  );

  const submitOrder = async () => {
    if (!requireAuthenticatedCustomer()) {
      setCheckoutOpen(false);
      return;
    }
    if (!checkoutForm.fullName.trim() || !checkoutForm.phone.trim() || !checkoutForm.address.trim()) {
      setOrderError("Nhập họ tên, số điện thoại và địa chỉ nhận hàng.");
      return;
    }
    if (!/^(0|\+84)[35789]\d{8}$/.test(checkoutForm.phone.trim())) {
      setOrderError("Số điện thoại Việt Nam chưa đúng định dạng.");
      return;
    }
    if (!cart.length) return;
    setOrderSubmitting(true);
    setOrderError("");
    try {
      const response = await fetch(`${API_URL}/storefront/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${customerToken}`,
        },
        body: JSON.stringify({
          ...checkoutForm,
          fullName: customer?.fullName?.trim() || checkoutForm.fullName.trim(),
          phone: customer?.phone || checkoutForm.phone.trim(),
          paymentMethod,
          pointsUsed: useRewardPoints ? maxPointsUsable : 0,
          items: cart.map((item) => ({ productId: item.id, quantity: item.quantity })),
          promotionCode: appliedVoucher?.code || null,
          eventPromotionId: appliedVoucher?.eventPromotionId || null,
        }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const result = await response.json();
      setCompletedOrder({
        ...result,
        paymentMethod,
        pointsDiscount,
        vietQrUrl: result.vietQrUrl || (paymentMethod === "bank" ? `https://img.vietqr.io/image/MB-0987654321-compact2.png?amount=${result.totalAmount}&addInfo=EMART_${result.orderNumber}&accountName=EMART%20STORE` : null)
      });
      if (customer && useRewardPoints && maxPointsUsable > 0) {
        setCustomer((prev) => prev ? ({ ...prev, rewardPoints: Math.max(0, (prev.rewardPoints || 0) - maxPointsUsable) }) : null);
      }
      const placedOrder = {
        ...result,
        paymentMethod,
        note: `Người nhận: ${customer?.fullName?.trim() || checkoutForm.fullName.trim()}\nSố điện thoại: ${customer?.phone || checkoutForm.phone.trim()}\nĐịa chỉ giao hàng: ${checkoutForm.address.trim()}${checkoutForm.note.trim() ? `\nGhi chú: ${checkoutForm.note.trim()}` : ""}`,
        paymentStatus: "pending",
        orderType: "mobile",
        items: cart.map((item) => ({
          productId: item.id,
          productName: item.name,
          imageUrl: item.image,
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice: item.price * item.quantity,
        })),
      };
      setCustomerOrders((current) => [placedOrder, ...current.filter((order) => order.id !== placedOrder.id)]);
      setCart([]);
      void loadStore();
      setUseRewardPoints(false);
    } catch (error) {
      setOrderError(error.message || "Không thể gửi đơn hàng. Kiểm tra kết nối rồi thử lại.");
    } finally {
      setOrderSubmitting(false);
    }
  };

  const currentBanner = BANNERS[bannerIndex];

  // Dynamic responsive card styles
  const cardWidthStyle = useMemo(() => {
    if (isWide) return { width: "18.8%" };
    if (isDesktop) return { width: "23.5%" };
    return { width: "48.5%" }; // 2 cột trên điện thoại
  }, [isDesktop, isWide]);

  const categoryItemWidthStyle = useMemo(() => {
    return { width: isDesktop ? 104 : 86 };
  }, [isDesktop]);

  const renderHome = () => (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.responsiveContainer}>
        {/* 1. HERO BANNER BÁCH HÓA XANH */}
        <View style={[styles.heroBanner, { backgroundColor: currentBanner.bg }]}>
          <View style={styles.bannerInfo}>
            <View style={styles.bannerBadgePill}>
              <IconFlash size={11} color={BHX_YELLOW} />
              <Text style={styles.bannerBadgeText}>{currentBanner.tag}</Text>
            </View>
            <Text style={styles.bannerTitle} numberOfLines={1}>{currentBanner.title}</Text>
            <Text style={styles.bannerSubtitle} numberOfLines={2}>{currentBanner.subtitle}</Text>

            <Pressable
              onPress={openVouchers}
              style={styles.bannerCtaBtn}
            >
              <Text style={styles.bannerCtaText}>Xem ưu đãi  ›</Text>
            </Pressable>
          </View>

          {/* Carousel Pagination Dots */}
          <View style={styles.bannerDots}>
            {BANNERS.map((banner, i) => (
              <Pressable
                key={banner.id}
                onPress={() => setBannerIndex(i)}
                style={[styles.bannerDot, i === bannerIndex && styles.bannerDotActive]}
              />
            ))}
          </View>
        </View>

        {/* 2. DẢI CAM KẾT VÀNG SIÊU THỊ */}
  

        {/* Danh mục ngành hàng cuộn ngang */}
        <View style={styles.categorySectionHeader}>
          <View style={styles.categorySectionTitleRow}>
            <View style={styles.greenBar} />
            <Text style={styles.categorySectionTitle}>DANH MỤC NGÀNH HÀNG</Text>
          </View>
          <Pressable onPress={() => { setSelectedDrawerCatId("all"); setCategoryModalOpen(true); }} style={styles.openCategoryDrawerBtn}>
            <Text style={styles.openCategoryDrawerText}>Xem phân loại</Text>
            <IconChevronRight size={14} color={BHX_GREEN} />
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={styles.categoryGridContainer}>
          {/* Nút Xem tất cả */}
          <Pressable
            onPress={() => setCategoryId("all")}
            style={[styles.categoryGridItem, categoryItemWidthStyle, categoryId === "all" && styles.categoryGridItemActive]}
          >
            <View style={styles.categoryIconWrap}>
              <CategoryAll size={32} />
            </View>
            <Text style={[styles.categoryGridText, categoryId === "all" && styles.categoryGridTextActive]} numberOfLines={2}>
              Tất cả
            </Text>
          </Pressable>

          {/* 10 Ngành hàng thực tế từ CSDL */}
          {categories.map((cat) => {
            const isSelected = String(categoryId) === String(cat.id);
            return (
              <Pressable
                key={cat.id}
                onPress={() => setCategoryId(String(cat.id))}
                style={[styles.categoryGridItem, categoryItemWidthStyle, isSelected && styles.categoryGridItemActive]}
              >
                <View style={styles.categoryIconWrap}>
                  {getCategoryIcon(cat.name, 32)}
                </View>
                <Text style={[styles.categoryGridText, isSelected && styles.categoryGridTextActive]} numberOfLines={2}>
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* 4. THANH TOOLBAR PHÂN LOẠI & SẮP XẾP SẢN PHẨM */}
        <View style={styles.filterToolbar}>
          <View style={styles.filterLeft}>
            <Text style={styles.filterResultCount} numberOfLines={1}>
              {categoryId === "all" ? "Tất cả sản phẩm" : (categories.find((c) => String(c.id) === String(categoryId))?.name || "Ngành hàng")}
              <Text style={styles.filterNumber}> ({visibleProducts.length})</Text>
            </Text>
          </View>

          {/* Các nút sắp xếp chuẩn siêu thị */}
          <View style={styles.sortPillsRow}>
            <Pressable
              onPress={() => setSortOption("default")}
              style={[styles.sortPill, sortOption === "default" && styles.sortPillActive]}
            >
              <Text style={[styles.sortPillText, sortOption === "default" && styles.sortPillTextActive]}>Phổ biến</Text>
            </Pressable>
            <Pressable
              onPress={() => setSortOption("hot")}
              style={[styles.sortPill, sortOption === "hot" && styles.sortPillActive]}
            >
              <Text style={[styles.sortPillText, sortOption === "hot" && styles.sortPillTextActive]}>Bán chạy</Text>
            </Pressable>
            <Pressable
              onPress={() => setSortOption(sortOption === "price_asc" ? "price_desc" : "price_asc")}
              style={[styles.sortPill, (sortOption === "price_asc" || sortOption === "price_desc") && styles.sortPillActive]}
            >
              <IconSort size={11} color={sortOption.startsWith("price") ? "#ffffff" : TEXT_MUTED} />
              <Text style={[styles.sortPillText, (sortOption === "price_asc" || sortOption === "price_desc") && styles.sortPillTextActive]}>
                {sortOption === "price_desc" ? "Giá giảm" : "Giá tăng"}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* 5. DANH SÁCH SẢN PHẨM (PRODUCT GRID RESPONSIVE) */}
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={BHX_GREEN} />
            <Text style={styles.stateText}>Đang cập nhật thực phẩm tươi ngon...</Text>
          </View>
        ) : loadError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Chưa kết nối được cửa hàng</Text>
            <Text style={styles.errorText}>{loadError}</Text>
            <Text style={styles.apiHint}>API: {API_URL}</Text>
            <AppButton title="Thử kết nối lại" onPress={loadStore} />
          </View>
        ) : visibleProducts.length === 0 ? (
          <View style={styles.emptyState}>
            <IconCart size={50} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Chưa có sản phẩm phù hợp</Text>
            <Text style={styles.stateText}>Hãy chọn ngành hàng khác hoặc bấm xem tất cả.</Text>
            <AppButton title="Xem tất cả sản phẩm" onPress={() => { setQuery(""); setCategoryId("all"); }} style={styles.emptyCta} />
          </View>
        ) : (
          <View style={styles.productGrid}>
            {visibleProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                cartQty={cartItemMap[product.id] || 0}
                onAdd={addToCart}
                onQuantityChange={changeQuantity}
                onOpen={setSelectedProduct}
                cardWidthStyle={cardWidthStyle}
              />
            ))}
          </View>
        )}

        <View style={{ height: 35 }} />
      </View>
    </ScrollView>
  );

  const renderCart = () => (
    <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      <View style={styles.responsiveContainer}>
        <Text style={styles.eyebrow}>GIỎ HÀNG BÁCH HÓA XANH</Text>
        <Text style={styles.pageTitle}>{itemCount} mặt hàng trong giỏ</Text>

        {!cart.length ? (
          <View style={styles.emptyState}>
            <IconCart size={54} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Giỏ hàng đang trống</Text>
            <Text style={styles.stateText}>Hàng ngàn thực phẩm tươi ngon đang chờ bạn!</Text>
            <AppButton title="Đi chợ ngay" onPress={() => setTab("home")} style={styles.emptyCta} />
          </View>
        ) : (
          <View style={isDesktop ? styles.cartDesktopLayout : null}>
            <View style={isDesktop ? styles.cartItemListCol : null}>
              {cart.map((item) => (
                <View key={item.id} style={styles.cartRow}>
                  <View style={styles.cartThumb}>
                    <ProductImage imagePath={item.image} productId={item.id} style={styles.cartImage} />
                  </View>
                  <View style={styles.cartInfo}>
                    <Text style={styles.cartName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.cartPrice}>{productPriceLabel({ ...item, unitName: products.find((product) => product.id === item.id)?.unitName || item.unitName })}</Text>
                    <View style={styles.cartStepperRow}>
                      <Pressable onPress={() => changeQuantity(item.id, -1)} style={styles.cartStepperBtn}>
                        <IconMinus size={12} color="#334155" />
                      </Pressable>
                      <Text style={styles.cartStepperQty}>{item.quantity}</Text>
                      <Pressable onPress={() => changeQuantity(item.id, 1)} disabled={loading || !!loadError || item.quantity >= stockLimit(products.find((product) => product.id === item.id))} style={[styles.cartStepperBtn, styles.cartStepperBtnPlus, (loading || !!loadError || item.quantity >= stockLimit(products.find((product) => product.id === item.id))) && styles.buttonDisabled]}>
                        <IconPlus size={12} color="#ffffff" />
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            <View style={[styles.summaryCard, isDesktop ? styles.cartSummaryCol : null]}>
              <View style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>Tiền hàng</Text>
                <Text style={styles.summaryValue}>{money(subtotal)}</Text>
              </View>
              <View style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>Phí giao nhanh 2h</Text>
                <Text style={styles.freeShipping}>Miễn phí (0đ)</Text>
              </View>

              <Pressable style={styles.voucherRow} onPress={openVouchers}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <IconStar size={16} color={BHX_ORANGE} />
                  <Text style={styles.voucherLabel}>Phiếu giảm giá (Voucher)</Text>
                </View>
                <Text style={styles.voucherAction}>
                  {appliedVoucher ? `-${money(appliedVoucher.discountAmount)} · Đổi` : "Chọn mã  ›"}
                </Text>
              </Pressable>
              {appliedVoucher && (
                <Pressable onPress={() => setAppliedVoucher(null)}>
                  <Text style={styles.voucherRemove}>✕ Bỏ phiếu mua hàng</Text>
                </Pressable>
              )}

              <View style={styles.summaryTotal}>
                <Text style={styles.summaryTotalLabel}>Tổng thanh toán</Text>
                <Text style={styles.summaryTotalValue}>{money(payable)}</Text>
              </View>

              <AppButton title="Tiến hành đặt hàng  →" onPress={() => { setOrderError(""); setCompletedOrder(null); setCheckoutOpen(true); }} />
              <AppButton
                title="Xóa hết giỏ hàng"
                secondary
                onPress={() => Alert.alert("Xóa giỏ hàng", "Bạn có chắc muốn xóa tất cả sản phẩm khỏi giỏ?", [
                  { text: "Hủy", style: "cancel" },
                  { text: "Xóa hết", style: "destructive", onPress: () => { setCart([]); setAppliedVoucher(null); } }
                ])}
              />
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );

  const orderStatusLabel = (status) => ({
    pending: "Chờ xác nhận",
    processing: "Đang giao hàng",
    completed: "Giao thành công",
    cancelled: "Đã hủy",
    canceled: "Đã hủy",
  }[String(status || "").toLowerCase()] || status || "Đang xử lý");

  const orderAddress = (order) => {
    const match = (order.note || "").match(/Địa chỉ giao hàng:\s*([\s\S]*?)(?:\nGhi chú:|$)/i);
    return match?.[1]?.trim() || "Nhận hàng tại cửa hàng";
  };

  const visibleOrders = customerOrders.filter((order) => {
    const status = String(order.status || "").toLowerCase();
    if (orderFilter === "store") return order.orderType === "pos";
    if (orderFilter === "pending") return status === "pending" || status === "processing";
    if (orderFilter === "completed") return status === "completed";
    if (orderFilter === "cancelled") return status === "cancelled" || status === "canceled";
    return true;
  });

  const renderOrders = () => {
    if (selectedOrder) {
      const orderItems = selectedOrder.items || [];
      const address = orderAddress(selectedOrder);
      const purchasedAt = selectedOrder.createdAt
        ? new Date(selectedOrder.createdAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })
        : "";
      const paidAmount = String(selectedOrder.paymentStatus || "").toLowerCase() === "paid"
        ? selectedOrder.totalAmount
        : 0;

      return (
        <View style={styles.ordersScreen}>
          <View style={styles.orderDetailHeading}>
            <Pressable onPress={() => setSelectedOrder(null)} style={styles.orderBack}>
              <Text style={styles.orderBackText}>‹</Text>
            </Pressable>
            <Text style={styles.orderDetailTitle} numberOfLines={1}>Đơn hàng #{selectedOrder.orderNumber}</Text>
          </View>
          <ScrollView contentContainerStyle={styles.orderDetailContent} showsVerticalScrollIndicator={false}>
            <View style={styles.responsiveContainer}>
              <View style={styles.orderInfoCard}>
                <View style={styles.orderInfoTop}>
                  <Text style={styles.orderInfoLabel}>Địa chỉ nhận hàng</Text>
                  <Text style={styles.orderInfoDate}>{purchasedAt}</Text>
                </View>
                <Text style={styles.orderAddress}>{address}</Text>
                <Text style={styles.orderStatusText}>Trạng thái: {orderStatusLabel(selectedOrder.status)}</Text>
              </View>

              <View style={styles.orderItemsCard}>
                {orderItems.map((item, index) => (
                  <View key={`${item.productId}-${index}`} style={styles.orderItemRow}>
                    <View style={styles.orderItemImageBox}>
                      <ProductImage imagePath={item.imageUrl} productId={item.productId} style={styles.orderItemImage} />
                    </View>
                    <View style={styles.orderItemInfo}>
                      <Text style={styles.orderItemName}>{item.productName}</Text>
                      <Text style={styles.orderItemQuantity}>Số lượng: x{item.quantity}</Text>
                    </View>
                    <View style={styles.orderItemAmount}>
                      <Text style={styles.orderItemPrice}>{money(item.totalPrice ?? item.unitPrice * item.quantity)}</Text>
                      <Text style={styles.orderItemUnitPrice}>{money(item.unitPrice)}</Text>
                    </View>
                  </View>
                ))}
                <View style={styles.orderTotals}>
                  <View style={styles.summaryLine}>
                    <Text style={styles.summaryLabel}>Tổng đơn hàng</Text>
                    <Text style={styles.summaryValue}>{money(selectedOrder.totalAmount)}</Text>
                  </View>
                  <View style={styles.summaryLine}>
                    <Text style={styles.summaryLabel}>{paidAmount > 0 ? "Đã thanh toán" : "Thanh toán khi nhận"}</Text>
                    <Text style={styles.summaryValue}>{money(paidAmount || selectedOrder.totalAmount)}</Text>
                  </View>
                </View>
              </View>
              {String(selectedOrder.status).toLowerCase() === "completed" && <AppButton title="Xem hóa đơn" onPress={() => setInvoiceOrder(selectedOrder)} />}
            </View>
          </ScrollView>
        </View>
      );
    }

    const filters = [["all", "Tất cả"], ["pending", "Chờ giao"], ["completed", "Giao thành công"], ["cancelled", "Đã hủy"]];
    return (
      <View style={styles.ordersScreen}>
        <Text style={styles.ordersTitle}>Lịch sử đơn hàng</Text>
        <ScrollView horizontal style={styles.orderFilterScroll} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.orderFilterRow}>
          {filters.map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setOrderFilter(key)}
              style={[styles.orderFilterChip, orderFilter === key && styles.orderFilterChipActive]}
            >
              <Text style={[styles.orderFilterText, orderFilter === key && styles.orderFilterTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {ordersLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={BHX_GREEN} />
            <Text style={styles.stateText}>Đang tải lịch sử đơn hàng...</Text>
          </View>
        ) : ordersError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{ordersError}</Text>
            <AppButton title="Thử lại" onPress={() => setOrdersRefreshKey((key) => key + 1)} />
          </View>
        ) : !customer && customerOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <IconReceipt size={48} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Đăng nhập để xem đơn</Text>
            <Text style={styles.stateText}>Đơn hàng được lưu giữ an toàn theo số điện thoại của bạn.</Text>
            <AppButton title="Đăng nhập ngay" onPress={() => setTab("profile")} style={styles.emptyCta} />
          </View>
        ) : visibleOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <IconReceipt size={48} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Chưa có đơn hàng nào</Text>
            <Text style={styles.stateText}>Các đơn bạn vừa đặt sẽ hiển thị đầy đủ tại đây.</Text>
            <AppButton title="Bắt đầu mua sắm" onPress={() => setTab("home")} style={styles.emptyCta} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.orderListContent} showsVerticalScrollIndicator={false}>
            <View style={styles.responsiveContainer}>
              {visibleOrders.map((order) => {
                const items = order.items || [];
                return (
                  <View key={order.id || order.orderNumber} style={styles.orderListCard}>
                    <View style={styles.orderListHeader}>
                      <Text style={styles.orderListNumber} numberOfLines={1}>Đơn hàng #{order.orderNumber}</Text>
                      <Pressable onPress={() => setSelectedOrder(order)}>
                        <Text style={styles.orderViewLink}>Chi tiết  ›</Text>
                      </Pressable>
                    </View>
                    <View style={styles.orderPickup}>
                      <IconLocation size={14} color={BHX_GREEN} />
                      <Text style={styles.orderPickupText} numberOfLines={1}>{orderAddress(order)}</Text>
                    </View>
                    <Pressable onPress={() => setSelectedOrder(order)} style={styles.orderThumbnailRow}>
                      {items.slice(0, 6).map((item, index) => (
                        <View key={`${item.productId}-${index}`} style={styles.orderThumbnailBox}>
                          <ProductImage imagePath={item.imageUrl} productId={item.productId} style={styles.orderThumbnail} />
                          {index === 5 && items.length > 6 && (
                            <View style={styles.orderMoreOverlay}>
                              <Text style={styles.orderMoreText}>+{items.length - 6}</Text>
                            </View>
                          )}
                        </View>
                      ))}
                      {!items.length && <Text style={styles.orderItemQuantity}>Không có sản phẩm</Text>}
                    </Pressable>
                    <View style={styles.orderListTotals}>
                      <Text style={styles.orderListStatus}>{orderStatusLabel(order.status)}</Text>
                      <Text style={styles.orderListTotal}>Tổng tiền: {money(order.totalAmount)}</Text>
                    </View>
                    {String(order.status).toLowerCase() === "completed" && <AppButton title="Xem hóa đơn" secondary onPress={() => setInvoiceOrder(order)} />}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>
    );
  };

  const renderProfile = () => (
    <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
      {profilePage ? <>
        <View style={styles.accountPageHeading}><Pressable style={styles.accountBackButton} onPress={() => { setProfilePage(""); setAccountError(""); setAccountMessage(""); setAddressMessage(""); }}><Text style={styles.accountBack}>‹</Text></Pressable><Text style={styles.accountPageTitle}>{profilePage === "personal" ? "Thông tin tài khoản" : "Địa chỉ nhận hàng"}</Text></View>
        {profilePage === "personal" ? <View style={styles.infoCard}>
          <TextInput value={accountName} onChangeText={setAccountName} placeholder="Họ và tên *" style={styles.accountInput} maxLength={150} autoCapitalize="words" />
          <TextInput value={accountEmail} onChangeText={setAccountEmail} placeholder="Email" style={styles.accountInput} keyboardType="email-address" autoCapitalize="none" />
          {Platform.OS === "web" ? (
            <input
              type="date"
              value={accountDateOfBirth}
              onChange={(event) => setAccountDateOfBirth(event.target.value)}
              style={styles.webDateInput}
              aria-label="Ngày sinh"
            />
          ) : (
            <Pressable style={styles.accountInput} onPress={() => setDatePickerOpen(true)}>
              <Text style={accountDateOfBirth ? styles.dateValue : styles.datePlaceholder}>
                {accountDateOfBirth || "Chọn ngày sinh"}
              </Text>
            </Pressable>
          )}
          <TextInput value={accountAddress} onChangeText={setAccountAddress} placeholder="Địa chỉ" style={styles.accountInput} />
          <Text style={[styles.accountInput, styles.phoneReadonly]}><Text style={styles.phoneHint}>Số điện thoại *</Text>{"\n"}{customer?.phone}</Text>
          {accountError ? <Text style={styles.orderError}>{accountError}</Text> : null}
          {accountMessage ? <Text style={styles.accountMessage}>{accountMessage}</Text> : null}
          <AppButton title={accountBusy ? "Đang lưu..." : "Lưu chỉnh sửa"} onPress={saveAccountName} disabled={accountBusy} />

        </View> : <View style={styles.infoCard}>
          <Pressable style={styles.locationButton} onPress={() => Alert.alert("Lấy vị trí hiện tại", "Tính năng định vị sẽ được bổ sung khi ứng dụng tích hợp quyền truy cập vị trí.")}><Text style={styles.locationButtonText}>◎ Lấy vị trí hiện tại</Text></Pressable>
          <TextInput value={deliveryAddress.city} onChangeText={(city) => setDeliveryAddress((a) => ({ ...a, city }))} placeholder="Tỉnh/Thành phố" style={styles.accountInput} />
          <TextInput value={deliveryAddress.ward} onChangeText={(ward) => setDeliveryAddress((a) => ({ ...a, ward }))} placeholder="Phường/Xã" style={styles.accountInput} />
          <TextInput value={deliveryAddress.street} onChangeText={(street) => setDeliveryAddress((a) => ({ ...a, street }))} placeholder="Số nhà, tên đường" style={styles.accountInput} />
          <Text style={styles.receiverLine}>Người nhận:  <Text style={styles.receiverPhone}>{customer?.phone}</Text></Text>
          <Pressable style={styles.receiverCheck} onPress={() => setDeliveryAddress((a) => ({ ...a, otherReceiver: !a.otherReceiver }))}><Text style={styles.checkBox}>{deliveryAddress.otherReceiver ? "☑" : "□"}</Text><Text style={styles.genderText}>Gọi người khác nhận hàng (nếu có)</Text></Pressable>
          {deliveryAddress.otherReceiver ? <TextInput placeholder="Tên và số điện thoại người nhận" style={styles.accountInput} /> : null}
          {addressMessage ? <Text style={styles.accountMessage}>{addressMessage}</Text> : null}
          <AppButton title="Lưu địa chỉ" onPress={saveDeliveryAddress} />
        </View>}
      </> : <>
        <Text style={styles.eyebrow}>E-MART</Text>
        <Text style={styles.pageTitle}>Tài khoản</Text>
        {!accountReady ? <View style={styles.centerState}><ActivityIndicator color={BHX_GREEN} /><Text style={styles.stateText}>Đang tải tài khoản...</Text></View> : customer ? <>
          <View style={styles.profileCard}>
            <Text style={styles.profileEmoji}>👋</Text>
            <Text style={styles.emptyTitle}>{customer.fullName || "Chào mừng bạn"}</Text>
            <Text style={styles.stateText}>{customer.phone}</Text>
            <View style={{ marginTop: 10, backgroundColor: "#eef7ef", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 14 }}>⭐</Text>
              <Text style={{ fontSize: 13, fontWeight: "800", color: BHX_GREEN }}>
                {customer.rewardPoints || 0} điểm thưởng
              </Text>
              <Text style={{ fontSize: 11, color: TEXT_MUTED }}>
                (đổi được {money((customer.rewardPoints || 0) * 1000)})
              </Text>
            </View>
          </View>
          <View style={styles.infoCard}><Text style={styles.infoTitle}>Thông tin cá nhân</Text>
            <Pressable style={styles.profileMenuRow} onPress={() => { setAccountName(customer.fullName || ""); setProfilePage("personal"); }}><Text style={styles.profileMenuIcon}>♙</Text><Text style={styles.profileMenuText}>Sửa thông tin cá nhân</Text><Text style={styles.profileMenuArrow}>›</Text></Pressable>
            <Pressable style={styles.profileMenuRow} onPress={() => { setAddressMessage(""); setProfilePage("address"); }}><Text style={styles.profileMenuIcon}>♧</Text><Text style={styles.profileMenuText}>Địa chỉ nhận hàng</Text><Text style={styles.profileMenuArrow}>›</Text></Pressable>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Hỗ trợ khách hàng</Text>
            <Text style={styles.stateText}>Đơn hàng hiện thanh toán khi nhận hàng.</Text>
            <AppButton title="Đăng xuất" secondary onPress={logoutCustomer} />
          </View>
        </> : <>
          <View style={styles.infoCard}>
            <Text style={styles.inputLabel}>{registerMode ? "TẠO TÀI KHOẢN KHÁCH HÀNG" : "ĐĂNG NHẬP KHÁCH HÀNG"}</Text>
            {registerMode ? <TextInput value={registerFullName} onChangeText={setRegisterFullName} placeholder="Họ và tên" style={styles.formInput} autoCapitalize="words" /> : null}
            {registerMode ? <TextInput value={registerPhone} onChangeText={setRegisterPhone} placeholder="Số điện thoại" style={styles.formInput} keyboardType="phone-pad" maxLength={13} autoComplete="tel" /> : null}
            <TextInput value={loginUsername} onChangeText={setLoginUsername} placeholder="Tên đăng nhập" style={styles.formInput} autoCapitalize="none" autoComplete="username" />
            <TextInput value={loginPassword} onChangeText={setLoginPassword} placeholder="Mật khẩu" style={styles.formInput} secureTextEntry autoCapitalize="none" autoComplete="password" />
            {accountError ? <Text style={styles.orderError}>{accountError}</Text> : null}
            <AppButton title={accountBusy ? (registerMode ? "Đang tạo tài khoản..." : "Đang đăng nhập...") : (registerMode ? "Tạo tài khoản" : "Đăng nhập")} onPress={registerMode ? registerCustomer : loginCustomer} disabled={accountBusy} />
            <Pressable onPress={() => { setRegisterMode((mode) => !mode); setAccountError(""); setAccountMessage(""); }}>
              <Text style={styles.accountLink}>{registerMode ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký ngay"}</Text>
            </Pressable>
            {accountMessage ? <Text style={styles.accountMessage}>{accountMessage}</Text> : null}
          </View>
        </>}
        <Modal visible={datePickerOpen} transparent animationType="fade" onRequestClose={() => setDatePickerOpen(false)}>
          <View style={styles.dateModalBackdrop}>
            <View style={styles.dateModalCard}>
              <Text style={styles.infoTitle}>Chọn ngày sinh</Text>
              <TextInput
                value={accountDateOfBirth}
                onChangeText={setAccountDateOfBirth}
                placeholder="YYYY-MM-DD"
                style={styles.accountInput}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
              <View style={styles.dateModalActions}>
                <AppButton title="Hủy" secondary onPress={() => setDatePickerOpen(false)} />
                <AppButton title="Chọn ngày" onPress={() => setDatePickerOpen(false)} />
              </View>
            </View>
          </View>
        </Modal>
        <View style={styles.infoCard}><Text style={styles.infoTitle}>Hỗ trợ khách hàng</Text><Text style={styles.stateText}>Đơn hàng hiện thanh toán khi nhận hàng.</Text></View>
      </>}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={BHX_GREEN} />

      {/* 1. TOP HEADER PHONG CÁCH BÁCH HÓA XANH (TÁCH 2 TẦNG TRÊN MOBILE ĐẢM BẢO KHÔNG BỊ TRÀN) */}
      <View style={styles.header}>
        <View style={styles.headerResponsiveInner}>
          {/* Thanh Giao Tại */}
          <Pressable
            style={styles.locationBar}
            onPress={() => { setTab("profile"); setProfilePage("address"); }}
          >
            <View style={styles.locationLeft}>
              <IconLocation size={13} color={BHX_YELLOW} />
              <Text style={styles.locationLabel}>Giao tại: </Text>
              <Text style={styles.locationAddress} numberOfLines={1}>
                {deliveryAddress?.street ? `${deliveryAddress.street}, ${deliveryAddress.ward || ""}` : "Chọn địa chỉ nhận hàng"}
              </Text>
            </View>
          </Pressable>

    

          {/* Dòng 2: Thanh Tìm Kiếm 100% Full Width Không Bao Giờ Bị Tràn */}
          <View style={styles.searchBar}>
            <Pressable
              onPress={() => {
                setSelectedDrawerCatId(categoryId === "all" ? "all" : categoryId);
                setCategoryModalOpen(true);
              }}
              style={styles.searchCategoryBtn}
              accessibilityRole="button"
              accessibilityLabel="Mở danh mục sản phẩm"
            >
              <IconMenu size={18} color="#ffffff" />
            </Pressable>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Bạn tìm thịt cá, rau củ, mì gói, nước giặt..."
              placeholderTextColor="#64748b"
              style={styles.searchInput}
              returnKeyType="search"
            />
       
          </View>

          {/* Quick Search Tags */}
          <ScrollView horizontal style={styles.quickTagsScroll} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickTagsRow}>
            {QUICK_TAGS.map((tag) => (
              <Pressable
                key={tag}
                onPress={() => setQuery(query === tag ? "" : tag)}
                style={[styles.quickTagChip, query === tag && styles.quickTagChipActive]}
              >
                <Text style={[styles.quickTagText, query === tag && styles.quickTagTextActive]}>
                  {tag}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>

      {invoiceOrder && <CustomerInvoice key={`${customer?.id}-${invoiceOrder.id}`} order={invoiceOrder} token={customerToken} onClose={() => setInvoiceOrder(null)} />}

      {/* NỘI DUNG MÀN HÌNH CHÍNH */}
      <View style={styles.screen}>
        {tab === "home" ? renderHome() : tab === "cart" ? renderCart() : tab === "orders" ? renderOrders() : renderProfile()}
      </View>

      {/* THANH GIỎ HÀNG NỔI Ở ĐÁY KHI CÓ MẶT HÀNG TRONG GIỎ */}
      {itemCount > 0 && tab === "home" && (
        <Pressable
          onPress={() => setTab("cart")}
          style={styles.floatingHomeCartBar}
        >
          <View style={styles.floatingCartLeft}>
            <View style={styles.floatingCartIconCircle}>
              <IconCart size={18} color="#ffffff" />
              <View style={styles.floatingCartBadge}>
                <Text style={styles.floatingCartBadgeText}>{itemCount}</Text>
              </View>
            </View>
            <View style={styles.floatingCartInfo}>
              <Text style={styles.floatingCartQtyText}>Giỏ hàng • {itemCount} sản phẩm</Text>
              <Text style={styles.floatingCartPriceText}>{money(payable)}</Text>
            </View>
          </View>
          <View style={styles.floatingCartRight}>
            <Text style={styles.floatingCartCtaText}>Xem giỏ hàng</Text>
            <IconChevronRight size={14} color="#ffffff" />
          </View>
        </Pressable>
      )}

      {/* Thanh điều hướng: Trang chủ, Giỏ hàng, Đơn hàng, Tài khoản */}
      <View style={styles.bottomNav}>
        <View style={styles.bottomNavInner}>
          {[
            { key: "home", label: "Trang chủ", icon: (active) => <IconHome size={20} color={active ? BHX_GREEN : "#64748b"} active={active} /> },
            { 
              key: "cart", 
              label: "Giỏ hàng", 
              badge: itemCount > 0 ? (itemCount > 99 ? "99+" : itemCount) : null,
              icon: (active) => <IconCart size={20} color={active ? BHX_GREEN : "#64748b"} /> 
            },
            { key: "orders", label: "Đơn hàng", icon: (active) => <IconReceipt size={20} color={active ? BHX_GREEN : "#64748b"} active={active} /> },
            { key: "profile", label: "Tài khoản", icon: (active) => <IconUser size={20} color={active ? BHX_GREEN : "#64748b"} active={active} /> },
          ].map((item) => {
            const isActive = tab === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setTab(item.key)}
                style={styles.navItem}
              >
                <View style={styles.navIconWrapper}>
                  {item.icon(isActive)}
                  {item.badge && (
                    <View style={styles.bottomNavBadge}>
                      <Text style={styles.bottomNavBadgeText}>{item.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ========================================================================= */}
      {/* Danh mục loại sản phẩm và sản phẩm của cửa hàng. */}
      {/* ========================================================================= */}
      <Modal
        visible={categoryModalOpen}
        animationType="fade"
        transparent={isDesktop}
        onRequestClose={() => selectedProduct ? setSelectedProduct(null) : setCategoryModalOpen(false)}
      >
        {selectedProduct ? renderProductDetails() : (
        <SafeAreaView style={isDesktop ? styles.drawerDesktopBackdrop : styles.drawerSafeArea}>
          <View style={isDesktop ? styles.drawerDesktopDialog : styles.drawerMobileContainer}>
            {/* Header màu xanh lá cây chuẩn Bách Hóa Xanh: [Đóng] [Trang chủ] + [Ô tìm kiếm bo tròn] */}
            <View style={styles.bhxModalHeader}>
              <View style={styles.bhxHeaderActionGroup}>
                <Pressable
                  onPress={() => setCategoryModalOpen(false)}
                  style={styles.bhxHeaderCircleBtn}
                >
                  <IconCloseCircle size={22} color="#ffffff" />
                  <Text style={styles.bhxHeaderBtnLabel}>Đóng</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setCategoryModalOpen(false);
                    setTab("home");
                  }}
                  style={styles.bhxHeaderCircleBtn}
                >
                  <IconHome size={22} color="#ffffff" active={true} />
                  <Text style={styles.bhxHeaderBtnLabel}>Trang chủ</Text>
                </Pressable>
              </View>

              {/* Ô tìm kiếm bo tròn chuẩn Bách Hóa Xanh */}
              <View style={styles.bhxModalSearchBox}>
                <IconSearch size={16} color="#64748b" />
                <TextInput
                  value={drawerSearchText}
                  onChangeText={setDrawerSearchText}
                  placeholder="Tìm sản phẩm trong loại đang chọn"
                  placeholderTextColor="#94a3b8"
                  style={styles.bhxModalSearchInput}
                  returnKeyType="search"
                />
                {drawerSearchText.length > 0 && (
                  <Pressable onPress={() => setDrawerSearchText("")} style={{ padding: 4 }}>
                    <IconClose size={14} color="#64748b" />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Chọn loại sản phẩm ở trái, mua sản phẩm ở phải. */}
            <View style={styles.drawerBody}>
              {/* Cột trái: các loại sản phẩm từ cửa hàng. */}
              <View style={[styles.drawerSidebarWrapper, isDesktop ? { width: 200, maxWidth: 200 } : { width: 105, maxWidth: 105, flexBasis: 105 }]}>
                <ScrollView style={styles.drawerSidebar} showsVerticalScrollIndicator={false}>
                  {[{ id: "all", name: "Tất cả" }, ...categories].map((cat) => {
                    const isCur = String(selectedDrawerCatId) === String(cat.id);
                    return (
                      <Pressable
                        key={cat.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isCur }}
                        onPress={() => {
                          setSelectedDrawerCatId(String(cat.id));
                          setDrawerSearchText("");
                        }}
                        style={[styles.bhxSidebarItem, isCur && styles.bhxSidebarItemActive]}
                      >
                        <View style={[styles.bhxSidebarIconBox, isCur && styles.bhxSidebarIconBoxActive]}>
                          {getCategoryIcon(cat.name, 28)}
                        </View>
                        <Text
                          style={[styles.bhxSidebarName, isCur && styles.bhxSidebarNameActive]}
                          numberOfLines={2}
                        >
                          {cat.name}
                        </Text>
                        {isCur && <View style={styles.bhxSidebarActiveBar} />}
                      </Pressable>
                    );
                  })}
                  <View style={{ height: 60 }} />
                </ScrollView>
              </View>

              {/* Sản phẩm thuộc loại đang chọn. */}
              <View style={styles.drawerContentCol}>
                <View style={styles.bhxSubHeaderRow}>
                  <Text style={styles.bhxSubHeaderTitle} numberOfLines={1}>
                    {activeDrawerCategory?.name || "Tất cả"} · {drawerProducts.length}
                  </Text>
                </View>

                <ScrollView key={selectedDrawerCatId} contentContainerStyle={styles.drawerProductGrid} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  {loading ? (
                    <View style={styles.bhxEmptySubState}>
                      <ActivityIndicator color={BHX_GREEN} />
                      <Text style={styles.stateText}>Đang tải sản phẩm...</Text>
                    </View>
                  ) : loadError ? (
                    <View style={styles.bhxEmptySubState}>
                      <Text style={styles.errorText}>{loadError}</Text>
                      <AppButton title="Thử lại" onPress={loadStore} />
                    </View>
                  ) : drawerProducts.map((product) => (
                    <Pressable
                      key={product.id}
                      onPress={() => setSelectedProduct(product)}
                      accessibilityRole="button"
                      accessibilityLabel={`Xem chi tiết ${product.productName}`}
                      style={[styles.drawerProductTile, { width: isDesktop ? "25%" : "33.333%" }]}
                    >
                      <View style={styles.drawerProductImageBox}>
                        <ProductImage imagePath={product.imageUrl} productId={product.id} categoryName={product.categoryName} style={styles.productImage} />
                      </View>
                      <Text style={styles.drawerProductName} numberOfLines={2}>{product.productName}</Text>
                      <Text style={styles.drawerProductPrice}>{productPriceLabel(product)}</Text>
                      <ProductStock product={product} style={styles.drawerProductStock} />
                    </Pressable>
                  ))}

                  {!loading && !loadError && drawerProducts.length === 0 && (
                    <View style={styles.bhxEmptySubState}>
                      <IconCart size={40} color="#cbd5e1" />
                      <Text style={styles.stateText}>{drawerSearchText.trim() ? "Không tìm thấy sản phẩm phù hợp." : "Loại này chưa có sản phẩm."}</Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            </View>

            {/* DƯỚI ĐÁY MODAL: THANH GIỎ HÀNG NỔI (STICKY BOTTOM CART) CHỐNG MẤT GIỎ */}
            {itemCount > 0 && (
              <Pressable
                onPress={() => {
                  setCategoryModalOpen(false);
                  setTab("cart");
                }}
                style={styles.drawerFloatingCart}
              >
                <View style={styles.floatingCartLeft}>
                  <View style={styles.floatingCartIconCircle}>
                    <IconCart size={18} color="#ffffff" />
                    <View style={styles.floatingCartBadge}>
                      <Text style={styles.floatingCartBadgeText}>{itemCount}</Text>
                    </View>
                  </View>
                  <View style={styles.floatingCartInfo}>
                    <Text style={styles.floatingCartQtyText}>Giỏ hàng • {itemCount} sản phẩm</Text>
                    <Text style={styles.floatingCartPriceText}>{money(payable)}</Text>
                  </View>
                </View>
                <View style={styles.floatingCartRight}>
                  <Text style={styles.floatingCartCtaText}>Xem giỏ hàng</Text>
                  <IconChevronRight size={14} color="#ffffff" />
                </View>
              </Pressable>
            )}
          </View>
        </SafeAreaView>
        )}
      </Modal>

      <Modal visible={!!selectedProduct && !categoryModalOpen} animationType="slide" onRequestClose={() => setSelectedProduct(null)}>
        {!categoryModalOpen && renderProductDetails()}
      </Modal>

      {/* MODAL CHECKOUT & THANH TOÁN */}
      <Modal visible={checkoutOpen} transparent animationType="slide" onRequestClose={() => !orderSubmitting && setCheckoutOpen(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.checkoutSheet, isDesktop ? styles.checkoutSheetDesktop : null]}>
            <View style={styles.sheetHandle} />

            {completedOrder ? (
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.successContent} showsVerticalScrollIndicator={false}>
                <View style={styles.successBadgeCircle}>
                  <IconCheck size={26} color="#ffffff" />
                </View>
                <Text style={styles.eyebrow}>ĐẶT HÀNG THÀNH CÔNG</Text>
                <Text style={styles.successTitle}>Cảm ơn bạn đã mua sắm tại Bách Hóa Xanh!</Text>

                <Text style={styles.inputLabel}>MÃ ĐƠN HÀNG</Text>
                <Text selectable style={styles.successCode}>{completedOrder.orderNumber}</Text>

                {/* Thanh toán MoMo */}
                {completedOrder.paymentMethod === "momo" && (
                  <View style={styles.paymentBoxMomo}>
                    <Text style={styles.paymentBoxMomoTitle}>Thanh toán qua Ví MoMo</Text>
                    <Text style={styles.paymentBoxMomoDesc}>
                      Nhấn nút bên dưới để chuyển tiếp sang Ví MoMo và thanh toán {money(completedOrder.totalAmount)}.
                    </Text>
                    {completedOrder.momoPayUrl ? (
                      <Pressable onPress={() => Linking.openURL(completedOrder.momoPayUrl)} style={styles.momoActionBtn}>
                        <Text style={styles.momoActionText}>Mở App MoMo thanh toán ngay  →</Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.paymentWaitText}>Đang tạo liên kết ví MoMo...</Text>
                    )}
                  </View>
                )}

                {/* Quét mã VietQR */}
                {completedOrder.paymentMethod === "bank" && (
                  <View style={styles.paymentBoxBank}>
                    <Text style={styles.paymentBoxBankTitle}>Quét mã QR ngân hàng (VietQR)</Text>
                    <Text style={styles.paymentBoxBankDesc}>Mở app ngân hàng bất kỳ để quét mã và chuyển khoản siêu tốc:</Text>
                    {completedOrder.vietQrUrl && (
                      <Image source={{ uri: completedOrder.vietQrUrl }} style={styles.vietQrImage} resizeMode="contain" />
                    )}
                    <View style={styles.bankDetailCard}>
                      <Text style={styles.bankDetailLine}>• Ngân hàng: <Text style={styles.bankBold}>MBBank (Quân Đội)</Text></Text>
                      <Text style={styles.bankDetailLine}>• Số tài khoản: <Text style={styles.bankBold}>0987654321</Text></Text>
                      <Text style={styles.bankDetailLine}>• Chủ tài khoản: <Text style={styles.bankBold}>EMART STORE</Text></Text>
                      <Text style={styles.bankDetailLine}>• Số tiền: <Text style={styles.bankMoney}>{money(completedOrder.totalAmount)}</Text></Text>
                      <Text style={styles.bankDetailLine}>• Nội dung: <Text style={styles.bankContent}>EMART_{completedOrder.orderNumber}</Text></Text>
                    </View>
                  </View>
                )}

                <View style={styles.summaryTotal}>
                  <Text style={styles.summaryTotalLabel}>
                    {completedOrder.paymentMethod === "cod" ? "Thanh toán khi nhận hàng" : "Tổng đơn hàng"}
                  </Text>
                  <Text style={styles.summaryTotalValue}>{money(completedOrder.totalAmount)}</Text>
                </View>

                <AppButton title="Hoàn tất & Xem đơn hàng" onPress={() => { setCheckoutOpen(false); setTab("orders"); }} />
              </ScrollView>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.checkoutContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.eyebrow}>GIAO HÀNG TẬN CỬA TRONG 2H</Text>
                <Text style={styles.checkoutTitle}>Thông tin người nhận</Text>

                <Text style={styles.inputLabel}>HỌ VÀ TÊN</Text>
                <TextInput
                  value={customer?.fullName || checkoutForm.fullName}
                  onChangeText={(value) => setCheckoutForm((form) => ({ ...form, fullName: value }))}
                  placeholder="Ví dụ: Nguyễn Văn An"
                  style={styles.formInput}
                  maxLength={150}
                  autoCapitalize="words"
                  editable={!customer?.fullName}
                />

                <Text style={styles.inputLabel}>SỐ ĐIỆN THOẠI</Text>
                <TextInput
                  value={customer?.phone || checkoutForm.phone}
                  onChangeText={(value) => setCheckoutForm((form) => ({ ...form, phone: value }))}
                  placeholder="Ví dụ: 0912345678"
                  style={styles.formInput}
                  keyboardType="phone-pad"
                  maxLength={13}
                  editable={!customer}
                />

                <Text style={styles.inputLabel}>ĐỊA CHỈ NHẬN HÀNG</Text>
                <TextInput
                  value={checkoutForm.address}
                  onChangeText={(value) => setCheckoutForm((form) => ({ ...form, address: value }))}
                  placeholder="Số nhà, tên đường, phường/xã, quận/huyện..."
                  style={[styles.formInput, styles.addressInput]}
                  multiline
                  maxLength={500}
                />

                <Text style={styles.inputLabel}>GHI CHÚ GIAO HÀNG (NẾU CÓ)</Text>
                <TextInput
                  value={checkoutForm.note}
                  onChangeText={(value) => setCheckoutForm((form) => ({ ...form, note: value }))}
                  placeholder="Ví dụ: Gọi trước khi đến 15 phút..."
                  style={[styles.formInput, styles.noteInput]}
                  multiline
                  maxLength={500}
                />

                {/* PHƯƠNG THỨC THANH TOÁN */}
                <Text style={styles.inputLabel}>PHƯƠNG THỨC THANH TOÁN</Text>
                <View style={{ gap: 8, marginTop: 4, marginBottom: 8 }}>
                  {[
                    { key: "cod", label: "Tiền mặt khi nhận hàng (COD)", desc: "Nhận hàng kiểm tra rồi trả tiền mặt" },
                    { key: "momo", label: "Ví điện tử MoMo", desc: "Thanh toán online qua ứng dụng MoMo" },
                    { key: "bank", label: "Chuyển khoản QR ngân hàng", desc: "Quét mã VietQR chuyển khoản siêu tốc" },
                  ].map((m) => (
                    <Pressable
                      key={m.key}
                      onPress={() => setPaymentMethod(m.key)}
                      style={[styles.paymentMethodOption, paymentMethod === m.key && styles.paymentMethodOptionActive]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.paymentMethodLabel, paymentMethod === m.key && styles.paymentMethodLabelActive]}>
                          {m.label}
                        </Text>
                        <Text style={styles.paymentMethodDesc}>{m.desc}</Text>
                      </View>
                      <View style={[styles.radioCircle, paymentMethod === m.key && styles.radioCircleActive]}>
                        {paymentMethod === m.key && <View style={styles.radioDot} />}
                      </View>
                    </Pressable>
                  ))}
                </View>

                {/* ĐIỂM THƯỞNG KHÁCH HÀNG */}
                {customer && (customer.rewardPoints || 0) > 0 && maxPointsUsable > 0 && (
                  <Pressable
                    onPress={() => setUseRewardPoints(!useRewardPoints)}
                    style={[styles.rewardPointsCard, useRewardPoints && styles.rewardPointsCardActive]}
                  >
                    <IconStar size={18} color="#d97706" />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.rewardPointsTitle}>
                        Dùng {maxPointsUsable} điểm tích lũy (-{money(maxPointsUsable * 1000)})
                      </Text>
                      <Text style={styles.rewardPointsDesc}>
                        Bạn đang có {customer.rewardPoints} điểm (1 điểm = 1.000đ)
                      </Text>
                    </View>
                    <View style={[styles.checkSquare, useRewardPoints && styles.checkSquareActive]}>
                      {useRewardPoints && <IconCheck size={13} color="#ffffff" />}
                    </View>
                  </Pressable>
                )}

                {orderError ? <Text style={styles.orderError}>{orderError}</Text> : null}

                <View style={styles.checkoutTotal}>
                  <Text style={styles.summaryLabel}>
                    {itemCount} món{useRewardPoints ? ` · giảm ${money(pointsDiscount)} điểm` : ""}
                  </Text>
                  <Text style={styles.summaryTotalValue}>{money(payable)}</Text>
                </View>

                <AppButton
                  title={orderSubmitting ? "Đang gửi đơn hàng..." : "Xác nhận đặt hàng ngay"}
                  disabled={orderSubmitting}
                  onPress={submitOrder}
                />
                <Pressable disabled={orderSubmitting} onPress={() => setCheckoutOpen(false)} style={styles.cancelCheckout}>
                  <Text style={styles.cancelText}>Quay lại xem giỏ</Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL PHIẾU GIẢM GIÁ (VOUCHER) */}
      <Modal visible={voucherOpen} transparent animationType="slide" onRequestClose={() => setVoucherOpen(false)}>
        <View style={styles.voucherBackdrop}>
          <View style={[styles.voucherSheet, isDesktop ? styles.voucherSheetDesktop : null]}>
            <View style={styles.voucherHeading}>
              <Text style={styles.voucherTitle}>Phiếu mua hàng & Ưu đãi</Text>
              <Pressable style={styles.voucherCloseButton} onPress={() => setVoucherOpen(false)}>
                <IconClose size={18} color="#64748b" />
              </Pressable>
            </View>

            <View style={styles.voucherCodeRow}>
              <TextInput
                value={voucherCode}
                onChangeText={setVoucherCode}
                placeholder="Nhập mã voucher..."
                autoCapitalize="characters"
                style={styles.voucherInput}
              />
              <Pressable disabled={voucherBusy} onPress={() => applyVoucher()} style={[styles.voucherAdd, voucherBusy && styles.buttonDisabled]}>
                <Text style={styles.voucherAddText}>{voucherBusy ? "..." : "Áp dụng"}</Text>
              </Pressable>
            </View>

            <Text style={styles.voucherSubheading}>Ưu đãi sự kiện đang có sẵn</Text>
            <ScrollView style={styles.voucherList} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {voucherList.map((voucher) => {
                const issue = eventPromotionIssue(voucher, subtotal);
                const disabled = voucherBusy || !!issue;
                return (
                <View key={voucher.id} style={[styles.voucherCard, !!issue && styles.voucherCardUnavailable]}>
                  <View style={styles.voucherCardTop}>
                    <View style={styles.voucherBadge}>
                      <Text style={styles.voucherBadgeText}>{voucher.discountType === "percent" ? `${voucher.value}%` : money(voucher.value)}</Text>
                    </View>
                    <View style={styles.voucherInfo}>
                      <Text style={styles.voucherName}>{voucher.name || "Ưu đãi sự kiện"}</Text>
                      {voucher.endDate && <Text style={styles.voucherExpiry}>Hạn {new Date(voucher.endDate).toLocaleDateString("vi-VN")}</Text>}
                    </View>
                    <Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel={`Dùng ${voucher.name || "ưu đãi sự kiện"}`} accessibilityState={{ disabled }} onPress={() => applyVoucher("", voucher.id)} style={[styles.voucherUseBtn, !!issue && styles.voucherUseBtnUnavailable, voucherBusy && styles.buttonDisabled]}>
                      <Text style={styles.voucherUseText}>Dùng</Text>
                    </Pressable>
                  </View>
                  {voucher.description && <Text style={styles.voucherDescription}>{voucher.description}</Text>}
                  {voucher.minOrderAmount > 0 && <Text style={styles.voucherExpiry}>Đơn tối thiểu {money(voucher.minOrderAmount)}</Text>}
                  {!!issue && <Text style={styles.voucherUnavailableText}>{issue}</Text>}
                </View>
                );
              })}
              {!voucherList.length && !voucherMessage && (
                <View style={styles.centerState}><Text style={styles.stateText}>Hiện chưa có ưu đãi sự kiện. Nếu có voucher, bạn có thể nhập mã ở trên.</Text></View>
              )}
              {voucherMessage ? <Text style={styles.voucherMessage}>{voucherMessage}</Text> : null}
            </ScrollView>

            <AppButton
              title={appliedVoucher ? `Đang dùng · Giảm ${money(appliedVoucher.discountAmount)}` : "Đóng"}
              onPress={() => setVoucherOpen(false)}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f6f8f4" },
  drawerSafeArea: { flex: 1, backgroundColor: BHX_GREEN },
  drawerMobileContainer: { flex: 1, backgroundColor: "#fff" },
  drawerDesktopBackdrop: { flex: 1, backgroundColor: "#14221988", alignItems: "center", justifyContent: "center", padding: 24 },
  drawerDesktopDialog: { width: "100%", maxWidth: 1000, height: "90%", borderRadius: 16, backgroundColor: "#fff", overflow: "hidden" },
  bhxModalHeader: { backgroundColor: BHX_GREEN, padding: 12, gap: 10 },
  bhxHeaderActionGroup: { flexDirection: "row", alignItems: "center", gap: 20 },
  bhxHeaderCircleBtn: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36 },
  bhxHeaderBtnLabel: { color: "#fff", fontSize: 12, fontWeight: "700" },
  bhxModalSearchBox: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 42, backgroundColor: "#fff", borderRadius: 8, paddingHorizontal: 10 },
  bhxModalSearchInput: { flex: 1, minWidth: 0, color: TEXT_DARK, fontSize: 12, paddingVertical: 8 },
  drawerBody: { flex: 1, minHeight: 0, flexDirection: "row" },
  drawerSidebarWrapper: { backgroundColor: "#f1f5f9", flexShrink: 0 },
  drawerSidebar: { flex: 1 },
  bhxSidebarItem: { alignItems: "center", justifyContent: "center", minHeight: 88, paddingHorizontal: 6, paddingVertical: 10, gap: 5, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  bhxSidebarItemActive: { backgroundColor: "#fff" },
  bhxSidebarIconBox: { width: 38, height: 36, alignItems: "center", justifyContent: "center" },
  bhxSidebarIconBoxActive: { backgroundColor: "#eef8f1", borderRadius: 8 },
  bhxSidebarName: { color: TEXT_MUTED, fontSize: 10, lineHeight: 14, textAlign: "center" },
  bhxSidebarNameActive: { color: BHX_GREEN, fontWeight: "800" },
  bhxSidebarActiveBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: BHX_GREEN },
  drawerContentCol: { flex: 1, minWidth: 0 },
  drawerColumnTitle: { color: TEXT_DARK, fontSize: 12, fontWeight: "800", paddingHorizontal: 6, paddingVertical: 12, textAlign: "center", borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  drawerProductsTitle: { color: TEXT_DARK, fontSize: 14, fontWeight: "900" },
  drawerProductGrid: { flexDirection: "row", flexWrap: "wrap", padding: 6, paddingBottom: 20, rowGap: 10 },
  drawerProductTile: { paddingHorizontal: 3, paddingVertical: 6, alignItems: "center" },
  drawerProductImageBox: { width: "100%", aspectRatio: 1, maxHeight: 110, alignItems: "center", justifyContent: "center", backgroundColor: "#f7faf8", borderRadius: 8, overflow: "hidden" },
  drawerProductName: { color: TEXT_DARK, fontSize: 10, lineHeight: 14, minHeight: 28, textAlign: "center", marginTop: 5 },
  drawerProductPrice: { color: BHX_GREEN, fontSize: 10, fontWeight: "800", textAlign: "center", marginTop: 4 },
  drawerProductStock: { color: TEXT_MUTED, fontSize: 9, textAlign: "center", marginTop: 4 },
  bhxSubHeaderRow: { padding: 10, gap: 7, borderBottomWidth: 1, borderBottomColor: BORDER_COLOR },
  bhxSubHeaderTitle: { color: TEXT_DARK, fontSize: 13, fontWeight: "800" },
  bhxViewAllCategoryBtn: { alignSelf: "flex-start", paddingVertical: 5 },
  bhxViewAllCategoryText: { color: BHX_GREEN, fontSize: 11, fontWeight: "700" },
  bhxSubGridContainer: { flexDirection: "row", flexWrap: "wrap", padding: 6, paddingBottom: 20, rowGap: 10 },
  bhxSubGridItem: { width: "33.333%", paddingHorizontal: 3, paddingVertical: 6, alignItems: "center" },
  bhxSubImageBox: { width: "100%", height: 62, alignItems: "center", justifyContent: "center", backgroundColor: "#f7faf8", borderRadius: 8 },
  bhxSubTagBadge: { position: "absolute", top: 0, right: 0, borderRadius: 3, backgroundColor: BHX_RED, paddingHorizontal: 3, paddingVertical: 2 },
  bhxSubTagText: { color: "#fff", fontSize: 7, fontWeight: "800" },
  bhxSubName: { color: TEXT_DARK, fontSize: 10, lineHeight: 14, textAlign: "center", marginTop: 5 },
  bhxEmptySubState: { width: "100%", alignItems: "center", paddingVertical: 35, paddingHorizontal: 10 },
  drawerFloatingCart: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: BHX_GREEN, paddingHorizontal: 12, paddingVertical: 10, flexShrink: 0 },
  checkoutSheetDesktop: { width: "100%", maxWidth: 560, alignSelf: "center", borderRadius: 22 },
  voucherSheetDesktop: { width: "100%", maxWidth: 560, alignSelf: "center", borderRadius: 22 },
  successBadgeCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: BHX_GREEN, alignItems: "center", justifyContent: "center", alignSelf: "center", marginVertical: 16 },
  paymentBoxMomo: { backgroundColor: "#fff1f8", borderRadius: 12, padding: 14, gap: 8, marginTop: 12 },
  paymentBoxMomoTitle: { color: "#a50064", fontSize: 14, fontWeight: "800" },
  paymentBoxMomoDesc: { color: TEXT_MUTED, fontSize: 12, lineHeight: 18 },
  momoActionBtn: { backgroundColor: "#a50064", borderRadius: 8, padding: 12, alignItems: "center" },
  momoActionText: { color: "#fff", fontSize: 12, fontWeight: "800", textAlign: "center" },
  paymentWaitText: { color: TEXT_MUTED, fontSize: 12 },
  paymentBoxBank: { backgroundColor: "#eff6ff", borderRadius: 12, padding: 14, gap: 8, marginTop: 12 },
  paymentBoxBankTitle: { color: "#1d4ed8", fontSize: 14, fontWeight: "800" },
  paymentBoxBankDesc: { color: TEXT_MUTED, fontSize: 12, lineHeight: 18 },
  vietQrImage: { width: "100%", height: 230, alignSelf: "center" },
  bankDetailCard: { backgroundColor: "#fff", padding: 12, borderRadius: 8, gap: 6 },
  bankDetailLine: { color: TEXT_MUTED, fontSize: 12, lineHeight: 18 },
  bankBold: { color: TEXT_DARK, fontWeight: "800" },
  bankMoney: { color: BHX_GREEN, fontWeight: "800" },
  bankContent: { color: "#1d4ed8", fontWeight: "800" },
  paymentMethodOption: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderWidth: 1, borderColor: BORDER_COLOR, borderRadius: 10 },
  paymentMethodOptionActive: { borderColor: BHX_GREEN, backgroundColor: "#eef8f1" },
  paymentMethodLabel: { color: TEXT_DARK, fontSize: 12, fontWeight: "700" },
  paymentMethodLabelActive: { color: BHX_GREEN },
  paymentMethodDesc: { color: TEXT_MUTED, fontSize: 10, lineHeight: 15, marginTop: 4 },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: BORDER_COLOR, alignItems: "center", justifyContent: "center" },
  radioCircleActive: { borderColor: BHX_GREEN },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: BHX_GREEN },
  rewardPointsCard: { flexDirection: "row", alignItems: "center", padding: 12, borderWidth: 1, borderColor: BORDER_COLOR, borderRadius: 10, marginVertical: 10 },
  rewardPointsCardActive: { borderColor: BHX_GREEN, backgroundColor: "#eef8f1" },
  rewardPointsTitle: { color: TEXT_DARK, fontSize: 12, fontWeight: "700" },
  rewardPointsDesc: { color: TEXT_MUTED, fontSize: 10, lineHeight: 15, marginTop: 4 },
  checkSquare: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: BORDER_COLOR, alignItems: "center", justifyContent: "center" },
  checkSquareActive: { backgroundColor: BHX_GREEN, borderColor: BHX_GREEN },
  voucherUseBtn: { backgroundColor: BHX_GREEN, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 9 },
  voucherUseText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  header: { backgroundColor: BHX_GREEN, paddingHorizontal: 14, paddingTop: 7, paddingBottom: 10, flexShrink: 0 },
  headerResponsiveInner: { width: "100%", maxWidth: 1200, alignSelf: "center" },
  locationBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingBottom: 8 },
  locationLeft: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 4 },
  locationLabel: { color: "#fff", fontSize: 11 },
  locationAddress: { flex: 1, color: "#fff", fontSize: 11, fontWeight: "700" },
  locationRight: { flexDirection: "row", alignItems: "center", gap: 3 },
  speedText: { color: BHX_YELLOW, fontSize: 10, fontWeight: "800" },
  headerTopLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  brandTextE: { color: "#fff", fontSize: 20, fontWeight: "900", letterSpacing: -1 },
  brandTagBox: { backgroundColor: BHX_YELLOW, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 3 },
  brandTextXanh: { color: BHX_DARK_GREEN, fontSize: 11, fontWeight: "900" },
  headerRightGroup: { flexDirection: "row", alignItems: "center", gap: 8 },
  categoryMenuBtn: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 40, paddingHorizontal: 8, borderWidth: 1, borderColor: "#ffffff55", borderRadius: 8 },
  categoryMenuBtnText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  clearSearchBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  searchSubmitBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: BHX_GREEN, alignItems: "center", justifyContent: "center" },
  quickTagsScroll: { flexGrow: 0, flexShrink: 0, height: 34 },
  quickTagsRow: { flexDirection: "row", alignItems: "center", gap: 7, paddingTop: 8 },
  quickTagChip: { borderRadius: 12, backgroundColor: "#ffffff1f", paddingHorizontal: 10, paddingVertical: 5 },
  quickTagChipActive: { backgroundColor: BHX_YELLOW },
  quickTagText: { color: "#fff", fontSize: 10 },
  quickTagTextActive: { color: BHX_DARK_GREEN, fontWeight: "800" },
  headerTop: { flexDirection: "row", alignItems: "center" },
  brandIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: BHX_GREEN, alignItems: "center", justifyContent: "center", marginRight: 9 },
  brandLetter: { color: "#fff", fontSize: 25, fontWeight: "900", fontStyle: "italic" },
  brandName: { color: BHX_GREEN, fontWeight: "900", fontSize: 20, letterSpacing: -0.7 },
  brandTagline: { color: "#8b978e", fontSize: 8, letterSpacing: 1.2, fontWeight: "800", marginTop: -1 },
  headerCart: { backgroundColor: BHX_DARK_GREEN, borderRadius: 10, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerCartIcon: { fontSize: 20 },
  cartBadge: { position: "absolute", right: -4, top: -4, minWidth: 18, height: 18, borderRadius: 10, backgroundColor: "#dc5a42", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  cartBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  searchBar: { height: 44, backgroundColor: "#f4f6f2", borderRadius: 11, marginTop: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center" },
  searchIcon: { color: "#7f8a81", fontSize: 24, marginRight: 7 },
  searchInput: { flex: 1, minWidth: 0, color: TEXT_DARK, fontSize: 13, paddingVertical: 0 },
  searchCategoryBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: BHX_GREEN, alignItems: "center", justifyContent: "center", marginRight: 8 },
  promises: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 9, gap: 9 },
  promiseText: { color: "#708077", fontSize: 10, fontWeight: "600" },
  promiseDot: { color: "#b6c0b8" },
  screen: { flex: 1, minHeight: 0 },
  responsiveContainer: { width: "100%", maxWidth: 1200, alignSelf: "center" },
  heroBanner: { borderRadius: 14, padding: 18, minHeight: 170, justifyContent: "center", overflow: "hidden" },
  bannerInfo: { gap: 8 },
  bannerBadgePill: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", backgroundColor: "#ffffff22", borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 },
  bannerBadgeText: { color: BHX_YELLOW, fontSize: 10, fontWeight: "800" },
  bannerTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },
  bannerSubtitle: { color: "#fff", fontSize: 12, lineHeight: 18 },
  bannerCtaBtn: { backgroundColor: BHX_YELLOW, alignSelf: "flex-start", borderRadius: 7, paddingHorizontal: 12, paddingVertical: 9 },
  bannerCtaText: { color: BHX_DARK_GREEN, fontSize: 11, fontWeight: "800" },
  bannerDots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 12 },
  bannerDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#ffffff66" },
  bannerDotActive: { width: 20, backgroundColor: BHX_YELLOW },
  trustBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 10, paddingVertical: 12, marginTop: 10 },
  trustItem: { flex: 1, minWidth: 0, alignItems: "center", gap: 5, paddingHorizontal: 3 },
  trustLabel: { color: TEXT_MUTED, fontSize: 9, textAlign: "center" },
  trustDivider: { width: 1, height: 26, backgroundColor: BORDER_COLOR },
  categorySectionHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 20, marginBottom: 12 },
  categorySectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  greenBar: { width: 4, height: 18, borderRadius: 2, backgroundColor: BHX_GREEN },
  categorySectionTitle: { color: TEXT_DARK, fontSize: 12, fontWeight: "900" },
  openCategoryDrawerBtn: { flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 5 },
  openCategoryDrawerText: { color: BHX_GREEN, fontSize: 10, fontWeight: "700" },
  categoryScroll: { flexGrow: 0, flexShrink: 0 },
  categoryGridContainer: { flexDirection: "row", gap: 8, paddingRight: 4 },
  categoryGridItem: { alignItems: "center", paddingHorizontal: 3, paddingVertical: 9, backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#edf0ec" },
  categoryGridItemActive: { borderColor: BHX_GREEN, backgroundColor: "#eef8f1" },
  categoryIconWrap: { height: 40, alignItems: "center", justifyContent: "center" },
  categoryGridText: { color: TEXT_DARK, fontSize: 10, lineHeight: 14, minHeight: 28, textAlign: "center" },
  categoryGridTextActive: { color: BHX_GREEN, fontWeight: "800" },
  filterToolbar: { gap: 10, marginTop: 18, marginBottom: 12 },
  filterLeft: { flexDirection: "row", alignItems: "center" },
  filterResultCount: { color: TEXT_MUTED, fontSize: 12 },
  filterNumber: { color: BHX_GREEN, fontWeight: "800" },
  sortPillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  sortPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: BORDER_COLOR },
  sortPillActive: { backgroundColor: BHX_GREEN, borderColor: BHX_GREEN },
  sortPillText: { color: TEXT_MUTED, fontSize: 10 },
  sortPillTextActive: { color: "#fff", fontWeight: "700" },
  scrollContent: { padding: 16, paddingBottom: 20 },
  hero: { minHeight: 176, borderRadius: 18, backgroundColor: "#e8f2e5", padding: 19, overflow: "hidden", justifyContent: "center" },
  heroKicker: { color: "#57936e", fontSize: 9, fontWeight: "900", letterSpacing: 1.1, marginBottom: 8 },
  heroTitle: { color: "#193d2d", fontSize: 23, fontWeight: "900", letterSpacing: -0.7 },
  heroTitleAccent: { color: "#278455", fontSize: 23, fontWeight: "900", letterSpacing: -0.7 },
  heroCaption: { color: "#66776b", fontSize: 10, lineHeight: 15, maxWidth: "76%", marginTop: 8 },
  heroDecoration: { position: "absolute", right: 5, top: 34, width: 105, height: 105, borderRadius: 55, backgroundColor: "#d2e7bd", alignItems: "center", justifyContent: "center" },
  heroBag: { fontSize: 55 },
  sectionHeading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 23, marginBottom: 11 },
  eyebrow: { color: "#57936e", fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  sectionTitle: { color: TEXT_DARK, fontSize: 17, fontWeight: "900", marginTop: 3 },
  categoryRow: { gap: 8, paddingRight: 8 },
  categoryChip: { width: 83, height: 78, borderRadius: 12, backgroundColor: "#fff", borderColor: "#e9eee8", borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  categoryChipActive: { backgroundColor: "#eef7ef", borderColor: "#78aa88" },
  categoryEmoji: { fontSize: 23, marginBottom: 4 },
  categoryName: { color: "#59665e", fontSize: 9, fontWeight: "700", textAlign: "center" },
  refreshButton: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "#eaf3e9" },
  refreshText: { color: BHX_GREEN, fontSize: 10, fontWeight: "800" },
  productGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  productCard: { width: "48.5%", backgroundColor: "#fff", borderColor: "#edf0ec", borderWidth: 1, borderRadius: 13, padding: 9 },
  productCardActive: { borderColor: BHX_GREEN },
  badgeRow: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  discountBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  hotBadge: { backgroundColor: BHX_YELLOW, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 3 },
  hotBadgeText: { color: BHX_RED, fontSize: 9, fontWeight: "900" },
  productBody: { flex: 1 },
  fastDeliveryTag: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 5 },
  fastDeliveryText: { color: BHX_ORANGE, fontSize: 9 },
  priceContainer: { marginTop: 8 },
  stepperContainer: { marginTop: "auto", paddingTop: 10 },
  addCartBtn: { minHeight: 36, backgroundColor: BHX_GREEN, borderRadius: 7, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  addCartBtnText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  stepperBox: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: BHX_GREEN, borderRadius: 7, overflow: "hidden" },
  stepperBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", backgroundColor: "#eef8f1" },
  stepperBtnPlus: { backgroundColor: BHX_GREEN },
  stepperQtyText: { color: TEXT_DARK, fontSize: 13, fontWeight: "800", textAlign: "center" },
  productImageBox: { height: 123, borderRadius: 10, backgroundColor: "#f7f8f5", alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: 9 },
  productImage: { width: "90%", height: "90%" },
  productEmoji: { fontSize: 40 },
  productCategory: { color: "#839287", fontSize: 8, fontWeight: "800", letterSpacing: 0.8 },
  productName: { color: "#34463a", fontWeight: "800", fontSize: 12, lineHeight: 17, minHeight: 34, marginTop: 4 },
  stockLabel: { color: "#328259", fontSize: 9, marginTop: 5 },
  productFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  productPrice: { color: "#1e573b", fontSize: 12, fontWeight: "900", flexShrink: 1 },
  originalPrice: { color: "#8b95a1", fontSize: 10, marginTop: 2, textDecorationLine: "line-through" },
  productSaving: { color: "#df4c42", fontSize: 9, fontWeight: "800", marginTop: 2 },
  addButton: { width: 29, height: 29, borderRadius: 9, backgroundColor: "#eaf3ea", alignItems: "center", justifyContent: "center", marginLeft: 4 },
  addButtonText: { color: BHX_GREEN, fontSize: 22, lineHeight: 25, fontWeight: "600" },
  centerState: { minHeight: 170, alignItems: "center", justifyContent: "center" },
  stateText: { color: TEXT_MUTED, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 7 },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 55, paddingHorizontal: 18 },
  emptyEmoji: { fontSize: 51, marginBottom: 9 },
  emptyTitle: { color: TEXT_DARK, fontSize: 16, fontWeight: "900", textAlign: "center" },
  emptyCta: { marginTop: 18, alignSelf: "stretch" },
  errorCard: { backgroundColor: "#fff", borderRadius: 13, padding: 17, borderWidth: 1, borderColor: "#f0dfda" },
  errorTitle: { color: "#a3443c", fontSize: 14, fontWeight: "900" },
  errorText: { color: "#785f5b", fontSize: 11, lineHeight: 17, marginTop: 6 },
  apiHint: { color: "#89948b", fontSize: 9, marginTop: 8 },
  button: { minHeight: 45, borderRadius: 10, backgroundColor: BHX_GREEN, alignItems: "center", justifyContent: "center", paddingHorizontal: 14, marginTop: 13 },
  buttonText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  buttonSecondary: { backgroundColor: "#edf5ed" },
  buttonSecondaryText: { color: BHX_GREEN },
  buttonDisabled: { opacity: 0.65 },
  ordersScreen: { flex: 1, backgroundColor: "#f4f4f4" },
  invoiceText: { color: TEXT_DARK, fontSize: 13, lineHeight: 20, marginTop: 5 },
  ordersTitle: { color: TEXT_DARK, fontSize: 16, fontWeight: "900", textAlign: "center", paddingVertical: 13, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  orderFilterScroll: { height: 48, flexGrow: 0, flexShrink: 0 },
  orderFilterRow: { paddingHorizontal: 14, alignItems: "center", gap: 8 },
  orderFilterChip: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 24, backgroundColor: "#e4eaf7" },
  orderFilterChipActive: { backgroundColor: "#328656" },
  orderFilterText: { color: "#344054", fontSize: 10, fontWeight: "600" },
  orderFilterTextActive: { color: "#fff" },
  orderListContent: { padding: 14, paddingTop: 4, paddingBottom: 20 },
  orderListCard: { backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 12 },
  orderListHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 },
  orderListNumber: { flex: 1, color: TEXT_DARK, fontSize: 12, fontWeight: "900" },
  orderViewLink: { color: "#344054", fontSize: 10, fontWeight: "700" },
  orderPickup: { flexDirection: "row", alignItems: "center", gap: 9, borderRadius: 9, backgroundColor: "#f0f3fa", padding: 10 },
  orderPickupIcon: { color: "#78857c", fontSize: 15 },
  orderPickupText: { flex: 1, color: "#586273", fontSize: 10, fontWeight: "600" },
  orderThumbnailRow: { flexDirection: "row", gap: 8, paddingVertical: 13, minHeight: 83, alignItems: "center" },
  orderThumbnailBox: { width: 57, height: 68, borderRadius: 7, backgroundColor: "#f7f8f5", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  orderThumbnail: { width: "90%", height: "90%" },
  orderMoreOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "#17202b99", alignItems: "center", justifyContent: "center" },
  orderMoreText: { color: "#fff", fontSize: 17, fontWeight: "900" },
  orderListTotals: { borderTopWidth: 1, borderTopColor: "#edf0ec", paddingTop: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 6 },
  orderListStatus: { color: BHX_GREEN, fontSize: 11, fontWeight: "800", flexShrink: 1 },
  orderListTotal: { color: TEXT_DARK, fontSize: 11, fontWeight: "700" },
  orderListActions: { flexDirection: "row", marginHorizontal: -12, marginTop: 12, borderTopWidth: 1, borderTopColor: "#edf0ec" },
  orderListAction: { flex: 1, alignItems: "center", paddingVertical: 12 },
  orderListActionText: { color: TEXT_DARK, fontSize: 10, fontWeight: "800" },
  orderDetailHeading: { minHeight: 52, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: "#edf0ec" },
  orderBack: { position: "absolute", left: 13, height: 44, justifyContent: "center", paddingHorizontal: 5 },
  orderBackText: { color: TEXT_DARK, fontSize: 34, lineHeight: 38 },
  orderDetailTitle: { color: TEXT_DARK, fontSize: 15, fontWeight: "900", maxWidth: "82%" },
  orderDetailContent: { padding: 14, paddingBottom: 20 },
  orderInfoCard: { backgroundColor: "#fff", borderRadius: 13, padding: 15, marginBottom: 12 },
  orderInfoTop: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginBottom: 10 },
  orderInfoLabel: { color: "#59636f", fontSize: 13, fontWeight: "900" },
  orderInfoDate: { color: "#67717d", fontSize: 10, textAlign: "right" },
  orderAddress: { color: TEXT_DARK, fontSize: 14, lineHeight: 20 },
  orderStatusText: { color: BHX_GREEN, fontSize: 11, fontWeight: "800", marginTop: 10 },
  orderItemsCard: { backgroundColor: "#fff", borderRadius: 13, paddingHorizontal: 12, paddingTop: 5, paddingBottom: 12, marginBottom: 12 },
  orderItemRow: { flexDirection: "row", alignItems: "center", minHeight: 92, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#edf0ec", gap: 10 },
  orderItemImageBox: { width: 65, height: 72, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderRadius: 7, overflow: "hidden" },
  orderItemImage: { width: "90%", height: "90%" },
  orderItemInfo: { flex: 1 },
  orderItemName: { color: "#344054", fontSize: 12, lineHeight: 18 },
  orderItemQuantity: { color: "#8b95a1", fontSize: 11, marginTop: 5 },
  orderItemAmount: { alignItems: "flex-end", maxWidth: 100 },
  orderItemPrice: { color: TEXT_DARK, fontSize: 13, fontWeight: "900" },
  orderItemUnitPrice: { color: "#9aa2ad", fontSize: 10, marginTop: 5, textDecorationLine: "line-through" },
  orderTotals: { paddingTop: 10 },
  orderDetailActions: { flexDirection: "row", backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 10, gap: 10, borderTopWidth: 1, borderTopColor: "#e8ebe8" },
  orderActionSecondary: { flex: 1, minHeight: 45, borderRadius: 10, borderWidth: 1, borderColor: "#cfd7d0", alignItems: "center", justifyContent: "center" },
  orderActionSecondaryText: { color: "#56615a", fontSize: 13, fontWeight: "700" },
  orderActionPrimary: { flex: 1.3, minHeight: 45, borderRadius: 10, backgroundColor: BHX_GREEN, alignItems: "center", justifyContent: "center" },
  orderActionPrimaryText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  pageContent: { padding: 18, paddingBottom: 25 },
  pageTitle: { color: TEXT_DARK, fontSize: 16, fontWeight: "900", marginTop: 4, marginBottom: 17 },
  cartRow: { flexDirection: "row", gap: 12, backgroundColor: "#fff", borderRadius: 12, padding: 10, marginBottom: 9, borderWidth: 1, borderColor: "#edf0ec" },
  cartThumb: { width: 67, height: 67, backgroundColor: "#f5f7f3", borderRadius: 9, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  cartImage: { width: "90%", height: "90%" },
  cartInfo: { flex: 1, justifyContent: "center" },
  cartDesktopLayout: { flexDirection: "row", alignItems: "flex-start", gap: 20 },
  cartItemListCol: { flex: 1, minWidth: 0 },
  cartSummaryCol: { width: 340, marginTop: 0 },
  cartStepperRow: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginTop: 9, borderWidth: 1, borderColor: BORDER_COLOR, borderRadius: 7, overflow: "hidden" },
  cartStepperBtn: { width: 36, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: "#f1f5f9" },
  cartStepperBtnPlus: { backgroundColor: BHX_GREEN },
  cartStepperQty: { minWidth: 38, paddingHorizontal: 6, textAlign: "center", color: TEXT_DARK, fontSize: 13, fontWeight: "700" },
  cartName: { color: "#435349", fontSize: 11, fontWeight: "800" },
  cartPrice: { color: BHX_GREEN, fontWeight: "900", fontSize: 12, marginTop: 4 },
  cartSaving: { color: "#df4c42", fontSize: 10, fontWeight: "800", marginTop: 3 },
  quantityControl: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 7 },
  quantityButton: { width: 25, height: 25, borderWidth: 1, borderColor: "#e2e9e1", borderRadius: 7, alignItems: "center", justifyContent: "center" },
  quantityText: { color: "#526157", fontSize: 16 },
  quantityValue: { color: TEXT_DARK, fontSize: 11, fontWeight: "800" },
  summaryCard: { backgroundColor: "#fff", borderRadius: 13, padding: 15, marginTop: 10, borderWidth: 1, borderColor: "#edf0ec" },
  summaryLine: { flexDirection: "row", justifyContent: "space-between", marginVertical: 5 },
  summaryLabel: { color: TEXT_MUTED, fontSize: 11 },
  summaryValue: { color: "#34463b", fontSize: 11, fontWeight: "800" },
  summaryDiscount: { color: "#df4c42", fontSize: 11, fontWeight: "800" },
  freeShipping: { color: "#258256", fontSize: 11, fontWeight: "800" },
  summaryTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "#edf0ec", marginTop: 10, paddingTop: 13 },
  summaryTotalLabel: { color: TEXT_DARK, fontSize: 12, fontWeight: "800" },
  summaryTotalValue: { color: "#176843", fontSize: 17, fontWeight: "900" },
  orderCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, borderColor: "#e7eee6", borderWidth: 1 },
  orderCheck: { width: 34, height: 34, lineHeight: 34, borderRadius: 17, overflow: "hidden", textAlign: "center", color: BHX_GREEN, backgroundColor: "#e8f5eb", fontWeight: "900", fontSize: 19, marginBottom: 10 },
  orderTitle: { color: TEXT_DARK, fontSize: 14, fontWeight: "900" },
  orderCode: { color: BHX_GREEN, fontSize: 13, fontWeight: "900", marginVertical: 12 },
  profileCard: { backgroundColor: "#e8f2e5", borderRadius: 15, alignItems: "center", padding: 20 },
  profileEmoji: { fontSize: 39, marginBottom: 8 },
  infoCard: { backgroundColor: "#fff", borderRadius: 13, padding: 16, marginTop: 13 },
  infoTitle: { color: TEXT_DARK, fontSize: 13, fontWeight: "900" },
  voucherRow: { minHeight: 43, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#edf0ec", marginTop: 8, paddingTop: 7 },
  voucherLabel: { color: "#344054", fontSize: 13, fontWeight: "700" },
  voucherAction: { color: "#83909c", fontSize: 12 },
  voucherRemove: { color: "#b0443c", fontSize: 11, textAlign: "right", marginBottom: 5 },
  voucherBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "#14221966" },
  voucherSheet: { height: "78%", backgroundColor: "#f8faff", borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingBottom: 14 },
  voucherHeading: { height: 62, marginHorizontal: -16, paddingHorizontal: 20, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e7eaf0", borderTopLeftRadius: 22, borderTopRightRadius: 22, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  voucherTitle: { color: TEXT_DARK, fontSize: 18, fontWeight: "900" },
  voucherCloseButton: { position: "absolute", right: 18, top: 15 },
  voucherClose: { color: "#fff", backgroundColor: "#9da8ba", overflow: "hidden", borderRadius: 20, width: 30, height: 30, textAlign: "center", lineHeight: 28, fontSize: 25 },
  voucherCodeRow: { flexDirection: "row", gap: 9, marginTop: 14, marginBottom: 14 },
  voucherInput: { flex: 1, minHeight: 48, backgroundColor: "#fff", borderColor: "#dce3e9", borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, color: TEXT_DARK, fontSize: 14 },
  voucherAdd: { width: 86, borderRadius: 10, backgroundColor: BHX_GREEN, alignItems: "center", justifyContent: "center" },
  voucherAddText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  voucherSubheading: { color: "#59636f", fontSize: 13, fontWeight: "800", marginBottom: 8 },
  voucherList: { flex: 1 },
  voucherCard: { backgroundColor: "#fff", borderRadius: 12, borderColor: "#e2e8ef", borderWidth: 1, padding: 12, marginBottom: 9 },
  voucherCardUnavailable: { backgroundColor: "#dfe3e8", borderColor: "#c3cbd5" },
  voucherUseBtnUnavailable: { backgroundColor: "#87929e" },
  voucherUnavailableText: { color: "#526071", fontSize: 11, lineHeight: 16, fontWeight: "600", marginTop: 8 },
  voucherCardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  voucherBadge: { minWidth: 58, minHeight: 45, paddingHorizontal: 5, borderRadius: 7, backgroundColor: "#e9edf5", alignItems: "center", justifyContent: "center" },
  voucherBadgeText: { color: "#49576a", fontWeight: "900", fontSize: 13 },
  voucherInfo: { flex: 1 },
  voucherName: { color: "#303b4b", fontSize: 13, lineHeight: 18, fontWeight: "700" },
  voucherExpiry: { color: "#8b95a1", fontSize: 11, marginTop: 4 },
  voucherUse: { color: "#25976c", fontSize: 12, fontWeight: "900" },
  voucherDescription: { color: "#d58b3d", fontSize: 11, lineHeight: 16, marginTop: 8 },
  voucherMessage: { color: "#b0443c", fontSize: 12, marginVertical: 8 },
  accountPageHeading: { minHeight: 54, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 12, marginBottom: 10, position: "relative" },
  accountBackButton: { position: "absolute", left: 7, top: 5, zIndex: 1, width: 42, height: 44, justifyContent: "center" },
  accountBack: { color: TEXT_DARK, fontSize: 34, lineHeight: 40 },
  accountPageTitle: { color: TEXT_DARK, fontSize: 17, fontWeight: "900" },
  profileMenuRow: { minHeight: 55, flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: "#edf0ec", marginTop: 12, paddingTop: 7 },
  profileMenuIcon: { width: 35, color: "#78857c", fontSize: 21 },
  profileMenuText: { flex: 1, color: "#29352f", fontSize: 14 },
  profileMenuArrow: { color: "#111", fontSize: 29, fontWeight: "700" },
  genderText: { color: "#293443", fontSize: 16 },
  accountInput: { minHeight: 53, borderWidth: 1, borderColor: "#dce3e9", borderRadius: 10, paddingHorizontal: 14, color: TEXT_DARK, fontSize: 16, marginBottom: 12, justifyContent: "center" },
  phoneReadonly: { backgroundColor: "#e5eaf6", borderColor: "#e5eaf6", paddingTop: 8, fontSize: 16 },
  phoneHint: { color: "#98a0ac", fontSize: 12 },
  deleteHint: { color: "#293443", fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 22 },
  deleteLink: { color: "#c44343", textDecorationLine: "underline", fontSize: 16, textAlign: "center", marginTop: 12, marginBottom: 5 },
  locationButton: { minHeight: 48, borderWidth: 1, borderColor: "#e1e5e1", borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 15 },
  locationButtonText: { color: BHX_GREEN, fontSize: 16, fontWeight: "800" },
  receiverLine: { color: "#293443", fontSize: 15, marginTop: 5, marginBottom: 10 },
  receiverPhone: { fontWeight: "900" },
  receiverCheck: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 9 },
  checkBox: { color: "#75808c", fontSize: 21 },
  bottomNav: { backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e9ede8", flexShrink: 0, paddingBottom: 3 },
  bottomNavInner: { width: "100%", maxWidth: 1200, alignSelf: "center", flexDirection: "row", alignItems: "center", minHeight: 60 },
  navItem: { flex: 1, minWidth: 0, minHeight: 56, alignItems: "center", justifyContent: "center", gap: 4 },
  navIconWrapper: { width: 30, height: 24, alignItems: "center", justifyContent: "center" },
  bottomNavBadge: { position: "absolute", top: -5, right: -6, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, backgroundColor: BHX_RED, alignItems: "center", justifyContent: "center" },
  bottomNavBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  navLabelActive: { color: BHX_GREEN, fontWeight: "800" },
  floatingHomeCartBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, backgroundColor: BHX_GREEN, paddingHorizontal: 16, paddingVertical: 10 },
  floatingCartLeft: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
  floatingCartIconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: BHX_DARK_GREEN, alignItems: "center", justifyContent: "center" },
  floatingCartBadge: { position: "absolute", top: -3, right: -4, backgroundColor: BHX_YELLOW, borderRadius: 8, paddingHorizontal: 4, minWidth: 16, alignItems: "center" },
  floatingCartBadgeText: { color: BHX_DARK_GREEN, fontSize: 9, fontWeight: "800" },
  floatingCartInfo: { flex: 1, minWidth: 0 },
  floatingCartQtyText: { color: "#fff", fontSize: 10 },
  floatingCartPriceText: { color: BHX_YELLOW, fontSize: 14, fontWeight: "900", marginTop: 3 },
  floatingCartRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  floatingCartCtaText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  navIcon: { color: "#849087", fontSize: 20, fontWeight: "700", height: 24 },
  navLabel: { color: "#849087", fontSize: 9, fontWeight: "600" },
  navActive: { color: BHX_GREEN, fontWeight: "900" },
  navBadge: { color: "#fff", backgroundColor: "#dc5a42", overflow: "hidden", borderRadius: 8, fontSize: 9, fontWeight: "900" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "#14221988" },
  productDetailScreen: { flex: 1, backgroundColor: "#f7f9f6" },
  productDetailTopBar: { backgroundColor: "#fff", paddingHorizontal: 14, paddingTop: 7, paddingBottom: 9, borderBottomWidth: 1, borderBottomColor: "#edf0ec" },
  productDetailSearchBar: { height: 44, backgroundColor: "#f4f6f2", borderRadius: 11, paddingLeft: 12, paddingRight: 5, flexDirection: "row", alignItems: "center" },
  productDetailHeader: { minHeight: 56, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e8ebe8", alignItems: "center", justifyContent: "center", paddingHorizontal: 56 },
  productDetailBack: { position: "absolute", left: 14, top: 6, width: 42, height: 44, justifyContent: "center", zIndex: 1 },
  productDetailBackText: { color: TEXT_DARK, fontSize: 37, lineHeight: 41 },
  productDetailHeaderTitle: { color: TEXT_DARK, fontSize: 16, fontWeight: "900" },
  productDetailContent: { paddingBottom: 20 },
  productDetailImageBox: { height: 350, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  productDetailImage: { width: "92%", height: "92%" },
  flashSaleBanner: { backgroundColor: "#ff8c19", paddingHorizontal: 18, paddingVertical: 13 },
  flashSaleTitle: { color: "#fff", fontSize: 17, fontWeight: "900" },
  flashSaleText: { color: "#fff", fontSize: 12, fontWeight: "700", marginTop: 4 },
  productDetailInfo: { backgroundColor: "#fff", padding: 18, marginTop: 10 },
  productDetailDescription: { color: TEXT_MUTED, fontSize: 14, lineHeight: 22, marginTop: 16 },
  relatedProductsSection: { backgroundColor: "#fff", marginTop: 10, paddingVertical: 16 },
  relatedProductsTitle: { color: TEXT_DARK, fontSize: 16, fontWeight: "800", paddingHorizontal: 18, marginBottom: 12 },
  relatedProductsRow: { paddingHorizontal: 18, gap: 10 },
  relatedProductCard: { width: 140, borderRadius: 10, borderWidth: 1, borderColor: BORDER_COLOR, padding: 8 },
  relatedProductImageBox: { height: 110, backgroundColor: "#f7faf8", borderRadius: 8, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  relatedProductName: { color: TEXT_DARK, fontSize: 12, lineHeight: 17, minHeight: 34, marginTop: 8 },
  relatedProductPrice: { color: BHX_GREEN, fontSize: 13, fontWeight: "800", marginTop: 5 },
  productDetailName: { color: TEXT_DARK, fontSize: 22, fontWeight: "900", lineHeight: 30, marginTop: 6 },
  productDetailPriceBlock: { marginTop: 16 },
  productDetailPriceRow: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 9 },
  productDetailPrice: { color: BHX_GREEN, fontSize: 25, fontWeight: "900" },
  productDetailOriginalPrice: { color: "#8b95a1", fontSize: 15, textDecorationLine: "line-through" },
  productDetailSaving: { color: "#df4c42", fontSize: 13, fontWeight: "800", marginTop: 7 },
  discountBadge: { backgroundColor: "#df4c42", overflow: "hidden", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3 },
  productDetailStock: { color: BHX_GREEN, fontSize: 13, fontWeight: "800", marginTop: 16 },
  productDetailAction: { backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e8ebe8", paddingHorizontal: 18, paddingTop: 12, paddingBottom: 16 },
  productDetailQuantityControl: { minHeight: 45, borderRadius: 10, backgroundColor: "#eaf3ea", flexDirection: "row", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  productDetailQuantityButton: { width: 58, height: 45, alignItems: "center", justifyContent: "center" },
  productDetailQuantityButtonText: { color: BHX_GREEN, fontSize: 26, lineHeight: 30, fontWeight: "700" },
  productDetailQuantityValue: { minWidth: 54, color: TEXT_DARK, fontSize: 17, fontWeight: "900", textAlign: "center" },
  checkoutSheet: { maxHeight: "92%", backgroundColor: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 18 },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: "#d7ded7", alignSelf: "center", marginBottom: 15 },
  checkoutContent: { paddingBottom: 10 },
  checkoutTitle: { color: TEXT_DARK, fontSize: 21, fontWeight: "900", marginTop: 4 },
  checkoutDescription: { color: TEXT_MUTED, fontSize: 11, marginTop: 5, marginBottom: 14 },
  inputLabel: { color: "#536257", fontSize: 9, fontWeight: "900", letterSpacing: 0.7, marginTop: 12, marginBottom: 6 },
  formInput: { minHeight: 43, backgroundColor: "#fbfcfa", borderWidth: 1, borderColor: "#dfe7df", borderRadius: 9, paddingHorizontal: 11, color: TEXT_DARK, fontSize: 12 },
  addressInput: { minHeight: 62, textAlignVertical: "top", paddingTop: 10 },
  noteInput: { minHeight: 48, textAlignVertical: "top", paddingTop: 9 },
  orderError: { color: "#a33e36", fontSize: 11, backgroundColor: "#fff1ef", borderRadius: 8, padding: 10, marginTop: 10 },
  accountMessage: { color: BHX_GREEN, fontSize: 11, marginTop: 10, textAlign: "center" },
  accountLink: { color: BHX_GREEN, fontSize: 13, fontWeight: "700", textAlign: "center", marginTop: 14 },
  webDateInput: { width: "100%", minHeight: 53, borderWidth: 1, borderColor: "#dce3e9", borderRadius: 10, paddingLeft: 14, paddingRight: 14, color: TEXT_DARK, fontSize: 16, marginBottom: 12, backgroundColor: "#fff" },
  dateValue: { color: TEXT_DARK, fontSize: 16 },
  datePlaceholder: { color: "#78857c", fontSize: 16 },
  dateModalBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#14221988", padding: 20 },
  dateModalCard: { width: "100%", maxWidth: 380, backgroundColor: "#fff", borderRadius: 14, padding: 18 },
  dateModalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 4 },
  checkoutTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "#edf0ec", paddingTop: 13, marginTop: 15 },
  cancelCheckout: { alignItems: "center", paddingVertical: 12 },
  cancelText: { color: TEXT_MUTED, fontSize: 11, fontWeight: "700" },
  successContent: { alignItems: "stretch", paddingBottom: 10 },
  successIcon: { width: 52, height: 52, lineHeight: 52, borderRadius: 26, overflow: "hidden", textAlign: "center", backgroundColor: "#e8f5eb", color: BHX_GREEN, fontSize: 27, fontWeight: "900", alignSelf: "center", marginBottom: 17 },
  successTitle: { color: TEXT_DARK, fontSize: 20, fontWeight: "900", textAlign: "center", marginTop: 8, marginBottom: 18 },
  successCode: { color: BHX_GREEN, fontSize: 16, fontWeight: "900", textAlign: "center", padding: 12, backgroundColor: "#f2f7f1", borderRadius: 9 },
});
