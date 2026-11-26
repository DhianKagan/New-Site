import { ArrowLeft, Banknote, FileText, PackageCheck, Truck } from 'lucide-react';
import { COMPANY_INFO } from '../data/siteContent.ts';
import { formatUahFromUsd } from '../lib/currency.ts';
import { tr } from '../lib/i18n.ts';
import { VideoBackground } from './VideoBackground.tsx';

interface InfoPageProps {
  type: 'payment-delivery' | 'offer';
  usdUahRate: number | null;
  onBackHome: () => void;
}

const cardClass = 'ec-glass-card rounded-2xl p-4 sm:p-6 lg:p-7 text-[#07213e]';

export function InfoPage({ type, usdUahRate, onBackHome }: InfoPageProps) {
  const isOffer = type === 'offer';
  return (
    <div>
      <section className="ec-banner text-[#07213e] break-words hyphens-none">
        <div className="ec-container">
          <h1 className="mb-2 text-[clamp(1.25rem,4.8vw,1.875rem)] font-extrabold text-[#07213e] leading-tight">
            {isOffer ? tr('Публічна оферта') : tr('Оплата і доставка')}
          </h1>
          <p className="max-w-2xl text-sm font-medium text-[#1c3d5e]">
            {isOffer
                ? tr('Проєкт умов дистанційного замовлення обладнання та послуг Energo Comfort.', 'Проект условий дистанционного заказа оборудования и услуг Energo Comfort.')
              : tr('Узгоджуємо спосіб оплати й доставку з вами після підтвердження складу та наявності замовлення.', 'Согласуем способ оплаты и доставки после подтверждения состава и наличия заказа.')}
          </p>
        </div>
      </section>

      <section className="relative overflow-hidden isolate ec-section">
        <VideoBackground position="absolute" tone="light" tint="daylight" start={26} end={38} brightness={0.56} />
        <div className="relative ec-container space-y-6 break-words hyphens-none">
          {isOffer ? (
            <>
              <div role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
                <strong>{tr('Чернетка для погодження.', 'Черновик для согласования.')}</strong> {tr('До публікації оферти як обов’язкового договору продавцю потрібно додати повне зареєстроване найменування, код ЄДРПОУ або РНОКПП, реєстраційну адресу, платіжні реквізити та перевірити остаточні умови зі своїм юристом. Наразі доступні лише бренд, адреса та контакти з сайту.', 'Перед публикацией оферты как обязательного договора продавцу нужно добавить полное зарегистрированное наименование, код ЕГРПОУ или РНОКПП, регистрационный адрес, платёжные реквизиты и проверить окончательные условия с юристом. Сейчас доступны только бренд, адрес и контакты с сайта.')}
              </div>
              <article className={cardClass}>
                <h2 className="mb-3 text-lg font-bold text-[#07213e]">{tr('1. Продавець і предмет пропозиції', '1. Продавец и предмет предложения')}</h2>
                <p className="text-sm leading-7 text-[#1c3d5e]">
                  {tr(`Energo Comfort (далі — Продавець), адреса для зв’язку: ${COMPANY_INFO.address}; телефон ${COMPANY_INFO.phone1}, електронна пошта`, `Energo Comfort (далее — Продавец), адрес для связи: ${COMPANY_INFO.address}; телефон ${COMPANY_INFO.phone1}, электронная почта`)}{' '}
                  <a className="text-[#0b66b2] underline" href={`mailto:${COMPANY_INFO.email}`}>{COMPANY_INFO.email}</a>,
                  {tr(`пропонує замовити обладнання, готові системи та послуги, описані на сайті ${COMPANY_INFO.domain}. Повні реєстраційні дані Продавця мають бути зазначені тут до набрання офертою чинності.`, `предлагает заказать оборудование, готовые системы и услуги, описанные на сайте ${COMPANY_INFO.domain}. Полные регистрационные данные Продавца должны быть указаны здесь до вступления оферты в силу.`)}
                </p>
              </article>
              <article className={cardClass}>
                <h2 className="mb-3 text-lg font-bold text-[#07213e]">{tr('2. Замовлення і підтвердження', '2. Заказ и подтверждение')}</h2>
                <p className="text-sm leading-7 text-[#1c3d5e]">
                  {tr('Покупець надсилає замовлення через кошик або звертається за консультацією. Надсилання форми на сайті є запитом на оформлення, а не підтвердженням наявності чи остаточної вартості. Продавець зв’язується з Покупцем, уточнює товар, кількість, адресу, строки та погоджує остаточні умови. Замовлення вважається погодженим після підтвердження Продавцем і згоди Покупця з узгодженими умовами.', 'Покупатель отправляет заказ через корзину или запрашивает консультацию. Отправка формы на сайте является запросом на оформление, но не подтверждает наличие или окончательную стоимость. Продавец связывается с Покупателем, уточняет товар, количество, адрес, сроки и согласует окончательные условия. Заказ считается согласованным после подтверждения Продавцом и согласия Покупателя с условиями.')}
                </p>
              </article>
              <article className={cardClass}>
                <h2 className="mb-3 text-lg font-bold text-[#07213e]">{tr('3. Ціна та оплата', '3. Цена и оплата')}</h2>
                <p className="text-sm leading-7 text-[#1c3d5e]">
                  {tr('Ціни в каталозі показуються у гривнях як розрахунок від ціни в доларах США за комерційним курсом компанії. Поточний курс на сайті:', 'Цены в каталоге показываются в гривнах и рассчитываются от цены в долларах США по коммерческому курсу компании. Текущий курс на сайте:')} <strong>{usdUahRate ? `1 USD = ${usdUahRate.toLocaleString('uk-UA')} грн` : tr('завантажується', 'загружается')}</strong>. {tr('Розрахована ціна є інформаційною; суму до оплати в гривнях і доступний спосіб оплати Продавець повідомляє під час підтвердження замовлення. Оплата здійснюється лише після погодження рахунку або іншого платіжного способу.', 'Расчётная цена носит информационный характер. Сумму к оплате в гривнах и доступный способ оплаты Продавец сообщает при подтверждении заказа. Оплата производится после согласования счёта или другого способа оплаты.')}
                </p>
              </article>
              <article className={cardClass}>
                <h2 className="mb-3 text-lg font-bold text-[#07213e]">{tr('4. Передача товару, гарантія і повернення', '4. Передача товара, гарантия и возврат')}</h2>
                <p className="text-sm leading-7 text-[#1c3d5e]">
                  {tr(`Спосіб, строк і вартість доставки або самовивозу погоджуються окремо до оплати. Гарантійні умови на обладнання залежать від виробника та зазначаються в документах на товар. Права споживача на обмін, повернення та відмову від дистанційного договору визначаються законодавством України; окремі види товарів можуть мати передбачені законом винятки. Для звернення щодо замовлення: ${COMPANY_INFO.phone1}, ${COMPANY_INFO.email}.`, `Способ, срок и стоимость доставки или самовывоза согласуются отдельно до оплаты. Гарантийные условия зависят от производителя и указаны в документах на товар. Права потребителя на обмен, возврат и отказ от дистанционного договора определяются законодательством Украины; для отдельных товаров законом предусмотрены исключения. По вопросам заказа: ${COMPANY_INFO.phone1}, ${COMPANY_INFO.email}.`)}
                </p>
              </article>
              <article className={cardClass}>
                <h2 className="mb-3 text-lg font-bold text-[#07213e]">{tr('5. Дані продавця', '5. Данные продавца')}</h2>
                <p className="text-sm leading-7 text-[#1c3d5e]">Energo Comfort · {COMPANY_INFO.address} · {COMPANY_INFO.phone1} · {COMPANY_INFO.email}</p>
                <p className="mt-2 text-sm leading-7 text-red-700">{tr('Повне найменування/ПІБ ФОП, ЄДРПОУ/РНОКПП, адреса державної реєстрації та платіжні реквізити: не надані — необхідно заповнити перед публікацією оферти.', 'Полное наименование / ФИО ФЛП, ЕГРПОУ / РНОКПП, адрес регистрации и платёжные реквизиты не предоставлены — заполните их перед публикацией оферты.')}</p>
              </article>
            </>
          ) : (
            <>
              <article className={cardClass}>
                <div className="mb-3 flex items-center gap-2 text-[#0b66b2]"><Banknote className="h-5 w-5" /><h2 className="text-lg font-bold text-[#07213e]">{tr('Оплата', 'Оплата')}</h2></div>
                <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-[#1c3d5e]">
                  <li>{tr('Замовте товар у кошику або залиште заявку на розрахунок.', 'Закажите товар в корзине или отправьте заявку на расчёт.')}</li>
                  <li>{tr('Менеджер перевірить наявність, склад комплекту та фінальну суму у гривнях за актуальним комерційним курсом.', 'Менеджер проверит наличие, состав комплекта и итоговую сумму в гривнах по актуальному коммерческому курсу.')}</li>
                  <li>{tr('Після погодження вам нададуть актуальні варіанти оплати та, за потреби, рахунок. Не сплачуйте до отримання підтвердження замовлення.', 'После согласования вам сообщат доступные способы оплаты и при необходимости выставят счёт. Не оплачивайте заказ до подтверждения.')}</li>
                </ul>
                <p className="mt-4 rounded-xl bg-sky-50/85 border border-sky-100 p-3 text-xs leading-5 text-[#1c3d5e]">
                  {tr('Орієнтовний перерахунок каталогу:', 'Ориентировочный пересчёт каталога:')} {usdUahRate ? `1 USD = ${usdUahRate.toLocaleString('ru-RU')} грн` : tr('комерційний курс завантажується', 'коммерческий курс загружается')}.
                  {usdUahRate && <> {tr('Наприклад,', 'Например,')} $100 ≈ {formatUahFromUsd(100, usdUahRate)}.</>}
                  {' '}{tr('Остаточна сума до оплати вказується в погодженому замовленні.', 'Окончательная сумма к оплате указывается в согласованном заказе.')}
                </p>
              </article>
              <article className={cardClass}>
                <div className="mb-3 flex items-center gap-2 text-[#0b66b2]"><Truck className="h-5 w-5" /><h2 className="text-lg font-bold text-[#07213e]">{tr('Доставка', 'Доставка')}</h2></div>
                <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-[#1c3d5e]">
                  <li>{tr(`Самовивіз з офісу/складу в Одесі: ${COMPANY_INFO.address} — за попереднім погодженням.`, `Самовывоз из офиса/склада в Одессе: ${COMPANY_INFO.address} — по предварительному согласованию.`)}</li>
                  <li>{tr('Доставка по Україні перевізником погоджується з менеджером з урахуванням габаритів, ваги та умов перевізника.', 'Доставка по Украине перевозчиком согласуется с менеджером с учётом габаритов, веса и условий перевозчика.')}</li>
                  <li>{tr('Вартість перевезення та орієнтовна дата відправлення повідомляються перед підтвердженням.', 'Стоимость доставки и примерную дату отправки сообщат до подтверждения заказа.')}</li>
                  <li>{tr('Під час отримання перевірте цілісність упаковки та комплектацію разом із перевізником.', 'При получении проверьте упаковку и комплектность вместе с перевозчиком.')}</li>
                </ul>
              </article>
              <article className={cardClass}>
                <div className="mb-3 flex items-center gap-2 text-[#0b66b2]"><PackageCheck className="h-5 w-5" /><h2 className="text-lg font-bold text-[#07213e]">{tr('Підтвердження замовлення', 'Подтверждение заказа')}</h2></div>
                <p className="text-sm leading-7 text-[#1c3d5e]">{tr(`Після відправлення заявки менеджер зв’яжеться з вами за вказаним телефоном і підтвердить склад, наявність, суму, оплату та доставку. Запитання: ${COMPANY_INFO.phone1}, ${COMPANY_INFO.phone2}, ${COMPANY_INFO.email}.`, `После отправки заявки менеджер свяжется с вами по указанному телефону и подтвердит состав, наличие, сумму, оплату и доставку. Вопросы: ${COMPANY_INFO.phone1}, ${COMPANY_INFO.phone2}, ${COMPANY_INFO.email}.`)}</p>
              </article>
              <a href="/public-offer" className="ec-glass-plate inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-[#0b66b2] hover:bg-white/90 hover:text-[#07213e] transition-colors"><FileText className="h-4 w-4" />{tr('Переглянути проєкт публічної оферти', 'Посмотреть проект публичной оферты')}</a>
            </>
          )}
          <div>
            <button type="button" onClick={onBackHome} className="ec-glass-plate inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-[#07213e] hover:bg-white/95 cursor-pointer">
              <ArrowLeft className="h-4 w-4" />{tr('На головну', 'На главную')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
