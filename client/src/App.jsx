import { useEffect, useState } from "react";
import {
    BrowserRouter,
    Routes,
    Route,
    Navigate
} from "react-router-dom";

import { SHOP_NAME } from "./config";

import UiProvider from "./context/UiProvider";

import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import MobileNav from "./components/MobileNav";

import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import CustomerProfile from "./pages/CustomerProfile";
import Wasls from "./pages/Wasls";
import Reports from "./pages/Reports";

function App() {
    const [cart, setCart] = useState([]);

    // The shop name shows in the browser tab
    useEffect(() => {
        document.title = SHOP_NAME;
    }, []);

    return (
        <BrowserRouter>
            <UiProvider>
                <div className="min-h-screen bg-bg text-ink">
                    <Sidebar cart={cart} />

                    <div className="lg:ps-64">
                        <TopBar />

                        <main className="mx-auto max-w-6xl px-4 pb-32 pt-8 sm:px-6 lg:pb-14">
                            <Routes>
                                <Route
                                    path="/"
                                    element={
                                        <Navigate to="/dashboard" replace />
                                    }
                                />

                                <Route
                                    path="/dashboard"
                                    element={<Dashboard />}
                                />

                                <Route
                                    path="/pos"
                                    element={
                                        <POS cart={cart} setCart={setCart} />
                                    }
                                />

                                <Route
                                    path="/products"
                                    element={<Products />}
                                />

                                <Route
                                    path="/customers"
                                    element={<Customers />}
                                />

                                <Route
                                    path="/customers/:id"
                                    element={<CustomerProfile />}
                                />

                                <Route path="/wasls" element={<Wasls />} />

                                <Route
                                    path="/reports"
                                    element={<Reports />}
                                />

                                <Route
                                    path="*"
                                    element={
                                        <Navigate to="/dashboard" replace />
                                    }
                                />
                            </Routes>
                        </main>
                    </div>

                    <MobileNav cart={cart} />
                </div>
            </UiProvider>
        </BrowserRouter>
    );
}

export default App;
