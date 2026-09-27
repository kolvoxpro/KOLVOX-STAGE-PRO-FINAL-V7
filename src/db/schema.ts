import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  nomeCompleto: text('nome_completo').notNull(),
  nomeArtistico: text('nome_artistico').notNull(),
  email: text('email').notNull().unique(),
  senhaHash: text('senha_hash').notNull(),
  telefone: text('telefone'),
  cidade: text('cidade'),
  estado: text('estado'),
  fotoPerfil: text('foto_perfil'),
  tipoUsuario: text('tipo_usuario').default('USER').notNull(), // USER, ADMIN
  status: text('status').default('ativo').notNull(), // ativo, inativo, pendente
  emailVerificado: boolean('email_verificado').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const songs = pgTable('songs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  title: text('title').notNull(),
  artist: text('artist').notNull(),
  album: text('album'),
  genre: text('genre'),
  key: text('key'),
  capo: integer('capo').default(0),
  lyrics: text('lyrics'),
  chords: text('chords'),
  tabs: text('tabs'),
  sheetMusic: text('sheet_music'),
  sourceProvider: text('source_provider').default('user_created'),
  sourceUrl: text('source_url'),
  licenseType: text('license_type').default('user_owned'),
  downloadAllowed: boolean('download_allowed').default(true),
  printAllowed: boolean('print_allowed').default(true),
  bpm: integer('bpm').default(120),
  duration: text('duration'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const playlists = pgTable('playlists', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const playlistSongs = pgTable('playlist_songs', {
  id: serial('id').primaryKey(),
  playlistId: integer('playlist_id').references(() => playlists.id, { onDelete: 'cascade' }).notNull(),
  songId: integer('song_id').references(() => songs.id, { onDelete: 'cascade' }).notNull(),
  position: integer('position').default(0).notNull(),
});

export const favorites = pgTable('favorites', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  songId: integer('song_id').references(() => songs.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const searchHistory = pgTable('search_history', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  searchTerm: text('search_term').notNull(),
  songId: integer('song_id'),
  provider: text('provider').default('internal'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const songSources = pgTable('song_sources', {
  id: serial('id').primaryKey(),
  songId: integer('song_id').references(() => songs.id, { onDelete: 'cascade' }).notNull(),
  provider: text('provider').notNull(),
  sourceUrl: text('source_url').notNull(),
  licenseType: text('license_type'),
  copyrightStatus: text('copyright_status'),
  displayAllowed: boolean('display_allowed').default(true),
  downloadAllowed: boolean('download_allowed').default(true),
  printAllowed: boolean('print_allowed').default(true),
});

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  plan: text('plan').notNull(), // 'trial_7d', 'kolvox_pro_monthly', 'kolvox_pro_yearly'
  status: text('status').notNull(), // 'trial', 'active', 'canceled', 'expired'
  trialStart: timestamp('trial_start'),
  trialEnd: timestamp('trial_end'),
  trialUsed: boolean('trial_used').default(true),
  subscriptionStart: timestamp('subscription_start'),
  subscriptionEnd: timestamp('subscription_end'),
  paymentProvider: text('payment_provider'),
  customerId: text('customer_id'),
  subscriptionId: text('subscription_id'),
  paymentId: text('payment_id'),
  amount: text('amount'),
  currency: text('currency').default('BRL'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  subscriptionId: integer('subscription_id'),
  provider: text('provider').notNull(),
  externalPaymentId: text('external_payment_id'),
  amount: text('amount').notNull(),
  currency: text('currency').default('BRL').notNull(),
  status: text('status').notNull(), // 'completed', 'pending', 'refunded', 'rejected'
  referenceCode: text('reference_code'),
  proofNote: text('proof_note'),
  payerName: text('payer_name'),
  paymentDate: timestamp('payment_date').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const appSettings = pgTable('app_settings', {
  id: serial('id').primaryKey(),
  pixKey: text('pix_key').default('kolvox.pagamentos@gmail.com').notNull(),
  pixKeyType: text('pix_key_type').default('E-mail').notNull(), // 'E-mail' | 'CPF' | 'CNPJ' | 'Telefone' | 'Chave aleatória'
  pixReceiverName: text('pix_receiver_name').default('KOLVOX TECNOLOGIA LTDA').notNull(),
  pixCity: text('pix_city').default('SAO PAULO').notNull(),
  supportEmail: text('support_email').default('kolvox.pagamentos@gmail.com').notNull(),
  monthlyPrice: text('monthly_price').default('9.99').notNull(),
  trialDays: integer('trial_days').default(7).notNull(),
  pixEnabled: boolean('pix_enabled').default(true).notNull(),
  manualPaymentEnabled: boolean('manual_payment_enabled').default(true).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  updatedBy: integer('updated_by').references(() => users.id),
});

export const gmailIntegrations = pgTable('gmail_integrations', {
  id: serial('id').primaryKey(),
  adminUserId: integer('admin_user_id').references(() => users.id),
  googleAccountEmail: text('google_account_email'),
  googleUserId: text('google_user_id'),
  accessTokenEncrypted: text('access_token_encrypted'),
  refreshTokenEncrypted: text('refresh_token_encrypted'),
  tokenExpiry: timestamp('token_expiry'),
  status: text('status').default('disconnected').notNull(), // 'connected' | 'disconnected'
  lastSyncAt: timestamp('last_sync_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const supportTickets = pgTable('support_tickets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: text('status').default('open').notNull(), // 'open' | 'pending' | 'answered' | 'closed'
  adminNotes: text('admin_notes'),
  replyMessage: text('reply_message'),
  replySentAt: timestamp('reply_sent_at'),
  gmailThreadId: text('gmail_thread_id'),
  gmailMessageId: text('gmail_message_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'),
  action: text('action').notNull(),
  ip: text('ip'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  songs: many(songs),
  playlists: many(playlists),
  favorites: many(favorites),
  subscriptions: many(subscriptions),
  payments: many(payments),
}));

export const songsRelations = relations(songs, ({ one, many }) => ({
  author: one(users, {
    fields: [songs.userId],
    references: [users.id],
  }),
  playlistSongs: many(playlistSongs),
  favorites: many(favorites),
  sources: many(songSources),
}));

export const playlistsRelations = relations(playlists, ({ one, many }) => ({
  owner: one(users, {
    fields: [playlists.userId],
    references: [users.id],
  }),
  songs: many(playlistSongs),
}));

export const playlistSongsRelations = relations(playlistSongs, ({ one }) => ({
  playlist: one(playlists, {
    fields: [playlistSongs.playlistId],
    references: [playlists.id],
  }),
  song: one(songs, {
    fields: [playlistSongs.songId],
    references: [songs.id],
  }),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, {
    fields: [favorites.userId],
    references: [users.id],
  }),
  song: one(songs, {
    fields: [favorites.songId],
    references: [songs.id],
  }),
}));
