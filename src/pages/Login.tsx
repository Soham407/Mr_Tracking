
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthForm } from "@/components/auth/AuthForm";
import { useAuth } from '@/hooks/useAuth';

const Login = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      // User is logged in, redirect to dashboard
      navigate('/admin/Dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  // Optionally, you can render a loading spinner or null while checking auth status
  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-cyan-50 dark:from-gray-900 dark:to-gray-800 p-4">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-cyan-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 border border-gray-200 dark:border-gray-700">
          <AuthForm />
        </div>
      </div>
    </div>
  );
};

export default Login;
