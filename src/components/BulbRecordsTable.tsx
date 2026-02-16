import { useState, useEffect, useCallback } from "react";
import { Pencil, Check, X, Trash2, Plus, Download } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { downloadFile } from "@/lib/bulb-utils";

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

type EditableField = "year" | "bulb_type" | "easter_date" | "removal_date" | "dbe" | "yield_quality" | "yield_notes" | "grower_notes";

interface EditState {
  id: string;
  field: EditableField;
  value: string;
}

const emptyForm = {
  year: new Date().getFullYear().toString(),
  bulb_type: "",
  easter_date: "",
  removal_date: "",
  dbe: "",
  yield_quality: "",
  yield_notes: "",
  grower_notes: "",
};

export function BulbRecordsTable() {
  const [records, setRecords] = useState<BulbRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [adding, setAdding] = useState(false);

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

  const startEdit = (id: string, field: EditableField, currentValue: string | number | null) => {
    setEditing({ id, field, value: currentValue != null ? String(currentValue) : "" });
  };

  const cancelEdit = () => setEditing(null);

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    let updateVal: any = editing.value || null;
    if (editing.field === "year" || editing.field === "dbe") {
      updateVal = editing.value ? Number(editing.value) : null;
    }
    const { error } = await supabase
      .from("bulb_records")
      .update({ [editing.field]: updateVal })
      .eq("id", editing.id);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      setRecords((prev) =>
        prev.map((r) => r.id === editing.id ? { ...r, [editing.field]: updateVal } : r)
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

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("bulb_records").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      setRecords((prev) => prev.filter((r) => r.id !== id));
      toast({ title: "Record deleted" });
    }
  };

  const handleAdd = async () => {
    if (!form.bulb_type || !form.easter_date || !form.year) {
      toast({ title: "Missing fields", description: "Year, Bulb Type, and Easter Date are required.", variant: "destructive" });
      return;
    }
    setAdding(true);
    const record: any = {
      year: Number(form.year),
      bulb_type: form.bulb_type,
      easter_date: form.easter_date,
      removal_date: form.removal_date || null,
      dbe: form.dbe ? Number(form.dbe) : null,
      yield_quality: form.yield_quality || null,
      yield_notes: form.yield_notes || null,
      grower_notes: form.grower_notes || null,
    };
    const { data, error } = await supabase.from("bulb_records").insert(record).select().single();
    if (error) {
      toast({ title: "Add failed", description: error.message, variant: "destructive" });
    } else {
      setRecords((prev) => [data as BulbRow, ...prev]);
      toast({ title: "Record added" });
      setForm(emptyForm);
      setAddOpen(false);
    }
    setAdding(false);
  };

  if (loading) return null;
  if (records.length === 0 && !addOpen) return null;

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Bulb Records ({records.length})</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => {
              const header = "year,bulb_type,easter_date,removal_date,dbe,avg_temp_from_removal_f,degree_hours_above_40f,yield_notes,yield_quality,grower_notes";
              const rows = records.map((r) =>
                [r.year, r.bulb_type, r.easter_date, r.removal_date ?? "", r.dbe ?? "", r.avg_temp_from_removal_f ?? "", r.degree_hours_above_40f ?? "", `"${(r.yield_notes ?? "").replace(/"/g, '""')}"`, `"${(r.yield_quality ?? "").replace(/"/g, '""')}"`, `"${(r.grower_notes ?? "").replace(/"/g, '""')}"`].join(",")
              );
              downloadFile([header, ...rows].join("\n"), "bulb_records.csv", "text/csv");
            }}
            disabled={records.length === 0}
          >
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" /> Add Record
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Bulb Record</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div>
                <Label>Year *</Label>
                <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
              </div>
              <div>
                <Label>Bulb Type *</Label>
                <Input value={form.bulb_type} onChange={(e) => setForm({ ...form, bulb_type: e.target.value })} />
              </div>
              <div>
                <Label>Easter Date *</Label>
                <Input type="date" value={form.easter_date} onChange={(e) => setForm({ ...form, easter_date: e.target.value })} />
              </div>
              <div>
                <Label>Removal Date</Label>
                <Input type="date" value={form.removal_date} onChange={(e) => setForm({ ...form, removal_date: e.target.value })} />
              </div>
              <div>
                <Label>DBE</Label>
                <Input type="number" value={form.dbe} onChange={(e) => setForm({ ...form, dbe: e.target.value })} />
              </div>
              <div>
                <Label>Yield Quality</Label>
                <Input value={form.yield_quality} onChange={(e) => setForm({ ...form, yield_quality: e.target.value })} placeholder="excellent, good, fair, poor" />
              </div>
              <div>
                <Label>Yield Notes</Label>
                <Input value={form.yield_notes} onChange={(e) => setForm({ ...form, yield_notes: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Grower Notes</Label>
                <Input value={form.grower_notes} onChange={(e) => setForm({ ...form, grower_notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAdd} disabled={adding}>
                {adding ? "Adding..." : "Add Record"}
              </Button>
            </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
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
                <TableHead>Yield Quality</TableHead>
                <TableHead>Yield Notes</TableHead>
                <TableHead>Grower Notes</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
                  <EditableCell
                    value={r.year}
                    isEditing={editing?.id === r.id && editing.field === "year"}
                    editValue={editing?.id === r.id && editing.field === "year" ? editing.value : ""}
                    onStartEdit={() => startEdit(r.id, "year", r.year)}
                    onChangeValue={(v) => setEditing((prev) => prev ? { ...prev, value: v } : null)}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    onKeyDown={handleKeyDown}
                    saving={saving}
                    inputType="number"
                  />
                  <EditableCell
                    value={r.bulb_type}
                    isEditing={editing?.id === r.id && editing.field === "bulb_type"}
                    editValue={editing?.id === r.id && editing.field === "bulb_type" ? editing.value : ""}
                    onStartEdit={() => startEdit(r.id, "bulb_type", r.bulb_type)}
                    onChangeValue={(v) => setEditing((prev) => prev ? { ...prev, value: v } : null)}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    onKeyDown={handleKeyDown}
                    saving={saving}
                    className="font-medium"
                  />
                  <EditableCell
                    value={r.easter_date}
                    isEditing={editing?.id === r.id && editing.field === "easter_date"}
                    editValue={editing?.id === r.id && editing.field === "easter_date" ? editing.value : ""}
                    onStartEdit={() => startEdit(r.id, "easter_date", r.easter_date)}
                    onChangeValue={(v) => setEditing((prev) => prev ? { ...prev, value: v } : null)}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    onKeyDown={handleKeyDown}
                    saving={saving}
                    inputType="date"
                  />
                  <EditableCell
                    value={r.removal_date}
                    isEditing={editing?.id === r.id && editing.field === "removal_date"}
                    editValue={editing?.id === r.id && editing.field === "removal_date" ? editing.value : ""}
                    onStartEdit={() => startEdit(r.id, "removal_date", r.removal_date)}
                    onChangeValue={(v) => setEditing((prev) => prev ? { ...prev, value: v } : null)}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    onKeyDown={handleKeyDown}
                    saving={saving}
                    inputType="date"
                  />
                  <EditableCell
                    value={r.dbe}
                    isEditing={editing?.id === r.id && editing.field === "dbe"}
                    editValue={editing?.id === r.id && editing.field === "dbe" ? editing.value : ""}
                    onStartEdit={() => startEdit(r.id, "dbe", r.dbe)}
                    onChangeValue={(v) => setEditing((prev) => prev ? { ...prev, value: v } : null)}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    onKeyDown={handleKeyDown}
                    saving={saving}
                    inputType="number"
                  />
                  <TableCell>{r.avg_temp_from_removal_f ?? "—"}</TableCell>
                  <TableCell>{r.degree_hours_above_40f != null ? Math.round(r.degree_hours_above_40f) : "—"}</TableCell>
                  <EditableCell
                    value={r.yield_quality}
                    isEditing={editing?.id === r.id && editing.field === "yield_quality"}
                    editValue={editing?.id === r.id && editing.field === "yield_quality" ? editing.value : ""}
                    onStartEdit={() => startEdit(r.id, "yield_quality", r.yield_quality)}
                    onChangeValue={(v) => setEditing((prev) => prev ? { ...prev, value: v } : null)}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    onKeyDown={handleKeyDown}
                    saving={saving}
                  />
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
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Record?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Delete {r.bulb_type} ({r.year})? This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(r.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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

function EditableCell({
  value, isEditing, editValue, onStartEdit, onChangeValue, onSave, onCancel, onKeyDown, saving, inputType, className,
}: {
  value: string | number | null;
  isEditing: boolean;
  editValue: string;
  onStartEdit: () => void;
  onChangeValue: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  saving: boolean;
  inputType?: string;
  className?: string;
}) {
  if (isEditing) {
    return (
      <TableCell>
        <div className="flex items-center gap-1">
          <Input
            type={inputType || "text"}
            value={editValue}
            onChange={(e) => onChangeValue(e.target.value)}
            onKeyDown={onKeyDown}
            className="h-7 text-sm min-w-[100px]"
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

  const display = value != null && value !== "" ? String(value) : null;

  return (
    <TableCell>
      <div
        className={`flex items-center gap-1 group cursor-pointer min-h-[28px] rounded px-1 -mx-1 hover:bg-muted/50 ${className ?? ""}`}
        onClick={onStartEdit}
      >
        <span className="text-sm">{display || <span className="text-muted-foreground italic">—</span>}</span>
        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </TableCell>
  );
}
