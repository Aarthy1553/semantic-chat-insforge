'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@insforge/sdk';

const insforge = createClient({
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
  anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
});

interface Message {
  id: string;
  room_id: string;
  content: string;
  created_at: string;
}

interface SearchResult {
  id: string;
  content: string;
  created_at: string;
  similarity: number;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [roomId, setRoomId] = useState('general');
  const [inputRoom, setInputRoom] = useState('general');
  const [msgText, setMsgText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState('disconnected');
  const [sending, setSending] = useState(false);
  const [searching, setSearching] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  const loadHistory = useCallback(async (room: string) => {
    const res = await fetch(`/api/messages/${encodeURIComponent(room)}`);
    const body = await res.json();
    setMessages((body.messages || []).reverse());
  }, []);

  const connectRealtime = useCallback(async (room: string) => {
    setStatus('connecting...');
    await insforge.realtime.connect();
    await insforge.realtime.subscribe(`room:${room}`);
    insforge.realtime.on('NEW_message', (payload: Message) => {
      setMessages(prev => [...prev, payload]);
    });
    insforge.realtime.on('connect', () => setStatus(`connected · room:${room}`));
    insforge.realtime.on('disconnect', () => setStatus('disconnected'));
  }, []);

  const joinRoom = useCallback(async (room: string) => {
    insforge.realtime.disconnect();
    setMessages([]);
    setRoomId(room);
    await loadHistory(room);
    await connectRealtime(room);
  }, [loadHistory, connectRealtime]);

  useEffect(() => { joinRoom('general'); }, [joinRoom]);
  useEffect(() => { scrollToBottom(); }, [messages]);

  const sendMessage = async () => {
    if (!msgText.trim() || sending) return;
    setSending(true);
    setMsgText('');
    try {
      await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId, content: msgText.trim() }),
      });
    } finally { setSending(false); }
  };

  const doSearch = async () => {
    if (!searchQuery.trim() || searching) return;
    setSearching(true);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery.trim(), room_id: roomId }),
      });
      const body = await res.json();
      setSearchResults(body.results || []);
    } finally { setSearching(false); }
  };

  const isConnected = status.startsWith('connected');

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-200">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-4 bg-slate-800 border-b border-slate-700">
        <h1 className="text-sky-400 font-bold text-lg">💬 Semantic Chat</h1>
        <input
          className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
          value={inputRoom} onChange={e => setInputRoom(e.target.value)}
          placeholder="Room ID"
          onKeyDown={e => e.key === 'Enter' && joinRoom(inputRoom.trim() || 'general')}
        />
        <button
          onClick={() => joinRoom(inputRoom.trim() || 'general')}
          className="px-4 py-2 bg-sky-400 text-slate-900 rounded-lg font-semibold text-sm hover:bg-sky-300"
        >Join</button>
        <span className={`text-xs ${isConnected ? 'text-green-400' : 'text-slate-500'}`}>● {status}</span>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Chat panel */}
        <section className="flex flex-col flex-1">
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
            {messages.map(m => (
              <div key={m.id} className="bg-slate-800 rounded-xl px-4 py-3 max-w-[80%]">
                <div className="text-xs text-slate-500 mb-1">
                  {new Date(m.created_at).toLocaleTimeString()} · {m.room_id}
                </div>
                <div className="text-sm">{m.content}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="flex gap-2 p-3 bg-slate-800 border-t border-slate-700">
            <input
              className="flex-1 px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              value={msgText} onChange={e => setMsgText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Type a message…"
            />
            <button
              onClick={sendMessage} disabled={sending}
              className="px-5 py-2 bg-indigo-500 text-white rounded-lg font-semibold text-sm hover:bg-indigo-400 disabled:opacity-50"
            >{sending ? '…' : 'Send'}</button>
          </div>
        </section>

        {/* Search panel */}
        <aside className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col p-4 gap-3">
          <h2 className="text-slate-400 font-semibold text-sm">🔍 Semantic Search</h2>
          <input
            className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            placeholder="Search messages…"
          />
          <button
            onClick={doSearch} disabled={searching}
            className="py-2 bg-sky-500 text-white rounded-lg font-semibold text-sm hover:bg-sky-400 disabled:opacity-50"
          >{searching ? 'Searching…' : 'Search'}</button>
          <div className="flex flex-col gap-2 overflow-y-auto">
            {searchResults.length === 0 && <p className="text-slate-500 text-xs">No results yet.</p>}
            {searchResults.map(r => (
              <div key={r.id} className="bg-slate-900 rounded-lg p-3 border border-slate-700 text-sm">
                <p>{r.content}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {new Date(r.created_at).toLocaleTimeString()} · similarity: {r.similarity.toFixed(3)}
                </p>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}