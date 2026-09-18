import { useState, useEffect, useRef } from "react";
import {
  MessageCircle,
  X,
  Send,
  MapPin,
  Clock,
  Square,
  ShieldCheck,
  Phone,
  Compass,
  Loader2,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLiveLocation } from "@/hooks/useLiveLocation";
import LiveLocationMap from "./LiveLocationMap";
import { buildWhatsAppUrl } from "@/lib/distance";

interface ChatMessage {
  id: string;
  request_id: string;
  sender_id: string;
  sender_name: string;
  message: string;
  is_location_message: boolean;
  created_at: string;
}

interface InAppChatDrawerProps {
  requestId: string;
  currentUserId: string;
  currentUserName: string;
  partnerName: string;
  partnerPhone?: string;
  partnerWhatsapp?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function InAppChatDrawer({
  requestId,
  currentUserId,
  currentUserName,
  partnerName,
  partnerPhone,
  partnerWhatsapp,
  isOpen,
  onClose,
}: InAppChatDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    myLocation,
    partnerLocation,
    isSharing,
    timeLeftFormatted,
    liveDistanceKm,
    startLiveSharing,
    stopLiveSharing,
  } = useLiveLocation(requestId, currentUserId);

  // 1. Fetch initial chat messages
  useEffect(() => {
    if (!isOpen || !requestId) return;

    setLoadingMessages(true);
    (async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });

      setLoadingMessages(false);
      if (data) {
        setMessages(data as ChatMessage[]);
        scrollToBottom();
      }
    })();
  }, [isOpen, requestId]);

  // 2. Realtime Subscription on chat_messages
  useEffect(() => {
    if (!isOpen || !requestId) return;

    const channel = supabase
      .channel(`chat-messages-realtime-${requestId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `request_id=eq.${requestId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => [...prev, newMsg]);
          scrollToBottom();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, requestId]);

  function scrollToBottom() {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!inputText.trim() || !currentUserId) return;

    const msg = inputText.trim();
    setInputText("");

    const { error } = await supabase.from("chat_messages").insert({
      request_id: requestId,
      sender_id: currentUserId,
      sender_name: currentUserName,
      message: msg,
      is_location_message: false,
    });

    if (error) {
      toast.error("Failed to send message: " + error.message);
    }
  }

  function handleSelectDuration(durationMins: 15 | 60 | 480) {
    setShowDurationPicker(false);
    startLiveSharing(durationMins, currentUserName);
  }

  if (!isOpen) return null;

  const hasAnyLiveLocation = Boolean(myLocation || partnerLocation);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-card h-full shadow-2xl flex flex-col border-l border-border animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="p-4 border-b border-border/80 bg-accent/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-600 text-white font-black flex items-center justify-center text-base shadow-md">
              {partnerName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="font-extrabold text-foreground text-sm flex items-center gap-1.5">
                {partnerName}
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 border border-emerald-500/30">
                  Connected
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">In-App Live Chat & Location Sharing</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {partnerPhone && (
              <a
                href={`tel:${partnerPhone}`}
                className="p-2 rounded-xl bg-emerald-600/10 text-emerald-600 hover:bg-emerald-600/20 transition-colors"
                title="Call phone"
              >
                <Phone className="w-4 h-4" />
              </a>
            )}

            {partnerWhatsapp && (
              <a
                href={buildWhatsAppUrl(
                  partnerWhatsapp,
                  `Hello ${partnerName}, contacting you regarding blood request on BloodMap AI.`,
                )}
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-xl bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
                title="Open WhatsApp"
              >
                <MessageCircle className="w-4 h-4" />
              </a>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Location Action Bar */}
        <div className="p-3 bg-card border-b border-border space-y-2">
          <div className="flex items-center justify-between gap-2">
            {!isSharing ? (
              <Button
                size="sm"
                onClick={() => setShowDurationPicker(!showDurationPicker)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold gap-1.5 shadow-sm"
              >
                <MapPin className="w-3.5 h-3.5" /> Share Live Location
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  Live Sharing ({timeLeftFormatted})
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => stopLiveSharing(true)}
                  className="h-7 text-xs border-red-500/30 text-red-600 hover:bg-red-500/10 font-bold rounded-lg px-2"
                >
                  <Square className="w-3 h-3 mr-1 fill-red-600" /> Stop
                </Button>
              </div>
            )}

            {hasAnyLiveLocation && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMap(!showMap)}
                className="text-xs text-muted-foreground hover:text-foreground h-8"
              >
                <Compass className="w-3.5 h-3.5 mr-1" />
                {showMap ? "Hide Map" : "Show Map"}
              </Button>
            )}
          </div>

          {/* Duration Selector Popup Modal */}
          {showDurationPicker && (
            <div className="rounded-2xl bg-accent/60 p-3 border border-border space-y-2 animate-in fade-in duration-150">
              <span className="text-xs font-bold text-muted-foreground block">
                Select Live Location Sharing Duration:
              </span>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSelectDuration(15)}
                  className="rounded-xl text-xs font-bold hover:border-emerald-500 hover:bg-emerald-500/10"
                >
                  ⏱️ 15 Mins
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSelectDuration(60)}
                  className="rounded-xl text-xs font-bold hover:border-emerald-500 hover:bg-emerald-500/10"
                >
                  ⏱️ 1 Hour
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSelectDuration(480)}
                  className="rounded-xl text-xs font-bold hover:border-emerald-500 hover:bg-emerald-500/10"
                >
                  ⏱️ 8 Hours
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Live Distance & Interactive Map Section */}
        {hasAnyLiveLocation && showMap && (
          <div className="p-3 border-b border-border space-y-2 bg-muted/20">
            {liveDistanceKm !== null && (
              <div className="flex items-center justify-between text-xs px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 font-bold text-emerald-700 dark:text-emerald-300">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  Live Distance: {liveDistanceKm.toFixed(2)} km apart
                </span>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-600">
                  REALTIME
                </span>
              </div>
            )}
            <div className="h-44 w-full">
              <LiveLocationMap
                myLocation={myLocation}
                partnerLocation={partnerLocation}
                myLabel={currentUserName}
                partnerLabel={partnerName}
              />
            </div>
          </div>
        )}

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loadingMessages ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs">Loading live conversation…</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-xs space-y-1">
              <MessageCircle className="w-8 h-8 text-muted-foreground/30 mx-auto" />
              <p className="font-semibold">No messages yet.</p>
              <p>Send a message or share live location to start live coordination.</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender_id === currentUserId;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                >
                  <span className="text-[10px] font-semibold text-muted-foreground mb-1 px-1">
                    {isMine ? "You" : msg.sender_name}
                  </span>
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                      msg.is_location_message
                        ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-950 dark:text-emerald-200 font-medium"
                        : isMine
                          ? "bg-primary text-primary-foreground font-medium rounded-br-none shadow-sm"
                          : "bg-muted border border-border/60 text-foreground rounded-bl-none"
                    }`}
                  >
                    {msg.message}
                  </div>
                  <span className="text-[9px] text-muted-foreground/70 mt-1 px-1">
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Form */}
        <form
          onSubmit={handleSendMessage}
          className="p-3 border-t border-border bg-card flex gap-2"
        >
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            className="rounded-xl text-xs h-10 flex-1"
          />
          <Button
            type="submit"
            disabled={!inputText.trim()}
            className="rounded-xl h-10 w-10 p-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
