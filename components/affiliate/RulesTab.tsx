import React from 'react';
import { CircleDot, TrendingUp, Triangle, AlertTriangle } from 'lucide-react';
import { REWARD_TIERS } from '../../services/affiliateService';

export const RulesTab: React.FC = () => {
  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-3">Партнерский договор оферта</h3>
        <p className="text-sm text-slate-600 mb-4 leading-relaxed">
          Вы можете распространять реферальные ссылки и промо-коды следующими способами:
        </p>
        <ol className="space-y-1.5 text-sm text-slate-600 list-decimal list-inside leading-relaxed">
          <li>Контекстная реклама (кроме ключевых запросов, содержащих бренд AgencyCore);</li>
          <li>Размещение баннера или реферальной ссылки на своем сайте;</li>
          <li>Реклама в социальных сетях, рассылки по электронной почте (исключая почтовый спам);</li>
          <li>Вебинары;</li>
          <li>Рассылка в мессенджерах;</li>
          <li>Любые другие не запрещенные способы.</li>
        </ol>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <p className="text-sm font-semibold text-slate-900 mb-4">
          Бонус для рефералов: 750 руб. на счет сервиса, вместо стандартных 375
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
            <CircleDot className="w-6 h-6 text-slate-500" />
          </div>
          <h4 className="text-lg font-bold text-slate-900">Сразу 50% с первого платежа</h4>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          Независимо от суммы платежа вы сразу получите 50% первого платежа привлеченного вами клиента.
          Например, клиент положил 2000 руб. на счет, а вы получаете с этого 1000 руб.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-slate-500" />
          </div>
          <h4 className="text-lg font-bold text-slate-900">До 50% со всех платежей в течение года</h4>
        </div>
        <p className="text-sm text-slate-600 mb-4">Партнерский процент в зависимости от количества активных клиентов:</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {REWARD_TIERS.map((tier, i) => {
            const labels = ['до 5', '6-10', '11-20', '21-40', '41-80', 'от 81'];
            return (
              <div key={i} className="bg-slate-100 rounded-lg px-4 py-2.5 text-center min-w-[70px]">
                <p className="text-xs text-slate-500 mb-0.5">{labels[i]}</p>
                <p className="text-lg font-bold text-slate-800">{tier.percent}%</p>
              </div>
            );
          })}
        </div>
        <p className="text-sm text-slate-500 leading-relaxed">
          Чем больше клиентов вы привлекли, тем больше вознаграждение, которое вы получаете.
          Например, вы привлекли 50 клиентов, 25 из них активные. Ваш партнерский процент -- 35%.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
            <Triangle className="w-6 h-6 text-amber-500" />
          </div>
          <h4 className="text-lg font-bold text-slate-900">Еще 10% со второго уровня</h4>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          Если привлеченные вами клиенты также начнут привлекать новых клиентов, вы получаете
          вознаграждение 10% с каждой их оплаты в течение года.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
            <Triangle className="w-5 h-5 text-orange-500" />
          </div>
          <h4 className="text-lg font-bold text-slate-900">И еще 5% с третьего уровня</h4>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          Если привлеченные вами клиенты также начнут привлекать новых клиентов, а те в свою очередь
          тоже начнут привлекать новых клиентов, вы получаете вознаграждение 5% с каждой их оплаты в течение года.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h4 className="text-lg font-bold text-slate-900 mb-3">Когда можно вывести партнерский баланс</h4>
        <p className="text-sm text-slate-600 leading-relaxed mb-3">
          По достижению 5 000 руб. на счету вы можете оставить заявку на вывод денег.
          Потребуется прислать необходимые документы и банковские реквизиты, после чего 10 или 25 числа будет отправлен перевод.
        </p>
        <p className="text-sm text-slate-600 leading-relaxed">
          Деньги готовы к выплате не раньше 14 дней после их зачисления.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <h4 className="text-lg font-bold text-slate-900">Ограничения на источники трафика</h4>
        </div>
        <ol className="space-y-2 text-sm text-slate-600 list-decimal list-inside leading-relaxed">
          <li>Использование рекламных материалов, которые вводят в заблуждение или обманывают потенциальных клиентов;</li>
          <li>Использование незаконных способов привлечения клиентов или любое другое искусственное увеличение количества заявок;</li>
          <li>Cookie dropping (cookie stuffing) -- подмена cookie файлов пользователя при посещении сайта;</li>
          <li>Pop-under (popunder) -- автоматически всплывающий баннер;</li>
          <li>Click-under (clickunder) -- любое действие пользователя вызывает открытие нового окна;</li>
          <li>Push-сообщения -- всплывающие оповещения на экране смартфона;</li>
          <li>Мотивированный трафик (incentive) -- мотивация пользователей за счет поощрения определенных действий;</li>
          <li>Спам-рассылки -- не запрошенные массовые рассылки анонимного характера;</li>
          <li>Контекстная реклама с использованием ключевых запросов, содержащих бренд AgencyCore;</li>
          <li>Adult-трафик -- сайт со взрослым контентом;</li>
          <li>Создание брендированных групп без согласования с администрацией AgencyCore;</li>
          <li>Реклама через статусы/рекомендации от лица сотрудников.</li>
        </ol>
        <p className="text-xs text-slate-400 mt-4 leading-relaxed">
          Администрация вправе пересматривать список запрещенных способов в том числе задним числом и корректировать
          суммы дохода партнера при обнаружении мошеннических схем вплоть до блокировки аккаунта.
        </p>
      </div>
    </div>
  );
};
