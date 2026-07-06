import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';

import { useAuth } from './auth/AuthContext';
import { API_BASE, requestJson } from './lib/auth';

type WorkspaceSummary = { id: string; name: string; slug: string; role: string; createdAt: string };
type DocumentSummary = {
  id: string;
  filename: string;
  mimeType: string;
  status: string;
  textLength: number;
  createdAt: string;
};
type ChatSession = { id: string; title: string | null; createdAt: string };
type Citation = { documentId: string; source: string; citation: string; score?: number };
type ChatMessage = {
  id: string;
  role: string;
  content: string;
  citations?: Citation[];
  toolEvents?: unknown[];
};
type Task = { id: string; title: string; description?: string; status: string; createdAt: string };
type ToolLog = {
  id: string;
  toolName: string;
  status: string;
  error?: string;
  createdAt: string;
  input?: unknown;
  output?: unknown;
};
type RetrievedChunk = {
  id: string;
  source: string;
  citation: string;
  score: number;
  rrfScore?: number;
  similarity?: number;
  content: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Markdown renderer (simple) ───────────────────────────────────────────────
function friendlyStreamError(raw: string): string {
  if (raw.includes('429')) {
    return 'The AI model has hit its free-tier usage limit for now (Gemini quota exceeded). Please try again in a few minutes, or later today once the daily quota resets.';
  }
  return `Something went wrong while generating a response: ${raw}`;
}
function renderMarkdown(text: string): React.ReactElement {
  const lines = text.split('\n');
  const elements: React.ReactElement[] = [];
  let key = 0;

  for (const line of lines) {
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={key++} className="text-base font-semibold mt-3 mb-1">
          {line.slice(4)}
        </h3>,
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={key++} className="text-lg font-semibold mt-4 mb-1">
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith('# ')) {
      elements.push(
        <h1 key={key++} className="text-xl font-bold mt-4 mb-2">
          {line.slice(2)}
        </h1>,
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <li key={key++} className="ml-4 list-disc text-slate-300">
          {line.slice(2)}
        </li>,
      );
    } else if (line.startsWith('**') && line.endsWith('**')) {
      elements.push(
        <p key={key++} className="font-semibold">
          {line.slice(2, -2)}
        </p>,
      );
    } else if (line.trim() === '') {
      elements.push(<div key={key++} className="h-2" />);
    } else {
      elements.push(
        <p key={key++} className="text-slate-300 leading-relaxed">
          {line}
        </p>,
      );
    }
  }

  return <div className="space-y-0.5">{elements}</div>;
}

function CitationBadge({ citation }: { citation: Citation }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded bg-cyan-900/50 border border-cyan-700/40 px-2 py-0.5 text-xs text-cyan-300"
      title={citation.source}
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      {citation.citation}
      {typeof citation.score === 'number' && (
        <span className="text-cyan-500/70">({(citation.score * 100).toFixed(0)}%)</span>
      )}
    </span>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const isError = !isUser && message.content.startsWith('⚠️');
  const citations = message.citations ?? [];
  const toolEvents = message.toolEvents ?? [];

  return (
    <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-3 text-sm ${
          isUser
            ? 'bg-cyan-600 text-white'
            : isError
              ? 'bg-amber-950/40 border border-amber-700/50 text-amber-200'
              : 'bg-slate-800 border border-slate-700 text-slate-100'
        }`}
      >
        {isUser ? <p>{message.content}</p> : renderMarkdown(message.content)}
      </div>
      {citations.length > 0 && (
        <div className="flex flex-wrap gap-1 max-w-[85%]">
          {citations.map((c, i) => (
            <CitationBadge key={i} citation={c} />
          ))}
        </div>
      )}
      {toolEvents.length > 0 && (
        <div className="max-w-[85%] text-xs text-slate-500">
          🔧 {toolEvents.length} tool call{toolEvents.length > 1 ? 's' : ''} executed
        </div>
      )}
    </div>
  );
}

function Home() {
  const { user, loading, login, logout, register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<ToolLog[]>([]);
  const [debugQuery, setDebugQuery] = useState('');
  const [debugChunks, setDebugChunks] = useState<RetrievedChunk[]>([]);
  const [status, setStatus] = useState('Sign in to open your dashboard.');
  const [isBusy, setIsBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'documents' | 'tasks' | 'tools' | 'debug'>(
    'chat',
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  const loadWorkspaces = useCallback(async () => {
    const payload = await requestJson<{
      success: boolean;
      data: { workspaces: WorkspaceSummary[] };
    }>('/api/workspaces');
    const next = payload.data.workspaces;
    setWorkspaces(next);
    if (!selectedWorkspaceId && next[0]) {
      setSelectedWorkspaceId(next[0].id);
    }
  }, [selectedWorkspaceId]);

  const loadWorkspaceData = useCallback(
    async (workspaceId: string) => {
      const [docs, chat, taskPayload, logPayload] = await Promise.all([
        requestJson<{ success: boolean; data: { documents: DocumentSummary[] } }>(
          `/api/workspaces/${workspaceId}/documents`,
        ),
        requestJson<{ success: boolean; data: { sessions: ChatSession[] } }>(
          `/api/workspaces/${workspaceId}/chat/sessions`,
        ),
        requestJson<{ success: boolean; data: { tasks: Task[] } }>(
          `/api/workspaces/${workspaceId}/tasks`,
        ),
        requestJson<{ success: boolean; data: { logs: ToolLog[] } }>(
          `/api/workspaces/${workspaceId}/tools/logs/list`,
        ),
      ]);
      setDocuments(docs.data.documents);
      setSessions(chat.data.sessions);
      setTasks(taskPayload.data.tasks);
      setLogs(logPayload.data.logs);
      if (!selectedSessionId && chat.data.sessions[0]) {
        setSelectedSessionId(chat.data.sessions[0].id);
      }
    },
    [selectedSessionId],
  );

  const loadSessionMessages = useCallback(async (workspaceId: string, sessionId: string) => {
    const payload = await requestJson<{ success: boolean; data: { messages: ChatMessage[] } }>(
      `/api/workspaces/${workspaceId}/chat/sessions/${sessionId}/messages`,
    );
    setMessages(payload.data.messages);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setWorkspaces([]);
      setDocuments([]);
      setSessions([]);
      setMessages([]);
      setSelectedWorkspaceId('');
      setSelectedSessionId('');
      return;
    }

    void loadWorkspaces()
      .then(() => setStatus('Dashboard ready.'))
      .catch((error) =>
        setStatus(error instanceof Error ? error.message : 'Unable to load workspaces'),
      );
  }, [loadWorkspaces, loading, user]);

  useEffect(() => {
    if (selectedWorkspaceId) {
      void loadWorkspaceData(selectedWorkspaceId).catch((error) =>
        setStatus(error instanceof Error ? error.message : 'Unable to load workspace'),
      );
    }
  }, [loadWorkspaceData, selectedWorkspaceId]);

  useEffect(() => {
    if (selectedWorkspaceId && selectedSessionId) {
      void loadSessionMessages(selectedWorkspaceId, selectedSessionId);
    }
  }, [loadSessionMessages, selectedSessionId, selectedWorkspaceId]);

  const authAction = async (mode: 'login' | 'register') => {
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setStatus('Enter a valid email address.');
      return;
    }

    if (mode === 'register' && !trimmedName) {
      setStatus('Name is required.');
      return;
    }

    if (mode === 'register' && password.length < 8) {
      setStatus('Password must be at least 8 characters.');
      return;
    }

    setIsBusy(true);
    try {
      if (mode === 'register') {
        await register({ email: trimmedEmail, password, name: trimmedName });
      } else {
        await login({ email: trimmedEmail, password });
      }
      setStatus('Signed in.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setIsBusy(false);
    }
  };

  const signOut = async () => {
    await logout();
    setWorkspaces([]);
    setDocuments([]);
    setSessions([]);
    setMessages([]);
    setSelectedWorkspaceId('');
    setSelectedSessionId('');
    setStatus('Signed out.');
  };

  const createWorkspace = async () => {
    if (!workspaceName.trim()) return;
    const payload = await requestJson<{ success: boolean; data: { workspace: WorkspaceSummary } }>(
      '/api/workspaces',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: workspaceName.trim() }),
      },
    );
    setWorkspaceName('');
    setSelectedWorkspaceId(payload.data.workspace.id);
    await loadWorkspaces();
  };

  const uploadDocument = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedWorkspaceId) return;
    const formData = new FormData();
    formData.append('file', file);
    setStatus(`Uploading ${file.name}...`);
    try {
      await requestJson(`/api/workspaces/${selectedWorkspaceId}/documents`, {
        method: 'POST',
        body: formData,
      });
      await loadWorkspaceData(selectedWorkspaceId);
      setStatus(`${file.name} uploaded.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Upload failed');
    }
    event.target.value = '';
  };

  const createChatSession = async () => {
    if (!selectedWorkspaceId) return;
    const payload = await requestJson<{ success: boolean; data: { session: ChatSession } }>(
      `/api/workspaces/${selectedWorkspaceId}/chat/sessions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New chat' }),
      },
    );
    setSelectedSessionId(payload.data.session.id);
    await loadWorkspaceData(selectedWorkspaceId);
    setMessages([]);
  };

  const sendMessage = async () => {
    if (!selectedWorkspaceId || !selectedSessionId || !messageDraft.trim() || isStreaming) return;
    const content = messageDraft.trim();
    setMessageDraft('');
    setIsStreaming(true);
    setStreamingContent('');

    // Optimistically add user message
    const tempUserMsg: ChatMessage = { id: `tmp-${Date.now()}`, role: 'user', content };
    setMessages((prev) => [...prev, tempUserMsg]);

    const abort = new AbortController();
    abortRef.current = abort;

    let streamCitations: Citation[] = [];

    try {
      const response = await globalThis.fetch(
        `${API_BASE}/api/workspaces/${selectedWorkspaceId}/chat/sessions/${selectedSessionId}/stream`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ content }),
          signal: abort.signal,
        },
      );

      if (!response.ok || !response.body) {
        throw new Error('Stream request failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';
      let currentEvent = 'message';
      let streamError: string | null = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));

              if (currentEvent === 'error') {
                streamError = friendlyStreamError(
                  typeof parsed.message === 'string' ? parsed.message : 'Unknown error',
                );
              } else if (currentEvent === 'token' && parsed.text !== undefined) {
                accumulatedText += parsed.text as string;
                setStreamingContent(accumulatedText);
              } else if (currentEvent === 'citations' && Array.isArray(parsed)) {
                streamCitations = parsed as Citation[];
              } else if (currentEvent === 'tool_event') {
                // tool_event — extend here if you want to show it live
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }

      // Replace streaming content with final message from history
      setStreamingContent('');

      if (streamError) {
        // Backend didn't persist a message on error, so show it locally
        setMessages((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, role: 'assistant', content: `⚠️ ${streamError}` },
        ]);
      } else {
        await loadSessionMessages(selectedWorkspaceId, selectedSessionId);
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setStatus(error instanceof Error ? error.message : 'Message failed');
        // Fallback to non-streaming
        try {
          await requestJson(
            `/api/workspaces/${selectedWorkspaceId}/chat/sessions/${selectedSessionId}/messages`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content }),
            },
          );
          void streamCitations;
          await loadSessionMessages(selectedWorkspaceId, selectedSessionId);
        } catch {
          setStatus('Message failed');
        }
      }
      setStreamingContent('');
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const runDebug = async () => {
    if (!selectedWorkspaceId || !debugQuery.trim()) return;
    const payload = await requestJson<{ success: boolean; data: { chunks: RetrievedChunk[] } }>(
      `/api/workspaces/${selectedWorkspaceId}/retrieval/debug`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: debugQuery.trim() }),
      },
    );
    setDebugChunks(payload.data.chunks);
  };

  const saveTask = async () => {
    if (!selectedWorkspaceId) return;
    await requestJson(`/api/workspaces/${selectedWorkspaceId}/tools/save_task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Review answer quality',
        description: 'Created from dashboard tool call.',
      }),
    });
    await loadWorkspaceData(selectedWorkspaceId);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-400">
        Loading...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <section className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-cyan-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-semibold text-white">Document Assistant</h1>
            </div>
            <p className="text-slate-400 text-sm">Multi-workspace RAG + AI assistant</p>
          </div>
          <div className="space-y-3">
            <input
              id="auth-name"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              placeholder="Name (for sign up)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              id="auth-email"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              placeholder="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              id="auth-password"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              placeholder="Password"
              type="password"
              minLength={8}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void authAction('login')}
            />
          </div>
          <div className="mt-5 flex gap-3">
            <button
              id="btn-sign-in"
              className="flex-1 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition-colors"
              disabled={isBusy}
              onClick={() => void authAction('login')}
            >
              Sign in
            </button>
            <button
              id="btn-sign-up"
              className="flex-1 rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:border-slate-600 hover:text-white disabled:opacity-50 transition-colors"
              disabled={isBusy}
              onClick={() => void authAction('register')}
            >
              Create account
            </button>
          </div>
          {status !== 'Sign in to open your dashboard.' && (
            <p className="mt-4 text-sm text-slate-400">{status}</p>
          )}
        </section>
      </main>
    );
  }

  const tabs: { id: typeof activeTab; label: string }[] = [
    { id: 'chat', label: 'Chat' },
    { id: 'documents', label: `Documents (${documents.length})` },
    { id: 'tasks', label: `Tasks (${tasks.length})` },
    { id: 'tools', label: `Tool Logs (${logs.length})` },
    { id: 'debug', label: 'Debug' },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-cyan-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <span className="font-semibold text-white text-sm">Document Assistant</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400">{user.email}</span>
          <button
            id="btn-sign-out"
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-57px)]">
        {/* Sidebar */}
        <aside className="w-64 border-r border-slate-800 bg-slate-900 flex flex-col">
          <div className="p-4 border-b border-slate-800">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Workspaces
            </div>
            <div className="flex gap-2 mb-3">
              <input
                id="workspace-name-input"
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                placeholder="New workspace..."
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void createWorkspace()}
              />
              <button
                id="btn-create-workspace"
                className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition-colors"
                onClick={() => void createWorkspace()}
              >
                +
              </button>
            </div>
            <div className="space-y-1">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  id={`workspace-${ws.id}`}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${ws.id === selectedWorkspaceId ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300' : 'border border-transparent text-slate-400 hover:text-white hover:bg-slate-800'}`}
                  onClick={() => {
                    setSelectedWorkspaceId(ws.id);
                    setSelectedSessionId('');
                    setMessages([]);
                  }}
                >
                  <div className="font-medium truncate">{ws.name}</div>
                  <div className="text-xs text-slate-600">{ws.role}</div>
                </button>
              ))}
            </div>
          </div>

          {selectedWorkspaceId && activeTab === 'chat' && (
            <div className="p-4 flex-1 overflow-auto">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Sessions
                </div>
                <button
                  id="btn-new-session"
                  className="rounded bg-cyan-500/20 border border-cyan-500/30 px-2 py-1 text-xs text-cyan-400 hover:bg-cyan-500/30 transition-colors"
                  onClick={() => void createChatSession()}
                >
                  New
                </button>
              </div>
              <div className="space-y-1">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    id={`session-${s.id}`}
                    className={`w-full rounded-lg px-3 py-2 text-left text-xs transition-colors ${s.id === selectedSessionId ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                    onClick={() => setSelectedSessionId(s.id)}
                  >
                    <div className="truncate">{s.title || 'New chat'}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="border-b border-slate-800 bg-slate-900 px-6 flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Chat tab */}
          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {!selectedSessionId ? (
                <div className="flex-1 flex items-center justify-center text-slate-600">
                  <div className="text-center">
                    <p className="mb-3">No chat session selected.</p>
                    <button
                      id="btn-start-chat"
                      className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition-colors"
                      onClick={() => void createChatSession()}
                    >
                      Start a new chat
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
                    {messages.map((m) => (
                      <MessageBubble key={m.id} message={m} />
                    ))}
                    {streamingContent && (
                      <div className="flex flex-col gap-1 items-start">
                        <div className="max-w-[85%] rounded-lg px-4 py-3 text-sm bg-slate-800 border border-slate-700 text-slate-100">
                          {renderMarkdown(streamingContent)}
                          <span className="inline-block w-0.5 h-4 bg-cyan-400 animate-pulse ml-0.5" />
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="border-t border-slate-800 bg-slate-900 px-6 py-4">
                    <div className="flex gap-3 items-end">
                      <textarea
                        id="chat-input"
                        className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none resize-none"
                        rows={2}
                        placeholder="Ask a question about your documents..."
                        value={messageDraft}
                        onChange={(e) => setMessageDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            void sendMessage();
                          }
                        }}
                        disabled={isStreaming}
                      />
                      <button
                        id="btn-send"
                        className="rounded-lg bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition-colors"
                        disabled={isStreaming || !messageDraft.trim()}
                        onClick={() => void sendMessage()}
                      >
                        {isStreaming ? '...' : 'Send'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Documents tab */}
          {activeTab === 'documents' && (
            <div className="flex-1 overflow-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Documents</h2>
                <label
                  id="btn-upload"
                  className="cursor-pointer rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition-colors"
                >
                  Upload file
                  <input
                    className="hidden"
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    onChange={(e) => void uploadDocument(e)}
                  />
                </label>
              </div>
              <div className="space-y-3">
                {documents.length === 0 ? (
                  <div className="text-center py-16 text-slate-600">No documents uploaded yet.</div>
                ) : (
                  documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-900 p-4"
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
                        <svg
                          className="w-5 h-5 text-slate-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{doc.filename}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {doc.mimeType} · {doc.textLength.toLocaleString()} chars
                        </div>
                      </div>
                      <span
                        className={`rounded px-2.5 py-1 text-xs font-medium ${doc.status === 'READY' ? 'bg-green-900/40 text-green-400 border border-green-800/50' : 'bg-yellow-900/40 text-yellow-400 border border-yellow-800/50'}`}
                      >
                        {doc.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Tasks tab */}
          {activeTab === 'tasks' && (
            <div className="flex-1 overflow-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Tasks</h2>
                <button
                  id="btn-save-task"
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
                  onClick={() => void saveTask()}
                >
                  Run save_task tool
                </button>
              </div>
              <div className="space-y-3">
                {tasks.length === 0 ? (
                  <div className="text-center py-16 text-slate-600">
                    No tasks yet. Ask the AI to create one.
                  </div>
                ) : (
                  tasks.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-lg border border-slate-800 bg-slate-900 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-sm">{task.title}</div>
                          {task.description && (
                            <p className="text-xs text-slate-500 mt-1">{task.description}</p>
                          )}
                        </div>
                        <span
                          className={`rounded px-2.5 py-1 text-xs font-medium flex-shrink-0 ${task.status === 'DONE' ? 'bg-green-900/40 text-green-400' : 'bg-slate-800 text-slate-400'}`}
                        >
                          {task.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Tool logs tab */}
          {activeTab === 'tools' && (
            <div className="flex-1 overflow-auto p-6">
              <h2 className="text-lg font-semibold mb-6">Tool Logs</h2>
              <div className="space-y-3">
                {logs.length === 0 ? (
                  <div className="text-center py-16 text-slate-600">No tool calls yet.</div>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-lg border border-slate-800 bg-slate-900 p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs font-mono text-slate-300">
                            {log.toolName}
                          </span>
                          <span
                            className={`text-xs ${log.status === 'SUCCESS' ? 'text-green-400' : 'text-red-400'}`}
                          >
                            {log.status}
                          </span>
                        </div>
                        <span className="text-xs text-slate-600">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {log.error && <p className="text-xs text-red-400 mt-1">{log.error}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Debug tab */}
          {activeTab === 'debug' && (
            <div className="flex-1 overflow-auto p-6">
              <h2 className="text-lg font-semibold mb-6">Retrieval Debug</h2>
              <div className="flex gap-3 mb-6">
                <input
                  id="debug-query-input"
                  className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  placeholder="Enter a query to test retrieval..."
                  value={debugQuery}
                  onChange={(e) => setDebugQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void runDebug()}
                />
                <button
                  id="btn-debug-search"
                  className="rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition-colors"
                  onClick={() => void runDebug()}
                >
                  Search
                </button>
              </div>
              {debugChunks.length > 0 && (
                <div className="mb-4 text-xs text-slate-500">
                  {debugChunks.length} chunks retrieved
                </div>
              )}
              <div className="space-y-4">
                {debugChunks.map((chunk, i) => (
                  <div
                    key={chunk.id}
                    className="rounded-lg border border-slate-800 bg-slate-900 p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-cyan-400">#{i + 1}</span>
                        <span className="text-sm font-medium text-slate-300">{chunk.citation}</span>
                      </div>
                      <div className="flex gap-3 text-xs text-slate-500">
                        <span>
                          score: <span className="text-slate-300">{chunk.score.toFixed(4)}</span>
                        </span>
                        {chunk.similarity !== undefined && (
                          <span>
                            vec:{' '}
                            <span className="text-slate-300">{chunk.similarity.toFixed(3)}</span>
                          </span>
                        )}
                        {chunk.rrfScore !== undefined && (
                          <span>
                            rrf: <span className="text-slate-300">{chunk.rrfScore.toFixed(4)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-4">
                      {chunk.content}
                    </p>
                    <div className="mt-2 text-xs text-slate-600">Source: {chunk.source}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

const Health = () => (
  <main className="min-h-screen bg-slate-950 p-8 text-slate-100 flex items-center justify-center">
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 max-w-md w-full text-center">
      <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
        <svg
          className="w-6 h-6 text-green-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold mb-2">Frontend is running</h2>
      <p className="text-slate-400 text-sm">Vite dev server is live and ready.</p>
    </div>
  </main>
);

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/health" element={<Health />} />
      <Route
        path="*"
        element={
          <Link to="/" className="text-cyan-400 underline p-4 block">
            Return to dashboard
          </Link>
        }
      />
    </Routes>
  );
}
