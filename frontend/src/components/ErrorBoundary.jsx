// src/components/ErrorBoundary.jsx
import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("❌ Uncaught Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center p-10 text-red-600">
          <h1 className="text-2xl font-semibold">Something went wrong.</h1>
          <p className="mt-4">{this.state.error?.message || "An unknown error occurred."}</p>
        </div>
      );
    }

    return this.props.children;
  }
}
