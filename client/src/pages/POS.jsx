import { useEffect, useRef, useState } from "react";
import { API_URL } from "../config";
import useUi from "../hooks/useUi";
import CartItem from "../components/CartItem";
import CustomerPicker from "../components/CustomerPicker";
import EmptyState from "../components/EmptyState";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";
import ProductRow from "../components/ProductRow";
import ReceiptModal from "../components/ReceiptModal";
import Segmented from "../components/Segmented";
import {
    formatMoney,
    formatNumber,
    hasMaxTwoDecimals,
    normalizeText,
    numberToInput,
    parseNumber,
    toEnglishDigits
} from "../utils/format";
import { calculateTotals, getPrice } from "../utils/pricing";

const saleTypeOptions = [
    { value: "cash", label: "نەقد" },
    { value: "credit", label: "قەرز" }
];

function POS({ cart, setCart }) {
    const { toast, confirm } = useUi();

    const [products, setProducts] = useState([]);

    // Cash: paid now. Credit: added to the debt of a customer.
    const [saleType, setSaleType] = useState("cash");
    const [customer, setCustomer] = useState(null);
    const [customerName, setCustomerName] = useState("");
    const [discountText, setDiscountText] = useState("");

    const [manualName, setManualName] = useState("");
    const [manualPrice, setManualPrice] = useState("");

    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [completingWasl, setCompletingWasl] = useState(false);

    // The cart is a bottom sheet on phones
    const [cartOpen, setCartOpen] = useState(false);

    // The wasl that was just saved (shown as a slip to print)
    const [receipt, setReceipt] = useState(null);

    const searchInputRef = useRef(null);

    const isCredit = saleType === "credit";

    const fetchProducts = async () => {
        setError("");

        try {
            const response = await fetch(`${API_URL}/products`);

            if (!response.ok) {
                throw new Error("Failed to load products.");
            }

            const data = await response.json();

            setProducts(data);
        } catch (error) {
            console.error("Error fetching products:", error);

            setError(
                "نەتوانرا کاڵاکان باربکرێن. دڵنیابە سێرڤەر کارایە و دووبارە هەوڵبدەرەوە."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();

        searchInputRef.current?.focus();
    }, []);

    const handleRetry = () => {
        setLoading(true);
        fetchProducts();
    };

    const focusSearch = () => {
        setTimeout(() => {
            searchInputRef.current?.focus();
        }, 0);
    };

    const handleSaleTypeChange = (value) => {
        setSaleType(value);

        // A credit sale has no discount
        if (value === "credit") {
            setDiscountText("");
        }
    };

    // ---------- Cart ----------

    // A unit with tracked stock cannot go above its stock (the server checks too)
    const isOverStock = (stock, quantity) =>
        stock !== null && stock !== undefined && quantity > Number(stock);

    const addUnitToCart = (product, unit) => {
        const key = `unit-${unit.unit_id}`;

        const quantityInCart =
            cart.find((item) => item.key === key)?.quantity || 0;

        if (isOverStock(unit.stock_quantity, quantityInCart + 1)) {
            toast("ستۆکی ئەم یەکەیە بەشی ئەم بڕە ناکات.", "error");
            return;
        }

        setCart((currentCart) => {
            const existingItem = currentCart.find(
                (item) => item.key === key
            );

            if (existingItem) {
                return currentCart.map((item) =>
                    item.key === key
                        ? {
                              ...item,
                              quantity:
                                  Math.round((item.quantity + 1) * 1000) /
                                  1000
                          }
                        : item
                );
            }

            return [
                ...currentCart,
                {
                    key: key,
                    unit_id: unit.unit_id,
                    name: product.name,
                    unit_name: unit.unit_name,
                    price_usd: unit.price_usd,
                    stock_quantity: unit.stock_quantity,
                    quantity: 1
                }
            ];
        });
    };

    const handleAddManualItem = () => {
        const price = parseNumber(manualPrice);

        if (
            !manualName.trim() ||
            price === null ||
            price < 0 ||
            !hasMaxTwoDecimals(price)
        ) {
            toast("ناو و نرخی دروست بنووسە.", "error");
            return;
        }

        setCart((currentCart) => [
            ...currentCart,
            {
                key: `manual-${Date.now()}`,
                unit_id: null,
                name: manualName.trim(),
                unit_name: "",
                price_usd: price,
                quantity: 1
            }
        ]);

        setManualName("");
        setManualPrice("");
    };

    const handleSearchKeyDown = (event) => {
        if (event.key !== "Enter") {
            return;
        }

        event.preventDefault();

        if (!searchTerm.trim()) {
            return;
        }

        const onlyProduct =
            filteredProducts.length === 1 ? filteredProducts[0] : null;

        if (!onlyProduct || onlyProduct.units.length !== 1) {
            toast("یەکەی کاڵاکە لە لیستەکە هەڵبژێرە.", "info");
            return;
        }

        addUnitToCart(onlyProduct, onlyProduct.units[0]);

        setSearchTerm("");
        focusSearch();
    };

    const increaseQuantity = (key) => {
        const cartItem = cart.find((item) => item.key === key);

        if (cartItem && isOverStock(cartItem.stock_quantity, cartItem.quantity + 1)) {
            toast("ستۆکی ئەم یەکەیە بەشی ئەم بڕە ناکات.", "error");
            return;
        }

        setCart((currentCart) =>
            currentCart.map((item) =>
                item.key === key
                    ? {
                          ...item,
                          quantity:
                              Math.round((item.quantity + 1) * 1000) / 1000
                      }
                    : item
            )
        );
    };

    const decreaseQuantity = (key) => {
        setCart((currentCart) =>
            currentCart
                .map((item) =>
                    item.key === key
                        ? {
                              ...item,
                              quantity:
                                  Math.round((item.quantity - 1) * 1000) /
                                  1000
                          }
                        : item
                )
                .filter((item) => item.quantity > 0)
        );
    };

    // Quantity can have decimals (for example 1.5 kg)
    const handleQuantityBlur = (item, event) => {
        const newQuantity = parseNumber(event.target.value);

        if (newQuantity === null || newQuantity < 0) {
            event.target.value = numberToInput(item.quantity);
            return;
        }

        const roundedQuantity = Math.round(newQuantity * 1000) / 1000;

        if (isOverStock(item.stock_quantity, roundedQuantity)) {
            toast("ستۆکی ئەم یەکەیە بەشی ئەم بڕە ناکات.", "error");
            event.target.value = numberToInput(item.quantity);
            return;
        }

        setCart((currentCart) =>
            currentCart
                .map((currentItem) =>
                    currentItem.key === item.key
                        ? { ...currentItem, quantity: roundedQuantity }
                        : currentItem
                )
                .filter((currentItem) => currentItem.quantity > 0)
        );
    };

    const removeFromCart = (key) => {
        setCart((currentCart) =>
            currentCart.filter((item) => item.key !== key)
        );
    };

    const handleClearCart = async () => {
        if (cart.length === 0) {
            return;
        }

        const confirmed = await confirm(
            "هەموو کاڵاکانی سەبەتە لادەبرێن.",
            {
                title: "سەبەتە خاڵی بکرێتەوە؟",
                confirmLabel: "خاڵیکردنەوە",
                danger: true
            }
        );

        if (!confirmed) {
            return;
        }

        setCart([]);
        setCustomerName("");
        setDiscountText("");
        setCartOpen(false);

        focusSearch();
    };

    // ---------- Saving the wasl ----------

    const discountIsEmpty = discountText.trim() === "";
    const parsedDiscount = parseNumber(discountText);

    const discountIsValid =
        isCredit ||
        discountIsEmpty ||
        (parsedDiscount !== null &&
            parsedDiscount >= 0 &&
            hasMaxTwoDecimals(parsedDiscount));

    const discount =
        isCredit || discountIsEmpty ? 0 : parsedDiscount || 0;

    const totals = calculateTotals(
        cart,
        discountIsValid ? discount : 0
    );

    const handleCompleteWasl = async () => {
        if (cart.length === 0) {
            toast("سەبەتە بەتاڵە.", "error");
            return;
        }

        if (completingWasl) {
            return;
        }

        if (isCredit && !customer) {
            toast("بۆ فرۆشتن بە قەرز، کڕیارێک هەڵبژێرە.", "error");
            return;
        }

        if (!discountIsValid) {
            toast("داشکاندن دەبێت ژمارەیەکی دروست بێت.", "error");
            return;
        }

        if (discount > totals.subtotal) {
            toast("داشکاندن لە کۆی بچووک زیاترە.", "error");
            return;
        }

        setCompletingWasl(true);

        try {
            // Prices of the product list come from the database on the server.
            // Only manual items send their own price (in USD).
            const waslData = {
                sale_type: saleType,
                customer_id: isCredit ? customer.customer_id : undefined,
                customer_name: isCredit ? undefined : customerName.trim(),
                discount: discount,
                items: cart.map((item) =>
                    item.unit_id
                        ? {
                              unit_id: item.unit_id,
                              quantity: item.quantity
                          }
                        : {
                              name: item.name,
                              price: getPrice(item),
                              quantity: item.quantity
                          }
                )
            };

            const response = await fetch(`${API_URL}/wasls`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(waslData)
            });

            const data = await response.json();

            if (response.status === 409 && data.code === "NOT_ENOUGH_STOCK") {
                toast(
                    "ستۆکی یەکێک لە کاڵاکان بەشی ئەم بڕە ناکات. لاپەڕەکە نوێ بکەرەوە.",
                    "error"
                );
                fetchProducts();
                return;
            }

            if (!response.ok) {
                toast(data.message || "نەتوانرا وەسڵ دروستبکرێت.", "error");
                return;
            }

            setReceipt({
                wasl: data.wasl,
                items: data.items
            });

            setCart([]);
            setCustomer(null);
            setCustomerName("");
            setDiscountText("");
            setCartOpen(false);
        } catch (error) {
            console.error("Error creating wasl:", error);

            toast("هەڵەیەک ڕوویدا لە کاتی دروستکردنی وەسڵ.", "error");
        } finally {
            setCompletingWasl(false);
        }
    };

    const handleCloseReceipt = () => {
        setReceipt(null);
        focusSearch();
    };

    // ---------- Product list ----------

    const filteredProducts = products.filter((product) =>
        normalizeText(product.name).includes(normalizeText(searchTerm))
    );

    // How many of every unit are in the cart (shown as a badge)
    const cartQuantities = Object.fromEntries(
        cart.map((item) => [item.key, item.quantity])
    );

    return (
        <div>
            <PageHeader
                title="وەسڵی نوێ"
                subtitle="کاڵا هەڵبژێرە، وەسڵەکە لە سەبەتەدا دروست دەبێت."
            />

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
                {/* PRODUCTS */}
                <section>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative min-w-56 flex-1">
                            <Icon
                                name="search"
                                className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted"
                            />

                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchTerm}
                                onChange={(event) =>
                                    setSearchTerm(event.target.value)
                                }
                                onKeyDown={handleSearchKeyDown}
                                disabled={loading || !!error || completingWasl}
                                aria-label="گەڕان بە ناوی کاڵا"
                                placeholder="ناوی کاڵا بنووسە..."
                                className="w-full rounded-2xl border border-line bg-surface py-3.5 pe-4 ps-12 text-ink disabled:opacity-60"
                            />
                        </div>

                        <Segmented
                            options={saleTypeOptions}
                            value={saleType}
                            onChange={handleSaleTypeChange}
                            label="جۆری فرۆشتن"
                            disabled={completingWasl}
                        />
                    </div>

                    <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-surface">
                        {loading ? (
                            <ul className="divide-y divide-line">
                                {[0, 1, 2, 3].map((row) => (
                                    <li
                                        key={row}
                                        className="flex items-center justify-between gap-6 p-4"
                                    >
                                        <div className="h-6 w-40 animate-pulse rounded-lg bg-surface-2" />

                                        <div className="h-14 w-36 animate-pulse rounded-xl bg-surface-2" />
                                    </li>
                                ))}
                            </ul>
                        ) : error ? (
                            <EmptyState
                                title="نەتوانرا کاڵاکان باربکرێن"
                                description={error}
                            >
                                <button
                                    onClick={handleRetry}
                                    className="rounded-xl bg-brand px-6 py-3 font-semibold text-brand-ink hover:opacity-90"
                                >
                                    دووبارە هەوڵبدەرەوە
                                </button>
                            </EmptyState>
                        ) : products.length === 0 ? (
                            <EmptyState
                                title="هێشتا هیچ کاڵایەک زیاد نەکراوە"
                                description="لە بەشی کاڵاکان، یەکەم کاڵا بە یەکە و نرخەکانییەوە زیادبکە."
                            />
                        ) : filteredProducts.length === 0 ? (
                            <EmptyState
                                title="هیچ کاڵایەک نەدۆزرایەوە"
                                description="ناوێکی تر تاقیبکەرەوە."
                            />
                        ) : (
                            <ul className="divide-y divide-line">
                                {filteredProducts.map((product) => (
                                    <ProductRow
                                        key={product.product_id}
                                        product={product}
                                        cartQuantities={cartQuantities}
                                        disabled={completingWasl}
                                        onAdd={addUnitToCart}
                                    />
                                ))}
                            </ul>
                        )}
                    </div>
                </section>

                {/* CART TICKET */}
                {cartOpen && (
                    <div
                        className="fixed inset-0 z-30 bg-black/45 animate-fade lg:hidden"
                        onClick={() => setCartOpen(false)}
                    />
                )}

                <aside
                    aria-label="سەبەتەی وەسڵ"
                    className={`fixed inset-x-0 bottom-0 z-40 flex max-h-[90vh] flex-col transition-transform duration-300 lg:sticky lg:top-24 lg:z-auto lg:max-h-[calc(100vh-7.5rem)] lg:translate-y-0 lg:drop-shadow-[0_14px_22px_rgba(10,30,22,0.16)] ${
                        cartOpen ? "translate-y-0" : "translate-y-full"
                    }`}
                >
                    <div className="ticket-edge flex min-h-0 flex-1 flex-col rounded-t-3xl bg-surface pb-6 lg:rounded-2xl">
                        <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-line lg:hidden" />

                        <div className="flex items-center justify-between px-5 pb-2 pt-4">
                            <h2 className="flex items-center gap-2 font-display text-xl font-extrabold text-ink">
                                سەبەتەی وەسڵ
                                {isCredit && (
                                    <span className="rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-gold-ink">
                                        قەرز
                                    </span>
                                )}
                            </h2>

                            <div className="flex items-center gap-1">
                                {cart.length > 0 && (
                                    <button
                                        onClick={handleClearCart}
                                        disabled={completingWasl}
                                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                                    >
                                        خاڵیکردنەوە
                                    </button>
                                )}

                                <button
                                    onClick={() => setCartOpen(false)}
                                    aria-label="داخستنی سەبەتە"
                                    className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2 lg:hidden"
                                >
                                    <Icon name="close" className="size-5" />
                                </button>
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-5">
                            {cart.length === 0 ? (
                                <div className="py-10 text-center">
                                    <Icon
                                        name="receipt"
                                        className="mx-auto size-10 text-line"
                                    />

                                    <p className="mt-3 font-semibold text-ink">
                                        سەبەتە بەتاڵە
                                    </p>

                                    <p className="mt-1 text-sm text-muted">
                                        یەکەی کاڵایەک دابگرە بۆ ئەوەی لێرە دەربکەوێت.
                                    </p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-dotted divide-line">
                                    {cart.map((item) => (
                                        <CartItem
                                            key={item.key}
                                            item={item}
                                            disabled={completingWasl}
                                            onIncrease={increaseQuantity}
                                            onDecrease={decreaseQuantity}
                                            onRemove={removeFromCart}
                                            onQuantityBlur={
                                                handleQuantityBlur
                                            }
                                        />
                                    ))}
                                </ul>
                            )}

                            <details className="mt-2 border-t border-dotted border-line py-3">
                                <summary className="flex cursor-pointer items-center gap-2 font-medium text-brand">
                                    <Icon name="plus" className="size-4" />
                                    کاڵای دەستی
                                </summary>

                                <div className="mt-3 grid grid-cols-3 gap-2">
                                    <input
                                        type="text"
                                        value={manualName}
                                        onChange={(event) =>
                                            setManualName(event.target.value)
                                        }
                                        aria-label="ناوی کاڵا"
                                        placeholder="ناوی کاڵا"
                                        className="col-span-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-ink"
                                    />

                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        dir="ltr"
                                        value={manualPrice}
                                        onChange={(event) =>
                                            setManualPrice(
                                                toEnglishDigits(
                                                    event.target.value
                                                )
                                            )
                                        }
                                        aria-label="نرخ بە دۆلار"
                                        placeholder="نرخ ($)"
                                        className="col-span-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-center text-ink"
                                    />

                                    <button
                                        onClick={handleAddManualItem}
                                        className="rounded-xl bg-ink px-3 py-2.5 font-semibold text-bg hover:opacity-90"
                                    >
                                        زیادکردن
                                    </button>
                                </div>
                            </details>

                            {/* CUSTOMER (credit) or customer name + discount (cash) */}
                            {isCredit ? (
                                <div className="border-t border-dotted border-line py-4">
                                    <p className="mb-2 text-sm font-medium text-ink">
                                        کڕیار
                                    </p>

                                    <CustomerPicker
                                        value={customer}
                                        onChange={setCustomer}
                                        disabled={completingWasl}
                                    />

                                    {customer && cart.length > 0 && (
                                        <p className="mt-3 rounded-xl bg-gold-soft px-4 py-2.5 text-sm text-ink">
                                            قەرز دوای ئەم وەسڵە:{" "}
                                            <span className="font-bold">
                                                {formatMoney(
                                                    Math.round(
                                                        (Number(
                                                            customer.balance
                                                        ) +
                                                            totals.total) *
                                                            100
                                                    ) / 100
                                                )}
                                            </span>
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3 border-t border-dotted border-line py-4">
                                    <label>
                                        <span className="mb-1 block text-xs text-muted">
                                            ناوی کڕیار (دڵخواز)
                                        </span>

                                        <input
                                            type="text"
                                            value={customerName}
                                            onChange={(event) =>
                                                setCustomerName(
                                                    event.target.value
                                                )
                                            }
                                            disabled={completingWasl}
                                            className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-ink"
                                        />
                                    </label>

                                    <label>
                                        <span className="mb-1 block text-xs text-muted">
                                            داشکاندن ($)
                                        </span>

                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            dir="ltr"
                                            value={discountText}
                                            onChange={(event) =>
                                                setDiscountText(
                                                    toEnglishDigits(
                                                        event.target.value
                                                    )
                                                )
                                            }
                                            disabled={completingWasl}
                                            placeholder="0"
                                            className={`w-full rounded-xl border bg-surface-2 px-3 py-2.5 text-center text-ink ${
                                                discountIsValid
                                                    ? "border-line"
                                                    : "border-danger"
                                            }`}
                                        />
                                    </label>

                                    {!discountIsValid && (
                                        <p className="col-span-2 text-sm text-danger">
                                            داشکاندن دەبێت ژمارەیەکی دروست بێت.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="border-t-2 border-dashed border-line px-5 pt-4">
                            {totals.discount > 0 && (
                                <div className="space-y-1 text-sm text-muted">
                                    <div className="flex items-center justify-between">
                                        <span>کۆی بچووک</span>

                                        <span>
                                            {formatMoney(totals.subtotal)}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span>داشکاندن</span>

                                        <span>
                                            {formatMoney(totals.discount)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="mt-2 flex items-baseline justify-between">
                                <span className="font-semibold text-ink">
                                    کۆی گشتی
                                </span>

                                <span className="font-display text-3xl font-extrabold text-gold-text">
                                    {formatMoney(totals.total)}
                                </span>
                            </div>

                            <button
                                onClick={handleCompleteWasl}
                                disabled={completingWasl || cart.length === 0}
                                className="mt-4 w-full rounded-2xl bg-gold py-4 font-display text-lg font-extrabold text-gold-ink transition hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {completingWasl
                                    ? "وەسڵ دروست دەکرێت..."
                                    : isCredit
                                      ? "پاشەکەوتکردن بە قەرز"
                                      : "پاشەکەوتکردنی وەسڵ"}
                            </button>
                        </div>
                    </div>
                </aside>
            </div>

            {/* Cart bar on phones */}
            {cart.length > 0 && !cartOpen && (
                <button
                    onClick={() => setCartOpen(true)}
                    className="fixed inset-x-3 bottom-20 z-30 flex items-center justify-between rounded-2xl bg-gold px-5 py-3.5 font-bold text-gold-ink shadow-card print:hidden lg:hidden"
                >
                    <span className="flex items-center gap-2">
                        <Icon name="bag" className="size-5" />
                        {formatNumber(cart.length)} کاڵا
                    </span>

                    <span className="font-display">
                        {formatMoney(totals.total)}
                    </span>
                </button>
            )}

            {receipt && (
                <ReceiptModal
                    wasl={receipt.wasl}
                    items={receipt.items}
                    onClose={handleCloseReceipt}
                />
            )}
        </div>
    );
}

export default POS;
