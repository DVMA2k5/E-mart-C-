export function mergeLatestCart(cart, products) {
  const byId = new Map(products.map((product) => [product.id, product]));
  return cart.map((item) => {
    const product = byId.get(item.id);
    if (!product) return { ...item, isActive: false, stock: 0 };
    return { ...item, name: product.productName, price: Number(product.discountPrice ?? product.price),
      stock: product.inventory?.quantity ?? 0, isActive: product.isActive !== false };
  });
}
export const hasUnavailableItems = (cart) => cart.some((item) => item.isActive === false || item.quantity > item.stock);
