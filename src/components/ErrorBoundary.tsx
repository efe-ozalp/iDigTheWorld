import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** Shown in place of the children if any of them throws. */
  fallback: ReactNode;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/** Keeps one broken part of the page from blanking the whole app. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Recovered from a rendering error:', error, info.componentStack);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
