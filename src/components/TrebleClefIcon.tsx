interface TrebleClefIconProps {
    className?: string;
}

export default function TrebleClefIcon({ className = "w-6 h-6" }: TrebleClefIconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M12 3C12 3 11 4 11 6C11 8 12 9 12 9C12 9 13 8 13 6C13 4 12 3 12 3Z" />
            <circle cx="12" cy="12" r="3" />
            <path d="M12 9V21" />
            <path d="M12 21C12 21 10 20.5 10 19C10 17.5 12 17 12 17" />
            <path d="M15 12C15 12 16 13 16 15C16 17 15 18 15 18" />
        </svg>
    );
}
