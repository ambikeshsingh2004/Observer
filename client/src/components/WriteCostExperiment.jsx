import React, { useState } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend 
} from 'chart.js';
import { Play, TrendingUp } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const API_URL = 'http://localhost:5000/api';

function WriteCostExperiment() {
  const [currentStep, setCurrentStep] = useState(-1); 
  const [results, setResults] = useState([]); 
  const [loading, setLoading] = useState(false);

  const steps = [
    { 
      id: 0, 
      label: "0 Indexes (Baseline)", 
      desc: "Baseline Insert (100k)", 
      sql: "DROP TABLE insert_test;\nCREATE TABLE insert_test...;\nINSERT INTO insert_test ... SELECT ... (100k rows);"
    },
    { 
      id: 1, 
      label: "1 Index", 
      desc: "+ Index on Col1", 
      sql: "CREATE INDEX idx_col1 ON insert_test(col1);\nINSERT INTO insert_test ... (100k rows);" 
    },
    { 
      id: 2, 
      label: "2 Indexes", 
      desc: "+ Index on Col2", 
      sql: "CREATE INDEX idx_col2 ON insert_test(col2);\nINSERT INTO insert_test ... (100k rows);" 
    },
    { 
      id: 3, 
      label: "3 Indexes", 
      desc: "+ Index on Col3", 
      sql: "CREATE INDEX idx_col3 ON insert_test(col3);\nINSERT INTO insert_test ... (100k rows);" 
    },
    { 
      id: 4, 
      label: "4 Indexes", 
      desc: "+ Index on Col4", 
      sql: "CREATE INDEX idx_col4 ON insert_test(col4);\nINSERT INTO insert_test ... (100k rows);" 
    }
  ];

  const runPhase = async (stepId) => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/modify-data`, { 
        action: 'index_cost_test', 
        step: stepId 
      });
      
      const val = parseFloat(res.data.duration);
      const timeVal = isNaN(val) ? 0 : val;
      const newResult = { indexCount: stepId, time: timeVal };

      if (stepId === 0) {
        setResults([newResult]);
        setCurrentStep(0);
      } else {
        setResults(prev => {
          const safePrev = Array.isArray(prev) ? prev : [];
          return [...safePrev.filter(r => r.indexCount !== stepId), newResult].sort((a,b) => a.indexCount - b.indexCount);
        });
        setCurrentStep(stepId);
      }
      
    } catch (err) {
      console.error(err);
      alert("Error: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Safe Chart Data Construction
  const safeResults = Array.isArray(results) ? results : [];
  const chartData = {
    labels: safeResults.map(r => `${r.indexCount} IDX`),
    datasets: [
      {
        label: 'Insert Time (ms)',
        data: safeResults.map(r => r.time),
        borderColor: '#f43f5e',
        backgroundColor: 'rgba(244, 63, 94, 0.5)',
        tension: 0.3,
        pointRadius: 6,
        pointBackgroundColor: '#fff'
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top', labels: { color: '#cbd5e1' } },
      title: { display: true, text: 'Insertion Cost vs Index Count', color: '#cbd5e1' },
      datalabels: {
        color: '#fff',
        anchor: 'top',
        align: 'top',
        formatter: value => Math.round(value) + 'ms'
      }
    },
    scales: {
      y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
      x: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } }
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
           <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             <TrendingUp color="#f43f5e" /> Index Write Penalty
           </h1>
           <p style={{ color: '#94a3b8' }}>Visualizing how Indexes slow down INSERT operations.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        
        {/* Left: Steps Visualization */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
           {steps.map(s => {
             const isDone = currentStep >= s.id;
             const canRun = s.id === 0 || (currentStep === s.id - 1 && !loading);
             const isFinished = s.id !== 0 && isDone; 

             const result = safeResults.find(r => r.indexCount === s.id);
             const timeDisplay = result ? `${Math.round(result.time)}ms` : '';

             return (
               <div key={s.id} className="glass-panel" style={{
                 padding: '1rem',
                 borderColor: isDone ? '#10b981' : canRun ? '#f43f5e' : '#334155',
                 background: isDone ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                 opacity: 1, 
                 transition: 'all 0.3s'
               }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display:'flex', gap:'1rem', alignItems:'center' }}>
                        <button 
                            className="btn" 
                            onClick={() => runPhase(s.id)}
                            disabled={!canRun || (isFinished && s.id !== 0)} 
                            style={{ 
                                padding: '0.4rem 0.8rem', 
                                fontSize: '0.8rem', 
                                background: isDone ? '#10b981' : '#334155',
                                cursor: (!canRun || isFinished) ? 'not-allowed' : 'pointer',
                                opacity: (!canRun || isFinished) ? 0.5 : 1
                            }}
                        >
                           {isDone ? <Play size={12} fill="white" style={{transform:'rotate(90deg)'}} /> : <Play size={12} fill="white" />} 
                           {s.id === 0 && isDone ? ' Restart' : isDone ? ' Done' : ' Run'}
                        </button>
                        <strong style={{ color: isDone ? '#34d399' : '#e2e8f0' }}>Step {s.id}: {s.label}</strong>
                    </div>
                    {isDone && <span style={{ color: '#34d399', fontWeight: 'bold' }}>{timeDisplay}</span>}
                  </div>
                  <div style={{ marginTop: '0.5rem', marginLeft: '3.5rem' }}>
                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>{s.desc}</p>
                    <pre style={{ 
                      background: '#0f172a', 
                      padding: '0.5rem', 
                      borderRadius: '4px', 
                      fontSize: '0.7rem', 
                      color: '#64748b', 
                      fontFamily: 'monospace',
                      overflowX: 'auto',
                      border: '1px solid #334155'
                    }}>
{s.sql}
                    </pre>
                  </div>
               </div>
             );
           })}
        </div>

        {/* Right: Chart */}
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
           {safeResults.length > 0 ? (
             <Line data={chartData} options={chartOptions} />
           ) : (
             <div style={{ textAlign: 'center', color: '#64748b' }}>
               <TrendingUp size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
               <p>Click Run on Step 0 to start</p>
             </div>
           )}
        </div>

      </div>

    </div>
  );
}

export default WriteCostExperiment;
