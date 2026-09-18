"use client";

import type { ConversationSummary } from "@/lib/tutor/conversations";

interface ConversationListProps {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function ConversationList({ conversations, activeConversationId, onSelect, onNew, onDelete }: ConversationListProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-slate-200 p-3">
        <button
          type="button"
          onClick={onNew}
          className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          + New conversation
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <p className="p-4 text-sm text-slate-400">No conversations yet. Ask a question to start one.</p>
        )}
        <ul>
          {conversations.map((conversation) => (
            <li
              key={conversation.id}
              className={`flex items-center gap-1 border-b border-slate-100 pr-1 ${
                conversation.id === activeConversationId ? "bg-indigo-50" : "hover:bg-slate-50"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(conversation.id)}
                title={conversation.title}
                className="min-w-0 flex-1 truncate px-3 py-3 text-left text-sm text-slate-700"
              >
                {conversation.title}
              </button>
              <button
                type="button"
                onClick={() => onDelete(conversation.id)}
                aria-label={`Delete "${conversation.title}"`}
                className="shrink-0 rounded p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-500"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
