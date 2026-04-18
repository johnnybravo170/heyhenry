'use client';

import {
  Bar,
  CartesianGrid,
  BarChart as RechartsBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type BarChartDatum = { label: string; value: number };

export function BarChart({
  data,
  color = 'var(--primary)',
  height = 280,
  horizontal = true,
}: {
  data: BarChartDatum[];
  color?: string;
  height?: number;
  horizontal?: boolean;
}) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground"
        style={{ height }}
      >
        No data for the selected window.
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 8, right: 16, bottom: 4, left: horizontal ? 80 : 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          {horizontal ? (
            <>
              <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis
                type="category"
                dataKey="label"
                tickLine={false}
                axisLine={false}
                fontSize={11}
                width={120}
              />
            </>
          ) : (
            <>
              <XAxis
                type="category"
                dataKey="label"
                tickLine={false}
                axisLine={false}
                fontSize={11}
              />
              <YAxis type="number" tickLine={false} axisLine={false} fontSize={11} />
            </>
          )}
          <Tooltip
            contentStyle={{
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="value" fill={color} radius={4} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
