import React, { useState } from 'react';
import axios from 'axios';
import { LogIn, UserPlus } from 'lucide-react';

function Auth({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const res = await axios.post(endpoint, { email, password });

      if (res.data.success) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        onAuthSuccess(res.data.token, res.data.user);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '400px',
        padding: '2rem',
        margin: '1rem'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '1.5rem',
            fontWeight: 'bold',
            color: '#f8fafc',
            marginBottom: '0.5rem'
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              background: '#10b981',
              borderRadius: '50%',
              boxShadow: '0 0 10px #10b981'
            }}></div>
            Observer
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            PostgreSQL Performance Laboratory
          </p>
        </div>

        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1.5rem',
          borderBottom: '1px solid #334155',
          paddingBottom: '0.5rem'
        }}>
          <button
            onClick={() => setIsLogin(true)}
            style={{
              flex: 1,
              padding: '0.5rem',
              background: 'none',
              border: 'none',
              color: isLogin ? '#38bdf8' : '#94a3b8',
              fontWeight: isLogin ? 'bold' : 'normal',
              cursor: 'pointer',
              borderBottom: isLogin ? '2px solid #38bdf8' : 'none'
            }}
          >
            <LogIn size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
            Login
          </button>
          <button
            onClick={() => setIsLogin(false)}
            style={{
              flex: 1,
              padding: '0.5rem',
              background: 'none',
              border: 'none',
              color: !isLogin ? '#38bdf8' : '#94a3b8',
              fontWeight: !isLogin ? 'bold' : 'normal',
              cursor: 'pointer',
              borderBottom: !isLogin ? '2px solid #38bdf8' : 'none'
            }}
          >
            <UserPlus size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.9rem' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '1rem'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.9rem' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '1rem'
              }}
            />
            {!isLogin && (
              <small style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                Minimum 6 characters
              </small>
            )}
          </div>

          {error && (
            <div style={{
              padding: '0.75rem',
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid #f43f5e',
              borderRadius: '8px',
              color: '#fca5a5',
              marginBottom: '1rem',
              fontSize: '0.9rem'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn"
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '1rem',
              justifyContent: 'center'
            }}
          >
            {loading ? 'Please wait...' : (isLogin ? 'Login' : 'Create Account')}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Auth;
