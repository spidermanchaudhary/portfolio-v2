"use client";

import { Component, type ReactNode } from "react";

/**
 * Catches anything thrown inside the WebGL universe (driver bugs, lost
 * contexts, shader compile failures) so it can never take the page down.
 * On failure the site drops to lite mode: static sky + HTML stand-ins.
 */
export default class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("[universe] WebGL scene disabled after an error:", error);
    document.documentElement.classList.add("lite");
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
