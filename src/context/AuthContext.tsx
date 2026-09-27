import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile } from '../types/kolvox';
import { logUserActivity } from '../services/DatabaseService';
import { recordClientActivity } from '../services/ActivityLogger';
import {
  getAllLocalUsers,
  saveLocalUser,
  getActiveLocalSession,
  setActiveLocalSession,
  hashPassword,
  StoredUserAccount,
  ADMIN_CREDENTIALS,
} from '../services/LocalAuthService';

export interface KolvoxUser {
  id: any;
  uid: string;
  email: string | null;
  displayName: string | null;
  nomeCompleto: string;
  nomeArtistico: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
  fotoPerfil?: string;
  tipoUsuario: 'USER' | 'ADMIN';
  role: 'user' | 'admin';
  status: 'ativo' | 'inativo' | 'pendente' | 'active';
  emailVerificado?: boolean;
  createdAt?: string;
  created_at?: string;
}

export interface AuthContextType {
  user: KolvoxUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  trialDaysLeft: number;
  trialHoursLeft: number;
  isPremiumActive: boolean;
  isTrialActive: boolean;
  isTrialExpired: boolean;
  token: string;
  subscription: any;
  login: (email: string, pass: string) => Promise<void>;
  loginWithGoogle?: () => Promise<void>;
  loginAsAdmin: () => Promise<void>;
  loginAsGuest: () => Promise<void>;
  register: (name: string, email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUserData: () => Promise<void>;
  activateProSubscription: (plan?: 'kolvox_pro_monthly' | 'kolvox_pro_yearly', refCode?: string) => Promise<void>;
  simulateExpireTrial: () => void;
  resetTrial7Days: () => void;
  grantCustomerAccess: (userId: string, planType?: string, days?: number) => Promise<void>;
}

function buildKolvoxUser(id: string, email: string | null, name: string | null, role: 'user' | 'admin', createdAtStr?: string): KolvoxUser {
  const cleanName = name || (email ? email.split('@')[0] : 'Vocalista KOLVOX');
  const storedPhone = localStorage.getItem('kolvox_user_phone_' + id) || '';
  const storedCity = localStorage.getItem('kolvox_user_city_' + id) || 'São Paulo';
  const storedState = localStorage.getItem('kolvox_user_state_' + id) || 'SP';
  const storedStage = localStorage.getItem('kolvox_setting_stage_name') || cleanName;
  const cTime = createdAtStr || localStorage.getItem('kolvox_user_created_' + id) || new Date().toISOString();
  try {
    localStorage.setItem('kolvox_user_created_' + id, cTime);
  } catch {
    // Ignore storage issues
  }

  return {
    id,
    uid: id,
    email: email || '',
    displayName: cleanName,
    nomeCompleto: cleanName,
    nomeArtistico: storedStage,
    telefone: storedPhone,
    cidade: storedCity,
    estado: storedState,
    tipoUsuario: role === 'admin' ? 'ADMIN' : 'USER',
    role,
    status: 'ativo',
    emailVerificado: true,
    createdAt: cTime,
    created_at: cTime,
  };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<KolvoxUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [subscription, setSubscription] = useState<any>(null);
  const [isPremiumActive, setIsPremiumActive] = useState<boolean>(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number>(7);
  const [trialHoursLeft, setTrialHoursLeft] = useState<number>(0);

  const calculateTrialAndSub = (currentUser: KolvoxUser | null) => {
    if (!currentUser) {
      setTrialDaysLeft(7);
      setTrialHoursLeft(0);
      setIsPremiumActive(false);
      setSubscription(null);
      return;
    }

    const isMasterAdmin =
      currentUser.role === 'admin' ||
      currentUser.email?.toLowerCase() === ADMIN_CREDENTIALS.email.toLowerCase();
    const savedSubRaw = localStorage.getItem('kolvox_sub_' + currentUser.uid);
    let activeSub = savedSubRaw ? JSON.parse(savedSubRaw) : null;

    if (isMasterAdmin) {
      setIsPremiumActive(true);
      setTrialDaysLeft(365);
      setTrialHoursLeft(24);
      setSubscription({
        id: 1,
        plan: 'kolvox_pro_admin',
        status: 'active',
        planType: 'KOLVOX Pro Vitalício (Admin)',
      });
      return;
    }

    if (activeSub && activeSub.isPremium) {
      setIsPremiumActive(true);
      setTrialDaysLeft(365);
      setTrialHoursLeft(24);
      setSubscription(activeSub);
      return;
    }

    // Check if trial was forcibly simulated as expired
    const forcedExpired = localStorage.getItem('kolvox_trial_override_' + currentUser.uid) === 'expired';

    // Check guest trial start or user creation time
    let regTimeStr = currentUser.createdAt || currentUser.created_at;
    if (currentUser.uid.startsWith('guest')) {
      const storedGuestStart = localStorage.getItem('kolvox_guest_trial_start');
      if (storedGuestStart) {
        regTimeStr = storedGuestStart;
      } else {
        const nowIso = new Date().toISOString();
        localStorage.setItem('kolvox_guest_trial_start', nowIso);
        regTimeStr = nowIso;
      }
    }

    const extendedDays = Number(localStorage.getItem('kolvox_trial_extended_' + currentUser.uid) || '0');
    const totalTrialDays = 7 + extendedDays;

    const regTime = new Date(regTimeStr || Date.now()).getTime();
    const nowTime = Date.now();
    const totalTrialDurationMs = totalTrialDays * 24 * 60 * 60 * 1000;
    const timePassedMs = nowTime - regTime;
    const msRemaining = totalTrialDurationMs - timePassedMs;

    let daysLeft = 0;
    let hoursLeft = 0;

    if (!forcedExpired && msRemaining > 0) {
      daysLeft = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
      hoursLeft = Math.floor((msRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    }

    setTrialDaysLeft(daysLeft);
    setTrialHoursLeft(hoursLeft);
    setIsPremiumActive(false);

    const isStillActive = !forcedExpired && (daysLeft > 0 || hoursLeft > 0);

    setSubscription({
      id: 99,
      plan: 'trial_7d',
      status: isStillActive ? 'trial' : 'expired',
      planType: 'Teste Gratuito de 7 Dias',
      trialDaysRemaining: daysLeft,
      trialHoursRemaining: hoursLeft,
    });
  };

  useEffect(() => {
    calculateTrialAndSub(user);
  }, [user]);

  // Initialize admin account if not already in local database
  useEffect(() => {
    (async () => {
      const users = getAllLocalUsers();
      const adminExists = users.some(u => u.email.toLowerCase() === ADMIN_CREDENTIALS.email.toLowerCase());
      if (!adminExists) {
        const hash = await hashPassword(ADMIN_CREDENTIALS.passwordPlain);
        const adminAcc: StoredUserAccount = {
          id: 'admin_kolvox_master',
          name: ADMIN_CREDENTIALS.name,
          email: ADMIN_CREDENTIALS.email,
          passwordHash: hash,
          role: 'admin',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        saveLocalUser(adminAcc);
      }
    })();
  }, []);

  useEffect(() => {
    // 1. Check local session
    const localSession = getActiveLocalSession();
    if (localSession) {
      setUser(buildKolvoxUser(localSession.id, localSession.email, localSession.name, localSession.role, localSession.created_at));
      setUserProfile({
        id: localSession.id,
        name: localSession.name,
        email: localSession.email,
        role: localSession.role,
        status: (localSession.status === 'blocked' || localSession.status === 'inativo') ? 'inactive' : 'active',
        created_at: localSession.created_at,
        updated_at: localSession.updated_at,
      });
      setLoading(false);
    }

    // 2. Firebase Auth sync
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const isMasterAdmin = firebaseUser.email?.toLowerCase() === ADMIN_CREDENTIALS.email.toLowerCase();
        setUser(buildKolvoxUser(firebaseUser.uid, firebaseUser.email, firebaseUser.displayName, isMasterAdmin ? 'admin' : 'user'));

        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setUserProfile(userDoc.data() as UserProfile);
          } else {
            const newProf: UserProfile = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || (isMasterAdmin ? ADMIN_CREDENTIALS.name : 'Vocalista'),
              email: firebaseUser.email || '',
              role: isMasterAdmin ? 'admin' : 'user',
              status: 'active',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            try {
              await setDoc(userDocRef, newProf);
            } catch (e) {
              console.warn('SetDoc fallback', e);
            }
            setUserProfile(newProf);
          }
        } catch (err) {
          console.error('Error fetching user profile:', err);
        }
      } else if (!getActiveLocalSession()) {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const isMasterAdmin = cleanEmail === ADMIN_CREDENTIALS.email.toLowerCase();
    const pwdHash = await hashPassword(pass);

    // Check predefined Admin login
    if (isMasterAdmin) {
      if (pass === ADMIN_CREDENTIALS.passwordPlain) {
        const adminAcc: StoredUserAccount = {
          id: 'admin_kolvox_master',
          name: ADMIN_CREDENTIALS.name,
          email: ADMIN_CREDENTIALS.email,
          passwordHash: pwdHash,
          role: 'admin',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        saveLocalUser(adminAcc);
        setActiveLocalSession(adminAcc);
        setUser(buildKolvoxUser(adminAcc.id, adminAcc.email, adminAcc.name, 'admin', adminAcc.created_at));
        setUserProfile({
          id: adminAcc.id,
          name: adminAcc.name,
          email: adminAcc.email,
          role: 'admin',
          status: 'active',
          created_at: adminAcc.created_at,
          updated_at: adminAcc.updated_at,
        });
        return;
      } else {
        throw new Error('Senha incorreta para a conta Administrador.');
      }
    }

    // Try Firebase Authentication
    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      const fbUser = cred.user;
      const cleanName = fbUser.displayName || cleanEmail.split('@')[0] || 'Vocalista';
      const kolvoxUser = buildKolvoxUser(fbUser.uid, fbUser.email, cleanName, 'user');
      setUser(kolvoxUser);

      // Load profile from Firestore
      let prof: UserProfile = {
        id: fbUser.uid,
        name: cleanName,
        email: cleanEmail,
        role: 'user',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      try {
        const userDocRef = doc(db, 'users', fbUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          prof = userDoc.data() as UserProfile;
        } else {
          await setDoc(userDocRef, prof);
        }
      } catch (fsErr) {
        console.warn('Firestore profile sync warning:', fsErr);
      }
      setUserProfile(prof);

      // Cache session locally for instant offline/reload access
      const localAcc: StoredUserAccount = {
        id: fbUser.uid,
        name: cleanName,
        email: cleanEmail,
        passwordHash: pwdHash,
        role: 'user',
        status: 'active',
        created_at: prof.created_at,
        updated_at: new Date().toISOString(),
      };
      saveLocalUser(localAcc);
      setActiveLocalSession(localAcc);

      try {
        await logUserActivity(cred.user.uid, 'USER_LOGIN', `Login real com ${cleanEmail}`);
      } catch (e) {
        console.warn('logUserActivity error:', e);
      }

      recordClientActivity({
        userId: fbUser.uid,
        userEmail: cleanEmail,
        userName: cleanName,
        actionType: 'LOGIN',
        action: 'Login com Sucesso',
        details: `Cliente acessou com conta real de e-mail (${cleanEmail}).`,
      });
      return;
    } catch (fbErr: any) {
      console.warn('Firebase login attempt fallback to local:', fbErr.code);
      if (fbErr.code === 'auth/wrong-password' || fbErr.code === 'auth/invalid-credential') {
        // Also check if local user exists with that password before throwing
        const localUsers = getAllLocalUsers();
        const found = localUsers.find((u) => u.email.toLowerCase() === cleanEmail);
        if (found && found.passwordHash === pwdHash) {
          // Allow local match
        } else {
          throw new Error('Senha incorreta. Verifique suas credenciais e tente novamente.');
        }
      }
      if (fbErr.code === 'auth/invalid-email') {
        throw new Error('Formato de e-mail inválido.');
      }
      if (fbErr.code === 'auth/too-many-requests') {
        throw new Error('Muitas tentativas sem sucesso. Aguarde alguns instantes e tente novamente.');
      }
    }

    // Local Verification fallback
    const localUsers = getAllLocalUsers();
    const found = localUsers.find((u) => u.email.toLowerCase() === cleanEmail);

    if (found) {
      if (found.passwordHash === pwdHash) {
        setActiveLocalSession(found);
        const kolvoxUser = buildKolvoxUser(found.id, found.email, found.name, found.role, found.created_at);
        setUser(kolvoxUser);
        setUserProfile({
          id: found.id,
          name: found.name,
          email: found.email,
          role: found.role,
          status: (found.status === 'blocked' || found.status === 'inativo') ? 'inactive' : 'active',
          created_at: found.created_at,
          updated_at: found.updated_at,
        });

        recordClientActivity({
          userId: found.id,
          userEmail: found.email,
          userName: found.name,
          actionType: 'LOGIN',
          action: 'Login no Sistema',
          details: `Cliente acessou a conta com sucesso via autenticação por e-mail (${found.email}).`,
        });
        return;
      } else {
        throw new Error('Senha incorreta. Verifique suas credenciais.');
      }
    }

    throw new Error('E-mail não encontrado. Crie sua conta para começar seus 7 dias gratuitos!');
  };

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      const cleanEmail = cred.user.email?.trim().toLowerCase() || '';
      const isMasterAdmin = cleanEmail === ADMIN_CREDENTIALS.email.toLowerCase();
      const displayName = cred.user.displayName || cleanEmail.split('@')[0] || 'Vocalista';

      let userProfileData: UserProfile = {
        id: cred.user.uid,
        name: displayName,
        email: cleanEmail,
        role: isMasterAdmin ? 'admin' : 'user',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      try {
        const userDocRef = doc(db, 'users', cred.user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          userProfileData = userDoc.data() as UserProfile;
        } else {
          await setDoc(userDocRef, userProfileData);
        }
      } catch (fsErr) {
        console.warn('Google sign-in firestore sync warning:', fsErr);
      }

      const kolvoxUser = buildKolvoxUser(cred.user.uid, cleanEmail, displayName, isMasterAdmin ? 'admin' : 'user');
      setUser(kolvoxUser);
      setUserProfile(userProfileData);

      const localAcc: StoredUserAccount = {
        id: cred.user.uid,
        name: displayName,
        email: cleanEmail,
        passwordHash: 'google_oauth_session',
        role: isMasterAdmin ? 'admin' : 'user',
        status: 'active',
        created_at: userProfileData.created_at,
        updated_at: new Date().toISOString(),
      };
      saveLocalUser(localAcc);
      setActiveLocalSession(localAcc);

      recordClientActivity({
        userId: cred.user.uid,
        userEmail: cleanEmail,
        userName: displayName,
        actionType: 'LOGIN',
        action: 'Login com Google',
        details: `Cliente acessou via Google OAuth com a conta ${cleanEmail}.`,
      });
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        throw new Error('Janela do Google fechada antes da confirmação.');
      }
      if (err.code === 'auth/popup-blocked') {
        throw new Error('O navegador bloqueou a janela pop-up do Google. Permita pop-ups ou entre com e-mail e senha.');
      }
      throw new Error(err.message || 'Erro ao autenticar com o Google.');
    }
  };

  const loginAsAdmin = async () => {
    await login(ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.passwordPlain);
  };

  const loginAsGuest = async () => {
    const guestId = 'guest_vocalist_principal';
    let guestTrialStart = localStorage.getItem('kolvox_guest_trial_start');
    if (!guestTrialStart) {
      guestTrialStart = new Date().toISOString();
      localStorage.setItem('kolvox_guest_trial_start', guestTrialStart);
    }

    const guestAcc: StoredUserAccount = {
      id: guestId,
      name: 'Vocalista Convidado',
      email: 'demo@kolvox.app',
      passwordHash: 'guest_mode',
      role: 'user',
      status: 'active',
      created_at: guestTrialStart,
      updated_at: new Date().toISOString(),
    };
    saveLocalUser(guestAcc);
    setActiveLocalSession(guestAcc);
    const guestUser = buildKolvoxUser(guestAcc.id, guestAcc.email, guestAcc.name, 'user', guestTrialStart);
    setUser(guestUser);
    setUserProfile({
      id: guestAcc.id,
      name: guestAcc.name,
      email: guestAcc.email,
      role: 'user',
      status: 'active',
      created_at: guestTrialStart,
      updated_at: guestAcc.updated_at,
    });

    recordClientActivity({
      userId: guestId,
      userEmail: 'demo@kolvox.app',
      userName: 'Vocalista Convidado',
      actionType: 'LOGIN',
      action: 'Login Convidado (Modo Degustação)',
      details: 'Cliente acessou como Vocalista Convidado. Período de teste gratuito de 7 dias verificado.',
    });
  };

  const register = async (name: string, email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const pwdHash = await hashPassword(pass);

    if (cleanEmail === ADMIN_CREDENTIALS.email.toLowerCase()) {
      throw new Error('Este e-mail é reservado para a conta de Administrador. Use a opção de Login ADM.');
    }

    const localUsers = getAllLocalUsers();
    if (localUsers.some((u) => u.email.toLowerCase() === cleanEmail)) {
      throw new Error('Este e-mail já está cadastrado no KOLVOX. Faça login na sua conta.');
    }

    let uid = 'usr_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);

    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      uid = cred.user.uid;
      try {
        await updateProfile(cred.user, { displayName: cleanName });
      } catch (pErr) {
        console.warn('Profile update warning:', pErr);
      }
    } catch (fbErr: any) {
      console.warn('Firebase registration fallback:', fbErr.code);
      if (fbErr.code === 'auth/email-already-in-use') {
        throw new Error('Este e-mail já está cadastrado no KOLVOX. Faça login.');
      }
      if (fbErr.code === 'auth/invalid-email') {
        throw new Error('Formato de e-mail inválido.');
      }
      if (fbErr.code === 'auth/weak-password') {
        throw new Error('A senha deve conter no mínimo 6 caracteres.');
      }
    }

    const now = new Date().toISOString();
    const newAccount: StoredUserAccount = {
      id: uid,
      name: cleanName,
      email: cleanEmail,
      passwordHash: pwdHash,
      role: 'user',
      status: 'active',
      created_at: now,
      updated_at: now,
    };

    saveLocalUser(newAccount);
    setActiveLocalSession(newAccount);

    const newProf: UserProfile = {
      id: uid,
      name: cleanName,
      email: cleanEmail,
      role: 'user',
      status: 'active',
      created_at: now,
      updated_at: now,
    };

    try {
      await setDoc(doc(db, 'users', uid), newProf);
    } catch (fsErr) {
      console.warn('Firestore setDoc user profile warning:', fsErr);
    }

    setUser(buildKolvoxUser(uid, cleanEmail, cleanName, 'user', now));
    setUserProfile(newProf);

    try {
      await logUserActivity(uid, 'ACCOUNT_CREATED', `Conta de cliente criada para ${cleanName}`);
    } catch (logErr) {
      console.warn('logUserActivity warning:', logErr);
    }
  };

  const logout = async () => {
    if (user) {
      recordClientActivity({
        userId: user.uid,
        userEmail: user.email || 'demo@kolvox.app',
        userName: user.nomeArtistico || user.nomeCompleto || 'Vocalista',
        actionType: 'LOGOUT',
        action: 'Logout da Conta',
        details: 'Cliente encerrou a sessão no aplicativo.',
      });
    }

    setActiveLocalSession(null);
    setUser(null);
    setUserProfile(null);
    try {
      localStorage.removeItem('kolvox_token');
    } catch {}
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Firebase signOut error:', e);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (e) {
      console.warn('Firebase password reset email error:', e);
    }
  };

  const refreshUserData = async () => {
    if (user) {
      calculateTrialAndSub(user);
    }
  };

  const activateProSubscription = async (plan: 'kolvox_pro_monthly' | 'kolvox_pro_yearly' = 'kolvox_pro_monthly', refCode?: string) => {
    if (!user) return;
    const planName = plan === 'kolvox_pro_yearly' ? 'Plano Anual (R$ 99,99/ano)' : 'Plano Mensal (R$ 9,99/mês)';
    const subData = {
      id: Date.now(),
      isPremium: true,
      plan,
      planType: planName,
      status: 'active',
      referenceCode: refCode || `PIX-${Date.now().toString().slice(-6)}`,
      activatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem('kolvox_sub_' + user.uid, JSON.stringify(subData));
    } catch {
      // Ignore storage errors
    }
    setIsPremiumActive(true);
    setTrialDaysLeft(365);
    setTrialHoursLeft(24);
    setSubscription(subData);

    recordClientActivity({
      userId: user.uid,
      userEmail: user.email || 'demo@kolvox.app',
      userName: user.nomeArtistico || user.nomeCompleto || 'Vocalista Convidado',
      actionType: 'PAYMENT',
      action: 'Assinatura PRO Ativada',
      details: `Pagamento reconhecido via Pix (${subData.referenceCode}). Acesso ilimitado liberado para ${planName}.`,
    });
  };

  const simulateExpireTrial = () => {
    if (!user) return;
    localStorage.setItem('kolvox_trial_override_' + user.uid, 'expired');
    if (user.uid.startsWith('guest')) {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      localStorage.setItem('kolvox_guest_trial_start', eightDaysAgo);
    }
    calculateTrialAndSub(user);

    recordClientActivity({
      userId: user.uid,
      userEmail: user.email || 'demo@kolvox.app',
      userName: user.nomeArtistico || user.nomeCompleto || 'Vocalista Convidado',
      actionType: 'TRIAL',
      action: 'Simulação de Expiração do Teste de 7 Dias',
      details: 'Período de teste de 7 dias expirado intencionalmente para teste do bloqueio de acesso.',
    });
  };

  const resetTrial7Days = () => {
    if (!user) return;
    localStorage.removeItem('kolvox_trial_override_' + user.uid);
    localStorage.removeItem('kolvox_trial_extended_' + user.uid);
    if (user.uid.startsWith('guest')) {
      localStorage.setItem('kolvox_guest_trial_start', new Date().toISOString());
    }
    calculateTrialAndSub(user);

    recordClientActivity({
      userId: user.uid,
      userEmail: user.email || 'demo@kolvox.app',
      userName: user.nomeArtistico || user.nomeCompleto || 'Vocalista Convidado',
      actionType: 'TRIAL',
      action: 'Renovação do Teste de 7 Dias',
      details: 'Contador de 7 dias de teste reiniciado com sucesso.',
    });
  };

  const grantCustomerAccess = async (targetUserId: string, planType: string = 'kolvox_pro_yearly', days: number = 365) => {
    const subData = {
      id: Date.now(),
      isPremium: true,
      plan: planType,
      planType: planType === 'kolvox_pro_yearly' ? 'Plano Anual (R$ 99,99/ano)' : 'Plano Mensal (R$ 9,99/mês)',
      status: 'active',
      referenceCode: `ADM-LIB-${Date.now().toString().slice(-6)}`,
      activatedAt: new Date().toISOString(),
      grantedByAdmin: true,
    };
    try {
      localStorage.setItem('kolvox_sub_' + targetUserId, JSON.stringify(subData));
      localStorage.removeItem('kolvox_trial_override_' + targetUserId);
    } catch {}

    if (user && user.uid === targetUserId) {
      setIsPremiumActive(true);
      setTrialDaysLeft(days);
      setTrialHoursLeft(24);
      setSubscription(subData);
    }

    recordClientActivity({
      userId: targetUserId,
      userEmail: targetUserId === 'guest_vocalist_principal' ? 'demo@kolvox.app' : 'cliente@kolvox.app',
      userName: targetUserId === 'guest_vocalist_principal' ? 'Vocalista Convidado' : `Cliente #${targetUserId}`,
      actionType: 'PAYMENT',
      action: 'Acesso Liberado pelo Administrador',
      details: `O administrador confirmou o reconhecimento do pagamento e liberou o plano ${subData.planType} para o cliente.`,
    });
  };

  const isAdmin = Boolean(
    userProfile?.role === 'admin' ||
    user?.email?.toLowerCase() === ADMIN_CREDENTIALS.email.toLowerCase() ||
    user?.role === 'admin' ||
    (user as any)?.tipoUsuario === 'ADMIN'
  );
  const token = isAdmin
    ? 'kolvox_master_token_admin'
    : user
    ? `kolvox_account:${encodeURIComponent((user.email || user.uid || '').toLowerCase().trim())}:${encodeURIComponent(user.uid)}:${user.role || 'user'}`
    : '';

  useEffect(() => {
    try {
      if (token) {
        localStorage.setItem('kolvox_token', token);
      } else {
        localStorage.removeItem('kolvox_token');
      }
    } catch {}
  }, [token]);
  const isTrialActive = !isPremiumActive && (trialDaysLeft > 0 || trialHoursLeft > 0);
  const isTrialExpired = !isPremiumActive && trialDaysLeft <= 0 && trialHoursLeft <= 0;

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        isAdmin,
        trialDaysLeft,
        trialHoursLeft,
        isPremiumActive,
        isTrialActive,
        isTrialExpired,
        token,
        subscription,
        login,
        loginWithGoogle,
        loginAsAdmin,
        loginAsGuest,
        register,
        logout,
        resetPassword,
        refreshUserData,
        activateProSubscription,
        simulateExpireTrial,
        resetTrial7Days,
        grantCustomerAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
