import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { ApiError } from './lib/api';
import { AuthProvider } from './lib/auth';
import { router } from './router';
import '@fontsource-variable/inter';
import './index.css';

// Protection globale contre les extensions de navigateur (Google Translate, Grammarly, etc.)
// qui modifient les nœuds DOM et provoquent "Failed to execute 'removeChild' on 'Node'".
if (typeof Node === 'function' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      if (console) {
        console.warn('removeChild ignoré : le nœud n\'est plus un enfant direct de ce parent.', child, this);
      }
      return child;
    }
    return originalRemoveChild.apply(this, [child]) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (console) {
        console.warn('insertBefore ignoré : le nœud de référence n\'est plus un enfant direct.', referenceNode, this);
      }
      return newNode;
    }
    return originalInsertBefore.apply(this, [newNode, referenceNode]) as T;
  };
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: false,
      // Pas de nouvelle tentative sur une erreur d'autorisation ou de validation.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500) && failureCount < 2,
    },
  },
});

const container = document.getElementById('root');
if (!container) throw new Error('Élément #root introuvable');

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
