import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Play, Database, Server, Zap, Trash2, Plus, AlertCircle } from 'lucide-react';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-sql';
import 'prismjs/themes/prism-dark.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartDataLabels);

const API_URL = 'http://localhost:5000/api';

function Dashboard() {
  // --- App State ---
  const [activeTab, setActiveTab] = useState('builder'); // 'builder' | 'sql'
  const [table, setTable] = useState('users_small');
  const [queryResult, setQueryResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Builder State
  const [selectedColumn, setSelectedColumn] = useState('email');
  const [searchValue, setSearchValue] = useState('');
  
  // SQL State
  const [code, setCode] = useState('SELECT * FROM users_large WHERE email = \'test@example.com\'');
  const [sqlError, setSqlError] = useState(null);
  const [useCache, setUseCache] = useState(true);

  // Latency History for Chart
  const [history, setHistory] = useState([]);

  // --- Handlers ---

  // 1. Dynamic Query Builder
  const runBuilderQuery = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post(`${API_URL}/query`, {
        table,
        column: selectedColumn,
        value: searchValue
      });
      setQueryResult(res.data);
      updateHistory(res.data.duration, 'Builder');
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Raw SQL Execution
  const runRawSQL = async () => {
    setLoading(true);
    setSqlError(null);
    setQueryResult(null);
    
    try {
      const clientStart = performance.now(); // Start
      const res = await axios.post(`${API_URL}/sql`, {
        query: code,
        useCache
      });
      const clientEnd = performance.now(); // End

      if (res.data.error) {
        setSqlError(res.data);
      } else {
        // Calculate Waterfall Metrics
        const totalTime = (clientEnd - clientStart).toFixed(2);
        const dbTime = parseFloat(res.data.dbDuration || res.data.duration || 0);
        const serverTime = parseFloat(res.data.serverDuration || dbTime);
        const networkTime = (totalTime - serverTime).toFixed(2);
        
        let bottleneck = 'DB';
        if (dbTime < 5 && networkTime > 50) bottleneck = 'Network';
        if (dbTime < 5 && serverTime > 50) bottleneck = 'Server';

        setQueryResult({
          ...res.data,
          duration: dbTime, // Map dbTime back to duration for UI compatibility
          metrics: {
            total: totalTime,
            db: dbTime,
            network: networkTime > 0 ? networkTime : 0, // Prevent negative
            bottleneck
          }
        });
        updateHistory(dbTime, useCache ? 'SQL+Cache' : 'SQL');
      }
    } catch (err) {
      setSqlError({ message: "Network Error: Could not connect to server." });
    } finally {
      setLoading(false);
    }
  };

  // 3. Index Management
  const manageIndex = async (action) => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/manage-index`, {
        action,
        table,
        column: selectedColumn,
        type: 'btree'
      });
      alert(res.data.message);
    } catch (err) {
      alert(err.response?.data?.error);
    } finally {
      setLoading(false);
    }
  };


  // 4. External API Handlers
  const fetchExternal = async () => {
    setLoading(true);
    setQueryResult(null);
    try {
      const res = await axios.get(`${API_URL}/external`);
      setQueryResult(res.data);
      updateHistory(res.data.duration, 'External API');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper: Update Chart History
  const updateHistory = (duration, type) => {
    setHistory(prev => [...prev.slice(-19), { 
      id: Date.now(), 
      duration: parseFloat(duration), 
      type,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  // Debounced Syntax Validation (Effect)
  useEffect(() => {
    if (activeTab !== 'sql') return;
    const timer = setTimeout(() => {}, 500);
    return () => clearTimeout(timer);
  }, [code]);

  return (
    <div className="grid-layout">

      {/* Sidebar Controls */}
      <div className="sidebar glass-panel">
        <h2><Database className="inline-icon" size={20}/> Control Panel</h2>
        
        <div className="control-group">
          <label>Target Table</label>
          <select value={table} onChange={(e) => setTable(e.target.value)}>
            <option value="users_small">Small (1k rows)</option>
            <option value="users_large">Large (1M rows)</option>
          </select>
        </div>

        <div className="control-group">
          <label>Target Column</label>
          <select value={selectedColumn} onChange={(e) => setSelectedColumn(e.target.value)}>
            <option value="email">Email (Unique-ish)</option>
            <option value="age">Age (Low Cardinality)</option>
            <option value="country">Country</option>
            <option value="first_name">First Name</option>
          </select>
        </div>

        <div className="index-actions">
           <h3>Index Management</h3>
           <div className="btn-group">
             <button className="btn btn-secondary" onClick={() => manageIndex('create')}>
               <Plus size={14} /> Add Index
             </button>
             <button className="btn btn-secondary" style={{borderColor: 'var(--error-color)', color: 'var(--error-color)'}} onClick={() => manageIndex('drop')}>
               <Trash2 size={14} /> Drop
             </button>
           </div>
        </div>

        <div className="external-actions" style={{marginTop: '1.5rem'}}>
           <h3>External API</h3>
           <button className="btn btn-secondary" style={{width: '100%', justifyContent: 'center', display: 'flex', gap: '0.5rem'}} onClick={fetchExternal} disabled={loading}>
             <Zap size={14} /> Fetch DummyJSON
           </button>
           <p style={{fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem'}}>
             Simulates real-world network latency (vs DB latency).
           </p>
        </div>

        <hr style={{borderColor: 'var(--glass-border)'}}/>

        <div className="stats">
             <div className="metric-card">
               <span className="metric-label">Last Latency</span>
               <span className={`metric-value ${queryResult?.duration < 10 ? 'text-green' : 'text-red'}`}>
                 {queryResult ? `${queryResult.duration}ms` : '-'}
               </span>
             </div>
             <div className="metric-card">
               <span className="metric-label">Source</span>
               <span className="metric-value" style={{fontSize: '1.2rem'}}>
                 {queryResult?.source?.toUpperCase() || '-'}
               </span>
             </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        
        {/* Tabs */}
        <div className="glass-panel" style={{padding: '0.5rem', display: 'flex', gap: '1rem'}}>
          <button 
            className={`btn ${activeTab === 'builder' ? '' : 'btn-secondary'}`} 
            onClick={() => setActiveTab('builder')}>
            Query Builder
          </button>
          <button 
            className={`btn ${activeTab === 'sql' ? '' : 'btn-secondary'}`} 
            onClick={() => setActiveTab('sql')}>
            Raw SQL + Cache
          </button>
        </div>

        {/* Builder Mode */}
        {activeTab === 'builder' && (
          <div className="glass-panel">
             <div style={{display: 'flex', gap: '1rem'}}>
               <input 
                 placeholder={`Search inside ${selectedColumn}...`}
                 value={searchValue}
                 onChange={(e) => setSearchValue(e.target.value)}
               />
               <button className="btn" onClick={runBuilderQuery} disabled={loading}>
                 {loading ? 'Running...' : <Play size={18} />}
               </button>
             </div>
          </div>
        )}

        {/* SQL Mode */}
        {activeTab === 'sql' && (
          <div className="glass-panel">
            <div className="toolbar" style={{display: 'flex', justifyContent: 'space-between', marginBottom: '1rem'}}>
               <div style={{display:'flex', gap:'0.5rem', alignItems:'center'}}>
                 <Server size={18} />
                 <label>
                   <input type="checkbox" checked={useCache} onChange={e => setUseCache(e.target.checked)} style={{width:'auto'}}/> 
                   Enable Redis Cache
                 </label>
               </div>
               <button className="btn" onClick={runRawSQL} disabled={loading}>
                 <Play size={16} /> Execute
               </button>
            </div>
            
            <div className="editor-container" style={{border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden'}}>
               <Editor
                 value={code}
                 onValueChange={code => setCode(code)}
                 highlight={code => highlight(code, languages.sql)}
                 padding={15}
                 style={{
                   fontFamily: '"Fira code", "Fira Mono", monospace',
                   fontSize: 14,
                   backgroundColor: '#0f172a',
                   minHeight: '150px'
                 }}
               />
            </div>

            {/* Error Display */}
            {sqlError && (
              <div style={{marginTop: '1rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid var(--error-color)', borderRadius: '8px', color: '#fca5a5'}}>
                 <div style={{display:'flex', alignItems:'center', gap: '0.5rem', fontWeight:'bold'}}>
                   <AlertCircle size={18} />
                   Syntax Error
                 </div>
                 <p>{sqlError.message}</p>
                 {sqlError.position && <p style={{fontSize:'0.8rem'}}>Position: {sqlError.position}</p>}
                 {sqlError.detail && <p style={{fontStyle:'italic'}}>{sqlError.detail}</p>}
              </div>
            )}
          </div>
        )}

        {/* Results Area */}
        {queryResult && (
           <div className="glass-panel">
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <h3>Query Results ({queryResult.rows} rows)</h3>
                <div style={{textAlign: 'right'}}>
                  <span style={{ fontSize: '0.9rem', color: '#94a3b8', display:'block' }}>
                    {queryResult.cached ? '⚡ Served from Redis' : '🐢 Served from Supabase'}
                  </span>
                  {queryResult.scanType && (
                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold', marginTop: '4px', display:'block' }}>
                      {queryResult.scanType}
                    </span>
                  )}
                  {/* Breakdown Waterfall */}
                  {queryResult.metrics && (
                    <div style={{marginTop: '1rem', padding: '10px', background: '#1e293b', borderRadius: '8px'}}>
                       <h4 style={{fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '8px'}}>Request Lifecycle (Waterfall)</h4>
                       
                       {/* 1. Network */}
                       <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px'}}>
                         <span style={{width:'60px', fontSize:'0.75rem', color:'#94a3b8'}}>Network</span>
                         <div style={{flex:1, height:'6px', background:'#334155', borderRadius:'3px'}}>
                            <div style={{width: `${(queryResult.metrics.network / queryResult.metrics.total) * 100}%`, height:'100%', background: '#38bdf8', borderRadius:'3px'}}></div>
                         </div>
                         <span style={{width:'50px', fontSize:'0.75rem', textAlign:'right'}}>{queryResult.metrics.network}ms</span>
                       </div>

                       {/* 2. Database */}
                       <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px'}}>
                         <span style={{width:'60px', fontSize:'0.75rem', color:'#94a3b8'}}>Database</span>
                         <div style={{flex:1, height:'6px', background:'#334155', borderRadius:'3px'}}>
                            <div style={{width: `${(queryResult.metrics.db / queryResult.metrics.total) * 100}%`, height:'100%', background: '#f43f5e', borderRadius:'3px'}}></div>
                         </div>
                         <span style={{width:'50px', fontSize:'0.75rem', textAlign:'right'}}>{queryResult.metrics.db}ms</span>
                       </div>

                       <div style={{marginTop:'8px', fontSize:'0.8rem'}}>
                         <strong>Bottleneck:</strong> <span style={{color: queryResult.metrics.bottleneck === 'DB' ? '#f43f5e' : '#38bdf8'}}>{queryResult.metrics.bottleneck}</span>
                       </div>
                    </div>
                  )}

                  {queryResult.breakdown && queryResult.breakdown.length > 0 && (
                    <div style={{marginTop: '0.5rem', borderTop: '1px solid #334155', paddingTop: '0.5rem'}}>
                      <small style={{color: '#cbd5e1'}}>Cost Breakdown:</small>
                      {queryResult.breakdown.map((step, idx) => (
                        <div key={idx} style={{fontSize: '0.75rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', gap: '1rem'}}>
                          <span>{step.type}</span>
                          <span>{step.time.toFixed(2)}ms</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ maxHeight: '300px', overflow: 'auto', marginTop: '1rem' }}>
                <pre style={{ fontSize: '0.8rem' }}>{JSON.stringify(queryResult.data.slice(0, 5), null, 2)}</pre>
                {queryResult.rows > 5 && <p style={{textAlign:'center', color:'#64748b'}}>... and {queryResult.rows - 5} more rows</p>}
              </div>
           </div>
        )}
        
        {/* Latency Chart */}
        {history.length > 0 && (
          <div className="glass-panel" style={{marginTop: '2rem'}}>
            <h3>Latency History</h3>
            <div style={{height: '300px'}}>
              <Bar 
                data={{
                  labels: history.map(h => h.timestamp),
                  datasets: [{
                    label: 'Query Duration (ms)',
                    data: history.map(h => h.duration),
                    backgroundColor: history.map(h => h.duration < 10 ? '#10b981' : '#ef4444'),
                    borderRadius: 4,
                  }]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                      grid: { color: 'rgba(255,255,255,0.1)' },
                      ticks: { color: '#94a3b8' }
                    },
                    x: {
                      grid: { display: false },
                      ticks: { color: '#94a3b8' }
                    }
                  },
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (ctx) => `Default: ${ctx.raw}ms`
                      }
                    },
                    datalabels: {
                      anchor: 'end',
                      align: 'top',
                      color: '#94a3b8',
                      font: { weight: 'bold', size: 10 },
                      formatter: (value) => `${Math.round(value)}ms`
                    }
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
