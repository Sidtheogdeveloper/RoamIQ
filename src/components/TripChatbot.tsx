import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Loader2, Sparkles, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tables } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';

type ItineraryItem = Tables<'itinerary_items'>;

interface Props {
    destination: string;
    items: ItineraryItem[];
}

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

const TripChatbot = ({ destination, items }: Props) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([{
        role: 'assistant',
        content: `Hi there! I'm your AI assistant for ${destination}. You can ask me anything about your itinerary, packing lists, local customs, or travel tips!`
    }]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            // Quick DOM hack to scroll down the radix ScrollArea
            const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (viewport) {
                viewport.scrollTop = viewport.scrollHeight;
            }
        }
    }, [messages, isLoading, isOpen]);

    const handleSendMessage = async () => {
        if (!inputMessage.trim() || isLoading) return;

        const userMsg = inputMessage.trim();
        setInputMessage('');
        const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userMsg }];
        setMessages(newMessages);
        setIsLoading(true);

        try {
            // Map 'assistant' to 'model' for Gemini, 'user' to 'user'
            const payloadMessages = newMessages.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                content: m.content
            }));

            // We don't send the very first welcome message as it's hardcoded on frontend
            const messagesToSend = payloadMessages.slice(1);

            const { data, error } = await supabase.functions.invoke('trip-chat', {
                body: {
                    destination,
                    itineraryItems: items,
                    messages: messagesToSend
                }
            });

            if (error) {
                throw error;
            }

            if (data && data.response) {
                setMessages([...newMessages, { role: 'assistant', content: data.response }]);
            } else {
                throw new Error('No response from AI');
            }

        } catch (err) {
            console.error('Chat error:', err);
            setMessages([...newMessages, {
                role: 'assistant',
                content: 'I am so sorry, but I am having trouble connecting to the network right now. Please try asking again in a moment!'
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <AnimatePresence>
                {!isOpen && (
                    <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className="fixed bottom-6 right-6 z-50 shadow-2xl rounded-full"
                    >
                        <Button
                            onClick={() => setIsOpen(true)}
                            className="h-14 w-14 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-xl border-2 border-white/20"
                        >
                            <MessageCircle className="h-6 w-6 text-white absolute" />
                            <div className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse border border-white" />
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed bottom-6 right-6 z-50 w-80 sm:w-96 h-[500px] max-h-[80vh] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 shrink-0 flex items-center justify-between text-white">
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                    <MapPin className="h-4 w-4" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-sm">Trip Assistant</h3>
                                    <p className="text-[10px] text-white/80 flex items-center gap-1">
                                        <Sparkles className="h-2 w-2" /> Powered by AI
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="hover:bg-white/20 p-1.5 rounded-full transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                            <div className="flex flex-col gap-4">
                                {messages.map((msg, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${msg.role === 'user'
                                                    ? 'bg-blue-600 text-white rounded-br-none'
                                                    : 'bg-secondary text-foreground rounded-bl-none shadow-sm border border-border'
                                                }`}
                                        >
                                            {msg.content}
                                        </div>
                                    </motion.div>
                                ))}

                                {isLoading && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="flex justify-start"
                                    >
                                        <div className="bg-secondary border border-border rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-1">
                                            <motion.div className="w-1.5 h-1.5 bg-blue-500 rounded-full" animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} />
                                            <motion.div className="w-1.5 h-1.5 bg-blue-500 rounded-full" animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} />
                                            <motion.div className="w-1.5 h-1.5 bg-blue-500 rounded-full" animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} />
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        </ScrollArea>

                        {/* Input Area */}
                        < div className="p-3 bg-secondary/30 border-t border-border mt-auto" >
                            <form
                                onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                                className="relative flex items-center"
                            >
                                <Input
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    placeholder="Ask about your trip..."
                                    className="pr-10 bg-background border-border rounded-full"
                                    disabled={isLoading}
                                />
                                <Button
                                    type="submit"
                                    size="icon"
                                    disabled={!inputMessage.trim() || isLoading}
                                    className="absolute right-1 h-8 w-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    <Send className="h-3 w-3 ml-0.5" />
                                </Button>
                            </form>
                        </div >
                    </motion.div >
                )}
            </AnimatePresence >
        </>
    );
};

export default TripChatbot;
