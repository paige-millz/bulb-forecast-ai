import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EdgeFunctionResponse } from "@/lib/bulb-utils";

interface RecommendationsTableProps {
  data: EdgeFunctionResponse;
}

const confidenceBadge: Record<string, string> = {
  High: "bg-green-100 text-green-800 border-green-300",
  Medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
  Low: "bg-red-100 text-red-800 border-red-300",
};

export function RecommendationsTable({ data }: RecommendationsTableProps) {
  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Recommendation Summary</CardTitle>
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
                <TableCell className="font-medium">{data.bulbType}</TableCell>
                <TableCell>{data.easterDate}</TableCell>
                <TableCell>{data.medianDBE} days</TableCell>
                <TableCell>{data.iqr}</TableCell>
                <TableCell className="font-semibold text-primary">{data.recommendedRemovalDate}</TableCell>
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
