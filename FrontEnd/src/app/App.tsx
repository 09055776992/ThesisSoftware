import React, { Fragment, type ReactNode } from 'react';
import { RouterProvider } from 'react-router';
import { MotionConfig } from 'motion/react';
import { router } from './routes';
import { Toaster } from './components/ui/sonner';
function ThemeProvider({ children }: { children: ReactNode }) {
  return <Fragment>{children}</Fragment>;
}

function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <RouterProvider router={router} />
        <Toaster />
      </ThemeProvider>
    </MotionConfig>
  );
}

export default App;
