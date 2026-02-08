import React, { useState, useEffect } from 'react';
import { LayoutDashboard, TrendingUp, Layers, Filter, LogOut } from 'lucide-react';
import axios from 'axios';
import Dashboard from './components/Dashboard';
import WriteCostExperiment from './components/WriteCostExperiment';
import CompositeExperiment from './components/CompositeExperiment';
import SelectivityExperiment from './components/SelectivityExperiment';
import Auth from './components/Auth';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (savedToken && savedUser) {
      // Verify token is still valid
      axios.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${savedToken}` }
      })
      .then(res => {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      })
      .catch(() => {
        // Token expired or invalid
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      })
      .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Set up axios interceptor to include token in all requests
  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        const currentToken = localStorage.getItem('token');
        if (currentToken) {
          config.headers.Authorization = `Bearer ${currentToken}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Cleanup interceptor on unmount
    return () => {
      axios.interceptors.request.eject(requestInterceptor);
    };
  }, [token]);

  const handleAuthSuccess = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
        <div style={{ color: '#94a3b8' }}>Loading...</div>
      </div>
    );
  }

  if (!token) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Navigation Bar */}
      <nav style={{
        display: 'flex', 
        alignItems: 'center', 
        gap: '2rem', 
        padding: '1rem 2rem', 
        background: 'rgba(15, 23, 42, 0.8)', 
        backdropFilter: 'blur(10px)', 
        borderBottom: '1px solid #334155',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', fontSize: '1.2rem', color: '#f8fafc', marginRight: '2rem' }}>
          <div style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '50%', boxShadow: '0 0 10px #10b981' }}></div>
          QueryLab
        </div>

        <button 
          className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
          style={{ background: 'none', border: 'none', color: activeTab === 'dashboard' ? '#38bdf8' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: activeTab === 'dashboard' ? 'bold' : 'normal' }}
        >
          <LayoutDashboard size={18} /> Dashboard
        </button>

        <button 
          className={`nav-btn ${activeTab === 'write-penalty' ? 'active' : ''}`}
          onClick={() => setActiveTab('write-penalty')}
          style={{ background: 'none', border: 'none', color: activeTab === 'write-penalty' ? '#f43f5e' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: activeTab === 'write-penalty' ? 'bold' : 'normal' }}
        >
          <TrendingUp size={18} /> Write Penalty
        </button>

        <button 
          className={`nav-btn ${activeTab === 'selectivity' ? 'active' : ''}`}
          onClick={() => setActiveTab('selectivity')}
          style={{ background: 'none', border: 'none', color: activeTab === 'selectivity' ? '#f43f5e' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: activeTab === 'selectivity' ? 'bold' : 'normal' }}
        >
          <Filter size={18} /> Selectivity
        </button>
        <button 
          className={`nav-btn ${activeTab === 'composite' ? 'active' : ''}`}
          onClick={() => setActiveTab('composite')}
          style={{ background: 'none', border: 'none', color: activeTab === 'composite' ? '#8b5cf6' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: activeTab === 'composite' ? 'bold' : 'normal' }}
        >
          <Layers size={18} /> Composite Filter
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{user?.email}</span>
          <button
            onClick={handleLogout}
            style={{
              background: 'none',
              border: '1px solid #334155',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontSize: '0.9rem'
            }}
          >
            <LogOut size={16} /> Logout
          </button>
        </div>

      </nav>

      {/* Content Area */}
      <div style={{ flex: 1, padding: '0' }}>
        {activeTab === 'dashboard' && <Dashboard />}
      {activeTab === 'selectivity' && <SelectivityExperiment />}
      {activeTab === 'write-penalty' && <WriteCostExperiment />}
      {activeTab === 'composite' && <CompositeExperiment />}
      </div>

    </div>
  );
}

export default App;
