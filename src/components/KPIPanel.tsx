import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, TrendingDown, CalendarCheck, CalendarRange, Database, Shield } from "lucide-react";
import type { EdgeFunctionResponse } from "@/lib/bulb-utils";

interface KPIPanelProps {
  data: EdgeFunctionResponse | null;
  easterDate: string;
}

const confidenceColor: Record<string, string> = {
  High: "bg-green-100 text-green-800 border-green-300",
  Medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
  Low: "bg-red-100 text-red-800 border-red-300",
};

export function KPIPanel({ data, easterDate }: KPIPanelProps) {
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
          <Card key={item.label} className="animate-fade-in">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <item.icon className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
              </div>
              <p className={`text-sm font-semibold truncate ${item.highlight ? "text-primary" : ""}`}>
                {item.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
