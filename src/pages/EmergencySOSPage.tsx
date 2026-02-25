import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EmergencySOSPanel from '@/components/EmergencySOSPanel';

const EmergencySOSPage = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
                <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-red-700">
                                <ShieldAlert className="h-4 w-4 text-white" />
                            </div>
                            <div>
                                <h1 className="font-display text-base font-bold text-foreground">Emergency SOS</h1>
                                <p className="text-[11px] text-muted-foreground">Immediate help & nearby services</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <EmergencySOSPanel />
                </motion.div>
            </main>
        </div>
    );
};

export default EmergencySOSPage;
