"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ChartDataPoint {
  date: string;
  visitors: number;
  accounts: number;
  subscriptions: number;
  revenue: number;
}

interface GeographyDataPoint {
  country: string;
  count: number;
}

const COLORS = ["#0A2540", "#635BFF", "#00D4FF", "#FFB800", "#FF6B6B"];

export function TrendsChart({ data }: { data: ChartDataPoint[] }) {
  if (!data || data.length === 0) return <div className="h-64 flex items-center justify-center text-on-surface-variant">No data available</div>;
  
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00D4FF" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorAccounts" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#635BFF" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#635BFF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
          />
          <Legend iconType="circle" />
          <Area type="monotone" dataKey="visitors" name="Visitors" stroke="#00D4FF" fillOpacity={1} fill="url(#colorVisitors)" />
          <Area type="monotone" dataKey="accounts" name="New Accounts" stroke="#635BFF" fillOpacity={1} fill="url(#colorAccounts)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RevenueChart({ data }: { data: ChartDataPoint[] }) {
  if (!data || data.length === 0) return <div className="h-64 flex items-center justify-center text-on-surface-variant">No data available</div>;

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `EGP ${value}`} />
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <Tooltip 
            cursor={{fill: '#F3F4F6'}}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            formatter={(value: any) => [`EGP ${value}`, "Revenue"]}
          />
          <Bar dataKey="revenue" name="Revenue" fill="#0A2540" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GeographyChart({ data }: { data: GeographyDataPoint[] }) {
  if (!data || data.length === 0) return <div className="h-64 flex items-center justify-center text-on-surface-variant">No geographical data available</div>;

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={5}
            dataKey="count"
            nameKey="country"
            label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
             contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ConversionFunnelChart({ visitors, accounts, subscriptions }: { visitors: number, accounts: number, subscriptions: number }) {
  const data = [
    { value: visitors, name: "Visitors", fill: "#00D4FF" },
    { value: accounts, name: "Accounts", fill: "#635BFF" },
    { value: subscriptions, name: "Subscriptions", fill: "#0A2540" }
  ];

  if (visitors === 0) return <div className="h-64 flex items-center justify-center text-on-surface-variant">Not enough data for funnel</div>;

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <FunnelChart>
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Funnel
            dataKey="value"
            data={data}
            isAnimationActive
          >
            <LabelList position="right" fill="#000" stroke="none" dataKey="name" />
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    </div>
  );
}
