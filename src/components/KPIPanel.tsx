import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, TrendingDown, CalendarCheck, CalendarRange, Database, Shield, Thermometer, Clock } from "lucide-react";
import type { EdgeFunctionResponse } from "@/lib/bulb-utils";

interface WeatherContext {
  historicalAvgTemp: number;
  historicalAvgDegreeHours: number;
  yearsWithData: number;
  currentYear: { avgTemp: number; degreeHours: number; days: number } | null;
}

interface KPIPanelProps {
  data: (EdgeFunctionResponse & { weatherContext?: WeatherContext | null }) | null;
  easterDate: string;
}

const confidenceColor: Record<string, string> = {
  High: "bg-success/15 text-success border-success/30",
  Medium: "bg-accent/15 text-accent border-accent/30",
  Low: "bg-destructive/15 text-destructive border-destructive/30",
};

export function KPIPanel({ data, easterDate }: KPIPanelProps) {
  const wc = (data as any)?.weatherContext as WeatherContext | null | undefined;

  const items = [
    { label: "Easter Date", icon: Calendar, value: data?.easterDate ?? easterDate ?? "—" },
    { label: "Records Used", icon: Database, value: data ? String(data.nRecords) : "—" },
    { label: "Median DBE", icon: TrendingDown, value: data ? `${data.medianDBE} days` : "—" },
    {
      label: "IQR",
      icon: TrendingDown,
      value: data ? `${data.iqr} days (P25: ${data.p25DBE}, P75: ${data.p75DBE})` : "—",
    },
    { label: "Removal Date", icon: CalendarCheck, value: data?.recommendedRemovalDate ?? "—", highlight: true },
    {
      label: "Removal Window",
      icon: CalendarRange,
      value: data ? `${data.recommendedWindow.start} → ${data.recommendedWindow.end}` : "—",
    },
    ...(wc ? [
      {
        label: "Hist. Avg Temp",
        icon: Thermometer,
        value: `${wc.historicalAvgTemp}°F (${wc.yearsWithData} yr${wc.yearsWithData !== 1 ? "s" : ""})`,
      },
      {
        label: "Hist. Degree Hrs",
        icon: Clock,
        value: `${wc.historicalAvgDegreeHours} hrs >40°F`,
      },
      ...(wc.currentYear ? [
        {
          label: `${data?.targetYear} Avg Temp`,
          icon: Thermometer,
          value: `${wc.currentYear.avgTemp}°F (${wc.currentYear.days} days)`,
          highlight: true,
        },
      ] : []),
    ] : []),
  ];

  return (
    <div className="space-y-3">
      {data && (
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Confidence:</span>
          <Badge variant="outline" className={confidenceColor[data.confidence] ?? ""}>
            {data.confidence}
          </Badge>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {items.map((item) => (
          <Card key={item.label} className="border-t-2 border-t-primary/40 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <item.icon className="h-4 w-4 text-accent" />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</span>
              </div>
              <p className={`text-lg font-bold truncate ${item.highlight ? "text-primary" : "text-foreground"}`}>
                {item.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
