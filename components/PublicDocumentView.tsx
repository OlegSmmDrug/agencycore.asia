import React, { useState, useEffect } from 'react';
import { Document, User } from '../types';
import { documentService } from '../services/documentService';
import { userService } from '../services/userService';
import UserAvatar from './UserAvatar';

interface PublicDocumentViewProps {
  documentId: string;
}

const PublicDocumentView: React.FC<PublicDocumentViewProps> = ({ documentId }) => {
  const [document, setDocument] = useState<Document | null>(null);
  const [author, setAuthor] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDocument();
  }, [documentId]);

  const loadDocument = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const doc = await documentService.getById(documentId);

      if (!doc) {
        setError('Документ не найден');
        return;
      }

      if (!doc.isPublic) {
        setError('Этот документ не является публичным');
        return;
      }

      setDocument(doc);

      if (doc.authorId) {
        const authorData = await userService.getById(doc.authorId);
        if (authorData) {
          setAuthor(authorData);
        }
      }
    } catch (err) {
      console.error('Error loading public document:', err);
      setError('Ошибка загрузки документа');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()} - ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Загрузка документа...</p>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto">
            <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Доступ ограничен</h1>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-8 border-b border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">{document.icon || '📄'}</span>
                <div>
                  <h1 className="text-3xl font-bold text-slate-900">{document.title}</h1>
                  {author && (
                    <div className="flex items-center space-x-2 mt-2">
                      <UserAvatar src={author.avatar} name={author.name} size="sm" borderClassName="border border-slate-200" />
                      <span className="text-sm text-slate-600">{author.name}</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-xs text-slate-400">Обновлен {formatDate(document.updatedAt)}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span>Публичный просмотр</span>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div
              className="prose prose-slate max-w-none"
              dangerouslySetInnerHTML={{ __html: document.content }}
            />
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-500">
              Этот документ опубликован в базе знаний AgencyCore
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicDocumentView;
