import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { guestAccessService } from '../services/guestAccessService';
import { guestUserService } from '../services/guestUserService';
import { GuestAccess, GuestUser, Project } from '../types';

interface GuestAuthContextType {
  guestAccess: GuestAccess | null;
  guestUser: GuestUser | null;
  project: Project | null;
  isGuest: boolean;
  isLoading: boolean;
  canApprove: boolean;
  canComment: boolean;
  registerGuest: (name: string, email: string, phone?: string) => Promise<void>;
  logout: () => void;
}

const GuestAuthContext = createContext<GuestAuthContextType | undefined>(undefined);

export const useGuestAuth = () => {
  const context = useContext(GuestAuthContext);
  if (!context) {
    throw new Error('useGuestAuth must be used within GuestAuthProvider');
  }
  return context;
};

interface GuestAuthProviderProps {
  children: ReactNode;
  token?: string;
}

export const GuestAuthProvider: React.FC<GuestAuthProviderProps> = ({ children, token }) => {
  const [guestAccess, setGuestAccess] = useState<GuestAccess | null>(null);
  const [guestUser, setGuestUser] = useState<GuestUser | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      initializeGuestSession(token);
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const initializeGuestSession = async (accessToken: string) => {
    try {
      setIsLoading(true);

      const access = await guestAccessService.validateGuestToken(accessToken);
      if (!access) {
        console.error('Invalid or inactive guest token');
        setIsLoading(false);
        return;
      }

      console.log('Guest access validated:', access);
      setGuestAccess(access);

      const projectData = await guestAccessService.getProjectByToken(accessToken);
      console.log('Project loaded for guest:', projectData?.name, projectData?.id);
      if (projectData) {
        setProject(projectData);
      }

      const savedGuestEmail = localStorage.getItem(`guest_email_${accessToken}`);
      if (savedGuestEmail) {
        const user = await guestUserService.getGuestByEmail(savedGuestEmail);
        if (user) {
          setGuestUser(user);
          await guestUserService.trackGuestActivity(user.id);
        }
      }
    } catch (error) {
      console.error('Error initializing guest session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const registerGuest = async (name: string, email: string, phone?: string) => {
    if (!guestAccess || !project) {
      throw new Error('No active guest session');
    }

    try {
      const newGuest = await guestUserService.quickRegisterGuest(name, email, phone);

      await guestUserService.linkGuestToProject(
        newGuest.id,
        project.id,
        guestAccess.id
      );

      setGuestUser(newGuest);

      if (token) {
        localStorage.setItem(`guest_email_${token}`, email);
      }
    } catch (error) {
      console.error('Error registering guest:', error);
      throw error;
    }
  };

  const logout = () => {
    if (token) {
      localStorage.removeItem(`guest_email_${token}`);
    }
    setGuestUser(null);
    setGuestAccess(null);
    setProject(null);
  };

  const isGuest = !!guestAccess;
  const canApprove = guestAccess && guestUser ? guestAccessService.hasPermission(guestAccess, 'approveContent') : false;
  const canComment = guestAccess && guestUser ? guestAccessService.hasPermission(guestAccess, 'addComments') : false;

  const value: GuestAuthContextType = {
    guestAccess,
    guestUser,
    project,
    isGuest,
    isLoading,
    canApprove,
    canComment,
    registerGuest,
    logout,
  };

  return (
    <GuestAuthContext.Provider value={value}>
      {children}
    </GuestAuthContext.Provider>
  );
};