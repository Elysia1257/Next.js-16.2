"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class NodeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    // Only suppress DOM reconciliation errors
    const msg = error?.message ?? "";
    if (msg.includes("removeChild") || msg.includes("insertBefore") || msg.includes("replaceChild")) {
      return { hasError: false, errorMessage: "" };
    }
    return { hasError: true, errorMessage: msg };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const msg = error?.message ?? "";
    if (msg.includes("removeChild") || msg.includes("insertBefore") || msg.includes("replaceChild")) return;
    console.error("[NodeErrorBoundary] Non-DOM error caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="bg-red-900/30 border border-red-500/30 rounded-lg px-3 py-2 text-[10px] text-red-400">
          <span className="font-semibold">Node Error</span>
          <p className="mt-1 text-red-300/70 break-all">{this.state.errorMessage}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
