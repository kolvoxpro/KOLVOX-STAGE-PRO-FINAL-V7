export interface User {
  id: number;
  nomeCompleto: string;
  nomeArtistico: string;
  email: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
  fotoPerfil?: string;
  tipoUsuario: 'USER' | 'ADMIN';
  status: 'ativo' | 'inativo' | 'pendente';
  emailVerificado?: boolean;
  createdAt?: string;
}

export interface Song {
  id: number | string;
  userId?: number;
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  key?: string;
  capo?: number;
  bpm?: number;
  duration?: string;
  lyrics?: string;
  chords?: string;
  tabs?: string;
  sheetMusic?: string;
  sourceProvider?: string;
  sourceUrl?: string;
  licenseType?: string;
  downloadAllowed?: boolean;
  printAllowed?: boolean;
  isFavorite?: boolean;
  hasChords?: boolean;
  hasLyrics?: boolean;
  hasTabs?: boolean;
  hasSheetMusic?: boolean;
  officialNotice?: string;
  playlistPosition?: number;
  playlistSongId?: number;
}

export interface Playlist {
  id: number;
  userId: number;
  name: string;
  description?: string;
  songCount?: number;
  songs?: Song[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Subscription {
  id: number;
  userId: number;
  plan: string; // 'trial_7d' | 'kolvox_pro_monthly' | 'kolvox_pro_yearly'
  status: 'trial' | 'active' | 'canceled' | 'expired';
  planType?: string;
  currentPeriodEnd?: string;
  trialStart?: string;
  trialEnd?: string;
  trialUsed?: boolean;
  subscriptionStart?: string;
  subscriptionEnd?: string;
  paymentProvider?: string;
  amount?: string;
  currency?: string;
  createdAt?: string;
}

export interface Payment {
  id: number;
  userId: number;
  subscriptionId?: number;
  provider: string;
  externalPaymentId?: string;
  referenceCode?: string;
  amount: string;
  currency: string;
  status: string;
  paymentDate: string;
  user?: {
    nomeArtistico: string;
    email: string;
  };
}

export interface ActivityLog {
  id: number;
  userId?: number;
  action: string;
  userName?: string;
  userEmail?: string;
  details?: string;
  timestamp?: string;
  ip?: string;
  metadata?: string;
  createdAt?: string;
}

export interface ChordDiagramData {
  chord: string;
  frets: number[]; // 6 strings from low E (6) to high E (1), -1 is muted (X), 0 is open
  fingers: number[]; // 0 for none, 1-4 for index/middle/ring/pinky
  baseFret: number;
  barres?: { fromString: number; toString: number; fret: number }[];
}
