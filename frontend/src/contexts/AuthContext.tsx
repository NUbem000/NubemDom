'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  Auth, 
  User, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { toast } from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (data: { displayName?: string; photoURL?: string }) => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string): Promise<void> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('¡Bienvenido de vuelta!');
    } catch (error: any) {
      console.error('Sign in error:', error);
      
      let message = 'Error al iniciar sesión';
      
      switch (error.code) {
        case 'auth/user-not-found':
          message = 'No existe una cuenta con este email';
          break;
        case 'auth/wrong-password':
          message = 'Contraseña incorrecta';
          break;
        case 'auth/invalid-email':
          message = 'Email inválido';
          break;
        case 'auth/user-disabled':
          message = 'Esta cuenta ha sido deshabilitada';
          break;
        case 'auth/too-many-requests':
          message = 'Demasiados intentos. Intenta más tarde';
          break;
        default:
          message = error.message || 'Error al iniciar sesión';
      }
      
      toast.error(message);
      throw new Error(message);
    }
  };

  const signUp = async (email: string, password: string, displayName: string): Promise<void> => {
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update display name
      await updateProfile(user, { displayName });
      
      toast.success('¡Cuenta creada exitosamente!');
    } catch (error: any) {
      console.error('Sign up error:', error);
      
      let message = 'Error al crear la cuenta';
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          message = 'Ya existe una cuenta con este email';
          break;
        case 'auth/invalid-email':
          message = 'Email inválido';
          break;
        case 'auth/weak-password':
          message = 'La contraseña debe tener al menos 6 caracteres';
          break;
        case 'auth/operation-not-allowed':
          message = 'Registro no permitido';
          break;
        default:
          message = error.message || 'Error al crear la cuenta';
      }
      
      toast.error(message);
      throw new Error(message);
    }
  };

  const signInWithGoogle = async (): Promise<void> => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      
      await signInWithPopup(auth, provider);
      toast.success('¡Bienvenido!');
    } catch (error: any) {
      console.error('Google sign in error:', error);
      
      let message = 'Error al iniciar sesión con Google';
      
      switch (error.code) {
        case 'auth/account-exists-with-different-credential':
          message = 'Ya existe una cuenta con este email usando otro método';
          break;
        case 'auth/popup-closed-by-user':
          message = 'Proceso cancelado';
          break;
        case 'auth/popup-blocked':
          message = 'Popup bloqueado por el navegador';
          break;
        default:
          message = error.message || 'Error al iniciar sesión con Google';
      }
      
      toast.error(message);
      throw new Error(message);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await signOut(auth);
      toast.success('Sesión cerrada');
    } catch (error: any) {
      console.error('Logout error:', error);
      toast.error('Error al cerrar sesión');
      throw new Error('Error al cerrar sesión');
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Email de recuperación enviado');
    } catch (error: any) {
      console.error('Reset password error:', error);
      
      let message = 'Error al enviar email de recuperación';
      
      switch (error.code) {
        case 'auth/user-not-found':
          message = 'No existe una cuenta con este email';
          break;
        case 'auth/invalid-email':
          message = 'Email inválido';
          break;
        default:
          message = error.message || 'Error al enviar email de recuperación';
      }
      
      toast.error(message);
      throw new Error(message);
    }
  };

  const updateUserProfile = async (data: { displayName?: string; photoURL?: string }): Promise<void> => {
    try {
      if (!user) throw new Error('No user logged in');
      
      await updateProfile(user, data);
      toast.success('Perfil actualizado');
    } catch (error: any) {
      console.error('Update profile error:', error);
      toast.error('Error al actualizar perfil');
      throw new Error('Error al actualizar perfil');
    }
  };

  const getIdToken = async (): Promise<string | null> => {
    try {
      if (!user) return null;
      return await user.getIdToken();
    } catch (error) {
      console.error('Get ID token error:', error);
      return null;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    logout,
    resetPassword,
    updateUserProfile,
    getIdToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};