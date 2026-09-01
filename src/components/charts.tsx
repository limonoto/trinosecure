"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** Concrete colors (Recharts renders SVG attributes, so CSS vars can't be used). */
export const CHART_COLORS = {
  primary: "#26d0b8",
  info: "#38bdf8",
  warning: "#f5a524",
  destructive: "#f06262",
  success: "#34d399",
  muted: "#8a93a6",
  grid: "#252a35",
};

export const SERIES_PALETTE = [
  CHART_COLORS.primary,
  CHART_COLORS.info,
  CHART_COLORS.warning,
  CHART_COLORS.destructive,
  CHART_COLORS.success,
];

const AXIS = { fontSize: 11, fill: CHART_COLORS.muted } as const;
const TOOLTIP_STYLE = {
  background: "#10141b",
  border: "1px solid #252a35",
  borderRadius: 8,
  fontSize: 12,
} as const;

export type Series = { key: string; label: string; color?: string };

/** Multi-series time chart. `data` rows are `{ t: string, [seriesKey]: number }`. */
export function TimeSeries({
  data,
  series,
  area = false,
  height = 240,
}: Readonly<{ data: Record<string, unknown>[]; series: Series[]; area?: boolean; height?: number }>) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-[13px] text-muted-foreground">Veri yok.</p>;
  }
  const Chart = area ? AreaChart : LineChart;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="t" tick={AXIS} stroke={CHART_COLORS.grid} minTickGap={24} />
        <YAxis tick={AXIS} stroke={CHART_COLORS.grid} width={44} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: CHART_COLORS.muted }} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => {
          const color = s.color ?? SERIES_PALETTE[i % SERIES_PALETTE.length];
          return area ? (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={color}
              fill={color}
              fillOpacity={0.15}
              strokeWidth={2}
              dot={false}
            />
          ) : (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={color} strokeWidth={2} dot={false} />
          );
        })}
      </Chart>
    </ResponsiveContainer>
  );
}

/** Single-series category bar chart. `data` rows are `{ name: string, value: number }`. */
export function Bars({
  data,
  color = CHART_COLORS.primary,
  multicolor = false,
  height = 240,
}: Readonly<{ data: { name: string; value: number }[]; color?: string; multicolor?: boolean; height?: number }>) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-[13px] text-muted-foreground">Veri yok.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="name" tick={AXIS} stroke={CHART_COLORS.grid} interval={0} angle={-12} textAnchor="end" height={50} />
        <YAxis tick={AXIS} stroke={CHART_COLORS.grid} width={44} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#ffffff10" }} />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]}>
          {multicolor &&
            data.map((_, i) => <Cell key={i} fill={SERIES_PALETTE[i % SERIES_PALETTE.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
