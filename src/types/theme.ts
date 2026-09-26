export type StageThemeId = 'stage-black' | 'cyber-amber' | 'electric-cyan' | 'matrix-green' | 'crimson-neon' | 'soft-paper';

export interface StageTheme {
  id: StageThemeId;
  name: string;
  bgClass: string;
  cardBgClass: string;
  textClass: string;
  accentClass: string;
  borderClass: string;
  badgeClass: string;
  previewBg: string;
  previewAccent: string;
}

export const STAGE_THEMES: Record<StageThemeId, StageTheme> = {
  'stage-black': {
    id: 'stage-black',
    name: 'Palco Puro (Dark)',
    bgClass: 'bg-black',
    cardBgClass: 'bg-zinc-950',
    textClass: 'text-zinc-100',
    accentClass: 'text-amber-500',
    borderClass: 'border-zinc-800',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    previewBg: '#000000',
    previewAccent: '#f59e0b',
  },
  'cyber-amber': {
    id: 'cyber-amber',
    name: 'Cyber Gold',
    bgClass: 'bg-stone-950',
    cardBgClass: 'bg-stone-900',
    textClass: 'text-amber-50',
    accentClass: 'text-amber-400',
    borderClass: 'border-amber-900/40',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    previewBg: '#0c0a09',
    previewAccent: '#fbbf24',
  },
  'electric-cyan': {
    id: 'electric-cyan',
    name: 'Electric Blue',
    bgClass: 'bg-slate-950',
    cardBgClass: 'bg-slate-900',
    textClass: 'text-cyan-50',
    accentClass: 'text-cyan-400',
    borderClass: 'border-cyan-900/40',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    previewBg: '#020617',
    previewAccent: '#38bdf8',
  },
  'matrix-green': {
    id: 'matrix-green',
    name: 'Acoustic Emerald',
    bgClass: 'bg-zinc-950',
    cardBgClass: 'bg-zinc-900',
    textClass: 'text-emerald-50',
    accentClass: 'text-emerald-400',
    borderClass: 'border-emerald-900/40',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    previewBg: '#09090b',
    previewAccent: '#34d399',
  },
  'crimson-neon': {
    id: 'crimson-neon',
    name: 'Rock Club (Neon Red)',
    bgClass: 'bg-neutral-950',
    cardBgClass: 'bg-neutral-900',
    textClass: 'text-rose-50',
    accentClass: 'text-rose-500',
    borderClass: 'border-rose-900/40',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    previewBg: '#0a0a0a',
    previewAccent: '#f43f5e',
  },
  'soft-paper': {
    id: 'soft-paper',
    name: 'Partitura (Alto Contraste)',
    bgClass: 'bg-zinc-900',
    cardBgClass: 'bg-zinc-800',
    textClass: 'text-yellow-100',
    accentClass: 'text-yellow-400',
    borderClass: 'border-zinc-700',
    badgeClass: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    previewBg: '#18181b',
    previewAccent: '#facc15',
  },
};
