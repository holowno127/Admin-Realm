import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import AdminLayout from "./layout";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  BarChart3,
  Eye,
  Heart,
  MessageCircle,
  Users,
  Calendar,
  TrendingUp,
} from "lucide-react";

interface EventMetrics {
  id: number;
  title: string;
  categories: string[];
  eventDate: string;
  views: number;
  likes: number;
  comments: number;
  attendees: number;
}

interface MetricsData {
  events: EventMetrics[];
  totals: {
    views: number;
    likes: number;
    comments: number;
    attendees: number;
  };
}

const categoryLabels: Record<string, string> = {
  academico: "Académico",
  cultural: "Cultural",
  deportivo: "Deportivo",
};

export default function AdminMetrics() {
  const { data, isLoading } = useQuery<MetricsData>({
    queryKey: ["/api/admin/metrics"],
  });

  const totals = data?.totals ?? {
    views: 0,
    likes: 0,
    comments: 0,
    attendees: 0,
  };

  const summaryCards = [
    { title: "Total Visitas", value: totals.views, icon: Eye },
    { title: "Total Likes", value: totals.likes, icon: Heart },
    { title: "Total Comentarios", value: totals.comments, icon: MessageCircle },
    { title: "Total Asistencias", value: totals.attendees, icon: Users },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Métricas
          </h1>
          <p className="text-muted-foreground">
            Análisis estadístico de eventos e interacciones
          </p>
        </div>

        {/* RESUMEN */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-8 w-16 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </CardContent>
                </Card>
              ))
            : summaryCards.map((card) => (
                <Card key={card.title}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <card.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {card.value.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {card.title}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>

        {/* MÉTRICAS POR EVENTO */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Métricas por evento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : data?.events?.length ? (
              <div className="space-y-4">
                {data.events.map((event) => (
                  <div
                    key={event.id}
                    className="p-4 rounded-lg border"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <h3 className="font-medium truncate">
                          {event.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          {event.categories?.map((cat) => (
                            <Badge key={cat} variant="secondary" className="text-xs">
                              {categoryLabels[cat] ?? cat}
                            </Badge>
                          ))}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(
                              new Date(event.eventDate),
                              "d MMM yyyy",
                              { locale: es }
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <MetricItem icon={Eye} value={event.views} label="Visitas" />
                      <MetricItem icon={Heart} value={event.likes} label="Likes" />
                      <MetricItem icon={MessageCircle} value={event.comments} label="Comentarios" />
                      <MetricItem icon={Users} value={event.attendees} label="Asistirán" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No hay métricas disponibles</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function MetricItem({
  icon: Icon,
  value,
  label,
}: {
  icon: any;
  value: number;
  label: string;
}) {
  return (
    <div className="text-center p-2 rounded-lg bg-muted/50">
      <Icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
