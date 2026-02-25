import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MapPin, Calendar, Compass, LogOut, Plane, Clock, CheckCircle2, Sun, Moon, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import CreateTripDialog from '@/components/CreateTripDialog';
import TripCard from '@/components/TripCard';

type Trip = Tables<'trips'>;

const Trips = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const fetchTrips = async () => {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Error loading trips', description: error.message, variant: 'destructive' });
    } else {
      setTrips(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const filterTrips = (status: string) => trips.filter((t) => t.status === status);

  const statusConfig = {
    planning: { icon: Clock, label: 'Planning', color: 'text-info' },
    ongoing: { icon: Plane, label: 'Ongoing', color: 'text-warning' },
    completed: { icon: CheckCircle2, label: 'Completed', color: 'text-success' },
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary">
              <Compass className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="font-display text-lg font-bold text-foreground">My Trips</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setDialogOpen(true)} size="sm">
              <Plus className="mr-1 h-4 w-4" />
              New Trip
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/emergency')}
              className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
              title="Emergency SOS"
            >
              <ShieldAlert className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title="Toggle dark mode"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <Tabs defaultValue="planning">
          <TabsList className="mb-6 w-full justify-start">
            {(['planning', 'ongoing', 'completed'] as const).map((status) => {
              const cfg = statusConfig[status];
              const count = filterTrips(status).length;
              return (
                <TabsTrigger key={status} value={status} className="gap-2">
                  <cfg.icon className={`h-4 w-4 ${cfg.color}`} />
                  {cfg.label}
                  {count > 0 && (
                    <span className="ml-1 rounded-full bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground">
                      {count}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {(['planning', 'ongoing', 'completed'] as const).map((status) => (
            <TabsContent key={status} value={status}>
              {loading ? (
                <div className="flex items-center justify-center py-20 text-muted-foreground">Loading…</div>
              ) : filterTrips(status).length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-20"
                >
                  <div className="rounded-full bg-secondary p-4">
                    <MapPin className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No {status} trips yet
                  </p>
                  {status === 'planning' && (
                    <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
                      <Plus className="mr-1 h-4 w-4" />
                      Create your first trip
                    </Button>
                  )}
                </motion.div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <AnimatePresence>
                    {filterTrips(status).map((trip, i) => (
                      <TripCard
                        key={trip.id}
                        trip={trip}
                        index={i}
                        onUpdate={fetchTrips}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </main>

      <CreateTripDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={fetchTrips} />
    </div>
  );
};

export default Trips;
