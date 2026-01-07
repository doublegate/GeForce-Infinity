import * as React from "react";

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

export const TabButton: React.FC<TabButtonProps> = ({
  active,
  onClick,
  icon,
  label,
}) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
      active
        ? "bg-[#76b900] text-white"
        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
    }`}
  >
    {icon}
    {label}
  </button>
);

export default TabButton;
