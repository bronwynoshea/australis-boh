import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, Send } from 'lucide-react';
import { useSupabaseUser } from '@/services/supabaseApi';

interface ChatMessage {
  id: string;
  userName: string;
  text: string;
  timestamp: string;
  isMe: boolean;
}

interface PersonalRoomSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  callObject: any;
}

const PersonalRoomSidebar: React.FC<PersonalRoomSidebarProps> = ({
  isOpen,
  onClose,
  callObject,
}) => {
  const { profile } = useSupabaseUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const maxMessageLength = 1200;
  const remainingCharacters = maxMessageLength - chatInput.length;
  const currentUserName = useMemo(() => profile?.name || 'You', [profile?.name]);

  const createMessageId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  };

  // Listen for incoming chat messages via Daily app-message
  // Keep listener active even when sidebar is closed so messages are received
  useEffect(() => {
    if (!callObject) return;
    
    const handleAppMessage = (ev: any) => {
      if (!ev?.data || ev.data.type !== 'chat') return;
      const { userName, text, timestamp } = ev.data;
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          userName: userName || 'Guest',
          text,
          timestamp: timestamp || 'Just now',
          isMe: false,
        },
      ]);
    };
    
    callObject.on('app-message', handleAppMessage);
    return () => {
      callObject.off('app-message', handleAppMessage);
    };
  }, [callObject]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = chatInput.trim();
    if (!trimmedMessage) return;
    if (!callObject) {
      setSendError('Chat is not connected yet. Rejoin the session and try again.');
      return;
    }
    if (trimmedMessage.length > maxMessageLength) {
      setSendError(`Messages must be ${maxMessageLength} characters or fewer.`);
      return;
    }

    const messagePayload = {
      type: 'chat',
      userName: currentUserName,
      text: trimmedMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Broadcast to all participants
    try {
      callObject.sendAppMessage(messagePayload, '*');
      setSendError(null);
    } catch {
      setSendError('Message could not be delivered. Check your connection and try again.');
      return;
    }

    // Add to local UI immediately
    setMessages((prev) => [
      ...prev,
      {
        id: createMessageId(),
        userName: messagePayload.userName,
        text: messagePayload.text,
        timestamp: messagePayload.timestamp,
        isMe: true,
      },
    ]);
    setChatInput('');
  };

  if (!isOpen) return null;

  return (
    <aside
      role="dialog"
      aria-modal="true"
      aria-label="Session chat"
      className="fixed inset-x-0 bottom-0 z-[1500] flex max-h-[82vh] w-full flex-col rounded-t-2xl border-t border-[var(--loft-border)] bg-[var(--loft-surface)] shadow-2xl backdrop-blur-xl md:inset-x-auto md:inset-y-0 md:right-0 md:max-h-none md:max-w-sm md:rounded-none md:border-l md:border-t-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--loft-border)] bg-[var(--loft-surface)]">
        <div>
          <h3 className="text-lg font-bold text-[var(--loft-text)]">Chat</h3>
          <p className="text-[11px] font-semibold text-[var(--loft-text-subtle)]">
            Visible to everyone in this session.
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-[var(--loft-surface)] rounded-lg transition-colors"
          aria-label="Close chat"
        >
          <X className="w-5 h-5 text-[var(--loft-text-subtle)]" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar text-[var(--loft-text)]">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[var(--loft-text-subtle)] text-sm text-center">
              No messages yet.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs px-4 py-2 rounded-lg ${
                  message.isMe
                    ? 'bg-cafe text-white rounded-br-none'
                    : 'bg-[var(--loft-surface)] text-[var(--loft-text)] rounded-bl-none border border-[var(--loft-border)]'
                }`}
              >
                {!message.isMe && (
                  <p className="text-xs font-bold text-[var(--loft-text-subtle)] mb-1">
                    {message.userName}
                  </p>
                )}
                <p className="text-sm break-words">{message.text}</p>
                <p className="text-xs opacity-70 mt-1">{message.timestamp}</p>
              </div>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[var(--loft-border)] p-4 bg-[var(--loft-surface)]">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <div className="min-w-0 flex-1">
            <textarea
            value={chatInput}
              onChange={(e) => {
                setChatInput(e.target.value.slice(0, maxMessageLength));
                setSendError(null);
              }}
              placeholder="Message everyone..."
              rows={1}
              className="max-h-28 min-h-11 w-full resize-none rounded-lg border border-[var(--loft-border)] bg-[var(--loft-surface)] px-3 py-2 text-sm text-[var(--loft-text)] placeholder-[var(--loft-text-subtle)] focus:border-cafe focus:outline-none"
              aria-label="Message everyone"
            />
            <div className="mt-1 flex items-center justify-between gap-3 text-[10px] font-semibold text-[var(--loft-text-subtle)]">
              <span role={sendError ? 'alert' : undefined} className={sendError ? 'text-red-500' : ''}>
                {sendError || 'Messages are visible to current participants and are not saved after the session ends.'}
              </span>
              <span className={remainingCharacters < 120 ? 'text-amber-500' : ''}>
                {remainingCharacters} characters left
              </span>
            </div>
          </div>
          <button
            type="submit"
            className="h-11 w-11 shrink-0 rounded-lg bg-cafe text-white transition-colors hover:bg-cafe/90 disabled:opacity-50"
            disabled={!chatInput.trim() || !!sendError}
            aria-label="Send message"
          >
            <Send className="mx-auto h-5 w-5" />
          </button>
        </form>
      </div>
    </aside>
  );
};

export default PersonalRoomSidebar;
