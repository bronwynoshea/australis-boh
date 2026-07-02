import React, { useEffect } from 'react';
import {
  X,
  MessageCircle,
  HelpCircle,
  ChevronUp,
  CheckCircle2,
  Hand,
  RefreshCw,
  UserMinus,
  UserPlus,
  Loader2,
  Plus,
  Send,
} from 'lucide-react';
import type { ChatMessage, Participant, SidebarTab } from '../types';
import type { HandRaiseRequest } from '@/hooks/useRaisedHands';
import { LoftRole, LoftPoll, LoftQuestion } from '@/types';
import AvatarCircle from '../../shared/AvatarCircle';

interface LoftSidebarProps {
  isOpen: boolean;
  sidebarTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onClose: () => void;
  messages: ChatMessage[];
  chatInput: string;
  onChatInputChange: (value: string) => void;
  onSendMessage: (event: React.FormEvent<HTMLFormElement>) => void;
  chatEndRef: React.RefObject<HTMLDivElement>;
  questions: LoftQuestion[];
  qaInput: string;
  onQaInputChange: (value: string) => void;
  onSendQuestion: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpvoteQuestion: (id: string) => void;
  isHost: boolean;
  polls: LoftPoll[];
  onVotePoll: (pollId: string, optionId: string) => void;
  showHandsTab?: boolean;
  handRaiseRequests?: HandRaiseRequest[];
  isHandsLoading?: boolean;
  onRefreshHands?: () => void;
  onPromoteHand?: (hand: HandRaiseRequest) => void;
  onDemoteStageMember?: (participant: Participant) => void;
  stageParticipants?: Participant[];
  formatTimeAgo?: (value?: string | number | null) => string;
}

const LoftSidebar: React.FC<LoftSidebarProps> = ({
  isOpen,
  sidebarTab,
  onTabChange,
  onClose,
  messages,
  chatInput,
  onChatInputChange,
  onSendMessage,
  chatEndRef,
  questions,
  qaInput,
  onQaInputChange,
  onSendQuestion,
  onUpvoteQuestion,
  isHost,
  polls,
  onVotePoll,
  showHandsTab = false,
  handRaiseRequests = [],
  isHandsLoading = false,
  onRefreshHands,
  onPromoteHand,
  onDemoteStageMember,
  stageParticipants = [],
  formatTimeAgo,
}) => {
  // Body scroll lock for iOS
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  const tabs: SidebarTab[] = showHandsTab ? ['chat', 'qa', 'polls', 'queue'] as SidebarTab[] : ['chat', 'qa', 'polls'];
  const formatTime = (value?: string | number | null) => {
    if (formatTimeAgo) return formatTimeAgo(value);
    if (!value) return 'Just now';
    const numericValue =
      typeof value === 'number'
        ? value
        : /^\d+$/.test(String(value))
          ? Number(value)
          : undefined;
    const dateValue = numericValue ?? Date.parse(String(value));
    if (Number.isNaN(dateValue)) return 'Just now';
    const diff = Math.floor((Date.now() - dateValue) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const renderHandsTab = () => {
    return (
    <div className="space-y-6">
      <div className="loft-glass rounded-[1.5rem] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-main/50 dark:text-white/50">
            On Stage
          </div>
          <span className="text-[10px] font-black text-main/40 dark:text-white/40">
            {stageParticipants.length} active
          </span>
        </div>
        {stageParticipants.length === 0 ? (
          <div className="py-6 text-center text-[11px] font-semibold text-main/40 dark:text-white/40">
            No one is on stage right now.
          </div>
        ) : (
          <div className="space-y-3">
            {stageParticipants.map((participant) => (
              <div
                key={`${participant.profileId || participant.userId || participant.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-black/5 dark:border-white/10 px-3 py-2"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <AvatarCircle
                    avatarUrl={participant.avatarUrl}
                    name={participant.name}
                    className="w-10 h-10 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10"
                    initialsClassName="text-xs font-black uppercase tracking-widest text-main/40 dark:text-white/40"
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-main dark:text-white truncate">{participant.name}</p>
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-main/40 dark:text-white/40">
                      {participant.role}
                    </p>
                  </div>
                </div>
                {onDemoteStageMember && participant.role !== ('host' as LoftRole) && (
                  <button
                    type="button"
                    onClick={() => onDemoteStageMember(participant)}
                    className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl bg-black/5 dark:bg-white/10 text-main/60 dark:text-white/60 hover:text-main dark:hover:text-white transition-colors"
                  >
                    <UserMinus className="w-3 h-3" />
                    Demote
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="loft-glass rounded-[1.5rem] p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-main/50 dark:text-white/50">
              Hands Queue
            </span>
            {handRaiseRequests.length > 0 && (
              <span className="text-[11px] font-bold text-main/40 dark:text-white/40">
                {handRaiseRequests.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isHandsLoading && <Loader2 className="w-4 h-4 animate-spin text-main/40 dark:text-white/40" />}
            {onRefreshHands && (
              <button
                type="button"
                onClick={onRefreshHands}
                className="text-[10px] font-black uppercase tracking-[0.2em] text-cafe hover:text-cafe/80 transition-colors"
              >
                Refresh
              </button>
            )}
          </div>
        </div>
        {handRaiseRequests.length === 0 ? (
          <div className="py-8 text-center text-main/40 dark:text-white/40 text-[11px] font-semibold flex flex-col items-center gap-2">
            <Hand className="w-8 h-8 text-main/20 dark:text-white/20" />
            No raised hands right now.
          </div>
        ) : (
          <div className="space-y-3">
            {handRaiseRequests.map((request) => (
              <div
                key={`${request.profileId || request.userId || request.displayName}-${request.raisedAt || ''}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-black/5 dark:border-white/10 px-3 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <AvatarCircle
                    avatarUrl={request.avatarUrl}
                    name={request.displayName}
                    className="w-10 h-10 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10"
                    initialsClassName="text-xs font-black uppercase tracking-widest text-main/40 dark:text-white/40"
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-main dark:text-white truncate">
                      {request.displayName}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-main/40 dark:text-white/40">
                      {formatTime(request.raisedAt)}
                    </p>
                  </div>
                </div>
                {onPromoteHand && (
                  <button
                    type="button"
                    onClick={() => onPromoteHand(request)}
                    className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl bg-cafe text-white shadow-lg hover:bg-cafe/90 transition-colors"
                  >
                    <UserPlus className="w-3 h-3" />
                    Promote
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    );
  };

  return (
    <>
      {/* Backdrop - only render when open on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-transparent md:hidden z-[1100]"
          onClick={onClose}
          style={{ touchAction: 'none' }}
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`
          loft-glass-strong fixed z-[1101] flex flex-col transition-all duration-300 ease-out overflow-y-auto
          md:top-0 md:bottom-0 md:right-0 md:left-auto md:h-full md:w-[400px]
          top-auto bottom-0 left-0 right-0 h-[52vh] rounded-t-[2.5rem] md:rounded-none
          ${isOpen ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-x-full'}
        `}
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingRight: 'env(safe-area-inset-right)',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
        }}
      >
      <div className="flex-none loft-glass border-b border-black/5 dark:border-white/10 pt-4 md:pt-16 flex items-center px-4 rounded-t-[2.5rem] md:rounded-none sticky top-0 z-10">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${
              sidebarTab === tab ? 'text-cafe' : 'text-main/40 dark:text-white/30 hover:text-main/70 dark:hover:text-white/60'
            }`}
            style={{ touchAction: 'manipulation', minHeight: '44px' }}
          >
            {tab === 'chat' ? 'Chat' : tab === 'qa' ? 'Q&A' : tab === 'polls' ? 'Polls' : 'Queue'}
            {sidebarTab === tab && <div className="absolute bottom-0 left-0 right-0 h-1 bg-cafe rounded-t-full shadow-[0_-4px_10px_rgba(37,99,235,0.4)]" />}
          </button>
        ))}
        <button 
          onClick={onClose} 
          className="p-4 text-main/30 hover:text-main/60 dark:text-white/20 dark:hover:text-white/50 transition-colors"
          style={{ touchAction: 'manipulation', minWidth: '44px', minHeight: '44px' }}
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 no-scrollbar text-main dark:text-white">
        {sidebarTab === 'chat' && (
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="py-20 text-center space-y-4 text-main dark:text-white/80">
                <MessageCircle className="w-12 h-12 text-main/10 dark:text-white/20 mx-auto" />
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-main/40 dark:text-white/50">The chat is quiet...</p>
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2`}>
                <span className="text-[8px] font-bold text-main/50 dark:text-white/60 uppercase tracking-widest mb-1">{msg.userName}</span>
                <div className={`max-w-[85%] px-4 py-3 rounded-[1.2rem] text-[13px] leading-relaxed ${msg.isMe ? 'bg-cafe text-white rounded-tr-none shadow-lg' : 'loft-glass text-main dark:text-white rounded-tl-none'}`}>{msg.text}</div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        )}

        {sidebarTab === 'qa' && (
          <div className="space-y-6">
            {questions.length === 0 && (
              <div className="py-20 text-center space-y-4 text-main dark:text-white/80">
                <HelpCircle className="w-12 h-12 text-main/10 dark:text-white/20 mx-auto" />
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-main/40 dark:text-white/50">No questions in the queue</p>
              </div>
            )}
            {questions.map(q => (
              <div key={q.id} className="loft-glass rounded-[1.5rem] p-5 space-y-4 group transition-all hover:border-cafe/30">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <p className="text-[13px] font-medium text-main dark:text-white leading-relaxed">{q.text}</p>
                    <span className="block text-[8px] font-black uppercase tracking-widest text-main/50 dark:text-white/50">{(q as any).userName}</span>
                  </div>
                  <button
                    onClick={() => onUpvoteQuestion(q.id)}
                    className={`flex flex-col items-center rounded-xl px-2 py-2 transition-all active:scale-95 ${(q as any).upvotes > 0 ? 'bg-cafe text-white shadow-lg' : 'loft-glass text-main/60 dark:text-white/70 hover:border-cafe hover:text-cafe'}`}
                  >
                    <ChevronUp className="w-4 h-4" />
                    <span className="text-[10px] font-black">{(q as any).upvotes || 0}</span>
                  </button>
                </div>
                {isHost && !(q as any).isAnswered && (
                  <button className="w-full py-2.5 bg-green-500/10 border border-green-500/20 text-green-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-green-500/20 transition-all">
                    Mark as Answered
                  </button>
                )}
                {(q as any).isAnswered && (
                  <div className="flex items-center gap-2 text-green-500 text-[9px] font-black uppercase tracking-widest">
                    <CheckCircle2 className="w-3 h-3" /> Answered
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {sidebarTab === 'polls' && (
          <div className="space-y-6">
            {polls.map((poll: any) => (
              <div key={poll.id} className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-[2rem] p-6 space-y-6 shadow-xl">
                <div className="space-y-2">
                  <h4 className="text-[14px] font-black uppercase tracking-tight text-main dark:text-white leading-tight">{poll.question}</h4>
                  <span className="text-[9px] font-bold text-main/40 dark:text-white/20 uppercase tracking-widest">{poll.totalVotes || 0} Votes Total</span>
                </div>
                <div className="space-y-3">
                  {(poll.options || []).map((opt: any) => {
                    const totalVotes = poll.totalVotes || 0;
                    const pct = totalVotes > 0 ? Math.round(((opt.votes || 0) / totalVotes) * 100) : 0;
                    return (
                      <button
                        key={opt.id}
                        disabled={!!poll.hasVoted}
                        onClick={() => onVotePoll(poll.id, opt.id)}
                        className={`w-full group relative overflow-hidden rounded-xl border transition-all ${poll.hasVoted ? 'bg-black/10 dark:bg-black/20 border-black/5 dark:border-white/5' : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 hover:border-cafe/50 active:scale-95'}`}
                      >
                        <div
                          className={`absolute left-0 top-0 bottom-0 transition-all duration-1000 ${poll.hasVoted ? 'bg-cafe/30' : 'bg-transparent'}`}
                          style={{ width: poll.hasVoted ? `${pct}%` : '0%' }}
                        />
                        <div className="relative px-4 py-3.5 flex items-center justify-between">
                          <span className={`text-[11px] font-bold tracking-wide transition-colors ${poll.hasVoted ? 'text-main dark:text-white' : 'text-main/50 dark:text-white/40 group-hover:text-main dark:group-hover:text-white'}`}>{opt.text}</span>
                          {poll.hasVoted && <span className="text-[10px] font-black text-cafe">{pct}%</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {isHost && (
              <button className="w-full py-4 border-2 border-dashed border-white/5 rounded-[1.5rem] flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/10 hover:text-cafe hover:border-cafe/50 transition-all">
                <Plus className="w-4 h-4" /> Start New Sentiment Poll
              </button>
            )}
            <div className="text-center py-4 text-[8px] font-black uppercase tracking-[0.3em] text-main/30 dark:text-white/10">
              POLL RESULTS WILL APPEAR HERE
            </div>
          </div>
        )}

        {sidebarTab === 'queue' && showHandsTab && renderHandsTab()}
      </div>

      {(sidebarTab === 'chat' || sidebarTab === 'qa') && (
        <div className="flex-none p-5 loft-glass-strong border-t border-black/5 dark:border-white/10 pb-10 md:pb-8 md:rounded-none">
        {sidebarTab === 'chat' ? (
          <form onSubmit={onSendMessage} className="relative">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => onChatInputChange(e.target.value)}
              placeholder="Message everyone..."
              className="w-full loft-glass text-xs font-medium text-main dark:text-white rounded-2xl pl-5 pr-14 py-4 outline-none focus:ring-2 focus:ring-cafe/30 transition-all placeholder:text-main/50 dark:placeholder:text-white/50"
            />
            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-cafe text-white rounded-xl shadow-lg active:scale-90 transition-transform">
              <Send className="w-4 h-4" />
            </button>
          </form>
        ) : sidebarTab === 'qa' ? (
          <form onSubmit={onSendQuestion} className="relative">
            <input
              type="text"
              value={qaInput}
              onChange={(e) => onQaInputChange(e.target.value)}
              placeholder="Ask the host a question..."
              className="w-full loft-glass text-xs font-medium text-main dark:text-white rounded-2xl pl-5 pr-14 py-4 outline-none focus:ring-2 focus:ring-cafe/30 transition-all placeholder:text-main/50 dark:placeholder:text-white/50"
            />
            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-cafe text-white rounded-xl shadow-lg active:scale-90 transition-transform">
              <HelpCircle className="w-4 h-4" />
            </button>
          </form>
        ) : null}
        </div>
      )}
    </aside>
    </>
  );
};

export default LoftSidebar;
