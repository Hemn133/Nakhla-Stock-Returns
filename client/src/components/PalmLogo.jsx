// The date palm (نخلە)
function PalmLogo({ className = "size-10" }) {
    return (
        <svg
            viewBox="0 0 48 48"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
        >
            <path d="M24 44c1-8 1-16 0-24" />
            <path d="M24 20c-3-6-9-8-16-6 5 0 9 2 12 6" />
            <path d="M24 20c3-6 9-8 16-6-5 0-9 2-12 6" />
            <path d="M24 20c-1-6-4-10-9-12 4 2 6 5 7 9" />
            <path d="M24 20c1-6 4-10 9-12-4 2-6 5-7 9" />
            <path d="M24 19V9" />
            <circle cx="21" cy="24" r="1.2" fill="currentColor" stroke="none" />
            <circle cx="27" cy="25" r="1.2" fill="currentColor" stroke="none" />
        </svg>
    );
}

export default PalmLogo;
