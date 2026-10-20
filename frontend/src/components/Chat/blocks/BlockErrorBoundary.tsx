import { Component, type ReactNode } from 'react';

interface Props {
  fallback?: ReactNode;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class BlockErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown) {
    console.warn('Block rendering error caught by boundary:', error);
  }

  override render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="my-1.5 p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-500 italic">
            Unable to display component preview.
          </div>
        )
      );
    }
    return this.props.children;
  }
}
