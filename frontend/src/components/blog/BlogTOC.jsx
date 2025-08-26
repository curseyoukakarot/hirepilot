import React, { useEffect, useMemo, useState } from 'react';

export default function BlogTOC({ items }) {
  const [derivedItems, setDerivedItems] = useState([]);
  const computedItems = useMemo(() => (items && items.length ? items : derivedItems), [items, derivedItems]);
  const [activeId, setActiveId] = useState(items?.[0]?.id || '');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (items && items.length > 0) return; // use provided items
    // Auto-generate from #article-body direct children with id
    const article = document.getElementById('article-body');
    if (!article) return;
    const sections = Array.from(article.querySelectorAll(':scope > div[id]'));
    const built = sections.map((section) => {
      const heading = section.querySelector('h2, h3');
      const text = heading ? heading.textContent : section.id;
      return { id: section.id, label: text };
    });
    setDerivedItems(built);
  }, [items]);

  useEffect(() => {
    const firstId = (computedItems && computedItems.length) ? computedItems[0].id : '';
    setActiveId(firstId);
  }, [computedItems]);

  useEffect(() => {
    const toc = computedItems;
    if (!toc || toc.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { root: null, rootMargin: '0px 0px -60% 0px', threshold: 0.1 }
    );
    const els = toc
      .map((t) => document.getElementById(t.id))
      .filter(Boolean);
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [computedItems]);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setOpen(false);
    }
  };

  return (
    <>
      <style>{`
        .toc-active { color: #3b82f6; }
        .toc-card { box-shadow: 0 10px 25px rgba(0,0,0,0.35); }
      `}</style>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 flex-shrink-0">
        <div className="sticky top-8">
          <h3 className="text-lg font-semibold mb-4 text-gray-200">Table of Contents</h3>
          <nav className="space-y-2">
            {computedItems?.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className={`block text-left w-full py-1 cursor-pointer transition-colors ${
                  activeId === item.id ? 'toc-active' : 'text-gray-400 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Mobile floating TOC */}
      <div className="lg:hidden">
        <button
          aria-label="Open table of contents"
          onClick={() => setOpen((v) => !v)}
          className="fixed bottom-4 right-4 z-40 bg-blue-600 text-white px-4 py-3 rounded-full shadow-lg focus:outline-none"
        >
          <i className="fa-solid fa-list mr-2" /> TOC
        </button>
        {open && (
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)}>
            <div className="absolute inset-0 bg-black bg-opacity-50" />
            <div
              className="absolute bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 rounded-t-2xl p-6 toc-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white text-lg font-semibold">Table of Contents</h3>
                <button onClick={() => setOpen(false)} className="text-gray-300 hover:text-white">
                  <i className="fa-solid fa-xmark text-xl" />
                </button>
              </div>
              <nav className="space-y-3">
                {computedItems?.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollTo(item.id)}
                    className={`block text-left w-full py-1 text-base ${
                      activeId === item.id ? 'toc-active' : 'text-gray-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        )}
      </div>
    </>
  );
}


