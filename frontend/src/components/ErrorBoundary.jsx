// src/components/ErrorBoundary.jsx
import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  handleReload = () => {
    try {
      window.location.reload();
    } catch {
      // no-op
    }
  };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("❌ Uncaught Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const message = this.state.error?.message || "An unknown error occurred.";
      const isChunkError =
        typeof message === "string" &&
        (message.includes("Failed to fetch dynamically imported module") ||
          message.includes("ChunkLoadError") ||
          message.includes("Loading chunk") ||
          message.includes("dynamically imported module"));

      if (isChunkError) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6">
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4 text-center">
              <h1 className="text-xl font-semibold">New version available</h1>
              <p className="text-sm text-slate-300">
                We just shipped an update. Please refresh to load the latest app
                and continue.
              </p>
              <button
                onClick={this.handleReload}
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-semibold transition"
              >
                Refresh now
              </button>
              <p className="text-xs text-slate-500">
                If this keeps happening, clear cache and try again.
              </p>
            </div>
          </div>
        );
      }

      return (
        <div className="text-center p-10 text-red-600">
          <h1 className="text-2xl font-semibold">Something went wrong.</h1>
          <p className="mt-4">{message}</p>
        </div>
      );
    }

    return this.props.children;
  }
}
