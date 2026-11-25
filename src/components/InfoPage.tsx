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

const cardClass = 'rounded-2xl border border-white/25 bg-white/95 backdrop-blur-md shadow-xl p-5 sm:p-7 text-[#0f172a]';

export function InfoPage({ type, usdUahRate, onBackHome }: InfoPageProps) {
  const isOffer = type === 'offer';
  return (
    <div>
      <section className="border-b border-white/15 bg-[#081421]/40 backdrop-blur-[1px] py-8 text-white">
        <div className="mx-auto max-w-[1180px] px-5">
          <nav aria-label={tr('Хлібні крихти')} className="mb-2 flex items-center gap-2 text-xs text-slate-300">
            <button type="button" onClick={onBackHome} className="font-bold text-sky-300 hover:text-white hover:underline cursor-pointer">{tr('Головна')}</button>
            <span aria-hidden="true">/</span>
            <span>{isOffer ? tr('Публічна оферта') : tr('Оплата і доставка')}</span>
          </nav>
          <h1 className="mb-2 text-2xl font-extrabold text-white sm:text-3xl">
            {isOffer ? tr('Публічна оферта') : tr('Оплата і доставка')}
          </h1>
          <p className="max-w-2xl text-sm text-slate-200">
            {isOffer
                ? tr('Проєкт умов дистанційного замовлення обладнання та послуг Energo Comfort.', 'Проект условий дистанционного заказа оборудования и услуг Energo Comfort.')
              : tr('Узгоджуємо спосіб оплати й доставку з вами після підтвердження складу та наявності замовлення.', 'Согласуем способ оплаты и доставки после подтверждения состава и наличия заказа.')}
          </p>
        </div>
      </section>

      <section className="relative overflow-hidden isolate py-9 sm:py-12">
        <VideoBackground position="absolute" tone="light" start={18} end={34} />
        <div className="relative mx-auto max-w-[900px] space-y-5 px-5">
          {isOffer ? (
            <>
              <div role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
                <strong>{tr('Чернетка для погодження.', 'Черновик для согласования.')}</strong> {tr('До публікації оферти як обов’язкового договору продавцю потрібно додати повне зареєстроване найменування, код ЄДРПОУ або РНОКПП, реєстраційну адресу, платіжні реквізити та перевірити остаточні умови зі своїм юристом. Наразі доступні лише бренд, адреса та контакти з сайту.', 'Перед публикацией оферты как обязательного договора продавцу нужно добавить полное зарегистрированное наименование, код ЕГРПОУ или РНОКПП, регистрационный адрес, платёжные реквизиты и проверить окончательные условия с юристом. Сейчас доступны только бренд, адрес и контакты с сайта.')}
              </div>
              <article className={cardClass}>
                <h2 className="mb-3 text-lg font-bold text-[#0d1f33]">{tr('1. Продавець і предмет пропозиції', '1. Продавец и предмет предложения')}</h2>
                <p className="text-sm leading-7 text-slate-700">
                  {tr(`Energo Comfort (далі — Продавець), адреса для зв’язку: ${COMPANY_INFO.address}; телефон ${COMPANY_INFO.phone1}, електронна пошта`, `Energo Comfort (далее — Продавец), адрес для связи: ${COMPANY_INFO.address}; телефон ${COMPANY_INFO.phone1}, электронная почта`)}{' '}
                  <a className="text-[#1769aa] underline" href={`mailto:${COMPANY_INFO.email}`}>{COMPANY_INFO.email}</a>,
                  {tr(`пропонує замовити обладнання, готові системи та послуги, описані на сайті ${COMPANY_INFO.domain}. Повні реєстраційні дані Продавця мають бути зазначені тут до набрання офертою чинності.`, `предлагает заказать оборудование, готовые системы и услуги, описанные на сайте ${COMPANY_INFO.domain}. Полные регистрационные данные Продавца должны быть указаны здесь до вступления оферты в силу.`)}
                </p>
              </article>
              <article className={cardClass}>
                <h2 className="mb-3 text-lg font-bold text-[#0d1f33]">{tr('2. Замовлення і підтвердження', '2. Заказ и подтверждение')}</h2>
                <p className="text-sm leading-7 text-slate-700">
                  {tr('Покупець надсилає замовлення через кошик або звертається за консультацією. Надсилання форми на сайті є запитом на оформлення, а не підтвердженням наявності чи остаточної вартості. Продавець зв’язується з Покупцем, уточнює товар, кількість, адресу, строки та погоджує остаточні умови. Замовлення вважається погодженим після підтвердження Продавцем і згоди Покупця з узгодженими умовами.', 'Покупатель отправляет заказ через корзину или запрашивает консультацию. Отправка формы на сайте является запросом на оформление, но не подтверждает наличие или окончательную стоимость. Продавец связывается с Покупателем, уточняет товар, количество, адрес, сроки и согласует окончательные условия. Заказ считается согласованным после подтверждения Продавцом и согласия Покупателя с условиями.')}
                </p>
              </article>
              <article className={cardClass}>
                <h2 className="mb-3 text-lg font-bold text-[#0d1f33]">{tr('3. Ціна та оплата', '3. Цена и оплата')}</h2>
                <p className="text-sm leading-7 text-slate-700">
                  {tr('Ціни в каталозі показуються у гривнях як розрахунок від ціни в доларах США за комерційним курсом компанії. Поточний курс на сайті:', 'Цены в каталоге показываются в гривнах и рассчитываются от цены в долларах США по коммерческому курсу компании. Текущий курс на сайте:')} <strong>{usdUahRate ? `1 USD = ${usdUahRate.toLocaleString('uk-UA')} грн` : tr('завантажується', 'загружается')}</strong>. {tr('Розрахована ціна є інформаційною; суму до оплати в гривнях і доступний спосіб оплати Продавець повідомляє під час підтвердження замовлення. Оплата здійснюється лише після погодження рахунку або іншого платіжного способу.', 'Расчётная цена носит информационный характер. Сумму к оплате в гривнах и доступный способ оплаты Продавец сообщает при подтверждении заказа. Оплата производится после согласования счёта или другого способа оплаты.')}
                </p>
              </article>
              <article className={cardClass}>
                <h2 className="mb-3 text-lg font-bold text-[#0d1f33]">{tr('4. Передача товару, гарантія і повернення', '4. Передача товара, гарантия и возврат')}</h2>
                <p className="text-sm leading-7 text-slate-700">
                  {tr(`Спосіб, строк і вартість доставки або самовивозу погоджуються окремо до оплати. Гарантійні умови на обладнання залежать від виробника та зазначаються в документах на товар. Права споживача на обмін, повернення та відмову від дистанційного договору визначаються законодавством України; окремі види товарів можуть мати передбачені законом винятки. Для звернення щодо замовлення: ${COMPANY_INFO.phone1}, ${COMPANY_INFO.email}.`, `Способ, срок и стоимость доставки или самовывоза согласуются отдельно до оплаты. Гарантийные условия зависят от производителя и указаны в документах на товар. Права потребителя на обмен, возврат и отказ от дистанционного договора определяются законодательством Украины; для отдельных товаров законом предусмотрены исключения. По вопросам заказа: ${COMPANY_INFO.phone1}, ${COMPANY_INFO.email}.`)}
                </p>
              </article>
              <article className={cardClass}>
                <h2 className="mb-3 text-lg font-bold text-[#0d1f33]">{tr('5. Дані продавця', '5. Данные продавца')}</h2>
                <p className="text-sm leading-7 text-slate-700">Energo Comfort · {COMPANY_INFO.address} · {COMPANY_INFO.phone1} · {COMPANY_INFO.email}</p>
                <p className="mt-2 text-sm leading-7 text-red-700">{tr('Повне найменування/ПІБ ФОП, ЄДРПОУ/РНОКПП, адреса державної реєстрації та платіжні реквізити: не надані — необхідно заповнити перед публікацією оферти.', 'Полное наименование / ФИО ФЛП, ЕГРПОУ / РНОКПП, адрес регистрации и платёжные реквизиты не предоставлены — заполните их перед публикацией оферты.')}</p>
              </article>
            </>
          ) : (
            <>
              <article className={cardClass}>
                <div className="mb-3 flex items-center gap-2 text-[#1769aa]"><Banknote className="h-5 w-5" /><h2 className="text-lg font-bold text-[#0d1f33]">{tr('Оплата', 'Оплата')}</h2></div>
                <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
                  <li>{tr('Замовте товар у кошику або залиште заявку на розрахунок.', 'Закажите товар в корзине или отправьте заявку на расчёт.')}</li>
                  <li>{tr('Менеджер перевірить наявність, склад комплекту та фінальну суму у гривнях за актуальним комерційним курсом.', 'Менеджер проверит наличие, состав комплекта и итоговую сумму в гривнах по актуальному коммерческому курсу.')}</li>
                  <li>{tr('Після погодження вам нададуть актуальні варіанти оплати та, за потреби, рахунок. Не сплачуйте до отримання підтвердження замовлення.', 'После согласования вам сообщат доступные способы оплаты и при необходимости выставят счёт. Не оплачивайте заказ до подтверждения.')}</li>
                </ul>
                <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  {tr('Орієнтовний перерахунок каталогу:', 'Ориентировочный пересчёт каталога:')} {usdUahRate ? `1 USD = ${usdUahRate.toLocaleString('ru-RU')} грн` : tr('комерційний курс завантажується', 'коммерческий курс загружается')}.
                  {usdUahRate && <> {tr('Наприклад,', 'Например,')} $100 ≈ {formatUahFromUsd(100, usdUahRate)}.</>}
                  {' '}{tr('Остаточна сума до оплати вказується в погодженому замовленні.', 'Окончательная сумма к оплате указывается в согласованном заказе.')}
                </p>
              </article>
              <article className={cardClass}>
                <div className="mb-3 flex items-center gap-2 text-[#1769aa]"><Truck className="h-5 w-5" /><h2 className="text-lg font-bold text-[#0d1f33]">{tr('Доставка', 'Доставка')}</h2></div>
                <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
                  <li>{tr(`Самовивіз з офісу/складу в Одесі: ${COMPANY_INFO.address} — за попереднім погодженням.`, `Самовывоз из офиса/склада в Одессе: ${COMPANY_INFO.address} — по предварительному согласованию.`)}</li>
                  <li>{tr('Доставка по Україні перевізником погоджується з менеджером з урахуванням габаритів, ваги та умов перевізника.', 'Доставка по Украине перевозчиком согласуется с менеджером с учётом габаритов, веса и условий перевозчика.')}</li>
                  <li>{tr('Вартість перевезення та орієнтовна дата відправлення повідомляються перед підтвердженням.', 'Стоимость доставки и примерную дату отправки сообщат до подтверждения заказа.')}</li>
                  <li>{tr('Під час отримання перевірте цілісність упаковки та комплектацію разом із перевізником.', 'При получении проверьте упаковку и комплектность вместе с перевозчиком.')}</li>
                </ul>
              </article>
              <article className={cardClass}>
                <div className="mb-3 flex items-center gap-2 text-[#1769aa]"><PackageCheck className="h-5 w-5" /><h2 className="text-lg font-bold text-[#0d1f33]">{tr('Підтвердження замовлення', 'Подтверждение заказа')}</h2></div>
                <p className="text-sm leading-7 text-slate-700">{tr(`Після відправлення заявки менеджер зв’яжеться з вами за вказаним телефоном і підтвердить склад, наявність, суму, оплату та доставку. Запитання: ${COMPANY_INFO.phone1}, ${COMPANY_INFO.phone2}, ${COMPANY_INFO.email}.`, `После отправки заявки менеджер свяжется с вами по указанному телефону и подтвердит состав, наличие, сумму, оплату и доставку. Вопросы: ${COMPANY_INFO.phone1}, ${COMPANY_INFO.phone2}, ${COMPANY_INFO.email}.`)}</p>
              </article>
              <a href="/public-offer" className="inline-flex items-center gap-2 text-sm font-bold text-sky-300 hover:text-white hover:underline text-on-video"><FileText className="h-4 w-4" />{tr('Переглянути проєкт публічної оферти', 'Посмотреть проект публичной оферты')}</a>
            </>
          )}
          <div>
            <button type="button" onClick={onBackHome} className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/95 px-4 py-2.5 text-sm font-bold text-[#0d1f33] hover:bg-white shadow-md cursor-pointer">
              <ArrowLeft className="h-4 w-4" />{tr('На головну', 'На главную')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
