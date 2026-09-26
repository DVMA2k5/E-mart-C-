import Select from "react-select";

const CustomSelect = ({
  options,
  value,
  onChange,
  placeholder = "-- Chọn --",
  isDisabled = false,
  error = false,
  isSearchable = true,
}) => {
  const customStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: "32px",
      fontSize: "14px",
      borderColor: error ? "#ef4444" : state.isFocused ? "#6366f1" : "#d1d5db",
      boxShadow: state.isFocused ? "0 0 0 1px #6366f1" : "none",
      "&:hover": {
        borderColor: error ? "#ef4444" : "#6366f1",
      },
    }),
    valueContainer: (base) => ({
      ...base,
      padding: "0 8px",
      fontSize: "14px",
    }),
    input: (base) => ({
      ...base,
      margin: "0",
      padding: "0",
      fontSize: "14px",
    }),
    menu: (base) => ({
      ...base,
      fontSize: "14px",
      zIndex: 9999,
    }),
    menuList: (base) => ({
      ...base,
      maxHeight: "200px", // Giới hạn chiều cao = 5-6 dòng
      "::-webkit-scrollbar": {
        width: "6px",
      },
      "::-webkit-scrollbar-track": {
        background: "#f1f5f9",
      },
      "::-webkit-scrollbar-thumb": {
        background: "#94a3b8",
        borderRadius: "3px",
      },
      "::-webkit-scrollbar-thumb:hover": {
        background: "#64748b",
      },
    }),
    option: (base, state) => ({
      ...base,
      fontSize: "14px",
      padding: "8px 12px",
      backgroundColor: state.isSelected
        ? "#6366f1"
        : state.isFocused
        ? "#e0e7ff"
        : "white",
      color: state.isSelected ? "white" : "#374151",
      cursor: "pointer",
      ":active": {
        backgroundColor: "#6366f1",
      },
    }),
    placeholder: (base) => ({
      ...base,
      fontSize: "14px",
      color: "#9ca3af",
    }),
    singleValue: (base) => ({
      ...base,
      fontSize: "14px",
      color: "#374151",
    }),
  };

  return (
    <Select
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      isDisabled={isDisabled}
      isClearable
      isSearchable={isSearchable}
      styles={customStyles}
      noOptionsMessage={() => "Không tìm thấy"}
      theme={(theme) => ({
        ...theme,
        borderRadius: 6,
        colors: {
          ...theme.colors,
          primary: "#6366f1",
          primary25: "#e0e7ff",
          primary50: "#c7d2fe",
        },
      })}
    />
  );
};

export default CustomSelect;
