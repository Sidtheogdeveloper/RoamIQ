import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, Mail, Lock, User, ArrowRight, MapPin, Plane, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const FLOATING_ICONS = [
  { Icon: Plane, x: '12%', y: '18%', delay: 0, size: 'h-5 w-5' },
  { Icon: MapPin, x: '8%', y: '72%', delay: 0.5, size: 'h-4 w-4' },
  { Icon: Globe, x: '85%', y: '25%', delay: 1, size: 'h-6 w-6' },
  { Icon: Compass, x: '78%', y: '70%', delay: 1.5, size: 'h-5 w-5' },
  { Icon: Plane, x: '45%', y: '8%', delay: 2, size: 'h-4 w-4' },
];

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/trips');
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        toast({
          title: 'Check your email',
          description: 'We sent you a confirmation link to verify your account.',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden">
      {/* Full-screen background image */}
      <div className="absolute inset-0 z-0">
        <img
          src="/auth-bg.png"
          alt="Tropical paradise"
          className="h-full w-full object-cover"
        />
        {/* Gradient overlays for readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30" />
      </div>

      {/* Floating animated travel icons */}
      {FLOATING_ICONS.map(({ Icon, x, y, delay, size }, i) => (
        <motion.div
          key={i}
          className="absolute z-10 text-white/15"
          style={{ left: x, top: y }}
          animate={{
            y: [0, -15, 0],
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: 6,
            delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <Icon className={size} />
        </motion.div>
      ))}

      {/* Left panel — branding (visible on lg+) */}
      <div className="relative z-10 hidden flex-1 flex-col justify-between p-12 lg:flex">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md">
              <Compass className="h-6 w-6 text-white" />
            </div>
            <span className="font-display text-2xl font-bold text-white">RoamIQ</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="max-w-lg"
        >
          <h1 className="font-display text-5xl font-black leading-tight text-white">
            Your Next Adventure
            <br />
            <span className="bg-gradient-to-r from-teal-300 to-emerald-300 bg-clip-text text-transparent">
              Starts Here.
            </span>
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-white/70">
            AI-powered itinerary optimization with real-time weather,
            crowd analytics, and smart recommendations for every traveler.
          </p>

          {/* Feature pills */}
          <div className="mt-6 flex flex-wrap gap-2">
            {['🌦️ Weather Aware', '📊 Crowd Analytics', '👴 Elderly Mode', '👶 Child Mode', '🚨 Emergency SOS'].map(
              (tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur-sm"
                >
                  {tag}
                </span>
              )
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-xs text-white/40"
        >
          © 2026 RoamIQ — NextGen Hackathon
        </motion.div>
      </div>

      {/* Right panel — auth form */}
      <div className="relative z-10 flex w-full items-center justify-center px-4 py-12 lg:w-[480px] lg:px-0">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-[400px]"
        >
          {/* Mobile logo — visible only on small screens */}
          <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md">
              <Compass className="h-6 w-6 text-white" />
            </div>
            <h1 className="font-display text-2xl font-bold text-white">RoamIQ</h1>
            <p className="text-sm text-white/60">Smart Itinerary Optimizer</p>
          </div>

          {/* Glassmorphism card */}
          <div className="rounded-2xl border border-white/15 bg-white/10 p-7 shadow-2xl backdrop-blur-xl">
            {/* Auth mode toggle tabs */}
            <div className="mb-6 flex rounded-xl bg-white/10 p-1">
              <button
                onClick={() => setIsLogin(true)}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${isLogin
                    ? 'bg-white text-gray-900 shadow-md'
                    : 'text-white/60 hover:text-white/80'
                  }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${!isLogin
                    ? 'bg-white text-gray-900 shadow-md'
                    : 'text-white/60 hover:text-white/80'
                  }`}
              >
                Sign Up
              </button>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={isLogin ? 'login' : 'signup'}
                initial={{ opacity: 0, x: isLogin ? -10 : 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isLogin ? 10 : -10 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="mb-1 font-display text-xl font-bold text-white">
                  {isLogin ? 'Welcome back' : 'Create account'}
                </h2>
                <p className="mb-5 text-xs text-white/50">
                  {isLogin
                    ? 'Sign in to access your travel plans'
                    : 'Start planning your dream trip today'}
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {!isLogin && (
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-xs font-medium text-white/70">
                        Full Name
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                        <Input
                          id="name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Your name"
                          className="border-white/15 bg-white/10 pl-10 text-white placeholder:text-white/30 focus:border-teal-400/50 focus:ring-teal-400/20"
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-medium text-white/70">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="border-white/15 bg-white/10 pl-10 text-white placeholder:text-white/30 focus:border-teal-400/50 focus:ring-teal-400/20"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs font-medium text-white/70">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="border-white/15 bg-white/10 pl-10 text-white placeholder:text-white/30 focus:border-teal-400/50 focus:ring-teal-400/20"
                        required
                        minLength={6}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 font-semibold text-white shadow-lg shadow-teal-500/25 transition-all hover:from-teal-600 hover:to-emerald-600 hover:shadow-xl hover:shadow-teal-500/30"
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Processing...
                      </span>
                    ) : (
                      <>
                        {isLogin ? 'Sign In' : 'Create Account'}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </motion.div>
            </AnimatePresence>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] uppercase tracking-widest text-white/30">or continue with</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            {/* Social placeholder */}
            <div className="flex gap-3">
              <button className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white/80">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google
              </button>
              <button className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white/80">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                </svg>
                GitHub
              </button>
            </div>
          </div>

          {/* Bottom text */}
          <p className="mt-4 text-center text-[10px] text-white/30">
            By continuing, you agree to RoamIQ's Terms and Privacy Policy
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
