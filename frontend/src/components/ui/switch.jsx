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
      className={`inline-flex h-6 w-11 items-center rounded-full transition-colors ${isOn ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'} ${className}`}
      {...rest}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${isOn ? 'translate-x-5' : 'translate-x-1'}`}
      />
    </button>
  );
}

export default Switch;


