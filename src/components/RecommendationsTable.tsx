import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EdgeFunctionResponse } from "@/lib/bulb-utils";

interface RecommendationsTableProps {
  data: EdgeFunctionResponse;
}

const confidenceBadge: Record<string, string> = {
  High: "bg-success/15 text-success border-success/30",
  Medium: "bg-accent/15 text-accent border-accent/30",
  Low: "bg-destructive/15 text-destructive border-destructive/30",
};

export function RecommendationsTable({ data }: RecommendationsTableProps) {
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
                <TableHead>Median DBE</TableHead>
                <TableHead>IQR</TableHead>
                <TableHead>Removal Date</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-semibold">{data.bulbType}</TableCell>
                <TableCell>{data.easterDate}</TableCell>
                <TableCell>{data.medianDBE} days</TableCell>
                <TableCell>{data.iqr}</TableCell>
                <TableCell className="font-bold text-primary">{data.recommendedRemovalDate}</TableCell>
                <TableCell className="text-sm">{data.recommendedWindow.start} → {data.recommendedWindow.end}</TableCell>
                <TableCell>{data.nRecords}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={confidenceBadge[data.confidence] ?? ""}>
                    {data.confidence}
                  </Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
