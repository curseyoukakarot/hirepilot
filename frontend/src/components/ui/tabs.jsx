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
    <div role="tablist" className={className} {...rest}>
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
      className={`${className} ${active ? 'data-[state=active]:bg-primary' : ''}`}
      data-state={active ? 'active' : 'inactive'}
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


