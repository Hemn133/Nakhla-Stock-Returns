import { useEffect, useState } from "react";

// Light / dark theme. The first value is set by the script in index.html.
function useTheme() {
    const [theme, setTheme] = useState(() =>
        typeof document !== "undefined" &&
        document.documentElement.classList.contains("dark")
            ? "dark"
            : "light"
    );

    useEffect(() => {
        document.documentElement.classList.toggle("dark", theme === "dark");

        try {
            localStorage.setItem("nakhla-theme", theme);
        } catch {
            // saving is optional
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme((currentTheme) =>
            currentTheme === "dark" ? "light" : "dark"
        );
    };

    return { theme, toggleTheme };
}

export default useTheme;
