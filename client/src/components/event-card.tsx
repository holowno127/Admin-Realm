import { Calendar, MapPin, Heart, MessageCircle, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { EventWithStats } from "@shared/schema";
import { Link } from "wouter";

interface EventCardProps {
  event: EventWithStats;
  onLike?: (eventId: number) => void;
  onAttend?: (eventId: number) => void;
  showActions?: boolean;
}

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

export function EventCard({ event, onLike, onAttend, showActions = true }: EventCardProps) {
  const isPast = new Date(event.eventDate) < new Date();
  const formattedDate = format(new Date(event.eventDate), "d 'de' MMMM, yyyy • HH:mm", { locale: es });

  return (
    <Card className="overflow-hidden hover-elevate transition-all duration-200" data-testid={`card-event-${event.id}`}>
      <Link href={`/evento/${event.id}`}>
        <div className="relative aspect-video cursor-pointer">
          {event.imageUrl ? (
            <img
              src={event.imageUrl}
              alt={event.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Calendar className="h-12 w-12 text-primary/40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="flex flex-wrap gap-2 mb-2">
              {event.categories?.map((cat) => (
                <Badge key={cat} className={`${categoryColors[cat as keyof typeof categoryColors] || "bg-gray-500/10 text-gray-600 dark:text-gray-400"} border-0`}>
                  {categoryLabels[cat as keyof typeof categoryLabels] || cat}
                </Badge>
              ))}
            </div>
            <h3 className="text-lg font-semibold text-white line-clamp-2">
              {event.title}
            </h3>
          </div>
          {isPast && (
            <div className="absolute top-3 right-3">
              <Badge variant="secondary" className="bg-black/50 text-white border-0">
                Finalizado
              </Badge>
            </div>
          )}
        </div>
      </Link>

      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>{formattedDate}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{event.location}</span>
          </div>

          {showActions && (
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`gap-1.5 ${event.isLiked ? "text-red-500" : ""}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onLike?.(event.id);
                  }}
                  data-testid={`button-like-${event.id}`}
                >
                  <Heart className={`h-4 w-4 ${event.isLiked ? "fill-current" : ""}`} />
                  <span>{event.likesCount}</span>
                </Button>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MessageCircle className="h-4 w-4" />
                  <span className="text-sm">{event.commentsCount}</span>
                </div>
              </div>
              <Button
                variant={event.isAttending ? "secondary" : "default"}
                size="sm"
                className="gap-1.5"
                onClick={(e) => {
                  e.preventDefault();
                  onAttend?.(event.id);
                }}
                disabled={isPast}
                data-testid={`button-attend-${event.id}`}
              >
                <Users className="h-4 w-4" />
                <span>{event.isAttending ? "Asistiré" : "Asistiré"}</span>
                <span className="text-xs">({event.attendeesCount})</span>
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
