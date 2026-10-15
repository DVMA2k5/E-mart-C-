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
  IconHome,
  IconCategoryGrid,
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
const API_URL = (process.env.EXPO_PUBLIC_API_URL || defaultHost).replace(/\/$/, "");
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

function ProductCard({ product, cartQty = 0, onAdd, onQuantityChange, cardWidthStyle }) {
  const originalPrice = Math.round((product.price * 1.15) / 1000) * 1000;
  const isHot = (product.id % 2 === 0);
  const discountPercent = Math.max(10, Math.round(((originalPrice - product.price) / originalPrice) * 100));

  return (
    <View style={[styles.productCard, cardWidthStyle, cartQty > 0 && styles.productCardActive]}>
      <View style={styles.productImageBox}>
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
      </View>

      <View style={styles.productBody}>
        <Text style={styles.productCategory} numberOfLines={1}>{product.categoryName || "BÁCH HÓA"}</Text>
        <Text style={styles.productName} numberOfLines={2}>{product.productName}</Text>

        <View style={styles.fastDeliveryTag}>
          <IconFlash size={10} color={BHX_ORANGE} />
          <Text style={styles.fastDeliveryText}>Giao nhanh 2h</Text>
        </View>

        <View style={styles.priceContainer}>
          <Text style={styles.productPrice}>{money(product.price)}</Text>
          {originalPrice > product.price && (
            <Text style={styles.originalPrice}>{money(originalPrice)}</Text>
          )}
        </View>

        {/* Smart Stepper Control */}
        <View style={styles.stepperContainer}>
          {cartQty === 0 ? (
            <Pressable
              accessibilityLabel={`Thêm ${product.productName} vào giỏ`}
              onPress={() => onAdd(product)}
              style={styles.addCartBtn}
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
                style={[styles.stepperBtn, styles.stepperBtnPlus]}
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
  const [orderFilter, setOrderFilter] = useState("all");

  const [customer, setCustomer] = useState(null);
  const [customerToken, setCustomerToken] = useState("");
  const [accountReady, setAccountReady] = useState(false);
  const [loginPhone, setLoginPhone] = useState("");
  const [accountName, setAccountName] = useState("");
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
    }).catch(() => {});
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

  const loginWithPhone = async () => {
    const phone = loginPhone.trim();
    if (!/^(0|\+84)[35789]\d{8}$/.test(phone)) {
      setAccountError("Số điện thoại Việt Nam chưa đúng định dạng.");
      return;
    }

    setAccountBusy(true);
    setAccountError("");
    setAccountMessage("");
    try {
      const response = await fetch(`${API_URL}/storefront/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
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
      setCheckoutForm((form) => ({ ...form, fullName: result.customer.fullName || "", phone: result.customer.phone }));
      setAccountMessage(result.customer.fullName ? "Đăng nhập thành công." : "Tài khoản đã tạo. Bạn có thể thêm họ tên bên dưới.");
    } catch (error) {
      setAccountError(error.message || "Không thể đăng nhập.");
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
        body: JSON.stringify({ fullName }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const profile = await response.json();
      await AsyncStorage.setItem(CUSTOMER_KEY, JSON.stringify(profile));
      setCustomer(profile);
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
          setLoginPhone("");
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

  // Sản phẩm hiển thị trong Drawer phân loại
  const drawerProducts = useMemo(() => {
    if (selectedDrawerCatId === "all") return products.slice(0, 30);
    return products.filter((p) => String(p.categoryId) === String(selectedDrawerCatId));
  }, [products, selectedDrawerCatId]);

  const cartItemMap = useMemo(() => {
    const map = {};
    for (const item of cart) {
      map[item.id] = item.quantity;
    }
    return map;
  }, [cart]);

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
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
      setVoucherList(Array.isArray(data) ? data : []);
    } catch (error) {
      setVoucherMessage(error.message || "Không tải được phiếu mua hàng.");
    }
  };

  const applyVoucher = async (code = voucherCode) => {
    const normalizedCode = code.trim();
    if (!normalizedCode) { setVoucherMessage("Nhập mã phiếu mua hàng."); return; }
    setVoucherBusy(true);
    setVoucherMessage("");
    try {
      const response = await fetch(`${API_URL}/storefront/promotions/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalizedCode, orderAmount: subtotal }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.isValid) throw new Error(result.message || "Phiếu mua hàng không hợp lệ.");
      setAppliedVoucher({ code: normalizedCode, discountAmount: result.discountAmount, promotion: result.promotion });
      setVoucherCode(normalizedCode);
      setVoucherMessage(`Đã áp dụng ${money(result.discountAmount)} giảm giá.`);
      setVoucherOpen(false);
    } catch (error) {
      setAppliedVoucher(null);
      setVoucherMessage(error.message || "Không thể áp dụng phiếu mua hàng.");
    } finally {
      setVoucherBusy(false);
    }
  };

  const addToCart = (product) => {
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      if (found) return current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { id: product.id, name: product.productName, price: product.price, image: product.imageUrl, quantity: 1 }];
    });
  };

  const changeQuantity = (id, amount) => setCart((current) => current
    .map((item) => item.id === id ? { ...item, quantity: item.quantity + amount } : item)
    .filter((item) => item.quantity > 0));

  const submitOrder = async () => {
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...checkoutForm,
          fullName: customer?.fullName?.trim() || checkoutForm.fullName.trim(),
          phone: customer?.phone || checkoutForm.phone.trim(),
          paymentMethod,
          pointsUsed: useRewardPoints ? maxPointsUsable : 0,
          items: cart.map((item) => ({ productId: item.id, quantity: item.quantity })),
          promotionCode: appliedVoucher?.code || null,
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
    if (isWide) return { width: "9.2%" };
    if (isDesktop) return { width: "15%" };
    return { width: "19%" }; // 5 ô mỗi hàng trên mobile
  }, [isDesktop, isWide]);

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
              onPress={() => {
                if (currentBanner.code) {
                  applyVoucher(currentBanner.code);
                }
              }}
              style={styles.bannerCtaBtn}
            >
              <Text style={styles.bannerCtaText}>Nhận mã ngay  ›</Text>
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
        <View style={styles.trustBar}>
          <View style={styles.trustItem}>
            <IconFlash size={16} color={BHX_ORANGE} />
            <Text style={styles.trustLabel}>Giao siêu tốc 2h</Text>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustItem}>
            <IconCheck size={16} color={BHX_GREEN} />
            <Text style={styles.trustLabel}>100% Chính hãng</Text>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustItem}>
            <IconStar size={16} color="#f59e0b" />
            <Text style={styles.trustLabel}>Tích điểm đổi quà</Text>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustItem}>
            <IconShield size={16} color={BHX_GREEN} />
            <Text style={styles.trustLabel}>Đổi trả tận nơi</Text>
          </View>
        </View>

        {/* 3. MENU PHÂN LOẠI NGÀNH HÀNG GRID 10 Ô */}
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

        <View style={styles.categoryGridContainer}>
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
        </View>

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
                    <Text style={styles.cartPrice}>{money(item.price)}</Text>
                    <View style={styles.cartStepperRow}>
                      <Pressable onPress={() => changeQuantity(item.id, -1)} style={styles.cartStepperBtn}>
                        <IconMinus size={12} color="#334155" />
                      </Pressable>
                      <Text style={styles.cartStepperQty}>{item.quantity}</Text>
                      <Pressable onPress={() => changeQuantity(item.id, 1)} style={[styles.cartStepperBtn, styles.cartStepperBtnPlus]}>
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
      const paidAmount = String(selectedOrder.paymentStatus || "").toLowerCase() === "completed"
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
    <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.responsiveContainer}>
        {profilePage ? (
          <>
            <View style={styles.accountPageHeading}>
              <Pressable style={styles.accountBackButton} onPress={() => { setProfilePage(""); setAccountError(""); setAccountMessage(""); setAddressMessage(""); }}>
                <Text style={styles.accountBack}>‹</Text>
              </Pressable>
              <Text style={styles.accountPageTitle}>
                {profilePage === "personal" ? "Thông tin tài khoản" : "Địa chỉ giao hàng"}
              </Text>
            </View>

            {profilePage === "personal" ? (
              <View style={styles.infoCard}>
                <Text style={styles.inputLabel}>HỌ VÀ TÊN</Text>
                <TextInput value={accountName} onChangeText={setAccountName} placeholder="Họ và tên của bạn" style={styles.accountInput} maxLength={150} autoCapitalize="words" />
                <Text style={styles.inputLabel}>SỐ ĐIỆN THOẠI ĐĂNG KÝ</Text>
                <Text style={[styles.accountInput, styles.phoneReadonly]}>{customer?.phone}</Text>
                {accountError ? <Text style={styles.orderError}>{accountError}</Text> : null}
                {accountMessage ? <Text style={styles.accountMessage}>{accountMessage}</Text> : null}
                <AppButton title={accountBusy ? "Đang lưu..." : "Lưu thay đổi"} onPress={saveAccountName} disabled={accountBusy} />
              </View>
            ) : (
              <View style={styles.infoCard}>
                <Text style={styles.inputLabel}>TỈNH / THÀNH PHỐ</Text>
                <TextInput value={deliveryAddress.city} onChangeText={(city) => setDeliveryAddress((a) => ({ ...a, city }))} placeholder="Ví dụ: TP. Hồ Chí Minh" style={styles.accountInput} />
                <Text style={styles.inputLabel}>QUẬN / HUYỆN / PHƯỜNG / XÃ</Text>
                <TextInput value={deliveryAddress.ward} onChangeText={(ward) => setDeliveryAddress((a) => ({ ...a, ward }))} placeholder="Ví dụ: Phường Bến Nghé, Quận 1" style={styles.accountInput} />
                <Text style={styles.inputLabel}>SỐ NHÀ, TÊN ĐƯỜNG</Text>
                <TextInput value={deliveryAddress.street} onChangeText={(street) => setDeliveryAddress((a) => ({ ...a, street }))} placeholder="Ví dụ: 72 Lê Thánh Tôn" style={styles.accountInput} />
                {addressMessage ? <Text style={styles.accountMessage}>{addressMessage}</Text> : null}
                <AppButton title="Lưu địa chỉ nhận hàng" onPress={saveDeliveryAddress} />
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={styles.eyebrow}>BÁCH HÓA XANH</Text>
            <Text style={styles.pageTitle}>Tài khoản thành viên</Text>

            {!accountReady ? (
              <View style={styles.centerState}>
                <ActivityIndicator color={BHX_GREEN} />
                <Text style={styles.stateText}>Đang tải hồ sơ...</Text>
              </View>
            ) : customer ? (
              <>
                <View style={styles.profileCard}>
                  <View style={styles.profileAvatarBox}>
                    <IconUser size={34} color={BHX_GREEN} />
                  </View>
                  <Text style={styles.profileName}>{customer.fullName || "Khách Hàng Thân Thiết"}</Text>
                  <Text style={styles.profilePhone}>{customer.phone}</Text>
                  <View style={styles.pointsPill}>
                    <IconStar size={15} color="#d97706" />
                    <Text style={styles.pointsText}>{customer.rewardPoints || 0} điểm tích lũy</Text>
                    <Text style={styles.pointsEquivalent}>= {money((customer.rewardPoints || 0) * 1000)}</Text>
                  </View>
                </View>

                <View style={styles.infoCard}>
                  <Text style={styles.infoTitle}>Cài đặt cá nhân</Text>
                  <Pressable style={styles.profileMenuRow} onPress={() => { setAccountName(customer.fullName || ""); setProfilePage("personal"); }}>
                    <Text style={styles.profileMenuText}>Hồ sơ cá nhân</Text>
                    <IconChevronRight size={18} color="#94a3b8" />
                  </Pressable>
                  <Pressable style={styles.profileMenuRow} onPress={() => { setAddressMessage(""); setProfilePage("address"); }}>
                    <Text style={styles.profileMenuText}>Địa chỉ nhận hàng mặc định</Text>
                    <IconChevronRight size={18} color="#94a3b8" />
                  </Pressable>
                </View>

                <View style={styles.infoCard}>
                  <AppButton title="Đăng xuất tài khoản" secondary onPress={logoutCustomer} />
                </View>
              </>
            ) : (
              <>
                <View style={styles.profileCard}>
                  <View style={styles.profileAvatarBox}>
                    <IconUser size={34} color={BHX_GREEN} />
                  </View>
                  <Text style={styles.emptyTitle}>Đăng nhập bằng SĐT</Text>
                  <Text style={styles.stateText}>Nhập số điện thoại để tích điểm và theo dõi đơn hàng giao tận nhà.</Text>
                </View>
                <View style={styles.infoCard}>
                  <Text style={styles.inputLabel}>SỐ ĐIỆN THOẠI DI ĐỘNG</Text>
                  <TextInput
                    value={loginPhone}
                    onChangeText={setLoginPhone}
                    placeholder="0912345678"
                    style={styles.formInput}
                    keyboardType="phone-pad"
                    maxLength={13}
                    autoComplete="tel"
                  />
                  {accountError ? <Text style={styles.orderError}>{accountError}</Text> : null}
                  <AppButton title={accountBusy ? "Đang kết nối..." : "Đăng nhập ngay"} onPress={loginWithPhone} disabled={accountBusy} />
                  {accountMessage ? <Text style={styles.accountMessage}>{accountMessage}</Text> : null}
                </View>
              </>
            )}
          </>
        )}
      </View>
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
            <View style={styles.locationRight}>
              <IconFlash size={10} color={BHX_YELLOW} />
              <Text style={styles.speedText}>Giao 2h</Text>
            </View>
          </Pressable>

          {/* Dòng 1: Logo + Nút Danh Mục + Giỏ Hàng */}
          <View style={styles.headerTopLine}>
            {/* Logo Bách Hóa Xanh E-Mart */}
            <Pressable onPress={() => { setCategoryId("all"); setTab("home"); }} style={styles.brandRow}>
              <Text style={styles.brandTextE}>E-MART</Text>
              <View style={styles.brandTagBox}>
                <Text style={styles.brandTextXanh}>XANH</Text>
              </View>
            </Pressable>

            {/* Cụm Action: Danh mục + Giỏ hàng */}
            <View style={styles.headerRightGroup}>
              <Pressable
                onPress={() => {
                  setSelectedDrawerCatId(categoryId === "all" ? "all" : categoryId);
                  setCategoryModalOpen(true);
                }}
                style={styles.categoryMenuBtn}
              >
                <IconMenu size={15} color="#ffffff" />
                <Text style={styles.categoryMenuBtnText}>Danh mục</Text>
              </Pressable>

              <Pressable onPress={() => setTab("cart")} style={styles.headerCart}>
                <IconCart size={20} color="#ffffff" />
                {itemCount > 0 && (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{itemCount > 99 ? "99+" : itemCount}</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>

          {/* Dòng 2: Thanh Tìm Kiếm 100% Full Width Không Bao Giờ Bị Tràn */}
          <View style={styles.searchBar}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Bạn tìm thịt cá, rau củ, mì gói, nước giặt..."
              placeholderTextColor="#64748b"
              style={styles.searchInput}
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery("")} style={styles.clearSearchBtn}>
                <IconClose size={14} color="#64748b" />
              </Pressable>
            ) : (
              <Pressable style={styles.searchSubmitBtn}>
                <IconSearch size={16} color="#ffffff" />
              </Pressable>
            )}
          </View>

          {/* Quick Search Tags */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickTagsRow}>
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

      {/* NỘI DUNG MÀN HÌNH CHÍNH */}
      <View style={styles.screen}>
        {tab === "home" ? renderHome() : tab === "cart" ? renderCart() : tab === "orders" ? renderOrders() : renderProfile()}
      </View>

      {/* BOTTOM NAVIGATION CHUẨN APP */}
      <View style={styles.bottomNav}>
        <View style={styles.bottomNavInner}>
          {[
            { key: "home", label: "Trang chủ", icon: (active) => <IconHome size={20} color={active ? BHX_GREEN : "#64748b"} active={active} /> },
            { key: "categories", label: "Danh mục", icon: (active) => <IconCategoryGrid size={20} color={active ? BHX_GREEN : "#64748b"} active={active} /> },
            { key: "orders", label: "Đơn hàng", icon: (active) => <IconReceipt size={20} color={active ? BHX_GREEN : "#64748b"} active={active} /> },
            { key: "profile", label: "Tài khoản", icon: (active) => <IconUser size={20} color={active ? BHX_GREEN : "#64748b"} active={active} /> },
          ].map((item) => {
            const isActive = tab === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => {
                  if (item.key === "categories") {
                    setSelectedDrawerCatId(categoryId === "all" ? "all" : categoryId);
                    setCategoryModalOpen(true);
                  } else {
                    setTab(item.key);
                  }
                }}
                style={styles.navItem}
              >
                <View style={styles.navIconWrapper}>
                  {item.icon(isActive)}
                </View>
                <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ========================================================================= */}
      {/* MODAL MENU PHÂN LOẠI 2 CỘT CHUẨN BÁCH HÓA XANH (FIXED TỶ LỆ SIDEBAR TRÊN MOBILE) */}
      {/* ========================================================================= */}
      <Modal
        visible={categoryModalOpen}
        animationType="fade"
        transparent={isDesktop}
        onRequestClose={() => setCategoryModalOpen(false)}
      >
        <View style={isDesktop ? styles.drawerDesktopBackdrop : styles.drawerSafeArea}>
          <View style={isDesktop ? styles.drawerDesktopDialog : styles.drawerMobileContainer}>
            {/* Drawer Header */}
            <View style={styles.drawerHeader}>
              <Pressable onPress={() => setCategoryModalOpen(false)} style={styles.drawerCloseBtn}>
                <Text style={styles.drawerBackText}>‹</Text>
              </Pressable>
              <Text style={styles.drawerTitle}>DANH MỤC PHÂN LOẠI</Text>
              <Pressable onPress={() => { setCategoryModalOpen(false); setTab("cart"); }} style={styles.drawerCartBtn}>
                <IconCart size={18} color={BHX_GREEN} />
                {itemCount > 0 && (
                  <View style={styles.drawerCartBadge}>
                    <Text style={styles.drawerCartBadgeText}>{itemCount}</Text>
                  </View>
                )}
              </Pressable>
            </View>

            {/* Layout 2 cột chuẩn Bách Hóa Xanh */}
            <View style={styles.drawerBody}>
              {/* CỘT TRÁI: DANH SÁCH CÁC NGÀNH HÀNG (CỐ ĐỊNH 92px TRÊN MOBILE) */}
              <View style={[styles.drawerSidebarWrapper, isDesktop ? { width: 220, maxWidth: 220, flexBasis: 220 } : { width: 92, maxWidth: 92, flexBasis: 92 }]}>
                <ScrollView style={styles.drawerSidebar} showsVerticalScrollIndicator={false}>
                  {/* Tất cả */}
                  <Pressable
                    onPress={() => setSelectedDrawerCatId("all")}
                    style={[styles.sidebarItem, selectedDrawerCatId === "all" && styles.sidebarItemActive]}
                  >
                    <View style={styles.sidebarIconWrap}>
                      <CategoryAll size={24} />
                    </View>
                    <Text style={[styles.sidebarText, selectedDrawerCatId === "all" && styles.sidebarTextActive]}>
                      Tất cả
                    </Text>
                    {selectedDrawerCatId === "all" && <View style={styles.sidebarActiveLine} />}
                  </Pressable>

                  {categories.map((cat) => {
                    const isCur = String(selectedDrawerCatId) === String(cat.id);
                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() => setSelectedDrawerCatId(String(cat.id))}
                        style={[styles.sidebarItem, isCur && styles.sidebarItemActive]}
                      >
                        <View style={styles.sidebarIconWrap}>
                          {getCategoryIcon(cat.name, 24)}
                        </View>
                        <Text style={[styles.sidebarText, isCur && styles.sidebarTextActive]} numberOfLines={2}>
                          {cat.name}
                        </Text>
                        {isCur && <View style={styles.sidebarActiveLine} />}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* CỘT PHẢI: CHI TIẾT SẢN PHẨM CỦA NGÀNH HÀNG ĐANG CHỌN */}
              <View style={styles.drawerContentCol}>
                <View style={styles.drawerContentHeader}>
                  <Text style={styles.drawerSelectedCategoryName} numberOfLines={1}>
                    {selectedDrawerCatId === "all" ? "Tất cả sản phẩm" : (categories.find((c) => String(c.id) === String(selectedDrawerCatId))?.name || "Ngành hàng")}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setCategoryId(selectedDrawerCatId);
                      setCategoryModalOpen(false);
                      setTab("home");
                    }}
                    style={styles.viewCategoryInHomeBtn}
                  >
                    <Text style={styles.viewCategoryInHomeText}>Xem ngoài trang chủ ›</Text>
                  </Pressable>
                </View>

                <ScrollView contentContainerStyle={styles.drawerProductList} showsVerticalScrollIndicator={false}>
                  {drawerProducts.map((p) => {
                    const qty = cartItemMap[p.id] || 0;
                    return (
                      <View key={p.id} style={styles.drawerProductRow}>
                        <View style={styles.drawerProductThumb}>
                          <ProductImage
                            imagePath={p.imageUrl}
                            productId={p.id}
                            categoryName={p.categoryName}
                            style={styles.drawerProductImage}
                          />
                        </View>
                        <View style={styles.drawerProductInfo}>
                          <Text style={styles.drawerProductName} numberOfLines={2}>{p.productName}</Text>
                          <Text style={styles.drawerProductPrice}>{money(p.price)}</Text>
                        </View>

                        {/* Nút mua / tăng giảm ngay trong menu phân loại */}
                        <View style={styles.drawerProductAction}>
                          {qty === 0 ? (
                            <Pressable
                              onPress={() => addToCart(p)}
                              style={styles.drawerAddBtn}
                            >
                              <IconPlus size={12} color="#ffffff" />
                              <Text style={styles.drawerAddBtnText}>Mua</Text>
                            </Pressable>
                          ) : (
                            <View style={styles.drawerStepperBox}>
                              <Pressable onPress={() => changeQuantity(p.id, -1)} style={styles.drawerStepperMiniBtn}>
                                <IconMinus size={11} color={BHX_GREEN} />
                              </Pressable>
                              <Text style={styles.drawerStepperQty}>{qty}</Text>
                              <Pressable onPress={() => changeQuantity(p.id, 1)} style={[styles.drawerStepperMiniBtn, styles.drawerStepperPlus]}>
                                <IconPlus size={11} color="#ffffff" />
                              </Pressable>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                  {!drawerProducts.length && (
                    <View style={styles.centerState}>
                      <Text style={styles.stateText}>Không có sản phẩm trong nhóm này.</Text>
                    </View>
                  )}
                  <View style={{ height: 20 }} />
                </ScrollView>
              </View>
            </View>
          </View>
        </View>
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
                placeholder="Nhập mã ưu đãi..."
                autoCapitalize="characters"
                style={styles.voucherInput}
              />
              <Pressable disabled={voucherBusy} onPress={() => applyVoucher()} style={[styles.voucherAdd, voucherBusy && styles.buttonDisabled]}>
                <Text style={styles.voucherAddText}>{voucherBusy ? "..." : "Áp dụng"}</Text>
              </Pressable>
            </View>

            <Text style={styles.voucherSubheading}>Mã ưu đãi đang có sẵn</Text>
            <ScrollView style={styles.voucherList} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {voucherList.map((voucher) => (
                <View key={voucher.id} style={styles.voucherCard}>
                  <View style={styles.voucherCardTop}>
                    <View style={styles.voucherBadge}>
                      <Text style={styles.voucherBadgeText}>{voucher.discountType === "percent" ? `${voucher.value}%` : money(voucher.value)}</Text>
                    </View>
                    <View style={styles.voucherInfo}>
                      <Text style={styles.voucherName}>{voucher.name || "Phiếu mua hàng"}</Text>
                      <Text style={styles.voucherExpiry}>{voucher.code}{voucher.endDate ? ` · Hạn ${new Date(voucher.endDate).toLocaleDateString("vi-VN")}` : ""}</Text>
                    </View>
                    <Pressable onPress={() => applyVoucher(voucher.code)} style={styles.voucherUseBtn}>
                      <Text style={styles.voucherUseText}>Dùng</Text>
                    </Pressable>
                  </View>
                  {voucher.description && <Text style={styles.voucherDescription}>{voucher.description}</Text>}
                  {voucher.minOrderAmount > 0 && <Text style={styles.voucherExpiry}>Đơn tối thiểu {money(voucher.minOrderAmount)}</Text>}
                </View>
              ))}
              {!voucherList.length && !voucherMessage && (
                <View style={styles.centerState}><Text style={styles.stateText}>Hiện chưa có mã công khai nào khác.</Text></View>
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
  safeArea: {
    flex: 1,
    backgroundColor: BG_PAGE,
  },
  responsiveContainer: {
    width: "100%",
    maxWidth: 1200,
    alignSelf: "center",
  },

  // 1. TOP HEADER PHONG CÁCH BÁCH HÓA XANH (BỐ CỤC 2 TẦNG CHỐNG TRÀN TRÊN MOBILE)
  header: {
    backgroundColor: BHX_GREEN,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  headerResponsiveInner: {
    width: "100%",
    maxWidth: 1200,
    alignSelf: "center",
  },
  locationBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0, 0, 0, 0.18)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  locationLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 6,
    gap: 4,
  },
  locationLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#e2e8f0",
  },
  locationAddress: {
    fontSize: 11,
    fontWeight: "800",
    color: "#ffffff",
    flexShrink: 1,
  },
  locationRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(255, 212, 0, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  speedText: {
    fontSize: 10,
    fontWeight: "900",
    color: BHX_YELLOW,
  },

  headerTopLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  brandTextE: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  brandTagBox: {
    backgroundColor: BHX_YELLOW,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  brandTextXanh: {
    color: BHX_GREEN,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  headerRightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryMenuBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  categoryMenuBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  headerCart: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cartBadge: {
    position: "absolute",
    right: -4,
    top: -4,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: BHX_RED,
    borderWidth: 1.5,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  cartBadgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900",
  },

  // Search Bar (100% chiều rộng chống tràn)
  searchBar: {
    height: 38,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    paddingRight: 3,
    overflow: "hidden",
  },
  searchInput: {
    flex: 1,
    color: TEXT_DARK,
    fontSize: 12,
    paddingVertical: 0,
  },
  searchSubmitBtn: {
    backgroundColor: BHX_YELLOW,
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  clearSearchBtn: {
    padding: 6,
  },

  // Quick Tags
  quickTagsRow: {
    gap: 6,
    marginTop: 8,
    paddingBottom: 2,
  },
  quickTagChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  quickTagChipActive: {
    backgroundColor: BHX_YELLOW,
  },
  quickTagText: {
    fontSize: 10,
    color: "#ffffff",
    fontWeight: "700",
  },
  quickTagTextActive: {
    color: BHX_GREEN,
    fontWeight: "900",
  },

  // Scroll Content
  screen: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 24,
  },

  // Hero Banner
  heroBanner: {
    minHeight: 120,
    borderRadius: 12,
    padding: 14,
    overflow: "hidden",
    position: "relative",
    justifyContent: "center",
  },
  bannerInfo: {
    maxWidth: "85%",
    zIndex: 2,
  },
  bannerBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
    gap: 4,
  },
  bannerBadgeText: {
    color: BHX_YELLOW,
    fontSize: 9,
    fontWeight: "900",
  },
  bannerTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  bannerSubtitle: {
    color: "#e2e8f0",
    fontSize: 11,
    marginTop: 2,
  },
  bannerCtaBtn: {
    alignSelf: "flex-start",
    backgroundColor: BHX_YELLOW,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
  },
  bannerCtaText: {
    color: BHX_GREEN,
    fontSize: 10,
    fontWeight: "900",
  },
  bannerDots: {
    position: "absolute",
    bottom: 8,
    right: 12,
    flexDirection: "row",
    gap: 4,
    zIndex: 3,
  },
  bannerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
  },
  bannerDotActive: {
    width: 14,
    backgroundColor: BHX_YELLOW,
  },

  // Trust Bar
  trustBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  trustItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  trustLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: TEXT_DARK,
    textAlign: "center",
  },
  trustDivider: {
    width: 1,
    height: 20,
    backgroundColor: "#e2e8f0",
  },

  // 3. MENU PHÂN LOẠI NGÀNH HÀNG GRID 10 Ô
  categorySectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    marginBottom: 8,
  },
  categorySectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  greenBar: {
    width: 4,
    height: 14,
    backgroundColor: BHX_GREEN,
    borderRadius: 2,
  },
  categorySectionTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: TEXT_DARK,
    letterSpacing: 0.3,
  },
  openCategoryDrawerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  openCategoryDrawerText: {
    fontSize: 11,
    color: BHX_GREEN,
    fontWeight: "800",
  },

  categoryGridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    justifyContent: "space-between",
    rowGap: 4,
  },
  categoryGridItem: {
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 8,
  },
  categoryGridItemActive: {
    backgroundColor: "#e8f5ec",
    borderWidth: 1,
    borderColor: BHX_GREEN,
  },
  categoryIconWrap: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  categoryGridText: {
    fontSize: 9,
    fontWeight: "700",
    color: TEXT_DARK,
    textAlign: "center",
    lineHeight: 12,
  },
  categoryGridTextActive: {
    color: BHX_GREEN,
    fontWeight: "900",
  },

  // 4. FILTER TOOLBAR
  filterToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    marginBottom: 10,
  },
  filterLeft: {
    flex: 1,
    marginRight: 6,
  },
  filterResultCount: {
    fontSize: 13,
    fontWeight: "800",
    color: TEXT_DARK,
  },
  filterNumber: {
    fontSize: 12,
    color: TEXT_MUTED,
    fontWeight: "600",
  },
  sortPillsRow: {
    flexDirection: "row",
    gap: 5,
  },
  sortPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    gap: 3,
  },
  sortPillActive: {
    backgroundColor: BHX_GREEN,
    borderColor: BHX_GREEN,
  },
  sortPillText: {
    fontSize: 10,
    color: TEXT_DARK,
    fontWeight: "700",
  },
  sortPillTextActive: {
    color: "#ffffff",
  },

  // 5. PRODUCT GRID (RESPONSIVE CHUẨN CẢ MOBILE & DESKTOP)
  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  productCard: {
    backgroundColor: "#ffffff",
    borderColor: BORDER_COLOR,
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
    paddingBottom: 8,
    ...Platform.select({
      web: {
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      },
      default: {
        elevation: 1,
      },
    }),
  },
  productCardActive: {
    borderColor: BHX_GREEN,
    borderWidth: 1.5,
    backgroundColor: "#fcfdfc",
  },
  productImageBox: {
    height: 125,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    padding: 6,
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  badgeRow: {
    position: "absolute",
    top: 4,
    left: 4,
    flexDirection: "column",
    gap: 3,
  },
  discountBadge: {
    backgroundColor: BHX_RED,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  discountBadgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900",
  },
  hotBadge: {
    backgroundColor: BHX_ORANGE,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  hotBadgeText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "900",
  },

  productBody: {
    paddingHorizontal: 8,
    paddingTop: 6,
  },
  productCategory: {
    color: "#94a3b8",
    fontSize: 8,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  productName: {
    color: TEXT_DARK,
    fontWeight: "800",
    fontSize: 12,
    lineHeight: 16,
    minHeight: 32,
    marginTop: 2,
  },
  fastDeliveryTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 3,
  },
  fastDeliveryText: {
    fontSize: 9,
    color: BHX_ORANGE,
    fontWeight: "800",
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 5,
    marginTop: 5,
    marginBottom: 6,
  },
  productPrice: {
    color: BHX_GREEN,
    fontSize: 14,
    fontWeight: "900",
  },
  originalPrice: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "600",
    textDecorationLine: "line-through",
  },

  // Smart Stepper
  stepperContainer: {
    height: 30,
  },
  addCartBtn: {
    flex: 1,
    height: 30,
    backgroundColor: BHX_GREEN,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addCartBtnText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
  },
  stepperBox: {
    flex: 1,
    height: 30,
    backgroundColor: "#ffffff",
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderColor: BHX_GREEN,
    overflow: "hidden",
  },
  stepperBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  stepperQtyText: {
    color: BHX_GREEN,
    fontSize: 12,
    fontWeight: "900",
  },
  stepperBtnPlus: {
    backgroundColor: BHX_GREEN,
  },

  // ==========================================
  // MEGA CATEGORY DRAWER (MENU PHÂN LOẠI 2 CỘT FIX TỶ LỆ)
  // ==========================================
  drawerSafeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  drawerDesktopBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  drawerDesktopDialog: {
    width: "100%",
    maxWidth: 960,
    height: "88%",
    maxHeight: 750,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
    ...Platform.select({
      web: {
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
      },
    }),
  },
  drawerMobileContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  drawerHeader: {
    height: 48,
    backgroundColor: BHX_GREEN,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  drawerCloseBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  drawerBackText: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 30,
  },
  drawerTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  drawerCartBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  drawerCartBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: BHX_RED,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  drawerCartBadgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900",
  },

  drawerBody: {
    flex: 1,
    flexDirection: "row",
    overflow: "hidden",
    width: "100%",
  },
  drawerSidebarWrapper: {
    backgroundColor: "#f8fafc",
    borderRightWidth: 1,
    borderRightColor: BORDER_COLOR,
    flexGrow: 0,
    flexShrink: 0,
    width: 92,
    maxWidth: 92,
  },
  drawerSidebar: {
    flex: 1,
    width: "100%",
  },
  sidebarItem: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    position: "relative",
  },
  sidebarItemActive: {
    backgroundColor: "#ffffff",
  },
  sidebarIconWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  sidebarText: {
    fontSize: 9,
    color: TEXT_MUTED,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 12,
  },
  sidebarTextActive: {
    color: BHX_GREEN,
    fontWeight: "900",
  },
  sidebarActiveLine: {
    position: "absolute",
    left: 0,
    top: 4,
    bottom: 4,
    width: 3.5,
    backgroundColor: BHX_GREEN,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },

  drawerContentCol: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  drawerContentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    backgroundColor: "#fdfdfd",
  },
  drawerSelectedCategoryName: {
    fontSize: 12,
    fontWeight: "900",
    color: TEXT_DARK,
    flex: 1,
    marginRight: 6,
  },
  viewCategoryInHomeBtn: {
    paddingVertical: 2,
  },
  viewCategoryInHomeText: {
    fontSize: 10,
    color: BHX_GREEN,
    fontWeight: "800",
  },
  drawerProductList: {
    padding: 8,
  },
  drawerProductRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    gap: 8,
  },
  drawerProductThumb: {
    width: 52,
    height: 52,
    borderRadius: 6,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  drawerProductImage: {
    width: "100%",
    height: "100%",
  },
  drawerProductInfo: {
    flex: 1,
    minWidth: 0,
  },
  drawerProductName: {
    fontSize: 11,
    fontWeight: "800",
    color: TEXT_DARK,
    lineHeight: 15,
  },
  drawerProductPrice: {
    fontSize: 12,
    fontWeight: "900",
    color: BHX_GREEN,
    marginTop: 2,
  },
  drawerProductAction: {
    alignItems: "flex-end",
    marginLeft: 4,
  },
  drawerAddBtn: {
    backgroundColor: BHX_GREEN,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    gap: 3,
  },
  drawerAddBtnText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
  },
  drawerStepperBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: BHX_GREEN,
    borderRadius: 5,
    overflow: "hidden",
  },
  drawerStepperMiniBtn: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  drawerStepperPlus: {
    backgroundColor: BHX_GREEN,
  },
  drawerStepperQty: {
    paddingHorizontal: 6,
    fontSize: 11,
    fontWeight: "900",
    color: BHX_GREEN,
  },

  // Bottom Navigation (Responsive)
  bottomNav: {
    height: 54,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomNavInner: {
    width: "100%",
    maxWidth: 600,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  navItem: {
    minWidth: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  navIconWrapper: {
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  navLabel: {
    color: TEXT_MUTED,
    fontSize: 9,
    fontWeight: "700",
    marginTop: 2,
  },
  navLabelActive: {
    color: BHX_GREEN,
    fontWeight: "900",
  },

  // Cart Desktop Layout
  cartDesktopLayout: {
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
  },
  cartItemListCol: {
    flex: 1.6,
  },
  cartSummaryCol: {
    flex: 1,
    marginTop: 0,
  },

  // Cart, Orders & Profile Common
  pageContent: {
    padding: 12,
    paddingBottom: 26,
  },
  eyebrow: {
    color: BHX_GREEN,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  pageTitle: {
    color: TEXT_DARK,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 2,
    marginBottom: 12,
  },
  cartRow: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  cartThumb: {
    width: 60,
    height: 60,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    padding: 4,
  },
  cartImage: {
    width: "100%",
    height: "100%",
  },
  cartInfo: {
    flex: 1,
    justifyContent: "center",
  },
  cartName: {
    color: TEXT_DARK,
    fontSize: 12,
    fontWeight: "800",
  },
  cartPrice: {
    color: BHX_GREEN,
    fontWeight: "900",
    fontSize: 13,
    marginTop: 3,
  },
  cartStepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 5,
  },
  cartStepperBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  cartStepperBtnPlus: {
    backgroundColor: BHX_GREEN,
    borderColor: BHX_GREEN,
  },
  cartStepperQty: {
    color: TEXT_DARK,
    fontSize: 12,
    fontWeight: "800",
    minWidth: 18,
    textAlign: "center",
  },

  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  summaryLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 4,
  },
  summaryLabel: {
    color: TEXT_MUTED,
    fontSize: 11,
  },
  summaryValue: {
    color: TEXT_DARK,
    fontSize: 12,
    fontWeight: "800",
  },
  freeShipping: {
    color: BHX_GREEN,
    fontSize: 11,
    fontWeight: "800",
  },
  voucherRow: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    marginTop: 6,
    paddingTop: 6,
  },
  voucherLabel: {
    color: TEXT_DARK,
    fontSize: 11,
    fontWeight: "700",
  },
  voucherAction: {
    color: BHX_GREEN,
    fontSize: 11,
    fontWeight: "800",
  },
  voucherRemove: {
    color: BHX_RED,
    fontSize: 11,
    textAlign: "right",
    marginBottom: 4,
  },
  summaryTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    marginTop: 8,
    paddingTop: 8,
  },
  summaryTotalLabel: {
    color: TEXT_DARK,
    fontSize: 12,
    fontWeight: "900",
  },
  summaryTotalValue: {
    color: BHX_GREEN,
    fontSize: 16,
    fontWeight: "900",
  },

  // Orders
  ordersScreen: {
    flex: 1,
    backgroundColor: BG_PAGE,
  },
  ordersTitle: {
    color: TEXT_DARK,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  orderFilterScroll: {
    height: 42,
    flexGrow: 0,
    flexShrink: 0,
  },
  orderFilterRow: {
    paddingHorizontal: 10,
    alignItems: "center",
    gap: 6,
  },
  orderFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: "#e2e8f0",
  },
  orderFilterChipActive: {
    backgroundColor: BHX_GREEN,
  },
  orderFilterText: {
    color: TEXT_DARK,
    fontSize: 10,
    fontWeight: "700",
  },
  orderFilterTextActive: {
    color: "#ffffff",
  },
  orderListContent: {
    padding: 10,
    paddingTop: 6,
    paddingBottom: 24,
  },
  orderListCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  orderListHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  orderListNumber: {
    flex: 1,
    color: TEXT_DARK,
    fontSize: 12,
    fontWeight: "900",
  },
  orderViewLink: {
    color: BHX_GREEN,
    fontSize: 11,
    fontWeight: "800",
  },
  orderPickup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    backgroundColor: "#f8fafc",
    padding: 6,
  },
  orderPickupText: {
    flex: 1,
    color: TEXT_MUTED,
    fontSize: 10,
    fontWeight: "600",
  },
  orderThumbnailRow: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 8,
    alignItems: "center",
  },
  orderThumbnailBox: {
    width: 48,
    height: 52,
    borderRadius: 6,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    padding: 3,
  },
  orderThumbnail: {
    width: "100%",
    height: "100%",
  },
  orderMoreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  orderMoreText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
  },
  orderListTotals: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderListStatus: {
    color: BHX_GREEN,
    fontSize: 11,
    fontWeight: "800",
  },
  orderListTotal: {
    color: TEXT_DARK,
    fontSize: 11,
    fontWeight: "800",
  },

  orderDetailHeading: {
    minHeight: 46,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  orderBack: {
    position: "absolute",
    left: 8,
    height: 38,
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  orderBackText: {
    color: TEXT_DARK,
    fontSize: 28,
    lineHeight: 32,
  },
  orderDetailTitle: {
    color: TEXT_DARK,
    fontSize: 13,
    fontWeight: "900",
  },
  orderDetailContent: {
    padding: 10,
    paddingBottom: 24,
  },
  orderInfoCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  orderInfoTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  orderInfoLabel: {
    color: TEXT_DARK,
    fontSize: 11,
    fontWeight: "900",
  },
  orderInfoDate: {
    color: TEXT_MUTED,
    fontSize: 10,
  },
  orderAddress: {
    color: TEXT_DARK,
    fontSize: 12,
    lineHeight: 16,
  },
  orderStatusText: {
    color: BHX_GREEN,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 6,
  },
  orderItemsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  orderItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    gap: 8,
  },
  orderItemImageBox: {
    width: 48,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 6,
    padding: 3,
  },
  orderItemImage: {
    width: "100%",
    height: "100%",
  },
  orderItemInfo: {
    flex: 1,
  },
  orderItemName: {
    color: TEXT_DARK,
    fontSize: 11,
    fontWeight: "700",
  },
  orderItemQuantity: {
    color: TEXT_MUTED,
    fontSize: 10,
    marginTop: 2,
  },
  orderItemAmount: {
    alignItems: "flex-end",
  },
  orderItemPrice: {
    color: TEXT_DARK,
    fontSize: 12,
    fontWeight: "900",
  },
  orderItemUnitPrice: {
    color: TEXT_MUTED,
    fontSize: 10,
    textDecorationLine: "line-through",
  },
  orderTotals: {
    paddingTop: 6,
  },

  // Profile
  profileCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    alignItems: "center",
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  profileAvatarBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#e8f5ec",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  profileName: {
    color: TEXT_DARK,
    fontSize: 15,
    fontWeight: "900",
  },
  profilePhone: {
    color: TEXT_MUTED,
    fontSize: 11,
    marginTop: 2,
  },
  pointsPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef3c7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    marginTop: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  pointsText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#b45309",
  },
  pointsEquivalent: {
    fontSize: 10,
    color: TEXT_MUTED,
  },
  infoCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  infoTitle: {
    color: TEXT_DARK,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 4,
  },
  profileMenuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  profileMenuText: {
    color: TEXT_DARK,
    fontSize: 12,
    fontWeight: "700",
  },
  accountPageHeading: {
    minHeight: 44,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    marginBottom: 8,
  },
  accountBackButton: {
    position: "absolute",
    left: 8,
    height: 38,
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  accountBack: {
    color: TEXT_DARK,
    fontSize: 28,
    lineHeight: 32,
  },
  accountPageTitle: {
    color: TEXT_DARK,
    fontSize: 14,
    fontWeight: "900",
  },
  accountInput: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 8,
    paddingHorizontal: 10,
    color: TEXT_DARK,
    fontSize: 12,
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  phoneReadonly: {
    backgroundColor: "#f1f5f9",
    paddingTop: 10,
  },

  // Modals
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  checkoutSheet: {
    maxHeight: "92%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 16,
  },
  checkoutSheetDesktop: {
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    marginVertical: "auto",
  },
  sheetHandle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#cbd5e1",
    alignSelf: "center",
    marginBottom: 10,
  },
  checkoutContent: {
    paddingBottom: 10,
  },
  checkoutTitle: {
    color: TEXT_DARK,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 2,
  },
  inputLabel: {
    color: "#475569",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 4,
  },
  formInput: {
    minHeight: 38,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 8,
    paddingHorizontal: 10,
    color: TEXT_DARK,
    fontSize: 12,
  },
  addressInput: {
    minHeight: 52,
    textAlignVertical: "top",
    paddingTop: 8,
  },
  noteInput: {
    minHeight: 40,
    textAlignVertical: "top",
    paddingTop: 8,
  },
  paymentMethodOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: BORDER_COLOR,
    backgroundColor: "#ffffff",
  },
  paymentMethodOptionActive: {
    borderColor: BHX_GREEN,
    backgroundColor: "#f0fdf4",
  },
  paymentMethodLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: TEXT_DARK,
  },
  paymentMethodLabelActive: {
    color: BHX_GREEN,
  },
  paymentMethodDesc: {
    fontSize: 10,
    color: TEXT_MUTED,
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#94a3b8",
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleActive: {
    borderColor: BHX_GREEN,
  },
  radioDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: BHX_GREEN,
  },
  rewardPointsCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    backgroundColor: "#fffbeb",
    marginTop: 4,
    marginBottom: 6,
  },
  rewardPointsCardActive: {
    borderColor: "#f59e0b",
    backgroundColor: "#fef3c7",
  },
  rewardPointsTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#b45309",
  },
  rewardPointsDesc: {
    fontSize: 10,
    color: TEXT_MUTED,
  },
  checkSquare: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#94a3b8",
    alignItems: "center",
    justifyContent: "center",
  },
  checkSquareActive: {
    backgroundColor: BHX_GREEN,
    borderColor: BHX_GREEN,
  },
  checkoutTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 8,
    marginTop: 10,
  },
  cancelCheckout: {
    alignItems: "center",
    paddingVertical: 8,
  },
  cancelText: {
    color: TEXT_MUTED,
    fontSize: 11,
    fontWeight: "700",
  },

  paymentBoxMomo: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#fff0f6",
    borderWidth: 1,
    borderColor: "#ffadd2",
    alignItems: "center",
  },
  paymentBoxMomoTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#a50064",
    marginBottom: 2,
  },
  paymentBoxMomoDesc: {
    fontSize: 10,
    color: "#595959",
    textAlign: "center",
    marginBottom: 8,
  },
  momoActionBtn: {
    backgroundColor: "#a50064",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    alignSelf: "stretch",
    alignItems: "center",
  },
  momoActionText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 11,
  },
  paymentWaitText: {
    fontSize: 10,
    color: TEXT_MUTED,
  },
  paymentBoxBank: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#f0f5ff",
    borderWidth: 1,
    borderColor: "#adc6ff",
    alignItems: "center",
  },
  paymentBoxBankTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#1d39c4",
    marginBottom: 2,
  },
  paymentBoxBankDesc: {
    fontSize: 10,
    color: "#595959",
    textAlign: "center",
    marginBottom: 6,
  },
  vietQrImage: {
    width: 180,
    height: 180,
    borderRadius: 8,
    marginVertical: 4,
    backgroundColor: "#ffffff",
  },
  bankDetailCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
    gap: 2,
  },
  bankDetailLine: {
    fontSize: 10,
    color: TEXT_DARK,
  },
  bankBold: {
    fontWeight: "700",
  },
  bankMoney: {
    fontWeight: "900",
    color: "#1d39c4",
  },
  bankContent: {
    fontWeight: "900",
    color: "#d4380d",
  },
  successContent: {
    alignItems: "stretch",
    paddingBottom: 10,
  },
  successBadgeCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BHX_GREEN,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 10,
  },
  successTitle: {
    color: TEXT_DARK,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 8,
  },
  successCode: {
    color: BHX_GREEN,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
    padding: 8,
    backgroundColor: "#e8f5ec",
    borderRadius: 6,
  },

  // Voucher modal
  voucherBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  voucherSheet: {
    height: "72%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  voucherSheetDesktop: {
    maxWidth: 480,
    width: "100%",
    height: 500,
    alignSelf: "center",
    borderRadius: 16,
    marginVertical: "auto",
  },
  voucherHeading: {
    height: 46,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  voucherTitle: {
    color: TEXT_DARK,
    fontSize: 15,
    fontWeight: "900",
  },
  voucherCloseButton: {
    position: "absolute",
    right: 4,
    padding: 6,
  },
  voucherCodeRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
    marginBottom: 8,
  },
  voucherInput: {
    flex: 1,
    minHeight: 38,
    backgroundColor: "#f8fafc",
    borderColor: BORDER_COLOR,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    color: TEXT_DARK,
    fontSize: 12,
  },
  voucherAdd: {
    width: 76,
    borderRadius: 8,
    backgroundColor: BHX_GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  voucherAddText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },
  voucherSubheading: {
    color: TEXT_DARK,
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 6,
  },
  voucherList: {
    flex: 1,
  },
  voucherCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    borderColor: BORDER_COLOR,
    borderWidth: 1,
    padding: 8,
    marginBottom: 6,
  },
  voucherCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  voucherBadge: {
    minWidth: 46,
    minHeight: 34,
    paddingHorizontal: 4,
    borderRadius: 6,
    backgroundColor: "#e8f5ec",
    alignItems: "center",
    justifyContent: "center",
  },
  voucherBadgeText: {
    color: BHX_GREEN,
    fontWeight: "900",
    fontSize: 11,
  },
  voucherInfo: {
    flex: 1,
  },
  voucherName: {
    color: TEXT_DARK,
    fontSize: 11,
    fontWeight: "800",
  },
  voucherExpiry: {
    color: TEXT_MUTED,
    fontSize: 9,
    marginTop: 2,
  },
  voucherUseBtn: {
    backgroundColor: BHX_GREEN,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  voucherUseText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "900",
  },
  voucherDescription: {
    color: BHX_ORANGE,
    fontSize: 9,
    marginTop: 4,
  },
  voucherMessage: {
    color: BHX_RED,
    fontSize: 10,
    marginVertical: 4,
  },

  // Common UI states
  centerState: {
    minHeight: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  stateText: {
    color: TEXT_MUTED,
    fontSize: 11,
    textAlign: "center",
    marginTop: 6,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    paddingHorizontal: 14,
  },
  emptyTitle: {
    color: TEXT_DARK,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 6,
  },
  emptyCta: {
    marginTop: 12,
    alignSelf: "stretch",
  },
  errorCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorTitle: {
    color: BHX_RED,
    fontSize: 12,
    fontWeight: "900",
  },
  errorText: {
    color: "#7f1d1d",
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
  },
  apiHint: {
    color: TEXT_MUTED,
    fontSize: 9,
    marginTop: 4,
  },
  orderError: {
    color: BHX_RED,
    fontSize: 10,
    backgroundColor: "#fee2e2",
    borderRadius: 6,
    padding: 6,
    marginTop: 6,
  },
  accountMessage: {
    color: BHX_GREEN,
    fontSize: 10,
    marginTop: 6,
    textAlign: "center",
  },
  button: {
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: BHX_GREEN,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    marginTop: 8,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
  },
  buttonSecondary: {
    backgroundColor: "#e2e8f0",
  },
  buttonSecondaryText: {
    color: TEXT_DARK,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
