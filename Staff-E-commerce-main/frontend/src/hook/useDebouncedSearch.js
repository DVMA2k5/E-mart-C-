import { useEffect, useRef } from "react";

export function useDebouncedSearch(input, appliedSearch, onSearch) {
  const apply = useRef(onSearch);
  useEffect(() => { apply.current = onSearch; }, [onSearch]);

  useEffect(() => {
    const keyword = input.trim();
    if (keyword === (appliedSearch || "")) return;
    const timer = window.setTimeout(() => apply.current(keyword), 300);
    return () => window.clearTimeout(timer);
  }, [input, appliedSearch]);
}
