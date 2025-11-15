import React, { createContext, useContext, useMemo, useState } from 'react';

const TabsContext = createContext({
  value: undefined,
  setValue: () => {},
});

export function Tabs({ defaultValue, value: valueProp, onValueChange, className = '', children, ...rest }) {
  const [internal, setInternal] = useState(defaultValue || undefined);
  const value = valueProp === undefined ? internal : valueProp;
  const setValue = (v) => {
    if (valueProp === undefined) setInternal(v);
    if (onValueChange) onValueChange(v);
  };
  const ctx = useMemo(() => ({ value, setValue }), [value]);
  return (
    <TabsContext.Provider value={ctx}>
      <div className={className} {...rest}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className = '', children, ...rest }) {
  return (
    <div role="tablist" className={`border-b border-gray-200 dark:border-gray-800 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function TabsTrigger({ value, className = '', children, ...rest }) {
  const { value: current, setValue } = useContext(TabsContext);
  const active = current === value;
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={() => setValue(value)}
      className={`${className} px-4 py-2 text-sm border-b-2 border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white ${active ? 'border-blue-600 text-blue-600 dark:text-blue-400' : ''}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, className = '', children, ...rest }) {
  const { value: current } = useContext(TabsContext);
  if (current !== value) return null;
  return (
    <div role="tabpanel" className={className} {...rest}>
      {children}
    </div>
  );
}

export default Tabs;


