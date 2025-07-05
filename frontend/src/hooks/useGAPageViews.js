import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Fires a Google Analytics page_view event whenever the React Router path changes.
 * Assumes gtag.js is loaded globally and window.gtag is available.
 */
export default function useGAPageViews() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_path: location.pathname + location.search,
      });
    }
  }, [location]);
} 