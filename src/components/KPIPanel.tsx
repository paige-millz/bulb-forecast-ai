import { Card, CardContent } from "@/components/ui/card";
import { Calendar, TrendingDown, CalendarCheck, CalendarRange, Database } from "lucide-react";
import type { Recommendation } from "@/lib/bulb-utils";

interface KPIPanelProps {
  recommendation: Recommendation | null;
  easterDate: string;
}

const kpiItems = [
  { key: "easter_date", label: "Easter Date", icon: Calendar, format: (v: any) => String(v) },
  { key: "avg_dbe", label: "Avg DBE", icon: TrendingDown, format: (v: any) => `${v} days` },
  { key: "recommended_removal", label: "Removal Date", icon: CalendarCheck, format: (v: any) => String(v) },
  { key: "window", label: "Window (±2d)", icon: CalendarRange, format: (v: any) => String(v) },
  { key: "records_used", label: "Records Used", icon: Database, format: (v: any) => String(v) },
];

export function KPIPanel({ recommendation, easterDate }: KPIPanelProps) {
  const values: Record<string, any> = recommendation
    ? {
        easter_date: recommendation.easter_date,
        avg_dbe: recommendation.avg_dbe,
        recommended_removal: recommendation.recommended_removal,
        window: `${recommendation.window_start} → ${recommendation.window_end}`,
        records_used: recommendation.records_used,
      }
    : {
        easter_date: easterDate || "—",
        avg_dbe: "—",
        recommended_removal: "—",
        window: "—",
        records_used: "—",
      };

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {kpiItems.map((item) => (
        <Card key={item.key} className="animate-fade-in">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <item.icon className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
            </div>
            <p className="text-base font-semibold truncate">
              {typeof values[item.key] === "number"
                ? item.format(values[item.key])
                : typeof values[item.key] === "string"
                ? values[item.key]
                : "—"}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
