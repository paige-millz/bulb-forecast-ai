import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";
import type { EdgeFunctionResponse } from "@/lib/bulb-utils";

interface Props {
  results: EdgeFunctionResponse[];
}

function explain(r: EdgeFunctionResponse): string {
  const parts: string[] = [];

  parts.push(
    `Based on ${r.nRecords} year${r.nRecords !== 1 ? "s" : ""} of historical data, your **${r.bulbType}** bulbs are typically removed **${r.medianDBE} days before Easter**.`
  );

  if (r.weatherAdjusted && r.weatherAdjustedDBE != null && r.weatherAdjustedDBE !== r.baselineDBE) {
    const gdhInfo = r.weatherContext?.gdhModel;
    if (gdhInfo?.projectedDBE != null) {
      parts.push(
        `The degree-hours model adjusted this to **${r.weatherAdjustedDBE} days** based on ${r.targetYear} temperature patterns (target: ${gdhInfo.targetGDH} degree-hours >40°F).`
      );
    } else {
      parts.push(
        `Weather data adjusted this to **${r.weatherAdjustedDBE} days** for ${r.targetYear} conditions.`
      );
    }
  }

  parts.push(
    `With Easter on **${r.easterDate}**, the recommended removal date is **${r.recommendedRemovalDate}**.`
  );

  parts.push(
    `The removal window spans **${r.recommendedWindow.start}** to **${r.recommendedWindow.end}** (IQR: ${r.iqr} days), giving you **${r.confidence}** confidence in this timing.`
  );

  return parts.join(" ");
}

export function RecommendationExplanation({ results }: Props) {
  if (results.length === 0) return null;

  return (
    <Card className="shadow-sm border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-heading uppercase tracking-wide flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          Why This Date?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {results.map((r) => (
          <p key={r.bulbType} className="text-sm text-muted-foreground leading-relaxed">
            {explain(r).split("**").map((segment, i) =>
              i % 2 === 1 ? (
                <strong key={i} className="text-foreground">{segment}</strong>
              ) : (
                <span key={i}>{segment}</span>
              )
            )}
          </p>
        ))}
      </CardContent>
    </Card>
  );
}
