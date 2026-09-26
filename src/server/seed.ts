import bcrypt from 'bcryptjs';
import { db } from '../db/index.ts';
import * as schema from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import { MusicSearchProvider } from './providers/MusicSearchProvider.ts';

export async function seedDatabase() {
  try {
    // 0. Always ensure the primary requested Admin user exists with exact credentials:
    // Email: koljoseph2020@gmail.com / koljoseph2020@gmail
    // Password: 28k28k28k
    const primaryAdminEmail = 'koljoseph2020@gmail.com';
    const primaryAdminHash = await bcrypt.hash('28k28k28k', 10);
    const [foundAdmin] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, primaryAdminEmail))
      .limit(1);

    let mainAdminId: number;

    if (!foundAdmin) {
      const [newAdmin] = await db
        .insert(schema.users)
        .values({
          nomeCompleto: 'Joseph Kolvox (Admin)',
          nomeArtistico: 'Admin Joseph',
          email: primaryAdminEmail,
          senhaHash: primaryAdminHash,
          telefone: '(11) 99999-2828',
          cidade: 'São Paulo',
          estado: 'SP',
          tipoUsuario: 'ADMIN',
          status: 'ativo',
          emailVerificado: true,
        })
        .returning();
      mainAdminId = newAdmin.id;

      const now = new Date();
      const yearEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      await db.insert(schema.subscriptions).values({
        userId: newAdmin.id,
        plan: 'kolvox_pro_admin',
        status: 'active',
        subscriptionStart: now,
        subscriptionEnd: yearEnd,
        paymentProvider: 'sistema',
        amount: '0.00',
        currency: 'BRL',
      });
      console.log('Primary Admin user koljoseph2020@gmail.com created successfully.');
    } else {
      mainAdminId = foundAdmin.id;
      // Ensure password hash is updated to 28k28k28k and role is ADMIN
      await db
        .update(schema.users)
        .set({
          senhaHash: primaryAdminHash,
          tipoUsuario: 'ADMIN',
          status: 'ativo',
        })
        .where(eq(schema.users.id, foundAdmin.id));
      console.log('Primary Admin user koljoseph2020@gmail.com updated with latest credentials.');
    }

    // Clean up any automatically inserted/catalog songs so only client-added songs remain
    try {
      await db.delete(schema.songs).where(eq(schema.songs.sourceProvider, 'kolvox_catalog'));
    } catch (e) {
      // ignore
    }

    // Zero fake accounts or fake support: only real admin and real client accounts exist
    console.log('Seed: No fake users or mock tickets created. Only real customer accounts permitted.');
  } catch (error) {
    console.error('Error during database seed:', error);
  }
}
