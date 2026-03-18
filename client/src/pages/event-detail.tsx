import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommentSection } from "@/components/comment-section";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { EventWithStats, CommentWithUser } from "@shared/schema";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Heart,
  Users,
  Eye,
  GraduationCap,
  LogIn,
} from "lucide-react";

const categoryColors = {
  academico: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  cultural: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  deportivo: "bg-green-500/10 text-green-600 dark:text-green-400",
};

const categoryLabels = {
  academico: "Académico",
  cultural: "Cultural",
  deportivo: "Deportivo",
};

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const eventId = parseInt(params.id || "0");

  const { data: event, isLoading: eventLoading } = useQuery<EventWithStats>({
    queryKey: [`/api/events/${eventId}`],
    enabled: eventId > 0,
  });

  const { data: comments = [], isLoading: commentsLoading } = useQuery<CommentWithUser[]>({
    queryKey: [`/api/events/${eventId}/comments`],
    enabled: eventId > 0,
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/events/${eventId}/like`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}`] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Debes iniciar sesión para dar like",
        variant: "destructive",
      });
    },
  });

  const attendMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/events/${eventId}/attend`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}`] });
      toast({
        title: "Confirmado",
        description: "Tu asistencia ha sido registrada",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Debes iniciar sesión para confirmar asistencia",
        variant: "destructive",
      });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      await apiRequest("POST", `/api/events/${eventId}/comments`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/comments`] });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}`] });
      toast({
        title: "Comentario agregado",
        description: "Tu comentario ha sido publicado",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Debes iniciar sesión para comentar",
        variant: "destructive",
      });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      await apiRequest("DELETE", `/api/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/comments`] });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}`] });
      toast({
        title: "Comentario eliminado",
        description: "El comentario ha sido eliminado",
      });
    },
  });

  if (eventLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="w-full aspect-[21/9]" />
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Evento no encontrado</h1>
          <Button onClick={() => setLocation("/")} variant="ghost">
            Volver al inicio
          </Button>
        </div>
      </div>
    );
  }

  const isPast = new Date(event.eventDate) < new Date();
  const formattedDate = format(new Date(event.eventDate), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
  const formattedTime = format(new Date(event.eventDate), "HH:mm 'hrs'", { locale: es });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <GraduationCap className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="font-semibold text-lg hidden sm:inline">FIMAZ Eventos</span>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {!user && (
              <Button onClick={() => setLocation("/login")} data-testid="button-login-nav">
                <LogIn className="h-4 w-4 mr-2" />
                Iniciar sesión
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="relative w-full aspect-[21/9] max-h-[400px] overflow-hidden">
        {event.imageUrl ? (
          <img
            src={event.imageUrl}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Calendar className="h-24 w-24 text-primary/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
          <div className="max-w-3xl mx-auto">
            <div className="flex flex-wrap gap-2 mb-3">
              {event.categories?.map((cat) => (
                <Badge key={cat} className={`${categoryColors[cat as keyof typeof categoryColors] || "bg-gray-500/10 text-gray-600 dark:text-gray-400"} border-0`}>
                  {categoryLabels[cat as keyof typeof categoryLabels] || cat}
                </Badge>
              ))}
              {isPast && (
                <Badge variant="secondary" className="bg-black/50 text-white border-0">
                  Finalizado
                </Badge>
              )}
            </div>
            <h1 className="text-2xl md:text-4xl font-bold text-white mb-2">
              {event.title}
            </h1>
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium capitalize">{formattedDate}</p>
                    <p className="text-sm text-muted-foreground">{formattedTime}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{event.location}</p>
                    <p className="text-sm text-muted-foreground">Ubicación</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-4 border-t">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Eye className="h-4 w-4" />
                  <span className="text-sm">{event.views} vistas</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Heart className="h-4 w-4" />
                  <span className="text-sm">{event.likesCount} likes</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">{event.attendeesCount} asistirán</span>
                </div>
              </div>

              {user && (
                <div className="flex flex-wrap gap-3 mt-6">
                  <Button
                    variant={event.isLiked ? "secondary" : "outline"}
                    className={`gap-2 ${event.isLiked ? "text-red-500" : ""}`}
                    onClick={() => likeMutation.mutate()}
                    data-testid="button-like"
                  >
                    <Heart className={`h-4 w-4 ${event.isLiked ? "fill-current" : ""}`} />
                    {event.isLiked ? "Te gusta" : "Me gusta"}
                  </Button>
                  <Button
                    variant={event.isAttending ? "default" : "outline"}
                    className="gap-2"
                    onClick={() => attendMutation.mutate()}
                    disabled={isPast}
                    data-testid="button-attend"
                  >
                    <Users className="h-4 w-4" />
                    {event.isAttending ? "Asistiré" : "Confirmar asistencia"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Descripción</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="whitespace-pre-wrap">{event.description}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comentarios ({comments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {user ? (
                <CommentSection
                  comments={comments}
                  isLoading={commentsLoading}
                  onAddComment={(content) => addCommentMutation.mutate(content)}
                  onDeleteComment={(id) => deleteCommentMutation.mutate(id)}
                  isSubmitting={addCommentMutation.isPending}
                  canDelete={user.role === "admin"}
                  currentUserId={user.id}
                />
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    Inicia sesión para ver y escribir comentarios
                  </p>
                  <Button onClick={() => setLocation("/login")} data-testid="button-login-comments">
                    Iniciar sesión
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
