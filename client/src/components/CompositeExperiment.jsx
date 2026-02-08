import React, { useState } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend 
} from 'chart.js';
import { Layers, Play, RefreshCcw, Database } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const API_URL = '/api';

function CompositeExperiment() {
  const [results, setResults] = useState([]); // [{ name: 'Index(Status)', time: 10, type: 'Index Scan' }]
  const [loading, setLoading] = useState(false);
  const [seeded, setSeeded] = useState(true); // User confirmed data is permanent

  // Check if data exists on load
  React.useEffect(() => {
      axios.post(`${API_URL}/modify-data`, { action: 'check_composite_data' })
           .then(res => {
               if (res.data.count > 0) {
                   setSeeded(true);
               }
           })
           .catch(() => {});
  }, []);

  const runTest = async (testType) => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/modify-data`, { 
        action: 'composite_test', 
        step: testType 
      });
      
      if (testType === 'reset') {
          setSeeded(true);
          setResults([]);
          alert(res.data.message);
      } else {
          setResults(prev => [
              ...prev.filter(r => r.id !== testType),
              { 
                  id: testType,
                  name: res.data.idxName, 
                  time: parseFloat(res.data.duration), 
                  type: res.data.planType || 'N/A',
                  details: res.data.details
              }
          ]);
      }
    } catch (err) {
      alert("Error: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const chartData = {
    labels: results.map(r => r.name),
    datasets: [
      {
        label: 'Execution Time (ms)',
        data: results.map(r => r.time),
        backgroundColor: results.map(r => 
            r.id === 'test_composite' ? '#10b981' : // Green for Winner
            r.id === 'test_none' ? '#ef4444' :      // Red for Slowest
            '#f59e0b'                               // Orange for Mid
        ),
        borderRadius: 4,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Query Performance: Status vs Date vs Composite', color: '#cbd5e1' },
      datalabels: {
        color: '#fff',
        anchor: 'end',
        align: 'top',
        formatter: value => Math.round(value) + 'ms'
      }
    },
    scales: {
      y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
      x: { grid: { display: false }, ticks: { color: '#e2e8f0', font: { weight: 'bold' } } }
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
      
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers color="#8b5cf6" /> Composite Indexing
        </h1>
        <p style={{ color: '#94a3b8' }}>
            Scenario: <code>SELECT * FROM orders WHERE status='Active' ORDER BY created_at DESC LIMIT 1000</code> (1M Rows)
        </p>
      </div>

      {/* Control Panel */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>

          <button className="btn" onClick={() => runTest('test_none')} disabled={!seeded || loading} style={{ opacity: seeded ? 1 : 0.5 }}>
            <Play size={14}/> Run: No Index
          </button>
          
          <button className="btn" onClick={() => runTest('test_status')} disabled={!seeded || loading} style={{ opacity: seeded ? 1 : 0.5 }}>
            <Play size={14}/> Run: Index(Status)
          </button>

          <button className="btn" onClick={() => runTest('test_date')} disabled={!seeded || loading} style={{ opacity: seeded ? 1 : 0.5 }}>
            <Play size={14}/> Run: Index(Date)
          </button>

          <button className="btn" onClick={() => runTest('test_composite')} disabled={!seeded || loading} style={{ background: 'rgba(16, 185, 129, 0.2)', borderColor: '#10b981', color: '#34d399', opacity: seeded ? 1 : 0.5 }}>
            <Play size={14}/> Run: Composite (Status+Date) 🚀
          </button>

      </div>

      {/* Results */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          
          {/* Chart */}
          <div className="glass-panel" style={{ padding: '1rem', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             {results.length > 0 ? <Bar data={chartData} options={chartOptions} /> : <p style={{color:'#64748b'}}>Run tests to see comparison</p>}
          </div>

          {/* Details */}
          <div className="glass-panel" style={{ padding: '1rem', overflowY: 'auto', maxHeight: '500px' }}>
              <h3 style={{ borderBottom: '1px solid #334155', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Planner Decision</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {results.slice().sort((a,b) => a.time - b.time).map((r, i) => (
                      <div key={r.id} style={{ 
                          padding: '0.8rem', borderRadius: '6px',
                          background: i === 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(15, 23, 42, 0.6)',
                          border: i === 0 ? '1px solid #10b981' : '1px solid #334155'
                      }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <strong style={{ color: i === 0 ? '#34d399' : '#e2e8f0' }}>{r.name}</strong>
                              <span style={{ fontWeight: 'bold', color: i === 0 ? '#34d399' : '#cbd5e1' }}>{Math.round(r.time)}ms</span>
                          </div>
                          
                          {r.details && (
                             <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem' }}>
                                 <div>Scan: <span style={{color: '#e2e8f0'}}>{r.details.scanType}</span></div>
                                 <div>Touched: <span style={{color: r.details.rowsScanned > 1000 ? '#f43f5e' : '#e2e8f0'}}>{r.details.rowsScanned.toLocaleString()}</span></div>
                                 {r.details.indexName !== 'N/A' && <div style={{gridColumn: 'span 2'}}>Index: <span style={{color: '#e2e8f0'}}>{r.details.indexName}</span></div>}
                                 {r.details.rowsRemoved > 0 && <div style={{gridColumn: 'span 2'}}>Filtered Out: <span style={{color: '#f43f5e'}}>{r.details.rowsRemoved.toLocaleString()}</span></div>}
                             </div>
                          )}
                          
                          {i === 0 && <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#10b981', fontStyle: 'italic' }}>
                            Winner! Postgres chose this because it {r.details.scanType.includes('Index') ? 'used the index to jump exactly to the data.' : 'scanned sequentially.'}
                          </div>}
                      </div>
                  ))}
                  {results.length === 0 && <p style={{color:'#64748b', fontSize:'0.9rem'}}>No results yet.</p>}
              </div>

          </div>

      </div>

    </div>
  );
}

export default CompositeExperiment;
