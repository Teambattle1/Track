import React, { Suspense, ReactNode } from 'react';
import ErrorBoundary from './ErrorBoundary';

interface SafeSuspenseProps {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
  onError?: (error: Error) => void;
}

/**
 * SafeSuspense combines Suspense with ErrorBoundary for lazy-loaded components.
 * This ensures that both loading states and runtime errors are handled gracefully.
 *
 * Usage:
 * <SafeSuspense componentName="TaskEditor">
 *   <TaskEditor {...props} />
 * </SafeSuspense>
 */
const SafeSuspense: React.FC<SafeSuspenseProps> = ({
  children,
  fallback,
  componentName,
  onError
}) => {
  const defaultFallback = (
    <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
    </div>
  );

  return (
    <ErrorBoundary
      componentName={componentName}
      onError={onError ? (error) => onError(error) : undefined}
    >
      <Suspense fallback={fallback || defaultFallback}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
};

export default SafeSuspense;
