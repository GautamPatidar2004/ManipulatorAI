import React from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  message,
  onRetry,
  onDismiss,
}) => {
  return (
    <div className="flex items-center justify-between p-2.5 px-3.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs sm:text-sm shadow-xs" role="alert">
      <div className="flex items-center gap-2">
        <AlertCircle className="text-red-500 shrink-0" size={18} />
        <span className="font-medium">{message}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onRetry && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded px-2.5 py-1 text-xs font-semibold transition-colors"
            onClick={onRetry}
            title="Retry failed operation"
          >
            <RefreshCw size={13} />
            <span>Retry</span>
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-100 transition-colors"
            onClick={onDismiss}
            aria-label="Dismiss error"
          >
            <X size={15} />
          </button>
        )}
      </div>
    </div>
  );
};
