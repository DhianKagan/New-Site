import { ArrowLeft, Banknote, FileText, PackageCheck, Truck } from 'lucide-react';
import { COMPANY_INFO } from '../data/siteContent.ts';
import { formatUahFromUsd } from '../lib/currency.ts';

interface InfoPageProps {
  type: 'payment-delivery' | 'offer';
  usdUahRate: number | null;
  onBackHome: () => void;
}

const cardClass = 'rounded-2xl border border-slate-200 bg-white p-5 sm:p-7';

export function InfoPage({ type, usdUahRate, onBackHome }: InfoPageProps) {
  const isOffer = type === 'offer';
  return (
    <div>
      <section className="border-b border-slate-200 bg-gradient-to-b from-[#f3f7fc] to-white py-8">
        <div className="mx-auto max-w-[1180px] px-5">
          <nav aria-label="Хлібні крихти" className="mb-2 flex items-center gap-2 text-xs text-slate-500">
            <button type="button" onClick={onBackHome} className="font-bold text-[#1769aa] hover:underline">Головна</button>
            <span aria-hidden="true">/</span>
            <span>{isOffer ? 'Публічна оферта' : 'Оплата і доставка'}</span>
          </nav>
          <h1 className="mb-2 text-2xl font-extrabold text-[#0d1f33] sm:text-3xl">
            {isOffer ? 'Публічна оферта' : 'Оплата і доставка'}
          </h1>
          <p className="max-w-2xl text-sm text-[#52657a]">
            {isOffer
              ? 'Проєкт умов дистанційного замовлення обладнання та послуг Energo Comfort.'
              : 'Узгоджуємо спосіб оплати й доставку з вами після підтвердження складу та наявності замовлення.'}
          </p>
        </div>
      </section>

      <section className="bg-[#f8fafc] py-9 sm:py-12">
        <div className="mx-auto max-w-[900px] space-y-5 px-5">
          {isOffer ? (
            <>
              <div role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
                <strong>Чернетка для погодження.</strong> До публікації оферти як обов’язкового договору продавцю потрібно додати повне зареєстроване найменування, код ЄДРПОУ або РНОКПП, реєстраційну адресу, платіжні реквізити та перевірити остаточні умови зі своїм юристом. Наразі доступні лише бренд, адреса та контакти з сайту.
              </div>
              <article className={cardClass}>
                <h2 className="mb-3 text-lg font-bold text-[#0d1f33]">1. Продавець і предмет пропозиції</h2>
                <p className="text-sm leading-7 text-slate-700">
                  Energo Comfort (далі — Продавець), адреса для зв’язку: {COMPANY_INFO.address}; телефон {COMPANY_INFO.phone1}, електронна пошта{' '}
                  <a className="text-[#1769aa] underline" href={`mailto:${COMPANY_INFO.email}`}>{COMPANY_INFO.email}</a>,
                  пропонує замовити обладнання, готові системи та послуги, описані на сайті {COMPANY_INFO.domain}. Повні реєстраційні дані Продавця мають бути зазначені тут до набрання офертою чинності.
                </p>
              </article>
              <article className={cardClass}>
                <h2 className="mb-3 text-lg font-bold text-[#0d1f33]">2. Замовлення і підтвердження</h2>
                <p className="text-sm leading-7 text-slate-700">
                  Покупець надсилає замовлення через кошик або звертається за консультацією. Надсилання форми на сайті є запитом на оформлення, а не підтвердженням наявності чи остаточної вартості. Продавець зв’язується з Покупцем, уточнює товар, кількість, адресу, строки та погоджує остаточні умови. Замовлення вважається погодженим після підтвердження Продавцем і згоди Покупця з узгодженими умовами.
                </p>
              </article>
              <article className={cardClass}>
                <h2 className="mb-3 text-lg font-bold text-[#0d1f33]">3. Ціна та оплата</h2>
                <p className="text-sm leading-7 text-slate-700">
                  Ціни в каталозі показуються у гривнях як розрахунок від ціни в доларах США за офіційним курсом НБУ. Поточний курс на сайті: <strong>{usdUahRate ? `1 USD = ${usdUahRate.toLocaleString('uk-UA')} грн` : 'завантажується'}</strong>. Розрахована ціна є інформаційною; суму до оплати в гривнях і доступний спосіб оплати Продавець повідомляє під час підтвердження замовлення. Оплата здійснюється лише після погодження рахунку або іншого платіжного способу.
                </p>
              </article>
              <article className={cardClass}>
                <h2 className="mb-3 text-lg font-bold text-[#0d1f33]">4. Передача товару, гарантія і повернення</h2>
                <p className="text-sm leading-7 text-slate-700">
                  Спосіб, строк і вартість доставки або самовивозу погоджуються окремо до оплати. Гарантійні умови на обладнання залежать від виробника та зазначаються в документах на товар. Права споживача на обмін, повернення та відмову від дистанційного договору визначаються законодавством України; окремі види товарів можуть мати передбачені законом винятки. Для звернення щодо замовлення: {COMPANY_INFO.phone1}, {COMPANY_INFO.email}.
                </p>
              </article>
              <article className={cardClass}>
                <h2 className="mb-3 text-lg font-bold text-[#0d1f33]">5. Дані продавця</h2>
                <p className="text-sm leading-7 text-slate-700">Energo Comfort · {COMPANY_INFO.address} · {COMPANY_INFO.phone1} · {COMPANY_INFO.email}</p>
                <p className="mt-2 text-sm leading-7 text-red-700">Повне найменування/ПІБ ФОП, ЄДРПОУ/РНОКПП, адреса державної реєстрації та платіжні реквізити: не надані — необхідно заповнити перед публікацією оферти.</p>
              </article>
            </>
          ) : (
            <>
              <article className={cardClass}>
                <div className="mb-3 flex items-center gap-2 text-[#1769aa]"><Banknote className="h-5 w-5" /><h2 className="text-lg font-bold text-[#0d1f33]">Оплата</h2></div>
                <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
                  <li>Замовте товар у кошику або залиште заявку на розрахунок.</li>
                  <li>Менеджер перевірить наявність, склад комплекту та фінальну суму у гривнях за курсом НБУ.</li>
                  <li>Після погодження вам нададуть актуальні варіанти оплати та, за потреби, рахунок. Не сплачуйте до отримання підтвердження замовлення.</li>
                </ul>
                <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  Орієнтовний перерахунок каталогу: {usdUahRate ? `1 USD = ${usdUahRate.toLocaleString('uk-UA')} грн` : 'курс НБУ завантажується'}.
                  {usdUahRate && <> Наприклад, $100 ≈ {formatUahFromUsd(100, usdUahRate)}.</>}
                  {' '}Остаточна сума до оплати вказується в погодженому замовленні.
                </p>
              </article>
              <article className={cardClass}>
                <div className="mb-3 flex items-center gap-2 text-[#1769aa]"><Truck className="h-5 w-5" /><h2 className="text-lg font-bold text-[#0d1f33]">Доставка</h2></div>
                <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
                  <li>Самовивіз з офісу/складу в Одесі: {COMPANY_INFO.address} — за попереднім погодженням.</li>
                  <li>Доставка по Україні перевізником погоджується з менеджером з урахуванням габаритів, ваги та умов перевізника.</li>
                  <li>Вартість перевезення та орієнтовна дата відправлення повідомляються перед підтвердженням.</li>
                  <li>Під час отримання перевірте цілісність упаковки та комплектацію разом із перевізником.</li>
                </ul>
              </article>
              <article className={cardClass}>
                <div className="mb-3 flex items-center gap-2 text-[#1769aa]"><PackageCheck className="h-5 w-5" /><h2 className="text-lg font-bold text-[#0d1f33]">Підтвердження замовлення</h2></div>
                <p className="text-sm leading-7 text-slate-700">Після відправлення заявки менеджер зв’яжеться з вами за вказаним телефоном і підтвердить склад, наявність, суму, оплату та доставку. Запитання: {COMPANY_INFO.phone1}, {COMPANY_INFO.phone2}, {COMPANY_INFO.email}.</p>
              </article>
              <a href="/public-offer" className="inline-flex items-center gap-2 text-sm font-bold text-[#1769aa] hover:underline"><FileText className="h-4 w-4" />Переглянути проєкт публічної оферти</a>
            </>
          )}
          <div>
            <button type="button" onClick={onBackHome} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-[#0d1f33] hover:bg-slate-50">
              <ArrowLeft className="h-4 w-4" />На головну
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
