import React, { useState, useEffect, useCallback, Suspense, lazy, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'react-qr-code';
import { Users, Sparkles, MapPin, ExternalLink, QrCode, ChevronRight, ChevronDown, Edit, Calendar, Clock, Plus, ScanLine, Filter, Download, Mail, Send, CheckCircle, XCircle, Menu, X, Ticket, Info, Trash2, Camera, RefreshCw, Smartphone, Shield, LogOut, Settings as Setting2, Layout, Bell, UserCircle, Search, MoreHorizontal, Check, AlertCircle, AlertTriangle, CheckSquare, MessageSquare, KeyRound, Share2, Facebook, Twitter, Linkedin, Copy, Star, CalendarPlus, Loader2, Image as ImageIcon, ChevronLeft, ArrowLeft, Link, Save, Upload, Tag, Lock } from 'lucide-react';
import html2canvas from 'html2canvas';
import Cropper from 'react-easy-crop';
import { format } from 'date-fns';

import { COUNTRY_CODES, splitPhoneNumber } from './constants';
import { Event as AppEvent, Registration, RegistrationStatus, EventStatus, Tab, Toast, User, Role, CustomQuestion, Review, ParticipationMode, Team, PromoCode, PaymentDetails, PaymentStatus } from './types';
import {
  getEvents, saveEvent, updateEvent, getRegistrations, addRegistration,
  updateRegistrationStatus, markAttendance, deleteRegistration, deleteEvent, updateEventStatus,
  loginUser, registerUser, subscribeToAuth, logoutUser,
  loginWithGoogle, saveUserProfile, resetUserPassword,
  createTeam, getTeamByInviteCode, joinTeam, getTeamsByEventId, getTeamById, deleteTeam, removeMemberFromTeam,
  getNotifications, addNotification, markNotificationRead, markAllNotificationsRead,
  getMessages, addMessage, getReviews, addReview, deleteAccount, getEventById, getEventImage, getInitialData,
  initRecaptcha, signInWithPhone, verifyPhoneOtp, checkPhoneNumberExists, getUserProfile, getVectorRecommendations,
  generateUUID, getTwilioAuthStatus, sendEmailDeleteOtp, verifyEmailDeleteOtp
} from './services/storageService';
import { generateEventDescription, getEventRecommendations } from './services/geminiService';
import { sendStatusUpdateEmail, sendReminderEmail, subscribeToPush } from './services/notificationService';
import { socketService } from './services/socketService';
import { Capacitor } from '@capacitor/core';

const API_BASE = Capacitor.isNativePlatform() ? 'https://eventron.xyz' : '';

// Lazy load heavy components for better initial load time
const Scanner = lazy(() => import('./components/Scanner'));
const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard'));
const LiquidChrome = lazy(() => import('./components/LiquidChrome'));
const ParticleBackground = lazy(() => import('./components/ParticleBackground'));
const EventChatBot = lazy(() => import('./components/EventChatBot'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const TermsPage = lazy(() => import('./components/TermsPage'));
const PrivacyPage = lazy(() => import('./components/PrivacyPage'));
const RefundPage = lazy(() => import('./components/RefundPage'));
const NotFound = lazy(() => import('./components/NotFound'));
import CaptchaWidget from './components/CaptchaWidget';

// --- Sub-Components ---

const ToastContainer = ({ toasts }: { toasts: Toast[] }) => (
  <div className="fixed bottom-12 left-1/2 transform -translate-x-1/2 z-[100] flex flex-col gap-3 pointer-events-none w-full max-w-sm px-4 sm:px-0">
    <AnimatePresence>
      {toasts.map(t => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
          className={`pointer-events-auto border-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-[24px] px-7 py-5 text-sm font-black flex items-center gap-4 relative overflow-hidden
            ${t.type === 'success' ? 'bg-[#020617] border-green-500/30 text-green-400' :
              t.type === 'error' ? 'bg-[#020617] border-red-500/30 text-red-400' :
                t.type === 'warning' ? 'bg-[#020617] border-amber-500/30 text-amber-400' :
                  'bg-[#020617] border-orange-500/30 text-orange-400'
            } `}
        >
          <div className={`absolute -inset-1 opacity-20 blur-xl -z-10 ${t.type === 'success' ? 'bg-green-500' :
            t.type === 'error' ? 'bg-red-500' :
              t.type === 'warning' ? 'bg-amber-500' :
                'bg-orange-500'
            } `} />

          <div className={`p-2 rounded-xl flex-shrink-0 ${t.type === 'success' ? 'bg-green-500/20' :
            t.type === 'error' ? 'bg-red-500/20' :
              t.type === 'warning' ? 'bg-amber-500/20' :
                'bg-orange-500/20'
            } `}>
            {t.type === 'success' && <CheckCircle className="w-5 h-5" />}
            {t.type === 'error' && <XCircle className="w-5 h-5" />}
            {t.type === 'warning' && <AlertCircle className="w-5 h-5" />}
            {(t.type === 'info' || !t.type) && <Info className="w-5 h-5" />}
          </div>
          <span className="flex-1 leading-snug tracking-tight">{t.message}</span>
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

const Badge = ({ status }: { status: RegistrationStatus }) => {
  const styles = {
    [RegistrationStatus.PENDING]: 'bg-amber-900/40 text-amber-500 border-amber-800',
    [RegistrationStatus.APPROVED]: 'bg-green-900/40 text-green-500 border-green-800',
    [RegistrationStatus.REJECTED]: 'bg-red-900/40 text-red-500 border-red-800',
    [RegistrationStatus.WAITLISTED]: 'bg-orange-900/40 text-orange-400 border-orange-800',
    [RegistrationStatus.AWAITING_PAYMENT]: 'bg-blue-900/40 text-blue-500 border-blue-800',
    [RegistrationStatus.TEAM_AWAITING_SUBMISSION]: 'bg-indigo-900/40 text-indigo-400 border-indigo-800',
  };

  return (
    <span className={`px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border ${styles[status]}`}>
      {status}
    </span>
  );
};

// --- Skeletons ---

const EventCardSkeleton = () => (
  <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden h-full flex flex-col">
    <div className="h-48 bg-slate-800 animate-pulse" />
    <div className="p-6 flex-1 flex flex-col space-y-4">
      <div className="flex gap-4">
        <div className="h-4 w-24 bg-slate-800 rounded animate-pulse" />
        <div className="h-4 w-16 bg-slate-800 rounded animate-pulse" />
      </div>
      <div className="h-6 w-3/4 bg-slate-800 rounded animate-pulse" />
      <div className="space-y-2">
        <div className="h-4 w-full bg-slate-800 rounded animate-pulse" />
        <div className="h-4 w-5/6 bg-slate-800 rounded animate-pulse" />
      </div>
      <div className="h-12 w-full bg-slate-800 rounded-xl mt-auto animate-pulse" />
    </div>
  </div>
);

const TicketSkeleton = () => (
  <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center gap-6 animate-pulse">
    <div className="flex-1 w-full space-y-3">
      <div className="flex justify-between md:block">
        <div className="h-5 w-20 bg-slate-800 rounded" />
      </div>
      <div className="h-6 w-48 bg-slate-800 rounded" />
      <div className="flex gap-3">
        <div className="h-4 w-24 bg-slate-800 rounded" />
        <div className="h-4 w-32 bg-slate-800 rounded" />
      </div>
    </div>
    <div className="w-full md:w-32 h-12 bg-slate-800 rounded-xl" />
  </div>
);

const ListRowSkeleton = () => (
  <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-4 animate-pulse">
    <div className="space-y-3 w-full sm:w-1/2">
      <div className="h-6 w-3/4 bg-slate-800 rounded" />
      <div className="h-4 w-1/2 bg-slate-800 rounded" />
    </div>
    <div className="h-10 w-full sm:w-24 bg-slate-800 rounded-lg" />
  </div>
);

// --- Helpers ---

// Helper to lazy load participant avatar if missing
const ParticipantAvatar = ({ name, avatarUrl, userId }: { name: string, avatarUrl?: string, userId: string }) => {
  const [src, setSrc] = useState(avatarUrl);

  useEffect(() => {
    if (src || !userId) return;

    let mounted = true;
    getUserProfile(userId).then(user => {
      if (mounted && user && user.avatarUrl) {
        setSrc(user.avatarUrl);
      }
    });

    return () => { mounted = false; };
  }, [userId, src]);

  return (
    <div className="flex flex-col items-center gap-2 p-2 bg-slate-800/30 rounded-xl border border-slate-800 hover:bg-slate-800/50 transition-colors group">
      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700 group-hover:border-orange-500/50 transition-colors">
        {src ? (
          <img
            src={src}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <span className="text-[10px] text-slate-300 font-medium text-center truncate w-full px-1" title={name}>
        {name.split(' ')[0]}
      </span>
    </div>
  );
};

const LazyEventImage = ({ eventId, initialSrc, alt, className }: { eventId: string, initialSrc?: string, alt: string, className?: string }) => {
  const [src, setSrc] = useState(initialSrc);
  const [loading, setLoading] = useState(!initialSrc);

  useEffect(() => {
    // If we already have a src (e.g. valid URL or cached), don't fetch
    if (initialSrc && initialSrc.length > 50) { // arbitrary length check for base64/url
      setSrc(initialSrc);
      setLoading(false);
      return;
    }

    let mounted = true;
    if (eventId) {
      getEventImage(eventId).then(url => {
        if (mounted) {
          if (url) setSrc(url);
          setLoading(false);
        }
      }).catch(() => {
        if (mounted) setLoading(false);
      });
    }
    return () => { mounted = false; };
  }, [eventId, initialSrc]);

  if (loading || !src) {
    return (
      <div className={`bg - slate - 800 flex items - center justify - center ${className} `}>
        {loading ? <Loader2 className="w-6 h-6 text-slate-600 animate-spin" /> : <ImageIcon className="w-8 h-8 text-slate-700" />}
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80'; }} />;
};

const getCroppedImg = (imageSrc: string, pixelCrop: any): Promise<string> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No 2d context'));
        return;
      }

      // Max dimension logic to prevent massive base64 strings
      const MAX_DIMENSION = 1024;
      let targetWidth = pixelCrop.width;
      let targetHeight = pixelCrop.height;

      if (targetWidth > MAX_DIMENSION || targetHeight > MAX_DIMENSION) {
        if (targetWidth > targetHeight) {
          targetHeight = (targetHeight / targetWidth) * MAX_DIMENSION;
          targetWidth = MAX_DIMENSION;
        } else {
          targetWidth = (targetWidth / targetHeight) * MAX_DIMENSION;
          targetHeight = MAX_DIMENSION;
        }
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      // Draw and resize
      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        targetWidth,
        targetHeight
      );

      // Compress to 0.8 quality to further reduce size
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    image.onerror = (e) => reject(e);
  });
};

const resizeImage = (imageSrc: string, maxDimension: number = 1024): Promise<string> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No 2d context'));
        return;
      }
      let targetWidth = image.width;
      let targetHeight = image.height;
      if (targetWidth > maxDimension || targetHeight > maxDimension) {
        if (targetWidth > targetHeight) {
          targetHeight = (targetHeight / targetWidth) * maxDimension;
          targetWidth = maxDimension;
        } else {
          targetWidth = (targetWidth / targetHeight) * maxDimension;
          targetHeight = maxDimension;
        }
      }
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    image.onerror = (e) => reject(e);
  });
};



const loadCashfree = () => {
  return new Promise((resolve) => {
    if ((window as any).Cashfree) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.onload = () => {
      resolve(true);
    };
    script.onerror = () => {
      resolve(false);
    };
    document.body.appendChild(script);
  });
};

// --- Legal Pages ---


// --- Main App Component ---

const AuthLeftPanel = ({ setIsAuthMode }: { setIsAuthMode: (mode: 'signin' | 'signup' | 'forgot-password') => void }) => {
  const [bgIndex, setBgIndex] = useState(0);
  const bgImages = [
    '/amadeus-moga-51lUmJT3g_Y-unsplash.jpg',
    '/christian-lue-KzySSWl4B08-unsplash.jpg',
    '/rafael-garcin-gimSMlBeik4-unsplash.jpg',
    '/rapha-wilde-dXpJeKIWfGs-unsplash.jpg'
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % bgImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handlePrev = () => setBgIndex((prev) => (prev - 1 + bgImages.length) % bgImages.length);
  const handleNext = () => setBgIndex((prev) => (prev + 1) % bgImages.length);

  return (
    <motion.div layout transition={{ type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.8 }} className="hidden md:flex md:w-[45%] relative p-8 flex-col justify-between overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0 bg-black">
        <AnimatePresence mode="wait">
          <motion.img
            key={bgIndex}
            src={bgImages[bgIndex]}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            alt="Eventron Hero"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-black/20"></div>
      </div>

      {/* Top Nav */}
      <div className="relative z-10 flex justify-end items-center w-full">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsAuthMode('signup')} className="text-white/90 text-xs font-semibold hover:text-white transition-colors">Sign Up</button>
          <button onClick={() => setIsAuthMode('signin')} className="px-4 py-1.5 rounded-full border border-white/40 text-white text-xs font-semibold backdrop-blur-sm hover:bg-white/10 transition-all">Join Us</button>
        </div>
      </div>

      {/* Bottom Profile Info */}
      <div className="relative z-10 flex items-center justify-between w-full mt-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center overflow-hidden border border-white/20">
            <img src="/favicon.png" alt="Eventron" className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">Eventron</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrev} className="w-8 h-8 rounded-full border border-white/30 flex items-center justify-center text-white/80 hover:bg-white/10 transition-colors backdrop-blur-sm"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={handleNext} className="w-8 h-8 rounded-full border border-white/30 flex items-center justify-center text-white/80 hover:bg-white/10 transition-colors backdrop-blur-sm"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
    </motion.div>
  );
};

export default function App() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    // Synchronously pre-load from localStorage so protected routes don't
    // see null on the very first render and incorrectly redirect.
    try {
      const stored = localStorage.getItem('eh_current_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [authLoading, setAuthLoading] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false); // Scroll state for header effect
  const [isAuthMode, setIsAuthMode] = useState<'signin' | 'signup' | 'forgot-password'>('signin');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', role: 'attendee' as Role });
  const [resetEmail, setResetEmail] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  // Phone Auth State
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [loginDialCode, setLoginDialCode] = useState('+91');
  const [loginNationalNumber, setLoginNationalNumber] = useState('');
  const [isSendingLoginOtp, setIsSendingLoginOtp] = useState(false);
  const [isVerifyingLoginOtp, setIsVerifyingLoginOtp] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [twilioStatus, setTwilioStatus] = useState<{ isAvailable: boolean; isConfigured: boolean; message: string; checked: boolean }>({
    isAvailable: true,
    isConfigured: true,
    message: '',
    checked: false
  });

  useEffect(() => {
    getTwilioAuthStatus().then((status) => {
      setTwilioStatus({
        isAvailable: status.isAvailable,
        isConfigured: status.isConfigured,
        message: status.message || '',
        checked: true
      });
      if (!status.isAvailable) {
        setLoginMethod('email');
      }
    });
  }, []);

  const [activeTab, setActiveTab] = useState<Tab>('browse');

  // Sync activeTab with URL path
  useEffect(() => {
    const path = location.pathname.substring(1); // remove leading slash
    if (path === 'explore') {
      setActiveTab('browse');
    } else if (path === 'myticket') {
      setActiveTab('my-tickets');
    } else if (path === 'organizer') {
      setActiveTab('organizer');
    } else if (path === 'admin') {
      setActiveTab('admin');
    }
  }, [location.pathname]);

  // Prevent browser from retaining scroll position across SPA transitions
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  // Automatically scroll to the top of the page when navigating between routes or tabs
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const rId = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
    return () => cancelAnimationFrame(rId);
  }, [location.pathname, activeTab]);

  // Reset CAPTCHA whenever the user switches auth mode
  useEffect(() => {
    setCaptchaVerified(false);
    setCaptchaResetKey(k => k + 1);
  }, [isAuthMode]);

  const handleTabChange = (tab: string) => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    if (tab === 'browse') navigate('/explore');
    else if (tab === 'my-tickets') navigate('/myticket');
    else navigate(`/${tab}`);
  };

  const navigateByRole = (user: User) => {
    if (user.role === 'admin') {
      setActiveTab('admin');
      navigate('/admin');
    } else if (user.role === 'organizer') {
      setActiveTab('organizer');
      navigate('/organizer');
    } else {
      setActiveTab('browse');
      navigate('/explore');
    }
  };
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [otpPurpose, setOtpPurpose] = useState<'login' | 'profile'>('login');
  const [showAllPastEvents, setShowAllPastEvents] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [qrTimestamp, setQrTimestamp] = useState(Math.floor(Date.now() / 180000));

  useEffect(() => {
    const interval = setInterval(() => {
      setQrTimestamp(Math.floor(Date.now() / 180000));
    }, 60000);
    return () => clearInterval(interval);
  }, []);
  // Real-time spots pulse: tracks event IDs that just received a new registration
  const [flashedEventIds, setFlashedEventIds] = useState<Set<string>>(new Set());

  // Account Deletion Email Verification State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteEmailOtp, setDeleteEmailOtp] = useState('');
  const [isSendingDeleteOtp, setIsSendingDeleteOtp] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleteOtpSent, setDeleteOtpSent] = useState(false);



  const renderLocation = (location: string, type: 'online' | 'offline', className?: string) => {
    const isLink = type === 'online' && (location.startsWith('http') || location.includes('.') || location.toLowerCase().includes('zoom') || location.toLowerCase().includes('google.com'));

    if (isLink) {
      const isUrl = location.startsWith('http') || location.includes('.');
      if (isUrl) {
        const url = location.startsWith('http') ? location : `https://${location}`;
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-orange-400 hover:text-orange-300 hover:underline transition-colors flex items-center gap-1 inline-flex ${className}`}
            onClick={(e) => e.stopPropagation()}
          >
            {location}
            <ExternalLink className="w-3 h-3" />
          </a>
        );
      }
    }
    return <span className={className}>{location}</span>;
  };

  const isPastEvent = (e: AppEvent) => {
    const now = new Date();
    const end = e.endDate ? new Date(e.endDate) : new Date(new Date(e.date).getTime() + 3600000);
    return end < now;
  };

  // Infer suitable tags from event metadata using keyword matching
  const inferEventTags = (e: AppEvent): string[] => {
    if (e.tags && e.tags.length > 0) return e.tags; // Use organizer-set tags if available
    const text = `${e.title} ${e.description}`.toLowerCase();
    const rules: { keywords: string[]; tag: string }[] = [
      { keywords: ['artificial intelligence', ' ai ', 'ai-', 'ai,', 'gpt', 'llm', 'generative', 'openai', 'chatbot'], tag: 'AI' },
      { keywords: ['machine learning', ' ml ', 'deep learning', 'neural', 'model training', 'data science'], tag: 'ML' },
      { keywords: ['conference', 'summit', 'symposium', 'congress', 'expo', 'convention'], tag: 'Conference' },
      { keywords: ['tech', 'technology', 'software', 'developer', 'engineering', 'coding', 'programming', 'code', 'devops', 'cloud', 'web dev'], tag: 'Tech' },
      { keywords: ['hackathon', 'hack', 'build sprint', 'buildathon', 'codefest', 'code fest'], tag: 'Hackathon' },
      { keywords: ['networking', 'meet', 'mixer', 'connect', 'community', 'professionals', 'meetup'], tag: 'Networking' },
      { keywords: ['startup', 'entrepreneur', 'pitch', 'venture', 'founder', 'bootstrapp', 'investor'], tag: 'Startup' },
      { keywords: ['workshop', 'training', 'bootcamp', 'hands-on', 'hands on', 'tutorial', 'masterclass', 'course', 'session'], tag: 'Workshop' },
      { keywords: ['design', 'ux', 'ui', 'figma', 'product design', 'creative', 'branding', 'typography'], tag: 'Design' },
    ];
    const inferred: string[] = [];
    for (const rule of rules) {
      if (rule.keywords.some(kw => text.includes(kw))) {
        inferred.push(rule.tag);
      }
    }
    // Fallback based on event properties
    if (inferred.length === 0) {
      if (e.participationMode === 'team') inferred.push('Hackathon');
      else if (e.locationType === 'online') inferred.push('Tech');
      else inferred.push('Networking');
    }
    return inferred.slice(0, 3); // Max 3 auto-tags
  };

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [selectedEventForReg, setSelectedEventForReg] = useState<AppEvent | null>(null);
  const [selectedEventForDetails, setSelectedEventForDetails] = useState<AppEvent | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Registration | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanResult, setScanResult] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [detailsTab, setDetailsTab] = useState<'info' | 'discussion' | 'reviews'>('info');
  const [showAllAttendees, setShowAllAttendees] = useState(false);

  useEffect(() => {
    setShowAllAttendees(false);
  }, [selectedEventForDetails?.id]);

  // Keep ref to selectedEventForDetails so socket listeners have fresh context
  const selectedEventForDetailsRef = useRef<AppEvent | null>(null);
  useEffect(() => {
    selectedEventForDetailsRef.current = selectedEventForDetails;
  }, [selectedEventForDetails]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (detailsTab === 'discussion' && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, detailsTab]);

  // Organizer View State
  const [organizerSelectedEventId, setOrganizerSelectedEventId] = useState<string | null>(null);
  const [organizerView, setOrganizerView] = useState<'overview' | 'events'>('overview');
  const [isSendingReminders, setIsSendingReminders] = useState(false);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [announcementText, setAnnouncementText] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | RegistrationStatus>('ALL');
  const [attendanceFilter, setAttendanceFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT'>('ALL');
  const [selectedRegistrationIds, setSelectedRegistrationIds] = useState<string[]>([]);

  // Form States
  const [newEvent, setNewEvent] = useState<{
    title: string; date: string; endDate: string; location: string; locationType: 'online' | 'offline'; description: string; capacity: string; imageUrl: string; customQuestions: CustomQuestion[]; collaboratorEmails: string[]; tags: string[];
    participationMode: ParticipationMode; maxTeamSize: string; minTeamSize: string;
    isPaid: boolean; price: string; pricingType: 'overall' | 'per_person'; promoCodes: PromoCode[];
    organizerPaymentDetails?: { upiId?: string; bankDetails?: { accountNumber: string; ifsc: string; accountName: string; }; };
  }>({
    title: '', date: '', endDate: '', location: '', locationType: 'offline', description: '', capacity: '', imageUrl: '', customQuestions: [], collaboratorEmails: [], tags: [],
    participationMode: 'individual', maxTeamSize: '5', minTeamSize: '2',
    isPaid: false, price: '', pricingType: 'overall', promoCodes: [],
    organizerPaymentDetails: undefined
  });
  const [promoCodeInput, setPromoCodeInput] = useState<{ code: string; type: 'percentage' | 'fixed'; value: string; limit: string }>({ code: '', type: 'percentage', value: '', limit: '' });
  const [appliedPromoCode, setAppliedPromoCode] = useState<PromoCode | null>(null);
  const [userPromoCode, setUserPromoCode] = useState('');

  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [registrationAnswers, setRegistrationAnswers] = useState<Record<string, string>>({});
  const [selectedRegistrationDetails, setSelectedRegistrationDetails] = useState<Registration | null>(null);
  const [teamRegistrationData, setTeamRegistrationData] = useState<{
    mode: 'individual' | 'team';
    subMode: 'create' | 'join';
    teamName: string;
    inviteCode: string;
  }>({ mode: 'individual', subMode: 'create', teamName: '', inviteCode: '' });

  // Cropper State
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [collaboratorEmailInput, setCollaboratorEmailInput] = useState('');
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  const [isPaymentSuccess, setIsPaymentSuccess] = useState(false);
  const [paymentPromoCode, setPaymentPromoCode] = useState('');
  const [paymentAppliedPromo, setPaymentAppliedPromo] = useState<PromoCode | null>(null);
  const [paymentPromoMessage, setPaymentPromoMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [selectedRegForPayment, setSelectedRegForPayment] = useState<{ reg: Registration, event: AppEvent } | null>(null);

  // --- Initialization ---

  // Auth Listener
  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setCurrentUser(user);
      if (user) {
        if (user.role === 'admin') {
          setActiveTab('admin');
        } else if (user.role === 'organizer') {
          setActiveTab('organizer');
        } else {
          setActiveTab('browse');
        }
        loadData();
        // Close auth modal and navigate away from landing page or to role-specific dashboard
        setIsAuthModalOpen(false);
        if (
          window.location.pathname === '/' ||
          window.location.pathname === '' ||
          (user.role === 'admin' && window.location.pathname !== '/admin') ||
          (user.role === 'organizer' && (window.location.pathname === '/explore' || window.location.pathname === '/browse'))
        ) {
          navigateByRole(user);
        }
      } else {
        setEvents([]);
        setRegistrations([]);
        setNotifications([]);
      }
      setAuthLoading(false);
    });

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);

    return () => {
      unsubscribe();
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Strict route guard: ensure Admin always stays on /admin
  useEffect(() => {
    if (currentUser?.role === 'admin' && location.pathname !== '/admin') {
      setActiveTab('admin');
      navigate('/admin', { replace: true });
    }
  }, [currentUser?.role, location.pathname, navigate]);

  // Socket.io Listener
  useEffect(() => {
    socketService.connect();

    const handleDataUpdate = (data: any) => {
      console.log('⚡ Real-time update:', data);

      if (data.collection === 'events') {
        loadData(true);
        if (data.action === 'insert') {
          // Check if current user is the organizer
          setCurrentUser(u => {
            if (!u || u.id !== data.document.organizerId) {
              addToast(`New event: ${data.document.title}`, 'info');
            }
            return u;
          });
        }
      } else if (data.collection === 'registrations' || data.collection === 'teams') {
        // Pulse the spots badge for the affected event
        if (data.action === 'insert' && data.document?.eventId) {
          const eid = String(data.document.eventId);
          setFlashedEventIds(prev => new Set(prev).add(eid));
          setTimeout(() => setFlashedEventIds(prev => { const next = new Set(prev); next.delete(eid); return next; }), 3000);
        }
        loadData(true);
      } else if (data.collection === 'messages') {
        const eventId = data.eventId || data.document?.eventId;
        const currentEvent = selectedEventForDetailsRef.current;
        if (currentEvent && String(eventId) === String(currentEvent.id)) {
          if (data.action === 'insert' && data.document) {
            const newDoc = data.document;
            setMessages(prev => {
              if (prev.some(m => (m.id && m.id === newDoc.id) || (m._id && m._id === newDoc._id))) {
                return prev;
              }
              return [...prev, newDoc].sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            });
          } else {
            getMessages(currentEvent.id).then(msgs => {
              if (selectedEventForDetailsRef.current?.id === currentEvent.id) {
                setMessages(msgs);
              }
            });
          }
        }
      }
    };

    const handleNotification = (data: any) => {
      // Use function to get latest currentUser without adding to deps
      setCurrentUser((user) => {
        if (user && data.userId === user.id) {
          addToast(data.message, data.type || 'info');
          loadData(true);
        }
        return user; // Return unchanged
      });
    };

    socketService.on('data_updated', handleDataUpdate);
    socketService.on('notification_received', handleNotification);

    return () => {
      socketService.off('data_updated', handleDataUpdate);
      socketService.off('notification_received', handleNotification);
    };
  }, []); // Empty deps - only run once on mount

  // Profile Edit State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState<{ name: string; email: string; avatarUrl?: string; phoneNumber?: string; isPhoneVerified?: boolean }>({ name: '', email: '' });
  const [profileDialCode, setProfileDialCode] = useState('+91');
  const [profileNationalNumber, setProfileNationalNumber] = useState('');
  const [isSendingProfilePhoneOtp, setIsSendingProfilePhoneOtp] = useState(false);
  const [isVerifyingProfilePhoneOtp, setIsVerifyingProfilePhoneOtp] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [cropPurpose, setCropPurpose] = useState<'event' | 'profile'>('event'); // Track what we are cropping

  // Auto-sync profile form state whenever currentUser changes (handles direct navigation to /edit-page)
  useEffect(() => {
    if (currentUser) {
      setProfileForm({
        name: currentUser.name || '',
        email: currentUser.email || '',
        phoneNumber: currentUser.phoneNumber || '',
        isPhoneVerified: !!currentUser.phoneNumber,
        avatarUrl: currentUser.avatarUrl
      });
      if (currentUser.phoneNumber) {
        const parsed = splitPhoneNumber(currentUser.phoneNumber);
        setProfileDialCode(parsed.dialCode);
        setProfileNationalNumber(parsed.nationalNumber);
      }
    }
  }, [currentUser]);

  // Lock body scroll when any modal is open
  useEffect(() => {
    if (
      isAuthModalOpen ||
      isCreateModalOpen ||
      isProfileModalOpen ||
      selectedEventForDetails ||
      selectedEventForReg ||
      selectedTicket ||
      selectedRegistrationDetails ||
      isScannerOpen ||
      isAnnouncementModalOpen
    ) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [
    isAuthModalOpen,
    currentUser,
    isCreateModalOpen,
    isProfileModalOpen,
    selectedEventForDetails,
    selectedEventForReg,
    selectedTicket,
    selectedRegistrationDetails,
    isScannerOpen,
    isAnnouncementModalOpen
  ]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSavingProfile(true);

    try {
      if (profileForm.phoneNumber && profileForm.phoneNumber !== currentUser.phoneNumber && !profileForm.isPhoneVerified) {
        addToast('Please verify your new phone number before saving', 'error');
        setIsSavingProfile(false);
        return;
      }

      const updatedUser = {
        ...currentUser,
        name: profileForm.name,
        phoneNumber: profileForm.phoneNumber,
        avatarUrl: profileForm.avatarUrl
      };
      await saveUserProfile(updatedUser);
      setCurrentUser(updatedUser);
      addToast('Profile updated', 'success');
      loadData();
    } catch (error) {
      console.error(error);
      addToast('Failed to update profile', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleOpenDeleteModal = async () => {
    if (!currentUser?.email) {
      addToast('No email associated with this account.', 'error');
      return;
    }
    setDeleteEmailOtp('');
    setIsSendingDeleteOtp(true);
    try {
      await sendEmailDeleteOtp(currentUser.email, currentUser.id);
      setDeleteOtpSent(true);
      setDeleteEmailOtp('');
      addToast(`Verification code sent to ${currentUser.email}`, 'success');
      setIsDeleteModalOpen(true);
    } catch (e: any) {
      console.error(e);
      addToast(`Failed to send verification code: ${e.message || e}`, 'error');
    } finally {
      setIsSendingDeleteOtp(false);
    }
  };

  const handleSendDeleteEmailOtp = async () => {
    if (!currentUser?.email) return;
    setIsSendingDeleteOtp(true);
    try {
      await sendEmailDeleteOtp(currentUser.email, currentUser.id);
      setDeleteOtpSent(true);
      setDeleteEmailOtp('');
      addToast(`Verification code sent to ${currentUser.email}`, 'success');
    } catch (e: any) {
      console.error(e);
      addToast(`Failed to send verification code: ${e.message || e}`, 'error');
    } finally {
      setIsSendingDeleteOtp(false);
    }
  };

  const handleConfirmEmailDeletion = async () => {
    if (!currentUser?.email || !deleteEmailOtp.trim()) {
      addToast('Please enter the 6-digit verification code.', 'error');
      return;
    }
    setIsConfirmingDelete(true);
    try {
      await verifyEmailDeleteOtp(
        currentUser.email,
        currentUser.id,
        deleteEmailOtp.trim(),
        currentUser.role === 'organizer'
      );
      addToast('Account deleted permanently', 'success');
      setCurrentUser(null);
      setIsDeleteModalOpen(false);
      setIsProfileModalOpen(false);
      setDeleteEmailOtp('');
    } catch (e: any) {
      console.error(e);
      addToast(e.message || 'Invalid or expired verification code.', 'error');
    } finally {
      setIsConfirmingDelete(false);
    }
  };

  // Data Loading
  const loadData = async (isSilent = false) => {
    if (!isSilent) setDataLoading(true);
    try {
      // SECURITY: Pass both userId and userEmail for server-side role-based filtering
      const initialData = await getInitialData(
        currentUser ? currentUser.id : undefined,
        currentUser ? currentUser.email : undefined,
        currentUser ? currentUser.role : undefined
      );
      const evts = initialData.events || [];
      const regs = initialData.registrations || [];
      const notifs = initialData.notifications || [];
      const fetchedTeams = initialData.teams || [];

      setEvents(evts);
      setRegistrations(regs);
      setNotifications(notifs);
      setTeams(fetchedTeams);

      // Legacy fallback logic removed as getInitialData now handles batch fetching for teams
      if (currentUser && fetchedTeams.length === 0 && !initialData.teams) {
        // Only run this if we are using a legacy storageService that didn't return teams (unlikely now)
        const userEventIds = regs.filter(r => r.participantEmail === currentUser.email).map(r => r.eventId);
        const organizedEventIds = currentUser.role === 'organizer' ? evts.filter(e => e.organizerId === currentUser.id).map(e => e.id) : [];
        const allEventIdsToFetchTeams = Array.from(new Set([...userEventIds, ...organizedEventIds]));

        if (allEventIdsToFetchTeams.length > 0) {
          const allTeams = await Promise.all(allEventIdsToFetchTeams.map(id => getTeamsByEventId(id)));
          setTeams(allTeams.flat());
        }
      }
    } catch (e) {
      if (!isSilent) addToast('Failed to load data', 'error');
    } finally {
      if (!isSilent) setDataLoading(false);
    }
  };

  useEffect(() => {
    if (location.pathname === '/') {
      if (currentUser) {
        if (currentUser.role === 'admin') {
          navigate('/admin', { replace: true });
        } else if (currentUser.role === 'organizer') {
          navigate('/organizer', { replace: true });
        } else {
          navigate('/explore', { replace: true });
        }
      } else {
        setIsAuthModalOpen(true);
      }
    }
  }, [location.pathname, currentUser, navigate]);

  useEffect(() => {
    if (currentUser?.role === 'admin' && location.pathname === '/admin' && activeTab !== 'admin') {
      setActiveTab('admin');
    }
  }, [currentUser, location.pathname, activeTab]);

  useEffect(() => {
    loadData();
    if (currentUser) {
      subscribeToPush(currentUser.id);
    }
    const interval = setInterval(() => loadData(true), 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleCancelRegistration = async (registrationId: string) => {
    const targetReg = registrations.find(r => r.id === registrationId);
    if (!targetReg) return;

    const event = events.find(e => e.id === targetReg.eventId);
    const isTeamReg = targetReg.participationType === 'team' && !!targetReg.teamId;
    const isLeader = Boolean(targetReg.isTeamLeader);
    const teamId = targetReg.teamId;

    if (isTeamReg && isLeader && teamId) {
      // Option A: Team Leader Cancellation Flow
      const teamRegs = registrations.filter(r => r.teamId === teamId && r.status !== RegistrationStatus.REJECTED);
      const teamObj = teams.find(t => t.id === teamId);
      const teamName = targetReg.teamName || teamObj?.name || 'Your Team';
      const membersCount = Math.max(teamRegs.length, teamObj?.members?.length || 1);
      const otherMembersCount = Math.max(0, membersCount - 1);

      const confirmMsg = otherMembersCount > 0
        ? `⚠️ You are the Team Leader of "${teamName}".\n\nCancelling your registration will DISBAND the entire team and cancel registrations for the other ${otherMembersCount} team member${otherMembersCount !== 1 ? 's' : ''}.\n\nAre you sure you want to cancel and disband the team?`
        : `Are you sure you want to cancel your team registration for "${event?.title || 'this event'}"?`;

      if (!window.confirm(confirmMsg)) return;

      setIsRegistering(true);
      try {
        // 1. Notify team members about team disbandment
        for (const memberReg of teamRegs) {
          if (memberReg.id !== targetReg.id) {
            await addNotification({
              userId: memberReg.participantId,
              title: `Team "${teamName}" Disbanded ⚠️`,
              message: `Your team leader (${targetReg.participantName}) cancelled their registration for "${event?.title || 'the event'}". The team has been disbanded. You may now register again individually or with a new team.`,
              type: 'warning',
              link: 'explore'
            });
          }
        }

        // 2. Delete all registrations in this team
        await Promise.all(teamRegs.map(r => deleteRegistration(r.id)));

        // 3. Delete team record from database
        await deleteTeam(teamId);

        addToast(`Team "${teamName}" disbanded and registrations cancelled.`, 'success');
        await loadData(true);
      } catch (error) {
        console.error('Team cancellation error:', error);
        addToast('Failed to cancel team registration', 'error');
      } finally {
        setIsRegistering(false);
      }
      return;
    }

    if (isTeamReg && !isLeader && teamId) {
      // Normal team member leaving the team
      if (!window.confirm(`Are you sure you want to leave team "${targetReg.teamName || 'your team'}" and cancel your registration?`)) return;

      setIsRegistering(true);
      try {
        await deleteRegistration(registrationId);
        await removeMemberFromTeam(teamId, currentUser?.id || targetReg.participantEmail);

        // Notify team leader that member left
        const leaderReg = registrations.find(r => r.teamId === teamId && r.isTeamLeader);
        if (leaderReg) {
          await addNotification({
            userId: leaderReg.participantId,
            title: `Team Member Left 👥`,
            message: `${targetReg.participantName} has left your team "${targetReg.teamName || 'Team'}" for "${event?.title || 'the event'}".`,
            type: 'info',
            link: 'my-tickets'
          });
        }

        addToast('You have left the team and cancelled your registration.', 'success');
        await loadData(true);
      } catch (error) {
        console.error('Member leave error:', error);
        addToast('Failed to cancel registration', 'error');
      } finally {
        setIsRegistering(false);
      }
      return;
    }

    // Individual participant cancellation
    if (!window.confirm('Are you sure you want to cancel your registration for this event?')) return;

    try {
      const success = await deleteRegistration(registrationId);
      if (success) {
        addToast('Registration cancelled successfully', 'success');
        loadData(true);
      } else {
        addToast('Failed to cancel registration', 'error');
      }
    } catch (error) {
      console.error('Cancellation error:', error);
      addToast('An error occurred during cancellation', 'error');
    }
  };

  useEffect(() => {
    const fetchMessages = async (isSilent = false) => {
      if (selectedEventForDetails) {
        if (!isSilent) setIsMessagesLoading(true);
        const msgs = await getMessages(selectedEventForDetails.id);
        setMessages(msgs);
        if (!isSilent) setIsMessagesLoading(false);
      } else {
        setMessages([]);
      }
    };

    fetchMessages();
    const interval = setInterval(() => fetchMessages(true), 5000);
    return () => clearInterval(interval);
  }, [selectedEventForDetails]);

  // Fetch Reviews when Event Details Open
  useEffect(() => {
    const fetchReviewsData = async (isSilent = false) => {
      if (selectedEventForDetails) {
        if (!isSilent) setIsReviewsLoading(true);
        try {
          const data = await getReviews(selectedEventForDetails.id);
          setReviews(data);
        } catch (e) {
          console.error("Failed to fetch reviews", e);
        } finally {
          if (!isSilent) setIsReviewsLoading(false);
        }
      } else {
        setReviews([]);
        setRating(5);
        setReviewComment('');
      }
    };

    fetchReviewsData();
  }, [selectedEventForDetails]);

  // Hydrate Event Details (Fetch full data if missing logic from list view optimization)
  useEffect(() => {
    const hydrateEvent = async () => {
      if (selectedEventForDetails) {
        // If description is empty or image is empty (and we expect them usually), fetch full
        // Note: Some events might legitimately have no image, but our list view forces it to empty string.
        // We can check a flag or just always fetch if we are in Mongo mode.
        // For simplicity, let's always fetch fresh details to ensure up-to-date data too.
        try {
          // Optimization: Fetch details WITHOUT massive image first to unlock UI speed.
          // The LazyEventImage component will fetch the image in parallel.
          const fullEvent = await getEventById(selectedEventForDetails.id, { excludeImage: true });

          if (fullEvent) {
            // Merge the fetched details (text) with the existing state (which might have empty image)
            // We preserved the 'imageUrl' from list view (empty) or if we had it cached.
            // But getEventById(excludeImage: true) returns null/undefined for imageUrl.

            // If we really want to update the state, we should check if description is missing.
            if (fullEvent.description.length > selectedEventForDetails.description.length) {
              // Keep existing image URL if we have one (though usually empty from list)
              // The LazyEventImage will handle the fetch.
              setSelectedEventForDetails(prev => prev ? { ...fullEvent, imageUrl: prev.imageUrl } : fullEvent);
            }
          }
        } catch (e) {
          console.error("Failed to hydrate event", e);
        }
      }

    };
    hydrateEvent();
  }, [selectedEventForDetails?.id]); // Only run if ID changes

  // Fallback: Fetch missing team details if viewing registration
  useEffect(() => {
    const fetchMissingTeam = async () => {
      if (selectedRegistrationDetails?.participationType === 'team' && selectedRegistrationDetails.teamId) {
        const isTeamLoaded = teams.some(t => t.id === selectedRegistrationDetails.teamId);

        if (!isTeamLoaded) {
          try {
            const team = await getTeamById(selectedRegistrationDetails.teamId);
            if (team) {
              setTeams(prev => {
                if (prev.some(t => t.id === team.id)) return prev;
                return [...prev, team];
              });
            }
          } catch (e) {
            console.error("Failed to fetch missing team details", e);
          }
        }
      }
    };

    fetchMissingTeam();
  }, [selectedRegistrationDetails, teams]);

  // Event Reminders Polling
  useEffect(() => {
    const checkReminders = async () => {
      if (!currentUser || registrations.length === 0 || events.length === 0) return;

      const now = new Date();
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

      const myApprovedRegs = registrations.filter(r =>
        r.participantId === currentUser.id &&
        r.status === RegistrationStatus.APPROVED
      );

      for (const reg of myApprovedRegs) {
        const event = events.find(e => e.id === reg.eventId);
        if (!event) continue;

        const eventDate = new Date(event.date);

        // Reminder Logic: Starts within 1 hour, hasn't started yet
        if (eventDate > now && eventDate <= oneHourLater) {
          const reminderKey = `reminder_1h_${event.id}_${currentUser.id}`;
          const alreadySent = localStorage.getItem(reminderKey);

          if (!alreadySent) {
            await addNotification({
              userId: currentUser.id,
              title: 'Upcoming Event',
              message: `"${event.title}" is starting in less than an hour!`,
              type: 'info',
              link: 'my-tickets',
              eventId: event.id,
            });

            localStorage.setItem(reminderKey, 'true');
            // Refresh notifs visually
            loadData(true);
            addToast(`Reminder: "${event.title}" starts soon!`, 'info');
          }
        }
      }
    };

    const timer = setInterval(checkReminders, 60000); // Check every minute
    checkReminders(); // Initial check

    return () => clearInterval(timer);
  }, [currentUser, registrations, events]);

  // Recommendations Logic
  const [recommendedEvents, setRecommendedEvents] = useState<AppEvent[]>([]);
  const [areRecommendationsLoading, setAreRecommendationsLoading] = useState(false);
  const [isAiUnavailable, setIsAiUnavailable] = useState(false);

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!currentUser || currentUser.role !== 'attendee' || events.length === 0 || registrations.length === 0 || isAiUnavailable) return;

      // Avoid refetching if we already have them to save tokens, unless forced (not implemented here)
      if (recommendedEvents.length > 0) return;

      setAreRecommendationsLoading(true);
      try {
        const myRegs = registrations.filter(r => r.participantEmail === currentUser.email);
        if (myRegs.length === 0) {
          setAreRecommendationsLoading(false);
          return;
        }

        const recs = await getVectorRecommendations(currentUser.id);
        setRecommendedEvents(recs);
      } catch (e: any) {
        console.error("Gemini Recommendation Error:", e);
        // Disable AI if API key is invalid or quota exceeded
        if (JSON.stringify(e).includes('400') || JSON.stringify(e).includes('API key')) {
          setIsAiUnavailable(true);
          // Optional: silently fail or toast once
        }
      } finally {
        setAreRecommendationsLoading(false);
      }
    };

    fetchRecommendations();
  }, [currentUser, events, registrations, isAiUnavailable, recommendedEvents.length]);



  // Review State & Logic
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isReviewsLoading, setIsReviewsLoading] = useState(false);

  useEffect(() => {
    const fetchReviews = async () => {
      if (selectedEventForDetails && detailsTab === 'reviews') {
        setIsReviewsLoading(true);
        const data = await getReviews(selectedEventForDetails.id);
        setReviews(data);
        setIsReviewsLoading(false);
      }
    };
    fetchReviews();
  }, [selectedEventForDetails, detailsTab]);

  // Autofill Name in Custom Questions
  useEffect(() => {
    if (selectedEventForReg && currentUser && selectedEventForReg.customQuestions) {
      const initialAnswers: Record<string, string> = {};
      let hasUpdates = false;

      selectedEventForReg.customQuestions.forEach(q => {
        const questionLower = q.question.toLowerCase();
        // Check triggers: "name" or "full name"
        // Exclude "team name" to avoid false positives for team info
        if (
          (questionLower.includes('name') || questionLower.includes('full name')) &&
          !questionLower.includes('team')
        ) {
          initialAnswers[q.id] = currentUser.name;
          hasUpdates = true;
        }
      });

      if (hasUpdates) {
        setRegistrationAnswers(prev => ({ ...prev, ...initialAnswers }));
      }
    }
  }, [selectedEventForReg?.id, currentUser?.id]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventForDetails || !currentUser) return;

    if (reviewComment.trim().length < 5) {
      addToast('Review must be at least 5 characters', 'error');
      return;
    }

    const reviewData = {
      eventId: selectedEventForDetails.id,
      userId: currentUser.id,
      userName: currentUser.name,
      rating: rating,
      comment: reviewComment.trim()
    };

    await addReview(reviewData);
    setReviewComment('');
    setRating(5);
    addToast('Review submitted successfully!', 'success');

    // Refresh reviews
    const data = await getReviews(selectedEventForDetails.id);
    setReviews(data);
  };

  // Scroll Management for Details Modal
  useEffect(() => {
    if (scrollContainerRef.current) {
      if (detailsTab === 'discussion') {
        // Scroll to bottom for chat
        setTimeout(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
          }
        }, 0);
      } else {
        // Scroll to top for info/reviews
        scrollContainerRef.current.scrollTop = 0;
      }
    }
  }, [detailsTab]);

  // Auto-scroll chat on new messages
  useEffect(() => {
    if (detailsTab === 'discussion' && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, isMessagesLoading, detailsTab]);

  const addToast = (message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  // --- Auth Handlers ---

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!captchaVerified) {
      setAuthError('Please complete the human verification before signing in.');
      return;
    }

    setAuthLoading(true);
    const user = await loginUser(authForm.email, authForm.password);
    setAuthLoading(false);

    if (user) {
      setCurrentUser(user);
      setIsAuthModalOpen(false);
      setCaptchaVerified(false);
      navigateByRole(user);
      addToast(`Welcome back, ${user.name} !`, 'success');
    } else {
      setAuthError('Incorrect email or password. Please try again.');
      setCaptchaVerified(false);
      setCaptchaResetKey(k => k + 1);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!captchaVerified) {
      setAuthError('Please complete the human verification before signing up.');
      return;
    }

    setAuthLoading(true);

    const newUser = await registerUser({
      name: authForm.name,
      email: authForm.email,
      role: authForm.role
    }, authForm.password);

    setAuthLoading(false);

    if (newUser) {
      setCurrentUser(newUser);
      setIsAuthModalOpen(false);
      setCaptchaVerified(false);
      navigateByRole(newUser);
      addToast('Account created successfully!', 'success');
    } else {
      setAuthError('This email is already registered. Try signing in instead.');
      setCaptchaVerified(false);
      setCaptchaResetKey(k => k + 1);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null); // Ensure immediate local state clear
    setAuthForm({ name: '', email: '', password: '', role: 'attendee' });
    addToast('Logged out successfully', 'info');
    navigate('/');
  };

  // --- App Handlers ---

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, purpose: 'event' | 'profile' = 'event') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        addToast('Image size should be less than 5MB', 'error');
        return;
      }

      setCropPurpose(purpose);

      const reader = new FileReader();
      reader.onloadend = async () => {
        if (purpose === 'event') {
          // Bypass cropper to keep original poster uncropped
          const resized = await resizeImage(reader.result as string, 1024);
          setNewEvent(prev => ({ ...prev, imageUrl: resized }));
        } else {
          setTempImageSrc(reader.result as string);
          setIsCropperOpen(true);
        }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropConfirm = async () => {
    if (!tempImageSrc || !croppedAreaPixels) return;
    try {
      const croppedImage = await getCroppedImg(tempImageSrc, croppedAreaPixels);
      if (cropPurpose === 'event') {
        setNewEvent(prev => ({ ...prev, imageUrl: croppedImage }));
      } else {
        setProfileForm(prev => ({ ...prev, avatarUrl: croppedImage }));
        // If we want immediate feedback on the user object (optional, but form state is enough for preview)
      }
      setIsCropperOpen(false);
      setTempImageSrc(null);
    } catch (e) {
      console.error(e);
      addToast('Failed to crop image', 'error');
    }
  };

  // --- Payment Receipt PDF ---
  const downloadPaymentReceipt = (details: {
    userName: string; userEmail: string; eventTitle: string; eventDate: string;
    eventLocation: string; amount: number; transactionId: string; orderId: string;
    promoCode?: string; registrationId: string;
  }) => {
    const receiptHtml = `
      <!DOCTYPE html><html><head><meta charset="UTF-8"/>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #020617; color: #f8fafc; padding: 40px; }
        .receipt { max-width: 600px; margin: 0 auto; background: #0f172a; border-radius: 24px; overflow: hidden; border: 1px solid rgba(249,115,22,0.3); box-shadow: 0 0 60px rgba(249,115,22,0.1); }
        .header { background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); padding: 36px 40px; display: flex; align-items: center; justify-content: space-between; }
        .brand { font-size: 28px; font-weight: 900; color: white; letter-spacing: -0.5px; }
        .brand span { opacity: 0.7; font-weight: 400; font-size: 13px; display: block; letter-spacing: 0.2em; text-transform: uppercase; margin-top: 2px; }
        .receipt-tag { background: rgba(255,255,255,0.2); padding: 6px 16px; border-radius: 100px; font-size: 11px; font-weight: 700; color: white; text-transform: uppercase; letter-spacing: 0.15em; }
        .body { padding: 40px; }
        .success-badge { display: flex; align-items: center; gap: 10px; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: 12px; padding: 14px 20px; margin-bottom: 32px; }
        .success-icon { width: 24px; height: 24px; background: #22c55e; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; font-weight: 900; flex-shrink: 0; }
        .success-text { color: #4ade80; font-weight: 700; font-size: 14px; }
        .event-title { font-size: 22px; font-weight: 900; color: white; margin-bottom: 6px; }
        .event-meta { color: #94a3b8; font-size: 13px; margin-bottom: 32px; }
        .divider { height: 1px; background: rgba(255,255,255,0.06); margin: 24px 0; }
        .row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
        .label { color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; }
        .value { color: #e2e8f0; font-size: 13px; font-weight: 600; text-align: right; max-width: 55%; word-break: break-all; }
        .amount-row { background: rgba(249,115,22,0.08); border: 1px solid rgba(249,115,22,0.2); border-radius: 14px; padding: 18px 22px; margin-top: 24px; display: flex; justify-content: space-between; align-items: center; }
        .amount-label { color: #fb923c; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
        .amount-value { color: #f97316; font-size: 26px; font-weight: 900; }
        .footer { background: rgba(0,0,0,0.3); padding: 20px 40px; text-align: center; color: #475569; font-size: 11px; border-top: 1px solid rgba(255,255,255,0.04); }
        @media print { body { background: white; color: #0f172a; } .receipt { border: 2px solid #ea580c; box-shadow: none; } }
      </style></head><body>
      <div class="receipt">
        <div class="header">
          <div class="brand">Eventron<span>Payment Receipt</span></div>
          <div class="receipt-tag">Confirmed</div>
        </div>
        <div class="body">
          <div class="success-badge">
            <div class="success-icon">✓</div>
            <div class="success-text">Payment Successful — Your ticket is confirmed!</div>
          </div>
          <div class="event-title">${details.eventTitle}</div>
          <div class="event-meta">${new Date(details.eventDate).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · ${details.eventLocation}</div>
          <div class="divider"></div>
          <div class="row"><span class="label">Attendee</span><span class="value">${details.userName}</span></div>
          <div class="row"><span class="label">Email</span><span class="value">${details.userEmail}</span></div>
          <div class="row"><span class="label">Registration ID</span><span class="value">#${details.registrationId.slice(-8).toUpperCase()}</span></div>
          <div class="row"><span class="label">Transaction ID</span><span class="value">${details.transactionId}</span></div>
          <div class="row"><span class="label">Order ID</span><span class="value">${details.orderId}</span></div>
          ${details.promoCode ? `<div class="row"><span class="label">Promo Code</span><span class="value" style="color:#4ade80">${details.promoCode}</span></div>` : ''}
          <div class="row"><span class="label">Date &amp; Time</span><span class="value">${new Date().toLocaleString('en-IN')}</span></div>
          <div class="amount-row">
            <div class="amount-label">Amount Paid</div>
            <div class="amount-value">₹${details.amount.toLocaleString('en-IN')}</div>
          </div>
        </div>
        <div class="footer">This is a system-generated receipt. Keep this for your records. · eventron.app</div>
      </div>
      <script>window.onload = function(){ window.print(); window.onafterprint = function(){ window.close(); } }<\/script>
      </body></html>`;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
    document.body.appendChild(iframe);
    iframe.contentWindow!.document.open();
    iframe.contentWindow!.document.write(receiptHtml);
    iframe.contentWindow!.document.close();
    setTimeout(() => document.body.removeChild(iframe), 10000);
  };

  const resetEventForm = () => {
    setNewEvent({
      title: '', date: '', endDate: '', location: '', locationType: 'offline', description: '', capacity: '', imageUrl: '', customQuestions: [], collaboratorEmails: [], tags: [],
      participationMode: 'individual', maxTeamSize: '5', minTeamSize: '2',
      isPaid: false, price: '', pricingType: 'overall', promoCodes: [],
      organizerPaymentDetails: undefined
    });
    setIsEditMode(false);
    setEditingEventId(null);
  };

  const handleEditClick = async (event: AppEvent) => {
    // 1. Fetch text details first (Fast)
    addToast('Loading event details...', 'info');
    const fullEvent = await getEventById(event.id, { excludeImage: true });

    if (!fullEvent) {
      addToast('Failed to load full event data', 'error');
      return;
    }

    // Format date for datetime-local input (YYYY-MM-DDThh:mm)
    const d = new Date(fullEvent.date);
    const ed = fullEvent.endDate ? new Date(fullEvent.endDate) : new Date(new Date(fullEvent.date).getTime() + 3600000); // Default +1hr if missing
    const pad = (n: number) => n < 10 ? '0' + n : n;
    const dateStr = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    const endDateStr = ed.getFullYear() + '-' + pad(ed.getMonth() + 1) + '-' + pad(ed.getDate()) + 'T' + pad(ed.getHours()) + ':' + pad(ed.getMinutes());

    // 2. Open Modal Immediately with what we have (Image might be empty initially)
    setNewEvent({
      title: fullEvent.title,
      date: dateStr,
      endDate: endDateStr,
      location: fullEvent.location,
      locationType: fullEvent.locationType || 'offline',
      description: fullEvent.description,
      capacity: fullEvent.capacity.toString(),
      imageUrl: fullEvent.imageUrl || '', // Likely empty string here if excluded
      customQuestions: fullEvent.customQuestions || [],
      collaboratorEmails: fullEvent.collaboratorEmails || [],
      tags: fullEvent.tags || [],
      participationMode: fullEvent.participationMode || 'individual',
      maxTeamSize: fullEvent.maxTeamSize?.toString() || '5',
      minTeamSize: fullEvent.minTeamSize?.toString() || '2',
      isPaid: Boolean(fullEvent.isPaid),
      price: fullEvent.price?.toString() || '',
      pricingType: fullEvent.pricingType || 'overall',
      promoCodes: fullEvent.promoCodes || [],
      organizerPaymentDetails: fullEvent.organizerPaymentDetails
    });
    setEditingEventId(fullEvent.id);
    setIsEditMode(true);
    setIsCreateModalOpen(true);

    // 3. Fetch Image in Background (Slow part)
    // We only fetch if we didn't get it (which we intentionally didn't)
    try {
      const imageStr = await getEventImage(fullEvent.id);
      if (imageStr) {
        setNewEvent(prev => {
          if (prev.imageUrl && prev.imageUrl.startsWith('data:')) return prev;
          return { ...prev, imageUrl: imageStr };
        });
      }
    } catch (e) {
      console.error("Background image fetch failed", e);
    }
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title || !newEvent.date || !currentUser || !newEvent.capacity) return;

    try {
      const tagsForImage = (newEvent.tags && newEvent.tags.length > 0)
        ? newEvent.tags.join(',')
        : 'technology,abstract';

      const generatedImageUrl = `https://picsum.photos/seed/${Math.floor(Math.random() * 1000000)}/800/400`;

      const evtDataCommon: any = {
        title: newEvent.title,
        date: newEvent.date,
        endDate: newEvent.endDate,
        location: newEvent.location,
        locationType: newEvent.locationType,
        description: newEvent.description,
        capacity: parseInt(newEvent.capacity) || 0,
        customQuestions: newEvent.customQuestions || [],
        collaboratorEmails: newEvent.collaboratorEmails || [],
        tags: newEvent.tags || [],
        organizerId: currentUser.id,
        isRegistrationOpen: true,
        participationMode: newEvent.participationMode,
        maxTeamSize: parseInt(newEvent.maxTeamSize) || 0,
        minTeamSize: parseInt(newEvent.minTeamSize) || 0,
        isPaid: newEvent.isPaid,
        price: newEvent.isPaid ? parseFloat(newEvent.price) : 0,
        pricingType: newEvent.pricingType || 'overall',
        promoCodes: newEvent.promoCodes,
        organizerPaymentDetails: newEvent.organizerPaymentDetails
      };

      if (newEvent.imageUrl && newEvent.imageUrl.includes('/api/event-image/')) {
        // Prevent overwriting the database base64 string with the API fetch URL
      } else {
        evtDataCommon.imageUrl = newEvent.imageUrl || generatedImageUrl;
      }

      if (new Date(evtDataCommon.endDate) <= new Date(evtDataCommon.date)) {
        addToast('End date must be after start date', 'error');
        return;
      }

      let success = false;

      if (isEditMode && editingEventId) {
        success = await updateEvent({ id: editingEventId, ...evtDataCommon });
        if (success) addToast('Event updated successfully', 'success');
      } else {
        const created = await saveEvent(evtDataCommon);
        success = !!created;
        if (success) addToast('Event created successfully', 'success');
      }

      if (success) {
        await loadData();
        setIsCreateModalOpen(false);
        resetEventForm();
      }
    } catch (err: any) {
      console.error('Event save failed:', err);
      addToast(err.message || (isEditMode ? 'Failed to update event' : 'Failed to create event'), 'error');
    }
  };

  const handleGenerateDescription = async () => {
    if (!newEvent.title || !newEvent.date) {
      addToast('Please enter a title and date first', 'error');
      return;
    }
    setIsGeneratingAI(true);
    const result = await generateEventDescription(newEvent.title, newEvent.date, newEvent.location);
    if (result && !result.startsWith('Error:')) {
      setNewEvent(prev => ({ ...prev, description: result }));
      addToast('Description generated!', 'success');
    } else {
      addToast(`AI Error: ${result?.replace('Error:', '').trim() || 'Service unavailable'}`, 'error');
    }
    setIsGeneratingAI(false);
  };

  const [isRegistering, setIsRegistering] = useState(false);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      addToast('Please enter your email', 'error');
      return;
    }

    setAuthLoading(true);
    const result = await resetUserPassword(resetEmail);
    setAuthLoading(false);

    if (result.success) {
      addToast(result.message, 'success');
      // If it's a success, go locally back to signin.
      if (!result.message.includes('DEMO MODE')) {
        setIsAuthMode('signin');
        setResetEmail('');
      }
    } else {
      addToast(result.message, 'error');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventForReg || !currentUser || isRegistering) return;

    setIsRegistering(true);

    try {
      // Re-fetch event to check if status changed (e.g. organizer closed it while modal was open)
      // Use getEventById to ensure we get the specific event regardless of pagination limits
      const latestEvent = await getEventById(selectedEventForReg.id, { excludeImage: true });

      if (!latestEvent || latestEvent.isRegistrationOpen === false) {
        addToast('Registration is no longer open for this event', 'error');
        setSelectedEventForReg(null);
        setIsRegistering(false);
        return;
      }

      const now = new Date();
      if (now >= new Date(latestEvent.date)) {
        addToast('This event has already started or ended', 'error');
        setSelectedEventForReg(null);
        setIsRegistering(false);
        return;
      }

      // Use current user's email
      const email = currentUser.email;

      // Check existing
      const exists = registrations.find(r =>
        r.eventId === selectedEventForReg.id && r.participantEmail === email
      );

      if (exists) {
        addToast('You are already registered for this event', 'error');
        setIsRegistering(false);
        return;
      }

      // Check for required custom questions
      if (selectedEventForReg.customQuestions) {
        const missingRequired = selectedEventForReg.customQuestions.find(
          q => q.required && (!registrationAnswers[q.id] || registrationAnswers[q.id].trim() === '')
        );

        if (missingRequired) {
          addToast(`Please answer the required question: "${missingRequired.question}"`, 'error');
          setIsRegistering(false);
          return;
        }
      }

      const currentRegCount = registrations.filter(r =>
        r.eventId === selectedEventForReg.id &&
        (r.status === RegistrationStatus.APPROVED || r.status === RegistrationStatus.PENDING)
      ).length;

      const isCapacityFull = currentRegCount >= (selectedEventForReg.capacity as number);
      let initialStatus = isCapacityFull ? RegistrationStatus.WAITLISTED : RegistrationStatus.PENDING;

      if (teamRegistrationData.mode === 'team') {
        initialStatus = RegistrationStatus.TEAM_AWAITING_SUBMISSION;
      }

      let finalRegData: any = {
        eventId: selectedEventForReg.id,
        participantId: currentUser.id,
        participantName: currentUser.name,
        participantEmail: email,
        status: initialStatus,
        attended: false,
        registeredAt: new Date().toISOString(),
        answers: registrationAnswers,
        participantAvatarUrl: currentUser.avatarUrl
      };

      // Payment Logic has been moved to after approval
      // Default to PENDING for all paid events unless waitlisted

      if (selectedEventForReg.isPaid || (selectedEventForReg.price && Number(selectedEventForReg.price) > 0)) {
        // Even if promo code makes it free, we might still want approval first?
        // For SIMPLICITY: Only full paying users need approval->payment flow.
        // If price becomes 0 due to promo code, maybe auto-approve?
        // Let's stick to: All paid events go to PENDING first.

        // We don't do anything special here, just ensure we don't trigger razorpay.
        // finalRegData.status is already set to initialStatus (PENDING or WAITLISTED)
      }

      if (teamRegistrationData.mode === 'team') {
        if (teamRegistrationData.subMode === 'create') {
          if (!teamRegistrationData.teamName.trim()) {
            addToast('Please enter a team name', 'error');
            setIsRegistering(false);
            return;
          }
          const team = await createTeam({
            name: teamRegistrationData.teamName,
            eventId: selectedEventForReg.id,
            leaderId: currentUser.id,
            members: [{ userId: currentUser.id, userName: currentUser.name, email: currentUser.email }],
            createdAt: new Date().toISOString(),
            inviteCode: '' // filled by service
          });
          if (team) {
            setTeams(prev => [...prev, team]);
            finalRegData.teamId = team.id;
            finalRegData.teamName = team.name;
            finalRegData.isTeamLeader = true;
            finalRegData.participationType = 'team';
            addToast(`Team "${team.name}" created! Invite Code: ${team.inviteCode}`, 'success');
          } else {
            throw new Error("Failed to create team");
          }
        } else {
          if (!teamRegistrationData.inviteCode.trim()) {
            addToast('Please enter an invite code', 'error');
            setIsRegistering(false);
            return;
          }
          const team = await getTeamByInviteCode(teamRegistrationData.inviteCode);
          if (!team) {
            addToast("Invalid invite code", "error");
            setIsRegistering(false);
            return;
          }
          if (team.eventId !== selectedEventForReg.id) {
            addToast("This invite code is for a different event", "error");
            setIsRegistering(false);
            return;
          }

          const teamRegs = registrations.filter(r => r.teamId === team.id);
          const leaderReg = teamRegs.find(r => r.isTeamLeader);

          if (leaderReg && leaderReg.status === RegistrationStatus.REJECTED) {
            addToast("This team's registration was rejected", "error");
            setIsRegistering(false);
            return;
          }

          if (team.members.length >= (selectedEventForReg.maxTeamSize || 99)) {
            addToast("Team is already full", "error");
            setIsRegistering(false);
            return;
          }

          await joinTeam(team.id, { userId: currentUser.id, userName: currentUser.name, email: currentUser.email });
          finalRegData.teamId = team.id;
          finalRegData.teamName = team.name;
          finalRegData.isTeamLeader = false;
          finalRegData.participationType = 'team';

          // If leader is already approved, new member gets approved immediately!
          if (leaderReg && leaderReg.status === RegistrationStatus.APPROVED) {
            finalRegData.status = RegistrationStatus.APPROVED;
          } else if (leaderReg && leaderReg.status === RegistrationStatus.PENDING) {
            finalRegData.status = RegistrationStatus.PENDING;
          } else if (leaderReg && leaderReg.status === RegistrationStatus.AWAITING_PAYMENT) {
            finalRegData.status = RegistrationStatus.AWAITING_PAYMENT;
          }
        }
      } else {
        finalRegData.participationType = 'individual';
      }

      const created = await addRegistration(finalRegData);

      if (created) {
        await loadData();
        setSelectedEventForReg(null);
        setRegistrationAnswers({});
        setAppliedPromoCode(null);
        setTeamRegistrationData({ mode: 'individual', subMode: 'create', teamName: '', inviteCode: '' });

        if (created.status === RegistrationStatus.WAITLISTED) {
          addToast('Event is full. You have been added to the waitlist.', 'info');
        } else if (selectedEventForReg.isPaid || (selectedEventForReg.price && Number(selectedEventForReg.price) > 0)) {
          addToast('Registration submitted! Please wait for organizer approval to proceed with payment.', 'success');
        } else {
          addToast(teamRegistrationData.mode === 'team' ? 'Team registration submitted!' : 'Registration submitted! Waiting for approval.', 'success');
        }
      } else {
        addToast('Registration failed or event is closed', 'error');
      }
    } catch (error: any) {
      console.error("Registration Error:", error);
      addToast(`Error: ${error.message || 'An error occurred during registration'}`, 'error');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleTeamSubmit = async (teamId: string) => {
    const teamRegs = registrations.filter(r => r.teamId === teamId);
    const teamObj = teams.find(t => t.id === teamId);
    const event = events.find(e => e.id === (teamRegs[0]?.eventId || teamObj?.eventId));
    const minSize = event?.minTeamSize || 1;
    const membersCount = Math.max(teamRegs.length, teamObj?.members?.length || 0);

    if (membersCount < minSize) {
      addToast(`Your team is incomplete. You need at least ${minSize} members to submit (Current: ${membersCount}).`, 'error');
      return;
    }

    const teamName = teamRegs[0]?.teamName || teamObj?.name || 'Team';
    if (!window.confirm(`Submit team "${teamName}" with ${membersCount} members for organizer approval?`)) return;

    setIsRegistering(true);
    try {
      await Promise.all(teamRegs.map(r => updateRegistrationStatus(r.id, RegistrationStatus.PENDING)));
      addToast('Team registration submitted for approval!', 'success');
      loadData(true);
      setSelectedRegistrationDetails(null);
    } catch (error) {
      console.error(error);
      addToast('Failed to submit team registration', 'error');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleDeleteRegistration = async (regId: string) => {
    if (!confirm('Are you sure you want to delete this registration? The attendee will be able to register again.')) return;
    try {
      const success = await deleteRegistration(regId);
      if (success) {
        setRegistrations(prev => prev.filter(r => r.id !== regId));
        addToast('Registration deleted successfully', 'success');
      } else {
        addToast('Failed to delete registration', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('An error occurred while deleting', 'error');
    }
  };

  const getEventTotalAmount = (event: AppEvent | undefined, participationType?: string, teamId?: string): number => {
    if (!event || !event.isPaid) return 0;
    const basePrice = Number(event.price || 0);
    if (participationType === 'team' && teamId && event.pricingType === 'per_person') {
      const teamRegs = registrations.filter(r => r.teamId === teamId && r.status !== RegistrationStatus.REJECTED);
      const teamObj = teams.find(t => t.id === teamId);
      const count = Math.max(teamRegs.length, teamObj?.members?.length || 1);
      return basePrice * count;
    }
    return basePrice;
  };

  const handleTeamStatusUpdate = async (teamId: string, status: RegistrationStatus) => {
    const teamRegs = registrations.filter(r => r.teamId === teamId);
    if (teamRegs.length === 0) return;

    const event = events.find(e => e.id === teamRegs[0].eventId);
    const minSize = event?.minTeamSize || 1;
    const maxSize = event?.maxTeamSize || 99;
    const membersCount = teamRegs.length;
    const teamName = teamRegs[0].teamName || 'Team';

    // Verify team size range when approving
    if (status === RegistrationStatus.APPROVED) {
      if (membersCount < minSize) {
        addToast(`Cannot approve team. Minimum team size is ${minSize} members (currently ${membersCount}).`, 'error');
        return;
      }
      if (membersCount > maxSize) {
        addToast(`Cannot approve team. Maximum team size is ${maxSize} members (currently ${membersCount}).`, 'error');
        return;
      }
    }

    const isPaidEvent = Boolean(event && (event.isPaid || (event.price && Number(event.price) > 0)));
    const leaderReg = teamRegs.find(r => r.isTeamLeader) || teamRegs[0];
    const totalTeamFee = getEventTotalAmount(event, 'team', teamId);

    let finalStatus = status;
    if (status === RegistrationStatus.APPROVED && isPaidEvent) {
      const isPaid = leaderReg?.paymentDetails?.status === PaymentStatus.COMPLETED;
      if (!isPaid) {
        finalStatus = RegistrationStatus.AWAITING_PAYMENT;
      }
    }

    const pricingNote = event?.pricingType === 'per_person'
      ? `(₹${event.price || 0} × ${membersCount} members = ₹${totalTeamFee})`
      : `(₹${totalTeamFee} flat fee)`;

    const confirmMessage = finalStatus === RegistrationStatus.APPROVED
      ? `Approve entire team "${teamName}" (${membersCount} members)?`
      : finalStatus === RegistrationStatus.AWAITING_PAYMENT
      ? `Approve team "${teamName}" (${membersCount} members) and request total payment of ₹${totalTeamFee} ${pricingNote}?`
      : `Reject entire team "${teamName}" (${membersCount} members)?`;

    if (!confirm(confirmMessage)) return;

    setIsRegistering(true);
    try {
      // 1. Update Database for all team registrations together
      await Promise.all(teamRegs.map(r => updateRegistrationStatus(r.id, finalStatus)));

      // 2. Send in-app notification to all team members
      for (const targetReg of teamRegs) {
        if (event) {
          let title = 'Registration Update';
          let message = `Your team "${teamName}" status has been updated to ${finalStatus}.`;
          let type: 'info' | 'success' | 'warning' = 'info';

          if (finalStatus === RegistrationStatus.APPROVED) {
            title = 'Team Registration Approved! 🎉';
            message = `Your team "${teamName}" has been approved for "${event.title}"!`;
            type = 'success';
          } else if (finalStatus === RegistrationStatus.AWAITING_PAYMENT) {
            title = 'Team Approved: Payment Required 🎟️';
            message = `Your team "${teamName}" was approved for "${event.title}". Team leader must complete total payment of ₹${totalTeamFee} to confirm your spots.`;
            type = 'warning';
          } else if (finalStatus === RegistrationStatus.REJECTED) {
            title = 'Team Registration Rejected';
            message = `Your team "${teamName}" registration for "${event.title}" has been rejected.`;
            type = 'warning';
          }

          await addNotification({
            userId: targetReg.participantId,
            title,
            message,
            type,
            link: 'my-tickets'
          });
        }
      }

      // 3. Send email to TEAM LEADER via SMTP!
      if (event && leaderReg && (finalStatus === RegistrationStatus.APPROVED || finalStatus === RegistrationStatus.AWAITING_PAYMENT)) {
        await sendStatusUpdateEmail(
          leaderReg.participantEmail,
          leaderReg.participantName,
          event.title,
          finalStatus,
          {
            isTeam: true,
            teamName,
            membersCount,
            isPaid: isPaidEvent,
            price: totalTeamFee,
            eventDate: event.date ? format(new Date(event.date), 'PPP p') : '',
            eventLocation: event.location || ''
          }
        );
      }

      addToast(
        finalStatus === RegistrationStatus.APPROVED
          ? `Team "${teamName}" approved! Approval email sent to team leader (${leaderReg.participantEmail}).`
          : finalStatus === RegistrationStatus.AWAITING_PAYMENT
          ? `Team "${teamName}" approved! Payment notice emailed to team leader (${leaderReg.participantEmail}).`
          : `Team "${teamName}" rejected.`,
        finalStatus === RegistrationStatus.REJECTED ? 'info' : 'success'
      );

      await loadData();
    } catch (err) {
      console.error("Team approval error:", err);
      addToast("Failed to update team registration status", "error");
    } finally {
      setIsRegistering(false);
    }
  };

  const handleStatusUpdate = async (regId: string, status: RegistrationStatus) => {
    const reg = registrations.find(r => r.id === regId);
    if (!reg) return;

    // For team registrations, always enforce team-wise approval
    if (reg.participationType === 'team' && reg.teamId) {
      return handleTeamStatusUpdate(reg.teamId, status);
    }

    const event = events.find(e => e.id === reg?.eventId);
    let finalStatus = status;
    const isPaidEvent = Boolean(event && (event.isPaid || (event.price && Number(event.price) > 0)));

    if (status === RegistrationStatus.APPROVED && isPaidEvent) {
      const isPaid = reg?.paymentDetails?.status === PaymentStatus.COMPLETED;
      if (!isPaid) {
        finalStatus = RegistrationStatus.AWAITING_PAYMENT;
      }
    }

    await updateRegistrationStatus(reg.id, finalStatus);

    if (event) {
      let title = 'Registration Update';
      let message = `Your registration status for "${event.title}" has been updated to ${finalStatus}.`;
      let type: 'info' | 'success' | 'warning' = 'info';

      if (finalStatus === RegistrationStatus.APPROVED) {
        title = 'Registration Approved! 🎉';
        message = `You're in! Your registration for "${event.title}" was approved.`;
        type = 'success';
      } else if (finalStatus === RegistrationStatus.AWAITING_PAYMENT) {
        title = 'Action Required: Payment 🎟️';
        message = `Your registration for "${event.title}" is tentatively approved. Please proceed to payment to confirm your spot.`;
        type = 'warning';
      } else if (finalStatus === RegistrationStatus.REJECTED) {
        title = 'Registration Rejected';
        message = `Your registration for "${event.title}" has been rejected.`;
        type = 'warning';
      }

      await sendStatusUpdateEmail(reg.participantEmail, reg.participantName, event.title, finalStatus, {
        isTeam: false,
        isPaid: isPaidEvent,
        price: Number(event.price || 0),
        eventDate: event.date ? format(new Date(event.date), 'PPP p') : '',
        eventLocation: event.location || ''
      });

      await addNotification({
        userId: reg.participantId,
        title,
        message,
        type,
        link: 'my-tickets'
      });
    }

    await loadData();
    addToast(`Participant status updated to ${finalStatus}`, 'success');
  };

  const handleLatePayment = (reg: Registration, event: AppEvent) => {
    setSelectedRegForPayment({ reg, event });
    // Reset payment promo state
    setPaymentPromoCode('');
    setPaymentAppliedPromo(null);
    setPaymentPromoMessage(null);
    setIsPaymentProcessing(false);
    setIsPaymentSuccess(false);
    setIsPaymentModalOpen(true);
  };

  const handleProceedToPayment = async () => {
    if (!selectedRegForPayment || isPaymentProcessing) return;
    setIsPaymentProcessing(true);
    const { reg, event } = selectedRegForPayment;

    // Calculate Final Amount using overall or per-person team size
    let amount = getEventTotalAmount(event, reg.participationType, reg.teamId);

    if (paymentAppliedPromo) {
      if (paymentAppliedPromo.type === 'percentage') {
        amount = amount - ((amount * paymentAppliedPromo.value) / 100);
      } else {
        amount = amount - paymentAppliedPromo.value;
      }
      amount = Math.max(0, amount);
    }

    if (amount <= 0) {
      // Free due to promo?
      if (reg.participationType === 'team' && reg.teamId) {
        const teamRegs = registrations.filter(r => r.teamId === reg.teamId);
        await Promise.all(teamRegs.map(r => updateRegistrationStatus(r.id, RegistrationStatus.APPROVED)));
      } else {
        await updateRegistrationStatus(reg.id, RegistrationStatus.APPROVED);
      }
      addToast("Promo code covered entire cost! Ticket confirmed.", "success");
      await loadData();
      setIsPaymentSuccess(true);
      setTimeout(() => {
        setIsPaymentModalOpen(false);
        setIsPaymentProcessing(false);
        setIsPaymentSuccess(false);
        navigate('/myticket');
      }, 1500);
      return;
    }

    try {
      // 1. Check in Cashfree whether user has ALREADY paid for this event
      try {
        const pendingOrderHint = localStorage.getItem(`pending_order_${reg.id}`) || reg.pendingOrderId || reg.paymentDetails?.orderId;
        const checkRes = await fetch(`${API_BASE}/api/check-payment-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            registrationId: reg.id,
            eventId: event.id,
            userId: currentUser?.id,
            teamId: reg.teamId,
            orderId: pendingOrderHint
          })
        });
        const checkData = await checkRes.json();

        if (checkData.success && checkData.already_paid) {
          // ALREADY PAID! Make transaction successful without proceeding to payment page
          const paidAmount = Number(checkData.amount || amount);
          const paymentInfo = {
            paymentDetails: {
              status: PaymentStatus.COMPLETED,
              amount: paidAmount,
              currency: checkData.currency || 'INR',
              transactionId: checkData.order_id,
              orderId: checkData.order_id,
              promocodeApplied: paymentAppliedPromo?.code
            }
          };

          if (reg.participationType === 'team' && reg.teamId) {
            const teamRegs = registrations.filter(r => r.teamId === reg.teamId);
            await Promise.all(teamRegs.map(r => updateRegistrationStatus(r.id, RegistrationStatus.APPROVED, r.id === reg.id ? paymentInfo : undefined)));
          } else {
            await updateRegistrationStatus(reg.id, RegistrationStatus.APPROVED, paymentInfo);
          }

          try {
            localStorage.removeItem(`pending_order_${reg.id}`);
          } catch (_) {}

          addToast("Payment already verified from Cashfree! Ticket confirmed.", "success");
          await loadData(true);
          setIsPaymentSuccess(true);
          setTimeout(() => {
            setIsPaymentModalOpen(false);
            setIsPaymentProcessing(false);
            setIsPaymentSuccess(false);
            navigate('/myticket');
          }, 1500);
          return; // DO NOT PROCEED TO PAYMENT PAGE!
        }
      } catch (checkErr) {
        console.warn("Could not check already-paid status in Cashfree:", checkErr);
      }

      const loaded = await loadCashfree();
      if (!loaded) {
        addToast('Cashfree SDK failed to load', 'error');
        setIsPaymentProcessing(false);
        return;
      }

      // 2. Not paid yet: Create Order and proceed to payment page
      const baseUrl = API_BASE;
      const orderRes = await fetch(`${baseUrl}/api/create-payment-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amount,
          currency: 'INR',
          receipt: `rcpt_late_${Date.now()}`,
          notes: {
            eventId: event.id,
            userId: currentUser?.id,
            registrationId: reg.id,
            teamId: reg.teamId,
            promoCode: paymentAppliedPromo?.code
          }
        })
      });

      const orderData = await orderRes.json();
      if (!orderData.success || !orderData.payment_session_id) {
        addToast('Payment order creation failed', 'error');
        setIsPaymentProcessing(false);
        return;
      }

      // Save pending order so it can be verified if internet disconnects
      try {
        localStorage.setItem(`pending_order_${reg.id}`, orderData.order_id);
      } catch (_) {}
      updateRegistrationStatus(reg.id, reg.status, { pendingOrderId: orderData.order_id } as any);

      const cashfreeMode = (import.meta.env.VITE_CASHFREE_ENV || 'SANDBOX').toLowerCase();
      const cashfree = await (window as any).Cashfree({ mode: cashfreeMode }); 
      
      cashfree.checkout({
        paymentSessionId: orderData.payment_session_id,
        redirectTarget: "_modal"
      }).then(async (result: any) => {
        setIsPaymentProcessing(false);
        if (result.error) {
          addToast(`Payment failed: ${result.error.message}`, 'warning');
          return;
        }
        
        if (result.paymentDetails) {
          // Verify payment & increment promo usage on backend
          try {
            const baseUrl = API_BASE;
            const verifyRes = await fetch(`${baseUrl}/api/verify-payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                order_id: orderData.order_id,
                eventId: reg.eventId,
                promoCode: paymentAppliedPromo?.code
              })
            });
            const verifyData = await verifyRes.json();
            if (!verifyData.success) {
               addToast(`Payment verification failed: ${verifyData.error}`, 'error');
               return;
            }
          } catch (e) { 
             console.error("verify-payment failed", e);
             addToast('Payment verification failed', 'error');
             return;
          }

          // Update local/mongo status for this registration and all team members if applicable
          const paymentInfo = {
            paymentDetails: {
              status: PaymentStatus.COMPLETED,
              amount: amount,
              currency: 'INR',
              transactionId: orderData.order_id,
              orderId: orderData.order_id,
              promocodeApplied: paymentAppliedPromo?.code
            }
          };

          if (reg.participationType === 'team' && reg.teamId) {
            const teamRegs = registrations.filter(r => r.teamId === reg.teamId);
            await Promise.all(teamRegs.map(r => updateRegistrationStatus(r.id, RegistrationStatus.APPROVED, r.id === reg.id ? paymentInfo : undefined)));
          } else {
            await updateRegistrationStatus(reg.id, RegistrationStatus.APPROVED, paymentInfo);
          }

          try {
            localStorage.removeItem(`pending_order_${reg.id}`);
          } catch (_) {}

          addToast("Payment successful! Ticket confirmed.", "success");
          loadData();
          setIsPaymentSuccess(true);
          setTimeout(() => {
            setIsPaymentModalOpen(false);
            setIsPaymentSuccess(false);
            navigate('/myticket');
          }, 1500);
        }
      }).catch((e: any) => {
        setIsPaymentProcessing(false);
        addToast(`Payment Error: ${e.message}`, 'error');
      });

    } catch (e: any) {
      console.error("Payment Error", e);
      addToast(`Payment Error: ${e.message}`, 'error');
      setIsPaymentProcessing(false);
    }
  };

  const handleSendReminders = async (event: AppEvent) => {
    if (!confirm(`Send email reminders to all approved attendees for "${event.title}"?`)) return;

    setIsSendingReminders(true);

    const approvedRegs = registrations.filter(
      r => r.eventId === event.id && r.status === RegistrationStatus.APPROVED
    );

    if (approvedRegs.length === 0) {
      addToast('No approved attendees to notify.', 'info');
      setIsSendingReminders(false);
      return;
    }

    let count = 0;
    // Send in parallel (or sequential if avoiding rate limits, but parallel is fine for simulation)
    await Promise.all(approvedRegs.map(async (reg) => {
      await sendReminderEmail(
        reg.participantEmail,
        reg.participantName,
        event.title,
        event.date,
        event.location,
        reg.participantId,
        event.id,
        addNotification
      );
      count++;
    }));

    setIsSendingReminders(false);
    addToast(`Sent reminders to ${count} attendees.`, 'success');
  };

  const handleBroadcastAnnouncement = async () => {
    if (!organizerSelectedEventId || !announcementText.trim()) {
      addToast('Please enter a message to broadcast.', 'error');
      return;
    }
    const event = events.find(e => e.id === organizerSelectedEventId);
    if (!event) return;

    setIsBroadcasting(true);
    try {
      const approvedParticipants = registrations.filter(r =>
        r.eventId === event.id &&
        r.status === RegistrationStatus.APPROVED
      );

      if (approvedParticipants.length === 0) {
        addToast('No approved participants to notify.', 'info');
        return;
      }

      await Promise.all(approvedParticipants.map(participant =>
        addNotification({
          userId: participant.participantId,
          title: `Announcement: ${event.title}`,
          message: announcementText.trim(),
          type: 'info',
          link: 'my-tickets'
        })
      ));

      addToast(`Announcement broadcasted to ${approvedParticipants.length} participants!`, 'success');
      setAnnouncementText('');
      setIsAnnouncementModalOpen(false);
    } catch (e) {
      console.error(e);
      addToast('Failed to broadcast announcement.', 'error');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleExportCSV = (event: AppEvent) => {
    const eventRegs = registrations.filter(r => r.eventId === event.id);
    if (eventRegs.length === 0) {
      addToast('No participants to export.', 'info');
      return;
    }

    // Header
    const headers = ['Participant Name', 'Email', 'Status', 'Attendance', 'Attendance Time', 'Registered At'];

    // Add custom questions to headers
    const customQuestions = event.customQuestions || [];
    customQuestions.forEach(q => headers.push(q.question));

    const csvRows = [headers.join(',')];

    eventRegs.forEach(reg => {
      const row = [
        `"${reg.participantName.replace(/"/g, '""')}"`,
        `"${reg.participantEmail.replace(/"/g, '""')}"`,
        `"${reg.status}"`,
        `"${reg.attended ? 'Present' : 'Absent'}"`,
        `"${reg.attendanceTime ? format(new Date(reg.attendanceTime), 'yyyy-MM-dd HH:mm:ss') : '-'}"`,
        `"${format(new Date(reg.registeredAt), 'yyyy-MM-dd HH:mm:ss')}"`
      ];

      // Add answers for custom questions
      customQuestions.forEach(q => {
        const answer = reg.answers ? reg.answers[q.id] || '' : '';
        row.push(`"${String(answer).replace(/"/g, '""')}"`);
      });

      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${event.title.replace(/\s+/g, '_')}_participants.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('CSV exported successfully', 'success');
  };

  const [newMessageText, setNewMessageText] = useState('');
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventForDetails || !currentUser || !newMessageText.trim()) return;

    const messageData = {
      eventId: selectedEventForDetails.id,
      userId: currentUser.id,
      userName: currentUser.name,
      content: newMessageText.trim()
    };

    await addMessage(messageData);
    setNewMessageText('');
    const msgs = await getMessages(selectedEventForDetails.id);
    setMessages(msgs);

    // Send notifications to OTHER participants
    const otherParticipants = registrations.filter(r =>
      r.eventId === selectedEventForDetails.id &&
      r.participantId !== currentUser.id &&
      r.status === RegistrationStatus.APPROVED
    );

    // Avoid blocking UI for notifications
    Promise.all(otherParticipants.map(participant =>
      addNotification({
        userId: participant.participantId,
        title: `New message in "${selectedEventForDetails.title}"`,
        message: `${currentUser.name} says: ${newMessageText.trim().substring(0, 50)}${newMessageText.trim().length > 50 ? '...' : ''}`,
        type: 'info',
        link: 'browse' // Or specific link to discussion if supported
      })
    ));
  };

  const handleManualAttendance = async (regId: string) => {
    // Security Check: Verify Organizer Ownership or Collaborative Rights
    const reg = registrations.find(r => r.id === regId);
    if (reg) {
      const event = events.find(e => e.id === reg.eventId);
      if (event) {
        const isOrganizer = currentUser?.role === 'organizer' && event.organizerId === currentUser?.id;
        const isCollaborator = event.collaboratorEmails?.includes(currentUser?.email || '');

        if (!isOrganizer && !isCollaborator) {
          addToast('Permission Denied: Only the event organizer or co-organizers can mark attendance.', 'error');
          return;
        }
      }
    }

    if (!confirm('Mark this participant as present?')) return;

    const success = await markAttendance(regId);

    if (success) {
      addToast('Attendance marked manually', 'success');
      await loadData();
    } else {
      addToast('Failed to mark attendance. Ensure participant is approved.', 'error');
    }
  };

  const handleScan = async (data: string) => {
    // Prevent multiple scans while processing or showing result
    if (scanResult) return;

    try {
      const payload = JSON.parse(data);
      if (!payload.id) throw new Error('Invalid QR Code');

      const currentTs = Math.floor(Date.now() / 180000);
      if (payload.ts !== undefined && payload.ts !== 'static') {
        if (currentTs - payload.ts > 1 || payload.ts > currentTs) {
          setScanResult({ type: 'error', message: 'Ticket Expired, please refresh' });
          setTimeout(() => setScanResult(null), 3000);
          return;
        }
      }

      // Security Check: Verify Organizer Ownership or Collaborative Rights
      const reg = registrations.find(r => r.id === payload.id);
      if (!reg) {
        setScanResult({ type: 'error', message: 'Ticket not recognized' });
        setTimeout(() => setScanResult(null), 3000);
        return;
      }

      const event = events.find(e => e.id === reg.eventId);
      if (!event) {
        setScanResult({ type: 'error', message: 'Event not found' });
        setTimeout(() => setScanResult(null), 3000);
        return;
      }

      const isOrganizer = currentUser?.role === 'organizer' && event.organizerId === currentUser?.id;
      const isCollaborator = event.collaboratorEmails?.includes(currentUser?.email || '');

      if (!isOrganizer && !isCollaborator) {
        setScanResult({ type: 'error', message: 'Permission Denied' });
        setTimeout(() => setScanResult(null), 3000);
        return;
      }

      if (reg.status !== RegistrationStatus.APPROVED) {
        setScanResult({ type: 'error', message: 'Participant Pending/Rejected' });
        setTimeout(() => setScanResult(null), 3000);
        return;
      }

      if (reg.attended) {
        setScanResult({ type: 'error', message: 'Ticket Already Used' });
        setTimeout(() => setScanResult(null), 3000);
        return;
      }

      const success = await markAttendance(payload.id);

      if (success) {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setScanResult({ type: 'success', message: `${reg.participantName} • ${timestamp}` });
        await loadData();
      } else {
        setScanResult({ type: 'error', message: 'Check-in Failed / Already Used' });
      }
    } catch (e) {
      setScanResult({ type: 'error', message: 'Invalid QR Format' });
    }

    // Auto-clear result to resume scanning
    setTimeout(() => setScanResult(null), 3000);
  };

  const downloadTicket = async () => {
    const element = document.getElementById('digital-ticket-card');
    if (!element) return;

    try {
      addToast("Preparing ticket...", "info");

      if (document.fonts) {
        await document.fonts.ready;
      }

      const canvas = await html2canvas(element, {
        backgroundColor: null,
        scale: 3,
        logging: false,
        useCORS: true,
        onclone: (clonedDoc) => {
          const clonedCard = clonedDoc.getElementById('digital-ticket-card');
          if (clonedCard) {
            clonedCard.style.transform = 'none';
            clonedCard.style.animation = 'none';

            const attendeeName = clonedCard.querySelector('.ticket-attendee-name');
            if (attendeeName) {
              const el = attendeeName as HTMLElement;
              el.style.overflow = 'visible';
              el.style.paddingRight = '20px';
              el.style.maxWidth = 'none';
              el.style.textOverflow = 'clip';

            }
          }
        },
      });

      const pngFile = canvas.toDataURL("image/png", 1.0);
      const downloadLink = document.createElement("a");
      downloadLink.download = `Eventron-Ticket-${selectedTicket?.id.slice(0, 8) || 'Pass'}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();

      addToast("Ticket saved to gallery!", "success");
    } catch (err) {
      console.error("Ticket download failed", err);
      addToast("Failed to save ticket", "error");
    }
  };

  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanNational = loginNationalNumber.replace(/[^0-9]/g, '');
    if (!cleanNational || cleanNational.length < 5) {
      setAuthError('Please enter a valid phone number.');
      return;
    }

    const fullPhone = `${loginDialCode}${cleanNational}`;
    setPhoneNumber(fullPhone);
    setAuthError(null);

    setIsSendingLoginOtp(true);
    try {
      if (isAuthMode === 'signin') {
        const userExists = await checkPhoneNumberExists(fullPhone);
        if (!userExists) {
          setAuthError('This mobile number is not registered. Please sign up first.');
          setIsSendingLoginOtp(false);
          return;
        }
      }

      const confirmationResult = await signInWithPhone(fullPhone, 'sms');
      setConfirmationResult(confirmationResult);
      setOtpPurpose('login');
      setShowOtpInput(true);
      setResendCountdown(120);
      addToast(`OTP Sent to ${fullPhone} via SMS!`, 'success');
    } catch (error: any) {
      console.error(error);
      const errMsg = error.message || 'Failed to send OTP. Try again.';
      setAuthError(errMsg);
    } finally {
      setIsSendingLoginOtp(false);
    }
  };

  const handleSendProfilePhoneOtp = async () => {
    const cleanNational = profileNationalNumber.replace(/[^0-9]/g, '');
    if (!cleanNational || cleanNational.length < 5) {
      addToast('Please enter a valid phone number', 'error');
      return;
    }
    const fullPhone = `${profileDialCode}${cleanNational}`;

    if (fullPhone === currentUser?.phoneNumber && profileForm.isPhoneVerified) {
      addToast('Phone number is already verified', 'info');
      return;
    }

    setIsSendingProfilePhoneOtp(true);
    try {
      const exists = await checkPhoneNumberExists(fullPhone);
      if (exists && fullPhone !== currentUser?.phoneNumber) {
        addToast('This phone number is already linked to another account.', 'error');
        setIsSendingProfilePhoneOtp(false);
        return;
      }

      const confirmation = await signInWithPhone(fullPhone, 'sms');
      setConfirmationResult(confirmation);
      setOtpPurpose('profile');
      setShowOtpInput(true);
      setProfileForm(prev => ({ ...prev, phoneNumber: fullPhone, isPhoneVerified: false }));
      addToast(`Verification code sent to ${fullPhone} via SMS!`, 'success');
    } catch (e: any) {
      console.error(e);
      addToast(`Failed to send verification code: ${e.message || e}`, 'error');
    } finally {
      setIsSendingProfilePhoneOtp(false);
    }
  };

  const handleVerifyProfilePhoneOtp = async () => {
    if (!otp.trim()) {
      addToast('Please enter the verification code', 'error');
      return;
    }
    const cleanNational = profileNationalNumber.replace(/[^0-9]/g, '');
    const fullPhone = `${profileDialCode}${cleanNational}`;

    setIsVerifyingProfilePhoneOtp(true);
    try {
      await verifyPhoneOtp(confirmationResult, otp.trim(), fullPhone);
      setProfileForm(prev => ({ ...prev, phoneNumber: fullPhone, isPhoneVerified: true }));
      setShowOtpInput(false);
      setOtp('');
      addToast('Phone number verified successfully! Click Save Changes to update.', 'success');
    } catch (e: any) {
      console.error(e);
      addToast(e.message || 'Invalid or expired verification code.', 'error');
    } finally {
      setIsVerifyingProfilePhoneOtp(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!otp) {
      setAuthError('Please enter the OTP');
      return;
    }

    const cleanNational = loginNationalNumber.replace(/[^0-9]/g, '');
    const fullPhone = phoneNumber || `${loginDialCode}${cleanNational}`;

    setIsVerifyingLoginOtp(true);
    try {
      const user = await verifyPhoneOtp(confirmationResult, otp, fullPhone);
      if (user) {
        setCurrentUser(user);
        setIsAuthModalOpen(false);
        navigateByRole(user);
        addToast('Logged in successfully!', 'success');
        setAuthForm({ name: '', email: '', password: '', role: 'attendee' });
        setPhoneNumber('');
        setLoginNationalNumber('');
        setOtp('');
        setShowOtpInput(false);
        setLoginMethod('email');
        setAuthError(null);
      } else {
        setAuthError('Verification failed. Please try again.');
      }
    } catch (error: any) {
      console.error(error);
      setAuthError(error.message || 'Invalid OTP. Please check and try again.');
    } finally {
      setIsVerifyingLoginOtp(false);
    }
  };



  // --- Views ---

  const renderAuthModal = () => {
    if (!isAuthModalOpen) return null;

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-12 overflow-hidden bg-[#16161a]">
        {/* Modal Container */}
        <motion.div layout transition={{ type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.8 }} className={`bg-[#1c1c21] rounded-[2rem] shadow-2xl overflow-hidden w-full max-w-6xl flex flex-col ${isAuthMode === 'signup' ? 'md:flex-row-reverse' : 'md:flex-row'} relative z-10 mx-auto min-h-0 h-full max-h-[800px] border border-zinc-800`}>

          {/* Close button (mobile mostly, or overall) */}
          <button
            onClick={() => setIsAuthModalOpen(false)}
            className="absolute top-6 right-6 z-30 p-2 rounded-full bg-black/40 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all backdrop-blur-md md:hidden"
          >
            <X className="w-5 h-5" />
          </button>

          <AuthLeftPanel setIsAuthMode={setIsAuthMode} />

          {/* Right Panel - Auth Form */}
          <motion.div layout transition={{ type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.8 }} className="w-full md:w-[55%] p-8 md:p-14 bg-[#1c1c21] flex flex-col relative">

            <div className="w-full max-w-[360px] mx-auto flex-1 flex flex-col justify-center">
              {/* Top Header - Branding */}
              <div className="flex justify-start items-center mb-12 w-full">
                <img src="/eventron.png" alt="Eventron" className="h-8 md:h-10 object-contain" />
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={isAuthMode}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="flex flex-col w-full"
                >
                  {/* Heading */}
                  <div className="text-center mb-6">
                    {showOtpInput ? (
                      <>
                        <p className="text-[10px] font-bold text-zinc-500 tracking-[0.2em] uppercase mb-4">Component · 104</p>
                        <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
                          Verify code <span className="text-[#ff5c35]">Eventron</span>
                        </h2>
                        <p className="text-zinc-400 text-sm">Raised is empty. Sunk is filled.</p>
                      </>
                    ) : (
                      <>
                        <h2 className="text-4xl font-bold text-white mb-3 tracking-tight">
                          {isAuthMode === 'signin' ? 'Welcome Back' : isAuthMode === 'forgot-password' ? 'Reset Password' : 'Create Account'}
                        </h2>
                        <p className="text-zinc-400 text-sm">
                          {isAuthMode === 'signin' ? 'Let’s make your next event unforgettable.' : isAuthMode === 'forgot-password' ? 'Enter your email to receive a reset link' : 'Join Eventron'}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Form Content */}
                  {isAuthMode === 'forgot-password' ? (
                    <form onSubmit={handlePasswordReset} className="space-y-4">
                      <div className="relative">
                        <input
                          id="reset-email"
                          type="email"
                          required
                          placeholder="Email"
                          className="w-full px-5 py-3.5 rounded-xl border border-zinc-700/80 bg-zinc-800/20 text-white focus:border-zinc-500 outline-none transition-colors placeholder:text-zinc-600 text-sm font-medium"
                          value={resetEmail}
                          onChange={e => setResetEmail(e.target.value)}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={authLoading}
                        className="w-full bg-[#ff5c35] hover:bg-[#e04d2a] text-white font-medium py-3.5 rounded-full transition-colors mt-6 shadow-lg shadow-orange-900/20"
                      >
                        {authLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Send Reset Link'}
                      </button>
                      <div className="text-center mt-4">
                        <button
                          type="button"
                          onClick={() => setIsAuthMode('signin')}
                          className="text-zinc-500 text-xs hover:text-white transition-colors"
                        >
                          ← Back to Sign In
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-4">

                      {isAuthMode === 'signup' && (
                        <input
                          type="text"
                          required
                          placeholder="Full Name"
                          className="w-full px-5 py-3.5 rounded-xl border border-zinc-700/80 bg-zinc-800/20 text-white focus:border-zinc-500 outline-none transition-colors placeholder:text-zinc-600 text-sm font-medium"
                          value={authForm.name}
                          onChange={e => setAuthForm({ ...authForm, name: e.target.value })}
                        />
                      )}

                      {(loginMethod === 'email' || isAuthMode === 'signup') ? (
                        <>
                          <input
                            type="email"
                            required
                            placeholder="Email"
                            className="w-full px-5 py-3.5 rounded-xl border border-zinc-700/80 bg-zinc-800/20 text-white focus:border-zinc-500 outline-none transition-colors placeholder:text-zinc-600 text-sm font-medium"
                            value={authForm.email}
                            onChange={e => { setAuthForm({ ...authForm, email: e.target.value }); setAuthError(null); }}
                          />
                          <input
                            type="password"
                            required
                            placeholder="Password"
                            className="w-full px-5 py-3.5 rounded-xl border border-zinc-700/80 bg-zinc-800/20 text-white focus:border-zinc-500 outline-none transition-colors placeholder:text-zinc-600 text-sm font-medium"
                            value={authForm.password}
                            onChange={e => { setAuthForm({ ...authForm, password: e.target.value }); setAuthError(null); }}
                          />
                          {isAuthMode === 'signin' && (
                            <div className="text-right">
                              <button
                                type="button"
                                onClick={() => setIsAuthMode('forgot-password')}
                                className="text-xs text-[#ff5c35] hover:text-[#e04d2a] transition-colors font-medium mt-2"
                              >
                                Forgot password?
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <div>
                          {!showOtpInput ? (
                            <div className="flex gap-2">
                              <div className="relative w-28 shrink-0">
                                <select
                                  value={loginDialCode}
                                  onChange={e => setLoginDialCode(e.target.value)}
                                  className="w-full h-full px-3 py-3.5 rounded-xl border border-zinc-700/80 bg-zinc-800/20 text-white text-xs font-medium outline-none appearance-none cursor-pointer pr-7"
                                >
                                  {COUNTRY_CODES.map(c => (
                                    <option key={c.code} value={c.dialCode} className="bg-zinc-900 text-white py-1">
                                      {c.dialCode}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown className="w-3 h-3 text-zinc-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              </div>
                              <input
                                type="tel"
                                inputMode="numeric"
                                required
                                placeholder="Phone Number"
                                className="w-full px-4 py-3.5 rounded-xl border border-zinc-700/80 bg-zinc-800/20 text-white focus:border-zinc-500 outline-none transition-colors placeholder:text-zinc-600 text-sm font-medium"
                                value={loginNationalNumber}
                                onChange={e => { setLoginNationalNumber(e.target.value.replace(/[^0-9\s-]/g, '')); setAuthError(null); }}
                              />
                            </div>
                          ) : (
                            <div className="flex flex-col items-center pt-0 w-full">
                              {/* Lock Icon */}
                              <div className="w-16 h-16 rounded-full neumorphic-raised flex items-center justify-center mb-4 text-[#ff5c35]">
                                <Lock className="w-6 h-6" />
                              </div>

                              {/* Title */}
                              <h3 className="text-xl font-semibold text-white mb-2">Verify your identity</h3>
                              <p className="text-sm text-zinc-400 mb-6 text-center leading-relaxed">
                                We sent a 6-digit code to<br />
                                <span className="font-semibold text-white">{loginDialCode} {loginNationalNumber}</span>
                              </p>

                              {/* Custom OTP Input */}
                              <div className="relative flex gap-2 sm:gap-4 justify-center mb-6 w-full">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  maxLength={6}
                                  className="absolute inset-0 opacity-0 z-10 cursor-text w-full h-full"
                                  value={otp}
                                  onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                                />
                                {[0, 1, 2, 3, 4, 5].map(i => {
                                  const char = otp[i] || '';
                                  const isFilled = char.length > 0;
                                  return (
                                    <div
                                      key={i}
                                      className={`w-10 h-14 sm:w-14 sm:h-16 rounded-2xl flex items-center justify-center text-xl sm:text-2xl font-bold transition-all duration-150 ease-out ${isFilled ? 'neumorphic-sunk text-[#ff5c35] scale-95 translate-y-1' : 'neumorphic-raised text-transparent scale-100 translate-y-0'}`}
                                    >
                                      {char || '|'}
                                    </div>
                                  )
                                })}
                              </div>

                              <div className="flex w-full justify-between items-center mt-2 px-2">
                                <button type="button" onClick={() => { setShowOtpInput(false); setOtp(''); }} className="text-[11px] text-zinc-500 hover:text-white transition-colors">Change Number</button>
                                <div className="flex items-center gap-2">
                                  <RefreshCw className={`w-3.5 h-3.5 ${resendCountdown > 0 ? 'text-zinc-600' : 'text-[#ff5c35]'}`} />
                                  <button
                                    type="button"
                                    disabled={resendCountdown > 0}
                                    onClick={e => handleSendOtp(e)}
                                    className={`text-[11px] transition-colors ${resendCountdown > 0 ? 'text-zinc-600 cursor-not-allowed' : 'text-zinc-300 hover:text-white'}`}
                                  >
                                    Resend code
                                  </button>
                                  {resendCountdown > 0 && <span className="text-[11px] text-zinc-600 ml-1">available in {resendCountdown}s</span>}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Inline Error Banner */}
                      {authError && (
                        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-medium leading-snug">
                          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>{authError}</span>
                        </div>
                      )}

                      {/* CAPTCHA — only for email/password flows */}
                      {(loginMethod === 'email' || isAuthMode === 'signup') && (
                        <CaptchaWidget
                          onVerify={setCaptchaVerified}
                          resetKey={captchaResetKey}
                        />
                      )}

                      {isAuthMode === 'signup' && (
                        <div className="flex gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setAuthForm({ ...authForm, role: 'attendee' })}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors border ${authForm.role === 'attendee' ? 'border-[#ff5c35] text-[#ff5c35] bg-[#ff5c35]/10' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}
                          >
                            Participant
                          </button>
                          <button
                            type="button"
                            onClick={() => setAuthForm({ ...authForm, role: 'organizer' })}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors border ${authForm.role === 'organizer' ? 'border-[#ff5c35] text-[#ff5c35] bg-[#ff5c35]/10' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}
                          >
                            Organizer
                          </button>
                        </div>
                      )}

                      {/* Divider */}
                      <div className="flex items-center justify-center my-8">
                        <div className="h-[1px] bg-zinc-800 w-12"></div>
                        <span className="px-4 text-zinc-600 text-xs">or</span>
                        <div className="h-[1px] bg-zinc-800 w-12"></div>
                      </div>

                      {/* Social Login Button */}
                      <button
                        onClick={async () => {
                          setAuthLoading(true);
                          try {
                            const role = isAuthMode === 'signup' ? authForm.role : 'attendee';
                            const user = await loginWithGoogle(role as 'organizer' | 'attendee');
                            if (user) {
                              setCurrentUser(user);
                              setIsAuthModalOpen(false);
                              navigateByRole(user);
                              addToast('Welcome back!', 'success');
                            } else addToast('Google Sign In failed', 'error');
                          } catch (e) { console.error(e); addToast('Something went wrong', 'error'); }
                          finally { setAuthLoading(false); }
                        }}
                        className="w-full flex items-center justify-center gap-2 bg-transparent text-white py-3.5 rounded-xl font-medium border border-zinc-700/80 hover:bg-zinc-800/50 transition-colors text-sm"
                      >
                        <span>{isAuthMode === 'signup' ? 'Sign up' : 'Login'} with Google</span>
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 ml-1" />
                      </button>

                      {/* Primary CTA */}
                      <button
                        type="button"
                        disabled={authLoading || isSendingLoginOtp || isVerifyingLoginOtp}
                        onClick={(e) => {
                          if (isAuthMode === 'signup') handleSignup(e);
                          else if (loginMethod === 'phone') showOtpInput ? handleVerifyOtp(e) : handleSendOtp(e);
                          else handleLogin(e);
                        }}
                        className={`w-full py-4 rounded-xl transition-colors mt-6 text-xs tracking-widest font-bold uppercase disabled:opacity-50 flex justify-center items-center gap-2 ${showOtpInput ? 'neumorphic-button text-zinc-300 hover:text-white' : 'bg-[#ff5c35] hover:bg-[#e04d2a] text-white shadow-lg shadow-orange-900/20'}`}
                      >
                        {isSendingLoginOtp || isVerifyingLoginOtp || authLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin text-white" />
                        ) : (
                          isAuthMode === 'signup' ? 'Sign Up' : (loginMethod === 'phone' ? (showOtpInput ? 'Verify Code' : 'Send Code') : 'Login')
                        )}
                      </button>

                      {/* Toggle Mode */}
                      <div className="text-center mt-6 text-xs text-zinc-500">
                        {isAuthMode === 'signin' ? "Don't have an account? " : "Already have an account? "}
                        <button
                          onClick={() => setIsAuthMode(isAuthMode === 'signin' ? 'signup' : 'signin')}
                          className="text-[#ff5c35] hover:text-[#e04d2a] font-medium transition-colors ml-1"
                        >
                          {isAuthMode === 'signin' ? 'Sign up' : 'Login'}
                        </button>
                      </div>

                      {isAuthMode === 'signin' && (
                        <div className="flex flex-col items-center mt-3 gap-3">
                          {twilioStatus.isAvailable && (
                            <button onClick={() => { setLoginMethod(loginMethod === 'email' ? 'phone' : 'email'); setShowOtpInput(false); }} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">
                              Use {loginMethod === 'email' ? 'Phone' : 'Email'} Instead
                            </button>
                          )}
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => { setIsAuthModalOpen(false); navigate('/browse'); }}
                            className="group relative px-5 py-2 rounded-full border border-zinc-700/50 hover:border-[#ff5c35]/50 bg-zinc-800/30 hover:bg-[#ff5c35]/10 transition-colors text-[10px] uppercase tracking-widest font-bold text-zinc-400 hover:text-[#ff5c35] flex items-center justify-center overflow-hidden"
                          >
                            <span className="relative z-10 flex items-center gap-2">
                              Continue as Guest
                              <svg className="w-3 h-3 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                              </svg>
                            </span>
                          </motion.button>
                        </div>
                      )}

                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>



          </motion.div>
        </motion.div>
      </div>
    );
  };


  // --- Authenticated Views ---

  const renderHeader = () => (
    <header className="fixed top-6 left-0 right-0 z-50 px-4 sm:px-6 lg:px-8 pointer-events-none">
      <div className="max-w-7xl mx-auto pointer-events-auto">
        <div className={`liquid-glass rounded-full border px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between shadow-2xl animate-in slide-in-from-top-4 duration-1000 transition-all ${isScrolled ? 'bg-white/[0.02] backdrop-blur-[12px] border-white/20 shadow-sm' : 'border-white/10 backdrop-blur-xl'}`}>
          <div className="flex items-center group cursor-pointer" onClick={() => handleTabChange('browse')}>
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-black font-outfit tracking-tighter text-refraction drop-shadow-lg">
                Eventron
              </span>
              <span className="text-[8px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.3em] font-bold text-orange-400 -mt-0.5 sm:-mt-1 pl-0.5">Premium Events</span>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/5 relative">
            {[
              { id: 'browse', label: 'Explore', show: currentUser ? (currentUser.role !== 'admin' && currentUser.role !== 'organizer') : false },
              { id: 'organizer', label: 'Dashboard', show: currentUser?.role === 'organizer' },
              { id: 'admin', label: 'Admin', show: currentUser?.role === 'admin' },
              { id: 'my-tickets', label: 'My Tickets', show: currentUser?.role === 'attendee' }
            ].filter(item => item.show !== false).map((item) => (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id as Tab)}
                className={`relative px-6 py-2 rounded-xl text-sm font-black font-outfit transition-all duration-300 whitespace-nowrap z-10 ${activeTab === item.id ? 'text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <span className="relative z-10">{item.label}</span>
                {activeTab === item.id && (
                  <motion.div
                    layoutId="header-pill"
                    className="absolute inset-0 bg-orange-600 rounded-xl shadow-lg shadow-orange-600/30"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.6 }}
                  />
                )}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 md:gap-4">
            {currentUser && (
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-3 rounded-xl bg-white/5 text-slate-400 hover:text-orange-400 transition-all border border-white/5"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <MoreHorizontal className="w-5 h-5" />}
              </button>
            )}

            <AnimatePresence>
              {isMobileMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute top-[88px] left-4 right-4 liquid-glass rounded-3xl border border-white/10 p-4 z-50 lg:hidden flex flex-col gap-2 shadow-2xl"
                >
                  {[
                    { id: 'browse', label: 'Explore', icon: Sparkles, show: currentUser ? (currentUser.role !== 'admin' && currentUser.role !== 'organizer') : false },
                    { id: 'organizer', label: 'Dashboard', show: currentUser?.role === 'organizer', icon: Layout },
                    { id: 'admin', label: 'Admin', show: currentUser?.role === 'admin', icon: Shield },
                    { id: 'my-tickets', label: 'My Tickets', show: currentUser?.role === 'attendee', icon: QrCode }
                  ].filter(item => item.show !== false).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        handleTabChange(item.id as Tab);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`flex items-center gap-4 px-6 py-4 rounded-2xl text-sm font-bold font-outfit transition-all ${activeTab === item.id ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                    >
                      <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-white' : 'text-orange-500'}`} />
                      {item.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="relative">
              {currentUser && (
                <button
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className={`p-3 rounded-xl transition-all relative ${isNotificationsOpen ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30' : 'bg-white/5 text-slate-400 hover:text-orange-400 hover:bg-white/10'}`}
                >
                  <Bell className="w-5 h-5" />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-slate-900 animate-pulse"></span>
                  )}
                </button>
              )}

              {isNotificationsOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsNotificationsOpen(false)}></div>
                  <div className="absolute right-0 mt-4 w-80 xs:w-96 liquid-glass rounded-3xl shadow-2xl border border-white/10 py-0 z-20 animate-in fade-in zoom-in-95 origin-top-right overflow-hidden flex flex-col max-h-[500px]">
                    <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                      <h3 className="text-lg font-bold text-white font-outfit">Notifications</h3>
                      <span className="px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 text-[10px] font-black uppercase tracking-wider border border-orange-500/20">
                        {notifications.filter(n => !n.read).length} Unread
                      </span>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar flex-1">
                      {notifications.length > 0 ? (
                        notifications.slice(0, 50).map(notif => (
                          <div
                            key={notif.id}
                            onClick={async () => {
                              if (!notif.read) {
                                // Optimistic update
                                setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
                                await markNotificationRead(notif.id);
                                loadData(true);
                              }
                              if (notif.eventId) {
                                const relatedEvent = events.find(e => e.id === notif.eventId);
                                if (relatedEvent) {
                                  setSelectedEventForDetails(relatedEvent);
                                  setIsNotificationsOpen(false);
                                  return;
                                }
                              }
                              if (notif.link) {
                                handleTabChange(notif.link as Tab);
                                setIsNotificationsOpen(false);
                              }
                            }}
                            className={`px-6 py-4 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-all relative group ${!notif.read ? 'bg-orange-500/5' : ''}`}
                          >
                            <div className="flex items-start gap-4">
                              <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 shadow-sm ${notif.type === 'success' ? 'bg-emerald-400 shadow-emerald-500/50' : notif.type === 'warning' ? 'bg-amber-400 shadow-amber-500/50' : 'bg-orange-400 shadow-orange-500/50'} ${notif.read ? 'opacity-20' : ''}`}></div>
                              <div className="flex-1">
                                <p className={`text-sm ${notif.read ? 'text-slate-400' : 'text-white font-bold font-outfit'}`}>{notif.title}</p>
                                <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{notif.message}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Clock className="w-3 h-3 text-slate-500" />
                                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{format(new Date(notif.createdAt), 'MMM d, h:mm a')}</p>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-orange-400 group-hover:translate-x-1 transition-all mt-1" />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-20 text-center flex flex-col items-center">
                          <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                            <Bell className="w-8 h-8 text-slate-600" />
                          </div>
                          <p className="text-slate-400 text-sm font-medium">No notifications yet</p>
                          <p className="text-slate-500 text-xs mt-1">We'll alert you when something happens</p>
                        </div>
                      )}
                    </div>
                    {notifications.length > 0 && (
                      <div className="px-6 py-4 border-t border-white/5 bg-white/[0.02]">
                        <button
                          onClick={async () => {
                            if (currentUser) {
                              // Optimistic update for instant UI feedback
                              setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                              setIsNotificationsOpen(false);

                              await markAllNotificationsRead(currentUser.id);
                              loadData(true); // Silent reload to sync ensure consistency
                            }
                          }}
                          className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-400 hover:text-orange-300 w-full text-center py-2 rounded-xl"
                        >
                          Dismiss All
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {currentUser ? (
              <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-sm font-black font-outfit text-white tracking-tight leading-none">{currentUser.name}</span>
                  <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mt-1 opacity-80">{currentUser.role}</span>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    className="w-11 h-11 bg-gradient-to-br from-orange-500/20 to-amber-500/20 rounded-2xl flex items-center justify-center border border-white/10 hover:border-orange-500/50 transition-all group overflow-hidden"
                  >
                    {currentUser.avatarUrl ? (
                      <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-full h-full object-cover" />
                    ) : (
                      <UserCircle className="w-7 h-7 text-slate-300 group-hover:text-white group-hover:scale-110 transition-all" />
                    )}
                  </button>

                  {isProfileMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10 cursor-default"
                        onClick={() => setIsProfileMenuOpen(false)}
                      ></div>
                      <div className="absolute right-0 mt-4 w-64 liquid-glass rounded-3xl shadow-2xl border border-white/10 py-3 z-20 animate-in fade-in zoom-in-95 origin-top-right">
                        <div className="px-6 py-4 border-b border-white/5 md:hidden mb-2">
                          <p className="text-sm font-bold text-white font-outfit">{currentUser.name}</p>
                          <p className="text-xs text-slate-400 truncate opacity-60 tracking-tight">{currentUser.email}</p>
                        </div>
                        <div className="px-3 space-y-1">
                          <button
                            onClick={() => {
                              const parsed = splitPhoneNumber(currentUser.phoneNumber);
                              setProfileDialCode(parsed.dialCode);
                              setProfileNationalNumber(parsed.nationalNumber);
                              setProfileForm({
                                name: currentUser.name,
                                email: currentUser.email,
                                phoneNumber: currentUser.phoneNumber || '',
                                isPhoneVerified: !!currentUser.phoneNumber,
                                avatarUrl: currentUser.avatarUrl
                              });
                              setOtp('');
                              setOtpPurpose('profile');
                              setShowOtpInput(false);
                              setIsProfileMenuOpen(false);
                              navigate('/edit-page');
                            }}

                            className="w-full text-left px-4 py-3 text-sm font-bold font-outfit text-slate-300 hover:bg-orange-600 hover:text-white rounded-xl transition-all flex items-center gap-3 group"
                          >
                            <UserCircle className="w-5 h-5 text-orange-400 group-hover:text-white" /> Edit Profile
                          </button>
                          <button
                            onClick={() => {
                              handleLogout();
                              setIsProfileMenuOpen(false);
                            }}
                            className="w-full text-left px-4 py-3 text-sm font-bold font-outfit text-rose-400 hover:bg-rose-500 hover:text-white rounded-xl transition-all flex items-center gap-3 group"
                          >
                            <LogOut className="w-5 h-5 group-hover:text-white" /> Sign Out
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-5 sm:px-8 py-3 bg-orange-600 text-white rounded-2xl text-xs sm:text-sm font-black font-outfit hover:bg-orange-700 transition-all shadow-xl shadow-orange-600/30 active:scale-95 uppercase tracking-wider"
              >
                Sign Up / Login
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );

  const renderEvents = () => {
    const visibleEvents = events.filter(e => {
      let isVisible = false;
      if (currentUser?.role === 'admin') isVisible = true;
      else if (e.status === EventStatus.APPROVED) isVisible = true;
      else if (currentUser && e.organizerId === currentUser.id) isVisible = true;
      else if (!e.status) isVisible = true; // Fallback for legacy events

      if (!isVisible) return false;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!e.title.toLowerCase().includes(query) && !e.description.toLowerCase().includes(query)) {
          return false;
        }
      }

      if (selectedTag && (!e.tags || !e.tags.includes(selectedTag))) {
        return false;
      }

      return true;
    });

    const now = new Date();
    const isLiveEvent = (e: AppEvent) => {
      const start = new Date(e.date);
      const end = e.endDate ? new Date(e.endDate) : new Date(start.getTime() + 3600000);
      return now >= start && now <= end;
    };

    const upcomingEvents = visibleEvents
      .filter(e => !isPastEvent(e) && !isLiveEvent(e))
      .sort((a, b) => {
        const aIsRec = recommendedEvents.some(rec => rec.id === a.id);
        const bIsRec = recommendedEvents.some(rec => rec.id === b.id);
        if (aIsRec && !bIsRec) return -1;
        if (!aIsRec && bIsRec) return 1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
    const pastEvents = visibleEvents.filter(e => isPastEvent(e)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const renderEventCard = (event: AppEvent, index: number) => {
      const isPast = isPastEvent(event);
      const currentRegs = registrations.filter(r => r.eventId === event.id && r.status !== RegistrationStatus.REJECTED).length;
      const remainingSpots = Math.max(0, Number(event.capacity) - currentRegs);
      const isCardClosed = event.isRegistrationOpen === false || new Date() >= new Date(event.date);
      return (
        <motion.div
          key={event.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
          className={`group glass-card rounded-[32px] overflow-hidden transition-all duration-500 flex flex-col h-full bg-[#0f172a]/40 border-orange-500/5 hover:border-orange-500/20 ${isPast ? 'opacity-50 grayscale' : ''}`}
        >
          <div className="relative h-56 overflow-hidden">
            <LazyEventImage eventId={event.id} initialSrc={event.imageUrl} alt={event.title} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className={`absolute top-4 right-4 backdrop-blur-md px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl z-10 ${event.locationType === 'online' ? 'bg-orange-600/90 text-white border border-orange-400/30' : 'bg-slate-900/90 text-white border border-white/10'}`}>
              {event.locationType === 'online' ? 'Online' : 'Offline'}
            </div>

            <div className="absolute top-4 left-4 z-10 flex gap-2">
              {recommendedEvents.some(rec => rec.id === event.id) && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-500 text-[10px] font-black text-white uppercase tracking-wider shadow-xl shadow-orange-600/30">
                  <Sparkles className="w-3 h-3" />
                  AI Pick
                </div>
              )}
            </div>

            <div className="absolute bottom-4 left-4 z-10 flex gap-2">
              {!isCardClosed && (
                <span className={`px-3 py-1 backdrop-blur-md rounded-lg text-[10px] font-bold border transition-all duration-300 relative ${
                  remainingSpots === 0
                    ? 'bg-red-500/20 text-red-300 border-red-500/30'
                    : remainingSpots <= 5
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-white/10 text-white border-white/10 group-hover:bg-orange-600/50'
                } ${flashedEventIds.has(event.id) ? 'animate-pulse ring-2 ring-orange-500/60 shadow-lg shadow-orange-500/30 scale-110' : ''}`}>
                  {remainingSpots === 0 ? 'Sold Out' : `${remainingSpots} Spots Left`}
                  {flashedEventIds.has(event.id) && remainingSpots > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 bg-orange-500 rounded-full animate-ping" />
                  )}
                </span>
              )}
              {currentUser && (currentUser.role === 'admin' || currentUser.id === event.organizerId) && event.status && event.status !== EventStatus.APPROVED && (
                <span className={`px-3 py-1 backdrop-blur-md rounded-lg text-[10px] font-bold border ${event.status === EventStatus.PENDING ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-rose-500/20 text-rose-400 border-rose-500/30'}`}>
                  {event.status}
                </span>
              )}
            </div>
          </div>

          <div className="p-8 flex-1 flex flex-col">
            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 mb-6 bg-orange-500/5 w-fit px-4 py-1.5 rounded-full border border-orange-500/10">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              {format(new Date(event.date), 'MMMM d, yyyy')}
            </div>

            <h3
              onClick={() => setSelectedEventForDetails(event)}
              className="text-2xl font-black text-white mb-3 font-outfit decoration-orange-500/50 decoration-2 underline-offset-8 cursor-pointer group-hover:text-orange-300 group-hover:translate-x-1 transition-all"
            >
              {event.title}
            </h3>

            <div className="flex items-center gap-2 text-slate-400 text-xs mb-5 font-medium opacity-80">
              <MapPin className="w-4 h-4 text-orange-400" />
              {renderLocation(event.location, event.locationType, "truncate max-w-[200px]")}
            </div>

            <p className="text-slate-400 text-sm line-clamp-2 mb-4 flex-1 leading-relaxed opacity-70 group-hover:opacity-100 transition-opacity">{event.description}</p>

            {/* Auto-inferred / organizer tags */}
            {(() => {
              const displayTags = inferEventTags(event);
              const isAutoInferred = !event.tags || event.tags.length === 0;
              return displayTags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {displayTags.map(tag => (
                    <span
                      key={tag}
                      onClick={(ev) => { ev.stopPropagation(); setSelectedTag(selectedTag === tag ? null : tag); }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide cursor-pointer transition-all border ${
                        selectedTag === tag
                          ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-600/20'
                          : isAutoInferred
                          ? 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:border-orange-500/40 hover:text-orange-400'
                          : 'bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20'
                      }`}
                    >
                      {isAutoInferred && <span className="opacity-50 mr-0.5">#</span>}{tag}
                    </span>
                  ))}
                </div>
              ) : null;
            })()}

            {(!currentUser || currentUser.role === 'attendee') && (
              (() => {
                const isRegistered = currentUser ? registrations.some(r => r.eventId === event.id && r.participantEmail === currentUser.email) : false;
                const currentRegistrations = registrations.filter(r => r.eventId === event.id && r.status !== RegistrationStatus.REJECTED).length;
                const isFull = currentRegistrations >= Number(event.capacity || 0);
                const startDate = new Date(event.date);
                const endDate = event.endDate ? new Date(event.endDate) : new Date(startDate.getTime() + 3600000);

                const isLive = now >= startDate && now <= endDate;
                const isPastBadge = now > endDate;
                const isClosed = event.isRegistrationOpen === false || now >= startDate;

                return (
                  <div className="flex flex-col gap-4 mt-auto">
                    <div className="flex items-center justify-between">
                      {isLive && (
                        <div className="flex items-center gap-1.5 text-[10px] font-black text-rose-500 animate-pulse bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-full uppercase tracking-wider">
                          <div className="w-1.5 h-1.5 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.8)]"></div>
                          Live Now
                        </div>
                      )}
                      {isFull && !isRegistered && !isPastBadge && (
                        <div className="text-[10px] font-black text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full uppercase tracking-wider">
                          Event Full
                        </div>
                      )}
                      {isPastBadge && (
                        <div className="text-[10px] font-black text-slate-500 bg-slate-500/10 border border-slate-500/20 px-3 py-1 rounded-full uppercase tracking-wider">
                          Inactive
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isRegistered ? (
                        <button
                          onClick={() => {
                            const reg = registrations.find(r => r.eventId === event.id && r.participantEmail === currentUser?.email);
                            if (reg) setSelectedRegistrationDetails(reg);
                          }}
                          className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold font-outfit py-3 rounded-2xl transition-all flex items-center justify-center gap-2 group/btn"
                        >
                          <CheckCircle className="w-5 h-5 text-orange-400 group-hover/btn:scale-110 transition-transform" />
                          View Registration
                        </button>
                      ) : (
                        currentUser ? (
                          <button
                            disabled={isFull || isClosed}
                            onClick={async () => {
                              const fullEvent = await getEventById(event.id, { excludeImage: true });
                              setSelectedEventForReg(fullEvent || event);
                            }}
                            className="flex-1 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold font-outfit py-3 rounded-2xl transition-all shadow-lg shadow-orange-600/20 active:scale-95 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                          >
                            {isFull ? 'Waitlisted' : (isClosed ? 'Registration Closed' : 'Secure Your Spot')}
                          </button>
                        ) : (
                          <button
                            onClick={() => setIsAuthModalOpen(true)}
                            className="flex-1 bg-white/5 border border-white/10 hover:border-orange-500/50 hover:bg-orange-500/5 text-white font-bold font-outfit py-3 rounded-2xl transition-all flex items-center justify-center gap-2 group/btn"
                          >
                            Sign In to Register
                            <ChevronRight className="w-4 h-4 text-orange-400 group-hover/btn:translate-x-1 transition-transform" />
                          </button>
                        )
                      )}


                    </div>
                  </div>
                );
              })()
            )}

            {currentUser?.role === 'organizer' && (
              <div className="mt-auto pt-6 border-t border-white/5 flex gap-2">
                <button
                  onClick={() => {
                    setOrganizerSelectedEventId(event.id);
                    setOrganizerView('events');
                    handleTabChange('organizer');
                  }}
                  className="flex-1 bg-orange-600/10 text-orange-400 font-bold font-outfit py-3 rounded-2xl border border-orange-500/20 hover:bg-orange-600 hover:text-white transition-all shadow-sm"
                >
                  Manage
                </button>
                <button
                  onClick={() => setSelectedEventForDetails(event)}
                  className="px-4 bg-white/5 text-slate-400 rounded-2xl border border-white/10 hover:bg-white/10 transition-all"
                >
                  <Edit className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      );
    };

    return (
      <div className="animate-in fade-in duration-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 pt-32">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 md:mb-12">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                <span className="text-[10px] font-black text-orange-400 uppercase tracking-[0.4em]">Satellite Feed</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black font-outfit text-white tracking-tight">
                {currentUser?.role === 'organizer' ? 'Hosted Nexus' : 'Upcoming Experiences'}
              </h2>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <div className="relative">
                <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-64 bg-slate-900/80 border border-slate-700/50 text-white placeholder-slate-500 px-12 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Tags Filter */}
          <div className="flex flex-wrap gap-2 mb-10">
            {['AI', 'ML', 'Conference', 'Tech', 'Hackathon', 'Networking', 'Startup', 'Workshop', 'Design'].map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${selectedTag === tag ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'bg-slate-900/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'}`}
              >
                {tag}
              </button>
            ))}
          </div>

          {dataLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
              {Array(6).fill(0).map((_, i) => <EventCardSkeleton key={i} />)}
            </div>
          ) : upcomingEvents.length === 0 ? (
            <div className="text-center py-16 sm:py-32 glass-card rounded-[40px] border-dashed border-2 border-white/5">
              <div className="w-24 h-24 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Calendar className="w-12 h-12 text-orange-500 opacity-50" />
              </div>
              <h3 className="text-2xl font-black font-outfit text-white mb-2">No upcoming events yet</h3>
              <p className="text-slate-400 max-w-xs mx-auto mb-8">Stay tuned! We're preparing incredible experiences for you.</p>
              {currentUser?.role === 'organizer' && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="button-glow text-white px-10 py-5 rounded-[24px] font-black font-outfit transition-all uppercase tracking-widest active:scale-95"
                >
                  Create Your First Event
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
              {upcomingEvents.map((event, idx) => renderEventCard(event, idx))}
            </div>
          )}


          {pastEvents.length > 0 && (
            <div className="mt-32">
              <div className="flex items-center gap-6 mb-12">
                <h3 className="text-3xl font-black font-outfit text-white tracking-tight whitespace-nowrap">Past Memories</h3>
                <div className="flex-1 h-px bg-white/5"></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {(showAllPastEvents ? pastEvents : pastEvents.slice(0, 4)).map((event, idx) => renderEventCard(event, idx + upcomingEvents.length))}
              </div>
              {pastEvents.length > 4 && (
                <div className="flex justify-center mt-12">
                  <button
                    onClick={() => setShowAllPastEvents(!showAllPastEvents)}
                    className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white font-bold font-outfit rounded-2xl transition-all border border-white/10 flex items-center gap-2"
                  >
                    {showAllPastEvents ? 'Show Less' : 'Show More Past Memories'}
                    <ChevronDown className={`w-4 h-4 transition-transform ${showAllPastEvents ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMyTickets = () => {
    if (!currentUser) return null;

    // Filter registrations for this logged in user
    const myRegs = registrations.filter(r => r.participantEmail === currentUser.email);

    // Split into Active and Past
    const activeRegs = myRegs.filter(reg => {
      const event = events.find(e => e.id === reg.eventId);
      return event && !isPastEvent(event) && (reg.status === RegistrationStatus.APPROVED || reg.status === RegistrationStatus.PENDING || reg.status === RegistrationStatus.WAITLISTED || reg.status === RegistrationStatus.AWAITING_PAYMENT);
    });

    const pastRegs = myRegs.filter(reg => {
      const event = events.find(e => e.id === reg.eventId);
      return event && isPastEvent(event);
    });

    const activeTicketsCount = activeRegs.filter(r => r.status === RegistrationStatus.APPROVED || r.status === RegistrationStatus.PENDING).length;

    const renderTicketCard = (reg: Registration) => {
      const event = events.find(e => e.id === reg.eventId);
      if (!event) return null;
      const isPast = isPastEvent(event);

      return (
        <div key={reg.id} className={`group glass-card rounded-[32px] p-6 lg:p-8 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden transition-all duration-500 hover:border-orange-500/30 ${isPast ? 'opacity-60 grayscale' : ''}`}>
          <div className="absolute top-0 right-0 w-32 h-64 bg-orange-600/5 -rotate-45 translate-x-16 -translate-y-16 pointer-events-none"></div>

          <div className="w-full md:w-32 h-32 rounded-2xl overflow-hidden flex-shrink-0 border border-white/5 shadow-2xl">
            <LazyEventImage eventId={event.id} initialSrc={event.imageUrl} alt={event.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
          </div>

          <div className="flex-1 w-full text-center md:text-left">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-60">ID: {reg.id.slice(0, 8)}</span>
            <h3 className="text-2xl font-black text-white mt-1 mb-3 font-outfit line-clamp-1 group-hover:text-orange-400 transition-colors uppercase tracking-tight">{event.title}</h3>
            <div className="flex flex-wrap justify-center md:justify-start items-center gap-x-6 gap-y-3 mt-4 text-slate-400 text-sm font-medium">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-orange-400" />
                {format(new Date(event.date), 'MMM d, yyyy')}
                {event.endDate && new Date(event.date).toDateString() !== new Date(event.endDate).toDateString()
                  ? ` - ${format(new Date(event.endDate), 'MMM d, yyyy')}`
                  : ''}
              </div>
              <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-orange-400" /> {format(new Date(event.date), 'h:mm a')} {event.endDate ? `- ${format(new Date(event.endDate), 'h:mm a')}` : ''}</div>
              <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-orange-400" /> {renderLocation(event.location, event.locationType, "truncate max-w-[150px]")}</div>
            </div>
          </div>

          <div className="flex flex-col items-center md:items-end gap-4 min-w-[200px] w-full md:w-auto">
            <Badge status={reg.status} />
            {!isPast && (reg.status === RegistrationStatus.APPROVED) && (
              <button
                onClick={() => setSelectedTicket(reg)}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white border border-transparent px-8 py-3.5 rounded-2xl text-xs font-black font-outfit transition-all uppercase tracking-widest shadow-xl shadow-orange-600/20 active:scale-95 flex items-center justify-center gap-3"
              >
                <QrCode className="w-4 h-4" /> View Digital Ticket
              </button>
            )}
            {reg.status === RegistrationStatus.AWAITING_PAYMENT && !isPast && (
              (reg.participationType === 'team' && !reg.isTeamLeader) ? (
                <div className="w-full text-center px-4 py-3 bg-slate-800/80 border border-slate-700 rounded-2xl text-xs font-bold text-amber-400 font-outfit">
                  Waiting for Team Leader Payment
                </div>
              ) : (
                <button
                  onClick={() => handleLatePayment(reg, event)}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-2xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-orange-600/20 active:scale-95"
                >
                  Pay to Confirm
                </button>
              )
            )}
            {reg.status !== RegistrationStatus.AWAITING_PAYMENT && reg.status !== RegistrationStatus.APPROVED && (
              <button
                onClick={() => setSelectedRegistrationDetails(reg)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-6 py-2.5 rounded-2xl text-xs font-bold font-outfit transition-all uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <Users className="w-3.5 h-3.5 text-orange-400" />
                {reg.participationType === 'team' ? 'Team & Registration' : 'View Registration'}
              </button>
            )}
            {reg.participationType === 'team' && reg.isTeamLeader && reg.status === RegistrationStatus.TEAM_AWAITING_SUBMISSION && !isPast && (
              (() => {
                const teamObj = teams.find(t => t.id === reg.teamId);
                const teamRegs = registrations.filter(r => r.teamId === reg.teamId && r.status !== RegistrationStatus.REJECTED);
                const membersCount = Math.max(teamRegs.length, teamObj?.members?.length || 0);
                const minSize = event?.minTeamSize || 1;
                const isIncomplete = membersCount < minSize;
                return (
                  <button
                    disabled={isIncomplete}
                    onClick={() => reg.teamId && handleTeamSubmit(reg.teamId)}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold font-outfit uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md ${
                      isIncomplete
                        ? 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
                        : 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-600/20 active:scale-95'
                    }`}
                  >
                    {isIncomplete ? <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    {isIncomplete ? `Team Incomplete (${membersCount}/${minSize})` : 'Submit Team'}
                  </button>
                );
              })()
            )}
            <button
              onClick={() => setSelectedEventForDetails(event)}
              className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-[0.3em] transition-colors"
            >
              Event Details
            </button>
            {!isPast && (
              <button
                onClick={() => handleCancelRegistration(reg.id)}
                className="text-[10px] font-black text-rose-500 hover:text-rose-400 uppercase tracking-[0.3em] transition-colors flex items-center gap-2 group/cancel mt-4"
              >
                <Trash2 className="w-3 h-3 group-hover/cancel:scale-110 transition-transform" />
                Cancel Registration
              </button>
            )}
          </div>
        </div>
      );
    };

    return (
      <div className="max-w-4xl mx-auto px-4 pt-32 pb-16 md:pb-20 animate-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
              <span className="text-[10px] font-black text-orange-400 uppercase tracking-[0.4em]">Personal Node</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black font-outfit text-white tracking-tight">Your Passport</h2>
            <p className="text-slate-400 text-sm font-medium opacity-80 mt-1">Manage your upcoming experiences and digital tickets.</p>
          </div>
          <div className="bg-orange-600/10 border border-orange-500/20 px-6 py-3 rounded-2xl flex items-center gap-3 w-fit">
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
            <span className="text-xs font-black text-orange-400 uppercase tracking-widest">{activeTicketsCount} Active {activeTicketsCount !== 1 ? 'Permits' : 'Permit'}</span>
          </div>
        </div>

        {dataLoading ? (
          <div className="space-y-6">
            {[1, 2, 3].map(i => <TicketSkeleton key={i} />)}
          </div>
        ) : myRegs.length === 0 ? (
          <div className="text-center py-24 glass-card rounded-[40px] border-dashed border-2 border-white/5">
            <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <QrCode className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-2xl font-black font-outfit text-white mb-2">No tickets yet</h3>
            <p className="text-slate-400 mb-8 max-w-xs mx-auto">Your journey begins when you register for your first event.</p>
            <button
              onClick={() => handleTabChange('browse')}
              className="bg-orange-600 text-white px-10 py-4 rounded-2xl font-black font-outfit hover:bg-orange-700 transition-all uppercase tracking-widest shadow-xl shadow-orange-600/20"
            >
              Explore Events
            </button>
          </div>
        ) : (
          <div className="space-y-16">
            {activeRegs.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-4 mb-4">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Upcoming Expeditions</h3>
                  <div className="flex-1 h-px bg-white/5"></div>
                </div>
                {activeRegs.map(renderTicketCard)}
              </div>
            )}

            {pastRegs.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-4 mb-4">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Journey Log</h3>
                  <div className="flex-1 h-px bg-white/5"></div>
                </div>
                {pastRegs.map(renderTicketCard)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderOrganizer = () => {
    // Only show events created by this organizer OR where they are a collaborator
    const myEvents = events.filter(e => e.organizerId === currentUser.id || (e.collaboratorEmails && e.collaboratorEmails.includes(currentUser.email)));

    // If no event selected, show Dashboard or List
    if (!organizerSelectedEventId) {
      return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16 animate-in fade-in duration-700">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
            <div>
              <h2 className="text-4xl font-black font-outfit text-white tracking-tight">Command Center</h2>
              <p className="text-slate-400 font-medium opacity-80 mt-1">Orchestrate your experiences and manage your community.</p>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                onClick={() => { resetEventForm(); setIsCreateModalOpen(true); }}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white/5 text-white border border-white/10 px-6 py-3.5 rounded-2xl hover:bg-white/10 font-bold font-outfit transition-all uppercase tracking-wider text-xs"
              >
                <Plus className="w-4 h-4 text-orange-400" /> New Venture
              </button>
              <button
                onClick={() => setIsScannerOpen(true)}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-orange-600 text-white px-8 py-3.5 rounded-2xl hover:bg-orange-700 shadow-xl shadow-orange-600/30 transition-all active:scale-95 font-black font-outfit uppercase tracking-wider text-xs"
              >
                <ScanLine className="w-4 h-4" /> Scan Entrance
              </button>
            </div>
          </div>

          <div className="inline-flex p-1.5 bg-white/5 rounded-2xl border border-white/5 mb-10">
            <button
              onClick={() => setOrganizerView('overview')}
              className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${organizerView === 'overview' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30' : 'text-slate-400 hover:text-white'}`}
            >
              Intelligence
            </button>
            <button
              onClick={() => setOrganizerView('events')}
              className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${organizerView === 'events' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30' : 'text-slate-400 hover:text-white'}`}
            >
              Expeditions
            </button>
          </div>

          {dataLoading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
              <p className="text-slate-400 font-medium font-outfit">Loading command center data...</p>
            </div>
          ) : organizerView === 'overview' ? (
            <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-orange-500 animate-spin" /></div>}>
              <AnalyticsDashboard
                events={myEvents}
                registrations={registrations.filter(r => myEvents.some(e => e.id === r.eventId))}
              />
            </Suspense>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {myEvents.map(event => {
                  const eventRegs = registrations.filter(r => r.eventId === event.id);
                  const pendingCount = eventRegs.filter(r => r.status === RegistrationStatus.PENDING).length;
                  return (
                    <div
                      key={event.id}
                      onClick={() => { setOrganizerSelectedEventId(event.id); setStatusFilter('ALL'); setAttendanceFilter('ALL'); }}
                      className="group glass-card rounded-3xl p-6 cursor-pointer border border-white/5 hover:border-orange-500/30 transition-all duration-500 flex flex-col h-full"
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-14 h-14 bg-orange-500/10 rounded-2xl flex items-center justify-center border border-orange-500/20 group-hover:scale-110 transition-transform duration-500">
                          <Calendar className="w-6 h-6 text-orange-400" />
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-60">Status</span>
                          {event.status === EventStatus.PENDING ? (
                            <span className="text-xs font-bold text-amber-500 mt-1">Pending Approval</span>
                          ) : event.status === EventStatus.REJECTED ? (
                            <span className="text-xs font-bold text-rose-500 mt-1">Rejected</span>
                          ) : isPastEvent(event) ? (
                            <span className="text-xs font-bold text-slate-400 mt-1">Inactive</span>
                          ) : (
                            <span className="text-xs font-bold text-emerald-400 mt-1">Active</span>
                          )}
                        </div>
                      </div>

                      <h3 className="text-xl font-black font-outfit text-white mb-2 tracking-tight group-hover:text-orange-400 transition-colors line-clamp-1">{event.title}</h3>
                      <div className="flex items-center gap-2 text-slate-400 text-xs font-medium opacity-80 mb-6">
                        <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-orange-400" /> {format(new Date(event.date), 'MMM d, h:mm a')}</div>
                        {(event.isPaid || eventRegs.reduce((acc, r) => acc + (r.paymentDetails?.amount || 0), 0) > 0) && (
                          <div className="flex items-center gap-1.5 ml-auto bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 text-emerald-400">
                            <span className="font-bold">₹{(() => {
                              const revenue = eventRegs.reduce((acc, r) => acc + (r.paymentDetails?.amount || 0), 0);
                              const fee = event.isPaid ? ((event.capacity || 0) < 100 ? 49 : 99) : 0;
                              return (revenue - fee).toLocaleString();
                            })()}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-auto space-y-4">
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                          <div className="flex justify-between items-end mb-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Enlisted</span>
                            <span className="text-sm font-black font-outfit text-white">{eventRegs.length} / {event.capacity}</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-orange-500 to-amber-600 transition-all duration-1000"
                              style={{ width: `${Math.min(100, (eventRegs.length / event.capacity) * 100)}%` }}
                            ></div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          {pendingCount > 0 ? (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[10px] font-black text-amber-500 uppercase tracking-widest">
                              <AlertCircle className="w-3 h-3" /> {pendingCount} Pending Approval
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                              <CheckSquare className="w-3 h-3" /> Fully Vetted
                            </div>
                          )}
                          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-orange-600 transition-colors">
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white" />
                          </div>
                        </div>

                        {event.isPaid && (
                          <div className="mt-4 pt-3 border-t border-white/5" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Settlement</span>
                              <span className={`text-[10px] font-black uppercase tracking-wider ${event.settlementStatus === 'PROCESSED' ? 'text-emerald-400' :
                                event.settlementStatus === 'PROCESSING' ? 'text-blue-400' :
                                  'text-slate-400'
                                }`}>
                                {(event.settlementStatus || 'NOT_PROCESSED').replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {myEvents.length === 0 && (
                  <div className="text-center py-24 glass-card rounded-[40px] border-dashed border-2 border-white/5 col-span-full">
                    <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Calendar className="w-10 h-10 text-slate-600" />
                    </div>
                    <h3 className="text-2xl font-black font-outfit text-white mb-2">No expeditions yet</h3>
                    <p className="text-slate-400 mb-8 max-w-xs mx-auto">Launch your first event and begin your legacy.</p>
                    <button
                      onClick={() => { resetEventForm(); setIsCreateModalOpen(true); }}
                      className="bg-orange-600 text-white px-10 py-4 rounded-2xl font-black font-outfit hover:bg-orange-700 transition-all uppercase tracking-widest shadow-xl shadow-orange-600/20"
                    >
                      Create Your First Event
                    </button>
                  </div>
                )}
              </div>
            )
          }
        </div>
      );
    }

    // Details for specific event
    const event = events.find(e => e.id === organizerSelectedEventId);
    let eventRegs = registrations.filter(r => r.eventId === organizerSelectedEventId);

    // Filter Logic
    if (statusFilter !== 'ALL') {
      eventRegs = eventRegs.filter(r => r.status === statusFilter);
    }
    if (attendanceFilter !== 'ALL') {
      eventRegs = eventRegs.filter(r => attendanceFilter === 'PRESENT' ? r.attended : !r.attended);
    }

    // Grouping Logic for Team Approval
    const groupedRegs: { teamId: string | null; teamName: string | null; regs: Registration[] }[] = [];
    eventRegs.forEach(reg => {
      if (reg.participationType === 'team' && reg.teamId) {
        let group = groupedRegs.find(g => g.teamId === reg.teamId);
        if (!group) {
          group = { teamId: reg.teamId, teamName: reg.teamName || 'Unknown Team', regs: [] };
          groupedRegs.push(group);
        }
        group.regs.push(reg);
      } else {
        groupedRegs.push({ teamId: null, teamName: null, regs: [reg] });
      }
    });

    const totalColumns = event?.isPaid ? 9 : 7;

    return (
      <div className="max-w-7xl mx-auto px-4 pt-32 pb-16">
        <button
          onClick={() => { setOrganizerSelectedEventId(null); setSelectedRegistrationIds([]); }}
          className="mb-4 text-sm text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
        >
          ← Back to Events
        </button>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">{event?.title}</h2>
            <p className="text-slate-400">Manage participants and approvals</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button
              onClick={() => event && handleEditClick(event)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 text-orange-400 border border-slate-700 px-4 py-2 rounded-lg hover:bg-slate-700 font-medium transition-colors"
            >
              <Edit className="w-4 h-4" /> Edit Event
            </button>
            <button
              onClick={() => event && handleSendReminders(event)}
              disabled={isSendingReminders}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 text-orange-400 border border-slate-700 px-4 py-2 rounded-lg hover:bg-slate-700 font-medium disabled:opacity-50 transition-colors"
            >
              {isSendingReminders ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
              Send Reminders
            </button>
            <button
              onClick={async () => {
                if (event && confirm(`Are you sure you want to delete "${event.title}"? This action cannot be undone and all registrations will be lost.`)) {
                  const success = await deleteEvent(event.id);
                  if (success) {
                    addToast('Event deleted successfully', 'success');
                    setOrganizerSelectedEventId(null);
                    loadData();
                  } else {
                    addToast('Failed to delete event', 'error');
                  }
                }
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-900/40 text-red-400 border border-red-800 px-4 py-2 rounded-lg hover:bg-red-900/60 font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Delete Event
            </button>
            <button
              onClick={() => setIsAnnouncementModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 text-orange-400 border border-slate-700 px-4 py-2 rounded-lg hover:bg-slate-700 font-medium transition-colors"
            >
              <Send className="w-4 h-4" /> Broadcast
            </button>
            <button
              onClick={() => event && handleExportCSV(event)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-800 text-orange-400 border border-slate-700 px-4 py-2 rounded-lg hover:bg-slate-700 font-medium transition-colors"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button
              onClick={() => setIsScannerOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 shadow-lg shadow-orange-900/20 transition-all active:scale-95"
            >
              <ScanLine className="w-4 h-4" /> Scan Ticket
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 mb-6 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2 text-slate-400 text-sm font-medium mr-2">
            <Filter className="w-4 h-4" /> Filters:
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 font-medium uppercase">Status</label>
            <select
              className="bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block p-2 outline-none appearance-none pr-8 cursor-pointer hover:border-slate-600"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%2394a3b8\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="ALL">All Statuses</option>
              <option value={RegistrationStatus.PENDING}>Pending</option>
              <option value={RegistrationStatus.APPROVED}>Approved</option>
              <option value={RegistrationStatus.REJECTED}>Rejected</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-medium uppercase">Attendance</label>
            <select
              className="bg-slate-900 border border-slate-700 text-slate-100 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block p-2 outline-none"
              value={attendanceFilter}
              onChange={(e) => setAttendanceFilter(e.target.value as any)}
            >
              <option value="ALL">All Attendance</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent / Not Scanned</option>
            </select>
          </div>

          <div className="ml-auto text-sm text-slate-400">
            Showing {eventRegs.length} result{eventRegs.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedRegistrationIds.length > 0 && (
          <div className="bg-orange-600/10 border border-orange-500/30 p-3 rounded-xl mb-6 flex items-center justify-between animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3">
              <span className="text-orange-400 font-bold text-sm px-2 py-1 bg-orange-900/40 rounded-lg">{selectedRegistrationIds.length}</span>
              <span className="text-orange-200 text-sm font-medium">Selected</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  const hasTeam = selectedRegistrationIds.some(id => {
                    const r = registrations.find(reg => reg.id === id);
                    return r?.participationType === 'team';
                  });
                  if (hasTeam) {
                    addToast('Team registrations must be approved team-wise using the team header button.', 'warning');
                    return;
                  }
                  if (confirm(`Approve ${selectedRegistrationIds.length} individual registrations?`)) {
                    for (const id of selectedRegistrationIds) {
                      await handleStatusUpdate(id, RegistrationStatus.APPROVED);
                    }
                    setSelectedRegistrationIds([]);
                  }
                }}
                className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" /> Approve
              </button>
              <button
                onClick={async () => {
                  const hasTeam = selectedRegistrationIds.some(id => {
                    const r = registrations.find(reg => reg.id === id);
                    return r?.participationType === 'team';
                  });
                  if (hasTeam) {
                    addToast('Team registrations must be rejected team-wise using the team header button.', 'warning');
                    return;
                  }
                  if (confirm(`Reject ${selectedRegistrationIds.length} individual registrations?`)) {
                    for (const id of selectedRegistrationIds) {
                      await handleStatusUpdate(id, RegistrationStatus.REJECTED);
                    }
                    setSelectedRegistrationIds([]);
                  }
                }}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Reject
              </button>
              <button
                onClick={async () => {
                  if (confirm(`Mark ${selectedRegistrationIds.length} participants as present?`)) {
                    await Promise.all(selectedRegistrationIds.map(id => markAttendance(id)));
                    addToast(`Marked ${selectedRegistrationIds.length} participants as present`, 'success');
                    setSelectedRegistrationIds([]);
                    loadData();
                  }
                }}
                className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Mark Present
              </button>
              <button
                onClick={() => setSelectedRegistrationIds([])}
                className="text-slate-400 hover:text-white text-xs font-medium ml-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {dataLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => <ListRowSkeleton key={i} />)}
          </div>
        ) : (
          <>
            {/* Mobile View: Participant Cards */}
            <div className="block md:hidden space-y-6">
              {groupedRegs.map((group, gIdx) => (
                <div key={group.teamId || `indiv-${gIdx}`} className={group.teamId ? "space-y-4 p-4 bg-orange-500/5 rounded-2xl border border-orange-500/20" : "space-y-4"}>
                  {group.teamId && (
                    <div className="flex justify-between items-center pb-2 border-b border-orange-500/10">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-orange-400" />
                        <span className="text-xs font-black uppercase tracking-widest text-orange-400">{group.teamName}</span>
                      </div>
                      {group.regs.some(r => r.status === RegistrationStatus.PENDING || r.status === RegistrationStatus.TEAM_AWAITING_SUBMISSION) && (
                        (() => {
                          const minSize = event?.minTeamSize || 1;
                          const maxSize = event?.maxTeamSize || 99;
                          const count = group.regs.length;
                          const isUnderSize = count < minSize;
                          const isOverSize = count > maxSize;
                          const isAwaitingSubmission = group.regs.some(r => r.status === RegistrationStatus.TEAM_AWAITING_SUBMISSION);
                          const canApprove = !isUnderSize && !isOverSize && !isAwaitingSubmission;
                          return (
                            <div className="flex items-center gap-1.5">
                              <button
                                disabled={!canApprove}
                                onClick={() => handleTeamStatusUpdate(group.teamId!, RegistrationStatus.APPROVED)}
                                title={
                                  isAwaitingSubmission
                                    ? `Team is still being formed. Awaiting team leader submission (${count} joined)`
                                    : isUnderSize
                                    ? `Team requires ${minSize}–${maxSize} members before approval (Current: ${count})`
                                    : isOverSize
                                    ? `Team exceeds max capacity of ${maxSize} members`
                                    : `Approve team "${group.teamName}"`
                                }
                                className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-lg border transition-all ${
                                  !canApprove
                                    ? 'bg-slate-800 text-amber-400/80 border-amber-500/30 cursor-not-allowed'
                                    : 'bg-green-600/20 text-green-400 border-green-500/40 hover:bg-green-600 hover:text-white cursor-pointer shadow-sm'
                                }`}
                              >
                                {isAwaitingSubmission
                                  ? `Awaiting Leader (${count}/${minSize})`
                                  : isUnderSize
                                  ? `Incomplete (${count}/${minSize} joined)`
                                  : isOverSize
                                  ? `Exceeds Limit (${count}/${maxSize})`
                                  : `Approve Team (${count})`}
                              </button>
                              <button
                                onClick={() => handleTeamStatusUpdate(group.teamId!, RegistrationStatus.REJECTED)}
                                title={`Reject team "${group.teamName}"`}
                                className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border bg-red-600/10 text-red-400 border-red-500/30 hover:bg-red-600 hover:text-white cursor-pointer transition-all"
                              >
                                Reject
                              </button>
                            </div>
                          );
                        })()
                      )}
                    </div>
                  )}

                  {group.regs.map(reg => (
                    <div key={reg.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-sm flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div className="overflow-hidden">
                          <div className="font-medium text-slate-200 truncate">{reg.participantName}</div>
                          <div className="text-xs text-slate-400 truncate">{reg.participantEmail}</div>
                          {reg.participationType === 'team' && reg.isTeamLeader && (
                            <div className="text-[8px] font-black uppercase tracking-widest text-orange-500 mt-1">Team Leader</div>
                          )}
                          {event?.isPaid && reg.paymentDetails?.transactionId && (
                            <div className="text-[10px] text-orange-400/80 mt-1 font-mono truncate">
                              Txn: {reg.paymentDetails.transactionId} | ₹{reg.paymentDetails.amount}
                            </div>
                          )}
                        </div>
                        <Badge status={reg.status} />
                      </div>

                      <div className="flex justify-between items-center border-t border-slate-800 pt-3">
                        <div className="text-sm">
                          {reg.attended ? (
                            <div className="flex flex-col gap-1">
                              <span className="flex items-center gap-1 text-green-600 font-medium"><CheckCircle className="w-4 h-4" /> Present</span>
                              {reg.attendanceTime && (
                                <span className="text-xs text-slate-400">
                                  {format(new Date(reg.attendanceTime), 'h:mm a')}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">Not Scanned</span>
                          )}
                        </div>

                        <div className="flex gap-2 items-center">
                          {reg.status === RegistrationStatus.PENDING && (
                            reg.participationType === 'team' ? (
                              <span className="text-[9px] font-bold text-orange-400 bg-orange-500/10 px-2 py-1 rounded border border-orange-500/20">
                                Team Managed
                              </span>
                            ) : (
                              <>
                                <button onClick={() => handleStatusUpdate(reg.id, RegistrationStatus.APPROVED)} className="p-1.5 bg-green-900/30 text-green-400 rounded-lg border border-green-800" title="Approve"><CheckCircle className="w-5 h-5" /></button>
                                <button onClick={() => handleStatusUpdate(reg.id, RegistrationStatus.REJECTED)} className="p-1.5 bg-red-900/30 text-red-400 rounded-lg border border-red-800" title="Reject"><XCircle className="w-5 h-5" /></button>
                              </>
                            )
                          )}
                          <button onClick={() => setSelectedRegistrationDetails(reg)} className="p-1.5 bg-slate-800 text-slate-300 rounded-lg border border-slate-700" title="View"><ExternalLink className="w-5 h-5" /></button>
                          <button onClick={() => handleDeleteRegistration(reg.id)} className="p-1.5 bg-red-900/30 text-red-400 rounded-lg border border-red-800 ml-1" title="Delete"><Trash2 className="w-5 h-5" /></button>
                        </div>

                        {reg.status === RegistrationStatus.APPROVED && !reg.attended && (
                          <button
                            onClick={() => handleManualAttendance(reg.id)}
                            className="px-3 py-1.5 bg-orange-900/40 text-orange-400 text-xs font-medium rounded-lg border border-orange-800 hover:bg-orange-900/60 transition-colors"
                          >
                            Mark Present
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              {groupedRegs.length === 0 && (
                <div className="text-center text-slate-400 py-8 bg-slate-900 rounded-xl border border-dashed border-slate-700">
                  No registrations found matching criteria.
                </div>
              )}
            </div>

            {/* Desktop View: Participant Table */}
            <div className="hidden md:block bg-slate-900 rounded-xl shadow-sm border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4 w-10">
                      <input
                        type="checkbox"
                        checked={eventRegs.length > 0 && selectedRegistrationIds.length === eventRegs.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRegistrationIds(eventRegs.map(r => r.id));
                          } else {
                            setSelectedRegistrationIds([]);
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-orange-600 focus:ring-orange-500 focus:ring-offset-slate-900"
                      />
                    </th>
                    <th className="px-6 py-4 font-semibold text-slate-300">Participant</th>
                    <th className="px-6 py-4 font-semibold text-slate-300">Email</th>
                    <th className="px-6 py-4 font-semibold text-slate-300">Status</th>
                    {event?.isPaid && (
                      <>
                        <th className="px-6 py-4 font-semibold text-slate-300">Amount</th>
                        <th className="px-6 py-4 font-semibold text-slate-300">Txn ID</th>
                      </>
                    )}
                    <th className="px-6 py-4 font-semibold text-slate-300">Attendance</th>
                    <th className="px-6 py-4 font-semibold text-slate-300">Time</th>
                    <th className="px-6 py-4 font-semibold text-slate-300 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {groupedRegs.map((group, gIdx) => (
                    <React.Fragment key={group.teamId || `indiv-${gIdx}`}>
                      {group.teamId && (
                        <tr className="bg-gradient-to-r from-orange-500/15 via-orange-500/5 to-transparent border-t border-b border-orange-500/20">
                          <td className="px-6 py-3.5" colSpan={totalColumns}>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
                                  <Users className="w-4 h-4" />
                                </div>
                                <div className="flex flex-wrap items-center gap-2.5">
                                  <span className="text-xs font-black uppercase tracking-wider text-orange-400">
                                    Team: {group.teamName}
                                  </span>
                                  <span className="text-[10px] font-mono font-bold bg-orange-500/10 text-orange-300 px-2 py-0.5 rounded border border-orange-500/25">
                                    Code: {teams.find(t => t.id === group.teamId)?.inviteCode || 'N/A'}
                                  </span>
                                  <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                                    {group.regs.length} {group.regs.length === 1 ? 'Member' : 'Members'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {group.regs.some(r => r.status === RegistrationStatus.PENDING || r.status === RegistrationStatus.TEAM_AWAITING_SUBMISSION) ? (
                                  (() => {
                                    const minSize = event?.minTeamSize || 1;
                                    const maxSize = event?.maxTeamSize || 99;
                                    const count = group.regs.length;
                                    const isUnderSize = count < minSize;
                                    const isOverSize = count > maxSize;
                                    const isAwaitingSubmission = group.regs.some(r => r.status === RegistrationStatus.TEAM_AWAITING_SUBMISSION);
                                    const canApprove = !isUnderSize && !isOverSize && !isAwaitingSubmission;
                                    return (
                                      <div className="flex items-center gap-2">
                                        <button
                                          disabled={!canApprove}
                                          onClick={() => handleTeamStatusUpdate(group.teamId!, RegistrationStatus.APPROVED)}
                                          title={
                                            isAwaitingSubmission
                                              ? `Team is still being formed. Awaiting team leader submission (${count} joined)`
                                              : isUnderSize
                                              ? `Team requires ${minSize}–${maxSize} members before approval (Current: ${count})`
                                              : isOverSize
                                              ? `Team exceeds max capacity of ${maxSize} members`
                                              : `Approve team "${group.teamName}"`
                                          }
                                          className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${
                                            !canApprove
                                              ? 'bg-slate-800 text-amber-400/80 border-amber-500/30 cursor-not-allowed'
                                              : 'bg-green-600/20 text-green-400 border-green-500/30 hover:bg-green-600 hover:text-white cursor-pointer shadow-sm'
                                          }`}
                                        >
                                          {isAwaitingSubmission
                                            ? `Awaiting Leader (${count}/${minSize})`
                                            : isUnderSize
                                            ? `Incomplete (${count}/${minSize})`
                                            : isOverSize
                                            ? `Exceeds (${count}/${maxSize})`
                                            : `Approve Team (${count})`}
                                        </button>
                                        <button
                                          onClick={() => handleTeamStatusUpdate(group.teamId!, RegistrationStatus.REJECTED)}
                                          title={`Reject team "${group.teamName}"`}
                                          className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg border bg-red-600/10 text-red-400 border-red-500/30 hover:bg-red-600 hover:text-white cursor-pointer transition-all"
                                        >
                                          Reject
                                        </button>
                                      </div>
                                    );
                                  })()
                                ) : (
                                  <div className="flex items-center gap-1.5 text-xs">
                                    {group.regs.every(r => r.status === RegistrationStatus.APPROVED) ? (
                                      <span className="text-green-400 flex items-center gap-1 font-semibold text-[11px]"><CheckCircle className="w-3.5 h-3.5" /> Team Approved</span>
                                    ) : group.regs.every(r => r.status === RegistrationStatus.REJECTED) ? (
                                      <span className="text-red-400 flex items-center gap-1 font-semibold text-[11px]"><XCircle className="w-3.5 h-3.5" /> Team Rejected</span>
                                    ) : group.regs.some(r => r.status === RegistrationStatus.AWAITING_PAYMENT) ? (
                                      <span className="text-amber-400 flex items-center gap-1 font-semibold text-[11px]">Payment Pending</span>
                                    ) : null}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      {group.regs.map(reg => (
                        <tr key={reg.id} className={`hover:bg-slate-800/50 transition-colors ${selectedRegistrationIds.includes(reg.id) ? 'bg-orange-900/10' : ''} ${group.teamId ? 'bg-slate-900/40' : ''}`}>
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={selectedRegistrationIds.includes(reg.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRegistrationIds(prev => [...prev, reg.id]);
                                } else {
                                  setSelectedRegistrationIds(prev => prev.filter(id => id !== reg.id));
                                }
                              }}
                              className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-orange-600 focus:ring-orange-500 focus:ring-offset-slate-900"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-200">{reg.participantName}</span>
                              {reg.participationType === 'team' && reg.isTeamLeader && (
                                <span className="text-[8px] font-black uppercase tracking-wider text-orange-400 bg-orange-500/15 border border-orange-500/30 px-1.5 py-0.5 rounded">
                                  Leader
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-400">{reg.participantEmail}</td>
                          <td className="px-6 py-4"><Badge status={reg.status} /></td>
                          {event?.isPaid && (
                            <>
                              <td className="px-6 py-4 text-slate-300 font-medium">
                                {reg.paymentDetails?.amount ? `₹${reg.paymentDetails.amount}` : '-'}
                              </td>
                              <td className="px-6 py-4 text-slate-500 font-mono text-[10px] max-w-[120px] truncate" title={reg.paymentDetails?.transactionId}>
                                {reg.paymentDetails?.transactionId || '-'}
                              </td>
                            </>
                          )}
                          <td className="px-6 py-4">
                            {reg.attended ? (
                              <span className="flex items-center gap-1 text-green-500 font-medium text-xs">
                                <CheckCircle className="w-4 h-4" /> Present
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">Not yet</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-400 text-xs">
                            {reg.attendanceTime ? format(new Date(reg.attendanceTime), 'h:mm a') : '-'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {reg.status === RegistrationStatus.PENDING && (
                                reg.participationType === 'team' ? (
                                  <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-lg border border-orange-500/20 whitespace-nowrap">
                                    Team Managed
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleStatusUpdate(reg.id, RegistrationStatus.APPROVED)}
                                      className="p-1.5 text-green-400 hover:bg-green-900/30 rounded-lg transition-colors"
                                      title="Approve"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleStatusUpdate(reg.id, RegistrationStatus.REJECTED)}
                                      className="p-1.5 text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                                      title="Reject"
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </button>
                                  </div>
                                )
                              )}
                              {reg.status === RegistrationStatus.APPROVED && !reg.attended && (
                                <button
                                  onClick={() => handleManualAttendance(reg.id)}
                                  className="text-xs font-semibold text-orange-400 hover:text-orange-300 hover:underline px-2 py-1 rounded hover:bg-orange-500/10 transition-colors whitespace-nowrap"
                                >
                                  Mark Present
                                </button>
                              )}
                              <button
                                onClick={() => setSelectedRegistrationDetails(reg)}
                                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                                title="View Details"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteRegistration(reg.id)}
                                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="Delete Registration"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                  {groupedRegs.length === 0 && (
                    <tr>
                      <td colSpan={totalColumns} className="px-6 py-8 text-center text-slate-400">No registrations found matching criteria.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderEditProfile = () => {
    if (!currentUser) return null;

    const roleBadgeColor = currentUser.role === 'admin'
      ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
      : currentUser.role === 'organizer'
        ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';

    const handleBack = () => {
      if (window.history.length > 2) {
        navigate(-1);
      } else if (currentUser.role === 'admin') {
        navigate('/admin');
      } else if (currentUser.role === 'organizer') {
        navigate('/organizer');
      } else {
        navigate('/explore');
      }
    };

    return (
      <div className="pt-28 pb-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 animate-in fade-in duration-500">
        {/* Top Navigation Row */}
        <div className="flex items-center justify-between mb-8">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all text-xs font-bold uppercase tracking-wider border border-white/10 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border ${roleBadgeColor}`}>
              {currentUser.role}
            </span>
          </div>
        </div>

        {/* Page Title & Subtitle */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
            <span className="text-[10px] font-black text-orange-400 uppercase tracking-[0.3em]">Account Settings</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black font-outfit text-white tracking-tight">
            Edit Profile
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage your personal identity, contact verification, and account credentials.
          </p>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-8">
          {/* Card 1: Identity & Avatar */}
          <div className="glass-card rounded-[32px] p-6 sm:p-8 border border-white/10 bg-[#0f172a]/60 backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8 pb-8 border-b border-white/5">
              {/* Avatar Photo with Hover Action */}
              <div className="relative group cursor-pointer flex-shrink-0">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 border-[#0f172a] shadow-2xl ring-2 ring-white/10 group-hover:ring-orange-500 transition-all duration-300 flex items-center justify-center bg-slate-800">
                  {profileForm.avatarUrl || currentUser?.avatarUrl ? (
                    <img
                      src={profileForm.avatarUrl || currentUser?.avatarUrl}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserCircle className="w-20 h-20 text-slate-600" />
                  )}
                </div>
                <div className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                  <Camera className="w-7 h-7 text-white drop-shadow-lg mb-1" />
                  <span className="text-[9px] font-bold text-white uppercase tracking-wider">Change</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  onChange={(e) => handleImageUpload(e, 'profile')}
                />
              </div>

              {/* Identity Header */}
              <div className="flex-1 text-center sm:text-left space-y-2">
                <h3 className="text-xl font-bold font-outfit text-white">
                  {profileForm.name || currentUser.name || 'Your Name'}
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  {currentUser.email}
                </p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${roleBadgeColor}`}>
                    {currentUser.role} Account
                  </span>
                  {currentUser.phoneNumber && (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Phone Verified
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 pt-1">
                  Click on your photo above to upload or crop a custom avatar image (PNG, JPG, max 5MB).
                </p>
              </div>
            </div>

            {/* Inputs: Full Name & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider ml-1">Full Name</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3.5 rounded-2xl bg-slate-900/80 border border-slate-700/60 text-white font-medium focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 outline-none transition-all placeholder:text-slate-600"
                  value={profileForm.name}
                  onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Email Address</label>
                  <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Read Only
                  </span>
                </div>
                <input
                  type="email"
                  disabled
                  className="w-full px-4 py-3.5 rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-500 font-medium cursor-not-allowed outline-none select-none"
                  value={profileForm.email}
                />
                <p className="text-[10px] text-slate-600 ml-1">Email is tied to your primary login account and cannot be modified directly.</p>
              </div>
            </div>
          </div>

          {/* Card 2: Contact & Phone Verification */}
          <div className="glass-card rounded-[32px] p-6 sm:p-8 border border-white/10 bg-[#0f172a]/60 backdrop-blur-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-white/5">
              <div>
                <h3 className="text-lg font-bold font-outfit text-white">Contact & Mobile Verification</h3>
                <p className="text-xs text-slate-400 mt-0.5">Used for critical booking confirmations, entry gate passes, and SMS OTP authentication.</p>
              </div>
              {profileForm.isPhoneVerified ? (
                <span className="text-xs text-green-400 font-bold flex items-center gap-1.5 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20 self-start sm:self-auto">
                  <CheckCircle className="w-3.5 h-3.5" /> Verified
                </span>
              ) : (
                <span className="text-xs text-amber-400 font-bold bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 self-start sm:self-auto">
                  Verification Required
                </span>
              )}
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider ml-1">Mobile Phone Number</label>
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Country Code Selector */}
                <div className="relative w-full sm:w-44 shrink-0">
                  <select
                    disabled={isSendingProfilePhoneOtp || isVerifyingProfilePhoneOtp || !!currentUser?.phoneNumber}
                    value={profileDialCode}
                    onChange={e => {
                      setProfileDialCode(e.target.value);
                      const newFull = `${e.target.value}${profileNationalNumber.replace(/[^0-9]/g, '')}`;
                      setProfileForm(prev => ({
                        ...prev,
                        phoneNumber: newFull,
                        isPhoneVerified: newFull === currentUser?.phoneNumber
                      }));
                    }}
                    className="w-full px-4 py-3.5 rounded-2xl border border-slate-700/60 bg-slate-900/90 text-white font-mono text-xs font-bold outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 appearance-none cursor-pointer pr-8 disabled:opacity-50"
                  >
                    {COUNTRY_CODES.map(c => (
                      <option key={c.code} value={c.dialCode} className="bg-[#0f172a] text-white py-1.5">
                        {c.flag} {c.name} ({c.dialCode})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {/* National Phone Input */}
                <div className="relative flex-1">
                  <input
                    type="tel"
                    inputMode="numeric"
                    disabled={!!currentUser?.phoneNumber}
                    placeholder="98765 43210"
                    value={profileNationalNumber}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9\s-]/g, '');
                      setProfileNationalNumber(val);
                      const newFullPhone = `${profileDialCode}${val.replace(/[^0-9]/g, '')}`;
                      setProfileForm(prev => ({
                        ...prev,
                        phoneNumber: newFullPhone,
                        isPhoneVerified: newFullPhone === currentUser?.phoneNumber
                      }));
                    }}
                    className={`w-full px-4 py-3.5 rounded-2xl bg-slate-900/80 border text-white font-mono font-medium outline-none transition-all ${profileForm.isPhoneVerified
                      ? 'border-green-500/40 bg-green-950/20 text-green-200'
                      : 'border-slate-700/60 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30'
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
                  />
                </div>

                {/* Verify Button (Twilio SMS) */}
                {!currentUser?.phoneNumber && !profileForm.isPhoneVerified && profileNationalNumber.trim().length >= 5 && (
                  <button
                    type="button"
                    disabled={isSendingProfilePhoneOtp || isVerifyingProfilePhoneOtp}
                    onClick={handleSendProfilePhoneOtp}
                    className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-bold text-xs shadow-lg shadow-orange-900/30 whitespace-nowrap cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95"
                  >
                    {isSendingProfilePhoneOtp ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending SMS...</span>
                      </>
                    ) : (
                      <>
                        <Smartphone className="w-4 h-4" />
                        <span>Verify via SMS</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {currentUser?.phoneNumber ? (
                <p className="text-[11px] text-green-400 font-medium ml-1 flex items-center gap-1.5 pt-1">
                  <Shield className="w-3.5 h-3.5" /> Your phone number is verified and securely linked to your account.
                </p>
              ) : (
                <p className="text-[11px] text-slate-500 ml-1 pt-1">
                  Select your country code and enter your mobile digits to receive an SMS verification code.
                </p>
              )}

              {/* OTP Entry when OTP dispatched */}
              <AnimatePresence>
                {showOtpInput && otpPurpose === 'profile' && !profileForm.isPhoneVerified && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="pt-3"
                  >
                    <div className="p-4 rounded-2xl bg-slate-900 border border-orange-500/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-orange-400 flex items-center gap-1.5">
                          <KeyRound className="w-4 h-4" /> Enter 6-Digit SMS Code
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          Sent to {profileDialCode} {profileNationalNumber.replace(/[^0-9]/g, '')}
                        </span>
                      </div>

                      <div className="flex gap-3">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          placeholder="••••••"
                          value={otp}
                          onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                          className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-orange-500/60 text-white font-mono text-center tracking-[0.5em] font-bold text-lg focus:ring-2 focus:ring-orange-500/30 outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          disabled={isVerifyingProfilePhoneOtp || otp.length < 4}
                          onClick={handleVerifyProfilePhoneOtp}
                          className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-green-900/30 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
                        >
                          {isVerifyingProfilePhoneOtp ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Verifying...</span>
                            </>
                          ) : (
                            <span>Confirm OTP</span>
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Card 3: Danger Zone */}
          <div className="rounded-[32px] p-6 sm:p-8 border border-red-500/20 bg-red-950/10 backdrop-blur-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Danger Zone
                </h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-xl">
                  Permanently delete your Eventron account, active permits, registrations, and associated profile records. This action cannot be undone.
                </p>
              </div>
              <button
                type="button"
                disabled={isSendingDeleteOtp}
                onClick={() => handleOpenDeleteModal()}
                className="px-5 py-3 rounded-2xl text-xs font-bold border transition-all bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 whitespace-nowrap self-start sm:self-auto"
              >
                {isSendingDeleteOtp ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                    <span>Sending Code...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Account</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Bottom Action Row */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={handleBack}
              className="px-6 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-sm transition-all cursor-pointer border border-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingProfile}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-bold text-sm shadow-xl shadow-orange-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              {isSavingProfile ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-20">
      {activeTab !== 'admin' && renderHeader()}
      <ToastContainer toasts={toasts} />

      <main className="pt-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <Routes>
          <Route path="/" element={
            currentUser ? (
              currentUser.role === 'admin' ? (
                <Navigate to="/admin" replace />
              ) : currentUser.role === 'organizer' ? (
                <Navigate to="/organizer" replace />
              ) : (
                <Navigate to="/explore" replace />
              )
            ) : (
              <div className="min-h-[80vh] flex flex-col items-center justify-center relative overflow-hidden rounded-[2rem] mt-6 border border-zinc-800">
                <div className="absolute inset-0 bg-[url('/amadeus-moga-51lUmJT3g_Y-unsplash.jpg')] bg-cover bg-center opacity-30"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#16161a] via-[#16161a]/80 to-transparent"></div>
                <div className="relative z-10 text-center px-4">
                  <h1 className="text-5xl md:text-6xl font-black text-white mb-6 tracking-tight">Welcome to <span className="text-[#ff5c35]">Eventron</span></h1>
                  <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10">Sign in to discover and manage unforgettable events.</p>
                  <button onClick={() => setIsAuthModalOpen(true)} className="px-8 py-4 bg-[#ff5c35] hover:bg-[#e04d2a] text-white rounded-full font-bold transition-all shadow-lg shadow-orange-900/20 text-sm uppercase tracking-widest">Sign In</button>
                </div>
              </div>
            )
          } />
          <Route path="/explore" element={currentUser?.role === 'organizer' ? <Navigate to="/organizer" replace /> : currentUser?.role === 'admin' ? <Navigate to="/admin" replace /> : renderEvents()} />
          <Route path="/browse" element={currentUser?.role === 'organizer' ? <Navigate to="/organizer" replace /> : currentUser?.role === 'admin' ? <Navigate to="/admin" replace /> : renderEvents()} />
          <Route path="/myticket" element={currentUser ? renderMyTickets() : <div className="text-center py-20 text-slate-400 glass-panel rounded-2xl mx-auto max-w-md">Please sign in to view your tickets.</div>} />
          <Route path="/organizer" element={authLoading ? <div className="flex justify-center items-center py-40"><Loader2 className="w-10 h-10 animate-spin text-orange-500" /></div> : currentUser?.role === 'organizer' ? renderOrganizer() : currentUser?.role === 'admin' ? <Navigate to="/admin" replace /> : <Navigate to="/explore" replace />} />
          <Route path="/edit-page" element={currentUser ? renderEditProfile() : <Navigate to="/" replace />} />
          <Route path="/edit-profile" element={<Navigate to="/edit-page" replace />} />
          <Route path="/admin" element={
            <Suspense fallback={<div className="flex justify-center p-20"><Loader2 className="animate-spin text-orange-500" /></div>}>
              {currentUser?.role === 'admin' ? <AdminDashboard currentUser={currentUser} onLogout={handleLogout} /> : <div className="text-center py-20 text-slate-400 glass-panel rounded-2xl mx-auto max-w-md">Access Restricted</div>}
            </Suspense>
          } />
          <Route path="/terms" element={<Suspense fallback={<div className="pt-32 text-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin mx-auto text-orange-500" /></div>}><TermsPage /></Suspense>} />
          <Route path="/privacy" element={<Suspense fallback={<div className="pt-32 text-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin mx-auto text-orange-500" /></div>}><PrivacyPage /></Suspense>} />
          <Route path="/refund" element={<Suspense fallback={<div className="pt-32 text-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin mx-auto text-orange-500" /></div>}><RefundPage /></Suspense>} />
          <Route path="*" element={<Suspense fallback={<div className="pt-32 text-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin mx-auto text-orange-500" /></div>}><NotFound /></Suspense>} />
        </Routes>
      </main>

      {/* Footer */}
      {activeTab !== 'admin' && (
        <footer className="w-full bg-slate-900 border-t border-slate-800 mt-20 py-12 relative z-10">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-1">
              <div className="flex items-center mb-4">
                <span className="text-xl font-black font-outfit text-white tracking-tight">Eventron</span>
              </div>
              <p className="text-slate-400 text-sm">Where every moment becomes a legacy. Connect with the extraordinary.</p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4 font-outfit">Explore</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" onClick={(e) => { e.preventDefault(); navigate('/explore'); window.scrollTo(0, 0); }} className="hover:text-orange-400 transition-colors">Upcoming Events</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); navigate('/explore'); window.scrollTo(0, document.body.scrollHeight / 2); }} className="hover:text-orange-400 transition-colors">Past Memories</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); navigate('/explore'); window.scrollTo(0, 0); }} className="hover:text-orange-400 transition-colors">AI Recommendations</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4 font-outfit">Support</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" onClick={(e) => { e.preventDefault(); addToast('Help Center is under construction', 'info'); }} className="hover:text-orange-400 transition-colors">Help Center</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); addToast('Contact Us form coming soon', 'info'); }} className="hover:text-orange-400 transition-colors">Contact Us</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); addToast('Issue reporting will be available soon', 'info'); }} className="hover:text-orange-400 transition-colors">Report an Issue</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4 font-outfit">Legal</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" onClick={(e) => { e.preventDefault(); navigate('/terms'); window.scrollTo(0, 0); }} className="hover:text-orange-400 transition-colors">Terms and Conditions</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); navigate('/privacy'); window.scrollTo(0, 0); }} className="hover:text-orange-400 transition-colors">Privacy Policy</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); navigate('/refund'); window.scrollTo(0, 0); }} className="hover:text-orange-400 transition-colors">Refund & Cancellation Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
            &copy; {new Date().getFullYear()} Eventron. All rights reserved.
          </div>
        </footer>
      )}

      {renderAuthModal()}
      <Suspense fallback={null}>
        <LiquidChrome />
      </Suspense>

      {/* --- MODALS --- */}

      {/* CREATE / EDIT EVENT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-slate-900 w-full h-full sm:h-auto sm:max-w-lg sm:rounded-3xl shadow-2xl border-none sm:border sm:border-slate-800 flex flex-col max-h-full sm:max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 z-10 flex-shrink-0">
              <h3 className="text-xl font-bold text-white font-outfit">{isEditMode ? 'Edit Event' : 'Create New Event'}</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-200 p-1">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <form onSubmit={handleSaveEvent} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2 font-outfit">Event Image</label>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="relative w-full sm:w-48 h-40 sm:h-32 bg-slate-950 rounded-xl border-2 border-dashed border-slate-700 flex items-center justify-center overflow-hidden group hover:border-orange-500/50 transition-colors">
                      {newEvent.imageUrl ? (
                        <>
                          <img src={newEvent.imageUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80'; }} />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-white text-xs flex items-center gap-1"><Upload className="w-4 h-4" /> Change</p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setNewEvent(prev => ({ ...prev, imageUrl: '' }));
                            }}
                            className="absolute top-2 right-2 p-1.5 bg-slate-800/80 backdrop-blur-sm text-slate-300 rounded-full shadow-md hover:bg-slate-700 hover:text-red-400 transition-colors z-20"
                            title="Remove Image"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <div className="text-center p-4">
                          <ImageIcon className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                          <p className="text-[10px] text-slate-500">Pick a cover image</p>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={handleImageUpload}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Event Title</label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                    value={newEvent.title}
                    onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                    placeholder="e.g. Summer Tech Gala"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Start Date & Time</label>
                    <input
                      required
                      type="datetime-local"
                      className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none dark-calendar"
                      value={newEvent.date}
                      onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">End Date & Time</label>
                    <input
                      required
                      type="datetime-local"
                      className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none dark-calendar"
                      value={newEvent.endDate}
                      onChange={e => setNewEvent({ ...newEvent, endDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Event Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setNewEvent({ ...newEvent, locationType: 'offline' })}
                        className={`py-2 px-4 rounded-lg border text-sm font-medium transition-all ${newEvent.locationType === 'offline'
                          ? 'bg-orange-900/40 border-orange-500 text-orange-400 shadow-lg shadow-orange-900/20'
                          : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600 hover:bg-slate-900'
                          }`}
                      >
                        Offline Event
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewEvent({ ...newEvent, locationType: 'online' })}
                        className={`py-2 px-4 rounded-lg border text-sm font-medium transition-all ${newEvent.locationType === 'online'
                          ? 'bg-orange-900/40 border-orange-500 text-orange-400 shadow-lg shadow-orange-900/20'
                          : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600 hover:bg-slate-900'
                          }`}
                      >
                        Online Event
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">{newEvent.locationType === 'online' ? 'Meeting Link / Platform' : 'Location / Venue'}</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none"
                      value={newEvent.location}
                      onChange={e => setNewEvent({ ...newEvent, location: e.target.value })}
                      placeholder={newEvent.locationType === 'online' ? 'Zoom, Google Meet, etc.' : 'City or Venue'}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Event Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {['AI', 'ML', 'Conference', 'Tech', 'Hackathon', 'Networking', 'Startup', 'Workshop', 'Design'].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const tags = newEvent.tags || [];
                          if (tags.includes(tag)) {
                            setNewEvent({ ...newEvent, tags: tags.filter(t => t !== tag) });
                          } else {
                            if (tags.length >= 5) return; // Limit to 5 tags
                            setNewEvent({ ...newEvent, tags: [...tags, tag] });
                          }
                        }}
                        className={`py-1.5 px-3 rounded-lg border text-xs font-medium transition-all ${(newEvent.tags || []).includes(tag)
                          ? 'bg-orange-900/40 border-orange-500 text-orange-400 shadow-lg shadow-orange-900/20'
                          : 'bg-slate-950 border-slate-700 text-slate-500 hover:border-slate-600'
                          }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Select up to 5 tags to improve AI recommendations.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Capacity</label>
                  <input
                    required
                    type="number"
                    min="1"
                    className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    value={newEvent.capacity}
                    onChange={e => setNewEvent({ ...newEvent, capacity: e.target.value })}
                    placeholder="Max attendees"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Participation Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['individual', 'team', 'both'].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setNewEvent({ ...newEvent, participationMode: mode as ParticipationMode })}
                        className={`py-2 px-2 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all ${newEvent.participationMode === mode
                          ? 'bg-orange-900/40 border-orange-500 text-orange-400 shadow-lg shadow-orange-900/20'
                          : 'bg-slate-950 border-slate-700 text-slate-500 hover:border-slate-600'
                          }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {(newEvent.participationMode === 'team' || newEvent.participationMode === 'both') && (
                  <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Min Team Size</label>
                      <input
                        required
                        type="number"
                        min="1"
                        className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                        value={newEvent.minTeamSize}
                        onChange={e => setNewEvent({ ...newEvent, minTeamSize: e.target.value })}
                        placeholder="e.g. 2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Max Team Size</label>
                      <input
                        required
                        type="number"
                        min="1"
                        className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                        value={newEvent.maxTeamSize}
                        onChange={e => setNewEvent({ ...newEvent, maxTeamSize: e.target.value })}
                        placeholder="e.g. 5"
                      />
                    </div>
                  </div>
                )}

                <div className="border-t border-slate-800 pt-4 mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-medium text-slate-300">Event Admission</label>
                    <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setNewEvent({ ...newEvent, isPaid: false })}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${!newEvent.isPaid ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                      >
                        Free
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewEvent({ ...newEvent, isPaid: true })}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${newEvent.isPaid ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                      >
                        Paid
                      </button>
                    </div>
                  </div>

                  {newEvent.isPaid && (
                    <div className="space-y-4 animate-in slide-in-from-top-2">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                          {newEvent.pricingType === 'per_person' ? 'Price Per Person (₹)' : 'Fixed Event Price (₹)'}
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none"
                          value={newEvent.price}
                          onChange={e => setNewEvent({ ...newEvent, price: e.target.value })}
                          placeholder={newEvent.pricingType === 'per_person' ? "e.g. 25" : "e.g. 100"}
                        />
                      </div>

                      {/* Pricing Model: Overall vs Per Person */}
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Pricing Structure for Teams
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setNewEvent({ ...newEvent, pricingType: 'overall' })}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              newEvent.pricingType !== 'per_person'
                                ? 'bg-orange-500/10 border-orange-500 text-orange-400 shadow-md'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            <p className="text-xs font-bold uppercase tracking-wide">Overall Fixed Fee</p>
                            <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                              Fixed total price irrespective of team size (e.g. ₹{newEvent.price || 100} flat)
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewEvent({ ...newEvent, pricingType: 'per_person' })}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              newEvent.pricingType === 'per_person'
                                ? 'bg-orange-500/10 border-orange-500 text-orange-400 shadow-md'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            <p className="text-xs font-bold uppercase tracking-wide">Per Person Wise</p>
                            <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                              Rate multiplied by total team members (e.g. ₹{newEvent.price || 25} × members)
                            </p>
                          </button>
                        </div>
                      </div>

                      <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 space-y-4">
                        <label className="block text-sm font-bold text-orange-400 mb-2">Revenue Settlement Details</label>
                        <p className="text-xs text-slate-500 mb-3">Please provide at least one method for receiving payouts.</p>

                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">UPI ID</label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                            placeholder="e.g. username@upi"
                            value={newEvent.organizerPaymentDetails?.upiId || ''}
                            onChange={e => setNewEvent({
                              ...newEvent,
                              organizerPaymentDetails: {
                                ...newEvent.organizerPaymentDetails,
                                upiId: e.target.value
                              }
                            })}
                          />
                        </div>

                        <div className="border-t border-slate-800 pt-3">
                          <label className="block text-xs font-medium text-slate-400 mb-2">Bank Account Details (Optional)</label>
                          <div className="space-y-2">
                            <input
                              type="text"
                              className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                              placeholder="Account Holder Name"
                              value={newEvent.organizerPaymentDetails?.bankDetails?.accountName || ''}
                              onChange={e => setNewEvent({
                                ...newEvent,
                                organizerPaymentDetails: {
                                  ...newEvent.organizerPaymentDetails,
                                  bankDetails: {
                                    ...(newEvent.organizerPaymentDetails?.bankDetails || { accountNumber: '', ifsc: '', accountName: '' }),
                                    accountName: e.target.value
                                  }
                                }
                              })}
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                placeholder="Account Number"
                                value={newEvent.organizerPaymentDetails?.bankDetails?.accountNumber || ''}
                                onChange={e => setNewEvent({
                                  ...newEvent,
                                  organizerPaymentDetails: {
                                    ...newEvent.organizerPaymentDetails,
                                    bankDetails: {
                                      ...(newEvent.organizerPaymentDetails?.bankDetails || { accountNumber: '', ifsc: '', accountName: '' }),
                                      accountNumber: e.target.value
                                    }
                                  }
                                })}
                              />
                              <input
                                type="text"
                                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-sm focus:ring-2 focus:ring-orange-500 outline-none uppercase"
                                placeholder="IFSC Code"
                                value={newEvent.organizerPaymentDetails?.bankDetails?.ifsc || ''}
                                onChange={e => setNewEvent({
                                  ...newEvent,
                                  organizerPaymentDetails: {
                                    ...newEvent.organizerPaymentDetails,
                                    bankDetails: {
                                      ...(newEvent.organizerPaymentDetails?.bankDetails || { accountNumber: '', ifsc: '', accountName: '' }),
                                      ifsc: e.target.value.toUpperCase()
                                    }
                                  }
                                })}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Promo Codes</label>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <input
                            type="text"
                            placeholder="CODE"
                            className="flex-[2] min-w-[100px] px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-sm focus:ring-2 focus:ring-orange-500 outline-none uppercase"
                            value={promoCodeInput.code}
                            onChange={e => setPromoCodeInput({ ...promoCodeInput, code: e.target.value.toUpperCase() })}
                          />
                          <select
                            className="w-[70px] px-2 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                            value={promoCodeInput.type}
                            onChange={e => setPromoCodeInput({ ...promoCodeInput, type: e.target.value as 'percentage' | 'fixed' })}
                          >
                            <option value="percentage">%</option>
                            <option value="fixed">₹</option>
                          </select>
                          <input
                            type="number"
                            placeholder="Val"
                            className="w-[60px] px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                            value={promoCodeInput.value}
                            onChange={e => setPromoCodeInput({ ...promoCodeInput, value: e.target.value })}
                          />
                          <input
                            type="number"
                            placeholder="Max"
                            title="Usage Limit"
                            className="w-[60px] px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                            value={promoCodeInput.limit}
                            onChange={e => setPromoCodeInput({ ...promoCodeInput, limit: e.target.value })}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (promoCodeInput.code && promoCodeInput.value) {
                                setNewEvent(prev => ({
                                  ...prev,
                                  promoCodes: [
                                    ...(prev.promoCodes || []),
                                    {
                                      code: promoCodeInput.code,
                                      type: promoCodeInput.type,
                                      value: Number(promoCodeInput.value),
                                      usageLimit: promoCodeInput.limit ? Number(promoCodeInput.limit) : undefined,
                                      usedCount: 0
                                    }
                                  ]
                                }));
                                setPromoCodeInput({ code: '', type: 'percentage', value: '', limit: '' });
                              }
                            }}
                            className="p-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors flex items-center justify-center"
                            title="Add Promo Code"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="space-y-2">
                          {newEvent.promoCodes.map((code, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-slate-900 px-3 py-2 rounded-lg border border-slate-800">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-orange-400 font-bold">{code.code}</span>
                                <span className="text-slate-400 text-xs">
                                  (-{code.value}{code.type === 'percentage' ? '%' : '₹'})
                                </span>
                                {code.usageLimit && (
                                  <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded ml-1">
                                    Limit: {code.usageLimit}
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const newCodes = [...newEvent.promoCodes];
                                  newCodes.splice(idx, 1);
                                  setNewEvent({ ...newEvent, promoCodes: newCodes });
                                }}
                                className="text-slate-500 hover:text-red-400"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Custom Questions Section */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-slate-300">Custom Registration Questions</label>
                    <button
                      type="button"
                      onClick={() => {
                        const newQ: CustomQuestion = {
                          id: generateUUID(),
                          question: '',
                          type: 'text',
                          required: false
                        };
                        setNewEvent(prev => ({ ...prev, customQuestions: [...prev.customQuestions, newQ] }));
                      }}
                      className="text-xs bg-orange-900/40 text-orange-400 px-2 py-1 rounded-md hover:bg-orange-900/60 font-medium"
                    >
                      + Add Question
                    </button>
                  </div>

                  <div className="space-y-3">
                    {newEvent.customQuestions.map((q, idx) => (
                      <div key={q.id} className="p-3 bg-slate-950 rounded-lg border border-slate-700">
                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            className="flex-1 px-3 py-1.5 text-sm rounded border border-slate-700 bg-slate-900 text-slate-100 focus:ring-1 focus:ring-orange-500 outline-none"
                            placeholder="Question text (e.g. Dietary restrictions?)"
                            value={q.question}
                            onChange={e => {
                              const updated = [...newEvent.customQuestions];
                              updated[idx].question = e.target.value;
                              setNewEvent({ ...newEvent, customQuestions: updated });
                            }}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = newEvent.customQuestions.filter(x => x.id !== q.id);
                              setNewEvent({ ...newEvent, customQuestions: updated });
                            }}
                            className="text-slate-400 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          <div className="flex items-center gap-1">
                            <span>Type:</span>
                            <select
                              className="bg-slate-900 border border-slate-700 text-slate-100 rounded px-2 py-1 outline-none"
                              value={q.type}
                              onChange={e => {
                                const updated = [...newEvent.customQuestions];
                                updated[idx].type = e.target.value as any;
                                setNewEvent({ ...newEvent, customQuestions: updated });
                              }}
                            >
                              <option value="text">Text</option>
                              <option value="boolean">Yes/No</option>
                              <option value="select">Select (Dropdown)</option>
                            </select>
                          </div>
                          <label className="flex items-center gap-1 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={q.required}
                              onChange={e => {
                                const updated = [...newEvent.customQuestions];
                                updated[idx].required = e.target.checked;
                                setNewEvent({ ...newEvent, customQuestions: updated });
                              }}
                              className="rounded text-orange-600 focus:ring-orange-500"
                            />
                            Required
                          </label>
                        </div>
                        {q.type === 'select' && (
                          <div className="mt-2">
                            <input
                              type="text"
                              className="w-full px-3 py-1.5 text-xs rounded border border-slate-700 bg-slate-900 text-slate-100 focus:ring-1 focus:ring-orange-500 outline-none"
                              placeholder="Options separated by comma (e.g. Red, Blue, Green)"
                              value={q.options?.join(', ') || ''}
                              onChange={e => {
                                const updated = [...newEvent.customQuestions];
                                updated[idx].options = e.target.value.split(',').map(s => s.trim());
                                setNewEvent({ ...newEvent, customQuestions: updated });
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                    {newEvent.customQuestions.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-2 italic">No custom questions added yet.</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Co-Organizers</label>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="email"
                      className="flex-1 px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none"
                      placeholder="Enter organizer email"
                      value={collaboratorEmailInput}
                      onChange={e => setCollaboratorEmailInput(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (collaboratorEmailInput && !newEvent.collaboratorEmails?.includes(collaboratorEmailInput)) {
                          setNewEvent(prev => ({
                            ...prev,
                            collaboratorEmails: [...(prev.collaboratorEmails || []), collaboratorEmailInput]
                          }));
                          setCollaboratorEmailInput('');
                        }
                      }}
                      disabled={!collaboratorEmailInput}
                      className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>

                  {newEvent.collaboratorEmails && newEvent.collaboratorEmails.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {newEvent.collaboratorEmails.map(email => (
                        <div key={email} className="flex items-center gap-2 bg-slate-800 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-full text-sm">
                          <span>{email}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setNewEvent(prev => ({
                                ...prev,
                                collaboratorEmails: prev.collaboratorEmails.filter(e => e !== email)
                              }));
                            }}
                            className="text-slate-500 hover:text-red-400"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {(!newEvent.collaboratorEmails || newEvent.collaboratorEmails.length === 0) && (
                    <p className="text-xs text-slate-500 italic">No co-organizers added.</p>
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-slate-300">Description</label>
                    <button
                      type="button"
                      onClick={handleGenerateDescription}
                      disabled={isGeneratingAI}
                      className={`text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all font-medium ${isGeneratingAI
                        ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] text-white cursor-wait'
                        : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:opacity-90 hover:scale-105'
                        }`}
                    >
                      {isGeneratingAI ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      {isGeneratingAI ? 'Generating...' : 'AI Assist'}
                    </button>
                  </div>
                  <textarea
                    required
                    className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none h-32 resize-none"
                    value={newEvent.description}
                    onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                    placeholder="Describe your event..."
                  ></textarea>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-orange-900/20"
                  >
                    {isEditMode ? 'Update Event' : 'Publish Event'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div >
      )
      }

      {/* REGISTER MODAL */}
      {
        selectedEventForReg && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/90 backdrop-blur-2xl animate-in fade-in duration-300">
            <div className="bg-slate-900 w-full h-full sm:h-auto sm:max-w-md sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
              <div className="bg-orange-600 p-6 text-white relative flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center border border-white/30 backdrop-blur-md">
                    <CheckSquare className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black font-outfit tracking-tight">Permission Protocol</h3>
                    <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest truncate max-w-[200px]">{selectedEventForReg.title}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedEventForReg(null); setRegistrationAnswers({}); setTeamRegistrationData({ mode: 'individual', subMode: 'create', teamName: '', inviteCode: '' }); }}
                  className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleRegister} className="p-6 md:p-8 overflow-y-auto flex-1 custom-scrollbar">
                {/* Participation Mode Choice */}
                {selectedEventForReg.participationMode !== 'individual' && selectedEventForReg.maxTeamSize && (
                  <div className="mb-6 space-y-4">
                    <label className="block text-sm font-medium text-slate-300 mb-2 font-outfit uppercase tracking-wider text-[11px]">Join As</label>
                    <div className="grid grid-cols-2 gap-3">
                      {['individual', 'team'].map((m) => {
                        if (selectedEventForReg.participationMode === 'team' && m === 'individual') return null;
                        if (selectedEventForReg.participationMode === 'individual' && m === 'team') return null;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setTeamRegistrationData(prev => ({ ...prev, mode: m as any }))}
                            className={`py-3 px-4 rounded-xl border text-sm font-bold transition-all ${teamRegistrationData.mode === m
                              ? 'bg-orange-900/40 border-orange-500 text-orange-400 shadow-lg shadow-orange-900/20 active:scale-95'
                              : 'bg-slate-950 border-slate-700 text-slate-500 hover:border-slate-600 active:scale-95'
                              }`}
                          >
                            {m === 'individual' ? <UserCircle className="w-4 h-4 mx-auto mb-1" /> : <Users className="w-4 h-4 mx-auto mb-1" />}
                            {m === 'individual' ? 'Individually' : 'As a Team'}
                          </button>
                        );
                      })}
                    </div>

                    {teamRegistrationData.mode === 'team' && (
                      <div className="animate-in slide-in-from-top-2 duration-300 space-y-4 pt-2">
                        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                          <button
                            type="button"
                            onClick={() => setTeamRegistrationData(prev => ({ ...prev, subMode: 'create' }))}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${teamRegistrationData.subMode === 'create' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                          >
                            Create Team
                          </button>
                          <button
                            type="button"
                            onClick={() => setTeamRegistrationData(prev => ({ ...prev, subMode: 'join' }))}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${teamRegistrationData.subMode === 'join' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                          >
                            Join Team
                          </button>
                        </div>

                        {teamRegistrationData.subMode === 'create' ? (
                          <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1 uppercase">Team Name</label>
                            <input
                              required
                              type="text"
                              placeholder="My Awesome Team"
                              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                              value={teamRegistrationData.teamName}
                              onChange={e => setTeamRegistrationData(prev => ({ ...prev, teamName: e.target.value }))}
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1 uppercase">Invite Code</label>
                            <input
                              required
                              type="text"
                              placeholder="ABC123"
                              className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none uppercase transition-all"
                              value={teamRegistrationData.inviteCode}
                              onChange={e => setTeamRegistrationData(prev => ({ ...prev, inviteCode: e.target.value.toUpperCase() }))}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <p className="text-slate-400 mb-6 font-outfit">
                  You are registering as <span className="font-semibold text-white">{currentUser.name}</span> ({currentUser.email}).
                </p>

                {/* Custom Questions Display */}
                {selectedEventForReg.customQuestions && selectedEventForReg.customQuestions.length > 0 && (
                  <div className="space-y-4 mb-6 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {selectedEventForReg.customQuestions.map(q => (
                      <div key={q.id}>
                        <label className="block text-sm font-medium text-slate-300 mb-1 font-outfit">
                          {q.question} {q.required && <span className="text-red-400">*</span>}
                        </label>

                        {q.type === 'text' && (
                          <input
                            type="text"
                            required={q.required}
                            value={registrationAnswers[q.id] || ''}
                            className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                            onChange={e => setRegistrationAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                          />
                        )}

                        {q.type === 'boolean' && (
                          <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                              <input
                                type="radio"
                                name={q.id}
                                value="yes"
                                required={q.required}
                                checked={registrationAnswers[q.id] === 'Yes'}
                                onChange={e => setRegistrationAnswers(prev => ({ ...prev, [q.id]: 'Yes' }))}
                                className="w-4 h-4 text-orange-500 focus:ring-orange-500 bg-slate-950 border-slate-700"
                              />
                              Yes
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                              <input
                                type="radio"
                                name={q.id}
                                value="no"
                                required={q.required}
                                checked={registrationAnswers[q.id] === 'No'}
                                onChange={e => setRegistrationAnswers(prev => ({ ...prev, [q.id]: 'No' }))}
                                className="w-4 h-4 text-orange-600 focus:ring-orange-500 bg-slate-950 border-slate-700"
                              />
                              No
                            </label>
                          </div>
                        )}

                        {q.type === 'select' && (
                          <select
                            required={q.required}
                            value={registrationAnswers[q.id] || ''}
                            className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-100 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                            onChange={e => setRegistrationAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                          >
                            <option value="" disabled>Select an option</option>
                            {q.options?.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Payment Info */}
                {selectedEventForReg.isPaid && (
                  <div className="mb-6 animate-in slide-in-from-top-2">
                    <div className="p-4 bg-slate-950 rounded-xl border border-slate-700/50 mb-4">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-slate-400 text-sm">
                          {selectedEventForReg.pricingType === 'per_person' && teamRegistrationData.mode === 'team'
                            ? 'Price Per Member'
                            : selectedEventForReg.pricingType === 'per_person'
                            ? 'Price Per Person'
                            : 'Event Fee (Fixed)'}
                        </span>
                        <span className="text-white font-medium">₹{selectedEventForReg.price}</span>
                      </div>
                      {teamRegistrationData.mode === 'team' && (
                        <p className="text-[11px] text-orange-400/90 font-medium mt-1">
                          {selectedEventForReg.pricingType === 'per_person'
                            ? `Team fee: ₹${selectedEventForReg.price} × total joined team members. Paid in full by the team leader upon approval.`
                            : `Team fee: Flat ₹${selectedEventForReg.price} for the entire team regardless of member count. Paid by the team leader upon approval.`}
                        </p>
                      )}
                      <div className="mt-2 text-[10px] text-slate-400 text-right opacity-80">
                        Payment will be collected from the team leader after organizer approval
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 mt-8">
                  <button
                    type="button"
                    onClick={() => { setSelectedEventForReg(null); setRegistrationAnswers({}); setAppliedPromoCode(null); }}
                    className="flex-1 bg-slate-800 border border-slate-700 text-slate-300 font-semibold py-3 rounded-xl hover:bg-slate-700 transition-all font-outfit"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRegistering}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 font-outfit shadow-lg shadow-orange-600/20 active:scale-95"
                  >
                    {isRegistering ? <Loader2 className="w-5 h-5 animate-spin" /> :
                      selectedEventForReg.isPaid ?
                        'Submit Registration' : 'Confirm Registration'
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Payment Details Modal would be nice, but we are doing inline */}

      {/* ... continuation of file ... */}

      {/* PAYMENT MODAL WITH PROMO CODE */}
      <AnimatePresence>
        {isPaymentModalOpen && selectedRegForPayment && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 w-full max-w-md rounded-[32px] overflow-hidden border border-white/5 shadow-2xl relative"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-black font-outfit text-white">Confirm Payment</h3>
                  <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-500 hover:text-white"><XCircle className="w-6 h-6" /></button>
                </div>

                <div className="mb-6">
                  {(() => {
                    const isTeamReg = selectedRegForPayment.reg.participationType === 'team';
                    const teamId = selectedRegForPayment.reg.teamId;
                    const teamRegs = teamId ? registrations.filter(r => r.teamId === teamId && r.status !== RegistrationStatus.REJECTED) : [];
                    const teamObj = teamId ? teams.find(t => t.id === teamId) : null;
                    const membersCount = Math.max(teamRegs.length, teamObj?.members?.length || 1);
                    const isPerPerson = selectedRegForPayment.event.pricingType === 'per_person' && isTeamReg;
                    const baseTotal = getEventTotalAmount(selectedRegForPayment.event, selectedRegForPayment.reg.participationType, selectedRegForPayment.reg.teamId);

                    return (
                      <>
                        <div className="flex justify-between text-slate-400 mb-2">
                          <span>
                            {isPerPerson ? `Ticket Price (₹${selectedRegForPayment.event.price} × ${membersCount} members)` : isTeamReg ? 'Team Fixed Fee' : 'Ticket Price'}
                          </span>
                          <span className="text-white font-medium">₹{baseTotal}</span>
                        </div>
                        {isPerPerson && (
                          <div className="text-[11px] text-orange-400/90 mb-2 bg-orange-500/10 px-3 py-1.5 rounded-lg border border-orange-500/20">
                            Per-person rate: ₹{selectedRegForPayment.event.price} each for {membersCount} registered team members.
                          </div>
                        )}
                        {paymentAppliedPromo && (
                          <div className="flex justify-between text-green-400 mb-2">
                            <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> {paymentAppliedPromo.code}</span>
                            <span>-₹{paymentAppliedPromo.type === 'percentage'
                              ? ((baseTotal * paymentAppliedPromo.value) / 100).toFixed(2)
                              : paymentAppliedPromo.value}</span>
                          </div>
                        )}
                        <div className="border-t border-white/10 pt-2 flex justify-between text-xl font-bold text-white">
                          <span>Total Amount</span>
                          <span>₹{(() => {
                            let price = baseTotal;
                            if (paymentAppliedPromo) {
                              if (paymentAppliedPromo.type === 'percentage') {
                                price = price - (price * paymentAppliedPromo.value / 100);
                              } else {
                                price = price - paymentAppliedPromo.value;
                              }
                            }
                            return Math.max(0, price).toFixed(2);
                          })()}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Promo Code Input */}
                <div className="mb-6">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Have a Promo Code?</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={paymentPromoCode}
                      onChange={e => setPaymentPromoCode(e.target.value.toUpperCase())}
                      className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-orange-500 transition-colors uppercase"
                      placeholder="CODE"
                    />
                    <button
                      onClick={async () => {
                        try {
                          setPaymentPromoMessage(null);
                          addToast('Verifying code...', 'info');
                          const baseUrl = API_BASE;
                          const res = await fetch(`${baseUrl}/api/verify-promo`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              eventId: selectedRegForPayment.event.id,
                              code: paymentPromoCode
                            })
                          });
                          const data = await res.json();

                          if (data.success && data.promo) {
                            setPaymentAppliedPromo(data.promo);
                            setPaymentPromoMessage({ type: 'success', text: `Code applied! ${data.promo.type === 'percentage' ? `${data.promo.value}% OFF` : `₹${data.promo.value} OFF`}` });
                            addToast('Code applied!', 'success');
                          } else {
                            addToast(data.message || 'Invalid code', 'error');
                            setPaymentPromoMessage({ type: 'error', text: data.message || 'Invalid promo code' });
                            setPaymentAppliedPromo(null);
                          }
                        } catch (e) {
                          addToast('Failed to verify code', 'error');
                          setPaymentPromoMessage({ type: 'error', text: 'Failed to verify code' });
                          console.error(e);
                        }
                      }}
                      className="bg-slate-800 hover:bg-slate-700 text-white px-4 rounded-xl font-bold text-sm transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                  {paymentPromoMessage && (
                    <p className={`text-[10px] mt-2 font-medium ${paymentPromoMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                      {paymentPromoMessage.text}
                    </p>
                  )}
                </div>

                <button
                  onClick={handleProceedToPayment}
                  disabled={isPaymentProcessing || isPaymentSuccess}
                  className={`w-full font-bold py-4 rounded-2xl text-lg shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 ${
                    isPaymentSuccess
                      ? 'bg-green-600 text-white shadow-green-600/20'
                      : isPaymentProcessing 
                        ? 'bg-slate-700 text-slate-400 cursor-not-allowed shadow-none'
                        : 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-600/20'
                  }`}
                >
                  {isPaymentSuccess ? (
                    <>Success <CheckCircle className="w-5 h-5" /></>
                  ) : isPaymentProcessing ? (
                    <>Processing... <Loader2 className="w-5 h-5 animate-spin" /></>
                  ) : (
                    <>Payload Payment <ChevronRight className="w-5 h-5" /></>
                  )}
                </button>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isAnnouncementModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-slate-900 w-full max-w-lg rounded-[32px] overflow-hidden border border-white/5 shadow-2xl relative"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500"></div>

              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center border border-orange-500/20">
                      <Send className="w-6 h-6 text-orange-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black font-outfit text-white tracking-tight">Broadcast Intel</h3>
                      <p className="text-slate-400 text-sm font-medium">Deploy mission-critical updates instantly.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsAnnouncementModalOpen(false)}
                    className="p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-500 hover:text-white"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Announcement Stream</label>
                    <textarea
                      required
                      className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 text-slate-100 placeholder:text-slate-600 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/30 outline-none h-48 resize-none transition-all font-medium"
                      placeholder="Type your official announcement here..."
                      value={announcementText}
                      onChange={e => setAnnouncementText(e.target.value)}
                    ></textarea>
                    <p className="text-[10px] text-slate-500 mt-3 font-medium flex items-center gap-2">
                      <Info className="w-3 h-3" />
                      Broadcast will reach all approved participants via their in-app Intelligence Feed.
                    </p>
                  </div>

                  <div className="flex gap-4 pt-2">
                    <button
                      onClick={() => setIsAnnouncementModalOpen(false)}
                      className="flex-1 px-8 py-4 rounded-2xl bg-white/5 text-white font-bold hover:bg-white/10 transition-all border border-white/5 font-outfit uppercase tracking-wider text-xs"
                    >
                      Abort
                    </button>
                    <button
                      onClick={handleBroadcastAnnouncement}
                      disabled={isBroadcasting || !announcementText.trim()}
                      className="flex-[2] flex items-center justify-center gap-3 bg-orange-600 text-white px-8 py-4 rounded-2xl hover:bg-orange-700 shadow-xl shadow-orange-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 font-black font-outfit uppercase tracking-wider text-xs"
                    >
                      {isBroadcasting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                      Transmit Message
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* PROFILE EDIT MODAL */}
      {
        isProfileModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#020617]/80 backdrop-blur-xl selection:bg-orange-500/30">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-[#0f172a] w-full max-w-[440px] max-h-[90vh] rounded-[28px] sm:rounded-[32px] shadow-[0_0_60px_-15px_rgba(0,0,0,0.7)] border border-white/10 overflow-hidden flex flex-col relative group/modal my-auto"
            >
              {/* Decorative gradients */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-50 pointer-events-none" />
              <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-orange-500/5 to-transparent pointer-events-none" />

              {/* Pinned Header */}
              <div className="flex justify-between items-center px-6 py-4 relative z-10 shrink-0 border-b border-slate-800/60 bg-[#0f172a]">
                <motion.h3
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-xl font-black text-white font-outfit tracking-tight"
                >
                  Edit Profile
                </motion.h3>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsProfileModalOpen(false)}
                  className="rounded-full p-2 text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <XCircle className="w-6 h-6" />
                </motion.button>
              </div>

              {/* Form with scrollable body and pinned footer */}
              <form onSubmit={handleUpdateProfile} className="flex flex-col flex-1 min-h-0 overflow-hidden relative z-10">
                {/* Scrollable Content */}
                <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4 custom-scrollbar">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex flex-col items-center mb-1"
                  >
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      className="relative group cursor-pointer"
                    >
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-[#0f172a] shadow-xl ring-2 ring-white/10 group-hover:ring-orange-500 transition-all duration-300 flex items-center justify-center bg-slate-800">
                        {profileForm.avatarUrl || currentUser?.avatarUrl ? (
                          <motion.img
                            initial={{ scale: 1.2 }}
                            animate={{ scale: 1 }}
                            src={profileForm.avatarUrl || currentUser?.avatarUrl}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <UserCircle className="w-16 h-16 text-slate-600" />
                        )}
                      </div>
                      <motion.div
                        className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-[2px]"
                        initial={{ opacity: 0 }}
                        whileHover={{ opacity: 1 }}
                      >
                        <motion.div
                          initial={{ scale: 0.5, rotate: -45 }}
                          whileHover={{ scale: 1, rotate: 0 }}
                        >
                          <Camera className="w-8 h-8 text-white drop-shadow-lg" />
                        </motion.div>
                      </motion.div>
                      <input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        onChange={(e) => handleImageUpload(e, 'profile')}
                      />
                    </motion.div>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2.5 group-hover:text-orange-400 max-w-[160px] text-center leading-tight transition-colors"
                    >
                      Tap to change profile picture
                    </motion.p>
                  </motion.div>

                  <div className="space-y-3.5">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                      className="space-y-1.5"
                    >
                      <label className="text-xs font-bold text-slate-400 ml-1">Full Name</label>
                      <div className="relative">
                        <motion.input
                          whileFocus={{ scale: 1.01, backgroundColor: "rgba(30, 41, 59, 1)" }}
                          type="text"
                          required
                          className="w-full pl-4 pr-4 py-3 rounded-2xl bg-[#1e293b] border border-slate-700/50 text-white font-semibold focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all placeholder:text-slate-600"
                          value={profileForm.name}
                          onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                          placeholder="John Doe"
                        />
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 }}
                      className="space-y-1.5"
                    >
                      <label className="text-xs font-bold text-slate-400 ml-1">Email</label>
                      <div className="relative group/email">
                        <input
                          type="email"
                          disabled
                          className="w-full pl-4 pr-4 py-3 rounded-2xl bg-[#1e293b]/50 border border-slate-800 text-slate-500 font-medium cursor-not-allowed outline-none select-none transition-colors"
                          value={profileForm.email}
                        />
                        <div className="absolute inset-0 bg-transparent" title="Email cannot be changed directly" />
                      </div>
                      <p className="text-[10px] text-slate-600 ml-1">Email cannot be changed directly.</p>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 }}
                      className="space-y-1.5"
                    >
                      <div className="flex items-center justify-between ml-1">
                        <label className="text-xs font-bold text-slate-400">Phone Number</label>
                        {profileForm.isPhoneVerified ? (
                          <span className="text-[10px] text-green-400 font-bold flex items-center gap-1 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                            <CheckCircle className="w-3 h-3" /> Verified
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-400 font-medium">Verification required</span>
                        )}
                      </div>

                      <div className="flex gap-2 relative">
                        {/* Country Code Selector */}
                        <div className="relative w-36 shrink-0">
                          <select
                            disabled={isSendingProfilePhoneOtp || isVerifyingProfilePhoneOtp || !!currentUser?.phoneNumber}
                            value={profileDialCode}
                            onChange={e => {
                              setProfileDialCode(e.target.value);
                              const newFull = `${e.target.value}${profileNationalNumber.replace(/[^0-9]/g, '')}`;
                              setProfileForm(prev => ({
                                ...prev,
                                phoneNumber: newFull,
                                isPhoneVerified: newFull === currentUser?.phoneNumber
                              }));
                            }}
                            className="w-full h-full px-3 py-3 rounded-2xl border border-slate-700/60 bg-[#1e293b] text-white font-mono text-xs font-bold outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 appearance-none cursor-pointer pr-7 disabled:opacity-50"
                          >
                            {COUNTRY_CODES.map(c => (
                              <option key={c.code} value={c.dialCode} className="bg-[#0f172a] text-white py-1.5">
                                {c.name} ({c.dialCode})
                              </option>
                            ))}
                          </select>

                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>

                        {/* National Phone Input */}
                        <div className="relative flex-1">
                          <input
                            type="tel"
                            inputMode="numeric"
                            disabled={!!currentUser?.phoneNumber}
                            placeholder="98765 43210"
                            value={profileNationalNumber}
                            onChange={e => {
                              const val = e.target.value.replace(/[^0-9\s-]/g, '');
                              setProfileNationalNumber(val);
                              const newFullPhone = `${profileDialCode}${val.replace(/[^0-9]/g, '')}`;
                              setProfileForm(prev => ({
                                ...prev,
                                phoneNumber: newFullPhone,
                                isPhoneVerified: newFullPhone === currentUser?.phoneNumber
                              }));
                            }}
                            className={`w-full pl-4 pr-4 py-3 rounded-2xl bg-[#1e293b] border text-white font-mono font-medium outline-none transition-all ${profileForm.isPhoneVerified
                              ? 'border-green-500/40 bg-green-950/20 text-green-200'
                              : 'border-slate-700/60 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20'
                              } disabled:opacity-60 disabled:cursor-not-allowed`}
                          />
                        </div>

                        {/* Verify Button (Twilio SMS) */}
                        {!currentUser?.phoneNumber && !profileForm.isPhoneVerified && profileNationalNumber.trim().length >= 5 && (
                          <motion.button
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            type="button"
                            disabled={isSendingProfilePhoneOtp || isVerifyingProfilePhoneOtp}
                            onClick={handleSendProfilePhoneOtp}
                            className="px-3.5 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 text-white font-bold text-xs hover:from-orange-500 hover:to-orange-400 shadow-lg shadow-orange-900/30 whitespace-nowrap cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {isSendingProfilePhoneOtp ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Sending...</span>
                              </>
                            ) : (
                              <span>Verify via SMS</span>
                            )}
                          </motion.button>
                        )}
                      </div>

                      {currentUser?.phoneNumber ? (
                        <p className="text-[10px] text-green-500/70 font-medium ml-1 flex items-center gap-1">
                          <Shield className="w-3 h-3" /> Verified phone number cannot be changed.
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-500 ml-1">Select your country code and enter your mobile number.</p>
                      )}

                      {/* OTP Entry when OTP dispatched */}
                      <AnimatePresence>
                        {showOtpInput && otpPurpose === 'profile' && !profileForm.isPhoneVerified && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="pt-2"
                          >
                            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-orange-500/30 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-orange-400 flex items-center gap-1.5">
                                  <KeyRound className="w-3.5 h-3.5" /> Enter 6-Digit SMS Code
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  Sent to {profileDialCode}{profileNationalNumber.replace(/[^0-9]/g, '')}
                                </span>
                              </div>

                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  maxLength={6}
                                  placeholder="••••••"
                                  value={otp}
                                  onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#020617] border border-orange-500/50 text-white font-mono text-center tracking-[0.5em] font-bold text-lg focus:ring-2 focus:ring-orange-500/30 outline-none"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  disabled={isVerifyingProfilePhoneOtp || otp.length < 4}
                                  onClick={handleVerifyProfilePhoneOtp}
                                  className="px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-green-900/30 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                                >
                                  {isVerifyingProfilePhoneOtp ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span>Verifying...</span>
                                    </>
                                  ) : (
                                    <span>Confirm</span>
                                  )}
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>

                  </div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mt-4 pt-4 border-t border-slate-800/50"
                  >
                    <div className="flex items-center justify-between group/danger">
                      <div>
                        <h4 className="text-xs font-bold text-red-500 uppercase tracking-wider group-hover/danger:text-red-400 transition-colors">Danger Zone</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Permanently delete your account and all data</p>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        type="button"
                        disabled={isSendingDeleteOtp}
                        onClick={() => handleOpenDeleteModal()}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold border transition-all bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 cursor-pointer disabled:opacity-60 flex items-center gap-2"
                      >
                        {isSendingDeleteOtp ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                            <span>Sending OTP...</span>
                          </>
                        ) : (
                          <span>Delete Account</span>
                        )}
                      </motion.button>
                    </div>
                    <div className="mt-2.5 flex items-start gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
                      <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Requires verification via a 6-digit OTP code sent to <span className="text-slate-300 font-mono font-medium">{currentUser?.email}</span>.
                      </p>
                    </div>
                  </motion.div>
                </div>

                {/* Pinned Action Buttons Footer */}
                <div className="p-4 sm:px-6 sm:py-4 border-t border-slate-800/80 bg-[#0f172a] flex gap-3 shrink-0">
                  <motion.button
                    whileHover={{ scale: 1.02, backgroundColor: "rgba(51, 65, 85, 1)" }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => setIsProfileModalOpen(false)}
                    className="flex-1 py-3 rounded-2xl bg-[#1e293b] text-slate-300 font-bold text-sm border border-slate-700/50 transition-colors cursor-pointer"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isSavingProfile}
                    className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-500 text-white font-bold text-sm shadow-xl shadow-orange-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSavingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </div>
        )
      }

      {/* Account Deletion Email Verification Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && currentUser && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-[#020617]/80 backdrop-blur-xl selection:bg-orange-500/30">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-[#0f172a] w-full max-w-[440px] max-h-[90vh] overflow-y-auto custom-scrollbar rounded-[32px] shadow-[0_0_60px_-15px_rgba(0,0,0,0.8)] border border-slate-700/60 flex flex-col relative p-7 md:p-8 text-left group/modal"
            >
              {/* Decorative top accent gradients */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-70" />
              <div className="absolute top-0 inset-x-0 h-36 bg-gradient-to-b from-red-500/10 to-transparent pointer-events-none" />

              {/* Close Button */}
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteEmailOtp('');
                }}
                className="absolute top-6 right-6 text-slate-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors z-20 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </motion.button>

              {/* Header Icon & Title */}
              <div className="text-center mb-6 relative z-10">
                <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-500 shadow-lg shadow-red-950/40">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-2xl font-black text-white font-outfit tracking-tight">Confirm Account Deletion</h3>
                <p className="text-xs text-slate-400 mt-2">
                  Enter the 6-digit verification code sent to:
                </p>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#1e293b] border border-slate-700/70 rounded-full text-xs font-mono text-orange-400 font-semibold mt-2.5 shadow-inner">
                  <Mail className="w-3.5 h-3.5 text-orange-400" />
                  <span>{currentUser.email}</span>
                </div>
              </div>

              {/* OTP Form */}
              <div className="space-y-4 relative z-10">
                <div>
                  <div className="flex justify-between items-center mb-2 px-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Verification Code
                    </label>
                    <span className="text-[10px] text-slate-500 font-mono">6 Digits</span>
                  </div>

                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoFocus
                    placeholder="123456"
                    value={deleteEmailOtp}
                    onChange={(e) => setDeleteEmailOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full px-4 py-3.5 rounded-2xl bg-[#1e293b] border border-slate-700 text-white font-mono text-center tracking-[0.5em] font-bold text-2xl focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none transition-all placeholder:text-slate-600 shadow-inner"
                  />
                </div>

                {/* Warning Alert Box */}
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3.5 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-200/90 leading-relaxed font-medium">
                    <strong className="text-red-300">Permanent Action:</strong> All your tickets, event registrations, hosted events, and account data will be permanently wiped.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02, backgroundColor: "rgba(51, 65, 85, 1)" }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    disabled={isConfirmingDelete || isSendingDeleteOtp}
                    onClick={() => {
                      setIsDeleteModalOpen(false);
                      setDeleteEmailOtp('');
                    }}
                    className="flex-1 py-3.5 rounded-2xl bg-[#1e293b] text-slate-300 font-bold text-xs uppercase tracking-wider border border-slate-700/60 transition-all cursor-pointer"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    disabled={isConfirmingDelete || isSendingDeleteOtp || deleteEmailOtp.length < 6}
                    onClick={handleConfirmEmailDeletion}
                    className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-xl shadow-red-600/25 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isConfirmingDelete ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <span>Verify & Delete</span>
                    )}
                  </motion.button>
                </div>

                {/* Resend Link */}
                <div className="text-center pt-2">
                  <button
                    type="button"
                    disabled={isSendingDeleteOtp || isConfirmingDelete}
                    onClick={handleSendDeleteEmailOtp}
                    className="text-xs text-slate-400 hover:text-orange-400 font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSendingDeleteOtp ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending code...</span>
                      </>
                    ) : (
                      <span>Didn't receive code? <strong className="text-orange-400 hover:underline">Resend Code</strong></span>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>




      {/* REGISTRATION DETAILS MODAL */}
      {
        selectedRegistrationDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-900">
                <div>
                  <h3 className="text-xl font-bold text-white">Registration Details</h3>
                  <p className="text-sm text-slate-400">View your entry information</p>
                </div>
                <button
                  onClick={() => setSelectedRegistrationDetails(null)}
                  className="text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="space-y-6">
                  {(() => {
                    const event = events.find(e => e.id === selectedRegistrationDetails.eventId);
                    if (!event) return null;
                    return (
                      <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                        <h4 className="font-bold text-white mb-2">{event.title}</h4>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Calendar className="w-3.5 h-3.5 text-orange-400" />
                            {format(new Date(event.date), 'MMMM d, yyyy h:mm a')}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <MapPin className="w-3.5 h-3.5 text-orange-400" />
                            {renderLocation(event.location, event.locationType)}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-600/20 flex items-center justify-center text-orange-400">
                        <UserCircle className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white leading-tight">{selectedRegistrationDetails.participantName}</p>
                        <p className="text-xs text-slate-500">{selectedRegistrationDetails.participantEmail}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase">Status</p>
                        <div className="mt-1"><Badge status={selectedRegistrationDetails.status} /></div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase">Attended</p>
                        <p className={`mt-1 font-medium ${selectedRegistrationDetails.attended ? 'text-green-400' : 'text-slate-400'}`}>
                          {selectedRegistrationDetails.attended ? 'Yes' : 'No'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase">ID</p>
                        <p className="mt-1 font-mono text-[10px] text-slate-400">#{selectedRegistrationDetails.id.slice(0, 8)}</p>
                      </div>
                    </div>

                    {selectedRegistrationDetails.participationType === 'team' && (
                      <div className="bg-orange-900/20 border border-orange-500/20 p-4 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">Team</p>
                          <p className="text-slate-200 font-bold text-lg">{selectedRegistrationDetails.teamName}</p>
                          <p className="text-[10px] text-orange-300/70 mt-0.5">{selectedRegistrationDetails.isTeamLeader ? 'Team Leader' : 'Team Member'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">Team Code</p>
                          <div className="flex items-center gap-2">
                            <div className="relative group">
                              <p className="text-slate-100 font-mono font-bold bg-orange-500/20 px-3 py-1.5 rounded-lg border border-orange-500/30 select-all">
                                {teams.find(t => t.id === selectedRegistrationDetails.teamId)?.inviteCode || 'N/A'}
                              </p>
                              {(() => {
                                const code = teams.find(t => t.id === selectedRegistrationDetails.teamId)?.inviteCode;
                                if (code) {
                                  return (
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(code);
                                        addToast('Team code copied!', 'success');
                                      }}
                                      className="absolute -right-2 -top-2 p-1.5 bg-orange-600 text-white rounded-full shadow-lg hover:bg-orange-700 transition-all scale-0 group-hover:scale-100 active:scale-95"
                                      title="Copy Code"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedRegistrationDetails.participationType === 'team' && (
                      <div className="pt-4 border-t border-slate-800">
                        <p className="text-sm font-bold text-white mb-3">Team Members</p>
                        <div className="space-y-2">
                          {(() => {
                            const teamObj = teams.find(t => t.id === selectedRegistrationDetails.teamId);
                            const teamRegs = registrations.filter(r => r.teamId === selectedRegistrationDetails.teamId && r.status !== RegistrationStatus.REJECTED);

                            // Build unified list from registrations and team.members
                            const memberMap = new Map<string, {
                              id: string;
                              name: string;
                              email?: string;
                              isLeader: boolean;
                              status?: RegistrationStatus;
                              isCurrent: boolean;
                            }>();

                            // 1. Add all registrations
                            teamRegs.forEach(r => {
                              const key = (r.participantEmail || r.participantId || '').toLowerCase();
                              memberMap.set(key, {
                                id: r.id,
                                name: r.participantName || 'Team Member',
                                email: r.participantEmail,
                                isLeader: !!r.isTeamLeader || r.participantId === teamObj?.leaderId,
                                status: r.status,
                                isCurrent: r.participantEmail === currentUser?.email || r.participantId === currentUser?.id
                              });
                            });

                            // 2. Supplement from teamObj.members
                            if (teamObj?.members && Array.isArray(teamObj.members)) {
                              teamObj.members.forEach(m => {
                                const key = (m.email || m.userId || '').toLowerCase();
                                if (!memberMap.has(key)) {
                                  memberMap.set(key, {
                                    id: m.userId || m.email,
                                    name: m.userName || m.email?.split('@')[0] || 'Team Member',
                                    email: m.email,
                                    isLeader: m.userId === teamObj.leaderId,
                                    status: selectedRegistrationDetails.status,
                                    isCurrent: m.email === currentUser?.email || m.userId === currentUser?.id
                                  });
                                }
                              });
                            }

                            const allMembers = Array.from(memberMap.values());

                            return allMembers.map(member => (
                              <div key={member.id} className="flex items-center justify-between bg-slate-800/30 p-2.5 rounded-xl border border-white/5">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                                    {(member.name || 'M').charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-sm text-slate-200 font-medium">{member.name}</span>
                                    <div className="flex items-center gap-1.5">
                                      {member.email && <span className="text-[10px] text-slate-400">{member.email}</span>}
                                      {member.isCurrent && <span className="text-[10px] text-orange-400 font-bold">• You</span>}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {member.status && <Badge status={member.status} />}
                                  {member.isLeader && (
                                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-orange-400 bg-orange-400/10 border border-orange-400/20 px-2 py-1 rounded-md">
                                      Leader
                                    </span>
                                  )}
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    )}

                    {selectedRegistrationDetails.answers && Object.keys(selectedRegistrationDetails.answers).length > 0 ? (
                      <div className="pt-4 border-t border-slate-800">
                        <p className="text-sm font-bold text-white mb-3">Custom Responses</p>
                        <div className="space-y-3">
                          {(() => {
                            // Helper to find question text
                            const event = events.find(e => e.id === selectedRegistrationDetails.eventId);
                            if (!event || !event.customQuestions) return <p className="text-slate-400 italic">Questions not found</p>;

                            return event.customQuestions.map(q => {
                              const answer = selectedRegistrationDetails.answers?.[q.id];
                              if (!answer) return null;
                              return (
                                <div key={q.id} className="bg-slate-800 p-3 rounded-lg border border-slate-700">
                                  <p className="text-xs text-slate-400 mb-1">{q.question}</p>
                                  <p className="text-sm font-medium text-slate-200">{answer}</p>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic pt-2">No custom answers provided.</p>
                    )}

                    <div className="pt-6 mt-4 border-t border-slate-800 space-y-3">
                      {selectedRegistrationDetails.participationType === 'team' &&
                        selectedRegistrationDetails.isTeamLeader &&
                        selectedRegistrationDetails.status === RegistrationStatus.TEAM_AWAITING_SUBMISSION && (
                          (() => {
                            const event = events.find(e => e.id === selectedRegistrationDetails.eventId);
                            const teamObj = teams.find(t => t.id === selectedRegistrationDetails.teamId);
                            const teamRegs = registrations.filter(r => r.teamId === selectedRegistrationDetails.teamId && r.status !== RegistrationStatus.REJECTED);
                            const membersCount = Math.max(teamRegs.length, teamObj?.members?.length || 0);
                            const minSize = event?.minTeamSize || 1;
                            const isIncomplete = membersCount < minSize;

                            return (
                              <div className="space-y-2">
                                <button
                                  disabled={isIncomplete}
                                  onClick={() => selectedRegistrationDetails.teamId && handleTeamSubmit(selectedRegistrationDetails.teamId)}
                                  className={`w-full flex items-center justify-center gap-3 font-black font-outfit py-4 rounded-2xl transition-all shadow-lg group/submit ${isIncomplete ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-600/20'}`}
                                >
                                  {isIncomplete ? <AlertCircle className="w-5 h-5 text-amber-500" /> : <CheckCircle className="w-5 h-5 group-hover/submit:scale-110 transition-transform" />}
                                  {isIncomplete ? 'Complete Team to Submit' : 'Submit Team for Approval'}
                                </button>
                                {isIncomplete && (
                                  <p className="text-[10px] text-center text-amber-500 font-bold uppercase tracking-wider animate-pulse">
                                    {minSize - membersCount} more member{minSize - membersCount !== 1 ? 's' : ''} required to finalize (Min: {minSize})
                                  </p>
                                )}
                              </div>
                            );
                          })()
                        )}

                      {selectedRegistrationDetails.status === RegistrationStatus.APPROVED && (
                        <button
                          onClick={() => {
                            setSelectedTicket(selectedRegistrationDetails);
                            setSelectedRegistrationDetails(null);
                          }}
                          className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-black font-outfit py-4 rounded-2xl transition-all group/tkt"
                        >
                          <QrCode className="w-5 h-5 text-orange-400 group-hover/tkt:scale-110 transition-transform" />
                          View Digital Ticket
                        </button>
                      )}

                      <button
                        onClick={() => {
                          const id = selectedRegistrationDetails.id;
                          setSelectedRegistrationDetails(null);
                          handleCancelRegistration(id);
                        }}
                        className="w-full flex items-center justify-center gap-3 bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 text-rose-500 font-bold font-outfit py-3 rounded-2xl transition-all group/cancel"
                      >
                        <LogOut className="w-4 h-4 group-hover/cancel:-translate-x-1 transition-transform" />
                        Cancel Registration
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-900 border-t border-slate-800 rounded-b-2xl">
                <button
                  onClick={() => setSelectedRegistrationDetails(null)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-300 font-semibold py-2 rounded-xl hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* TICKET QR MODAL */}
      <AnimatePresence>
        {selectedTicket && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, rotateX: 10 }}
              animate={{ opacity: 1, scale: 1, rotateX: 0 }}
              exit={{ opacity: 0, scale: 0.9, rotateX: -10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              id="digital-ticket-card"
              className="relative w-full max-w-sm bg-slate-900 rounded-[32px] overflow-hidden border border-white/10 shadow-2xl shadow-orange-500/10"
            >
              {/* Decorative Header Gradient */}
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600" />
              {/* Ambient Glows */}
              <div className="absolute -top-32 -right-32 w-64 h-64 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

              <div className="p-8 pb-0 pt-10 text-center relative z-10">
                {/* Event Info Header */}
                {(() => {
                  const event = events.find(e => e.id === selectedTicket.eventId);
                  return (
                    <div className="mb-8">
                      <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="inline-flex items-center justify-center p-3 bg-white/5 rounded-2xl mb-4 shadow-inner ring-1 ring-white/10"
                      >
                        <Ticket className="w-6 h-6 text-orange-400" />
                      </motion.div>
                      <motion.h3
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-2xl font-black text-white font-outfit leading-tight mb-2"
                      >
                        {event ? event.title : 'Digital Ticket'}
                      </motion.h3>
                      {event && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.3 }}
                          className="text-sm font-medium text-slate-400 flex items-center justify-center gap-2"
                        >
                          {format(new Date(event.date), 'MMM d, yyyy')}
                          <span className="w-1 h-1 bg-slate-600 rounded-full" />
                          {format(new Date(event.date), 'h:mm a')}
                        </motion.p>
                      )}
                    </div>
                  );
                })()}

                {/* QR Section */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="relative mx-auto w-64 h-64 bg-white p-4 rounded-[24px] shadow-2xl ring-8 ring-white/5 flex items-center justify-center group overflow-hidden"
                >
                  <div className="relative z-10">
                    <QRCode
                      id="ticket-qr-code"
                      value={JSON.stringify({ id: selectedTicket.id, eventId: selectedTicket.eventId, ts: selectedTicket.attended ? 'static' : qrTimestamp })}
                      size={220}
                      level="M"
                    />
                  </div>

                  {/* Scanning Animation */}
                  <motion.div
                    initial={{ top: "0%" }}
                    animate={{ top: "120%" }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                    data-html2canvas-ignore="true"
                    className="absolute left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-orange-500 to-transparent shadow-[0_0_25px_rgba(249,115,22,0.8)] z-20 pointer-events-none opacity-80"
                  />

                  {/* Tech/Frame Overlay */}
                  <div className="absolute inset-0 border-[3px] border-slate-900/5 rounded-[24px] pointer-events-none z-10" />

                  <div className="absolute top-4 left-4 w-3 h-3 border-l-2 border-t-2 border-slate-900 z-10" />
                  <div className="absolute top-4 right-4 w-3 h-3 border-r-2 border-t-2 border-slate-900 z-10" />
                  <div className="absolute bottom-4 left-4 w-3 h-3 border-l-2 border-b-2 border-slate-900 z-10" />
                  <div className="absolute bottom-4 right-4 w-3 h-3 border-r-2 border-b-2 border-slate-900 z-10" />
                </motion.div>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="mt-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500"
                >
                  Scan for Entry
                </motion.p>
              </div>

              {/* Ticket Footer / Stub */}
              <div className="mt-8 px-6 pt-6 pb-0 bg-slate-950/80 backdrop-blur-md border-t border-white/5 relative z-10">
                {/* Perforation Effect */}
                <div className="absolute -top-1.5 left-0 w-full flex justify-between gap-2 overflow-hidden px-1">
                  {[...Array(20)].map((_, i) => (
                    <div key={i} className="w-3 h-3 rounded-full bg-black/40 -mt-1.5" />
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="text-left flex-1 min-w-0 pr-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Attendee</p>
                    <p className="text-lg font-bold text-white font-outfit break-words pr-4 ticket-attendee-name leading-tight" style={{ overflow: 'visible' }}>
                      {selectedTicket.participantName}
                    </p>
                    <p className="text-[10px] font-mono text-slate-600 mt-0.5">#{selectedTicket.id.slice(0, 8).toUpperCase()}</p>
                  </div>
                  <div className="text-right flex-shrink-0 pl-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Status</p>
                    {selectedTicket.attended ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-[10px] font-bold text-green-400 uppercase tracking-wide">
                        <Check className="w-3 h-3" /> Used
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-[10px] font-bold text-orange-400 uppercase tracking-wide animate-pulse">
                        <Sparkles className="w-3 h-3" /> Valid
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 mt-6 mb-2" data-html2canvas-ignore="true">
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="flex-1 py-3.5 rounded-xl text-slate-400 font-bold text-sm hover:bg-white/5 hover:text-white transition-all border border-transparent hover:border-white/5 active:scale-95"
                  >
                    Close
                  </button>
                  <button
                    onClick={downloadTicket}
                    className="flex-[2] py-3.5 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 text-white font-bold text-sm shadow-lg shadow-orange-600/20 hover:shadow-orange-600/30 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 group"
                  >
                    <Download className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                    Save Ticket
                  </button>
                </div>

                {/* Bottom Spacer for Visual Balance in Download */}
                <div className="h-4 w-full" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SCANNER MODAL */}
      {
        isScannerOpen && (
          <Suspense fallback={<div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"><Loader2 className="w-10 h-10 text-orange-500 animate-spin" /></div>}>
            <Scanner
              onScan={handleScan}
              onClose={() => setIsScannerOpen(false)}
              scanResult={scanResult}
            />
          </Suspense>
        )
      }

      {/* CROPPER MODAL */}
      {
        isCropperOpen && tempImageSrc && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-slate-900 w-full h-full sm:h-[80vh] sm:max-w-2xl flex flex-col sm:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 z-10 flex-shrink-0">
                <h3 className="text-xl font-bold text-white font-outfit">{cropPurpose === 'profile' ? 'Crop Profile Picture' : 'Crop Event Image'}</h3>
                <button
                  onClick={() => { setIsCropperOpen(false); setTempImageSrc(null); }}
                  className="text-slate-400 hover:text-slate-200 p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="relative flex-1 bg-slate-950 overflow-hidden">
                <Cropper
                  image={tempImageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={cropPurpose === 'profile' ? 1 : 16 / 9}
                  cropShape={cropPurpose === 'profile' ? 'round' : 'rect'}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              </div>

              <div className="p-6 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-6 flex-shrink-0">
                <div className="flex-1 w-full max-w-xs">
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Zoom</label>
                    <span className="text-xs font-bold text-orange-400">{zoom.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    aria-labelledby="Zoom"
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500 transition-all hover:bg-slate-750"
                  />
                </div>
                <div className="flex gap-4 w-full sm:w-auto">
                  <button
                    onClick={() => { setIsCropperOpen(false); setTempImageSrc(null); }}
                    className="flex-1 sm:flex-none px-6 py-3 text-sm font-bold text-slate-400 bg-slate-800 hover:bg-slate-750 rounded-xl transition-all border border-slate-750"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCropConfirm}
                    className="flex-[2] sm:flex-none px-8 py-3 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-lg shadow-orange-600/20 active:scale-95 flex items-center justify-center gap-2 transition-all"
                  >
                    <Check className="w-5 h-5" /> Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* EVENT DETAILS MODAL */}
      {
        selectedEventForDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-slate-900 w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-3xl shadow-2xl border-none sm:border sm:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col relative">
              <div className="relative h-56 sm:h-64 flex-shrink-0">
                <LazyEventImage eventId={selectedEventForDetails.id} initialSrc={selectedEventForDetails.imageUrl} alt={selectedEventForDetails.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-black/20"></div>
                <button
                  onClick={() => setSelectedEventForDetails(null)}
                  className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full text-white transition-all border border-white/20 z-50 shadow-lg group"
                >
                  <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                </button>

                <div className="absolute bottom-4 sm:bottom-6 left-6 sm:left-8 right-6 sm:right-8">
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest w-fit mb-2 sm:mb-3 ${selectedEventForDetails.locationType === 'online' ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-100'}`}>
                    {selectedEventForDetails.locationType} Event
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white font-outfit line-clamp-2">{selectedEventForDetails.title}</h2>
                </div>
              </div>

              {/* Modal Tabs */}
              <div className="flex bg-slate-800/50 p-1 mx-6 sm:mx-8 rounded-xl border border-slate-800/50 mt-4">
                <button
                  onClick={() => setDetailsTab('info')}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${detailsTab === 'info' ? 'bg-slate-700 text-orange-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Information
                </button>
                {(() => {
                  const isOrg = currentUser?.id === selectedEventForDetails.organizerId;
                  const isCollab = selectedEventForDetails.collaboratorEmails?.includes(currentUser?.email || '');
                  const isPart = registrations.some(r => r.eventId === selectedEventForDetails.id && r.participantId === currentUser?.id && r.status === RegistrationStatus.APPROVED);
                  const canView = isOrg || isCollab || isPart;

                  return (
                    <button
                      onClick={() => canView ? setDetailsTab('discussion') : addToast("Only registered participants can access the discussion.", "warning")}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${detailsTab === 'discussion' ? 'bg-slate-700 text-orange-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'} ${!canView ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Discussion {!canView && <Lock className="w-3 h-3 inline mb-0.5 ml-1" />}
                    </button>
                  );
                })()}
                <button
                  onClick={() => setDetailsTab('reviews')}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${detailsTab === 'reviews' ? 'bg-slate-700 text-orange-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Reviews
                </button>
              </div>

              <div ref={scrollContainerRef} className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1">
                {detailsTab === 'info' && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 mb-8">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 text-slate-300">
                          <div className="p-2 bg-orange-500/10 rounded-lg">
                            <Calendar className="w-5 h-5 text-orange-400" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Date & Time</p>
                            {selectedEventForDetails.endDate && new Date(selectedEventForDetails.date).toDateString() !== new Date(selectedEventForDetails.endDate).toDateString() ? (
                              <div className="flex flex-col gap-0.5 mt-0.5">
                                <p className="text-sm font-medium">
                                  <span className="text-slate-400 text-[10px] uppercase tracking-wider mr-1.5 font-bold">Start:</span>
                                  {format(new Date(selectedEventForDetails.date), 'MMM d, yyyy')} at {format(new Date(selectedEventForDetails.date), 'p')}
                                </p>
                                <p className="text-sm font-medium">
                                  <span className="text-slate-400 text-[10px] uppercase tracking-wider mr-1.5 font-bold">End:</span>
                                  {format(new Date(selectedEventForDetails.endDate), 'MMM d, yyyy')} at {format(new Date(selectedEventForDetails.endDate), 'p')}
                                </p>
                              </div>
                            ) : (
                              <>
                                <p className="text-sm sm:text-base font-medium">
                                  {format(new Date(selectedEventForDetails.date), 'EEEE, MMMM d, yyyy')}
                                </p>
                                <p className="text-xs sm:text-sm text-slate-400">
                                  {format(new Date(selectedEventForDetails.date), 'p')}
                                  {selectedEventForDetails.endDate && ` - ${format(new Date(selectedEventForDetails.endDate), 'p')}`}
                                </p>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-slate-300">
                          <div className="p-2 bg-orange-500/10 rounded-lg">
                            <MapPin className="w-5 h-5 text-orange-400" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Location</p>
                            <div className="text-sm sm:text-base font-medium italic">
                              {renderLocation(selectedEventForDetails.location, selectedEventForDetails.locationType)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-3 text-slate-300">
                          <div className="p-2 bg-orange-500/10 rounded-lg">
                            <Users className="w-5 h-5 text-orange-400" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Availability</p>
                            <p className="text-sm sm:text-base font-medium">
                              {(() => {
                                const currentRegs = registrations.filter(r => r.eventId === selectedEventForDetails.id && r.status !== RegistrationStatus.REJECTED).length;
                                const remaining = Math.max(0, Number(selectedEventForDetails.capacity) - currentRegs);
                                const isDetailsClosed = selectedEventForDetails.isRegistrationOpen === false || new Date() >= new Date(selectedEventForDetails.date);
                                if (isDetailsClosed) return 'Registration Closed';
                                return remaining === 0 ? 'Sold Out' : `${remaining} Available Spots`;
                              })()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-slate-300">
                          <div className="p-2 bg-orange-500/10 rounded-lg">
                            <CheckCircle className="w-5 h-5 text-orange-400" />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Registration</p>
                            <p className="text-sm sm:text-base font-medium">
                              {(() => {
                                const isOpen = selectedEventForDetails.isRegistrationOpen !== false && new Date(selectedEventForDetails.date) > new Date();
                                return <span className={isOpen ? "text-emerald-400" : "text-rose-400"}>{isOpen ? "Open" : "Closed"}</span>;
                              })()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-800 pt-6">
                      <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">About this experience</p>
                      <div className="bg-slate-800/30 rounded-2xl p-4 sm:p-6 border border-slate-800">
                        <p className="text-sm sm:text-base text-slate-300 leading-relaxed whitespace-pre-line italic border-l-4 border-orange-500/30 pl-4">
                          {selectedEventForDetails.description}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-slate-800 pt-6 mt-6">
                      <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">Share Event</p>
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/?event=${selectedEventForDetails.id}`;
                            navigator.clipboard.writeText(url);
                            addToast('Link copied to clipboard!', 'success');
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors border border-slate-700"
                        >
                          <Copy className="w-4 h-4" /> Copy Link
                        </button>
                        <a
                          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out ${selectedEventForDetails.title} on Eventron!`)}&url=${encodeURIComponent(`${window.location.origin}/?event=${selectedEventForDetails.id}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-[#1DA1F2]/10 hover:bg-[#1DA1F2]/20 text-[#1DA1F2] rounded-lg text-sm font-medium transition-colors border border-[#1DA1F2]/20"
                        >
                          <Twitter className="w-4 h-4" /> Twitter
                        </a>
                        <a
                          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/?event=${selectedEventForDetails.id}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-[#1877F2]/10 hover:bg-[#1877F2]/20 text-[#1877F2] rounded-lg text-sm font-medium transition-colors border border-[#1877F2]/20"
                        >
                          <Facebook className="w-4 h-4" /> Facebook
                        </a>
                        <a
                          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${window.location.origin}/?event=${selectedEventForDetails.id}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-[#0A66C2]/10 hover:bg-[#0A66C2]/20 text-[#0A66C2] rounded-lg text-sm font-medium transition-colors border border-[#0A66C2]/20"
                        >
                          <Linkedin className="w-4 h-4" /> LinkedIn
                        </a>
                      </div>
                    </div>

                    <div className="border-t border-slate-800 pt-6 mt-6">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Who's Going</p>
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">Approved</span>
                      </div>
                      {(() => {
                        const approvedAttendees = registrations.filter(r => r.eventId === selectedEventForDetails.id && r.status === RegistrationStatus.APPROVED);

                        if (approvedAttendees.length === 0) {
                          return (
                            <div className="bg-slate-800/30 rounded-2xl p-4 border border-slate-800 flex items-center gap-3">
                              <div className="p-2 bg-slate-800 rounded-full text-slate-500">
                                <Users className="w-4 h-4" />
                              </div>
                              <p className="text-sm text-slate-400 italic">No approved participants yet. Be the first!</p>
                            </div>
                          );
                        }

                        const visibleAttendees = showAllAttendees ? approvedAttendees : approvedAttendees.slice(0, 5);

                        return (
                          <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                              {visibleAttendees.map((attendee) => (
                                <ParticipantAvatar
                                  key={attendee.id}
                                  name={attendee.participantName}
                                  avatarUrl={attendee.participantAvatarUrl}
                                  userId={attendee.participantId}
                                />
                              ))}
                            </div>
                            {approvedAttendees.length > 5 && (
                              <div className="text-center">
                                <button
                                  onClick={() => setShowAllAttendees(!showAllAttendees)}
                                  className="text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors bg-slate-800/50 hover:bg-slate-800 px-4 py-2 rounded-lg border border-slate-800 hover:border-slate-700 w-full active:scale-95"
                                >
                                  {showAllAttendees ? 'Show Less' : `+ ${approvedAttendees.length - 5} more attendees`}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="border-t border-slate-800 pt-6 mt-6">
                      <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">Add to Calendar</p>
                      <div className="flex flex-wrap gap-3">
                        <a
                          href={`https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(selectedEventForDetails.title)}&dates=${format(new Date(selectedEventForDetails.date), "yyyyMMdd'T'HHmmss").replace(/-|:/g, '')}/${format(new Date(selectedEventForDetails.endDate), "yyyyMMdd'T'HHmmss").replace(/-|:/g, '')}&details=${encodeURIComponent(selectedEventForDetails.description)}&location=${encodeURIComponent(selectedEventForDetails.location)}&sf=true&output=xml`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-orange-600/10 hover:bg-orange-600/20 text-orange-400 rounded-lg text-sm font-medium transition-colors border border-orange-600/20"
                        >
                          <CalendarPlus className="w-4 h-4" /> Google Calendar
                        </a>
                        <button
                          onClick={() => {
                            const event = selectedEventForDetails;
                            const icsContent = [
                              'BEGIN:VCALENDAR',
                              'VERSION:2.0',
                              'BEGIN:VEVENT',
                              `SUMMARY:${event.title}`,
                              `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
                              `DTSTART:${format(new Date(event.date), "yyyyMMdd'T'HHmmss").replace(/-|:/g, '')}`,
                              `DTEND:${format(new Date(event.endDate), "yyyyMMdd'T'HHmmss").replace(/-|:/g, '')}`,
                              `LOCATION:${event.location}`,
                              'END:VEVENT',
                              'END:VCALENDAR'
                            ].join('\n');

                            const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
                            const link = document.createElement('a');
                            link.href = window.URL.createObjectURL(blob);
                            link.setAttribute('download', `${event.title.replace(/\s+/g, '_')}.ics`);
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors border border-slate-700"
                        >
                          <Download className="w-4 h-4" /> Download .ICS
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {detailsTab === 'discussion' && (
                  (() => {
                    const isOrg = currentUser?.id === selectedEventForDetails.organizerId;
                    const isCollab = selectedEventForDetails.collaboratorEmails?.includes(currentUser?.email || '');
                    const isPart = registrations.some(r => r.eventId === selectedEventForDetails.id && r.participantId === currentUser?.id && r.status === RegistrationStatus.APPROVED);
                    const canView = isOrg || isCollab || isPart;

                    if (!canView) {
                      return (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 min-h-[400px]">
                          <div className="p-4 bg-slate-800 rounded-full mb-4">
                            <Lock className="w-8 h-8 text-slate-500" />
                          </div>
                          <h3 className="text-xl font-bold text-white mb-2">Participants Only</h3>
                          <p className="text-slate-400 max-w-xs text-sm">
                            Join this event and get approved to access the discussion board and chat with other attendees.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="h-full flex flex-col min-h-[400px]">
                        <div className="flex-1 space-y-4 mb-4 overflow-y-auto pr-2 custom-scrollbar">
                          {isMessagesLoading ? (
                            <div className="py-20 text-center">
                              <Loader2 className="w-8 h-8 animate-spin text-slate-700 mx-auto" />
                              <p className="text-slate-500 text-sm mt-3 font-medium">Loading conversations...</p>
                            </div>
                          ) : messages.length > 0 ? (
                            messages.map(msg => (
                              <div key={msg.id} className={`flex flex-col ${msg.userId === currentUser.id ? 'items-end' : 'items-start'}`}>
                                <div className="flex items-baseline gap-2 mb-1 px-1">
                                  <span className="text-xs font-bold text-slate-300">{msg.userName}</span>
                                  <span className="text-[10px] text-slate-500">{format(new Date(msg.createdAt), 'h:mm a')}</span>
                                </div>
                                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm shadow-sm ${msg.userId === currentUser.id
                                  ? 'bg-orange-600 text-white rounded-tr-none'
                                  : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                                  }`}>
                                  {msg.content}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="py-20 text-center">
                              <MessageSquare className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                              <p className="text-slate-400 text-sm font-medium">No messages yet.</p>
                              <p className="text-slate-500 text-xs mt-1">Be the first to start the discussion!</p>
                            </div>
                          )}
                          <div ref={messagesEndRef} />
                        </div>

                        <form onSubmit={handleSendMessage} className="mt-auto pt-4 border-t border-slate-800 flex gap-2">
                          <input
                            type="text"
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:ring-2 focus:ring-orange-600 focus:border-transparent outline-none transition-all shadow-inner"
                            placeholder="Ask a question or say hi..."
                            value={newMessageText}
                            onChange={e => setNewMessageText(e.target.value)}
                          />
                          <button
                            type="submit"
                            disabled={!newMessageText.trim()}
                            className="bg-orange-600 text-white p-3 rounded-xl hover:bg-orange-700 disabled:opacity-50 disabled:grayscale transition-all shadow-lg shadow-orange-600/20 active:scale-95 flex items-center justify-center group"
                          >
                            <Send className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                          </button>
                        </form>
                      </div>
                    );
                  })()
                )}

                {detailsTab === 'reviews' && (
                  <div className="h-full flex flex-col min-h-[400px]">
                    {isReviewsLoading ? (
                      <div className="py-20 text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-slate-700 mx-auto" />
                        <p className="text-slate-500 text-sm mt-3 font-medium">Loading reviews...</p>
                      </div>
                    ) : (
                      <>
                        {/* Average Rating Section */}
                        {reviews.length > 0 && (
                          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 mb-6 flex items-center justify-between">
                            <div>
                              <div className="text-3xl font-bold text-white flex items-center gap-2">
                                {(reviews.reduce((acc, curr) => acc + curr.rating, 0) / reviews.length).toFixed(1)}
                                <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
                              </div>
                              <p className="text-sm text-slate-400 mt-1">
                                Average Rating based on {reviews.length} review{reviews.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <div className="flex flex-col gap-1 text-xs text-slate-500">
                              {[5, 4, 3, 2, 1].map(r => {
                                const count = reviews.filter(rev => rev.rating === r).length;
                                const percentage = (count / reviews.length) * 100;
                                return (
                                  <div key={r} className="flex items-center gap-2">
                                    <span className="w-3">{r}</span>
                                    <Star className="w-3 h-3 text-slate-600" />
                                    <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                      <div className="h-full bg-amber-500" style={{ width: `${percentage}%` }} />
                                    </div>
                                    <span className="w-6 text-right">{count}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="flex-1 space-y-6 mb-6 overflow-y-auto pr-2 custom-scrollbar">
                          {reviews.length > 0 ? (
                            reviews.map(review => (
                              <div key={review.id} className="bg-slate-800/50 p-4 rounded-xl border border-slate-800">
                                <div className="flex justify-between items-start mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
                                      {review.userName.charAt(0)}
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold text-slate-200">{review.userName}</p>
                                      <p className="text-[10px] text-slate-500">{format(new Date(review.createdAt), 'MMM d, yyyy')}</p>
                                    </div>
                                  </div>
                                  <div className="flex text-amber-400">
                                    {[1, 2, 3, 4, 5].map(star => (
                                      <Star key={star} className={`w-3 h-3 ${star <= review.rating ? 'fill-current' : 'text-slate-700'}`} />
                                    ))}
                                  </div>
                                </div>
                                <p className="text-sm text-slate-300 italic">"{review.comment}"</p>
                              </div>
                            ))
                          ) : (
                            <div className="py-16 text-center">
                              <Star className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                              <p className="text-slate-400 text-sm font-medium">No reviews yet.</p>
                              <p className="text-slate-500 text-xs mt-1">Attendees can leave reviews after the event.</p>
                            </div>
                          )}
                        </div>

                        {/* Review Form - Only for Attendees who have attended */}
                        {currentUser.role === 'attendee' &&
                          registrations.some(r =>
                            r.eventId === selectedEventForDetails.id &&
                            r.participantEmail === currentUser.email &&
                            r.status === RegistrationStatus.APPROVED &&
                            (r.attended || new Date(selectedEventForDetails.date) < new Date())
                          ) &&
                          !reviews.some(r => r.userId === currentUser.id) && (
                            <form onSubmit={handleSubmitReview} className="mt-auto pt-6 border-t border-slate-800">
                              <h4 className="text-sm font-bold text-white mb-3">Leave a Review</h4>
                              <div className="flex gap-2 mb-3">
                                {[1, 2, 3, 4, 5].map(s => (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => setRating(s)}
                                    className="focus:outline-none transition-transform hover:scale-110"
                                  >
                                    <Star className={`w-6 h-6 ${s <= rating ? 'text-amber-400 fill-current' : 'text-slate-700'}`} />
                                  </button>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  required
                                  minLength={5}
                                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:ring-2 focus:ring-orange-600 focus:border-transparent outline-none transition-all"
                                  placeholder="Share your experience..."
                                  value={reviewComment}
                                  onChange={e => setReviewComment(e.target.value)}
                                />
                                <button
                                  type="submit"
                                  className="bg-orange-600 text-white px-4 py-2 rounded-xl hover:bg-orange-700 transition-all font-medium text-sm shadow-lg shadow-orange-600/20 active:scale-95"
                                >
                                  Post
                                </button>
                              </div>
                            </form>
                          )}
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="p-6 sm:p-8 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row gap-4 flex-shrink-0">
                <button
                  onClick={() => setSelectedEventForDetails(null)}
                  className="order-2 sm:order-1 flex-1 px-6 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-all border border-slate-700 font-outfit"
                >
                  Close
                </button>
                {(!currentUser || currentUser.role === 'attendee') && (
                  (() => {
                    if (!currentUser) {
                      return (
                        <button
                          onClick={() => {
                            setSelectedEventForDetails(null);
                            setIsAuthModalOpen(true);
                          }}
                          className="order-1 sm:order-2 flex-[2] px-6 py-3 rounded-xl font-bold bg-orange-600 text-white hover:bg-orange-700 shadow-orange-500/20 active:scale-95 font-outfit"
                        >
                          Sign In to Register
                        </button>
                      );
                    }
                    const isRegistered = registrations.some(r => r.eventId === selectedEventForDetails.id && r.participantEmail === currentUser.email);
                    const currentRegsCount = registrations.filter(r => r.eventId === selectedEventForDetails.id && r.status !== RegistrationStatus.REJECTED).length;
                    const isFull = currentRegsCount >= Number(selectedEventForDetails.capacity || 0);
                    const now = new Date();
                    const startDate = new Date(selectedEventForDetails.date);
                    const endDate = selectedEventForDetails.endDate ? new Date(selectedEventForDetails.endDate) : new Date(startDate.getTime() + 3600000);

                    const isLive = now >= startDate && now <= endDate;
                    const isPast = now > endDate;
                    const isClosed = selectedEventForDetails.isRegistrationOpen === false || now >= startDate;

                    return (
                      <button
                        onClick={() => {
                          if (isRegistered) {
                            const myReg = registrations.find(r => r.eventId === selectedEventForDetails.id && r.participantEmail === currentUser.email);
                            if (myReg) setSelectedRegistrationDetails(myReg);
                          } else if (!isClosed) {
                            setSelectedEventForReg(selectedEventForDetails);
                            setSelectedEventForDetails(null);
                          }
                        }}
                        disabled={!isRegistered && isClosed}
                        className={`order-1 sm:order-2 flex-[2] px-6 py-3 rounded-xl font-bold transition-all shadow-lg font-outfit ${isRegistered
                          ? 'bg-orange-900/40 text-orange-400 border border-orange-500 hover:bg-orange-900/60 active:scale-95'
                          : isClosed
                            ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                            : isFull
                              ? 'bg-amber-600/20 text-amber-500 border border-amber-600/40 hover:bg-amber-600/30 active:scale-95'
                              : 'bg-orange-600 text-white hover:bg-orange-700 shadow-orange-500/20 active:scale-95'
                          }`}
                      >
                        {isRegistered ? (
                          <>
                            <CheckCircle className="w-4 h-4 inline mr-2" /> View Registration
                          </>
                        ) : isClosed ? (
                          <>
                            <XCircle className="w-4 h-4 inline mr-2" /> {isPast ? 'Event Ended' : 'Registration Closed'}
                          </>
                        ) : isFull ? (
                          <>
                            <Clock className="w-4 h-4 inline mr-2" /> Join Waitlist
                          </>
                        ) : (
                          <>
                            <CalendarPlus className="w-4 h-4 inline mr-2" /> Register Now
                          </>
                        )}
                      </button>
                    );
                  })()
                )}
              </div>
            </div>
          </div>
        )
      }


      <Suspense fallback={null}>
        <EventChatBot events={events} currentUserId={currentUser?.id} />
      </Suspense>
    </div >
  );
}
