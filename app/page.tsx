"use client";

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch('/api/history')
      .then(res => res.json())
      .then(json => {
        if (!json.success) return;
        
        // Formatiert die Rohdaten so um, dass Recharts sie lesen kann
        const chartData = json.data.reduce((acc: any, log: any) => {
          const time = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const existingTime = acc.find((item: any) => item.time === time);
          
          if (existingTime) {
            existingTime[log.deviceName] = log.powerW;
          } else {
            acc.push({ time, [log.deviceName]: log.powerW });
          }
          return acc;
        }, []);
        
        setData(chartData);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Smart Home Energie-Dashboard</h1>
      
      <div className="h-[500px] w-full bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="time" stroke="#6b7280" fontSize={12} tickMargin={10} />
            <YAxis stroke="#6b7280" fontSize={12} unit=" W" />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            
            <Line type="monotone" dataKey="Tapo-Raspberry" stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Tapo-Stehlampe" stroke="#10b981" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Tapo-Nachtlicht" stroke="#f59e0b" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Tapo-Küche" stroke="#ef4444" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}