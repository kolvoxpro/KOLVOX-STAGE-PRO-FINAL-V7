// Dedicated Local Storage & Cloud Synchronizer for Kolvox Accounts
// Supports Admin credentials (koljoseph2020@gmail.com / 28k28k28k) and Client accounts

export interface StoredUserAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'user' | 'admin';
  status: 'active' | 'blocked' | 'inativo';
  created_at: string;
  updated_at: string;
}

const USERS_STORAGE_KEY = 'kolvox_registered_users';
const CURRENT_USER_KEY = 'kolvox_active_session';

// Admin predefined credentials requested by user
export const ADMIN_CREDENTIALS = {
  email: 'koljoseph2020@gmail.com',
  passwordPlain: '28k28k28k',
  name: 'Administrador KOLVOX',
  role: 'admin' as const,
};

// Fast SHA-256 hash using Web Crypto API
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const FAKE_USER_EMAILS = [
  'carlos.vocal@gmail.com',
  'mariana.acustico@hotmail.com',
  'lucas.rocha.musica@gmail.com',
  'juliana.cantora@gmail.com',
  'rodrigo.sertanejo@gmail.com',
  'felipe.voz@uol.com.br',
  'demo@kolvox.app',
  'musico@kolvox.com',
  'admin@kolvox.com',
  'amanda@kolvox.com',
  'roberto@kolvox.com',
  'camila@kolvox.com',
];

export function getAllLocalUsers(): StoredUserAccount[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    const users: StoredUserAccount[] = raw ? JSON.parse(raw) : [];
    const deletedRaw = localStorage.getItem('kolvox_deleted_users');
    const deletedList: string[] = deletedRaw ? JSON.parse(deletedRaw) : [];
    const deletedLower = deletedList.map(s => s.toLowerCase());

    const clean = users.filter(u => 
      !deletedLower.includes(String(u.id).toLowerCase()) &&
      !deletedLower.includes((u.email || '').toLowerCase()) &&
      !FAKE_USER_EMAILS.includes((u.email || '').toLowerCase().trim())
    );

    // If fake users were found in storage, purge them
    if (clean.length !== users.length) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(clean));
    }

    return clean;
  } catch (e) {
    console.error('Failed to load local users', e);
    return [];
  }
}

export function saveLocalUser(user: StoredUserAccount): void {
  const deletedRaw = localStorage.getItem('kolvox_deleted_users');
  const deletedList: string[] = deletedRaw ? JSON.parse(deletedRaw) : [];
  if (deletedList.some(d => d.toLowerCase() === user.email.toLowerCase() || d.toLowerCase() === String(user.id).toLowerCase())) {
    // If user was previously deleted, remove from deleted list upon fresh explicit registration
    const cleaned = deletedList.filter(d => d.toLowerCase() !== user.email.toLowerCase() && d.toLowerCase() !== String(user.id).toLowerCase());
    localStorage.setItem('kolvox_deleted_users', JSON.stringify(cleaned));
  }

  const users = getAllLocalUsers();
  const existingIdx = users.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
  if (existingIdx >= 0) {
    users[existingIdx] = user;
  } else {
    users.push(user);
  }
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

export function updateLocalUser(id: string, updates: Partial<StoredUserAccount>): void {
  const users = getAllLocalUsers();
  const idx = users.findIndex(u => String(u.id) === String(id) || u.email.toLowerCase() === id.toLowerCase());
  if (idx >= 0) {
    users[idx] = { ...users[idx], ...updates, updated_at: new Date().toISOString() };
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  }
}

export function markUserAsDeleted(id: string, email?: string): void {
  try {
    const raw = localStorage.getItem('kolvox_deleted_users');
    const list: string[] = raw ? JSON.parse(raw) : [];
    const idLower = String(id).toLowerCase();
    if (id && !list.some(x => x.toLowerCase() === idLower)) list.push(idLower);
    if (email) {
      const emailLower = email.toLowerCase();
      if (!list.some(x => x.toLowerCase() === emailLower)) list.push(emailLower);
    }
    localStorage.setItem('kolvox_deleted_users', JSON.stringify(list));
  } catch {}
}

export function isUserDeleted(idOrEmail: string): boolean {
  try {
    const raw = localStorage.getItem('kolvox_deleted_users');
    if (!raw) return false;
    const list: string[] = JSON.parse(raw);
    const target = idOrEmail.toLowerCase();
    return list.some(item => item.toLowerCase() === target);
  } catch {
    return false;
  }
}

export function deleteLocalUser(id: string, email?: string): void {
  markUserAsDeleted(id, email);

  const raw = localStorage.getItem(USERS_STORAGE_KEY);
  const users: StoredUserAccount[] = raw ? JSON.parse(raw) : [];
  const targetId = String(id).toLowerCase();
  const targetEmail = (email || '').toLowerCase();

  const filtered = users.filter(u => {
    const uId = String(u.id).toLowerCase();
    const uEmail = (u.email || '').toLowerCase();
    if (uId === targetId || (targetEmail && uEmail === targetEmail)) return false;
    if (targetId && uEmail === targetId) return false;
    return true;
  });

  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(filtered));

  // If current active session belongs to this deleted user, terminate session immediately
  const current = getActiveLocalSession();
  if (current) {
    const cId = String(current.id).toLowerCase();
    const cEmail = (current.email || '').toLowerCase();
    if (cId === targetId || (targetEmail && cEmail === targetEmail) || (targetId && cEmail === targetId)) {
      setActiveLocalSession(null);
    }
  }
}

export function getActiveLocalSession(): StoredUserAccount | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session) return null;

    // Check if session user is deleted
    const deletedRaw = localStorage.getItem('kolvox_deleted_users');
    if (deletedRaw) {
      const deletedList: string[] = JSON.parse(deletedRaw);
      const deletedLower = deletedList.map(s => s.toLowerCase());
      if (
        deletedLower.includes(String(session.id).toLowerCase()) ||
        deletedLower.includes((session.email || '').toLowerCase())
      ) {
        localStorage.removeItem(CURRENT_USER_KEY);
        return null;
      }
    }
    return session;
  } catch {
    return null;
  }
}

export function setActiveLocalSession(user: StoredUserAccount | null): void {
  if (user) {
    // If user is in deleted list, do not set active session
    if (isUserDeleted(user.id) || isUserDeleted(user.email)) {
      localStorage.removeItem(CURRENT_USER_KEY);
      return;
    }
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
}
