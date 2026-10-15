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
  View,
} from "react-native";

const defaultHost = typeof window !== "undefined" && window.location?.hostname
  ? `http://${window.location.hostname}:5099/api`
  : "http://10.0.2.2:5099/api";
const API_URL = (process.env.EXPO_PUBLIC_API_URL || defaultHost).replace(/\/$/, "");
const API_ORIGIN = API_URL.replace(/\/api$/, "");
const CART_KEY = "e-mart-mobile-cart";
const CUSTOMER_KEY = "e-mart-mobile-customer";
const CUSTOMER_TOKEN_KEY = "e-mart-mobile-customer-token";
const ADDRESS_KEY = "e-mart-mobile-delivery-address";

const GREEN = "#126a43";
const GREEN_LIGHT = "#e8f5ec";
const DARK = "#18261e";
const MUTED = "#76867a";
const ACCENT = "#e0533c";

const imageUrl = (path) => !path ? null : path.startsWith("http") ? path : `${API_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`;
const money = (value) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value || 0);

const QUICK_TAGS = ["Rau xanh", "Thịt tươi", "Trái cây", "Sữa tươi", "Nước ngọt", "Bánh mì"];

const BANNERS = [
  {
    id: 1,
    tag: "CHỢ TƯƠI SIÊU TỐC",
    title: "Rau Củ & Thịt Sạch",
    subtitle: "Giảm đến 30% trong ngày",
    badge: "GIẢM 30% 🔥",
    emoji: "🥬",
    bg: "#136d44",
    accentBg: "#1e8a58",
    code: "CHOTUOI30",
  },
  {
    id: 2,
    tag: "FREESHIP 30 PHÚT",
    title: "Giao Hàng Miễn Phí",
    subtitle: "Áp dụng cho đơn từ 150.000đ",
    badge: "FREESHIP 0Đ ⚡",
    emoji: "🛵",
    bg: "#0c5d86",
    accentBg: "#197fae",
    code: "FREESHIP150",
  },
  {
    id: 3,
    tag: "ƯU ĐÃI THÀNH VIÊN",
    title: "Tích Điểm Đổi Quà",
    subtitle: "Nhân đôi điểm thưởng hôm nay",
    badge: "X2 ĐIỂM ⭐",
    emoji: "🎁",
    bg: "#b54316",
    accentBg: "#d65d29",
    code: "EMART20",
  },
];

const CATEGORY_PALETTE = [
  { bg: "#eaf6ee", border: "#cce8d5", emoji: "🥬" },
  { bg: "#fdf0ed", border: "#fbd3cb", emoji: "🥩" },
  { bg: "#e9f4fb", border: "#c8e4f5", emoji: "🥤" },
  { bg: "#fef7e6", border: "#fbe4b2", emoji: "🍞" },
  { bg: "#f5eefb", border: "#e5d0f6", emoji: "🧴" },
  { bg: "#efeef8", border: "#d7d4f1", emoji: "🧹" },
  { bg: "#e6f7f5", border: "#bfece6", emoji: "🍼" },
  { bg: "#fff2e8", border: "#ffd6bc", emoji: "🍎" },
];

function ProductImage({ imagePath, productId, style }) {
  const candidates = [
    imageUrl(imagePath),
    productId ? `${API_ORIGIN}/assets/images/products/product-${productId}.jpg` : null,
    `${API_ORIGIN}/assets/images/products/default.jpg`,
  ].filter((uri, index, all) => uri && all.indexOf(uri) === index);
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => setCandidateIndex(0), [imagePath, productId]);

  const uri = candidates[candidateIndex];
  if (!uri) return <Text style={styles.productEmoji}>🥬</Text>;

  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode="contain"
      onError={() => setCandidateIndex((index) => Math.min(index + 1, candidates.length))}
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

function ProductCard({ product, cartQty = 0, onAdd, onQuantityChange }) {
  const originalPrice = Math.round((product.price * 1.15) / 1000) * 1000;
  const isHot = (product.id % 2 === 0);
  const discountPercent = Math.max(10, Math.round(((originalPrice - product.price) / originalPrice) * 100));

  return (
    <View style={[styles.productCard, cartQty > 0 && styles.productCardActive]}>
      <View style={styles.productImageBox}>
        <ProductImage imagePath={product.imageUrl} productId={product.id} style={styles.productImage} />
        <View style={styles.badgeRow}>
          {discountPercent > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>-{discountPercent}%</Text>
            </View>
          )}
          {isHot && (
            <View style={styles.hotBadge}>
              <Text style={styles.hotBadgeText}>HOT 🔥</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.productBody}>
        <Text style={styles.productCategory} numberOfLines={1}>{product.categoryName || "HÀNG TIÊU DÙNG"}</Text>
        <Text style={styles.productName} numberOfLines={2}>{product.productName}</Text>

        <View style={styles.stockRow}>
          <View style={styles.stockDot} />
          <Text style={styles.stockLabel}>Tươi ngon trong ngày</Text>
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
              <Text style={styles.addCartBtnIcon}>＋</Text>
              <Text style={styles.addCartBtnText}>Thêm vào giỏ</Text>
            </Pressable>
          ) : (
            <View style={styles.stepperBox}>
              <Pressable
                accessibilityLabel={`Bớt ${product.productName}`}
                onPress={() => onQuantityChange(product.id, -1)}
                style={styles.stepperBtn}
              >
                <Text style={styles.stepperBtnMinusText}>−</Text>
              </Pressable>
              <Text style={styles.stepperQtyText}>{cartQty}</Text>
              <Pressable
                accessibilityLabel={`Thêm ${product.productName}`}
                onPress={() => onQuantityChange(product.id, 1)}
                style={[styles.stepperBtn, styles.stepperBtnPlus]}
              >
                <Text style={styles.stepperBtnPlusText}>＋</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export default function App() {
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

  const visibleProducts = useMemo(() => products.filter((product) => {
    const matchesSearch = product.productName?.toLowerCase().includes(query.trim().toLowerCase());
    const matchesCategory = categoryId === "all" || String(product.categoryId) === String(categoryId);
    return matchesSearch && matchesCategory;
  }), [products, query, categoryId]);

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

  const renderHome = () => (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {/* 1. HERO BANNER CAROUSEL */}
      <View style={[styles.heroBanner, { backgroundColor: currentBanner.bg }]}>
        <View style={styles.bannerInfo}>
          <View style={styles.bannerBadgePill}>
            <Text style={styles.bannerBadgeText}>{currentBanner.badge}</Text>
          </View>
          <Text style={styles.bannerTitle}>{currentBanner.title}</Text>
          <Text style={styles.bannerSubtitle}>{currentBanner.subtitle}</Text>

          <Pressable
            onPress={() => {
              if (currentBanner.code) {
                applyVoucher(currentBanner.code);
              }
            }}
            style={styles.bannerCtaBtn}
          >
            <Text style={styles.bannerCtaText}>Nhận ưu đãi ngay  ›</Text>
          </Pressable>
        </View>

        <View style={[styles.bannerCircleAccent, { backgroundColor: currentBanner.accentBg }]}>
          <Text style={styles.bannerEmoji}>{currentBanner.emoji}</Text>
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

      {/* 2. TRUST COMMITMENT BAR */}
      <View style={styles.trustBar}>
        <View style={styles.trustItem}>
          <Text style={styles.trustIcon}>⚡</Text>
          <Text style={styles.trustLabel}>Giao 30 phút</Text>
        </View>
        <View style={styles.trustDivider} />
        <View style={styles.trustItem}>
          <Text style={styles.trustIcon}>🥬</Text>
          <Text style={styles.trustLabel}>Tươi sạch 100%</Text>
        </View>
        <View style={styles.trustDivider} />
        <View style={styles.trustItem}>
          <Text style={styles.trustIcon}>⭐</Text>
          <Text style={styles.trustLabel}>Tích lũy 1K/đ</Text>
        </View>
        <View style={styles.trustDivider} />
        <View style={styles.trustItem}>
          <Text style={styles.trustIcon}>🛡️</Text>
          <Text style={styles.trustLabel}>Đổi trả tận nơi</Text>
        </View>
      </View>

      {/* 3. CIRCULAR CATEGORY BAR */}
      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.eyebrow}>DANH MỤC THỰC PHẨM</Text>
          <Text style={styles.sectionTitle}>Mua theo ngành hàng</Text>
        </View>
        {categoryId !== "all" && (
          <Pressable onPress={() => setCategoryId("all")} style={styles.resetCategoryBtn}>
            <Text style={styles.resetCategoryText}>Xem tất cả</Text>
          </Pressable>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.circularCategoryRow}>
        {/* Tất cả */}
        <Pressable
          onPress={() => setCategoryId("all")}
          style={[styles.categoryCircleItem, categoryId === "all" && styles.categoryCircleItemActive]}
        >
          <View style={[styles.categoryCircleAvatar, categoryId === "all" ? styles.categoryAllAvatarActive : styles.categoryAllAvatar]}>
            <Text style={styles.categoryCircleEmoji}>🛒</Text>
          </View>
          <Text style={[styles.categoryCircleTitle, categoryId === "all" && styles.categoryCircleTitleActive]} numberOfLines={1}>
            Tất cả
          </Text>
        </Pressable>

        {/* Dynamic Categories */}
        {categories.map((category, index) => {
          const isSelected = String(categoryId) === String(category.id);
          const colorTheme = CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];

          return (
            <Pressable
              key={category.id}
              onPress={() => setCategoryId(String(category.id))}
              style={[styles.categoryCircleItem, isSelected && styles.categoryCircleItemActive]}
            >
              <View style={[styles.categoryCircleAvatar, { backgroundColor: colorTheme.bg, borderColor: isSelected ? GREEN : colorTheme.border }, isSelected && styles.categorySelectedBorder]}>
                <Text style={styles.categoryCircleEmoji}>{colorTheme.emoji}</Text>
              </View>
              <Text style={[styles.categoryCircleTitle, isSelected && styles.categoryCircleTitleActive]} numberOfLines={1}>
                {category.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* 4. PRODUCT GRID */}
      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.eyebrow}>{query ? "KẾT QUẢ TÌM KIẾM" : "ĐI CHỢ HÔM NAY"}</Text>
          <Text style={styles.sectionTitle}>
            {query ? `Tìm kiếm: "${query}"` : categoryId === "all" ? "Sản phẩm tươi ngon nổi bật" : (categories.find((c) => String(c.id) === String(categoryId))?.name || "Sản phẩm")}
          </Text>
        </View>
        <Pressable onPress={loadStore} style={styles.refreshButton}>
          <Text style={styles.refreshText}>⟳ Làm mới</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={GREEN} />
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
          <Text style={styles.emptyEmoji}>🥬</Text>
          <Text style={styles.emptyTitle}>Chưa có món nào phù hợp</Text>
          <Text style={styles.stateText}>Hãy thử tìm từ khóa khác hoặc bấm nút bên dưới.</Text>
          <AppButton title="Xem tất cả thực phẩm" onPress={() => { setQuery(""); setCategoryId("all"); }} style={styles.emptyCta} />
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
            />
          ))}
        </View>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );

  const renderCart = () => (
    <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>GIỎ HÀNG CỦA BẠN</Text>
      <Text style={styles.pageTitle}>{itemCount} món đã chọn</Text>

      {!cart.length ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🛍️</Text>
          <Text style={styles.emptyTitle}>Giỏ hàng đang trống</Text>
          <Text style={styles.stateText}>Hãy chọn vài món tươi ngon để cả nhà cùng thưởng thức nhé!</Text>
          <AppButton title="Tiếp tục đi chợ" onPress={() => setTab("home")} style={styles.emptyCta} />
        </View>
      ) : (
        <>
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
                    <Text style={styles.cartStepperBtnText}>−</Text>
                  </Pressable>
                  <Text style={styles.cartStepperQty}>{item.quantity}</Text>
                  <Pressable onPress={() => changeQuantity(item.id, 1)} style={[styles.cartStepperBtn, styles.cartStepperBtnPlus]}>
                    <Text style={[styles.cartStepperBtnText, styles.cartStepperBtnPlusText]}>＋</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))}

          <View style={styles.summaryCard}>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Tạm tính tiền hàng</Text>
              <Text style={styles.summaryValue}>{money(subtotal)}</Text>
            </View>
            <View style={styles.summaryLine}>
              <Text style={styles.summaryLabel}>Phí vận chuyển siêu tốc</Text>
              <Text style={styles.freeShipping}>Miễn phí (0đ)</Text>
            </View>

            <Pressable style={styles.voucherRow} onPress={openVouchers}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 16 }}>🎟️</Text>
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
        </>
      )}
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

            <View style={styles.orderInfoCard}>
              <Text style={styles.orderInfoLabel}>Phương thức thanh toán</Text>
              <View style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>Hình thức</Text>
                <Text style={styles.summaryValue}>
                  {selectedOrder.paymentMethod === "momo" ? "Ví MoMo" : selectedOrder.paymentMethod === "bank" ? "Chuyển khoản QR" : "Tiền mặt (COD)"}
                </Text>
              </View>
              <View style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>Trạng thái tiền</Text>
                <Text style={[styles.summaryValue, { color: paidAmount > 0 ? GREEN : ACCENT }]}>
                  {paidAmount > 0 ? "Đã thanh toán ✓" : "Chờ thanh toán"}
                </Text>
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
            <ActivityIndicator color={GREEN} />
            <Text style={styles.stateText}>Đang tải lịch sử đơn hàng...</Text>
          </View>
        ) : ordersError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{ordersError}</Text>
            <AppButton title="Thử lại" onPress={() => setOrdersRefreshKey((key) => key + 1)} />
          </View>
        ) : !customer && customerOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyTitle}>Đăng nhập để xem đơn</Text>
            <Text style={styles.stateText}>Đơn hàng được lưu giữ an toàn theo số điện thoại của bạn.</Text>
            <AppButton title="Đăng nhập ngay" onPress={() => setTab("profile")} style={styles.emptyCta} />
          </View>
        ) : visibleOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyTitle}>Chưa có đơn hàng nào</Text>
            <Text style={styles.stateText}>Các đơn bạn vừa đặt sẽ hiển thị đầy đủ tại đây.</Text>
            <AppButton title="Bắt đầu mua sắm" onPress={() => setTab("home")} style={styles.emptyCta} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.orderListContent} showsVerticalScrollIndicator={false}>
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
                    <Text style={styles.orderPickupIcon}>📍</Text>
                    <Text style={styles.orderPickupText} numberOfLines={1}>{orderAddress(order)}</Text>
                  </View>
                  <Pressable onPress={() => setSelectedOrder(order)} style={styles.orderThumbnailRow}>
                    {items.slice(0, 4).map((item, index) => (
                      <View key={`${item.productId}-${index}`} style={styles.orderThumbnailBox}>
                        <ProductImage imagePath={item.imageUrl} productId={item.productId} style={styles.orderThumbnail} />
                        {index === 3 && items.length > 4 && (
                          <View style={styles.orderMoreOverlay}>
                            <Text style={styles.orderMoreText}>+{items.length - 4}</Text>
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
          </ScrollView>
        )}
      </View>
    );
  };

  const renderProfile = () => (
    <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
          <Text style={styles.eyebrow}>E-MART SIÊU TỐC</Text>
          <Text style={styles.pageTitle}>Tài khoản</Text>

          {!accountReady ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={GREEN} />
              <Text style={styles.stateText}>Đang tải hồ sơ...</Text>
            </View>
          ) : customer ? (
            <>
              <View style={styles.profileCard}>
                <Text style={styles.profileEmoji}>🧑‍🌾</Text>
                <Text style={styles.profileName}>{customer.fullName || "Khách Hàng Thân Thiết"}</Text>
                <Text style={styles.profilePhone}>{customer.phone}</Text>
                <View style={styles.pointsPill}>
                  <Text style={{ fontSize: 15 }}>⭐</Text>
                  <Text style={styles.pointsText}>{customer.rewardPoints || 0} điểm tích lũy</Text>
                  <Text style={styles.pointsEquivalent}>= {money((customer.rewardPoints || 0) * 1000)}</Text>
                </View>
              </View>

              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>Cài đặt cá nhân</Text>
                <Pressable style={styles.profileMenuRow} onPress={() => { setAccountName(customer.fullName || ""); setProfilePage("personal"); }}>
                  <Text style={styles.profileMenuIcon}>👤</Text>
                  <Text style={styles.profileMenuText}>Hồ sơ cá nhân</Text>
                  <Text style={styles.profileMenuArrow}>›</Text>
                </Pressable>
                <Pressable style={styles.profileMenuRow} onPress={() => { setAddressMessage(""); setProfilePage("address"); }}>
                  <Text style={styles.profileMenuIcon}>📍</Text>
                  <Text style={styles.profileMenuText}>Địa chỉ nhận hàng mặc định</Text>
                  <Text style={styles.profileMenuArrow}>›</Text>
                </Pressable>
              </View>

              <View style={styles.infoCard}>
                <AppButton title="Đăng xuất tài khoản" secondary onPress={logoutCustomer} />
              </View>
            </>
          ) : (
            <>
              <View style={styles.profileCard}>
                <Text style={styles.profileEmoji}>📱</Text>
                <Text style={styles.emptyTitle}>Đăng nhập nhanh</Text>
                <Text style={styles.stateText}>Nhập số điện thoại để tích điểm và theo dõi tiến độ giao hàng.</Text>
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
    </ScrollView>
  );

  return (
    <View style={styles.appShell}>
      <SafeAreaView style={styles.phoneContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

        {/* MÔ PHỎNG STATUS BAR IPHONE KHI XEM TRÊN WEB */}
        {Platform.OS === "web" && (
          <View style={styles.simulatedPhoneTop}>
            <Text style={styles.simulatedClock}>9:41</Text>
            <View style={styles.simulatedIsland} />
            <Text style={styles.simulatedSignal}>5G 🔋</Text>
          </View>
        )}

        {/* HEADER PHONG CÁCH GRABMART */}
        <View style={styles.header}>
          {/* Thanh Giao Đến */}
          <Pressable
            style={styles.locationBar}
            onPress={() => { setTab("profile"); setProfilePage("address"); }}
          >
            <View style={styles.locationLeft}>
              <Text style={styles.locationPin}>📍</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.locationLabel}>GIAO ĐẾN</Text>
                <Text style={styles.locationAddress} numberOfLines={1}>
                  {deliveryAddress?.street ? `${deliveryAddress.street}, ${deliveryAddress.ward || ""}` : "Chọn địa chỉ nhận hàng ▾"}
                </Text>
              </View>
            </View>
            <Text style={styles.locationDropdown}>›</Text>
          </Pressable>

          {/* Logo Brand + Cart */}
          <View style={styles.headerTop}>
            <View style={styles.brandGroup}>
              <View style={styles.brandIcon}><Text style={styles.brandLetter}>e</Text></View>
              <View>
                <Text style={styles.brandName}>E-Mart</Text>
                <Text style={styles.brandTagline}>ĐI CHỢ SIÊU TỐC</Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              {customer && (customer.rewardPoints || 0) > 0 && (
                <View style={styles.headerPointsPill}>
                  <Text style={styles.headerPointsStar}>⭐</Text>
                  <Text style={styles.headerPointsNumber}>{customer.rewardPoints}</Text>
                </View>
              )}
              <Pressable onPress={() => setTab("cart")} style={styles.headerCart}>
                <Text style={styles.headerCartIcon}>🛒</Text>
                {itemCount > 0 && (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{itemCount > 99 ? "99+" : itemCount}</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>

          {/* Thanh tìm kiếm Capsule */}
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Tìm rau xanh, thịt tươi, sữa, mì gói..."
              placeholderTextColor="#8a9a8f"
              style={styles.searchInput}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery("")} style={styles.clearSearchBtn}>
                <Text style={styles.clearSearchText}>✕</Text>
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

        {/* NỘI DUNG MÀN HÌNH CHÍNH */}
        <View style={styles.screen}>
          {tab === "home" ? renderHome() : tab === "cart" ? renderCart() : tab === "orders" ? renderOrders() : renderProfile()}
        </View>

        {/* BOTTOM NAVIGATION CHUẨN APP */}
        <View style={styles.bottomNav}>
          {[
            ["home", "🏠", "Trang chủ"],
            ["orders", "📋", "Đơn hàng"],
            ["cart", "🛒", "Giỏ hàng"],
            ["profile", "👤", "Tài khoản"],
          ].map(([key, icon, label]) => {
            const isActive = tab === key;
            return (
              <Pressable key={key} onPress={() => setTab(key)} style={styles.navItem}>
                <View style={styles.navIconWrapper}>
                  <Text style={[styles.navIcon, isActive && styles.navIconActive]}>{icon}</Text>
                  {key === "cart" && itemCount > 0 && (
                    <View style={styles.navCartBadge}>
                      <Text style={styles.navCartBadgeText}>{itemCount > 99 ? "99+" : itemCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* MODAL CHECKOUT & THANH TOÁN ONLINE */}
        <Modal visible={checkoutOpen} transparent animationType="slide" onRequestClose={() => !orderSubmitting && setCheckoutOpen(false)}>
          <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.checkoutSheet}>
              <View style={styles.sheetHandle} />

              {completedOrder ? (
                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.successContent} showsVerticalScrollIndicator={false}>
                  <Text style={styles.successIcon}>✓</Text>
                  <Text style={styles.eyebrow}>ĐẶT HÀNG THÀNH CÔNG</Text>
                  <Text style={styles.successTitle}>Cảm ơn bạn đã đi chợ tại E-Mart!</Text>

                  <Text style={styles.inputLabel}>MÃ ĐƠN HÀNG</Text>
                  <Text selectable style={styles.successCode}>{completedOrder.orderNumber}</Text>

                  {/* Thanh toán MoMo */}
                  {completedOrder.paymentMethod === "momo" && (
                    <View style={styles.paymentBoxMomo}>
                      <Text style={styles.paymentBoxMomoTitle}>🟣 Thanh toán qua Ví MoMo</Text>
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
                      <Text style={styles.paymentBoxBankTitle}>🏦 Quét mã QR ngân hàng (VietQR)</Text>
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
                  <Text style={styles.eyebrow}>GIAO HÀNG TẬN CỬA</Text>
                  <Text style={styles.checkoutTitle}>Thông tin nhận hàng</Text>

                  <Text style={styles.inputLabel}>HỌ VÀ TÊN NGƯỜI NHẬN</Text>
                  <TextInput
                    value={customer?.fullName || checkoutForm.fullName}
                    onChangeText={(value) => setCheckoutForm((form) => ({ ...form, fullName: value }))}
                    placeholder="Ví dụ: Nguyễn Văn An"
                    style={styles.formInput}
                    maxLength={150}
                    autoCapitalize="words"
                    editable={!customer?.fullName}
                  />

                  <Text style={styles.inputLabel}>SỐ ĐIỆN THOẠI LIÊN HỆ</Text>
                  <TextInput
                    value={customer?.phone || checkoutForm.phone}
                    onChangeText={(value) => setCheckoutForm((form) => ({ ...form, phone: value }))}
                    placeholder="Ví dụ: 0912345678"
                    style={styles.formInput}
                    keyboardType="phone-pad"
                    maxLength={13}
                    editable={!customer}
                  />

                  <Text style={styles.inputLabel}>ĐỊA CHỈ GIAO HÀNG TẬN NƠI</Text>
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
                    placeholder="Ví dụ: Giao giờ hành chính, gọi trước khi đến..."
                    style={[styles.formInput, styles.noteInput]}
                    multiline
                    maxLength={500}
                  />

                  {/* PHƯƠNG THỨC THANH TOÁN */}
                  <Text style={styles.inputLabel}>PHƯƠNG THỨC THANH TOÁN</Text>
                  <View style={{ gap: 8, marginTop: 4, marginBottom: 8 }}>
                    {[
                      { key: "cod", icon: "💵", label: "Tiền mặt khi nhận hàng (COD)", desc: "Nhận thực phẩm tươi ngon rồi trả tiền mặt" },
                      { key: "momo", icon: "🟣", label: "Ví điện tử MoMo", desc: "Thanh toán siêu nhanh qua App MoMo" },
                      { key: "bank", icon: "🏦", label: "Chuyển khoản QR ngân hàng", desc: "Quét mã VietQR tiện lợi không lo sai số" },
                    ].map((m) => (
                      <Pressable
                        key={m.key}
                        onPress={() => setPaymentMethod(m.key)}
                        style={[styles.paymentMethodOption, paymentMethod === m.key && styles.paymentMethodOptionActive]}
                      >
                        <Text style={{ fontSize: 22, marginRight: 10 }}>{m.icon}</Text>
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
                      <Text style={{ fontSize: 20, marginRight: 8 }}>⭐</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rewardPointsTitle}>
                          Dùng {maxPointsUsable} điểm tích lũy (-{money(maxPointsUsable * 1000)})
                        </Text>
                        <Text style={styles.rewardPointsDesc}>
                          Bạn đang có {customer.rewardPoints} điểm (1 điểm = 1.000đ)
                        </Text>
                      </View>
                      <Text style={[styles.rewardPointsCheck, useRewardPoints && styles.rewardPointsCheckActive]}>
                        {useRewardPoints ? "☑" : "□"}
                      </Text>
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
            <View style={styles.voucherSheet}>
              <View style={styles.voucherHeading}>
                <Text style={styles.voucherTitle}>Phiếu mua hàng & Ưu đãi</Text>
                <Pressable style={styles.voucherCloseButton} onPress={() => setVoucherOpen(false)}>
                  <Text style={styles.voucherClose}>✕</Text>
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
                        <Text style={styles.voucherUseText}>Dùng ngay</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  // Phone simulation container
  appShell: {
    flex: 1,
    backgroundColor: Platform.OS === "web" ? "#0f172a" : "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  phoneContainer: {
    flex: 1,
    width: "100%",
    maxWidth: Platform.OS === "web" ? 440 : "100%",
    height: "100%",
    backgroundColor: "#f7f9f7",
    ...Platform.select({
      web: {
        maxHeight: 920,
        borderRadius: 36,
        overflow: "hidden",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.45)",
        borderWidth: 8,
        borderColor: "#1e293b",
      },
    }),
  },
  simulatedPhoneTop: {
    height: 36,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f2",
  },
  simulatedClock: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1e293b",
  },
  simulatedIsland: {
    width: 90,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#000000",
  },
  simulatedSignal: {
    fontSize: 10,
    fontWeight: "700",
    color: "#475569",
  },

  // Header styles
  header: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#edf2ee",
  },
  locationBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f4f8f5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
  },
  locationLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  locationPin: {
    fontSize: 16,
    marginRight: 8,
  },
  locationLabel: {
    fontSize: 8,
    fontWeight: "900",
    color: "#6c8072",
    letterSpacing: 0.8,
  },
  locationAddress: {
    fontSize: 12,
    fontWeight: "700",
    color: DARK,
  },
  locationDropdown: {
    fontSize: 16,
    color: GREEN,
    fontWeight: "900",
  },

  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  brandLetter: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
    fontStyle: "italic",
  },
  brandName: {
    color: GREEN,
    fontWeight: "900",
    fontSize: 19,
    letterSpacing: -0.6,
  },
  brandTagline: {
    color: MUTED,
    fontSize: 8,
    letterSpacing: 1.2,
    fontWeight: "800",
    marginTop: -2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerPointsPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff8e6",
    borderWidth: 1,
    borderColor: "#ffe082",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  headerPointsStar: {
    fontSize: 11,
  },
  headerPointsNumber: {
    fontSize: 11,
    fontWeight: "800",
    color: "#8d5d11",
  },
  headerCart: {
    backgroundColor: "#eef6f0",
    borderRadius: 12,
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  headerCartIcon: {
    fontSize: 19,
  },
  cartBadge: {
    position: "absolute",
    right: -4,
    top: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900",
  },

  // Search capsule
  searchBar: {
    height: 42,
    backgroundColor: "#f2f5f3",
    borderRadius: 21,
    marginTop: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: DARK,
    fontSize: 13,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchText: {
    color: "#94a398",
    fontSize: 12,
    fontWeight: "900",
  },

  // Quick Tags
  quickTagsRow: {
    gap: 7,
    marginTop: 9,
    paddingBottom: 2,
  },
  quickTagChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: "#f5f8f6",
    borderWidth: 1,
    borderColor: "#e5ece7",
  },
  quickTagChipActive: {
    backgroundColor: "#e8f5ec",
    borderColor: GREEN,
  },
  quickTagText: {
    fontSize: 11,
    color: "#4a5a50",
    fontWeight: "700",
  },
  quickTagTextActive: {
    color: GREEN,
    fontWeight: "900",
  },

  // Screen & Scroll
  screen: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 24,
  },

  // Hero Banner Carousel
  heroBanner: {
    minHeight: 154,
    borderRadius: 18,
    padding: 16,
    overflow: "hidden",
    position: "relative",
    justifyContent: "center",
  },
  bannerInfo: {
    maxWidth: "68%",
    zIndex: 2,
  },
  bannerBadgePill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 6,
  },
  bannerBadgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  bannerTitle: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: -0.4,
    lineHeight: 23,
  },
  bannerSubtitle: {
    color: "rgba(255, 255, 255, 0.88)",
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  bannerCtaBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginTop: 10,
  },
  bannerCtaText: {
    color: GREEN,
    fontSize: 11,
    fontWeight: "900",
  },
  bannerCircleAccent: {
    position: "absolute",
    right: -10,
    top: 10,
    width: 125,
    height: 125,
    borderRadius: 65,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  bannerEmoji: {
    fontSize: 56,
  },
  bannerDots: {
    position: "absolute",
    bottom: 8,
    right: 14,
    flexDirection: "row",
    gap: 5,
    zIndex: 3,
  },
  bannerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
  },
  bannerDotActive: {
    width: 16,
    backgroundColor: "#ffffff",
  },

  // Trust Bar
  trustBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#eaf0eb",
  },
  trustItem: {
    flex: 1,
    alignItems: "center",
  },
  trustIcon: {
    fontSize: 15,
    marginBottom: 2,
  },
  trustLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#46594d",
    textAlign: "center",
  },
  trustDivider: {
    width: 1,
    height: 20,
    backgroundColor: "#edf2ee",
  },

  // Section Heading
  sectionHeading: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 10,
  },
  eyebrow: {
    color: "#3d7d56",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  sectionTitle: {
    color: DARK,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 2,
  },
  resetCategoryBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resetCategoryText: {
    fontSize: 11,
    color: GREEN,
    fontWeight: "800",
  },

  // Circular Category Bar
  circularCategoryRow: {
    gap: 12,
    paddingVertical: 4,
    paddingRight: 6,
  },
  categoryCircleItem: {
    alignItems: "center",
    width: 66,
  },
  categoryCircleItemActive: {
    transform: [{ scale: 1.04 }],
  },
  categoryCircleAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    marginBottom: 6,
  },
  categoryAllAvatar: {
    backgroundColor: "#e8f5ec",
    borderColor: "#c6e7d0",
  },
  categoryAllAvatarActive: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  categorySelectedBorder: {
    borderWidth: 2,
    borderColor: GREEN,
  },
  categoryCircleEmoji: {
    fontSize: 26,
  },
  categoryCircleTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#526357",
    textAlign: "center",
  },
  categoryCircleTitleActive: {
    color: GREEN,
    fontWeight: "900",
  },

  // Product Grid & Product Card
  productGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  productCard: {
    width: "48.5%",
    backgroundColor: "#ffffff",
    borderColor: "#e8ede9",
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
    paddingBottom: 10,
    ...Platform.select({
      web: {
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
      },
      default: {
        elevation: 2,
      },
    }),
  },
  productCardActive: {
    borderColor: GREEN,
    borderWidth: 1.5,
    backgroundColor: "#fafdfa",
  },
  productImageBox: {
    height: 130,
    backgroundColor: "#f7f9f6",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  productImage: {
    width: "84%",
    height: "84%",
  },
  productEmoji: {
    fontSize: 42,
  },
  badgeRow: {
    position: "absolute",
    top: 6,
    left: 6,
    flexDirection: "column",
    gap: 4,
  },
  discountBadge: {
    backgroundColor: ACCENT,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  discountBadgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900",
  },
  hotBadge: {
    backgroundColor: "#ff8f00",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hotBadgeText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "900",
  },

  productBody: {
    paddingHorizontal: 9,
    paddingTop: 8,
  },
  productCategory: {
    color: "#7e8f83",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  productName: {
    color: DARK,
    fontWeight: "800",
    fontSize: 12,
    lineHeight: 16,
    minHeight: 32,
    marginTop: 3,
  },
  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2e9a58",
  },
  stockLabel: {
    color: "#2e9a58",
    fontSize: 9,
    fontWeight: "700",
  },

  priceContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 7,
    marginBottom: 8,
  },
  productPrice: {
    color: GREEN,
    fontSize: 14,
    fontWeight: "900",
  },
  originalPrice: {
    color: "#9aa99f",
    fontSize: 10,
    fontWeight: "600",
    textDecorationLine: "line-through",
  },

  // Smart Stepper
  stepperContainer: {
    height: 32,
  },
  addCartBtn: {
    flex: 1,
    height: 32,
    backgroundColor: "#eaf5ed",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#cbe4d2",
  },
  addCartBtnIcon: {
    color: GREEN,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 18,
  },
  addCartBtnText: {
    color: GREEN,
    fontSize: 11,
    fontWeight: "800",
  },
  stepperBox: {
    flex: 1,
    height: 32,
    backgroundColor: "#f2f7f3",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: GREEN,
    overflow: "hidden",
  },
  stepperBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  stepperBtnMinusText: {
    color: "#546558",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 18,
  },
  stepperQtyText: {
    color: GREEN,
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 4,
  },
  stepperBtnPlus: {
    backgroundColor: GREEN,
  },
  stepperBtnPlusText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 18,
  },

  // Cart Page
  pageContent: {
    padding: 16,
    paddingBottom: 26,
  },
  pageTitle: {
    color: DARK,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 2,
    marginBottom: 14,
  },
  cartRow: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e8ede9",
  },
  cartThumb: {
    width: 68,
    height: 68,
    backgroundColor: "#f5f8f5",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  cartImage: {
    width: "88%",
    height: "88%",
  },
  cartInfo: {
    flex: 1,
    justifyContent: "center",
  },
  cartName: {
    color: DARK,
    fontSize: 12,
    fontWeight: "800",
  },
  cartPrice: {
    color: GREEN,
    fontWeight: "900",
    fontSize: 13,
    marginTop: 3,
  },
  cartStepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },
  cartStepperBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#d7dfd8",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  cartStepperBtnText: {
    color: "#4d5f52",
    fontSize: 15,
    fontWeight: "900",
  },
  cartStepperBtnPlus: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  cartStepperBtnPlusText: {
    color: "#fff",
  },
  cartStepperQty: {
    color: DARK,
    fontSize: 12,
    fontWeight: "800",
    minWidth: 20,
    textAlign: "center",
  },

  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#e8ede9",
  },
  summaryLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 4,
  },
  summaryLabel: {
    color: MUTED,
    fontSize: 12,
  },
  summaryValue: {
    color: DARK,
    fontSize: 12,
    fontWeight: "800",
  },
  freeShipping: {
    color: "#258a56",
    fontSize: 12,
    fontWeight: "800",
  },
  summaryTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#edf2ee",
    marginTop: 12,
    paddingTop: 12,
  },
  summaryTotalLabel: {
    color: DARK,
    fontSize: 13,
    fontWeight: "900",
  },
  summaryTotalValue: {
    color: GREEN,
    fontSize: 18,
    fontWeight: "900",
  },

  // Orders
  ordersScreen: {
    flex: 1,
    backgroundColor: "#f4f6f4",
  },
  ordersTitle: {
    color: DARK,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    paddingVertical: 14,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#eaefea",
  },
  orderFilterScroll: {
    height: 46,
    flexGrow: 0,
    flexShrink: 0,
  },
  orderFilterRow: {
    paddingHorizontal: 14,
    alignItems: "center",
    gap: 8,
  },
  orderFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#e8ede9",
  },
  orderFilterChipActive: {
    backgroundColor: GREEN,
  },
  orderFilterText: {
    color: "#445548",
    fontSize: 11,
    fontWeight: "700",
  },
  orderFilterTextActive: {
    color: "#ffffff",
  },
  orderListContent: {
    padding: 14,
    paddingTop: 6,
    paddingBottom: 24,
  },
  orderListCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e8ede9",
  },
  orderListHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  orderListNumber: {
    flex: 1,
    color: DARK,
    fontSize: 13,
    fontWeight: "900",
  },
  orderViewLink: {
    color: GREEN,
    fontSize: 12,
    fontWeight: "800",
  },
  orderPickup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    backgroundColor: "#f4f8f5",
    padding: 8,
  },
  orderPickupIcon: {
    fontSize: 14,
  },
  orderPickupText: {
    flex: 1,
    color: "#536458",
    fontSize: 11,
    fontWeight: "600",
  },
  orderThumbnailRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 10,
    minHeight: 68,
    alignItems: "center",
  },
  orderThumbnailBox: {
    width: 52,
    height: 60,
    borderRadius: 8,
    backgroundColor: "#f7f9f6",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  orderThumbnail: {
    width: "88%",
    height: "88%",
  },
  orderMoreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  orderMoreText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },
  orderListTotals: {
    borderTopWidth: 1,
    borderTopColor: "#edf2ee",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderListStatus: {
    color: GREEN,
    fontSize: 11,
    fontWeight: "800",
  },
  orderListTotal: {
    color: DARK,
    fontSize: 12,
    fontWeight: "800",
  },

  // Order Details
  orderDetailHeading: {
    minHeight: 50,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#edf2ee",
  },
  orderBack: {
    position: "absolute",
    left: 12,
    height: 44,
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  orderBackText: {
    color: DARK,
    fontSize: 32,
    lineHeight: 36,
  },
  orderDetailTitle: {
    color: DARK,
    fontSize: 15,
    fontWeight: "900",
  },
  orderDetailContent: {
    padding: 14,
    paddingBottom: 24,
  },
  orderInfoCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e8ede9",
  },
  orderInfoTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  orderInfoLabel: {
    color: "#536458",
    fontSize: 12,
    fontWeight: "900",
  },
  orderInfoDate: {
    color: MUTED,
    fontSize: 10,
  },
  orderAddress: {
    color: DARK,
    fontSize: 13,
    lineHeight: 18,
  },
  orderStatusText: {
    color: GREEN,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 8,
  },
  orderItemsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e8ede9",
  },
  orderItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#edf2ee",
    gap: 10,
  },
  orderItemImageBox: {
    width: 58,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f7f9f6",
    borderRadius: 8,
  },
  orderItemImage: {
    width: "88%",
    height: "88%",
  },
  orderItemInfo: {
    flex: 1,
  },
  orderItemName: {
    color: DARK,
    fontSize: 12,
    fontWeight: "700",
  },
  orderItemQuantity: {
    color: MUTED,
    fontSize: 10,
    marginTop: 3,
  },
  orderItemAmount: {
    alignItems: "flex-end",
  },
  orderItemPrice: {
    color: DARK,
    fontSize: 12,
    fontWeight: "900",
  },
  orderItemUnitPrice: {
    color: MUTED,
    fontSize: 10,
    textDecorationLine: "line-through",
    marginTop: 2,
  },
  orderTotals: {
    paddingTop: 10,
  },

  // Profile Page
  profileCard: {
    backgroundColor: GREEN_LIGHT,
    borderRadius: 16,
    alignItems: "center",
    padding: 18,
    borderWidth: 1,
    borderColor: "#c9e6d3",
  },
  profileEmoji: {
    fontSize: 42,
    marginBottom: 6,
  },
  profileName: {
    color: DARK,
    fontSize: 16,
    fontWeight: "900",
  },
  profilePhone: {
    color: MUTED,
    fontSize: 12,
    marginTop: 2,
  },
  pointsPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: "#d7ebd9",
  },
  pointsText: {
    fontSize: 12,
    fontWeight: "800",
    color: GREEN,
  },
  pointsEquivalent: {
    fontSize: 11,
    color: MUTED,
  },
  infoCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#e8ede9",
  },
  infoTitle: {
    color: DARK,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 4,
  },
  profileMenuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#edf2ee",
  },
  profileMenuIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  profileMenuText: {
    flex: 1,
    color: DARK,
    fontSize: 13,
    fontWeight: "700",
  },
  profileMenuArrow: {
    color: "#9aa99f",
    fontSize: 20,
  },
  accountPageHeading: {
    minHeight: 48,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    marginBottom: 10,
  },
  accountBackButton: {
    position: "absolute",
    left: 8,
    height: 40,
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  accountBack: {
    color: DARK,
    fontSize: 30,
    lineHeight: 34,
  },
  accountPageTitle: {
    color: DARK,
    fontSize: 15,
    fontWeight: "900",
  },
  accountInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#d7dfd8",
    borderRadius: 10,
    paddingHorizontal: 12,
    color: DARK,
    fontSize: 13,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  phoneReadonly: {
    backgroundColor: "#eef2ef",
    paddingTop: 12,
  },

  // Bottom Nav
  bottomNav: {
    height: 60,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#eaefea",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 2,
  },
  navItem: {
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  navIconWrapper: {
    position: "relative",
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  navIcon: {
    fontSize: 19,
    opacity: 0.65,
  },
  navIconActive: {
    opacity: 1,
    transform: [{ scale: 1.15 }],
  },
  navCartBadge: {
    position: "absolute",
    top: -5,
    right: -10,
    backgroundColor: ACCENT,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  navCartBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "900",
  },
  navLabel: {
    color: "#7e8f83",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  navLabelActive: {
    color: GREEN,
    fontWeight: "900",
  },

  // Checkout Sheet Modal
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(10, 20, 14, 0.65)",
  },
  checkoutSheet: {
    maxHeight: "92%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 16,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d5dfd6",
    alignSelf: "center",
    marginBottom: 12,
  },
  checkoutContent: {
    paddingBottom: 10,
  },
  checkoutTitle: {
    color: DARK,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },
  inputLabel: {
    color: "#546558",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
    marginTop: 10,
    marginBottom: 4,
  },
  formInput: {
    minHeight: 42,
    backgroundColor: "#fafcfa",
    borderWidth: 1,
    borderColor: "#d8e1d9",
    borderRadius: 10,
    paddingHorizontal: 12,
    color: DARK,
    fontSize: 12,
  },
  addressInput: {
    minHeight: 56,
    textAlignVertical: "top",
    paddingTop: 8,
  },
  noteInput: {
    minHeight: 44,
    textAlignVertical: "top",
    paddingTop: 8,
  },
  paymentMethodOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e5ece6",
    backgroundColor: "#ffffff",
  },
  paymentMethodOptionActive: {
    borderColor: GREEN,
    backgroundColor: "#f4faf5",
  },
  paymentMethodLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: DARK,
  },
  paymentMethodLabelActive: {
    color: GREEN,
  },
  paymentMethodDesc: {
    fontSize: 10,
    color: MUTED,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#c4d1c6",
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleActive: {
    borderColor: GREEN,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GREEN,
  },

  rewardPointsCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5ece6",
    backgroundColor: "#fffdf7",
    marginTop: 4,
    marginBottom: 6,
  },
  rewardPointsCardActive: {
    borderColor: "#e2a83b",
    backgroundColor: "#fff8ea",
  },
  rewardPointsTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#8a5814",
  },
  rewardPointsDesc: {
    fontSize: 10,
    color: MUTED,
  },
  rewardPointsCheck: {
    fontSize: 18,
    color: "#a1aba3",
  },
  rewardPointsCheckActive: {
    color: "#d48806",
  },

  checkoutTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#edf2ee",
    paddingTop: 10,
    marginTop: 12,
  },
  cancelCheckout: {
    alignItems: "center",
    paddingVertical: 10,
  },
  cancelText: {
    color: MUTED,
    fontSize: 11,
    fontWeight: "700",
  },

  // Payment Result Blocks
  paymentBoxMomo: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff0f6",
    borderWidth: 1,
    borderColor: "#ffadd2",
    alignItems: "center",
  },
  paymentBoxMomoTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#a50064",
    marginBottom: 4,
  },
  paymentBoxMomoDesc: {
    fontSize: 11,
    color: "#595959",
    textAlign: "center",
    marginBottom: 10,
  },
  momoActionBtn: {
    backgroundColor: "#a50064",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignSelf: "stretch",
    alignItems: "center",
  },
  momoActionText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 12,
  },
  paymentWaitText: {
    fontSize: 11,
    color: MUTED,
  },
  paymentBoxBank: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#f0f5ff",
    borderWidth: 1,
    borderColor: "#adc6ff",
    alignItems: "center",
  },
  paymentBoxBankTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#1d39c4",
    marginBottom: 4,
  },
  paymentBoxBankDesc: {
    fontSize: 11,
    color: "#595959",
    textAlign: "center",
    marginBottom: 8,
  },
  vietQrImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginVertical: 4,
    backgroundColor: "#ffffff",
  },
  bankDetailCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    padding: 8,
    borderRadius: 8,
    marginTop: 6,
    gap: 2,
  },
  bankDetailLine: {
    fontSize: 10,
    color: DARK,
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
  successIcon: {
    width: 48,
    height: 48,
    lineHeight: 48,
    borderRadius: 24,
    overflow: "hidden",
    textAlign: "center",
    backgroundColor: GREEN_LIGHT,
    color: GREEN,
    fontSize: 24,
    fontWeight: "900",
    alignSelf: "center",
    marginBottom: 12,
  },
  successTitle: {
    color: DARK,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 12,
  },
  successCode: {
    color: GREEN,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
    padding: 10,
    backgroundColor: "#eef7f0",
    borderRadius: 8,
  },

  // Vouchers
  voucherRow: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#edf2ee",
    marginTop: 6,
    paddingTop: 6,
  },
  voucherLabel: {
    color: DARK,
    fontSize: 12,
    fontWeight: "700",
  },
  voucherAction: {
    color: GREEN,
    fontSize: 11,
    fontWeight: "800",
  },
  voucherRemove: {
    color: ACCENT,
    fontSize: 11,
    textAlign: "right",
    marginBottom: 4,
  },
  voucherBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(10, 20, 14, 0.65)",
  },
  voucherSheet: {
    height: "76%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  voucherHeading: {
    height: 54,
    borderBottomWidth: 1,
    borderBottomColor: "#eaefea",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  voucherTitle: {
    color: DARK,
    fontSize: 16,
    fontWeight: "900",
  },
  voucherCloseButton: {
    position: "absolute",
    right: 4,
  },
  voucherClose: {
    color: MUTED,
    fontSize: 18,
    padding: 6,
  },
  voucherCodeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    marginBottom: 10,
  },
  voucherInput: {
    flex: 1,
    minHeight: 42,
    backgroundColor: "#fafcfa",
    borderColor: "#d8e1d9",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: DARK,
    fontSize: 13,
  },
  voucherAdd: {
    width: 80,
    borderRadius: 10,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  voucherAddText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
  },
  voucherSubheading: {
    color: "#546558",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
  },
  voucherList: {
    flex: 1,
  },
  voucherCard: {
    backgroundColor: "#fafcfa",
    borderRadius: 12,
    borderColor: "#e5ece6",
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  voucherCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  voucherBadge: {
    minWidth: 54,
    minHeight: 40,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: GREEN_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  voucherBadgeText: {
    color: GREEN,
    fontWeight: "900",
    fontSize: 12,
  },
  voucherInfo: {
    flex: 1,
  },
  voucherName: {
    color: DARK,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  voucherExpiry: {
    color: MUTED,
    fontSize: 10,
    marginTop: 2,
  },
  voucherUseBtn: {
    backgroundColor: "#eaf5ed",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  voucherUseText: {
    color: GREEN,
    fontSize: 11,
    fontWeight: "900",
  },
  voucherDescription: {
    color: "#d97706",
    fontSize: 10,
    marginTop: 6,
  },
  voucherMessage: {
    color: ACCENT,
    fontSize: 11,
    marginVertical: 6,
  },

  // Common UI State & Buttons
  centerState: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  stateText: {
    color: MUTED,
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 45,
    paddingHorizontal: 16,
  },
  emptyEmoji: {
    fontSize: 46,
    marginBottom: 8,
  },
  emptyTitle: {
    color: DARK,
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyCta: {
    marginTop: 14,
    alignSelf: "stretch",
  },
  errorCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f5dcd8",
  },
  errorTitle: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: "900",
  },
  errorText: {
    color: "#7a5c57",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  apiHint: {
    color: MUTED,
    fontSize: 9,
    marginTop: 6,
  },
  orderError: {
    color: ACCENT,
    fontSize: 11,
    backgroundColor: "#fff2f0",
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  accountMessage: {
    color: GREEN,
    fontSize: 11,
    marginTop: 8,
    textAlign: "center",
  },
  refreshButton: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "#eef6f0",
  },
  refreshText: {
    color: GREEN,
    fontSize: 10,
    fontWeight: "800",
  },
  button: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    marginTop: 10,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  buttonSecondary: {
    backgroundColor: "#edf5ee",
  },
  buttonSecondaryText: {
    color: GREEN,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
});
