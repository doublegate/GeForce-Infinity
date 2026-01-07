import * as React from "react";
import {
  FaCircleCheck,
  FaCircleXmark,
  FaTriangleExclamation,
} from "react-icons/fa6";

interface StatusIndicatorProps {
  supported: boolean;
  label: string;
  hardwareAccelerated?: boolean | null;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  supported,
  label,
  hardwareAccelerated,
}) => {
  const getIcon = () => {
    if (!supported) {
      return <FaCircleXmark className="text-red-500" />;
    }
    if (hardwareAccelerated === true) {
      return <FaCircleCheck className="text-green-500" />;
    }
    if (hardwareAccelerated === false) {
      return <FaTriangleExclamation className="text-yellow-500" />;
    }
    return <FaCircleCheck className="text-green-500" />;
  };

  const getStatusText = () => {
    if (!supported) return "Not Supported";
    if (hardwareAccelerated === true) return "Hardware";
    if (hardwareAccelerated === false) return "Software";
    return "Supported";
  };

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-gray-300">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400">{getStatusText()}</span>
        {getIcon()}
      </div>
    </div>
  );
};

export default StatusIndicator;
