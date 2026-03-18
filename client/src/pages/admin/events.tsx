import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AdminLayout from "./layout";
import type { Event } from "@shared/schema";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Pencil, Trash2, Archive, ArchiveRestore, Calendar, Loader2 } from "lucide-react";

const eventFormSchema = z.object({
  title: z.string().min(3, "El título debe tener al menos 3 caracteres"),
  description: z.string().min(10, "La descripción debe tener al menos 10 caracteres"),
  categories: z.array(z.enum(["academico", "cultural", "deportivo"])).min(1, "Selecciona al menos una categoría"),
  eventDate: z.string().min(1, "La fecha es requerida"),
  location: z.string().min(3, "La ubicación debe tener al menos 3 caracteres"),
  imageUrl: z.string().optional(),
});

type EventFormData = z.infer<typeof eventFormSchema>;

const categoryLabels = {
  academico: "Académico",
  cultural: "Cultural",
  deportivo: "Deportivo",
};

export default function AdminEvents() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "archived">("active");

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ["/api/admin/events", filter],
  });

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      categories: ["academico"],
      eventDate: "",
      location: "",
      imageUrl: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      await apiRequest("POST", "/api/admin/events", {
        ...data,
        eventDate: new Date(data.eventDate).toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "Evento creado", description: "El evento ha sido creado exitosamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo crear el evento", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: EventFormData & { id: number }) => {
      await apiRequest("PATCH", `/api/admin/events/${data.id}`, {
        ...data,
        eventDate: new Date(data.eventDate).toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events"] });
      setIsDialogOpen(false);
      setEditingEvent(null);
      form.reset();
      toast({ title: "Evento actualizado", description: "El evento ha sido actualizado" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar el evento", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events"] });
      toast({ title: "Evento eliminado", description: "El evento ha sido eliminado" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, archive }: { id: number; archive: boolean }) => {
      await apiRequest("PATCH", `/api/admin/events/${id}/archive`, { isArchived: archive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events"] });
      toast({ title: "Evento actualizado", description: "El estado del evento ha sido actualizado" });
    },
  });

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    form.reset({
      title: event.title,
      description: event.description,
      categories: event.categories as ("academico" | "cultural" | "deportivo")[],
      eventDate: format(new Date(event.eventDate), "yyyy-MM-dd'T'HH:mm"),
      location: event.location,
      imageUrl: event.imageUrl || "",
    });
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingEvent(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const onSubmit = (data: EventFormData) => {
    if (editingEvent) {
      updateMutation.mutate({ ...data, id: editingEvent.id });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Gestión de Eventos</h1>
            <p className="text-muted-foreground">Crear, editar y administrar eventos</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="w-32" data-testid="select-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="archived">Archivados</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleCreate} data-testid="button-create-event">
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo evento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingEvent ? "Editar evento" : "Nuevo evento"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Título</Label>
                    <Input id="title" {...form.register("title")} data-testid="input-title" />
                    {form.formState.errors.title && (
                      <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Categorías</Label>
                    <div className="flex flex-wrap gap-4">
                      {["academico", "cultural", "deportivo"].map((cat) => (
                        <label key={cat} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            value={cat}
                            checked={form.watch("categories")?.includes(cat as any) || false}
                            onChange={(e) => {
                              const current = form.watch("categories") || [];
                              if (e.target.checked) {
                                form.setValue("categories", [...current, cat as any]);
                              } else {
                                form.setValue("categories", current.filter((c) => c !== cat));
                              }
                            }}
                            className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4"
                          />
                          <span className="text-sm">{categoryLabels[cat as keyof typeof categoryLabels]}</span>
                        </label>
                      ))}
                    </div>
                    {form.formState.errors.categories && (
                      <p className="text-sm text-destructive">{form.formState.errors.categories.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eventDate">Fecha y hora</Label>
                    <Input id="eventDate" type="datetime-local" {...form.register("eventDate")} data-testid="input-date" />
                    {form.formState.errors.eventDate && (
                      <p className="text-sm text-destructive">{form.formState.errors.eventDate.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Ubicación</Label>
                    <Input id="location" {...form.register("location")} data-testid="input-location" />
                    {form.formState.errors.location && (
                      <p className="text-sm text-destructive">{form.formState.errors.location.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="imageUrl">URL de imagen (opcional)</Label>
                    <Input id="imageUrl" {...form.register("imageUrl")} placeholder="https://..." data-testid="input-image" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Descripción</Label>
                    <Textarea id="description" rows={4} {...form.register("description")} data-testid="input-description" />
                    {form.formState.errors.description && (
                      <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-event">
                    {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingEvent ? "Actualizar" : "Crear evento"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No hay eventos</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id} data-testid={`event-row-${event.id}`}>
                      <TableCell className="font-medium max-w-[200px] truncate">{event.title}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {event.categories?.map((cat) => (
                            <Badge key={cat} variant="secondary">
                              {categoryLabels[cat as keyof typeof categoryLabels] || cat}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{format(new Date(event.eventDate), "d MMM yyyy, HH:mm", { locale: es })}</TableCell>
                      <TableCell>
                        <Badge variant={event.isArchived ? "outline" : "default"}>
                          {event.isArchived ? "Archivado" : "Activo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(event)} data-testid={`button-edit-${event.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => archiveMutation.mutate({ id: event.id, archive: !event.isArchived })}
                            data-testid={`button-archive-${event.id}`}
                          >
                            {event.isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(event.id)}
                            data-testid={`button-delete-${event.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
