import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

interface DBEDistributionChartProps {
  dbeValues: number[];
  medianDBE: number;
}

export function DBEDistributionChart({ dbeValues, medianDBE }: DBEDistributionChartProps) {
  if (dbeValues.length === 0) return null;

  // Build histogram bins
  const min = Math.min(...dbeValues);
  const max = Math.max(...dbeValues);
  const binSize = Math.max(1, Math.round((max - min) / 12)) || 1;
  const bins: Record<number, number> = {};

  for (const v of dbeValues) {
    const bin = Math.floor(v / binSize) * binSize;
    bins[bin] = (bins[bin] || 0) + 1;
  }

  const chartData = Object.entries(bins)
    .map(([bin, count]) => ({ dbe: Number(bin), count }))
    .sort((a, b) => a.dbe - b.dbe);

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">DBE Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="dbe"
              label={{ value: "Days Before Easter", position: "insideBottom", offset: -5, style: { fontSize: 12 } }}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              label={{ value: "Count", angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
              tick={{ fontSize: 11 }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
                fontSize: 13,
              }}
              formatter={(value: number) => [value, "Records"]}
              labelFormatter={(label) => `DBE: ${label}`}
            />
            <ReferenceLine
              x={medianDBE}
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              strokeDasharray="4 4"
              label={{ value: `Median: ${medianDBE}`, position: "top", fill: "hsl(var(--primary))", fontSize: 12 }}
            />
            <Bar dataKey="count" fill="hsl(var(--primary))" opacity={0.7} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
