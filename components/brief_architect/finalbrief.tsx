import React, { useState, useRef } from 'react';

declare const html2pdf: any;

interface FinalBriefProps {
  data: any;
  rawText: string;
}

export const FinalBrief: React.FC<FinalBriefProps> = ({ data, rawText }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const briefRef = useRef<HTMLDivElement>(null);

  const handleDownloadPDF = async () => {
    if (!briefRef.current) return;

    setIsGenerating(true);
    try {
      const filename = `Brief_${data.product?.name || 'Campaign'}_${new Date().toISOString().split('T')[0]}.pdf`;

      const opt = {
        margin: 10,
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().from(briefRef.current).set(opt).save();
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Ошибка при генерации PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  const renderSection = (title: string, content: any, icon?: React.ReactNode) => {
    if (!content) return null;

    return (
      <div className="mb-8">
        <h4 className="text-blue-700 font-bold text-sm uppercase mb-3 flex items-center gap-2">
          {icon}
          {title}
        </h4>
        {typeof content === 'object' && !Array.isArray(content) ? (
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            {Object.entries(content).map(([key, value]) => (
              <div key={key}>
                <span className="font-semibold text-gray-700">{key.replace(/_/g, ' ')}: </span>
                <span className="text-gray-600">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        ) : Array.isArray(content) ? (
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            {content.map((item, i) => (
              <li key={i}>{typeof item === 'object' ? JSON.stringify(item) : String(item)}</li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-700">{String(content)}</p>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden mb-12">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Готовый бриф</h2>
          <p className="text-blue-100 text-sm mt-1">Рекламная кампания подготовлена</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleDownloadPDF}
            disabled={isGenerating}
            className="bg-white text-blue-700 font-semibold py-3 px-6 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Генерация PDF...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Скачать PDF
              </>
            )}
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="bg-white/20 hover:bg-white/30 text-white p-3 rounded-lg transition-colors"
          >
            <svg
              className={`w-6 h-6 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div ref={briefRef} className="p-8 space-y-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Рекламный бриф</h1>
            <p className="text-gray-600">{new Date().toLocaleDateString('ru-RU')}</p>
          </div>

          {data.product && (
            <section className="border-b border-gray-200 pb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">О продукте</h3>
              {renderSection('Название', data.product.name)}
              {renderSection('Описание', data.product.description)}
              {renderSection('Уникальные преимущества', data.product.unique_selling_points)}
              {renderSection('Цена', data.product.price)}
              {renderSection('Конкуренты', data.product.competitors)}
              {renderSection('Преимущества', data.product.advantages)}
              {renderSection('Вызовы', data.product.challenges)}
            </section>
          )}

          {data.business_goals && (
            <section className="border-b border-gray-200 pb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Бизнес-цели</h3>
              {renderSection('Основная цель', data.business_goals.primary_goal)}
              {renderSection('Целевые KPI', data.business_goals.kpi_targets)}
            </section>
          )}

          {data.target_audience && (
            <section className="border-b border-gray-200 pb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Целевая аудитория</h3>
              {data.target_audience.demographics && renderSection('Демография', data.target_audience.demographics)}
              {data.target_audience.psychographics && renderSection('Психография', data.target_audience.psychographics)}
              {renderSection('Боли и проблемы', data.target_audience.pains)}
              {renderSection('Триггеры к покупке', data.target_audience.triggers)}
              {renderSection('Возражения', data.target_audience.objections)}
              {data.target_audience.online_behavior && renderSection('Поведение онлайн', data.target_audience.online_behavior)}
            </section>
          )}

          {data.communication_strategy && (
            <section className="border-b border-gray-200 pb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Стратегия коммуникации</h3>
              {renderSection('Ключевое сообщение', data.communication_strategy.key_message)}
              {renderSection('УТП', data.communication_strategy.usp)}
              {renderSection('Доказательства', data.communication_strategy.proof_points)}
              {renderSection('Tone of Voice', data.communication_strategy.tone_of_voice)}
              {renderSection('Эмоциональный посыл', data.communication_strategy.emotional_appeal)}
              {renderSection('Призыв к действию', data.communication_strategy.call_to_action)}
            </section>
          )}

          {data.media_strategy && (
            <section className="border-b border-gray-200 pb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Медиа-стратегия</h3>
              {renderSection('Каналы', data.media_strategy.channels)}
              {data.media_strategy.budget && renderSection('Бюджет', data.media_strategy.budget)}
              {data.media_strategy.timeline && renderSection('Сроки', data.media_strategy.timeline)}
              {renderSection('KPI', data.media_strategy.kpis)}
              {renderSection('География', data.media_strategy.geography)}
            </section>
          )}

          {data.creative_concept && (
            <section>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Креативная концепция</h3>
              {renderSection('Большая идея', data.creative_concept.big_idea)}
              {data.creative_concept.visual_style && renderSection('Визуальный стиль', data.creative_concept.visual_style)}
              {renderSection('Форматы контента', data.creative_concept.content_formats)}
              {renderSection('Обязательные элементы', data.creative_concept.must_haves)}
              {renderSection('Исключить', data.creative_concept.must_not_haves)}
            </section>
          )}

          <div className="pt-8 mt-8 border-t border-gray-200 text-center text-gray-500 text-sm">
            <p>Сгенерировано AI-стратегом Brief Architect</p>
            <p className="mt-1">&copy; 2025 AgencyCore ERP</p>
          </div>
        </div>
      )}
    </div>
  );
};
