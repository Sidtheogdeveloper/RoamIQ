import { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Calendar, MoreVertical, Plane, Clock, CheckCircle2, Hotel, Navigation } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useDestinationImage } from '@/hooks/useDestinationImage';

type Trip = Tables<'trips'>;

interface Props {
  trip: Trip;
  index: number;
  onUpdate: () => void;
}

const statusStyles: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  planning: { bg: 'bg-info/10', text: 'text-info', icon: Clock },
  ongoing: { bg: 'bg-warning/10', text: 'text-warning', icon: Plane },
  completed: { bg: 'bg-success/10', text: 'text-success', icon: CheckCircle2 },
};

const TripCard = ({ trip, index, onUpdate }: Props) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const style = statusStyles[trip.status] || statusStyles.planning;
  const StatusIcon = style.icon;

  const { imageUrl, gradient, loading: imageLoading } = useDestinationImage(trip.destination);

  const updateStatus = async (newStatus: string) => {
    const { error } = await supabase
      .from('trips')
      .update({ status: newStatus })
      .eq('id', trip.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `Trip marked as ${newStatus}` });
      onUpdate();
    }
  };

  const deleteTrip = async () => {
    const { error } = await supabase.from('trips').delete().eq('id', trip.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Trip deleted' });
      onUpdate();
    }
  };

  // Determine which image to display
  const displayUrl = trip.image_url || imageUrl;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05 }}
      className="group cursor-pointer overflow-hidden rounded-xl border border-border bg-card shadow-card transition-all hover:shadow-elevated hover:-translate-y-0.5"
      onClick={() => navigate(`/trip/${trip.id}`)}
    >
      {/* Cover image */}
      <div className="relative h-40 overflow-hidden" style={{ background: gradient }}>
        {/* Shimmer loading skeleton */}
        {(imageLoading || (!imgLoaded && displayUrl && !imgError)) && (
          <div className="absolute inset-0 z-10">
            <div className="h-full w-full animate-pulse bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>
        )}

        {/* Actual image */}
        {displayUrl && !imgError && (
          <motion.img
            src={displayUrl}
            alt={trip.destination}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            loading="lazy"
            initial={{ opacity: 0 }}
            animate={{ opacity: imgLoaded ? 1 : 0 }}
            transition={{ duration: 0.5 }}
          />
        )}

        {/* Fallback: destination initial + gradient */}
        {(!displayUrl || imgError) && !imageLoading && (
          <div className="flex h-full w-full items-center justify-center">
            <span className="font-display text-5xl font-black text-white/20">
              {trip.destination.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />

        {/* AI badge */}
        {imageUrl && !trip.image_url && imgLoaded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute bottom-2 right-2 rounded-full bg-black/40 px-2 py-0.5 text-[9px] font-medium text-white/70 backdrop-blur-sm"
          >
            ✨ AI
          </motion.div>
        )}

        {/* Status badge overlaid on image */}
        <div className="absolute left-3 top-3">
          <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur-sm ${style.bg} ${style.text}`}>
            <StatusIcon className="h-3 w-3" />
            {trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}
          </div>
        </div>

        {/* Menu */}
        <div className="absolute right-2 top-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              onClick={(e) => e.stopPropagation()}
              className="rounded-md bg-card/50 p-1 text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity hover:bg-card/80 group-hover:opacity-100"
            >
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {trip.status !== 'ongoing' && (
                <DropdownMenuItem onClick={() => updateStatus('ongoing')}>Mark as Ongoing</DropdownMenuItem>
              )}
              {trip.status !== 'completed' && (
                <DropdownMenuItem onClick={() => updateStatus('completed')}>Mark as Completed</DropdownMenuItem>
              )}
              {trip.status !== 'planning' && (
                <DropdownMenuItem onClick={() => updateStatus('planning')}>Move to Planning</DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={deleteTrip} className="text-destructive">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="mb-1 font-display text-base font-bold text-foreground">{trip.name}</h3>

        <div className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          {trip.destination}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          {format(new Date(trip.start_date), 'MMM d')} – {format(new Date(trip.end_date), 'MMM d, yyyy')}
        </div>

        {(trip.source_city || trip.hotel_name) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {trip.source_city && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                <Navigation className="h-2.5 w-2.5" /> {trip.source_city}
              </span>
            )}
            {trip.hotel_name && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                <Hotel className="h-2.5 w-2.5" /> {trip.hotel_name}
              </span>
            )}
          </div>
        )}

        {trip.description && (
          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{trip.description}</p>
        )}
      </div>
    </motion.div>
  );
};

export default TripCard;
