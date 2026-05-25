"use client";

type SidebarItemProps = {
    label: string;
    active?: boolean;
};

export default function SidebarItem({
    label,
    active,
}: SidebarItemProps) {
    return (
        <button
            className={`
                flex w-full items-center rounded-2xl px-4 py-3 text-sm transition-all
                ${active
                    ? "bg-primary text-white shadow-lg"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }
            `}
        >
            {label}
        </button>
    );
}