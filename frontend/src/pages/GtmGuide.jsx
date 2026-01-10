import React, { useEffect, useRef } from "react";
import PublicNavbar from "../components/PublicNavbar";
import PublicFooter from "../components/PublicFooter";
import guideHtml from "./GtmGuideContent.html?raw";

// Fixed PublicNavbar is ~80px tall; in-page sticky header adds more.
// This offset ensures TOC hash-links land with headings visible.
const ANCHOR_OFFSET_PX = 160;

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
      <div ref={containerRef} dangerouslySetInnerHTML={{ __html: guideHtml }} />
      <PublicFooter />
    </div>
  );
}
