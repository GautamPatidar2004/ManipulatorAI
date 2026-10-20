import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Layout/Sidebar';
import { Header } from './components/Layout/Header';
import { ChatContainer } from './components/Chat/ChatContainer';
import { MemoryModal } from './components/Memory/MemoryModal';
import { AdminPage } from './components/Admin/AdminPage';
import { AuthScreen } from './components/Auth/AuthScreen';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useChat } from './hooks/useChat';
import { Compass } from 'lucide-react';

const ConsultationWorkspace: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname || '/';
    }
    return '/';
  });

  const { user, isAuthenticated, isAdmin, isLoading: isAuthLoading } = useAuth();

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
  };

  const {
    messages,
    sessions,
    activeSessionId,
    currentTitle,
    isLoading,
    error,
    isBackendHealthy,
    aiAvailable,
    checkingHealth,
    sendMessage,
    startNewChat,
    selectSession,
    deleteSession,
    retryLastMessage,
    dismissError,
  } = useChat();

  // 1. Initial Session Verification State
  if (isAuthLoading) {
    return (
      <div className="flex flex-col items-center justify-center w-screen h-screen bg-slate-50 text-slate-500">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 animate-pulse">
          <Compass size={28} />
        </div>
        <p className="text-xs font-semibold tracking-wide">Initializing Consultation Session...</p>
      </div>
    );
  }

  // 2. Unauthenticated Gate: Direct to Single Authentication Screen
  if (!isAuthenticated || !user) {
    return <AuthScreen />;
  }

  // 3. Admin Full-Page Route & Authorization Guard
  const isAdminRoute =
    currentPath === '/admin' ||
    currentPath.startsWith('/admin') ||
    (typeof window !== 'undefined' && window.location.hash === '#admin');

  if (isAdminRoute) {
    // Non-admin trying to access /admin: block access and redirect back to chat
    if (!isAdmin || user.role !== 'admin') {
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/');
      }
    } else {
      return (
        <AdminPage onBackToChat={() => navigate('/')} />
      );
    }
  }

  // 4. Authenticated Consultation Workspace (Chat Interface)
  return (
    <div className="flex w-screen h-screen overflow-hidden bg-slate-50">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={selectSession}
        onDeleteSession={deleteSession}
        onNewChat={startNewChat}
        isBackendHealthy={isBackendHealthy}
      />

      <div className="flex-1 flex flex-col h-full min-w-0 relative bg-slate-50">
        <Header
          currentTitle={currentTitle}
          isHealthy={isBackendHealthy}
          aiAvailable={aiAvailable}
          checkingHealth={checkingHealth}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          onOpenMemory={() => setIsMemoryModalOpen(true)}
          onOpenAdmin={() => navigate('/admin')}
        />

        <ChatContainer
          messages={messages}
          isLoading={isLoading}
          error={error}
          onSendMessage={sendMessage}
          onRetry={retryLastMessage}
          onDismissError={dismissError}
        />
      </div>

      <MemoryModal
        isOpen={isMemoryModalOpen}
        onClose={() => setIsMemoryModalOpen(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <ConsultationWorkspace />
    </AuthProvider>
  );
};

export default App;
