import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ChatbotProvider } from './contexts/ChatbotContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Landing Page
import LandingPage from './pages/LandingPage';

// Auth Components
import SignUpForm from './components/auth/SignUpForm';
import SignInForm from './components/auth/SignInForm';
import ForgotPasswordForm from './components/auth/ForgotPasswordForm';

// Dashboard Pages
import Dashboard from './pages/Dashboard';
import Chatbots from './pages/Chatbots';
import Documents from './pages/Documents';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Billing from './pages/Billing';
import ChatbotEmbed from './pages/ChatbotEmbed';
import AdminDashboard from './pages/AdminDashboard';

const AppRoutes: React.FC = () => {
  const { user, loading } = useAuth();

  // Don't show loading spinner at app start
  if (loading && user === undefined) {
    return null;
  }

  // Check if user is admin
  const isAdmin = user?.email === 'admin@chatizia.com' || user?.subscription_status === 'admin';
  console.log(user?.email)
  return (
    <Routes>
      {/* Landing Page */}
      <Route path="/" element={<LandingPage />} />

      {/* Public Routes */}
      <Route 
        path="/signup" 
        element={user ? <Navigate to="/dashboard" replace /> : <SignUpForm />} 
      />
      <Route 
        path="/signin" 
        element={user ? <Navigate to="/dashboard" replace /> : <SignInForm />} 
      />
      <Route 
        path="/forgot-password" 
        element={user ? <Navigate to="/dashboard" replace /> : <ForgotPasswordForm />} 
      />

      {/* Public Chatbot Embed Route - Wrapped in ChatbotProvider */}
      <Route 
        path="/chatbot/:chatbotId" 
        element={
          <ChatbotProvider>
            <ChatbotEmbed />
          </ChatbotProvider>
        } 
      />

      {/* Admin Route */}
      <Route path="/admin" element={
        <ProtectedRoute>
          {isAdmin ? (
            <AdminDashboard />
          ) : (
            <Navigate to="/dashboard" replace />
          )}
        </ProtectedRoute>
      } />

      {/* Protected Routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <ChatbotProvider>
            <Layout>
              <Dashboard />
            </Layout>
          </ChatbotProvider>
        </ProtectedRoute>
      } />
      
      <Route path="/chatbots" element={
        <ProtectedRoute>
          <ChatbotProvider>
            <Layout>
              <Chatbots />
            </Layout>
          </ChatbotProvider>
        </ProtectedRoute>
      } />
      
      <Route path="/documents" element={
        <ProtectedRoute>
          <ChatbotProvider>
            <Layout>
              <Documents />
            </Layout>
          </ChatbotProvider>
        </ProtectedRoute>
      } />
      
      <Route path="/analytics" element={
        <ProtectedRoute>
          <ChatbotProvider>
            <Layout>
              <Analytics />
            </Layout>
          </ChatbotProvider>
        </ProtectedRoute>
      } />
      
      <Route path="/settings" element={
        <ProtectedRoute>
          <ChatbotProvider>
            <Layout>
              <Settings />
            </Layout>
          </ChatbotProvider>
        </ProtectedRoute>
      } />
      
      <Route path="/billing" element={
        <ProtectedRoute>
          <ChatbotProvider>
            <Layout>
              <Billing />
            </Layout>
          </ChatbotProvider>
        </ProtectedRoute>
      } />

      {/* Catch all route - redirect to landing page */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;