import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Recommendation } from "@/lib/bulb-utils";

interface RecommendationsTableProps {
  data: Recommendation[];
}

export function RecommendationsTable({ data }: RecommendationsTableProps) {
  if (data.length === 0) return null;

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Recommendations</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bulb Type</TableHead>
                <TableHead>Easter</TableHead>
                <TableHead>Avg DBE</TableHead>
                <TableHead>Removal Date</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Model</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.bulb_type}</TableCell>
                  <TableCell>{r.easter_date}</TableCell>
                  <TableCell>{r.avg_dbe}</TableCell>
                  <TableCell className="font-semibold text-primary">{r.recommended_removal}</TableCell>
                  <TableCell className="text-sm">{r.window_start} → {r.window_end}</TableCell>
                  <TableCell>{r.records_used}</TableCell>
                  <TableCell>{r.model_type}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
