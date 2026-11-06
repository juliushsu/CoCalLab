import { Fragment, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {pageVisitKey} from '../../services/workflowNavigation';
import { useAuth } from '../../hooks/useAuth';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, authEpoch } = useAuth();
  const location=useLocation();

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Fragment key={pageVisitKey(authEpoch,user.id,location.pathname,location.search)}>{children}</Fragment>;
}