export function SearchInput({ value, onChange, placeholder = "Search..." }) {
  return (
    <input
      className="input"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

