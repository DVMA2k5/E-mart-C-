// src/components/ui/Button.jsx
import React from "react";

export default function Button({ children, onClick, className = "", ...rest }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
