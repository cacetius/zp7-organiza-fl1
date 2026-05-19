import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, CheckSquare, Circle, CheckCircle2, XCircle, MinusCircle, Printer, FileSpreadsheet } from "lucide-react";
import { exportCsv } from "@/lib/exportCsv";
import { exportChecklistPdf } from "@/lib/exportPdf";

const categorias = [
  { value: "inicio_turno", label: "Início de Turno" },
  { value: "durante_turno", label: "Durante o Turno" },
  { value: "fim_turno", label: "Fim de Turno" },
  { value: "testores", label: "Testores" },
  { value: "seguranca", label: "Segurança" },
  { value: "qualidade", label: "Qualidade" },
  { value: "5s", label: "5S" },
  { value: "manutencao", label: "Manutenção" },
  { value: "liberacao_area", label: "Liberação de Área" },
];

const statusIcons = {
  pendente: <Circle className="w-5 h-5 text-muted-foreground" />,
  conforme: <CheckCircle2 className="w-5 h-5 text-green-400" />,
  nao_conforme: <XCircle className="w-5 h-5 text-red-400" />,
  nao_aplicavel: <MinusCircle className="w-5 h-5 text-gray-400" />,
};

const categoriaLabelMap = Object.fromEntries(categorias.map(c => [c.value, c.label]));

export default function Checklist() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ categoria: "", descricao: "" });
  const [activeTab, setActiveTab] = useState("inicio_turno");
  const qc = useQueryClient();

  const today = new Date().toISOString().split("T")[0];

  // Subscription em tempo real
  useEffect(() => {
    const unsub = base44.entities.ChecklistItem.subscribe((event) => {
      qc.setQueryData(["checklist"], (prev = []) => {
        if (event.type === "create") return [event.data, ...prev];
        if (event.type === "update") return prev.map(i => i.id === event.id ? event.data : i);
        if (event.type === "delete") return prev.filter(i => i.id !== event.id);
        return prev;
      });
    });
    return unsub;
  }, [qc]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["checklist"],
    queryFn: () => base44.entities.ChecklistItem.list("-created_date"),
  });

  const createMut = useMutation({
    mutationFn: (d) => base44.entities.ChecklistItem.create({ ...d, data: today, status: "pendente" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["checklist"] }); setOpen(false); setForm({ categoria: "", descricao: "" }); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status }) => base44.entities.ChecklistItem.update(id, { status, horario: new Date().toLocaleTimeString("pt-BR") }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist"] }),
  });

  const filtered = items.filter((i) => i.categoria === activeTab);
  const total = filtered.length;
  const done = filtered.filter((i) => i.status === "conforme").length;

  const handleExportCsv = () => {
    exportCsv("checklist_zp7",
      ["Categoria", "Item", "Status", "Responsável", "Horário", "Observação"],
      items.map(i => [categoriaLabelMap[i.categoria] || i.categoria, i.descricao, i.status?.replace(/_/g," ") || "", i.responsavel || "", i.horario || "", i.observacao || ""])
    );
  };

  const handlePrint = () => exportChecklistPdf(items, categoriaLabelMap);

  return (
    <div className="space-y-4 pb-24 lg:pb-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><CheckSquare className="w-5 h-5 text-emerald-400" /> Checklist</h1>
          <p className="text-xs text-muted-foreground">Checklists do líder e monitor · {done}/{total} conformes na aba atual</p>
        </div>
        <div className="flex gap-1.5 flex-wrap justify-end">
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1 text-muted-foreground"><FileSpreadsheet className="w-3.5 h-3.5" /><span className="hidden sm:inline">CSV</span></Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1 text-muted-foreground"><Printer className="w-3.5 h-3.5" /><span className="hidden sm:inline">PDF</span></Button>
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Novo Item</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Adicionar Item ao Checklist</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {categorias.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Descrição do item</Label>
                <Input required value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descreva o item" />
              </div>
              <Button type="submit" className="w-full" disabled={createMut.isPending}>Adicionar</Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {categorias.map((c) => (
          <button
            key={c.value}
            onClick={() => setActiveTab(c.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border whitespace-nowrap ${
              activeTab === c.value ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Progress */}
      {total > 0 && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{done}/{total} concluídos</span>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${(done / total) * 100}%` }} />
          </div>
          <span className="font-medium text-green-400">{total > 0 ? Math.round((done / total) * 100) : 0}%</span>
        </div>
      )}

      {/* Items */}
      <div className="space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CheckSquare className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhum item nesta categoria.</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((item) => (
            <Card key={item.id} className="hover:border-primary/20 transition-colors">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => updateMut.mutate({ id: item.id, status: item.status === "conforme" ? "pendente" : "conforme" })}>
                    {statusIcons[item.status]}
                  </button>
                  <div>
                    <p className={`text-sm font-medium ${item.status === "conforme" ? "line-through text-muted-foreground" : ""}`}>{item.descricao}</p>
                    {item.horario && <p className="text-[10px] text-muted-foreground">Feito às {item.horario}</p>}
                  </div>
                </div>
                <Select value={item.status} onValueChange={(v) => updateMut.mutate({ id: item.id, status: v })}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="conforme">Conforme</SelectItem>
                    <SelectItem value="nao_conforme">Não Conforme</SelectItem>
                    <SelectItem value="nao_aplicavel">N/A</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}