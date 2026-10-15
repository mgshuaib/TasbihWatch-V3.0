#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
#  تهيئة بيئة الفحوص (تُشغَّل مرة واحدة — أو بعد أي بيئة جديدة)
# ════════════════════════════════════════════════════════════════════════
#  يحمّل:  jsdom + puppeteer (في tests/node_modules)  ومكتبات النظام التي
#  يحتاجها Chromium. وكلها **غير محفوظة** في حزمة التسليم، فيُعاد تركيبها.
# ════════════════════════════════════════════════════════════════════════
set -e
cd "$(dirname "$0")"
echo "▸ حزم Node: jsdom + puppeteer"
[ -d node_modules/jsdom ] && [ -d node_modules/puppeteer ] || npm install --silent jsdom puppeteer
echo "▸ مكتبات Chromium (قد تطلب كلمة المرور)"
if ! ldconfig -p 2>/dev/null | grep -q libnspr4; then
  sudo apt-get install -y -q libnspr4 libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 \
    libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
    libcairo2 libasound2t64 libxshmfence1 fonts-noto-core fonts-noto-color-emoji
fi
echo "✔ البيئة جاهزة"
