import React, { useState } from 'react';

export function Switch({ checked, defaultChecked, onChange, className = '', ...rest }) {
  const [internal, setInternal] = useState(!!defaultChecked);
  const isOn = checked !== undefined ? checked : internal;
  const toggle = () => {
    const next = !isOn;
    if (checked === undefined) setInternal(next);
    onChange && onChange(next);
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      onClick={toggle}
      className={`inline-flex h-7 w-14 items-center rounded-full border transition-all ${
        isOn
          ? 'bg-blue-600 border-blue-500 shadow-[0_0_0_3px_rgba(37,99,235,0.25)]'
          : 'bg-gray-300 dark:bg-gray-700 border-gray-400 dark:border-gray-600'
      } ${className}`}
      {...rest}
    >
      <span
        className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow ${
          isOn ? 'translate-x-7' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default Switch;


