"use client";

import { useState, useEffect } from "react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { MARKET_DATA } from "@/lib/mockData";

export function MarketChart() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="w-full h-full">
      {isMounted && (
        <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100} debounce={50}>
          <AreaChart
            data={MARKET_DATA}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#00F0FF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid 
              strokeDasharray="3 3" 
              vertical={false} 
              stroke="rgba(255,255,255,0.05)" 
            />
            <XAxis 
              dataKey="time" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#94A3B8", fontSize: 10 }}
              dy={10}
            />
            <YAxis 
              hide
              domain={["auto", "auto"]}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "#0D0D0D", 
                border: "1px solid rgba(0, 240, 255, 0.2)",
                borderRadius: "12px",
                fontSize: "12px",
                color: "#F8FAFC"
              }}
              itemStyle={{ color: "#00F0FF" }}
              cursor={{ stroke: "rgba(0, 240, 255, 0.2)", strokeWidth: 2 }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#00F0FF"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorValue)"
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
