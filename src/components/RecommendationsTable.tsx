import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EdgeFunctionResponse } from "@/lib/bulb-utils";

interface RecommendationsTableProps {
  data: EdgeFunctionResponse | EdgeFunctionResponse[];
}

const confidenceBadge: Record<string, string> = {
  High: "bg-success/15 text-success border-success/30",
  Medium: "bg-accent/15 text-accent border-accent/30",
  Low: "bg-destructive/15 text-destructive border-destructive/30",
};

export function RecommendationsTable({ data }: RecommendationsTableProps) {
  const rows = Array.isArray(data) ? data : [data];

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-heading uppercase tracking-wide">Recommendation Summary</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bulb Type</TableHead>
                <TableHead>Easter</TableHead>
                <TableHead>Finish By</TableHead>
                <TableHead>Median DBE</TableHead>
                <TableHead>IQR</TableHead>
                <TableHead>Removal Date</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.bulbType}>
                  <TableCell className="font-semibold">{r.bulbType}</TableCell>
                  <TableCell>{r.easterDate}</TableCell>
                  <TableCell className="font-medium text-accent">{r.finishingDate}</TableCell>
                  <TableCell>{r.medianDBE} days</TableCell>
                  <TableCell>{r.iqr}</TableCell>
                  <TableCell className="font-bold text-primary">{r.recommendedRemovalDate}</TableCell>
                  <TableCell className="text-sm">{r.recommendedWindow.start} → {r.recommendedWindow.end}</TableCell>
                  <TableCell>{r.nRecords}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={confidenceBadge[r.confidence] ?? ""}>
                      {r.confidence}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
