
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Filter, Play, Database, AlertTriangle, Layers } from 'lucide-react';
import { Bar } from 'react-chartjs-2';

const API_URL = 'http://localhost:5000/api';

function SelectivityExperiment() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [seeded, setSeeded] = useState(true);
  const [threshold, setThreshold] = useState(5); // Default 5%

  // Check data on mount
  useEffect(() => {
    axios.post(`${API_URL}/modify-data`, { action: 'selectivity_test', step: 'check' })
         .then(res => { if(res.data.count > 0) setSeeded(true); else setSeeded(false); })
         .catch(() => setSeeded(false));
  }, []);

  const runTest = async (step, val) => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/modify-data`, { 
        action: 'selectivity_test', 
        step: step,
        threshold: val 
      });

      if (step === 'seed') setSeeded(true);
      if (step === 'run') {
          const newResult = {
              id: Date.now(),
              threshold: res.data.threshold,
              time: parseFloat(res.data.duration),
              details: res.data.details
          };
          setResults(prev => [newResult, ...prev].slice(0, 3)); // Keep last 3
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', color: '#e2e8f0' }}>
      
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Filter color="#f43f5e" /> Index Selectivity
        </h1>
        <p style={{ color: '#94a3b8' }}>
            When does Postgres <strong>GIVE UP</strong> on an index? (The "Tipping Point")
        </p>
      </div>

      {/* Control Panel */}
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
          
          {!seeded && (
              <div style={{marginBottom: '1rem'}}>
                <button className="btn" onClick={() => runTest('seed')} disabled={loading}>
                    <Database size={16}/> Seed Data (200k Rows)
                </button>
              </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
              <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1' }}>
                      Selectivity Threshold: <strong style={{color:'#f43f5e'}}>{threshold}%</strong> 
                      <span style={{color:'#64748b', fontSize:'0.8rem', marginLeft:'0.5rem'}}>(Selecting {threshold * 2000} rows)</span>
                  </label>
                  <input 
                    type="range" min="1" max="100" value={threshold} 
                    onChange={(e) => setThreshold(parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: '#f43f5e' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
                      <span>1% (Needle)</span>
                      <span>10%</span>
                      <span>20% (Tipping Point?)</span>
                      <span>50%</span>
                      <span>100% (Haystack)</span>
                  </div>
              </div>

              <button 
                className="btn" 
                onClick={() => runTest('run', threshold)}
                disabled={!seeded || loading}
                style={{ height: '50px', padding: '0 2rem', fontSize: '1.1rem', background: '#f43f5e', borderColor: '#f43f5e' }}
              >
                  {loading ? 'Running...' : 'Run Query'} <Play size={18} fill="white" />
              </button>
          </div>
      </div>

      {/* Results */}
      <div style={{ display: 'grid', gap: '1rem' }}>
          {results.map((r, i) => (
              <div key={r.id} className="glass-panel" style={{ 
                  padding: '1.5rem', 
                  borderLeft: `5px solid ${r.details.scanType.includes('Index') ? '#10b981' : '#f43f5e'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                  
                  {/* Left: Input */}
                  <div>
                      <div style={{fontSize:'0.9rem', color:'#94a3b8', marginBottom:'0.2rem'}}>Query</div>
                      <code style={{background:'rgba(0,0,0,0.3)', padding:'0.3rem', borderRadius:'4px', color:'#e2e8f0'}}>
                          SELECT * FROM data WHERE score &lt; {r.threshold}
                      </code>
                  </div>

                  {/* Middle: Decision */}
                  <div style={{ textAlign: 'center' }}>
                      <div style={{fontSize:'0.8rem', color:'#94a3b8', marginBottom:'0.2rem'}}>Planner Decision</div>
                      <div style={{ 
                          fontSize: '1.2rem', fontWeight: 'bold', 
                          color: r.details.scanType.includes('Index') ? '#34d399' : '#f43f5e' 
                      }}>
                          {r.details.scanType}
                      </div>
                      <div style={{fontSize:'0.8rem', color:'#64748b'}}>
                          {r.details.scanType.includes('Index') ? 'Used Index(score)' : 'Ignored Index'}
                      </div>
                  </div>

                  {/* Right: Stats */}
                  <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#e2e8f0' }}>{Math.round(r.time)}ms</div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                          Rows: {r.details.rowsReturned.toLocaleString()}
                      </div>
                  </div>

              </div>
          ))}
          
          {results.length === 0 && seeded && (
            <div style={{textAlign:'center', padding:'3rem', color:'#64748b', fontStyle:'italic'}}>
                Adjust the slider and hit Run. <br/>See when Postgres decides the Index is "too expensive".
            </div>
          )}
      </div>

      {/* Theory Section */}
      <div className="glass-panel" style={{ padding: '2rem', marginTop: '3rem', borderLeft: '4px solid #3b82f6' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={20} /> How the database decides
          </h3>
          <ul style={{ color: '#cbd5e1', lineHeight: '1.8', paddingLeft: '1.5rem' }}>
              <li>Databases pick plans based on <strong>estimated cost</strong>, not just the number of rows returned.</li>
              <li>
                  <strong>Index Scan</strong> (Precision) &rarr; 
                  <strong>Bitmap Heap Scan</strong> (Batching) &rarr; 
                  <strong>Sequential Scan</strong> (Full Read).
              </li>
              <li>Bitmap scans batch index results to reduce random disk access.</li>
              <li>Sequential scans win when <strong>most rows</strong> match the filter (avoiding "random jumping").</li>
          </ul>
      </div>

    </div>
  );
}

export default SelectivityExperiment;
