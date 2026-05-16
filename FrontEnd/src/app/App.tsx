import React, { Fragment, useEffect, type ReactNode } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from './components/ui/sonner';
import { getStoredUser } from './lib/user-storage';

function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const user = getStoredUser();
    const theme = user?.preferences?.theme || 'Light';
    
    // Apply dark class to html element based on theme preference
    if (theme === 'Dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'Light') {
      document.documentElement.classList.remove('dark');
    } else if (theme === 'System Default') {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, []);

  return <Fragment>{children}</Fragment>;
}

function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
      <Toaster />
    </ThemeProvider>
  );
}

export default App;
