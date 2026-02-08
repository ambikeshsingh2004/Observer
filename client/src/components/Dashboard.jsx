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

const API_URL = '/api';

function Dashboard() {
  // --- App State ---
  // SQL State
  const [code, setCode] = useState('SELECT * FROM users_large WHERE email = \'test@example.com\'');
  const [useCache, setUseCache] = useState(true);
  const [sqlError, setSqlError] = useState(null);
  
  const [queryResult, setQueryResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Latency History for Chart
  const [history, setHistory] = useState([]);

  // --- Handlers ---
  // Raw SQL Execution
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
    const timer = setTimeout(() => {}, 500);
    return () => clearTimeout(timer);
  }, [code]);

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
           <h1 style={{ fontSize: '2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', color: '#e2e8f0' }}>
               <Database color="#38bdf8" /> SQL Playground
           </h1>
           <p style={{ color: '#94a3b8' }}>
               Run raw queries, toggle Redis caching, and analyze execution plans.
           </p>
        </div>
      </div>

      {/* SQL Editor Panel */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
         <div className="toolbar" style={{display: 'flex', justifyContent: 'space-between', marginBottom: '1rem'}}>
            <div style={{display:'flex', gap:'0.5rem', alignItems:'center', color: '#cbd5e1'}}>
              <Server size={18} />
              <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer'}}>
                <input type="checkbox" checked={useCache} onChange={e => setUseCache(e.target.checked)} style={{width:'auto'}}/> 
                Enable Redis Cache
              </label>
            </div>
            <button className="btn" onClick={runRawSQL} disabled={loading} style={{ minWidth: '120px' }}>
              {loading ? 'Running...' : <><Play size={16} /> Execute</>}
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
                color: '#e2e8f0',
                minHeight: '200px'
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

      {/* Results Area */}
      {queryResult && (
         <div className="glass-panel" style={{ marginTop: '2rem', padding: '1.5rem' }}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: '1rem'}}>
              <h3 style={{color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                  Query Results <span style={{fontSize: '0.8rem', color: '#94a3b8', fontWeight: 'normal'}}>({queryResult.rows} rows)</span>
              </h3>
              
              <div style={{textAlign: 'right'}}>
                <span style={{ fontSize: '0.9rem', color: queryResult.cached ? '#facc15' : '#94a3b8', display:'block', fontWeight: 'bold' }}>
                  {queryResult.cached ? '⚡ Served from Redis' : '🐢 Served from Supabase'}
                </span>
                {queryResult.scanType && (
                  <span style={{ fontSize: '0.9rem', color: '#e2e8f0', marginTop: '4px', display:'block' }}>
                    Strategy: <strong style={{color: queryResult.scanType.includes('Index') ? '#34d399' : '#f43f5e'}}>{queryResult.scanType}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Waterfall Chart inside Results */}
            {queryResult.metrics && (
                <div style={{ marginBottom: '1.5rem', padding: '15px', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
                   <h4 style={{fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Request Lifecycle (Waterfall)</h4>
                   
                   {/* 1. Network */}
                   <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px'}}>
                     <span style={{width:'80px', fontSize:'0.8rem', color:'#94a3b8'}}>Network</span>
                     <div style={{flex:1, height:'8px', background:'#334155', borderRadius:'4px', overflow: 'hidden'}}>
                        <div style={{width: `${(queryResult.metrics.network / queryResult.metrics.total) * 100}%`, height:'100%', background: '#38bdf8', borderRadius:'4px'}}></div>
                     </div>
                     <span style={{width:'60px', fontSize:'0.8rem', textAlign:'right', color: '#e2e8f0'}}>{queryResult.metrics.network}ms</span>
                   </div>

                   {/* 2. Database */}
                   <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px'}}>
                     <span style={{width:'80px', fontSize:'0.8rem', color:'#94a3b8'}}>Database</span>
                     <div style={{flex:1, height:'8px', background:'#334155', borderRadius:'4px', overflow: 'hidden'}}>
                        <div style={{width: `${(queryResult.metrics.db / queryResult.metrics.total) * 100}%`, height:'100%', background: '#f43f5e', borderRadius:'4px'}}></div>
                     </div>
                     <span style={{width:'60px', fontSize:'0.8rem', textAlign:'right', color: '#e2e8f0'}}>{queryResult.metrics.db}ms</span>
                   </div>

                   <div style={{marginTop:'12px', fontSize:'0.8rem', color: '#94a3b8'}}>
                     <strong>Bottleneck:</strong> <span style={{color: queryResult.metrics.bottleneck === 'DB' ? '#f43f5e' : '#38bdf8', fontWeight: 'bold'}}>{queryResult.metrics.bottleneck}</span>
                   </div>
                </div>
            )}

            <div style={{ maxHeight: '400px', overflow: 'auto', background: '#0f172a', padding: '1rem', borderRadius: '8px', border: '1px solid #334155' }}>
              <pre style={{ fontSize: '0.85rem', color: '#e2e8f0', margin: 0 }}>{JSON.stringify(queryResult.data, null, 2)}</pre>
            </div>
         </div>
      )}
      
      {/* Latency Chart */}
      {history.length > 0 && (
        <div className="glass-panel" style={{marginTop: '2rem', padding: '1.5rem'}}>
          <h3 style={{color: '#e2e8f0', marginBottom: '1rem'}}>Latency History</h3>
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
                    grid: { color: 'rgba(255,255,255,0.05)' },
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
  );
}

export default Dashboard;
