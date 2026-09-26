import bcrypt from 'bcryptjs';

export interface MemoryStoreData {
  users: any[];
  songs: any[];
  playlists: any[];
  playlist_songs: any[];
  favorites: any[];
  search_history: any[];
  song_sources: any[];
  subscriptions: any[];
  payments: any[];
  app_settings: any[];
  gmail_integrations: any[];
  support_tickets: any[];
  activity_logs: any[];
}

const ADMIN_EMAIL = 'koljoseph2020@gmail.com';
const ADMIN_PASSWORD_HASH = bcrypt.hashSync('28k28k28k', 10);

function getInitialStore(): MemoryStoreData {
  const now = new Date();
  const yearEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const trialEndIn2d = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const trialEndIn5d = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  const trialExpiredPast = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  return {
    users: [
      {
        id: 1,
        nomeCompleto: 'Joseph Kolvox (Admin)',
        nomeArtistico: 'Admin Joseph',
        email: ADMIN_EMAIL,
        senhaHash: ADMIN_PASSWORD_HASH,
        telefone: '(11) 99999-2828',
        cidade: 'São Paulo',
        estado: 'SP',
        fotoPerfil: null,
        tipoUsuario: 'ADMIN',
        status: 'ativo',
        emailVerificado: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    subscriptions: [
      {
        id: 1,
        userId: 1,
        plan: 'kolvox_pro_admin',
        status: 'active',
        trialStart: now,
        trialEnd: yearEnd,
        trialUsed: true,
        subscriptionStart: now,
        subscriptionEnd: yearEnd,
        paymentProvider: 'sistema',
        customerId: 'admin_sys',
        subscriptionId: 'sub_admin_master',
        paymentId: 'pay_admin',
        amount: '0.00',
        currency: 'BRL',
        createdAt: now,
        updatedAt: now,
      },
    ],
    app_settings: [
      {
        id: 1,
        pixKey: 'kolvox.pagamentos@gmail.com',
        pixKeyType: 'E-mail',
        pixReceiverName: 'KOLVOX TECNOLOGIA LTDA',
        pixCity: 'SAO PAULO',
        supportEmail: 'kolvox.pagamentos@gmail.com',
        monthlyPrice: '10.00',
        trialDays: 7,
        pixEnabled: true,
        manualPaymentEnabled: true,
        updatedAt: now,
        updatedBy: 1,
      },
    ],
    songs: [
      {
        id: 1,
        userId: 1,
        title: 'Evidências',
        artist: 'Chitãozinho & Xororó',
        album: 'Cowboy do Asfalto',
        genre: 'Sertanejo',
        key: 'E',
        capo: 0,
        bpm: 120,
        lyrics: 'Quando eu digo que deixei de te amar\nÉ porque eu te amo\nQuando eu digo que não quero mais você\nÉ porque eu te quero\nEu tenho medo de te dar meu coração\nE confessar que eu estou em tuas mãos...',
        chords: 'E                     G#m\nQuando eu digo que deixei de te amar\n           A\nÉ porque eu te amo\n                 F#m\nQuando eu digo que não quero mais você\n           B7\nÉ porque eu te quero',
        tabs: '',
        sheetMusic: '',
        sourceProvider: 'kolvox_catalog',
        sourceUrl: 'https://www.cifraclub.com.br/chitaozinho-e-xororo/evidencias/',
        licenseType: 'licensed',
        downloadAllowed: true,
        printAllowed: true,
        duration: '4:35',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 2,
        userId: 1,
        title: 'Tempo Perdido',
        artist: 'Legião Urbana',
        album: 'Dois',
        genre: 'Rock Nacional',
        key: 'C',
        capo: 0,
        bpm: 128,
        lyrics: 'Todos os dias quando acordo\nNão tenho mais o tempo que passou\nMas tenho muito tempo\nTemos todo o tempo do mundo\nTodos os dias antes de dormir\nLembro e esqueço como foi o dia...',
        chords: 'C                  Am7\nTodos os dias quando acordo\n            Bm7\nNão tenho mais o tempo que passou\n         Em\nMas tenho muito tempo\nC                   Am7\nTemos todo o tempo do mundo',
        tabs: '',
        sheetMusic: '',
        sourceProvider: 'kolvox_catalog',
        sourceUrl: 'https://www.cifraclub.com.br/legiao-urbana/tempo-perdido/',
        licenseType: 'licensed',
        downloadAllowed: true,
        printAllowed: true,
        duration: '5:02',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 3,
        userId: 2,
        title: 'Oceano',
        artist: 'Djavan',
        album: 'Djavan',
        genre: 'MPB',
        key: 'D',
        capo: 0,
        bpm: 96,
        lyrics: 'Assim que o dia amanheceu\nLá no mar alto da paixão\nEstava eu\nUm pescador de ilusões\nQue no seu barco solitário\nNavegava rumo ao amor...',
        chords: 'D7M               G7M\nAssim que o dia amanheceu\n         C#m7(b5)  F#7(#5)\nLá no mar alto da paixão\n       Bm7\nEstava eu',
        tabs: '',
        sheetMusic: '',
        sourceProvider: 'kolvox_catalog',
        sourceUrl: 'https://www.cifraclub.com.br/djavan/oceano/',
        licenseType: 'licensed',
        downloadAllowed: true,
        printAllowed: true,
        duration: '4:55',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 4,
        userId: 3,
        title: 'Céu Azul',
        artist: 'Charlie Brown Jr',
        album: 'Música Popular Caiçara',
        genre: 'Rock',
        key: 'A',
        capo: 0,
        bpm: 110,
        lyrics: 'Tão natural quanto a luz do dia\nMas que preguiça boa\nPra que correr se o dia tá lindo\nDeixa o sol entrar...',
        chords: 'A                 C#m7\nTão natural quanto a luz do dia\n      D9                 E\nMas que preguiça boa, me deixa aqui à toa',
        tabs: '',
        sheetMusic: '',
        sourceProvider: 'kolvox_catalog',
        sourceUrl: 'https://www.cifraclub.com.br/charlie-brown-jr/ceu-azul/',
        licenseType: 'licensed',
        downloadAllowed: true,
        printAllowed: true,
        duration: '3:18',
        createdAt: now,
        updatedAt: now,
      },
    ],
    playlists: [],
    playlist_songs: [],
    favorites: [
      { id: 1, userId: 1, songId: 1, createdAt: now },
      { id: 2, userId: 1, songId: 2, createdAt: now },
    ],
    search_history: [],
    song_sources: [],
    payments: [],
    gmail_integrations: [
      {
        id: 1,
        adminUserId: 1,
        googleAccountEmail: 'koljoseph2020@gmail.com',
        googleUserId: 'usr_admin_1',
        accessTokenEncrypted: null,
        refreshTokenEncrypted: null,
        tokenExpiry: yearEnd,
        status: 'connected',
        lastSyncAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ],
    support_tickets: [],
    activity_logs: [
      {
        id: 1,
        userId: 1,
        action: 'SISTEMA_INICIALIZADO',
        ip: '127.0.0.1',
        metadata: JSON.stringify({ note: 'Sistema KOLVOX Stage pronto para uso com contas reais de clientes.' }),
        createdAt: now,
      },
    ],
  };
}

let _store: MemoryStoreData = getInitialStore();

function getTableName(table: any): string {
  if (typeof table === 'string') return table;
  if (!table) return 'unknown';
  if (table._?.name) return String(table._.name);
  if (typeof table === 'object') {
    for (const sym of Object.getOwnPropertySymbols(table)) {
      if (
        sym.description === 'drizzle:Name' ||
        sym.description === 'drizzle:BaseName' ||
        sym.description === 'drizzle:OriginalName'
      ) {
        const val = table[sym];
        if (typeof val === 'string') return val;
      }
    }
  }
  return 'unknown';
}

function toCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

interface ConditionItem {
  col: string;
  op: string;
  val: any;
}

function extractConditions(condition: any): ConditionItem[] {
  if (!condition) return [];
  const results: ConditionItem[] = [];

  function walk(chunks: any[]) {
    let currentCol: string | null = null;
    let currentOp = '=';

    for (const chunk of chunks) {
      if (!chunk) continue;

      if (chunk.queryChunks && Array.isArray(chunk.queryChunks)) {
        walk(chunk.queryChunks);
        continue;
      }

      if (chunk.name && typeof chunk.name === 'string') {
        currentCol = chunk.name;
        continue;
      }

      if (chunk.value && Array.isArray(chunk.value) && typeof chunk.value[0] === 'string') {
        const str = chunk.value[0].trim();
        if (str === '=' || str === '!=' || str === '<>' || str === 'like' || str === 'ilike') {
          currentOp = str;
        }
      }

      if (chunk.constructor?.name === 'Param' || (chunk.value !== undefined && !Array.isArray(chunk.value))) {
        if (currentCol) {
          results.push({ col: currentCol, op: currentOp, val: chunk.value });
          currentCol = null;
          currentOp = '=';
        }
      }
    }
  }

  if (condition.queryChunks) {
    walk(condition.queryChunks);
  }
  return results;
}

function matchCondition(row: any, condition: any): boolean {
  if (!condition) return true;
  const conditions = extractConditions(condition);
  if (conditions.length === 0) return true;

  for (const { col, op, val } of conditions) {
    const camel = toCamel(col);
    const rowVal = row[camel] !== undefined ? row[camel] : row[col];

    if (op === '=' || !op) {
      if (rowVal === undefined && val === undefined) continue;
      if (String(rowVal).toLowerCase() !== String(val).toLowerCase() && rowVal !== val) {
        return false;
      }
    } else if (op === '!=' || op === '<>') {
      if (String(rowVal).toLowerCase() === String(val).toLowerCase() || rowVal === val) {
        return false;
      }
    } else if (op === 'like' || op === 'ilike') {
      const pattern = String(val).replace(/%/g, '.*');
      try {
        const reg = new RegExp(`^${pattern}$`, 'i');
        if (!reg.test(String(rowVal || ''))) {
          return false;
        }
      } catch {
        if (!String(rowVal || '').toLowerCase().includes(String(val || '').replace(/%/g, '').toLowerCase())) {
          return false;
        }
      }
    }
  }
  return true;
}

export function createMemoryDb() {
  return {
    select: (fields?: any) => ({
      from: (table: any) => {
        const tableName = getTableName(table) as keyof MemoryStoreData;
        let rows = [...(_store[tableName] || [])];

        const formatRow = (r: any) => {
          if (!fields || typeof fields !== 'object') {
            return r;
          }

          // Case 1: Joined song + author
          if ('song' in fields && 'author' in fields) {
            const author = _store.users?.find((u) => u.id === r.userId || u.id === r.user_id) || {
              id: r.userId || 1,
              nomeArtistico: 'Joseph Kolvox',
              email: 'koljoseph2020@gmail.com',
            };
            return {
              song: r,
              author: {
                id: author.id,
                nomeArtistico: author.nomeArtistico || author.nomeCompleto,
                email: author.email,
              },
            };
          }

          // Case 2: Joined playlist + user
          if ('playlist' in fields && 'user' in fields) {
            const user = _store.users?.find((u) => u.id === r.userId || u.id === r.user_id) || {
              id: r.userId || 1,
              nomeArtistico: 'Joseph Kolvox',
              email: 'koljoseph2020@gmail.com',
            };
            return {
              playlist: r,
              user: {
                id: user.id,
                nomeArtistico: user.nomeArtistico || user.nomeCompleto,
                email: user.email,
              },
            };
          }

          // Case 3: Joined subscription + user
          if ('subscription' in fields && 'user' in fields) {
            const user = _store.users?.find((u) => u.id === r.userId || u.id === r.user_id) || {
              id: r.userId || 1,
              nomeArtistico: 'Joseph Kolvox',
              email: 'koljoseph2020@gmail.com',
            };
            return {
              subscription: r,
              user: {
                id: user.id,
                nomeArtistico: user.nomeArtistico || user.nomeCompleto,
                email: user.email,
              },
            };
          }

          // Case 4: Joined payment + user
          if ('payment' in fields && 'user' in fields) {
            const user = _store.users?.find((u) => u.id === r.userId || u.id === r.user_id) || {
              id: r.userId || 1,
              nomeArtistico: 'Joseph Kolvox',
              email: 'koljoseph2020@gmail.com',
            };
            return {
              payment: r,
              user: {
                id: user.id,
                nomeArtistico: user.nomeArtistico || user.nomeCompleto,
                email: user.email,
              },
            };
          }

          // Case 5: Joined search + user
          if ('search' in fields && 'user' in fields) {
            const user = _store.users?.find((u) => u.id === r.userId || u.id === r.user_id) || {
              id: r.userId || 1,
              nomeArtistico: 'Joseph Kolvox',
              email: 'koljoseph2020@gmail.com',
            };
            return {
              search: r,
              user: {
                id: user.id,
                nomeArtistico: user.nomeArtistico || user.nomeCompleto,
                email: user.email,
              },
            };
          }

          return r;
        };

        const queryObj: any = {
          where: (condition: any) => {
            rows = rows.filter((r) => matchCondition(r, condition));
            return queryObj;
          },
          leftJoin: (_joinTable: any, _condition: any) => queryObj,
          innerJoin: (_joinTable: any, _condition: any) => queryObj,
          orderBy: () => queryObj,
          limit: (n: number) => {
            rows = rows.slice(0, n);
            return queryObj;
          },
          offset: (n: number) => {
            rows = rows.slice(n);
            return queryObj;
          },
          then: (resolve: (val: any[]) => void) => {
            resolve(rows.map(formatRow));
          },
        };
        return queryObj;
      },
    }),

    insert: (table: any) => ({
      values: (data: any) => {
        const tableName = getTableName(table) as keyof MemoryStoreData;
        if (!_store[tableName]) {
          _store[tableName] = [];
        }
        const items = Array.isArray(data) ? data : [data];
        const inserted: any[] = [];

        for (const item of items) {
          const now = new Date();
          const nextId = (_store[tableName].length > 0
            ? Math.max(..._store[tableName].map((r: any) => Number(r.id) || 0))
            : 0) + 1;

          const record = {
            id: item.id || nextId,
            ...item,
            createdAt: item.createdAt || now,
            updatedAt: item.updatedAt || now,
          };
          _store[tableName].push(record);
          inserted.push(record);
        }

        const queryObj: any = {
          returning: () => queryObj,
          onConflictDoUpdate: () => queryObj,
          onConflictDoNothing: () => queryObj,
          then: (resolve: (val: any[]) => void) => {
            resolve(inserted);
          },
        };
        return queryObj;
      },
    }),

    update: (table: any) => ({
      set: (updates: any) => {
        const tableName = getTableName(table) as keyof MemoryStoreData;
        let cond: any = null;

        const queryObj: any = {
          where: (condition: any) => {
            cond = condition;
            return queryObj;
          },
          returning: () => queryObj,
          then: (resolve: (val: any[]) => void) => {
            if (!_store[tableName]) {
              _store[tableName] = [];
            }
            const updatedRows: any[] = [];
            _store[tableName] = _store[tableName].map((row) => {
              if (matchCondition(row, cond)) {
                const updated = {
                  ...row,
                  ...updates,
                  updatedAt: new Date(),
                };
                updatedRows.push(updated);
                return updated;
              }
              return row;
            });
            resolve(updatedRows);
          },
        };
        return queryObj;
      },
    }),

    delete: (table: any) => {
      const tableName = getTableName(table) as keyof MemoryStoreData;
      let cond: any = null;

      const doDelete = () => {
        if (!_store[tableName]) {
          _store[tableName] = [];
        }
        const deleted: any[] = [];
        _store[tableName] = _store[tableName].filter((row) => {
          if (matchCondition(row, cond)) {
            deleted.push(row);
            return false;
          }
          return true;
        });
        return deleted;
      };

      const queryObj: any = {
        where: (condition: any) => {
          cond = condition;
          return queryObj;
        },
        returning: () => queryObj,
        then: (resolve: (val: any[]) => void) => {
          resolve(doDelete());
        },
      };
      return queryObj;
    },

    query: async () => ({ rows: [] }),
    execute: async () => ({ rows: [] }),
  };
}
