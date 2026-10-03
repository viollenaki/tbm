import React, { useState, useEffect, useCallback } from "react";
import { CheckCircle2, AlertTriangle, Sparkles, X } from "lucide-react";
import { UserPortalPage } from "./pages/UserPortalPage";
import { AdminPage } from "./pages/AdminPage";

export interface ToastNotification {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  message: string;
}

export function App() {
  // Simple client-side path router
  const [currentPath, setCurrentPath] = useState<string>(
    typeof window !== "undefined" ? window.location.pathname : "/",
  );

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useCallback((to: string) => {
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", to);
      setCurrentPath(to);
    }
  }, []);

  // Toasts / alerts
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const addToast = useCallback(
    (type: "success" | "error" | "info", title: string, message: string) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, type, title, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Determine active view: /admin vs user portal
  const isAdminView = currentPath === "/admin" || currentPath.startsWith("/admin/");

  return (
    <>
      {/* Toast Notification Stack */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full px-4 sm:px-0 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start justify-between gap-3 p-4 rounded-xl border shadow-lg transition-all animate-in fade-in slide-in-from-top-2 duration-200 ${
              toast.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/90 border-emerald-500/30 text-emerald-900 dark:text-emerald-100"
                : toast.type === "error"
                ? "bg-rose-50 dark:bg-rose-950/90 border-rose-500/30 text-rose-900 dark:text-rose-100"
                : "bg-blue-50 dark:bg-blue-950/90 border-blue-500/30 text-blue-900 dark:text-blue-100"
            }`}
          >
            <div className="flex items-start gap-3">
              {toast.type === "success" && (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              )}
              {toast.type === "error" && (
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              )}
              {toast.type === "info" && (
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              )}
              <div>
                <h4 className="font-semibold text-sm">{toast.title}</h4>
                <p className="text-xs opacity-90 mt-0.5">{toast.message}</p>
              </div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-muted-foreground hover:text-foreground p-1 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {isAdminView ? (
        <AdminPage navigate={navigate} addToast={addToast} />
      ) : (
        <UserPortalPage navigate={navigate} addToast={addToast} />
      )}
    </>
  );
}

export default App;
