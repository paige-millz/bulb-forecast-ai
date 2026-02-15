import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface TempChartProps {
  data: { dbe: number; tavg_f: number }[];
}

export function TempChart({ data }: TempChartProps) {
  if (data.length === 0) return null;

  // Sort by DBE descending (60 → 0)
  const sorted = [...data].sort((a, b) => b.dbe - a.dbe);

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Predicted Average Temperature (°F)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={sorted}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="dbe"
              reversed
              label={{ value: "Days Before Easter", position: "insideBottom", offset: -5, style: { fontSize: 12 } }}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              label={{ value: "°F", angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
                fontSize: 13,
              }}
              formatter={(value: number) => [`${value.toFixed(1)}°F`, "Avg Temp"]}
              labelFormatter={(label) => `${label} days before Easter`}
            />
            <Line
              type="monotone"
              dataKey="tavg_f"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ fill: "hsl(var(--primary))", r: 2 }}
              activeDot={{ r: 5, fill: "hsl(var(--accent))" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
