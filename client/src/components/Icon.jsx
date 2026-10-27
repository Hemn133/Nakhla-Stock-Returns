const icons = {
    home: (
        <>
            <path d="M3 11.5 12 4l9 7.5" />
            <path d="M5.5 10v10h13V10" />
            <path d="M10 20v-5.5h4V20" />
        </>
    ),
    receipt: (
        <>
            <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
            <path d="M9 8h6M9 12h6" />
        </>
    ),
    box: (
        <>
            <path d="M21 8 12 3 3 8l9 5z" />
            <path d="M3 8v8l9 5 9-5V8" />
            <path d="M12 13v8" />
        </>
    ),
    list: (
        <>
            <path d="M8 6h12M8 12h12M8 18h12" />
            <path d="M4 6h.01M4 12h.01M4 18h.01" />
        </>
    ),
    chart: <path d="M5 20v-8M12 20V5M19 20V9" />,
    search: (
        <>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
        </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    trash: (
        <>
            <path d="M4 7h16" />
            <path d="M10 11v6M14 11v6" />
            <path d="M6 7l1 13h10l1-13" />
            <path d="M9 7V4h6v3" />
        </>
    ),
    edit: (
        <>
            <path d="M4 20h4L19 9l-4-4L4 16z" />
            <path d="m13.5 6.5 4 4" />
        </>
    ),
    close: <path d="M6 6l12 12M18 6 6 18" />,
    check: <path d="m5 12.5 4.5 4.5L19 7" />,
    printer: (
        <>
            <path d="M7 9V3h10v6" />
            <path d="M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
            <path d="M7 14h10v7H7z" />
        </>
    ),
    sun: (
        <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
    ),
    moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />,
    bag: (
        <>
            <path d="M5 8h14l-1 12H6z" />
            <path d="M9 8V6a3 3 0 0 1 6 0v2" />
        </>
    ),
    swap: <path d="M7 7h12l-3-3M17 17H5l3 3" />,
    alert: (
        <>
            <path d="M12 4 2.5 20h19z" />
            <path d="M12 10v4M12 17h.01" />
        </>
    ),
    info: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 8h.01" />
        </>
    ),
    chevron: <path d="m15 6-6 6 6 6" />,
    users: (
        <>
            <circle cx="9" cy="8" r="3.5" />
            <path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
            <path d="M16 4.7a3.5 3.5 0 0 1 0 6.6" />
            <path d="M18 14.8c1.9.6 3.2 2.3 3.5 5.2" />
        </>
    ),
    wallet: (
        <>
            <path d="M3 7a2 2 0 0 1 2-2h13v4" />
            <path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z" />
            <path d="M16 14.5h.01" />
        </>
    ),
    undo: (
        <>
            <path d="M9 14 4 9l5-5" />
            <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
        </>
    ),
    file: (
        <>
            <path d="M6 3h8l4 4v14H6z" />
            <path d="M14 3v4h4" />
            <path d="M9 12h6M9 16h6" />
        </>
    )
};

function Icon({ name, className = "size-5" }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
        >
            {icons[name]}
        </svg>
    );
}

export default Icon;
