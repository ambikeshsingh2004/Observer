import React, { useState } from 'react';
import { LayoutDashboard, TrendingUp, Layers, Filter } from 'lucide-react';
import Dashboard from './components/Dashboard';
import WriteCostExperiment from './components/WriteCostExperiment';
import CompositeExperiment from './components/CompositeExperiment';
import SelectivityExperiment from './components/SelectivityExperiment'; // New

function App() {
  const [activeTab, setActiveTab] = useState('dashboard'); 

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
          Observer
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
