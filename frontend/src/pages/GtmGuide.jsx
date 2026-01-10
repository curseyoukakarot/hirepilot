import React, { useEffect, useRef } from "react";
import PublicNavbar from "../components/PublicNavbar";
import PublicFooter from "../components/PublicFooter";
import guideHtml from "./GtmGuideContent.html?raw";

// Fixed PublicNavbar is ~80px tall; in-page sticky header adds more.
// This offset ensures TOC hash-links land with headings visible.
const ANCHOR_OFFSET_PX = 160;
const IMPLEMENT_URL = "/gtm-strategy";

export default function GtmGuide() {
  const containerRef = useRef(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const openBtn = root.querySelector("#openToc");
    const closeBtn = root.querySelector("#closeToc");
    const backdrop = root.querySelector("#tocBackdrop");
    const drawer = root.querySelector("#tocDrawer");

    const setDrawerOpen = (open) => {
      if (drawer) drawer.classList.toggle("open", open);
      if (backdrop) backdrop.classList.toggle("open", open);
      if (backdrop) backdrop.setAttribute("aria-hidden", open ? "false" : "true");
    };

    const onOpen = (e) => {
      e?.preventDefault?.();
      setDrawerOpen(true);
    };
    const onClose = (e) => {
      e?.preventDefault?.();
      setDrawerOpen(false);
    };

    openBtn?.addEventListener("click", onOpen);
    closeBtn?.addEventListener("click", onClose);
    backdrop?.addEventListener("click", onClose);

    const onKeyDown = (e) => {
      if (e?.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);

    const setActiveToc = (id) => {
      const tocLinks = root.querySelectorAll('.toc a[href^="#"]');
      tocLinks.forEach((a) => a.setAttribute("aria-current", "false"));
      if (!id) return;
      const active = root.querySelector('.toc a[href="#' + id + '"]');
      active?.setAttribute("aria-current", "true");
    };

    const scrollToId = (id) => {
      if (!id) return;
      const target = document.getElementById(id) || root.querySelector("#" + CSS.escape(id));
      if (!target) return;
      const top = window.scrollY + target.getBoundingClientRect().top - ANCHOR_OFFSET_PX;
      window.history.replaceState(null, "", "#" + id);
      window.scrollTo({ top, behavior: "smooth" });
    };

    const onClick = (e) => {
      const a = e?.target?.closest?.('a');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || href.charAt(0) !== '#') return;

      const id = href.slice(1);
      const exists = document.getElementById(id) || root.querySelector('#' + CSS.escape(id));
      if (!exists) return;

      e.preventDefault();
      scrollToId(id);
      setActiveToc(id);
      setDrawerOpen(false);
    };

    root.addEventListener('click', onClick);

    const tocLinks = Array.from(root.querySelectorAll('.toc a[href^="#"]'));
    const ids = Array.from(new Set(tocLinks.map((a) => (a.getAttribute('href') || '').slice(1)).filter(Boolean)));
    const sections = ids.map((id) => document.getElementById(id) || root.querySelector('#' + CSS.escape(id))).filter(Boolean);

    let activeId = null;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((en) => en.isIntersecting)
          .sort((a, b) => (b.intersectionRatio || 0) - (a.intersectionRatio || 0))[0];
        const nextId = visible?.target?.id || null;
        if (nextId && nextId !== activeId) {
          activeId = nextId;
          setActiveToc(nextId);
        }
      },
      {
        root: null,
        rootMargin: '-' + ANCHOR_OFFSET_PX + 'px 0px -70% 0px',
        threshold: [0.06, 0.12, 0.2, 0.3, 0.45],
      }
    );

    sections.forEach((el) => observer.observe(el));

    const initialId = (window.location.hash || '').replace('#', '');
    if (initialId) {
      setActiveToc(initialId);
      Promise.resolve().then(() => scrollToId(initialId));
    }

    return () => {
      openBtn?.removeEventListener("click", onOpen);
      closeBtn?.removeEventListener("click", onClose);
      backdrop?.removeEventListener("click", onClose);
      document.removeEventListener("keydown", onKeyDown);
      root.removeEventListener('click', onClick);
      try { observer.disconnect(); } catch {}
    };
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <PublicNavbar />
      {/* Top CTA (sits below fixed PublicNavbar) */}
      <div className="pt-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur px-5 py-4 shadow-[0_22px_70px_rgba(0,0,0,0.25)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white/90">Ready to implement?</div>
              <div className="text-xs text-white/70">Turn this blueprint into a working HirePilot system.</div>
            </div>
            <a
              href={IMPLEMENT_URL}
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-indigo-500 to-sky-500 hover:opacity-95"
            >
              Implement This Guide
            </a>
          </div>
        </div>
      </div>

      <div ref={containerRef} dangerouslySetInnerHTML={{ __html: guideHtml }} />

      {/* Bottom CTA */}
      <div className="pb-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur px-5 py-5 shadow-[0_22px_70px_rgba(0,0,0,0.25)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="text-base font-extrabold text-white/95">Implement This Guide</div>
              <div className="text-sm text-white/70 max-w-2xl">
                If you want this running inside HirePilot (personas → campaigns → scheduling → dashboards), start here.
              </div>
            </div>
            <a
              href={IMPLEMENT_URL}
              className="inline-flex items-center justify-center px-5 py-3 rounded-2xl font-semibold text-sm text-white bg-gradient-to-r from-indigo-500 to-sky-500 hover:opacity-95"
            >
              Implement This Guide
            </a>
          </div>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
