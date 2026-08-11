import { NavLink } from 'react-router-dom';
import { Sparkles, Radio, Clapperboard } from 'lucide-react';
import clsx from 'clsx';

const TABS = [
  { to: '/', label: 'Slang', icon: Sparkles, end: true },
  { to: '/live', label: 'Live Room', icon: Radio, end: false },
  { to: '/clips', label: 'Clip Studio', icon: Clapperboard, end: false },
];

export function Navbar() {
  return (
    <nav
      className={clsx(
        'fixed inset-x-0 bottom-0 z-50 border-t border-slate-800/80 bg-slate-950/90 backdrop-blur-lg',
        'sm:sticky sm:top-0 sm:bottom-auto sm:border-t-0 sm:border-b'
      )}
    >
      <div className="mx-auto flex max-w-3xl items-center justify-around px-2 py-2 sm:justify-center sm:gap-2">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                'flex flex-1 flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium transition-colors sm:flex-row sm:gap-2 sm:px-4',
                isActive
                  ? 'bg-indigo-500/15 text-indigo-300'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              )
            }
          >
            <Icon size={20} strokeWidth={2} />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
