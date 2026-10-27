import { useEffect, useState } from "react";
import { API_URL } from "../config";
import useUi from "../hooks/useUi";
import EmptyState from "../components/EmptyState";
import Icon from "../components/Icon";
import PageHeader from "../components/PageHeader";
import ProductDrawer from "../components/ProductDrawer";
import { formatMoney, formatNumber, normalizeText } from "../utils/format";

function Products() {
    const { toast, confirm } = useUi();

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // drawerOpen + editingProduct: the side panel to add or edit a product
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);

    const fetchProducts = async () => {
        try {
            const response = await fetch(`${API_URL}/products`);

            if (!response.ok) {
                throw new Error("Failed to load products.");
            }

            const data = await response.json();

            setProducts(data);
        } catch (error) {
            console.error("Error fetching products:", error);

            toast("نەتوانرا کاڵاکان باربکرێن.", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    const handleNewProduct = () => {
        setEditingProduct(null);
        setDrawerOpen(true);
    };

    const handleEdit = (product) => {
        setEditingProduct(product);
        setDrawerOpen(true);
    };

    const handleCloseDrawer = () => {
        setDrawerOpen(false);
    };

    const handleSaved = async () => {
        setDrawerOpen(false);

        await fetchProducts();
    };

    const handleDelete = async (product) => {
        const confirmed = await confirm(
            `"${product.name}" دەسڕدرێتەوە. وەسڵە کۆنەکان ناگۆڕدرێن.`,
            {
                title: "ئەم کاڵایە بسڕدرێتەوە؟",
                confirmLabel: "سڕینەوە",
                danger: true
            }
        );

        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch(
                `${API_URL}/products/${product.product_id}`,
                {
                    method: "DELETE"
                }
            );

            const data = await response.json();

            if (!response.ok) {
                toast(data.message || "نەتوانرا کاڵا بسڕدرێتەوە.", "error");
                return;
            }

            setProducts((currentProducts) =>
                currentProducts.filter(
                    (currentProduct) =>
                        currentProduct.product_id !== product.product_id
                )
            );

            toast("کاڵا سڕایەوە.", "success");
        } catch (error) {
            console.error("Error deleting product:", error);

            toast("هەڵەیەک ڕوویدا لە کاتی سڕینەوەی کاڵا.", "error");
        }
    };

    const filteredProducts = products.filter((product) =>
        normalizeText(product.name).includes(normalizeText(searchTerm))
    );

    return (
        <div>
            <PageHeader
                title="کاڵاکان"
                subtitle={
                    loading
                        ? "کاڵاکان و یەکە و نرخەکانیان بەڕێوەببە."
                        : `${formatNumber(products.length)} کاڵا لە فرۆشگادایە.`
                }
            >
                <button
                    onClick={handleNewProduct}
                    className="flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-bold text-brand-ink hover:opacity-90"
                >
                    <Icon name="plus" className="size-5" />
                    کاڵای نوێ
                </button>
            </PageHeader>

            <div className="relative">
                <Icon
                    name="search"
                    className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted"
                />

                <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    aria-label="گەڕان لە کاڵاکان"
                    placeholder="گەڕان لە کاڵاکان..."
                    className="w-full rounded-2xl border border-line bg-surface py-3.5 pe-4 ps-12 text-ink"
                />
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-surface">
                {loading ? (
                    <ul className="divide-y divide-line">
                        {[0, 1, 2].map((row) => (
                            <li key={row} className="p-5">
                                <div className="h-6 w-44 animate-pulse rounded-lg bg-surface-2" />

                                <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded-lg bg-surface-2" />
                            </li>
                        ))}
                    </ul>
                ) : products.length === 0 ? (
                    <EmptyState
                        title="هێشتا هیچ کاڵایەک زیاد نەکراوە"
                        description="کاڵای یەکەم بە ناو، یەکە و نرخی دۆلارەوە زیادبکە."
                    >
                        <button
                            onClick={handleNewProduct}
                            className="rounded-xl bg-brand px-6 py-3 font-bold text-brand-ink hover:opacity-90"
                        >
                            کاڵای نوێ
                        </button>
                    </EmptyState>
                ) : filteredProducts.length === 0 ? (
                    <EmptyState
                        title="هیچ کاڵایەک نەدۆزرایەوە"
                        description="ناوێکی تر تاقیبکەرەوە."
                    />
                ) : (
                    <ul className="divide-y divide-line">
                        {filteredProducts.map((product) => (
                            <li
                                key={product.product_id}
                                className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="min-w-0">
                                    <p className="font-display text-lg font-bold text-ink">
                                        {product.name}
                                    </p>

                                    <ul className="mt-2 flex flex-wrap gap-2">
                                        {product.units.map((unit) => (
                                            <li
                                                key={unit.unit_id}
                                                className="rounded-lg bg-surface-2 px-3 py-1.5 text-sm text-ink"
                                            >
                                                <span className="font-semibold">
                                                    {unit.unit_name}
                                                </span>

                                                <span className="mx-2 text-muted">
                                                    {formatMoney(unit.price_usd)}
                                                </span>

                                                {unit.stock_quantity !== null && (
                                                    <span className="text-muted">
                                                        · ستۆک:{" "}
                                                        {formatNumber(
                                                            unit.stock_quantity,
                                                            3
                                                        )}
                                                    </span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="flex shrink-0 gap-2">
                                    <button
                                        onClick={() => handleEdit(product)}
                                        className="flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 font-medium text-ink hover:border-brand hover:text-brand"
                                    >
                                        <Icon name="edit" className="size-4.5" />
                                        دەستکاری
                                    </button>

                                    <button
                                        onClick={() => handleDelete(product)}
                                        aria-label={`سڕینەوەی ${product.name}`}
                                        className="grid size-11 place-items-center rounded-xl border border-line text-muted hover:border-danger hover:bg-danger-soft hover:text-danger"
                                    >
                                        <Icon name="trash" className="size-4.5" />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {drawerOpen && (
                <ProductDrawer
                    key={editingProduct ? editingProduct.product_id : "new"}
                    product={editingProduct}
                    onClose={handleCloseDrawer}
                    onSaved={handleSaved}
                />
            )}
        </div>
    );
}

export default Products;
