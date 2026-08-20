import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
          <p className="text-lg font-semibold text-ink">Algo salió mal</p>
          <p className="text-sm text-ink-soft">{this.state.error?.message}</p>
          <button
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
            className="rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-bg hover:opacity-90 cursor-pointer"
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
