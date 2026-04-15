import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import LandingPage from "./pages/LandingPage";
import HomePage from "./pages/HomePage";
import SearchResultsPage from "./pages/SearchResultsPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProfilePage from "./pages/ProfilePage";
import FavoritesPage from "./pages/FavoritesPage";
import SearchHistoryPage from "./pages/SearchHistoryPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import InspirationGlobePage from "./pages/InspirationGlobePage";

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <ThemeProvider>
          <AuthProvider>
            <Routes>
              {/* Landing Page sans Layout */}
              <Route path="/" element={<LandingPage />} />
              {/* Mode Inspiration - plein écran sans Layout */}
              <Route path="/inspiration" element={<InspirationGlobePage />} />
              
              {/* Pages avec Layout */}
              <Route path="/home" element={<Layout><HomePage /></Layout>} />
              <Route path="/search" element={<Layout><SearchResultsPage /></Layout>} />
              <Route path="/login" element={<Layout><LoginPage /></Layout>} />
              <Route path="/register" element={<Layout><RegisterPage /></Layout>} />
              <Route
                path="/profile"
                element={
                  <Layout>
                    <ProtectedRoute>
                      <ProfilePage />
                    </ProtectedRoute>
                  </Layout>
                }
              />
              <Route
                path="/favorites"
                element={
                  <Layout>
                    <ProtectedRoute>
                      <FavoritesPage />
                    </ProtectedRoute>
                  </Layout>
                }
              />
              <Route
                path="/history"
                element={
                  <Layout>
                    <ProtectedRoute>
                      <SearchHistoryPage />
                    </ProtectedRoute>
                  </Layout>
                }
              />
              <Route path="/verify-email" element={<Layout><VerifyEmailPage /></Layout>} />
              <Route path="/forgot-password" element={<Layout><ForgotPasswordPage /></Layout>} />
              <Route path="/reset-password" element={<Layout><ResetPasswordPage /></Layout>} />
            </Routes>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  </ErrorBoundary>
);
}

export default App;
