umber; message: string }): express.RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req, res, next) => {
    const now = Date.now();
    if (hits.size > 2000) {
      for (const [key, bucket] of hits.entries()) {
        if (bucket.resetAt <= now) hits.delete(key);
      }
    }
    const ip = String(req.ip || req.socket.remoteAddress || 'unknown');
    const existing = hits.get(ip);
    if (!existing || existing.resetAt <= now) {
      hits.set(ip, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }
    if (existing.count >= options.max) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({ error: options.message });
      return;
    }
    existing.count += 1;
    next();
  };
}

const ALLOWED_PRODUCT_CATS: ProductCategory[] = ['kits', 'inverters', 'batteries', 'panels', 'parts'];

function sanitizeProductSpecs(raw: unknown): [string, string][] {
  if (!Array.isArray(raw)) return [];
  const out: [string, string][] = [];
  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const k = String(entry[0] ?? '').trim().slice(0, 120);
    const v = String(entry[1] ?? '').trim().slice(0, 300);
    if (!k) continue;
    out.push([k, v]);
    if (out.length >= 25) break;
  }
  return out;
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use('/api/crm/upload', express.json({ limit: '6mb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use('/uploads', express.static(getUploadsDir()));

  const formRateLimit = createRateLimiter({
    windowMs: 10 * 60_000,
    max: 8,
    message: 'Забагато заявок із вашої адреси. Будь ласка, зачекайте кілька хвилин або зателефонуйте +38 (050) 777-71-72.',
  });

  const authRateLimit = createRateLimiter({
    windowMs: 10 * 60_000,
    max: 12,
    message: 'Забагато спроб входу. Повторіть через 10 хвилин.',
  });

  const analyticsRateLimit = createRateLimiter({
    windowMs: 60_000,
    max: 120,
    message: 'Rate limit exceeded',
  });

  // SEO: robots.txt, sitemap.xml & Merchant XML Feed (Meta / Google Shopping)
  app.get('/robots.txt', (req, res) => {
    const baseUrl = getBaseUrl(req);
    res.type('text/plain; charset=utf-8').send(
      [
        'User-agent: *',
        'Allow: /',
        'Disallow: /api/',
        'Disallow: /crm',
        '',
        `Sitemap: ${baseUrl}/sitemap.xml`,
      ].join('\n'),
    );
  });

  app.get('/sitemap.xml', (req, res) => {
    const baseUrl = getBaseUrl(req);
    const today = new Date().toISOString().slice(0, 10);
    const staticPages = [
      { path: '/', priority: '1.0', changefreq: 'daily' },
      { path: '/shop', priority: '0.9', changefreq: 'daily' },
      { path: '/services', priority: '0.8', changefreq: 'weekly' },
      { path: '/projects', priority: '0.8', changefreq: 'weekly' },
      { path: '/contacts', priority: '0.7', changefreapi/crm/products', (req, res) => {
    const body = req.body as {
      title?: string;
      sku?: string;
      cat?: ProductCategory;
      brand?: string;
      isKit?: boolean;
      price?: number;
      oldPrice?: number;
      inStock?: boolean;
      statusLabel?: string;
      img?: string;
      specs?: unknown;
      description?: string;
    };
    if (!body.title?.trim()) {
      res.status(400).json({ error: 'Вкажіть назву товару' });
      return;
    }
    if (body.img !== undefined && !isSafeImageUrl(String(body.img))) {
      res.status(400).json({ error: 'Некоректне посилання на зображення (дозволено /... або https://)' });
      return;
    }
    const cat: ProductCategory = body.cat && ALLOWED_PRODUCT_CATS.includes(body.cat) ? body.cat : 'parts';
    const created = createProduct({
      title: body.title,
      sku: body.sku || '',
      cat,
      brand: body.brand || 'Energo Comfort',
      isKit: body.isKit,
      price: Number(body.price) || 0,
      oldPrice: Number(body.oldPrice) || 0,
      inStock: body.inStock ?? true,
      statusLabel: body.statusLabel,
      img: body.img ? String(body.img).trim() : '',
      specs: sanitizeProductSpecs(body.specs),
      description: body.description,
    });
    res.status(201).json({ product: created });
  });

  app.delete('/api/crm/products/:id', (req, res) => {
    const ok = deleteProduct(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Товар не знайдено' });
      return;
    }
    res.json({ ok: true });
  });

  // CRM Projects / Case Studies API & Persistent Upload
  app.post('/api/crm/upload', (req, res) => {
    const body = req.body as { dataUrl?: string };
    const dataUrl = String(body.dataUrl ?? '');
    const match = dataUrl.match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) {
      res.status(400).json({ error: 'Підтримуються тільки зображення JPG, PNG або WebP' });
      return;
    }

    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length === 0 || buffer.length > 4.5 * 1024 * 1024) {
      res.status(400).json({ error: 'Розмір зображення має бути до 4 МБ' });
      return;
    }

    const uploadsDir = getUploadsDir();
    const filename = `project-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const targetPath = path.resolve(uploadsDir, filename);
    if (!targetPath.startsWith(uploadsDir + path.sep)) {
      res.status(400).json({ error: 'Некоректний шлях файлу' });
      return;
    }

    fs.writeFileSync(targetPath, buffer);
    res.status(201).json({ url: `/uploads/${filename}` });
  });

  app.post('/api/crm/projects', (req, res) => {
    const body = req.body as {
      seg?: 'b2b' | 'b2c';
      tag?: string;
      title?: string;
      img?: string;
      task?: string;
      solution?: string;
      specs?: string;
      result?: string;
    };
    const title = String(body.title ?? '').trim();
    if (!title) {
      res.status(400).json({ error: 'Вкажіть назву об’єкта' });
      return;
    }
    const img = String(body.img ?? '').trim();
    if (!isSafeImageUrl(img)) {
      res.status(400).json({ error: 'Некоректне посилання на зображення' });
      return;
    }

    const created = createProjectCase({
      seg: body.seg === 'b2b' ? 'b2b' : 'b2c',
      tag: String(body.tag ?? ''),
      title,
      img,
      task: String(body.task ?? ''),
      solution: String(body.solution ?? ''),
      specs: String(body.specs ?? ''),
      result: String(body.result ?? ''),
    });
    res.status(201).json({ project: created });
  });

  app.patch('/api/crm/projects/:id', (req, res) => {
    const body = req.body as {
      seg?: 'b2b' | 'b2c';
      tag?: string;
      title?: string;
      img?: string;
      task?: string;
      solution?: string;
      specs?: string;
      result?: string;
    };
    if (body.img !== undefined && !isSafeImageUrl(String(body.img))) {
      res.status(400).json({ error: 'Некоректне посилання на зображення' });
      return;
    }
    const updated = updateProjectCase(req.params.id, body);
    if (!updated) {
      res.status(404).json({ error: 'Об’єкт не знайдено' });
      return;
    }
    res.json({ project: updated });
  });

  app.delete('/api/crm/projects/:id', (req, res) => {
    const ok = deleteProjectCase(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Об’єкт не знайдено' });
      return;
    }
    res.json({ ok: true });
  });

  // Telegram Bot Test Ping & Webhook Setup
  app.post('/api/crm/telegram-test', async (_req, res) => {
    if (!isTelegramConfigured()) {
      res.status(400).json({
        sent: false,
        error: 'Задайте TELEGRAM_BOT_TOKEN та TELEGRAM_CHAT_ID у змінних оточення (Railway / .env)',
      });
      return;
    }
    const chatId = process.env.TELEGRAM_CHAT_ID!.trim();
    const ok = await sendTelegramText(
      chatId,
      '<b>Energo Comfort CRM:</b> тестове з’єднання активне. Заявки та замовлення з сайту надходитимуть сюди автоматично.',
    );
    res.json({ sent: ok });
  });

  app.get('/api/crm/telegram-webhook', async (_req, res) => {
    const info = await getTelegramWebhookInfo();
    res.json(info);
  });

  app.post('/api/crm/telegram-webhook', async (req, res) => {
    const body = (req.body ?? {}) as { webhookUrl?: string };
    const rawUrl = String(body.webhookUrl ?? '').trim();
    const targetUrl = rawUrl || `${getBaseUrl(req)}/api/telegram/webhook`;
    try {
      const parsed = new URL(targetUrl);
      if (parsed.protocol !== 'https:') {
        res.status(400).json({ ok: false, error: 'Telegram Webhook вимагає HTTPS-адресу' });
        return;
      }
    } catch {
      res.status(400).json({ ok: false, error: 'Некоректний URL для Webhook' });
      return;
    }

    const result = await setTelegramWebhook(targetUrl);
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }
    const info = await getTelegramWebhookInfo();
    res.json({ ok: true, webhookUrl: targetUrl, description: result.description, info });
  });

  // Ready-to-use Telegram Bot Webhook (for Railway deployment)
  app.post('/api/telegram/webhook', async (req, res) => {
    const update = req.body as {
      message?: {
        chat?: { id: number };
        from?: { first_name?: string; username?: string };
        text?: string;
        contact?: { phone_number?: string; first_name?: string };
      };
    };

    const msg = update?.message;
    if (!msg?.chat?.id) {
      res.json({ ok: true });
      return;
    }

    const chatId = msg.chat.id;
    const text = (msg.text ?? '').trim();
    const senderName = [msg.from?.first_name, msg.from?.username ? `@${msg.from.username}` : '']
      .filter(Boolean)
      .join(' ');

    if (msg.contact?.phone_number) {
      const deal = createDeal({
        type: 'lead',
        customerName: msg.contact.first_name || senderName || 'Telegram клієнт',
        phone: msg.contact.phone_number,
        city: 'Одеса (Telegram Bot)',
        channel: 'Telegram',
        topic: 'Заявка з Telegram-бота',
        taskType: 'Підбір системи через Telegram',
      });
      await sendDealToTelegram(deal);
      await sendTelegramText(
        chatId,
        `Дякуємо! Вашу заявку <b>${deal.dealNumber}</b> збережено у CRM Energo Comfort. Інженер зв’яжеться з вами найближчим часом.`,
      );
      res.json({ ok: true });
      return;
    }

    if (text.startsWith('/start')) {
      await sendTelegramText(
        chatId,
        'Вітаємо в <b>Energo Comfort (Одеса)</b>!\n\nНадішліть ваш номер телефону або опис задачі (наприклад: <i>будинок 120м2, котел + холодильник, +380501234567</i>), і ми створимо інженерний розрахунок у CRM.\n\nКоманди:\n/catalog — популярні позиції\n/contacts — офіс в Одесі',
      );
    } else if (text.startsWith('/catalog')) {
      const top = listProducts({ cat: 'kits' }).slice(0, 4);
      const list = top.map((p) => `• ${p.title} — <b>$${p.price}</b>`).join('\n');
      await sendTelegramText(chatId, `<b>Готові рішеЀݐݑϠEnergo Comfort:</b>\n${list}`);
    } else if (text.startsWith('/contacts')) {
      await sendTelegramText(
        chatId,
        '<b>Energo Comfort</b>\nм. Одеса, вул. Європейська 93\n+38 (050) 777-71-72\n+38 (098) 152-32-61',
      );
    } else if (text.length >= 6) {
      const phoneMatch = text.match(/(\+?\d[\d\s\-()]{7,18}\d)/);
      if (phoneMatch) {
        const deal = createDeal({
          type: 'lead',
          customerName: senderName || 'Telegram клієнт',
          phone: phoneMatch[1],
          city: 'Одеса (Telegram Bot)',
          channel: 'Telegram',
          topic: 'Повідомлення у Telegram-боті',
          notes: text,
        });
        await sendDealToTelegram(deal);
        await sendTelegramText(
          chatId,
          `Заявку <b>${deal.dealNumber}</b> зафіксовано в CRM! Інженер скоро відповість.`,
        );
      } else {
        await sendTelegramText(
          chatId,
          'Щоб ми оформили заявку для інженера, вкажіть у повідомленні ваш номер телефону.',
        );
      }
    }

    res.json({ ok: true });
  });

  // Static assets & Vite / Production serving
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    const publicDir = path.resolve(process.cwd(), 'public');
    if (fs.existsSync(publicDir)) {
      app.use(express.static(publicDir));
    }
    const distHtmlPath = path.join(distDir, 'index.html');
    const distHtmlTemplate = fs.existsSync(distHtmlPath) ? fs.readFileSync(distHtmlPath, 'utf8') : '';
    app.use(express.static(distDir, { index: false }));
    app.get('*', (req, res) => {
      if (distHtmlTemplate) {
        res.type('text/html; charset=utf-8').send(buildRouteSeoHtml(distHtmlTemplate, req));
        return;
      }
      res.sendFile(distHtmlPath);
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Energo Comfort server running on http://${HOST}:${PORT} (${IS_PROD ? 'production' : 'dev'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
