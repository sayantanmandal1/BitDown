import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, Component, type ReactNode } from "react";
import AppLayout from "./components/layout/AppLayout";
import { useTauriEvents } from "./hooks/useTauriEvents";
import { useSettingsStore } from "./stores/settingsStore";

// ErrorBoundary catches React errors that would otherwise show blank screen
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          position: "fixed", inset: 0,
          background: "#090909", color: "#e0e0e0",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          fontFamily: "monospace", padding: 32, gap: 16,
        }}>
          <div style={{ fontSize: 18, color: "#ff6b6b", fontWeight: 600 }}>
            BitDown — Startup Error
          </div>
          <div style={{ fontSize: 12, color: "#888", maxWidth: 640, textAlign: "center" }}>
            {(this.state.error as Error).message}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 8, padding: "8px 20px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6, color: "#fff", cursor: "pointer", fontSize: 13 }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5000 }, // no global refetchInterval — individual queries control their own
  },
});

function AppInner() {
  useTauriEvents();
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadSettings(); }, []); // [] intentional: run once on mount only
  return <AppLayout />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppInner />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
