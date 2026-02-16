import { useState, useEffect, useCallback } from "react";
import { Pencil, Check, X } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface BulbRow {
  id: string;
  year: number;
  bulb_type: string;
  easter_date: string;
  removal_date: string | null;
  dbe: number | null;
  avg_temp_from_removal_f: number | null;
  degree_hours_above_40f: number | null;
  yield_notes: string | null;
  yield_quality: string | null;
  grower_notes: string | null;
}

interface EditState {
  id: string;
  field: "yield_notes" | "grower_notes";
  value: string;
}

export function BulbRecordsTable() {
  const [records, setRecords] = useState<BulbRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("bulb_records")
      .select("id, year, bulb_type, easter_date, removal_date, dbe, avg_temp_from_removal_f, degree_hours_above_40f, yield_notes, yield_quality, grower_notes")
      .order("year", { ascending: false })
      .order("bulb_type");
    if (error) {
      toast({ title: "Error loading records", description: error.message, variant: "destructive" });
    } else {
      setRecords(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const startEdit = (id: string, field: "yield_notes" | "grower_notes", currentValue: string | null) => {
    setEditing({ id, field, value: currentValue ?? "" });
  };

  const cancelEdit = () => setEditing(null);

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from("bulb_records")
      .update({ [editing.field]: editing.value || null })
      .eq("id", editing.id);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      setRecords((prev) =>
        prev.map((r) => r.id === editing.id ? { ...r, [editing.field]: editing.value || null } : r)
      );
      toast({ title: "Saved" });
    }
    setEditing(null);
    setSaving(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") saveEdit();
    if (e.key === "Escape") cancelEdit();
  };

  if (loading) return null;
  if (records.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Bulb Records ({records.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Year</TableHead>
                <TableHead>Bulb Type</TableHead>
                <TableHead>Easter</TableHead>
                <TableHead>Removal</TableHead>
                <TableHead>DBE</TableHead>
                <TableHead>Avg Temp °F</TableHead>
                <TableHead>Deg Hrs &gt;40°F</TableHead>
                <TableHead>Yield Notes</TableHead>
                <TableHead>Grower Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.year}</TableCell>
                  <TableCell className="font-medium">{r.bulb_type}</TableCell>
                  <TableCell>{r.easter_date}</TableCell>
                  <TableCell>{r.removal_date ?? "—"}</TableCell>
                  <TableCell>{r.dbe ?? "—"}</TableCell>
                  <TableCell>{r.avg_temp_from_removal_f ?? "—"}</TableCell>
                  <TableCell>{r.degree_hours_above_40f != null ? Math.round(r.degree_hours_above_40f) : "—"}</TableCell>
                  <EditableCell
                    value={r.yield_notes}
                    isEditing={editing?.id === r.id && editing.field === "yield_notes"}
                    editValue={editing?.id === r.id && editing.field === "yield_notes" ? editing.value : ""}
                    onStartEdit={() => startEdit(r.id, "yield_notes", r.yield_notes)}
                    onChangeValue={(v) => setEditing((prev) => prev ? { ...prev, value: v } : null)}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    onKeyDown={handleKeyDown}
                    saving={saving}
                  />
                  <EditableCell
                    value={r.grower_notes}
                    isEditing={editing?.id === r.id && editing.field === "grower_notes"}
                    editValue={editing?.id === r.id && editing.field === "grower_notes" ? editing.value : ""}
                    onStartEdit={() => startEdit(r.id, "grower_notes", r.grower_notes)}
                    onChangeValue={(v) => setEditing((prev) => prev ? { ...prev, value: v } : null)}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    onKeyDown={handleKeyDown}
                    saving={saving}
                  />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function EditableCell({
  value, isEditing, editValue, onStartEdit, onChangeValue, onSave, onCancel, onKeyDown, saving,
}: {
  value: string | null;
  isEditing: boolean;
  editValue: string;
  onStartEdit: () => void;
  onChangeValue: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  saving: boolean;
}) {
  if (isEditing) {
    return (
      <TableCell>
        <div className="flex items-center gap-1">
          <Input
            value={editValue}
            onChange={(e) => onChangeValue(e.target.value)}
            onKeyDown={onKeyDown}
            className="h-7 text-sm min-w-[120px]"
            autoFocus
            disabled={saving}
          />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSave} disabled={saving}>
            <Check className="h-3.5 w-3.5 text-primary" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel} disabled={saving}>
            <X className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </TableCell>
    );
  }

  return (
    <TableCell>
      <div
        className="flex items-center gap-1 group cursor-pointer min-h-[28px] rounded px-1 -mx-1 hover:bg-muted/50"
        onClick={onStartEdit}
      >
        <span className="text-sm">{value || <span className="text-muted-foreground italic">—</span>}</span>
        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </TableCell>
  );
}
