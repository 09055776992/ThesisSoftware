import { Outlet } from "react-router";

export function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center relative">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1547817651-7fb0cc360536?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx1bml2ZXJzaXR5JTIwY2FtcHVzJTIwc3R1ZGVudHMlMjBzdHVkeWluZ3xlbnwxfHx8fDE3NzYzNTcwOTJ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral')`,
          filter: 'blur(8px)',
        }}
      />
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 w-full max-w-[480px] mx-4">
        <Outlet />
      </div>
    </div>
  );
}