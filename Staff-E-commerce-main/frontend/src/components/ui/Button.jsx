// src/components/ui/Button.jsx
import React from "react";

export default function Button({ children, onClick, className = "", ...rest }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
